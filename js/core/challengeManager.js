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
import { formatDateKey, format12Hour } from './timeUtils.js';

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
        businessIdB = null,
        businessNameB = '',
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
                businessIdB: businessIdB || null,
                businessNameB: businessNameB || '',
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
        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.CHALLENGES, challengeId), newChallenge);
            } catch (err) {
                handleAppError(err, { context: "Error guardando reto en Firestore", showToast: true, rethrow: true });
            }
        }

        // Cache local
        const localList = this.getLocalChallenges();
        localList.unshift(newChallenge);
        this.saveLocalChallenges(localList);

        this.notify();
        return newChallenge;
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
        isExternalLocation = false,
        externalLocationName = '',
        counterNotes = ''
    }) {
        const challenge = await this.getChallengeById(challengeId);
        if (!challenge) throw new Error("Reto no encontrado.");

        if (challenge.status !== CHALLENGE_STATUS.PENDING && challenge.status !== CHALLENGE_STATUS.COUNTER_OFFERED) {
            throw new Error("Este reto ya no está en fase de negociación.");
        }

        const isChallenger = challenge.challenger.id === actorUser.id;
        const nextTurnId = isChallenger ? challenge.opponent.id : challenge.challenger.id;
        const nowIso = new Date().toISOString();

        const updatedSchedule = {
            date: newDate || challenge.schedule.date,
            startTime: newStartTime || challenge.schedule.startTime,
            endTime: newEndTime || challenge.schedule.endTime
        };

        const updatedLocation = {
            ...challenge.location,
            businessId: newBusinessId ?? challenge.location.businessId,
            businessName: newBusinessName || challenge.location.businessName,
            isExternal: isExternalLocation,
            externalName: externalLocationName || challenge.location.externalName
        };

        const historyEntry = {
            action: 'COUNTER_OFFER',
            actorId: actorUser.id,
            actorName: actorUser.name,
            date: updatedSchedule.date,
            startTime: updatedSchedule.startTime,
            endTime: updatedSchedule.endTime,
            location: updatedLocation.businessName || updatedLocation.externalName || 'Local',
            notes: counterNotes,
            createdAt: nowIso
        };

        const updatedData = {
            status: CHALLENGE_STATUS.COUNTER_OFFERED,
            schedule: updatedSchedule,
            location: updatedLocation,
            turn: nextTurnId,
            history: [...(challenge.history || []), historyEntry],
            updatedAt: nowIso
        };

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
     * Acepta el reto y dispara automáticamente la creación de reservaciones correspondientes.
     */
    async acceptChallenge(challengeId, actorUser) {
        const challenge = await this.getChallengeById(challengeId);
        if (!challenge) throw new Error("Reto no encontrado.");

        if (challenge.status !== CHALLENGE_STATUS.PENDING && challenge.status !== CHALLENGE_STATUS.COUNTER_OFFERED) {
            throw new Error("El reto no se encuentra disponible para aceptación.");
        }

        const nowIso = new Date().toISOString();
        const createdReservationIds = [];

        // AUTOMATIZACIÓN DE RESERVACIONES
        // Escenario 1: Versus en el Mismo Local
        if (challenge.mode === 'SAME_LOCAL' && challenge.location.businessId && !challenge.location.isExternal) {
            const bizId = challenge.location.businessId;
            const targetBusiness = tenantManager.getAllBusinesses().find(b => b.id === bizId);

            if (targetBusiness) {
                try {
                    // Cargar máquinas de ese local
                    let machines = [];
                    if (isFirebaseAvailable && db) {
                        const mSnap = await getDocs(query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", bizId)));
                        mSnap.forEach(d => machines.push({ id: d.id, ...d.data() }));
                    }
                    if (machines.length === 0) {
                        machines = JSON.parse(localStorage.getItem(`piu_machines_${bizId}`) || '[]');
                    }

                    const availableMachine = machines.find(m => m.status === 'AVAILABLE') || machines[0];
                    if (availableMachine) {
                        const resData = {
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
                            isVersusMatch: true,
                            challengeId: challenge.id
                        };

                        const createdRes = await store.addReservation(resData);
                        if (createdRes && createdRes.id) {
                            createdReservationIds.push(createdRes.id);
                        }
                    }
                } catch (resErr) {
                    console.warn("Advertencia creando reservación automática 2P:", resErr);
                }
            }
        }

        // Escenario 2: Duelo Remoto en Locales Distintos
        if (challenge.mode === 'DIFFERENT_LOCALS') {
            const bizA = challenge.location.businessId;
            const bizB = challenge.location.businessIdB;

            // Reserva Jugador A
            if (bizA) {
                try {
                    const mSnapA = await getDocs(query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", bizA)));
                    const machinesA = [];
                    mSnapA.forEach(d => machinesA.push({ id: d.id, ...d.data() }));
                    const machA = machinesA.find(m => m.status === 'AVAILABLE') || machinesA[0];
                    if (machA) {
                        const resA = await store.addReservation({
                            businessId: bizA,
                            machineId: machA.id,
                            machineName: machA.name,
                            date: challenge.schedule.date,
                            startTime: challenge.schedule.startTime,
                            endTime: challenge.schedule.endTime,
                            clientId: challenge.challenger.id,
                            clientName: challenge.challenger.name,
                            clientUsername: challenge.challenger.username,
                            notes: `⚔️ Duelo Remoto vs ${challenge.opponent.name}`,
                            isVersusMatch: true,
                            challengeId: challenge.id
                        });
                        if (resA?.id) createdReservationIds.push(resA.id);
                    }
                } catch (e) {}
            }

            // Reserva Jugador B
            if (bizB) {
                try {
                    const mSnapB = await getDocs(query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", bizB)));
                    const machinesB = [];
                    mSnapB.forEach(d => machinesB.push({ id: d.id, ...d.data() }));
                    const machB = machinesB.find(m => m.status === 'AVAILABLE') || machinesB[0];
                    if (machB) {
                        const resB = await store.addReservation({
                            businessId: bizB,
                            machineId: machB.id,
                            machineName: machB.name,
                            date: challenge.schedule.date,
                            startTime: challenge.schedule.startTime,
                            endTime: challenge.schedule.endTime,
                            clientId: challenge.opponent.id,
                            clientName: challenge.opponent.name,
                            clientUsername: challenge.opponent.username,
                            notes: `⚔️ Duelo Remoto vs ${challenge.challenger.name}`,
                            isVersusMatch: true,
                            challengeId: challenge.id
                        });
                        if (resB?.id) createdReservationIds.push(resB.id);
                    }
                } catch (e) {}
            }
        }

        const historyEntry = {
            action: 'ACCEPTED',
            actorId: actorUser.id,
            actorName: actorUser.name,
            createdAt: nowIso
        };

        const updatedData = {
            status: CHALLENGE_STATUS.ACCEPTED,
            reservationIds: createdReservationIds,
            history: [...(challenge.history || []), historyEntry],
            updatedAt: nowIso
        };

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
            actorId: actorUser.id,
            actorName: actorUser.name,
            notes: reason,
            createdAt: nowIso
        };

        const updatedData = {
            status: newStatus,
            rejectionReason: reason || '',
            history: [...(challenge.history || []), historyEntry],
            updatedAt: nowIso
        };

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

        const updatedData = {
            status: CHALLENGE_STATUS.COMPLETED,
            matchResult,
            updatedAt: nowIso
        };

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
