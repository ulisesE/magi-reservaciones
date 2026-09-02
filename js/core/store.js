// js/core/store.js
// Almacén reactivo de datos (Máquinas, Reservaciones, Configuración) con sincronización Firebase y fallback LocalStorage
import { 
    db, 
    auth,
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    setDoc, 
    doc, 
    getDoc,
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    runTransaction,
    query, 
    where,
    limit 
} from '../firebaseConfig.js';
import { tenantManager } from './tenantManager.js';
import { authManager } from './authManager.js';
import { formatDateKey, isOverlapping, getBusinessHoursForDate, calculateBookingCost } from './timeUtils.js';
import { loyaltyManager } from './loyaltyManager.js';
import { auditLogger, AUDIT_ACTIONS } from './auditLogger.js';
import { handleAppError, assertFinancialOnline } from './errorHandler.js';

function findReservationConflict(reservations, machineId, date, startTime, endTime, excludeReservationId = null) {
    const business = tenantManager.getActiveBusiness();
    const { openingTime, closingTime } = getBusinessHoursForDate(business, date);
    return reservations.find(res =>
        res.id !== excludeReservationId
        && res.machineId === machineId
        && res.date === date
        && res.status !== 'REJECTED'
        && res.status !== 'CANCELLED'
        && isOverlapping(startTime, endTime, res.startTime, res.endTime, openingTime, closingTime)
    );
}

// Modelos y datos de prueba predeterminados de Pump It Up
const DEFAULT_MACHINES_BY_BIZ = {
    'biz_piu_centro': [
        {
            id: 'mach_lx_phoenix_01',
            businessId: 'biz_piu_centro',
            name: 'PIU Phoenix LX #1 (Pro Stage)',
            model: 'LX 55" LED Cabinet',
            version: 'Phoenix 2024 (v1.08)',
            status: 'AVAILABLE',
            padsCondition: 'Sensores FSR calibrados a 4.5/5. Bares reforzados.',
            hourlyRate: 120,
            hourlyRate2P: 195,
            imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
            features: ['55" 120Hz Display', 'Sound Subwoofer 2.1', 'AM.PASS Card Reader', 'Barra Pro'],
            createdAt: new Date().toISOString()
        },
        {
            id: 'mach_tx_xx_02',
            businessId: 'biz_piu_centro',
            name: 'PIU XX 20th Anniv. TX #2',
            model: 'TX 50" HD Cabinet',
            version: 'XX 20th Anniversary (v2.08)',
            status: 'AVAILABLE',
            padsCondition: 'Sensibilidad media-alta, pads originales Andamiro.',
            hourlyRate: 100,
            hourlyRate2P: 160,
            imageUrl: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=600&q=80',
            features: ['50" HD Screen', 'Iluminación Neón LED', 'AM.PASS Compatible'],
            createdAt: new Date().toISOString()
        },
        {
            id: 'mach_fx_prime_03',
            businessId: 'biz_piu_centro',
            name: 'PIU Prime 2 FX #3',
            model: 'FX 42" Cabinet',
            version: 'Prime 2 (v2.05)',
            status: 'AVAILABLE',
            padsCondition: 'Ideal para principiantes y freestyle.',
            hourlyRate: 80,
            hourlyRate2P: 130,
            imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
            features: ['42" Screen', 'Clásico Sound System', 'Pads Suaves'],
            createdAt: new Date().toISOString()
        }
    ],
    'biz_arcade_galaxy': [
        {
            id: 'mach_gal_lx_01',
            businessId: 'biz_arcade_galaxy',
            name: 'PIU Phoenix Premium LX',
            model: 'LX 55" White Special',
            version: 'Phoenix 2024',
            status: 'AVAILABLE',
            padsCondition: 'Pads FSR de competición ultra-sensibles.',
            hourlyRate: 130,
            hourlyRate2P: 210,
            imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
            features: ['55" 4K', 'Camara Stream integrada', 'AM.PASS'],
            createdAt: new Date().toISOString()
        },
        {
            id: 'mach_gal_xx_02',
            businessId: 'biz_arcade_galaxy',
            name: 'PIU XX TX Galaxy',
            model: 'TX 50" Black Edition',
            version: 'XX 20th Anniversary',
            status: 'MAINTENANCE',
            padsCondition: 'Calibración de sensor flecha azul superior izquierda en progreso.',
            hourlyRate: 95,
            hourlyRate2P: 150,
            imageUrl: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=600&q=80',
            features: ['50" HD', 'Subwoofer High-Power'],
            createdAt: new Date().toISOString()
        }
    ]
};

function createDemoReservations(businessId) {
    const today = new Date();
    const todayKey = formatDateKey(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = formatDateKey(tomorrow);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterKey = formatDateKey(dayAfter);

    if (businessId === 'biz_piu_centro') {
        return [
            {
                id: 'res_demo_01',
                businessId: 'biz_piu_centro',
                machineId: 'mach_lx_phoenix_01',
                clientName: 'Alex "StepMaster"',
                clientPhone: '5511223344',
                date: todayKey,
                startTime: '14:00',
                endTime: '16:00',
                durationMinutes: 120,
                status: 'CONFIRMED',
                totalCost: 240,
                notes: 'Práctica para torneo nacional Single D24.',
                adminNotes: 'Aprobado por Encargado Centro.',
                createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
            },
            {
                id: 'res_demo_02',
                businessId: 'biz_piu_centro',
                machineId: 'mach_tx_xx_02',
                clientName: 'Valeria G.',
                clientPhone: '5599887766',
                date: todayKey,
                startTime: '17:00',
                endTime: '18:00',
                durationMinutes: 60,
                status: 'PENDING',
                totalCost: 100,
                notes: 'Solicitud web: Modo Co-Op con amigos.',
                createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
            },
            {
                id: 'res_demo_03',
                businessId: 'biz_piu_centro',
                machineId: 'mach_lx_phoenix_01',
                clientName: 'Rodrigo PIU',
                clientPhone: '5544332211',
                date: todayKey,
                startTime: '19:00',
                endTime: '20:00',
                durationMinutes: 60,
                status: 'CONFIRMED',
                totalCost: 120,
                notes: 'Sesión de Stream / AM.PASS.',
                createdAt: new Date(Date.now() - 3600000 * 10).toISOString()
            },
            {
                id: 'res_demo_04',
                businessId: 'biz_piu_centro',
                machineId: 'mach_fx_prime_03',
                clientName: 'Daniel & Sofía',
                clientPhone: '5577665544',
                date: tomorrowKey,
                startTime: '15:00',
                endTime: '17:00',
                durationMinutes: 120,
                status: 'CONFIRMED',
                totalCost: 160,
                notes: 'Clase de iniciación básica.',
                createdAt: new Date().toISOString()
            },
            {
                id: 'res_demo_05',
                businessId: 'biz_piu_centro',
                machineId: 'mach_lx_phoenix_01',
                clientName: 'K-Pump Crew',
                clientPhone: '5533221100',
                date: dayAfterKey,
                startTime: '18:00',
                endTime: '21:00',
                durationMinutes: 180,
                status: 'PENDING',
                totalCost: 360,
                notes: 'Reserva para equipo de 4 personas.',
                createdAt: new Date().toISOString()
            }
        ];
    }

    return [
        {
            id: 'res_gal_01',
            businessId: 'biz_arcade_galaxy',
            machineId: 'mach_gal_lx_01',
            clientName: 'Carlos Speed',
            clientPhone: '8111223344',
            date: todayKey,
            startTime: '16:00',
            endTime: '18:00',
            durationMinutes: 120,
            status: 'CONFIRMED',
            totalCost: 260,
            notes: 'Entrenamiento Doubles.',
            createdAt: new Date().toISOString()
        }
    ];
}

class Store {
    constructor() {
        this.machines = [];
        this.reservations = [];
        this.pendingReservations = [];
        this.currentBusiness = null;
        this.userRole = 'CLIENT'; // 'CLIENT', 'MANAGER', 'SUPERADMIN'
        this.selectedDate = formatDateKey(new Date());
        this.currentView = 'DAY'; // 'DAY', 'WEEK', 'MONTH', 'MACHINES', 'REQUESTS', 'BUSINESS', 'SUPERADMIN'
        this.listeners = [];
        this.processedReservationKeys = new Set();
        this.unsubscribeReservations = null;
        this.unsubscribePendingReservations = null;
        this.unsubscribeMachines = null;
    }

    async init() {
        // Escuchar cambios de autenticación
        authManager.subscribe(async (user, role) => {
            this.userRole = role;
            if (role === 'SUPERADMIN' && this.currentView === 'REQUESTS') {
                this.currentView = 'SUPERADMIN';
            }
            this.notify();
        });

        this.userRole = authManager.getRole();

        // Escuchar cambios de negocio activo
        tenantManager.subscribe(async (business) => {
            this.currentBusiness = business;
            await this.loadBusinessData();
            this.notify();
        });

        this.currentBusiness = tenantManager.getActiveBusiness();
        await this.loadBusinessData();
    }

    async loadBusinessData() {
        if (!this.currentBusiness) return;
        const bizId = this.currentBusiness.id;

        this.unsubscribeReservations?.();
        this.unsubscribePendingReservations?.();
        this.unsubscribeMachines?.();
        this.unsubscribeReservations = null;
        this.unsubscribePendingReservations = null;
        this.unsubscribeMachines = null;

        let loadedMachines = [];
        let loadedReservations = [];
        let loadedFromFirestore = false;

        if (isFirebaseAvailable && db) {
            try {
                const machQuery = query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", bizId));
                const machSnap = await getDocs(machQuery);
                machSnap.forEach(d => loadedMachines.push({ id: d.id, ...d.data() }));

                // Inicialmente cargamos las reservas de la fecha seleccionada/hoy usando la zona horaria local
                const todayStr = this.selectedDate || formatDateKey(new Date());
                this.currentSubscriptionRange = { start: todayStr, end: todayStr };

                const resQuery = query(
                    collection(db, COLLECTIONS.RESERVATIONS),
                    where("businessId", "==", bizId),
                    where("date", "==", todayStr)
                );
                const resSnap = await getDocs(resQuery);
                resSnap.forEach(d => loadedReservations.push({ id: d.id, ...d.data() }));
                loadedFromFirestore = true;

                this.unsubscribeMachines = onSnapshot(machQuery, (snapshot) => {
                    this.machines = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                    this.saveLocalMachines(bizId, this.machines);
                    this.notify();
                }, (error) => console.warn('Error de sincronización de máquinas:', error));

                this.unsubscribeReservations = onSnapshot(resQuery, (snapshot) => {
                    const realtimeRes = [];
                    snapshot.forEach(docSnap => {
                        realtimeRes.push({ id: docSnap.id, ...docSnap.data() });
                    });
                    this.reservations = realtimeRes;
                    this.saveLocalReservations(bizId, realtimeRes);
                    this.notify();
                }, (error) => console.warn('Error de sincronización de reservas:', error));

                // Suscripción permanente en tiempo real para solicitudes PENDING de este local
                const pendingQuery = query(
                    collection(db, COLLECTIONS.RESERVATIONS),
                    where("businessId", "==", bizId),
                    where("status", "==", "PENDING")
                );
                this.unsubscribePendingReservations = onSnapshot(pendingQuery, (snapshot) => {
                    const pendingList = [];
                    snapshot.forEach(docSnap => {
                        pendingList.push({ id: docSnap.id, ...docSnap.data() });
                    });
                    this.pendingReservations = pendingList;
                    this.notify();
                }, (error) => console.warn('Error de sincronización de pendientes en tiempo real:', error));
            } catch (err) {
                console.warn("Error Firebase:", err);
            }
        }

        if (!loadedFromFirestore && loadedMachines.length === 0) {
            const localMach = localStorage.getItem(`piu_machines_${bizId}`);
            if (localMach) {
                try { loadedMachines = JSON.parse(localMach); } catch (e) { loadedMachines = []; }
            }
        }

        if (!loadedFromFirestore && loadedReservations.length === 0) {
            const localRes = localStorage.getItem(`piu_reservations_${bizId}`);
            if (localRes) {
                try { loadedReservations = JSON.parse(localRes); } catch (e) { loadedReservations = []; }
            }
        }

        if (!loadedFromFirestore && loadedMachines.length === 0) {
            loadedMachines = DEFAULT_MACHINES_BY_BIZ[bizId] || [
                {
                    id: `mach_${bizId}_01`,
                    businessId: bizId,
                    name: 'PIU Phoenix Pro Cab',
                    model: 'LX 55" Pro',
                    version: 'Phoenix 2024',
                    status: 'AVAILABLE',
                    padsCondition: 'Calibrado y listo.',
                    hourlyRate: 100,
                    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
                    features: ['55" Display', 'AM.PASS'],
                    createdAt: new Date().toISOString()
                }
            ];
            this.saveLocalMachines(bizId, loadedMachines);
        }

        if (!loadedFromFirestore && loadedReservations.length === 0) {
            loadedReservations = createDemoReservations(bizId);
            this.saveLocalReservations(bizId, loadedReservations);
        }

        this.machines = loadedMachines;
        this.reservations = loadedReservations;
    }

    saveLocalMachines(bizId, machines) {
        localStorage.setItem(`piu_machines_${bizId}`, JSON.stringify(machines));
    }

    saveLocalReservations(bizId, reservations) {
        localStorage.setItem(`piu_reservations_${bizId}`, JSON.stringify(reservations));
    }

    updateReservationsSubscription(startDateStr, endDateStr) {
        if (!isFirebaseAvailable || !db || !this.currentBusiness) return;
        if (this.currentSubscriptionRange?.start === startDateStr && this.currentSubscriptionRange?.end === endDateStr) {
            return; // Rango sin cambios
        }
        
        this.currentSubscriptionRange = { start: startDateStr, end: endDateStr };
        const bizId = this.currentBusiness.id;
        
        this.unsubscribeReservations?.();
        this.unsubscribeReservations = null;

        let q;
        if (startDateStr === endDateStr) {
            q = query(
                collection(db, COLLECTIONS.RESERVATIONS), 
                where("businessId", "==", bizId),
                where("date", "==", startDateStr)
            );
        } else {
            // Rango de fechas: filtramos por local e intervalo de fechas en Firestore
            q = query(
                collection(db, COLLECTIONS.RESERVATIONS), 
                where("businessId", "==", bizId),
                where("date", ">=", startDateStr),
                where("date", "<=", endDateStr)
            );
        }

        this.unsubscribeReservations = onSnapshot(q, (snapshot) => {
            const realtimeRes = [];
            snapshot.forEach(docSnap => {
                realtimeRes.push({ id: docSnap.id, ...docSnap.data() });
            });
            this.reservations = realtimeRes;
            this.saveLocalReservations(bizId, realtimeRes);
            this.notify();
        }, (error) => console.warn('Error de sincronización de reservas por rango:', error));
    }

    async loadReservationsForTray() {
        if (!this.currentBusiness) return [];
        const bizId = this.currentBusiness.id;
        
        let loaded = [];
        if (isFirebaseAvailable && db) {
            try {
                // Cargar hasta 250 reservaciones del local sin ordenar en firestore para evitar requerir índices compuestos
                const q = query(
                    collection(db, COLLECTIONS.RESERVATIONS),
                    where("businessId", "==", bizId),
                    limit(250)
                );
                const snap = await getDocs(q);
                snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
            } catch (err) {
                console.warn("Error cargando bandeja de reservas de Firestore, usando local:", err);
            }
        }

        // Fusionar con reservaciones en memoria local
        if (this.reservations && this.reservations.length > 0) {
            this.reservations.forEach(r => {
                if (r.businessId === bizId && !loaded.some(item => item.id === r.id)) {
                    loaded.push(r);
                }
            });
        }
        
        // Fusionar con caché de LocalStorage
        try {
            const localData = localStorage.getItem(`piu_reservations_${bizId}`);
            if (localData) {
                const parsed = JSON.parse(localData);
                parsed.forEach(r => {
                    if (!loaded.some(item => item.id === r.id)) {
                        loaded.push(r);
                    }
                });
            }
        } catch (e) {
            console.warn("Error fusionando localStorage en bandeja:", e);
        }

        // Asegurar que las pendientes del listener en tiempo real estén incluidas
        if (this.pendingReservations && this.pendingReservations.length > 0) {
            this.pendingReservations.forEach(p => {
                const existingIdx = loaded.findIndex(item => item.id === p.id);
                if (existingIdx !== -1) {
                    loaded[existingIdx] = p;
                } else {
                    loaded.push(p);
                }
            });
        }

        loaded.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
        return loaded;
    }

    async syncMachinesToFirebase(machines) {
        if (!isFirebaseAvailable || !db) return;
        for (const m of machines) {
            try { 
                await setDoc(doc(db, COLLECTIONS.MACHINES, m.id), m); 
            } catch (e) {
                handleAppError(e, {
                    context: `Error sincronizando máquina ${m.id}`,
                    showToast: true
                });
            }
        }
    }

    async syncReservationsToFirebase(reservations) {
        if (!isFirebaseAvailable || !db) return;
        for (const r of reservations) {
            try { 
                await setDoc(doc(db, COLLECTIONS.RESERVATIONS, r.id), r); 
            } catch (e) {
                handleAppError(e, {
                    context: `Error sincronizando reservación ${r.id}`,
                    showToast: true
                });
            }
        }
    }

    getMachines() {
        return this.machines
            .filter(m => m.status !== 'DELETED' && !m.isDeleted)
            .map(m => {
                if (m.hourlyRate2P === undefined || m.hourlyRate2P === null) {
                    m.hourlyRate2P = m.hourlyRate === 80 ? 130 : Math.round(m.hourlyRate * 1.625);
                }
                return m;
            });
    }

    getActiveMachines() {
        return this.getMachines().filter(m => m.status === 'AVAILABLE');
    }

    getMachineById(id) {
        const m = this.machines.find(m => m.id === id && m.status !== 'DELETED' && !m.isDeleted);
        if (m && (m.hourlyRate2P === undefined || m.hourlyRate2P === null)) {
            m.hourlyRate2P = m.hourlyRate === 80 ? 130 : Math.round(m.hourlyRate * 1.625);
        }
        return m;
    }

    getReservations(filter = {}) {
        const all = [...this.reservations];
        if (this.pendingReservations && this.pendingReservations.length > 0) {
            this.pendingReservations.forEach(p => {
                if (!all.some(r => r.id === p.id)) all.push(p);
            });
        }
        let result = all;
        if (filter.date) result = result.filter(r => r.date === filter.date);
        if (filter.machineId) result = result.filter(r => r.machineId === filter.machineId);
        if (filter.status) result = result.filter(r => r.status === filter.status);
        if (filter.excludeRejectedCancelled) {
            result = result.filter(r => r.status !== 'REJECTED' && r.status !== 'CANCELLED');
        }
        return result;
    }

    getPendingRequests() {
        if (this.pendingReservations && this.pendingReservations.length > 0) {
            return [...this.pendingReservations].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
        }
        return this.reservations.filter(r => r.status === 'PENDING')
            .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    }

    getPendingRequestsCount() {
        if (this.pendingReservations) {
            return this.pendingReservations.length;
        }
        return this.reservations.filter(r => r.status === 'PENDING').length;
    }

    checkAvailability(machineId, date, startTime, endTime, excludeReservationId = null) {
        const machine = this.getMachineById(machineId);
        if (!machine || machine.status === 'OUT_OF_ORDER') {
            return { available: false, reason: 'La máquina se encuentra fuera de servicio.' };
        }

        const { openingTime, closingTime, closed } = getBusinessHoursForDate(this.currentBusiness, date);
        if (closed) {
            return { available: false, reason: 'La sucursal se encuentra cerrada este día.' };
        }

        const existing = this.getReservations({ date, machineId, excludeRejectedCancelled: true });

        for (const res of existing) {
            if (excludeReservationId && res.id === excludeReservationId) continue;
            if (isOverlapping(startTime, endTime, res.startTime, res.endTime, openingTime, closingTime)) {
                return {
                    available: false,
                    reason: `Conflicto con la reservación de ${res.clientName} (${res.startTime} - ${res.endTime})`,
                    conflictingReservation: res
                };
            }
        }
        return { available: true };
    }

    getMonthReservationsCount(year, month) {
        const counts = {};
        this.reservations.forEach(r => {
            if (r.status === 'REJECTED' || r.status === 'CANCELLED') return;
            const [y, m, d] = r.date.split('-').map(Number);
            if (y === year && m === (month + 1)) {
                counts[r.date] = (counts[r.date] || 0) + 1;
            }
        });
        return counts;
    }

    async requestReservation(bookingData) {
        if (!isFirebaseAvailable || !db) {
            const availability = this.checkAvailability(
                bookingData.machineId,
                bookingData.date,
                bookingData.startTime,
                bookingData.endTime
            );
            if (!availability.available) throw new Error(availability.reason);
        }

        const machine = this.getMachineById(bookingData.machineId);
        const playersMode = bookingData.playersMode || 1;
        const totalCost = calculateBookingCost(bookingData.durationMinutes || 60, playersMode, machine, this.currentBusiness);
        const isStaff = this.userRole === 'MANAGER' || this.userRole === 'SUPERADMIN';

        const isClient = authManager.isClientUser();
        const activeUser = authManager.getCurrentUser();

        let resolvedClientId = bookingData.clientId || null;
        let resolvedClientUsername = bookingData.clientUsername || null;

        if (isClient && activeUser) {
            resolvedClientId = activeUser.id;
            resolvedClientUsername = activeUser.username;
        } else if (!resolvedClientId) {
            const searchKey = (bookingData.clientUsername || bookingData.clientName || '').trim().toLowerCase();
            const searchPhone = (bookingData.clientPhone || '').replace(/\D/g, '');
            let allPlayers = authManager.getClientUsers ? (authManager.getClientUsers() || []) : [];
            if (allPlayers.length === 0) {
                try {
                    const localCache = localStorage.getItem('piu_registered_players_cache');
                    if (localCache) allPlayers = JSON.parse(localCache);
                } catch(e) {}
            }
            const matchedPlayer = allPlayers.find(p => 
                (p.username && (p.username.toLowerCase() === searchKey || (bookingData.clientUsername && p.username.toLowerCase() === bookingData.clientUsername.toLowerCase()))) ||
                (p.name && p.name.toLowerCase() === searchKey) ||
                (searchPhone && p.phone && p.phone.replace(/\D/g, '') === searchPhone) ||
                (p.id && p.id.toLowerCase() === searchKey)
            );
            if (matchedPlayer) {
                resolvedClientId = matchedPlayer.id;
                resolvedClientUsername = matchedPlayer.username;
            }
        }

        // IDEMPOTENCIA DETERMINISTA: Si el cliente no provee idempotencyKey, derivarla exclusivamente
        // de los atributos semánticos de la reserva (local, máquina, fecha, hora inicio, jugador). CERO Date.now()
        const canonicalClientKey = resolvedClientId || (bookingData.clientName || 'anon').trim().toLowerCase().replace(/\s+/g, '_');
        const finalIdempotencyKey = bookingData.idempotencyKey || ('bk_' + (this.currentBusiness?.id || 'biz') + '_' + (bookingData.machineId || 'm') + '_' + (bookingData.date || '').replace(/-/g, '') + '_' + (bookingData.startTime || '').replace(/:/g, '') + '_' + canonicalClientKey);
        
        if (this.processedReservationKeys.has(finalIdempotencyKey)) {
            throw new Error("Esta reservación ya está siendo procesada. Evitando duplicidad.");
        }
        this.processedReservationKeys.add(finalIdempotencyKey);
        setTimeout(() => this.processedReservationKeys.delete(finalIdempotencyKey), 10000);

        const newReservationId = bookingData.id || ('res_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
        const nowIso = new Date().toISOString();

        const newReservation = {
            id: newReservationId,
            idempotencyKey: finalIdempotencyKey,
            businessId: this.currentBusiness.id,
            machineId: bookingData.machineId,
            clientId: resolvedClientId,
            clientUsername: resolvedClientUsername,
            clientName: bookingData.clientName.trim(),
            clientPhone: bookingData.clientPhone ? bookingData.clientPhone.trim() : '',
            clientEmail: bookingData.clientEmail ? bookingData.clientEmail.trim() : '',
            date: bookingData.date,
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            durationMinutes: bookingData.durationMinutes || 60,
            playersMode: playersMode,
            status: isStaff ? 'CONFIRMED' : 'PENDING',
            totalCost: totalCost,
            notes: bookingData.notes ? bookingData.notes.trim() : '',
            adminNotes: isStaff ? 'Asignada directamente por Encargado' : '',
            createdAt: nowIso
        };

        let resultingReservation = newReservation;

        if (newReservation.status === 'CONFIRMED' || newReservation.totalCost > 0) {
            assertFinancialOnline();
        }

        // 1. TRANSACCIÓN ATÓMICA CON BLOQUEO CONCURRENTE DE SLOTS E IDEMPOTENCIA EN FIRESTORE
        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    // 1. TODAS LAS LECTURAS (READS) PRIMERO
                    const resRef = doc(db, COLLECTIONS.RESERVATIONS, newReservation.id);
                    const existingRes = await transaction.get(resRef);
                    if (existingRes.exists()) {
                        const existingData = existingRes.data();
                        if (existingData.status !== 'CANCELLED' && existingData.status !== 'REJECTED') {
                            console.warn(`[IDEMPOTENCY] Reservación ${newReservation.id} ya existe activa. Retornando registro original.`);
                            resultingReservation = { id: existingRes.id, ...existingData };
                            return;
                        }
                    }

                    const machineRef = doc(db, COLLECTIONS.MACHINES, newReservation.machineId);
                    const machineDoc = await transaction.get(machineRef);

                    const businessRef = doc(db, COLLECTIONS.BUSINESSES, newReservation.businessId);
                    const businessDoc = await transaction.get(businessRef);

                    const scheduleKey = `${newReservation.businessId}_${newReservation.machineId}_${newReservation.date}`;
                    const scheduleRef = doc(db, COLLECTIONS.MACHINE_SCHEDULES, scheduleKey);
                    const scheduleDoc = await transaction.get(scheduleRef);

                    let playerRef = null;
                    let playerDoc = null;
                    if (newReservation.clientId) {
                        playerRef = doc(db, COLLECTIONS.PLAYERS, newReservation.clientId);
                        playerDoc = await transaction.get(playerRef);
                    }

                    // 2. VALIDACIONES Y CÁLCULOS
                    const verifiedMachine = machineDoc.exists() ? machineDoc.data() : this.getMachineById(newReservation.machineId);
                    const verifiedBusiness = businessDoc.exists() ? businessDoc.data() : (this.currentBusiness || {});

                    const verifiedTotalCost = calculateBookingCost(
                        newReservation.durationMinutes,
                        newReservation.playersMode,
                        verifiedMachine,
                        verifiedBusiness
                    );
                    newReservation.totalCost = verifiedTotalCost;

                    const currentSlots = scheduleDoc.exists() ? (scheduleDoc.data().slots || []) : [];
                    const { openingTime, closingTime } = getBusinessHoursForDate(verifiedBusiness, newReservation.date);

                    const overlappingSlot = currentSlots.find(slot => 
                        slot.resId !== newReservation.id &&
                        slot.status !== 'REJECTED' &&
                        slot.status !== 'CANCELLED' &&
                        isOverlapping(newReservation.startTime, newReservation.endTime, slot.startTime, slot.endTime, openingTime, closingTime)
                    );

                    if (overlappingSlot) {
                        throw new Error(`Conflicto de horario: La máquina ya fue reservada por ${overlappingSlot.clientName || 'otro usuario'} (${overlappingSlot.startTime} - ${overlappingSlot.endTime})`);
                    }

                    // 3. TODAS LAS ESCRITURAS (WRITES)
                    if (isStaff || newReservation.status === 'CONFIRMED') {
                        const updatedSlots = currentSlots.filter(s => s.resId !== newReservation.id);
                        updatedSlots.push({
                            resId: newReservation.id,
                            startTime: newReservation.startTime,
                            endTime: newReservation.endTime,
                            status: 'CONFIRMED',
                            clientName: newReservation.clientName,
                            clientId: newReservation.clientId,
                            updatedAt: nowIso
                        });

                        transaction.set(scheduleRef, {
                            businessId: newReservation.businessId,
                            machineId: newReservation.machineId,
                            date: newReservation.date,
                            slots: updatedSlots,
                            updatedAt: nowIso
                        }, { merge: true });
                    }

                    // A. Escribir documento de reservación
                    transaction.set(resRef, newReservation);

                    // B. Acreditar puntos si es confirmada
                    if (newReservation.status === 'CONFIRMED' && playerDoc && playerDoc.exists() && playerRef && verifiedBusiness?.loyaltyEnabled) {
                        const playerData = playerDoc.data();
                        const loyaltyMap = playerData.loyalty || {};
                        const bizLoyalty = loyaltyMap[this.currentBusiness.id] || { points: 0, visits: 0, tier: 'Bronce' };
                        const isVisitsMode = verifiedBusiness.loyaltyMode === 'VISITS';
                        const pts = isVisitsMode ? 1 : Math.floor(newReservation.totalCost / (Number(verifiedBusiness.pointsRatio) || 10));
                        if (pts > 0 || isVisitsMode) {
                            const nextPoints = (bizLoyalty.points || 0) + (isVisitsMode ? 0 : pts);
                            const nextVisits = (bizLoyalty.visits || 0) + (isVisitsMode ? pts : 1);
                            const valForTier = isVisitsMode ? nextVisits : nextPoints;
                            const nextTier = loyaltyManager.calculateTier(valForTier, verifiedBusiness.loyaltyMode || 'POINTS').name;
                            loyaltyMap[this.currentBusiness.id] = { ...bizLoyalty, points: nextPoints, visits: nextVisits, tier: nextTier };
                            transaction.update(playerRef, { loyalty: loyaltyMap, updatedAt: nowIso });
                        }
                    }

                    // C. Auditoría inmutable dentro de la misma transacción atómica (si fue creada por Staff autenticado)
                    if (isStaff && auth && auth.currentUser) {
                        auditLogger.appendTransactionAudit(transaction, {
                            businessId: this.currentBusiness.id,
                            action: newReservation.status === 'CONFIRMED' ? AUDIT_ACTIONS.RESERVATION_CLOSED : AUDIT_ACTIONS.RESERVATION_CREATED,
                            target: { type: 'RESERVATION', id: newReservation.id, name: newReservation.clientName },
                            financialData: { amount: newReservation.totalCost },
                            details: `Reservación creada (${newReservation.status}) para ${newReservation.clientName} en fecha ${newReservation.date} (${newReservation.startTime} - ${newReservation.endTime}). Total: $${newReservation.totalCost}`
                        });
                    }
                });
            } catch (err) {
                handleAppError(err, { context: "Error en creación atómica de reservación", showToast: true, rethrow: true });
            }
        }

        if (!this.reservations.some(r => r.id === resultingReservation.id)) {
            this.reservations.push(resultingReservation);
            this.saveLocalReservations(this.currentBusiness.id, this.reservations);
        }

        this.notify();
        return resultingReservation;
    }

    async getOrFetchReservation(reservationId) {
        // 1. Buscar en memoria local
        let res = this.reservations.find(r => r.id === reservationId);
        if (res) return res;

        // 2. Buscar en Firestore si está disponible
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDoc(doc(db, COLLECTIONS.RESERVATIONS, reservationId));
                if (snap.exists()) {
                    return { id: snap.id, ...snap.data() };
                }
            } catch (e) {
                console.warn("Error buscando reservación en Firestore:", e);
            }
        }

        // 3. Fallback a LocalStorage
        if (this.currentBusiness?.id) {
            try {
                const localRes = localStorage.getItem(`piu_reservations_${this.currentBusiness.id}`);
                if (localRes) {
                    const parsed = JSON.parse(localRes);
                    const found = parsed.find(r => r.id === reservationId);
                    if (found) return found;
                }
            } catch (e) {
                console.warn("Error leyendo reservaciones locales:", e);
            }
        }

        return null;
    }

    async cancelReservationByClient(reservationId) {
        assertFinancialOnline();
        const res = await this.getOrFetchReservation(reservationId);
        if (!res) throw new Error("Reservación no encontrada");

        const nowIso = new Date().toISOString();
        res.status = 'CANCELLED';
        res.adminNotes = 'Cancelada por el jugador.';
        res.updatedAt = nowIso;

        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    // 1. Lecturas iniciales (READS)
                    const resRef = doc(db, COLLECTIONS.RESERVATIONS, reservationId);
                    const resDoc = await transaction.get(resRef);
                    if (!resDoc.exists()) throw new Error("Reservación no encontrada en Firestore.");

                    const resData = resDoc.data();
                    if (resData.status === 'CANCELLED') {
                        console.warn(`[IDEMPOTENCY] Reservación ${reservationId} ya estaba CANCELLED.`);
                        return;
                    }

                    const wasConfirmed = resData.status === 'CONFIRMED';
                    const scheduleKey = `${resData.businessId}_${resData.machineId}_${resData.date}`;
                    const scheduleRef = doc(db, COLLECTIONS.MACHINE_SCHEDULES, scheduleKey);
                    const scheduleDoc = await transaction.get(scheduleRef);

                    let playerRef = null;
                    let playerDoc = null;
                    if (wasConfirmed && resData.clientId && this.currentBusiness?.loyaltyEnabled) {
                        playerRef = doc(db, COLLECTIONS.PLAYERS, resData.clientId);
                        playerDoc = await transaction.get(playerRef);
                    }

                    // 2. Escrituras (WRITES)
                    if (scheduleDoc.exists()) {
                        const slots = (scheduleDoc.data().slots || []).map(s => 
                            s.resId === reservationId ? { ...s, status: 'CANCELLED', updatedAt: nowIso } : s
                        );
                        transaction.set(scheduleRef, { slots, updatedAt: nowIso }, { merge: true });
                    }

                    transaction.update(resRef, {
                        status: 'CANCELLED',
                        adminNotes: res.adminNotes,
                        updatedAt: nowIso
                    });

                    // Revertir puntos de lealtad si estaba confirmada
                    if (playerDoc && playerDoc.exists() && playerRef) {
                        const playerData = playerDoc.data();
                        const loyaltyMap = playerData.loyalty || {};
                        const bizLoyalty = loyaltyMap[this.currentBusiness.id] || { points: 0, visits: 0, tier: 'Bronce' };
                        const isVisitsMode = this.currentBusiness.loyaltyMode === 'VISITS';
                        const pts = isVisitsMode ? 1 : Math.floor((resData.totalCost || 0) / (Number(this.currentBusiness.pointsRatio) || 10));

                        const nextPoints = Math.max(0, (bizLoyalty.points || 0) - (isVisitsMode ? 0 : pts));
                        const nextVisits = Math.max(0, (bizLoyalty.visits || 0) - (isVisitsMode ? pts : 1));
                        const valForTier = isVisitsMode ? nextVisits : nextPoints;
                        const nextTier = loyaltyManager.calculateTier(valForTier, this.currentBusiness.loyaltyMode || 'POINTS').name;

                        loyaltyMap[this.currentBusiness.id] = { ...bizLoyalty, points: nextPoints, visits: nextVisits, tier: nextTier };
                        transaction.update(playerRef, { loyalty: loyaltyMap, updatedAt: nowIso });
                    }

                    // Inyectar auditoría atómica
                    auditLogger.appendTransactionAudit(transaction, {
                        businessId: resData.businessId,
                        action: AUDIT_ACTIONS.RESERVATION_CANCELLED,
                        target: { type: 'RESERVATION', id: reservationId, name: resData.clientName || 'Jugador' },
                        financialData: { amount: resData.totalCost || 0 },
                        details: `Cancelada reservación para ${resData.clientName} en fecha ${resData.date} (${resData.startTime} - ${resData.endTime}). Monto: $${resData.totalCost || 0}`
                    });
                });
            } catch (err) {
                handleAppError(err, { context: "Error cancelando reservación de forma atómica", showToast: true, rethrow: true });
            }
        }

        const inMemory = this.reservations.find(r => r.id === reservationId);
        if (inMemory) {
            inMemory.status = 'CANCELLED';
            inMemory.adminNotes = res.adminNotes;
            inMemory.updatedAt = nowIso;
        }
        if (this.currentBusiness?.id) {
            this.saveLocalReservations(this.currentBusiness.id, this.reservations);
        }

        this.notify();
        return res;
    }

    async approveReservation(reservationId, adminNotes = '') {
        assertFinancialOnline();
        const res = await this.getOrFetchReservation(reservationId);
        if (!res) throw new Error("Reservación no encontrada");

        const nowIso = new Date().toISOString();

        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    // 1. TODAS LAS LECTURAS (READS) ANTES DE CUALQUIER ESCRITURA
                    const resRef = doc(db, COLLECTIONS.RESERVATIONS, reservationId);
                    const resDoc = await transaction.get(resRef);
                    if (!resDoc.exists()) throw new Error("Reservación no encontrada en Firestore.");

                    const resData = resDoc.data();
                    // 🛡️ PREVENCIÓN ANTI-DOBLE APROBACIÓN
                    if (resData.status === 'CONFIRMED') {
                        console.warn(`[IDEMPOTENCY] Reservación ${reservationId} ya está aprobada previamente.`);
                        return;
                    }
                    if (resData.status !== 'PENDING') {
                        throw new Error(`No se puede aprobar una reservación en estado: ${resData.status}`);
                    }

                    // Validar conflicto de slot en calendario transaccional usando datos autoritativos de Firestore
                    const scheduleKey = `${resData.businessId}_${resData.machineId}_${resData.date}`;
                    const scheduleRef = doc(db, COLLECTIONS.MACHINE_SCHEDULES, scheduleKey);
                    const scheduleDoc = await transaction.get(scheduleRef);

                    // Lectura previa del jugador para puntos de lealtad
                    let playerRef = null;
                    let playerDoc = null;
                    if (resData.clientId && this.currentBusiness?.loyaltyEnabled) {
                        playerRef = doc(db, COLLECTIONS.PLAYERS, resData.clientId);
                        playerDoc = await transaction.get(playerRef);
                    }

                    // 2. VALIDACIONES Y CÁLCULOS
                    const currentSlots = scheduleDoc.exists() ? (scheduleDoc.data().slots || []) : [];
                    const business = tenantManager.getActiveBusiness();
                    const { openingTime, closingTime } = getBusinessHoursForDate(business, resData.date);

                    const overlappingSlot = currentSlots.find(slot => 
                        slot.resId !== reservationId &&
                        slot.status === 'CONFIRMED' &&
                        isOverlapping(resData.startTime, resData.endTime, slot.startTime, slot.endTime, openingTime, closingTime)
                    );

                    if (overlappingSlot) {
                        throw new Error(`Conflicto: Ya existe una reservación confirmada de ${overlappingSlot.clientName || 'otro usuario'} (${overlappingSlot.startTime} - ${overlappingSlot.endTime})`);
                    }

                    // Actualizar estado del slot a CONFIRMED
                    const updatedSlots = currentSlots.map(s => 
                        s.resId === reservationId ? { ...s, status: 'CONFIRMED', updatedAt: nowIso } : s
                    );
                    if (!updatedSlots.some(s => s.resId === reservationId)) {
                        updatedSlots.push({
                            resId: reservationId,
                            startTime: resData.startTime,
                            endTime: resData.endTime,
                            status: 'CONFIRMED',
                            clientName: resData.clientName,
                            clientId: resData.clientId,
                            updatedAt: nowIso
                        });
                    }

                    // 3. TODAS LAS ESCRITURAS (WRITES) DESPUÉS DE LAS LECTURAS
                    transaction.set(scheduleRef, { slots: updatedSlots, updatedAt: nowIso }, { merge: true });

                    transaction.update(resRef, {
                        status: 'CONFIRMED',
                        adminNotes: adminNotes || 'Aprobada por el encargado.',
                        updatedAt: nowIso
                    });

                    // Acreditar puntos de lealtad atómicamente solo una vez
                    if (playerDoc && playerDoc.exists() && playerRef) {
                        const playerData = playerDoc.data();
                        const loyaltyMap = playerData.loyalty || {};
                        const bizLoyalty = loyaltyMap[this.currentBusiness.id] || { points: 0, visits: 0, tier: 'Bronce' };
                        const isVisitsMode = this.currentBusiness.loyaltyMode === 'VISITS';
                        const pts = isVisitsMode ? 1 : Math.floor((resData.totalCost || 0) / (Number(this.currentBusiness.pointsRatio) || 10));

                        const nextPoints = (bizLoyalty.points || 0) + (isVisitsMode ? 0 : pts);
                        const nextVisits = (bizLoyalty.visits || 0) + (isVisitsMode ? pts : 1);
                        const valForTier = isVisitsMode ? nextVisits : nextPoints;
                        const nextTier = loyaltyManager.calculateTier(valForTier, this.currentBusiness.loyaltyMode || 'POINTS').name;

                        loyaltyMap[this.currentBusiness.id] = { ...bizLoyalty, points: nextPoints, visits: nextVisits, tier: nextTier };
                        transaction.update(playerRef, { loyalty: loyaltyMap, updatedAt: nowIso });
                    }

                    // Inyectar auditoría atómica
                    auditLogger.appendTransactionAudit(transaction, {
                        businessId: resData.businessId,
                        action: AUDIT_ACTIONS.RESERVATION_CLOSED,
                        target: { type: 'RESERVATION', id: reservationId, name: resData.clientName || 'Jugador' },
                        financialData: { amount: resData.totalCost || 0 },
                        details: `Aprobada reservación de ${resData.clientName} en fecha ${resData.date} (${resData.startTime} - ${resData.endTime}). Monto: $${resData.totalCost || 0}`
                    });
                });
            } catch (err) {
                handleAppError(err, { context: "Error aprobando reservación de forma atómica", showToast: true, rethrow: true });
            }
        }

        res.status = 'CONFIRMED';
        res.adminNotes = adminNotes || 'Aprobada por el encargado.';
        res.updatedAt = nowIso;

        const inMemory = this.reservations.find(r => r.id === reservationId);
        if (inMemory) {
            Object.assign(inMemory, res);
        } else if (res.date === this.selectedDate) {
            this.reservations.push(res);
        }
        if (this.currentBusiness?.id) {
            this.saveLocalReservations(this.currentBusiness.id, this.reservations);
        }

        this.notify();
        return res;
    }

    async rejectReservation(reservationId, reason = '') {
        assertFinancialOnline();
        const res = await this.getOrFetchReservation(reservationId);
        if (!res) throw new Error("Reservación no encontrada");

        const nowIso = new Date().toISOString();

        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    const resRef = doc(db, COLLECTIONS.RESERVATIONS, reservationId);
                    const resDoc = await transaction.get(resRef);
                    if (!resDoc.exists()) throw new Error("Reservación no encontrada en Firestore.");

                    const resData = resDoc.data();
                    // 🛡️ RECHAZO VÁLIDO ÚNICAMENTE DESDE PENDING (CONFIRMED se cancela vía deleteReservation)
                    if (resData.status !== 'PENDING') {
                        throw new Error(`Solo se pueden rechazar reservaciones en estado PENDING. Estado actual: ${resData.status}`);
                    }

                    // Liberar slot en calendario usando datos autoritativos de Firestore exclusivamente
                    const scheduleKey = `${resData.businessId}_${resData.machineId}_${resData.date}`;
                    const scheduleRef = doc(db, COLLECTIONS.MACHINE_SCHEDULES, scheduleKey);
                    const scheduleDoc = await transaction.get(scheduleRef);
                    if (scheduleDoc.exists()) {
                        const slots = (scheduleDoc.data().slots || []).map(s => 
                            s.resId === reservationId ? { ...s, status: 'REJECTED', updatedAt: nowIso } : s
                        );
                        transaction.set(scheduleRef, { slots, updatedAt: nowIso }, { merge: true });
                    }

                    transaction.update(resRef, {
                        status: 'REJECTED',
                        rejectionReason: reason || 'Horario no disponible / Cancelada por encargado.',
                        updatedAt: nowIso
                    });

                    // Inyectar auditoría atómica
                    auditLogger.appendTransactionAudit(transaction, {
                        businessId: resData.businessId,
                        action: AUDIT_ACTIONS.RESERVATION_CANCELLED,
                        target: { type: 'RESERVATION', id: reservationId, name: resData.clientName || 'Jugador' },
                        financialData: { amount: resData.totalCost || 0 },
                        details: `Rechazada reservación de ${resData.clientName} para ${resData.date} (${resData.startTime} - ${resData.endTime}). Motivo: ${reason || 'Horario no disponible'}`
                    });
                });
            } catch (err) {
                handleAppError(err, { context: "Error rechazando reservación en Firestore", showToast: true, rethrow: true });
            }
        }

        res.status = 'REJECTED';
        res.rejectionReason = reason || 'Horario no disponible / Cancelada por encargado.';
        res.updatedAt = nowIso;

        const inMemory = this.reservations.find(r => r.id === reservationId);
        if (inMemory) {
            inMemory.status = 'REJECTED';
            inMemory.rejectionReason = res.rejectionReason;
            inMemory.updatedAt = nowIso;
        }
        if (this.currentBusiness?.id) {
            this.saveLocalReservations(this.currentBusiness.id, this.reservations);
        }

        this.notify();
        return res;
    }

    async modifyReservation(reservationId, updatedFields) {
        assertFinancialOnline();
        const res = await this.getOrFetchReservation(reservationId);
        if (!res) throw new Error("Reservación no encontrada");

        const targetMachine = updatedFields.machineId || res.machineId;
        const targetDate = updatedFields.date || res.date;
        const targetStart = updatedFields.startTime || res.startTime;
        const targetEnd = updatedFields.endTime || res.endTime;
        const targetDuration = updatedFields.durationMinutes || res.durationMinutes || 60;
        const targetPlayersMode = updatedFields.playersMode || res.playersMode || 1;

        const nowIso = new Date().toISOString();

        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    // 1. TODAS LAS LECTURAS (READS) PRIMERO
                    const resRef = doc(db, COLLECTIONS.RESERVATIONS, reservationId);
                    const resDoc = await transaction.get(resRef);
                    if (!resDoc.exists()) throw new Error("Reservación no encontrada.");

                    const resData = resDoc.data();
                    const isStaffUser = authManager.isStaff();

                    if ((resData.status === 'CANCELLED' || resData.status === 'REJECTED') && !isStaffUser) {
                        throw new Error(`Solo un encargado o administrador puede reactivar una reservación en estado: ${resData.status}`);
                    }

                    const machineRef = doc(db, COLLECTIONS.MACHINES, targetMachine);
                    const machineDoc = await transaction.get(machineRef);

                    const businessRef = doc(db, COLLECTIONS.BUSINESSES, resData.businessId);
                    const businessDoc = await transaction.get(businessRef);

                    const oldMachine = resData.machineId;
                    const oldDate = resData.date;
                    let oldScheduleDoc = null;
                    let oldScheduleRef = null;
                    if (oldMachine !== targetMachine || oldDate !== targetDate) {
                        const oldScheduleKey = `${resData.businessId}_${oldMachine}_${oldDate}`;
                        oldScheduleRef = doc(db, COLLECTIONS.MACHINE_SCHEDULES, oldScheduleKey);
                        oldScheduleDoc = await transaction.get(oldScheduleRef);
                    }

                    const targetScheduleKey = `${resData.businessId}_${targetMachine}_${targetDate}`;
                    const targetScheduleRef = doc(db, COLLECTIONS.MACHINE_SCHEDULES, targetScheduleKey);
                    const targetScheduleDoc = await transaction.get(targetScheduleRef);

                    const wasConfirmed = resData.status === 'CONFIRMED';
                    let playerRef = null;
                    let playerDoc = null;
                    if (resData.clientId) {
                        playerRef = doc(db, COLLECTIONS.PLAYERS, resData.clientId);
                        playerDoc = await transaction.get(playerRef);
                    }

                    // 2. VALIDACIONES Y CÁLCULOS
                    let validatedStatus = updatedFields.status || (resData.status === 'CANCELLED' || resData.status === 'REJECTED' ? 'CONFIRMED' : resData.status);
                    if (updatedFields.status && updatedFields.status !== resData.status) {
                        const allowedTransitions = {
                            'PENDING': ['CONFIRMED', 'REJECTED', 'CANCELLED'],
                            'CONFIRMED': ['CANCELLED', 'CONFIRMED'],
                            'REJECTED': isStaffUser ? ['CONFIRMED', 'PENDING'] : [],
                            'CANCELLED': isStaffUser ? ['CONFIRMED', 'PENDING'] : []
                        };
                        const validNext = allowedTransitions[resData.status] || [];
                        if (!validNext.includes(updatedFields.status)) {
                            throw new Error(`Transición de estado no autorizada: de ${resData.status} a ${updatedFields.status}`);
                        }
                        validatedStatus = updatedFields.status;
                    }

                    const oldCostInDb = resData.totalCost || 0;
                    const verifiedMachine = machineDoc.exists() ? machineDoc.data() : this.getMachineById(targetMachine);
                    const verifiedBusiness = businessDoc.exists() ? businessDoc.data() : (this.currentBusiness || {});

                    const verifiedNewTotalCost = calculateBookingCost(
                        targetDuration,
                        targetPlayersMode,
                        verifiedMachine,
                        verifiedBusiness
                    );

                    const isReactivating = (resData.status === 'CANCELLED' || resData.status === 'REJECTED') && (validatedStatus === 'CONFIRMED' || validatedStatus === 'PENDING');

                    const persistedFields = {
                        ...updatedFields,
                        machineId: targetMachine,
                        date: targetDate,
                        startTime: targetStart,
                        endTime: targetEnd,
                        durationMinutes: targetDuration,
                        playersMode: targetPlayersMode,
                        totalCost: verifiedNewTotalCost,
                        status: validatedStatus,
                        cancellationReason: isReactivating ? '' : (updatedFields.cancellationReason ?? resData.cancellationReason ?? ''),
                        cancelledAt: isReactivating ? null : (updatedFields.cancelledAt ?? resData.cancelledAt ?? null),
                        cancelledBy: isReactivating ? null : (updatedFields.cancelledBy ?? resData.cancelledBy ?? null),
                        rejectionReason: isReactivating ? '' : (updatedFields.rejectionReason ?? resData.rejectionReason ?? ''),
                        updatedAt: nowIso
                    };

                    const currentSlots = targetScheduleDoc.exists() ? (targetScheduleDoc.data().slots || []) : [];
                    const { openingTime, closingTime } = getBusinessHoursForDate(verifiedBusiness, targetDate);

                    const overlapping = currentSlots.find(slot => 
                        slot.resId !== reservationId &&
                        slot.status !== 'REJECTED' &&
                        slot.status !== 'CANCELLED' &&
                        isOverlapping(targetStart, targetEnd, slot.startTime, slot.endTime, openingTime, closingTime)
                    );

                    if (overlapping) {
                        throw new Error(`Conflicto de horario en fecha/máquina destino con ${overlapping.clientName || 'otra reserva'} (${overlapping.startTime} - ${overlapping.endTime})`);
                    }

                    // 3. TODAS LAS ESCRITURAS (WRITES)
                    if (oldScheduleRef && oldScheduleDoc && oldScheduleDoc.exists()) {
                        const cleanedOldSlots = (oldScheduleDoc.data().slots || []).filter(s => s.resId !== reservationId);
                        transaction.set(oldScheduleRef, { slots: cleanedOldSlots, updatedAt: nowIso }, { merge: true });
                    }

                    const filteredSlots = currentSlots.filter(s => s.resId !== reservationId);
                    if (validatedStatus !== 'CANCELLED' && validatedStatus !== 'REJECTED') {
                        filteredSlots.push({
                            resId: reservationId,
                            startTime: targetStart,
                            endTime: targetEnd,
                            status: validatedStatus,
                            clientName: persistedFields.clientName || resData.clientName,
                            clientId: persistedFields.clientId !== undefined ? persistedFields.clientId : (resData.clientId || null),
                            updatedAt: nowIso
                        });
                    }
                    transaction.set(targetScheduleRef, { slots: filteredSlots, updatedAt: nowIso }, { merge: true });

                    transaction.update(resRef, persistedFields);

                    // Ajustar delta de puntos de lealtad si aplica
                    if (playerDoc && playerDoc.exists() && playerRef && verifiedBusiness?.loyaltyEnabled) {
                        const isVisitsMode = verifiedBusiness.loyaltyMode === 'VISITS';
                        const ratio = Number(verifiedBusiness.pointsRatio) || 10;
                        const playerData = playerDoc.data();
                        const loyaltyMap = playerData.loyalty || {};
                        const bizLoyalty = loyaltyMap[this.currentBusiness?.id || resData.businessId] || { points: 0, visits: 0, tier: 'Bronce' };

                        if (isReactivating && validatedStatus === 'CONFIRMED') {
                            const pts = isVisitsMode ? 1 : Math.floor(verifiedNewTotalCost / ratio);
                            const nextPoints = (bizLoyalty.points || 0) + (isVisitsMode ? 0 : pts);
                            const nextVisits = (bizLoyalty.visits || 0) + (isVisitsMode ? pts : 1);
                            const valForTier = isVisitsMode ? nextVisits : nextPoints;
                            const nextTier = loyaltyManager.calculateTier(valForTier, verifiedBusiness.loyaltyMode || 'POINTS').name;
                            loyaltyMap[this.currentBusiness?.id || resData.businessId] = { ...bizLoyalty, points: nextPoints, visits: nextVisits, tier: nextTier };
                            transaction.update(playerRef, { loyalty: loyaltyMap, updatedAt: nowIso });
                        } else if (wasConfirmed && validatedStatus === 'CONFIRMED' && !isVisitsMode) {
                            const oldPts = Math.floor(oldCostInDb / ratio);
                            const newPts = Math.floor(verifiedNewTotalCost / ratio);
                            const diff = newPts - oldPts;
                            if (diff !== 0) {
                                const nextPoints = Math.max(0, (bizLoyalty.points || 0) + diff);
                                const nextTier = loyaltyManager.calculateTier(nextPoints, 'POINTS').name;
                                loyaltyMap[this.currentBusiness?.id || resData.businessId] = { ...bizLoyalty, points: nextPoints, tier: nextTier };
                                transaction.update(playerRef, { loyalty: loyaltyMap, updatedAt: nowIso });
                            }
                        }
                    }

                    auditLogger.appendTransactionAudit(transaction, {
                        businessId: resData.businessId,
                        action: isReactivating ? AUDIT_ACTIONS.RESERVATION_CREATED : AUDIT_ACTIONS.RESERVATION_MODIFIED,
                        target: { type: 'RESERVATION', id: reservationId, name: resData.clientName || 'Jugador' },
                        financialData: { amount: verifiedNewTotalCost },
                        details: `${isReactivating ? 'Reactivada' : 'Modificada'} reservación de ${resData.clientName} para ${persistedFields.date} (${persistedFields.startTime} - ${persistedFields.endTime}). Nuevo Total: $${verifiedNewTotalCost}`
                    });

                    Object.assign(res, persistedFields);
                });
            } catch (e) {
                handleAppError(e, { context: "Error modificando reservación en Firestore", showToast: true, rethrow: true });
            }
        }

        const inMemory = this.reservations.find(r => r.id === reservationId);
        if (inMemory) {
            Object.assign(inMemory, res);
        }
        if (this.currentBusiness?.id) {
            this.saveLocalReservations(this.currentBusiness.id, this.reservations);
        }

        this.notify();
        return res;
    }

    /**
     * ANULACIÓN / CANCELACIÓN DE RESERVACIÓN (CERO BORRADO FÍSICO).
     * Reemplaza el deleteDoc() físico por un soft-cancel con auditoría y reversión de puntos.
     */
    async deleteReservation(reservationId, reason = 'Cancelada por el encargado') {
        assertFinancialOnline();
        const res = await this.getOrFetchReservation(reservationId);
        if (!res) throw new Error("Reservación no encontrada.");

        const currentStaff = authManager.getCurrentUser()?.name || 'Encargado';
        const nowIso = new Date().toISOString();

        if (isFirebaseAvailable && db) {
            try { 
                await runTransaction(db, async (transaction) => {
                    // 1. TODAS LAS LECTURAS (READS) PRIMERO
                    const resRef = doc(db, COLLECTIONS.RESERVATIONS, reservationId);
                    const resDoc = await transaction.get(resRef);
                    if (!resDoc.exists()) throw new Error("Reservación no encontrada.");

                    const resData = resDoc.data();
                    if (resData.status === 'CANCELLED') {
                        return;
                    }
                    const wasConfirmed = resData.status === 'CONFIRMED';

                    const scheduleKey = `${resData.businessId}_${resData.machineId}_${resData.date}`;
                    const scheduleRef = doc(db, COLLECTIONS.MACHINE_SCHEDULES, scheduleKey);
                    const scheduleDoc = await transaction.get(scheduleRef);

                    let playerRef = null;
                    let playerDoc = null;
                    if (wasConfirmed && resData.clientId && this.currentBusiness?.loyaltyEnabled) {
                        playerRef = doc(db, COLLECTIONS.PLAYERS, resData.clientId);
                        playerDoc = await transaction.get(playerRef);
                    }

                    // 2. TODAS LAS ESCRITURAS (WRITES)
                    if (scheduleDoc.exists()) {
                        const slots = (scheduleDoc.data().slots || []).map(s => 
                            s.resId === reservationId ? { ...s, status: 'CANCELLED', updatedAt: nowIso } : s
                        );
                        transaction.set(scheduleRef, { slots, updatedAt: nowIso }, { merge: true });
                    }

                    transaction.update(resRef, {
                        status: 'CANCELLED',
                        cancellationReason: reason.trim(),
                        cancelledAt: nowIso,
                        cancelledBy: currentStaff,
                        updatedAt: nowIso
                    });

                    if (playerDoc && playerDoc.exists() && playerRef) {
                        const playerData = playerDoc.data();
                        const loyaltyMap = playerData.loyalty || {};
                        const bizLoyalty = loyaltyMap[this.currentBusiness.id] || { points: 0, visits: 0, tier: 'Bronce' };
                        const isVisitsMode = this.currentBusiness.loyaltyMode === 'VISITS';
                        const pts = isVisitsMode ? 1 : Math.floor((resData.totalCost || 0) / (Number(this.currentBusiness.pointsRatio) || 10));

                        const nextPoints = Math.max(0, (bizLoyalty.points || 0) - (isVisitsMode ? 0 : pts));
                        const nextVisits = Math.max(0, (bizLoyalty.visits || 0) - (isVisitsMode ? pts : 1));
                        const valForTier = isVisitsMode ? nextVisits : nextPoints;
                        const nextTier = loyaltyManager.calculateTier(valForTier, this.currentBusiness.loyaltyMode || 'POINTS').name;

                        loyaltyMap[this.currentBusiness.id] = { ...bizLoyalty, points: nextPoints, visits: nextVisits, tier: nextTier };
                        transaction.update(playerRef, { loyalty: loyaltyMap, updatedAt: nowIso });
                    }

                    auditLogger.appendTransactionAudit(transaction, {
                        businessId: resData.businessId,
                        action: AUDIT_ACTIONS.RESERVATION_CANCELLED,
                        target: { type: 'RESERVATION', id: reservationId, name: resData.clientName || 'Jugador' },
                        financialData: { amount: resData.totalCost || 0 },
                        details: `Cancelada/Eliminada reservación ID ${reservationId} (${resData.clientName || 'Jugador'}) por ${currentStaff}. Motivo: "${reason.trim()}"`
                    });
                });
            } catch (e) {
                handleAppError(e, { context: "Error al cancelar reservación en Firestore", showToast: true, rethrow: true });
            }
        }

        // Mantener la reservación en memoria marcada como CANCELLED para coherencia con Firestore
        const inMemory = this.reservations.find(r => r.id === reservationId);
        if (inMemory) {
            inMemory.status = 'CANCELLED';
            inMemory.cancellationReason = reason.trim();
            inMemory.cancelledAt = nowIso;
            inMemory.cancelledBy = currentStaff;
            inMemory.updatedAt = nowIso;
        }
        if (this.currentBusiness?.id) {
            this.saveLocalReservations(this.currentBusiness.id, this.reservations);
        }

        this.notify();
        return true;
    }

    async addMachine(machineData) {
        assertFinancialOnline();
        const uniqueMachineId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? 'mach_' + crypto.randomUUID() 
            : 'mach_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

        const newMachine = {
            id: uniqueMachineId,
            businessId: this.currentBusiness.id,
            name: machineData.name.trim(),
            model: machineData.model.trim(),
            version: machineData.version.trim(),
            status: machineData.status || 'AVAILABLE',
            padsCondition: machineData.padsCondition ? machineData.padsCondition.trim() : 'En buen estado.',
            hourlyRate: Number(machineData.hourlyRate) || 80,
            hourlyRate2P: Number(machineData.hourlyRate2P) || 130,
            imageUrl: machineData.imageUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
            features: machineData.features || ['AM.PASS', 'HD Sound'],
            createdAt: new Date().toISOString()
        };

        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    const machineRef = doc(db, COLLECTIONS.MACHINES, newMachine.id);
                    transaction.set(machineRef, newMachine);

                    auditLogger.appendTransactionAudit(transaction, {
                        businessId: this.currentBusiness.id,
                        action: AUDIT_ACTIONS.MACHINE_CREATED,
                        target: { type: 'MACHINE', id: newMachine.id, name: newMachine.name },
                        financialData: { amount: newMachine.hourlyRate },
                        details: `Agregada máquina: ${newMachine.name} (${newMachine.model} - ${newMachine.version}). Tarifa: $${newMachine.hourlyRate}/hr`
                    });
                });
            } catch (e) {
                handleAppError(e, { context: "Error creando máquina en Firestore", showToast: true, rethrow: true });
            }
        }

        this.machines.push(newMachine);
        this.saveLocalMachines(this.currentBusiness.id, this.machines);

        this.notify();
        return newMachine;
    }

    async updateMachine(machineId, updatedFields) {
        assertFinancialOnline();
        const machine = this.machines.find(m => m.id === machineId);
        if (!machine) throw new Error("Máquina no encontrada");

        const updatedData = {
            ...updatedFields,
            updatedAt: new Date().toISOString()
        };

        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    const machineRef = doc(db, COLLECTIONS.MACHINES, machineId);
                    const machineDoc = await transaction.get(machineRef);
                    if (!machineDoc.exists()) throw new Error("Máquina no encontrada.");

                    transaction.update(machineRef, updatedData);

                    auditLogger.appendTransactionAudit(transaction, {
                        businessId: machine.businessId || this.currentBusiness.id,
                        action: AUDIT_ACTIONS.MACHINE_UPDATED,
                        target: { type: 'MACHINE', id: machineId, name: updatedFields.name || machine.name },
                        financialData: { amount: Number(updatedFields.hourlyRate) || machine.hourlyRate },
                        details: `Actualizada máquina ${updatedFields.name || machine.name} (${machineId})`
                    });
                });
            } catch (e) {
                handleAppError(e, { context: "Error actualizando máquina en Firestore", showToast: true, rethrow: true });
            }
        }

        Object.assign(machine, updatedData);
        this.saveLocalMachines(this.currentBusiness.id, this.machines);

        this.notify();
        return machine;
    }

    async deleteMachine(machineId) {
        assertFinancialOnline();
        const machineToDelete = this.machines.find(m => m.id === machineId);
        const currentStaff = authManager.getCurrentUser()?.name || 'Encargado';
        const nowIso = new Date().toISOString();
        
        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    const machineRef = doc(db, COLLECTIONS.MACHINES, machineId);
                    const machineDoc = await transaction.get(machineRef);
                    if (!machineDoc.exists()) throw new Error("Máquina no encontrada.");

                    // SOFT-DELETE: Preservar histórico administrativo y financiero
                    transaction.update(machineRef, {
                        status: 'DELETED',
                        isDeleted: true,
                        deletedAt: nowIso,
                        deletedBy: currentStaff,
                        updatedAt: nowIso
                    });

                    auditLogger.appendTransactionAudit(transaction, {
                        businessId: this.currentBusiness.id,
                        action: AUDIT_ACTIONS.MACHINE_DELETED,
                        target: { type: 'MACHINE', id: machineId, name: machineToDelete?.name || 'Máquina' },
                        details: `Máquina ID ${machineId} (${machineToDelete?.name || ''}) marcada como eliminada/archivada por ${currentStaff}`
                    });
                });
            } catch (e) {
                handleAppError(e, { context: "Error eliminando máquina en Firestore", showToast: true, rethrow: true });
            }
        }

        this.machines = this.machines.filter(m => m.id !== machineId);
        this.saveLocalMachines(this.currentBusiness.id, this.machines);

        this.notify();
        return true;
    }

    setCurrentView(view) {
        this.currentView = view;
        this.notify();
    }

    setSelectedDate(dateStr) {
        this.selectedDate = dateStr;
        this.notify();
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notify() {
        this.listeners.forEach(cb => cb(this));
    }
}

export const store = new Store();
