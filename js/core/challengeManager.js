// js/core/challengeManager.js
// Gestor Centralizado de Retas, Desafíos PVP y Rankings Comunitarios (v1.8.0)
import { 
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    setDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    getDoc,
    query, 
    where, 
    orderBy,
    limit as firestoreLimit 
} from '../firebaseConfig.js';
import { tenantManager } from './tenantManager.js';
import { authManager } from './authManager.js';
import { store } from './store.js';
import { auditLogger, AUDIT_ACTIONS } from './auditLogger.js';
import { handleAppError } from './errorHandler.js';
import { formatDateKey, format12Hour, getBusinessHoursForDate, timeToMinutes, minutesToTime, getMinutesSinceOperationalMidnight, isOverlapping } from './timeUtils.js';

/**
 * Limpia recursivamente campos undefined de objetos antes de enviar a Firestore
 */
function cleanFirestorePayload(obj) {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) {
        return obj.map(item => cleanFirestorePayload(item));
    }
    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = cleanFirestorePayload(value);
            }
        }
        return cleaned;
    }
    return obj;
}

export const CHALLENGE_STATUS = {
    PENDING: 'PENDING',                     // Propuesta inicial enviada por retador
    COUNTER_OFFERED: 'COUNTER_OFFERED',     // Contrapropuesta de horario/local enviada por el rival
    ACCEPTED: 'ACCEPTED',                   // Aceptado por ambas partes (Reservas generadas)
    REJECTED: 'REJECTED',                   // Rechazado
    CANCELLED: 'CANCELLED',                 // Cancelado por el retador antes de respuesta
    COMPLETED: 'COMPLETED'                  // Reta jugada con resultado registrado
};

export const CHALLENGE_MODES = {
    SAME_LOCAL: {
        id: 'SAME_LOCAL',
        name: 'Versus Presencial (Mismo Local)',
        badge: '👥 2P Mismo Gabinete',
        icon: '🕹️',
        desc: 'Ambos jugadores rentan el mismo gabinete para jugar retas 1 vs 1 cara a cara.'
    },
    DIFFERENT_LOCALS: {
        id: 'DIFFERENT_LOCALS',
        name: 'Duelo Remoto Sincronizado',
        badge: '⚡ Locales Distintos',
        icon: '🌐',
        desc: 'Cada jugador juega en su propia sucursal a la misma hora sincronizada por puntaje.'
    },
    EXTERNAL: {
        id: 'EXTERNAL',
        name: 'Reta Libre / Local Externo',
        badge: '📍 Local Externo / Libre',
        icon: '🤝',
        desc: 'Pacto de reta amistosa en un local no listado o plaza externa sin reserva en la red.'
    }
};

export const LIGA_ORDER = {
    'Liga SSS': 7,
    'Liga SS': 6,
    'Liga S': 5,
    'Liga A': 4,
    'Liga B': 3,
    'Liga C': 2,
    'Liga D': 1,
    'Sin Liga': 0
};

class ChallengeManager {
    constructor() {
        this.cache = new Map();
        this.listeners = [];
    }

    /**
     * Valida si un local tiene máquinas disponibles en una fecha y rango de horario específicos.
     */
    async checkLocationAvailability({ businessId, date, startTime, endTime, machineId = null }) {
        if (!businessId) return { available: true };

        const business = tenantManager.getAllBusinesses().find(b => b.id === businessId) || store.currentBusiness;
        if (!business) return { available: false, reason: "Sucursal no encontrada en el sistema." };

        // 1. Validar horario operativo de la sucursal (con soporte de cierre nocturno tras medianoche)
        const { openingTime, closingTime, isOpen } = getBusinessHoursForDate(business, date);
        if (!isOpen) {
            return { available: false, reason: `La sucursal ${business.name} se encuentra cerrada el ${date}.` };
        }

        const openNorm = getMinutesSinceOperationalMidnight(openingTime || '10:00', openingTime, closingTime);
        const closeNorm = getMinutesSinceOperationalMidnight(closingTime || '22:00', openingTime, closingTime);
        const startNorm = getMinutesSinceOperationalMidnight(startTime, openingTime, closingTime);
        const endNorm = getMinutesSinceOperationalMidnight(endTime, openingTime, closingTime);

        if (startNorm < openNorm || endNorm > closeNorm) {
            return { 
                available: false, 
                reason: `El horario (${format12Hour(startTime)} a ${format12Hour(endTime)}) está fuera del horario operativo de ${business.name} (${format12Hour(openingTime)} a ${format12Hour(closingTime)}).` 
            };
        }

        // 2. Obtener máquinas operativas de la sucursal
        let machines = [];
        if (isFirebaseAvailable && db) {
            try {
                const mSnap = await getDocs(query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", businessId)));
                mSnap.forEach(d => machines.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando máquinas:", e);
            }
        }
        if (machines.length === 0) {
            machines = JSON.parse(localStorage.getItem(`piu_machines_${businessId}`) || '[]');
        }

        const activeMachines = machines.filter(m => m.status !== 'MAINTENANCE' && m.status !== 'INACTIVE');
        if (activeMachines.length === 0) {
            return { available: false, reason: `No hay máquinas activas disponibles en ${business.name}.` };
        }

        // 3. Obtener reservaciones existentes de esa fecha en esa sucursal
        let reservations = [];
        if (isFirebaseAvailable && db) {
            try {
                const rSnap = await getDocs(query(
                    collection(db, COLLECTIONS.RESERVATIONS),
                    where("businessId", "==", businessId),
                    where("date", "==", date)
                ));
                rSnap.forEach(d => reservations.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando reservaciones:", e);
            }
        }
        if (reservations.length === 0) {
            const localRes = JSON.parse(localStorage.getItem(`piu_reservations_${businessId}`) || '[]');
            reservations = localRes.filter(r => r.date === date);
        }

        const validReservations = reservations.filter(r => r.status !== 'CANCELLED' && r.status !== 'REJECTED');

        const candidateMachines = machineId 
            ? activeMachines.filter(m => m.id === machineId)
            : activeMachines;

        // 4. Encontrar qué máquinas no tienen conflicto de horario (usando isOverlapping con soporte nocturno)
        const availableMachines = candidateMachines.filter(mach => {
            const hasOverlap = validReservations.some(res => {
                if (res.machineId !== mach.id) return false;
                return isOverlapping(res.startTime, res.endTime, startTime, endTime, openingTime, closingTime);
            });
            return !hasOverlap;
        });

        if (availableMachines.length === 0) {
            return {
                available: false,
                reason: machineId 
                    ? `El gabinete seleccionado en ${business.name} está ocupado entre ${format12Hour(startTime)} y ${format12Hour(endTime)}.`
                    : `No hay gabinetes disponibles en ${business.name} entre ${format12Hour(startTime)} y ${format12Hour(endTime)}. Todas las máquinas están ocupadas.`,
                business
            };
        }

        return {
            available: true,
            availableMachines,
            business
        };
    }

    /**
     * Genera la cuadrícula de bloques horarios de una sucursal en una fecha dada
     * evaluando en tiempo real cuáles tienen al menos 1 máquina disponible para la duración solicitada.
     * Si se especifica machineId, evalúa la disponibilidad para ese gabinete específico.
     */
    async getAvailableSlotsForBusiness({ businessId, date, durationMinutes = 60, intervalMinutes = 30, machineId = null }) {
        if (!businessId || !date) return { slots: [], isOpen: false, error: "Datos incompletos" };

        const business = tenantManager.getAllBusinesses().find(b => b.id === businessId) || store.currentBusiness;
        if (!business) return { slots: [], isOpen: false, error: "Sucursal no encontrada" };

        const { openingTime, closingTime, isOpen } = getBusinessHoursForDate(business, date);
        if (!isOpen) {
            return { slots: [], isOpen: false, error: `La sucursal ${business.name} se encuentra cerrada el ${date}` };
        }

        // 1. Obtener máquinas operativas
        let machines = [];
        if (isFirebaseAvailable && db) {
            try {
                const mSnap = await getDocs(query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", businessId)));
                mSnap.forEach(d => machines.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando máquinas:", e);
            }
        }
        if (machines.length === 0) {
            machines = JSON.parse(localStorage.getItem(`piu_machines_${businessId}`) || '[]');
        }
        const activeMachines = machines.filter(m => m.status !== 'MAINTENANCE' && m.status !== 'INACTIVE');
        if (activeMachines.length === 0) {
            return { slots: [], isOpen: true, error: `No hay máquinas activas en ${business.name}`, activeMachines: [] };
        }

        // 2. Obtener reservaciones de esa fecha
        let reservations = [];
        if (isFirebaseAvailable && db) {
            try {
                const rSnap = await getDocs(query(
                    collection(db, COLLECTIONS.RESERVATIONS),
                    where("businessId", "==", businessId),
                    where("date", "==", date)
                ));
                rSnap.forEach(d => reservations.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando reservaciones:", e);
            }
        }
        if (reservations.length === 0) {
            const localRes = JSON.parse(localStorage.getItem(`piu_reservations_${businessId}`) || '[]');
            reservations = localRes.filter(r => r.date === date);
        }
        const validReservations = reservations.filter(r => r.status !== 'CANCELLED' && r.status !== 'REJECTED');

        const candidateMachines = machineId 
            ? activeMachines.filter(m => m.id === machineId)
            : activeMachines;

        const openNorm = getMinutesSinceOperationalMidnight(openingTime || '11:00', openingTime, closingTime);
        const closeNorm = getMinutesSinceOperationalMidnight(closingTime || '22:00', openingTime, closingTime);

        const slots = [];
        for (let cur = openNorm; cur + durationMinutes <= closeNorm; cur += intervalMinutes) {
            const startTime = minutesToTime(cur % (24 * 60));
            const endTime = minutesToTime((cur + durationMinutes) % (24 * 60));

            // Contar máquinas libres en este bloque
            const freeMachines = candidateMachines.filter(mach => {
                const overlap = validReservations.some(res => {
                    if (res.machineId !== mach.id) return false;
                    return isOverlapping(res.startTime, res.endTime, startTime, endTime, openingTime, closingTime);
                });
                return !overlap;
            });

            slots.push({
                startTime,
                endTime,
                isAvailable: freeMachines.length > 0,
                freeCount: freeMachines.length,
                totalMachines: candidateMachines.length,
                label: format12Hour(startTime),
                endLabel: format12Hour(endTime)
            });
        }

        return {
            slots,
            isOpen: true,
            openingTime,
            closingTime,
            business,
            activeMachines,
            activeMachinesCount: activeMachines.length
        };
    }

    /**
     * Evalúa la disponibilidad horaria cruzada entre una o dos sucursales.
     * Si son 2 sucursales distintas, únicamente marca como libre los horarios donde AMBAS tienen cupo.
     */
    async getIntersectionAvailableSlotsForBusinesses({ businessIdA, businessIdB = null, date, durationMinutes = 60, intervalMinutes = 30 }) {
        if (!businessIdA && !businessIdB) return { slots: [], isOpen: false, error: "Selecciona una sucursal" };

        // Si es el mismo local o no se especificó un segundo local
        if (!businessIdB || businessIdA === businessIdB) {
            const res = await this.getAvailableSlotsForBusiness({ businessId: businessIdA, date, durationMinutes, intervalMinutes });
            return {
                ...res,
                isDualLocation: false
            };
        }

        // Si son 2 sucursales distintas, consultar ambas en paralelo
        const [resA, resB] = await Promise.all([
            this.getAvailableSlotsForBusiness({ businessId: businessIdA, date, durationMinutes, intervalMinutes }),
            this.getAvailableSlotsForBusiness({ businessId: businessIdB, date, durationMinutes, intervalMinutes })
        ]);

        if (!resA.isOpen) return { slots: [], isOpen: false, error: `${resA.business?.name || 'Sucursal A'} está cerrada el ${date}` };
        if (!resB.isOpen) return { slots: [], isOpen: false, error: `${resB.business?.name || 'Sucursal B'} está cerrada el ${date}` };

        const slotsA = resA.slots || [];
        const slotsB = resB.slots || [];

        const intersectionSlots = [];
        slotsA.forEach(sA => {
            const sB = slotsB.find(slot => slot.startTime === sA.startTime && slot.endTime === sA.endTime);
            const bothAvailable = sA.isAvailable && (sB ? sB.isAvailable : false);

            let reason = '';
            if (!sA.isAvailable && (!sB || !sB.isAvailable)) {
                reason = 'Sin cupo en ambos locales';
            } else if (!sA.isAvailable) {
                reason = `Lleno en ${resA.business?.name || 'Local 1'}`;
            } else if (!sB || !sB.isAvailable) {
                reason = `Lleno en ${resB.business?.name || 'Local 2'}`;
            }

            intersectionSlots.push({
                startTime: sA.startTime,
                endTime: sA.endTime,
                isAvailable: bothAvailable,
                freeCountA: sA.freeCount,
                freeCountB: sB ? sB.freeCount : 0,
                freeCount: Math.min(sA.freeCount, sB ? sB.freeCount : 0),
                label: sA.label,
                endLabel: sA.endLabel,
                reason
            });
        });

        return {
            slots: intersectionSlots,
            isOpen: true,
            isDualLocation: true,
            businessA: resA.business,
            businessB: resB.business
        };
    }

    /**
     * Crea y envía una propuesta de reto a otro jugador.
     */
    async createChallenge({
        challengerId,
        challengerName,
        challengerUsername = '',
        challengerAvatar = '🕺',
        challengerLeague = 'Liga C',
        opponentId,
        opponentName,
        opponentUsername = '',
        opponentAvatar = '🕺',
        opponentLeague = 'Liga C',
        mode = 'SAME_LOCAL',
        date,
        startTime,
        endTime,
        businessId = null,
        businessName = '',
        machineId = null,
        machineName = '',
        businessIdB = null,
        businessNameB = '',
        machineIdB = null,
        machineNameB = '',
        isExternalLocation = false,
        externalLocationName = '',
        notes = '',
        wager = ''
    }) {
        if (!challengerId || !opponentId) {
            throw new Error("Se requiere retador y oponente válidos.");
        }
        if (challengerId === opponentId) {
            throw new Error("No puedes retarte a ti mismo.");
        }
        if (!date || !startTime || !endTime) {
            throw new Error("Fecha y rango de horario son obligatorios.");
        }

        // Validar disponibilidad antes de crear
        if (businessId && !isExternalLocation && mode !== 'EXTERNAL') {
            const checkA = await this.checkLocationAvailability({ businessId, date, startTime, endTime, machineId });
            if (!checkA.available) {
                throw new Error(checkA.reason);
            }
        }
        if (mode === 'DIFFERENT_LOCALS' && businessIdB) {
            const checkB = await this.checkLocationAvailability({ businessId: businessIdB, date, startTime, endTime, machineId: machineIdB });
            if (!checkB.available) {
                throw new Error(checkB.reason);
            }
        }

        const challengeId = `chal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const nowIso = new Date().toISOString();

        const newChallenge = {
            id: challengeId,
            status: CHALLENGE_STATUS.PENDING,
            mode,
            challenger: {
                id: challengerId,
                name: challengerName,
                username: challengerUsername,
                avatar: challengerAvatar,
                league: challengerLeague
            },
            opponent: {
                id: opponentId,
                name: opponentName,
                username: opponentUsername,
                avatar: opponentAvatar,
                league: opponentLeague
            },
            schedule: {
                date,
                startTime,
                endTime
            },
            location: {
                businessId: businessId || null,
                businessName: businessName || '',
                machineId: machineId || null,
                machineName: machineName || '',
                businessIdB: businessIdB || null,
                businessNameB: businessNameB || '',
                machineIdB: machineIdB || null,
                machineNameB: machineNameB || '',
                isExternal: isExternalLocation || mode === 'EXTERNAL',
                externalName: externalLocationName || ''
            },
            notes: notes || '',
            wager: wager || '',
            turn: opponentId, // El rival debe responder primero
            history: [
                {
                    action: 'CREATED',
                    actorId: challengerId,
                    actorName: challengerName,
                    date,
                    startTime,
                    endTime,
                    location: businessName || externalLocationName || 'Local',
                    notes,
                    createdAt: nowIso
                }
            ],
            reservationIds: [],
            matchResult: null,
            createdAt: nowIso,
            updatedAt: nowIso
        };

        // Guardar en Firestore
        const cleanChallenge = cleanFirestorePayload(newChallenge);
        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.CHALLENGES, challengeId), cleanChallenge);
            } catch (err) {
                handleAppError(err, { context: "Error guardando reto en Firestore", showToast: true, rethrow: true });
            }
        }

        // Cache local
        const localList = this.getLocalChallenges();
        localList.unshift(cleanChallenge);
        this.saveLocalChallenges(localList);

        this.notify();
        return cleanChallenge;
    }

    /**
     * Obtiene la lista de retos asociados a un jugador (como retador o retado).
     */
    async getChallengesForUser(userId) {
        if (!userId) return [];
        let list = [];

        if (isFirebaseAvailable && db) {
            try {
                const qChallenger = query(
                    collection(db, COLLECTIONS.CHALLENGES),
                    where("challenger.id", "==", userId)
                );
                const qOpponent = query(
                    collection(db, COLLECTIONS.CHALLENGES),
                    where("opponent.id", "==", userId)
                );

                const [snap1, snap2] = await Promise.all([getDocs(qChallenger), getDocs(qOpponent)]);
                const map = new Map();
                snap1.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
                snap2.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
                list = Array.from(map.values());
            } catch (err) {
                console.warn("Error cargando retos desde Firebase:", err);
            }
        }

        if (list.length === 0) {
            const local = this.getLocalChallenges();
            list = local.filter(c => c.challenger?.id === userId || c.opponent?.id === userId);
        }

        list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        return list;
    }

    /**
     * Obtiene todos los retos del sistema para auditoría o ranking global.
     */
    async getGlobalChallenges(maxResults = 100) {
        let list = [];
        if (isFirebaseAvailable && db) {
            try {
                const q = query(
                    collection(db, COLLECTIONS.CHALLENGES),
                    firestoreLimit(maxResults)
                );
                const snap = await getDocs(q);
                snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            } catch (err) {
                console.warn("Error cargando retos globales:", err);
            }
        }

        if (list.length === 0) {
            list = this.getLocalChallenges();
        }

        list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        return list;
    }

    /**
     * Contrapropone nuevos horarios o local para un reto.
     */
    async counterOfferChallenge(challengeId, actorUser, {
        newDate,
        newStartTime,
        newEndTime,
        newBusinessId = null,
        newBusinessName = '',
        newMachineId = null,
        newMachineName = '',
        newBusinessIdB = null,
        newBusinessNameB = '',
        newMachineIdB = null,
        newMachineNameB = '',
        newMode = null,
        isExternalLocation = false,
        externalLocationName = '',
        counterNotes = ''
    } = {}) {
        const challenge = await this.getChallengeById(challengeId);
        if (!challenge) throw new Error("Reto no encontrado.");

        if (challenge.status !== CHALLENGE_STATUS.PENDING && 
            challenge.status !== CHALLENGE_STATUS.COUNTER_OFFERED && 
            challenge.status !== CHALLENGE_STATUS.ACCEPTED) {
            throw new Error("Este reto ya no está disponible para cambios de horario.");
        }

        const challengerId = challenge.challenger?.id;
        const opponentId = challenge.opponent?.id;
        const isChallenger = challengerId === actorUser.id;
        const nextTurnId = isChallenger ? (opponentId || challengerId) : (challengerId || opponentId);
        const nowIso = new Date().toISOString();

        // Cancelar reservaciones previas si las había
        if (Array.isArray(challenge.reservationIds) && challenge.reservationIds.length > 0) {
            for (const oldResId of challenge.reservationIds) {
                if (isFirebaseAvailable && db) {
                    try {
                        await updateDoc(doc(db, COLLECTIONS.RESERVATIONS, oldResId), {
                            status: 'CANCELLED',
                            adminNotes: 'Cancelada por cambio de horario/local en Arena Versus',
                            updatedAt: nowIso
                        });
                    } catch (e) {}
                }
            }
        }

        const finalMode = newMode || challenge.mode || 'SAME_LOCAL';

        const updatedSchedule = {
            date: newDate || challenge.schedule?.date || formatDateKey(new Date()),
            startTime: newStartTime || challenge.schedule?.startTime || '12:00',
            endTime: newEndTime || challenge.schedule?.endTime || '13:00'
        };

        const prevLoc = challenge.location || {};
        let updatedLocation = {};

        if (finalMode === 'DIFFERENT_LOCALS') {
            if (isChallenger) {
                // El retador (Jugador A) actualiza su local (A) y mantiene el local del rival (B)
                const finalBizA = (newBusinessId !== undefined && newBusinessId !== null) ? newBusinessId : (prevLoc.businessId || null);
                const finalNameA = newBusinessName || prevLoc.businessName || '';
                const finalMachA = (newMachineId !== undefined && newMachineId !== null) ? newMachineId : (prevLoc.machineId || null);
                const finalMachNameA = newMachineName || prevLoc.machineName || '';

                const finalBizB = (newBusinessIdB !== undefined && newBusinessIdB !== null) ? newBusinessIdB : (prevLoc.businessIdB || null);
                const finalNameB = newBusinessNameB || prevLoc.businessNameB || '';
                const finalMachB = (newMachineIdB !== undefined && newMachineIdB !== null) ? newMachineIdB : (prevLoc.machineIdB || null);
                const finalMachNameB = newMachineNameB || prevLoc.machineNameB || '';

                updatedLocation = {
                    businessId: finalBizA,
                    businessName: finalNameA,
                    machineId: finalMachA,
                    machineName: finalMachNameA,
                    businessIdB: finalBizB,
                    businessNameB: finalNameB,
                    machineIdB: finalMachB,
                    machineNameB: finalMachNameB,
                    isExternal: Boolean(isExternalLocation || prevLoc.isExternal),
                    externalName: externalLocationName || prevLoc.externalName || ''
                };
            } else {
                // El rival (Jugador B) mantiene el local del retador (A) y actualiza su propio local (B)
                const finalBizA = prevLoc.businessId || null;
                const finalNameA = prevLoc.businessName || '';
                const finalMachA = prevLoc.machineId || null;
                const finalMachNameA = prevLoc.machineName || '';

                const finalBizB = (newBusinessIdB !== undefined && newBusinessIdB !== null) 
                    ? newBusinessIdB 
                    : ((newBusinessId !== undefined && newBusinessId !== null) ? newBusinessId : (prevLoc.businessIdB || null));
                const finalNameB = newBusinessNameB || newBusinessName || prevLoc.businessNameB || '';
                const finalMachB = (newMachineIdB !== undefined && newMachineIdB !== null) 
                    ? newMachineIdB 
                    : ((newMachineId !== undefined && newMachineId !== null) ? newMachineId : (prevLoc.machineIdB || null));
                const finalMachNameB = newMachineNameB || newMachineName || prevLoc.machineNameB || '';

                updatedLocation = {
                    businessId: finalBizA,
                    businessName: finalNameA,
                    machineId: finalMachA,
                    machineName: finalMachNameA,
                    businessIdB: finalBizB,
                    businessNameB: finalNameB,
                    machineIdB: finalMachB,
                    machineNameB: finalMachNameB,
                    isExternal: Boolean(isExternalLocation || prevLoc.isExternal),
                    externalName: externalLocationName || prevLoc.externalName || ''
                };
            }
        } else {
            // SAME_LOCAL (Presencial)
            updatedLocation = {
                businessId: (newBusinessId !== undefined && newBusinessId !== null) ? newBusinessId : (prevLoc.businessId || null),
                businessName: newBusinessName || prevLoc.businessName || '',
                machineId: (newMachineId !== undefined && newMachineId !== null) ? newMachineId : (prevLoc.machineId || null),
                machineName: newMachineName || prevLoc.machineName || '',
                businessIdB: null,
                businessNameB: '',
                machineIdB: null,
                machineNameB: '',
                isExternal: Boolean(isExternalLocation || prevLoc.isExternal),
                externalName: externalLocationName || prevLoc.externalName || ''
            };
        }

        // Validar disponibilidad en sucursal A
        if (updatedLocation.businessId && !updatedLocation.isExternal) {
            const checkA = await this.checkLocationAvailability({
                businessId: updatedLocation.businessId,
                date: updatedSchedule.date,
                startTime: updatedSchedule.startTime,
                endTime: updatedSchedule.endTime,
                machineId: updatedLocation.machineId
            });
            if (!checkA.available) {
                throw new Error(`En sucursal ${updatedLocation.businessName || 'A'}: ${checkA.reason}`);
            }
        }

        // Validar disponibilidad en sucursal B si es duelo remoto
        if (finalMode === 'DIFFERENT_LOCALS' && updatedLocation.businessIdB && !updatedLocation.isExternal) {
            const checkB = await this.checkLocationAvailability({
                businessId: updatedLocation.businessIdB,
                date: updatedSchedule.date,
                startTime: updatedSchedule.startTime,
                endTime: updatedSchedule.endTime,
                machineId: updatedLocation.machineIdB
            });
            if (!checkB.available) {
                throw new Error(`En tu sucursal ${updatedLocation.businessNameB || 'B'}: ${checkB.reason}`);
            }
        }

        const historyLocationLabel = finalMode === 'DIFFERENT_LOCALS'
            ? `⚡ ${updatedLocation.businessName || 'Local A'} vs ${updatedLocation.businessNameB || 'Local B'}`
            : (updatedLocation.businessName || updatedLocation.externalName || 'Local');

        const historyEntry = {
            action: 'COUNTER_OFFER',
            actorId: actorUser.id || 'unknown',
            actorName: actorUser.name || 'Jugador',
            date: updatedSchedule.date,
            startTime: updatedSchedule.startTime,
            endTime: updatedSchedule.endTime,
            location: historyLocationLabel,
            notes: counterNotes || '',
            createdAt: nowIso
        };

        const rawUpdatedData = {
            status: CHALLENGE_STATUS.COUNTER_OFFERED,
            mode: finalMode,
            schedule: updatedSchedule,
            location: updatedLocation,
            turn: nextTurnId || '',
            reservationIds: [],
            history: [...(challenge.history || []), historyEntry],
            updatedAt: nowIso
        };

        const updatedData = cleanFirestorePayload(rawUpdatedData);

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.CHALLENGES, challengeId), updatedData);
            } catch (err) {
                handleAppError(err, { context: "Error enviando contrapropuesta", showToast: true, rethrow: true });
            }
        }

        this.updateLocalChallenge(challengeId, updatedData);
        this.notify();
        return { ...challenge, ...updatedData };
    }

    /**
     * Crea y persiste una reservación oficial como PENDIENTE en Firestore, Machine Schedules y caché local.
     */
    async createOfficialReservation({
        businessId,
        machineId,
        machineName,
        date,
        startTime,
        endTime,
        clientId,
        clientName,
        clientUsername,
        clientPhone,
        playersCount = 1,
        opponentId = null,
        opponentName = '',
        notes = '',
        challengeId = null
    }) {
        if (!businessId) return null;

        const resId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const nowIso = new Date().toISOString();

        const startM = timeToMinutes(startTime);
        const endM = timeToMinutes(endTime);
        let dur = (startM !== null && endM !== null && endM > startM) ? (endM - startM) : 60;

        const reservationPayload = {
            id: resId,
            businessId,
            machineId: machineId || 'mach_1',
            machineName: machineName || 'Gabinete Pump It Up',
            clientId: clientId || null,
            clientName: clientName || 'Jugador PVP',
            clientUsername: clientUsername || '',
            clientPhone: clientPhone || '',
            date,
            startTime,
            endTime,
            durationMinutes: dur,
            playersMode: playersCount,
            status: 'PENDING', // Enviada como pendiente para que el encargado la apruebe
            totalCost: 0,
            notes: notes || '⚔️ Reta PVP Oficial pactada en Arena Versus',
            adminNotes: '⚔️ Solicitud de Reta PVP generada desde Arena Versus',
            isVersusMatch: true,
            challengeId: challengeId || null,
            opponentId: opponentId || null,
            opponentName: opponentName || '',
            createdAt: nowIso,
            updatedAt: nowIso
        };

        const cleanRes = cleanFirestorePayload(reservationPayload);

        // 1. Guardar en Firestore COLLECTIONS.RESERVATIONS
        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.RESERVATIONS, resId), cleanRes);

                // Actualizar o crear slot en COLLECTIONS.MACHINE_SCHEDULES
                const scheduleKey = `${businessId}_${machineId || 'mach_1'}_${date}`;
                const scheduleRef = doc(db, COLLECTIONS.MACHINE_SCHEDULES, scheduleKey);
                const scheduleDoc = await getDoc(scheduleRef);
                const currentSlots = scheduleDoc.exists() ? (scheduleDoc.data().slots || []) : [];
                const updatedSlots = currentSlots.filter(s => s.resId !== resId);
                updatedSlots.push({
                    resId,
                    startTime,
                    endTime,
                    status: 'PENDING',
                    clientName: cleanRes.clientName,
                    clientId: cleanRes.clientId,
                    isVersusMatch: true,
                    challengeId: challengeId || null,
                    updatedAt: nowIso
                });

                await setDoc(scheduleRef, {
                    businessId,
                    machineId: machineId || 'mach_1',
                    date,
                    slots: updatedSlots,
                    updatedAt: nowIso
                }, { merge: true });
            } catch (err) {
                console.error("Error guardando reservación oficial de reta en Firebase:", err);
            }
        }

        // 2. Guardar en caché local de esa sucursal
        try {
            const localKey = `piu_reservations_${businessId}`;
            const currentLocal = JSON.parse(localStorage.getItem(localKey) || '[]');
            const updatedLocal = currentLocal.filter(r => r.id !== resId);
            updatedLocal.push(cleanRes);
            localStorage.setItem(localKey, JSON.stringify(updatedLocal));

            // Si la sucursal actual en store coincide, agregar a pendientes y notificar
            if (store && store.currentBusiness && store.currentBusiness.id === businessId) {
                if (Array.isArray(store.pendingReservations) && !store.pendingReservations.some(r => r.id === resId)) {
                    store.pendingReservations.push(cleanRes);
                } else if (Array.isArray(store.reservations) && !store.reservations.some(r => r.id === resId)) {
                    store.reservations.push(cleanRes);
                }
                if (typeof store.notify === 'function') {
                    store.notify();
                }
            }
        } catch (e) {
            console.warn("Error guardando en localStorage:", e);
        }

        return cleanRes;
    }

    /**
     * Se invoca cuando una reservación asociada a un reto es rechazada o eliminada/cancelada por un encargado o superadmin.
     */
    async handleReservationRejectedOrCancelled(challengeId, reason = 'Cancelada por encargado') {
        const challenge = await this.getChallengeById(challengeId);
        if (!challenge) return;

        const nowIso = new Date().toISOString();
        const historyEntry = {
            action: 'STAFF_REJECTED',
            actorId: 'STAFF',
            actorName: 'Encargado de Sucursal',
            notes: reason || 'Reservación no disponible en sucursal',
            createdAt: nowIso
        };

        const rawUpdatedData = {
            status: CHALLENGE_STATUS.COUNTER_OFFERED,
            staffRejectionReason: reason || 'Horario o máquina no disponible',
            reservationIds: [],
            turn: challenge.challenger?.id || challenge.opponent?.id || '',
            history: [...(challenge.history || []), historyEntry],
            updatedAt: nowIso
        };

        const updatedData = cleanFirestorePayload(rawUpdatedData);

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.CHALLENGES, challengeId), updatedData);
            } catch (err) {
                console.warn("Error actualizando reto tras cancelación de reserva:", err);
            }
        }

        this.updateLocalChallenge(challengeId, updatedData);
        this.notify();
    }

    /**
     * Acepta el reto y dispara automáticamente la creación de reservaciones correspondientes.
     */
    async acceptChallenge(challengeId, actorUser, { mode = null, businessIdB = null, businessNameB = '' } = {}) {
        const challenge = await this.getChallengeById(challengeId);
        if (!challenge) throw new Error("Reto no encontrado.");

        if (challenge.status !== CHALLENGE_STATUS.PENDING && challenge.status !== CHALLENGE_STATUS.COUNTER_OFFERED) {
            throw new Error("El reto no se encuentra disponible para aceptación.");
        }

        if (mode) challenge.mode = mode;
        if (businessIdB) {
            challenge.location.businessIdB = businessIdB;
            challenge.location.businessNameB = businessNameB || '';
        }

        // Re-validar disponibilidad antes de crear
        if (challenge.mode === 'SAME_LOCAL' && challenge.location.businessId && !challenge.location.isExternal) {
            const check = await this.checkLocationAvailability({
                businessId: challenge.location.businessId,
                date: challenge.schedule.date,
                startTime: challenge.schedule.startTime,
                endTime: challenge.schedule.endTime,
                machineId: challenge.location.machineId
            });
            if (!check.available) {
                throw new Error(`No se pudo confirmar la reservación en ${challenge.location.businessName}: ${check.reason}`);
            }
        }

        if (challenge.mode === 'DIFFERENT_LOCALS') {
            if (challenge.location.businessId) {
                const checkA = await this.checkLocationAvailability({
                    businessId: challenge.location.businessId,
                    date: challenge.schedule.date,
                    startTime: challenge.schedule.startTime,
                    endTime: challenge.schedule.endTime,
                    machineId: challenge.location.machineId
                });
                if (!checkA.available) throw new Error(`Disponibilidad insuficiente en ${challenge.location.businessName}: ${checkA.reason}`);
            }
            if (challenge.location.businessIdB) {
                const checkB = await this.checkLocationAvailability({
                    businessId: challenge.location.businessIdB,
                    date: challenge.schedule.date,
                    startTime: challenge.schedule.startTime,
                    endTime: challenge.schedule.endTime,
                    machineId: challenge.location.machineIdB
                });
                if (!checkB.available) throw new Error(`Disponibilidad insuficiente en ${challenge.location.businessNameB}: ${checkB.reason}`);
            }
        }

        const nowIso = new Date().toISOString();
        const createdReservationIds = [];

        // AUTOMATIZACIÓN DE RESERVACIONES
        // Escenario 1: Versus en el Mismo Local
        if (challenge.mode === 'SAME_LOCAL' && challenge.location.businessId && !challenge.location.isExternal) {
            const bizId = challenge.location.businessId;
            try {
                // Cargar máquinas de ese local
                let machines = [];
                if (isFirebaseAvailable && db) {
                    try {
                        const mSnap = await getDocs(query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", bizId)));
                        mSnap.forEach(d => machines.push({ id: d.id, ...d.data() }));
                    } catch (e) {}
                }
                if (machines.length === 0) {
                    machines = JSON.parse(localStorage.getItem(`piu_machines_${bizId}`) || '[]');
                }
                if (machines.length === 0 && store.machines && store.currentBusiness?.id === bizId) {
                    machines = store.machines;
                }

                const availableMachine = (challenge.location.machineId && machines.find(m => m.id === challenge.location.machineId)) 
                    || machines.find(m => m.status === 'AVAILABLE') 
                    || machines[0]
                    || { id: challenge.location.machineId || 'mach_1', name: challenge.location.machineName || 'Gabinete 1' };

                const createdRes = await this.createOfficialReservation({
                    businessId: bizId,
                    machineId: availableMachine.id,
                    machineName: availableMachine.name,
                    date: challenge.schedule.date,
                    startTime: challenge.schedule.startTime,
                    endTime: challenge.schedule.endTime,
                    clientId: challenge.challenger.id,
                    clientName: `${challenge.challenger.name} vs ${challenge.opponent.name}`,
                    clientUsername: challenge.challenger.username,
                    clientPhone: challenge.challenger.phone || '',
                    playersCount: 2,
                    opponentId: challenge.opponent.id,
                    opponentName: challenge.opponent.name,
                    notes: `⚔️ Reta PVP Oficial: ${challenge.notes || 'Duelo pactado en Arena Versus'}`,
                    challengeId: challenge.id
                });

                if (createdRes && createdRes.id) {
                    createdReservationIds.push(createdRes.id);
                }
            } catch (resErr) {
                console.error("Error creando reservación automática 2P:", resErr);
            }
        }

        // Escenario 2: Duelo Remoto en Locales Distintos
        if (challenge.mode === 'DIFFERENT_LOCALS') {
            const bizA = challenge.location.businessId;
            const bizB = challenge.location.businessIdB;

            // Reserva Jugador A
            if (bizA) {
                try {
                    let machinesA = [];
                    if (isFirebaseAvailable && db) {
                        try {
                            const mSnapA = await getDocs(query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", bizA)));
                            mSnapA.forEach(d => machinesA.push({ id: d.id, ...d.data() }));
                        } catch (e) {}
                    }
                    if (machinesA.length === 0) {
                        machinesA = JSON.parse(localStorage.getItem(`piu_machines_${bizA}`) || '[]');
                    }
                    if (machinesA.length === 0 && store.machines && store.currentBusiness?.id === bizA) {
                        machinesA = store.machines;
                    }

                    const machA = (challenge.location.machineId && machinesA.find(m => m.id === challenge.location.machineId))
                        || machinesA.find(m => m.status === 'AVAILABLE') 
                        || machinesA[0]
                        || { id: challenge.location.machineId || 'mach_a', name: challenge.location.machineName || 'Gabinete 1' };

                    const resA = await this.createOfficialReservation({
                        businessId: bizA,
                        machineId: machA.id,
                        machineName: machA.name,
                        date: challenge.schedule.date,
                        startTime: challenge.schedule.startTime,
                        endTime: challenge.schedule.endTime,
                        clientId: challenge.challenger.id,
                        clientName: `${challenge.challenger.name} (vs ${challenge.opponent.name})`,
                        clientUsername: challenge.challenger.username,
                        clientPhone: challenge.challenger.phone || '',
                        playersCount: 1,
                        opponentId: challenge.opponent.id,
                        opponentName: challenge.opponent.name,
                        notes: `⚔️ Duelo Remoto Sincronizado vs ${challenge.opponent.name} (en ${challenge.location.businessNameB || 'otra sucursal'})`,
                        challengeId: challenge.id
                    });

                    if (resA && resA.id) createdReservationIds.push(resA.id);
                } catch (errA) {
                    console.error("Error creando reserva remota A:", errA);
                }
            }

            // Reserva Jugador B
            if (bizB) {
                try {
                    let machinesB = [];
                    if (isFirebaseAvailable && db) {
                        try {
                            const mSnapB = await getDocs(query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", bizB)));
                            mSnapB.forEach(d => machinesB.push({ id: d.id, ...d.data() }));
                        } catch (e) {}
                    }
                    if (machinesB.length === 0) {
                        machinesB = JSON.parse(localStorage.getItem(`piu_machines_${bizB}`) || '[]');
                    }
                    if (machinesB.length === 0 && store.machines && store.currentBusiness?.id === bizB) {
                        machinesB = store.machines;
                    }

                    const machB = (challenge.location.machineIdB && machinesB.find(m => m.id === challenge.location.machineIdB))
                        || machinesB.find(m => m.status === 'AVAILABLE') 
                        || machinesB[0]
                        || { id: challenge.location.machineIdB || 'mach_b', name: challenge.location.machineNameB || 'Gabinete 1' };

                    const resB = await this.createOfficialReservation({
                        businessId: bizB,
                        machineId: machB.id,
                        machineName: machB.name,
                        date: challenge.schedule.date,
                        startTime: challenge.schedule.startTime,
                        endTime: challenge.schedule.endTime,
                        clientId: challenge.opponent.id,
                        clientName: `${challenge.opponent.name} (vs ${challenge.challenger.name})`,
                        clientUsername: challenge.opponent.username,
                        clientPhone: challenge.opponent.phone || '',
                        playersCount: 1,
                        opponentId: challenge.challenger.id,
                        opponentName: challenge.challenger.name,
                        notes: `⚔️ Duelo Remoto Sincronizado vs ${challenge.challenger.name} (en ${challenge.location.businessName || 'otra sucursal'})`,
                        challengeId: challenge.id
                    });

                    if (resB && resB.id) createdReservationIds.push(resB.id);
                } catch (errB) {
                    console.error("Error creando reserva remota B:", errB);
                }
            }
        }

        const historyEntry = {
            action: 'ACCEPTED',
            actorId: actorUser.id || 'unknown',
            actorName: actorUser.name || 'Jugador',
            createdAt: nowIso
        };

        const rawUpdatedData = {
            status: CHALLENGE_STATUS.ACCEPTED,
            reservationIds: createdReservationIds,
            history: [...(challenge.history || []), historyEntry],
            updatedAt: nowIso
        };

        const updatedData = cleanFirestorePayload(rawUpdatedData);

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.CHALLENGES, challengeId), updatedData);
            } catch (err) {
                handleAppError(err, { context: "Error aceptando reto", showToast: true, rethrow: true });
            }
        }

        this.updateLocalChallenge(challengeId, updatedData);
        this.notify();
        return { ...challenge, ...updatedData };
    }

    /**
     * Declina o cancela un reto.
     */
    async rejectChallenge(challengeId, actorUser, reason = '') {
        const challenge = await this.getChallengeById(challengeId);
        if (!challenge) throw new Error("Reto no encontrado.");

        const isChallenger = challenge.challenger.id === actorUser.id;
        const newStatus = isChallenger ? CHALLENGE_STATUS.CANCELLED : CHALLENGE_STATUS.REJECTED;
        const nowIso = new Date().toISOString();

        const historyEntry = {
            action: newStatus,
            actorId: actorUser.id || 'unknown',
            actorName: actorUser.name || 'Jugador',
            notes: reason || '',
            createdAt: nowIso
        };

        const rawUpdatedData = {
            status: newStatus,
            rejectionReason: reason || '',
            history: [...(challenge.history || []), historyEntry],
            updatedAt: nowIso
        };

        const updatedData = cleanFirestorePayload(rawUpdatedData);

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.CHALLENGES, challengeId), updatedData);
            } catch (err) {
                handleAppError(err, { context: "Error actualizando estado del reto", showToast: true, rethrow: true });
            }
        }

        this.updateLocalChallenge(challengeId, updatedData);
        this.notify();
        return { ...challenge, ...updatedData };
    }

    /**
     * Registra el resultado de un encuentro finalizado y actualiza récords PVP.
     */
    async reportMatchResult(challengeId, actorUser, {
        winnerId = null,
        isDraw = false,
        scoreA = 0,
        scoreB = 0,
        songsPlayed = '',
        matchNotes = ''
    }) {
        const challenge = await this.getChallengeById(challengeId);
        if (!challenge) throw new Error("Reto no encontrado.");

        const nowIso = new Date().toISOString();
        const pA = challenge.challenger;
        const pB = challenge.opponent;

        let winnerName = 'Empate';
        let loserId = null;
        let loserName = null;

        if (!isDraw) {
            if (winnerId === pA.id) {
                winnerName = pA.name;
                loserId = pB.id;
                loserName = pB.name;
            } else if (winnerId === pB.id) {
                winnerName = pB.name;
                loserId = pA.id;
                loserName = pA.name;
            }
        }

        const matchResult = {
            winnerId: isDraw ? null : winnerId,
            winnerName,
            loserId,
            loserName,
            isDraw: !!isDraw,
            scoreA: Number(scoreA) || 0,
            scoreB: Number(scoreB) || 0,
            songsPlayed: songsPlayed || '',
            matchNotes: matchNotes || '',
            reportedBy: { id: actorUser.id, name: actorUser.name },
            reportedAt: nowIso
        };

        const rawUpdatedData = {
            status: CHALLENGE_STATUS.COMPLETED,
            matchResult,
            updatedAt: nowIso
        };

        const updatedData = cleanFirestorePayload(rawUpdatedData);

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.CHALLENGES, challengeId), updatedData);
            } catch (err) {
                handleAppError(err, { context: "Error registrando resultado", showToast: true, rethrow: true });
            }
        }

        // Actualizar estadísticas PVP en los perfiles de los dos jugadores
        await this.applyVersusStatsToPlayers({
            playerAId: pA.id,
            playerBId: pB.id,
            winnerId: isDraw ? null : winnerId,
            isDraw
        });

        this.updateLocalChallenge(challengeId, updatedData);
        this.notify();
        return { ...challenge, ...updatedData };
    }

    /**
     * Aplica el recálculo de Victorias/Derrotas a los documentos de los jugadores.
     */
    async applyVersusStatsToPlayers({ playerAId, playerBId, winnerId, isDraw }) {
        const updatePlayerStats = async (playerId, isWinner, isMatchDraw) => {
            if (!playerId) return;
            let playerDoc = null;

            if (isFirebaseAvailable && db) {
                try {
                    const snap = await getDoc(doc(db, COLLECTIONS.PLAYERS, playerId));
                    if (snap.exists()) {
                        playerDoc = snap.data();
                        const stats = playerDoc.versusStats || { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0 };
                        
                        if (isMatchDraw) {
                            stats.draws = (stats.draws || 0) + 1;
                        } else if (isWinner) {
                            stats.wins = (stats.wins || 0) + 1;
                        } else {
                            stats.losses = (stats.losses || 0) + 1;
                        }
                        stats.totalMatches = (stats.wins || 0) + (stats.losses || 0) + (stats.draws || 0);
                        stats.winRate = stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;

                        await updateDoc(doc(db, COLLECTIONS.PLAYERS, playerId), { versusStats: stats });
                    }
                } catch (e) {}
            }

            // Actualizar caché local
            try {
                const cache = JSON.parse(localStorage.getItem('piu_registered_players_cache') || '[]');
                const idx = cache.findIndex(p => p.id === playerId);
                if (idx !== -1) {
                    const stats = cache[idx].versusStats || { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0 };
                    if (isMatchDraw) stats.draws = (stats.draws || 0) + 1;
                    else if (isWinner) stats.wins = (stats.wins || 0) + 1;
                    else stats.losses = (stats.losses || 0) + 1;
                    stats.totalMatches = stats.wins + stats.losses + (stats.draws || 0);
                    stats.winRate = stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;
                    cache[idx].versusStats = stats;
                    localStorage.setItem('piu_registered_players_cache', JSON.stringify(cache));
                }
            } catch (e) {}
        };

        await Promise.all([
            updatePlayerStats(playerAId, winnerId === playerAId, isDraw),
            updatePlayerStats(playerBId, winnerId === playerBId, isDraw)
        ]);
    }

    /**
     * Genera la tabla clasificatoria (Leaderboard) ordenada por Liga Potosina y récord PVP.
     */
    async getLeaderboard({ filterLeague = 'ALL', allPlayers = [] }) {
        let players = [...allPlayers];

        if (players.length === 0) {
            if (isFirebaseAvailable && db) {
                try {
                    const snap = await getDocs(collection(db, COLLECTIONS.PLAYERS));
                    snap.forEach(d => players.push({ id: d.id, ...d.data() }));
                } catch (e) {}
            }
            if (players.length === 0) {
                players = JSON.parse(localStorage.getItem('piu_registered_players_cache') || '[]');
            }
        }

        // Filtro por Liga
        if (filterLeague && filterLeague !== 'ALL') {
            players = players.filter(p => (p.skillLevel || 'Liga C') === filterLeague);
        }

        // Ordenamiento jerárquico: 1° Liga Potosina (SSS -> D), 2° Victorias PVP, 3° Winrate
        players.sort((a, b) => {
            const leagueA = LIGA_ORDER[a.skillLevel || 'Liga C'] || 0;
            const leagueB = LIGA_ORDER[b.skillLevel || 'Liga C'] || 0;
            if (leagueB !== leagueA) return leagueB - leagueA;

            const winsA = a.versusStats?.wins || 0;
            const winsB = b.versusStats?.wins || 0;
            if (winsB !== winsA) return winsB - winsA;

            const wrA = a.versusStats?.winRate || 0;
            const wrB = b.versusStats?.winRate || 0;
            return wrB - wrA;
        });

        return players;
    }

    async getChallengeById(id) {
        if (!id) return null;
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDoc(doc(db, COLLECTIONS.CHALLENGES, id));
                if (snap.exists()) return { id: snap.id, ...snap.data() };
            } catch (e) {}
        }
        return this.getLocalChallenges().find(c => c.id === id) || null;
    }

    getLocalChallenges() {
        try {
            return JSON.parse(localStorage.getItem('piu_challenges_cache_v1') || '[]');
        } catch (e) {
            return [];
        }
    }

    saveLocalChallenges(list) {
        try {
            localStorage.setItem('piu_challenges_cache_v1', JSON.stringify(list));
        } catch (e) {}
    }

    updateLocalChallenge(id, partialData) {
        const list = this.getLocalChallenges();
        const idx = list.findIndex(c => c.id === id);
        if (idx !== -1) {
            list[idx] = { ...list[idx], ...partialData };
            this.saveLocalChallenges(list);
        }
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(cb => cb());
    }
}

export const challengeManager = new ChallengeManager();
