// js/core/accountManager.js
// Módulo de Gestión de Cuentas, Consumos e Historial de Jugadores (Fase 2)
import { 
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    setDoc, 
    doc, 
    updateDoc, 
    getDoc,
    query, 
    where, 
    limit,
    runTransaction 
} from '../firebaseConfig.js';
import { tenantManager } from './tenantManager.js';
import { authManager } from './authManager.js';
import { loyaltyManager } from './loyaltyManager.js';

export const CONSUMPTION_TYPES = {
    JUEGO: {
        id: 'juego',
        label: 'Juego',
        icon: '🕹️',
        defaultConcept: 'Tiempo de Juego / Retas',
        defaultPrice: 20,
        color: '#00E5FF'
    },
    BEBIDA: {
        id: 'bebida',
        label: 'Bebida',
        icon: '🥤',
        defaultConcept: 'Bebida / Hidratación',
        defaultPrice: 25,
        color: '#68F205'
    },
    ALIMENTO: {
        id: 'alimento',
        label: 'Alimento',
        icon: '🍿',
        defaultConcept: 'Snack / Alimento',
        defaultPrice: 20,
        color: '#FFB800'
    },
    FICHA: {
        id: 'ficha',
        label: 'Ficha',
        icon: '🪙',
        defaultConcept: 'Fichas / Tokens PIU',
        defaultPrice: 10,
        color: '#C3D91E'
    },
    INSCRIPCION: {
        id: 'inscripcion',
        label: 'Inscripción',
        icon: '🏆',
        defaultConcept: 'Inscripción Torneo / Evento',
        defaultPrice: 50,
        color: '#FF2E7E'
    },
    PRODUCTO: {
        id: 'producto',
        label: 'Producto',
        icon: '🛍️',
        defaultConcept: 'Accesorio / AM.PASS / Merch',
        defaultPrice: 150,
        color: '#9D4EDD'
    },
    OTRO: {
        id: 'otro',
        label: 'Otro',
        icon: '📦',
        defaultConcept: 'Consumo Varios',
        defaultPrice: 0,
        color: '#718096'
    }
};

class AccountManager {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Obtiene el listado completo de tipos rápidos disponibles.
     */
    getQuickTypes() {
        return Object.values(CONSUMPTION_TYPES);
    }

    /**
     * Obtiene el tipo por su identificador.
     */
    getTypeById(typeId) {
        if (!typeId) return CONSUMPTION_TYPES.OTRO;
        const normalized = typeId.toLowerCase().trim();
        const found = Object.values(CONSUMPTION_TYPES).find(t => t.id === normalized);
        return found || CONSUMPTION_TYPES.OTRO;
    }

    /**
     * Carga el historial de movimientos de un jugador en una sucursal específica.
     */
    async getPlayerTransactions(businessId, playerId) {
        if (!businessId || !playerId) return [];
        let list = [];

        if (isFirebaseAvailable && db) {
            try {
                const q = query(
                    collection(db, COLLECTIONS.CONSUMPTIONS),
                    where("businessId", "==", businessId),
                    where("playerId", "==", playerId)
                );
                const snap = await getDocs(q);
                snap.forEach(d => {
                    list.push({ id: d.id, ...d.data() });
                });
            } catch (err) {
                console.warn("⚠️ Error cargando transacciones de Firestore, usando LocalStorage:", err);
            }
        }

        // Fallback local
        if (list.length === 0) {
            const localKey = `piu_consumptions_${businessId}_${playerId}`;
            const localData = localStorage.getItem(localKey);
            if (localData) {
                try {
                    list = JSON.parse(localData);
                } catch (e) {
                    list = [];
                }
            }
        }

        // Ordenar cronológicamente descendente (más reciente primero)
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return list;
    }

    /**
     * Calcula el estado de cuenta y saldos de un jugador en la sucursal actual.
     */
    async getPlayerAccount(businessId, playerId) {
        const transactions = await this.getPlayerTransactions(businessId, playerId);
        const activeTx = transactions.filter(t => t.status !== 'CANCELLED');

        let totalConsumed = 0;
        let totalPaidDirectly = 0;
        let totalPendingDebt = 0;
        let totalAbonos = 0;

        const breakdownByType = {};
        Object.values(CONSUMPTION_TYPES).forEach(t => {
            breakdownByType[t.id] = { count: 0, total: 0, label: t.label, icon: t.icon };
        });

        activeTx.forEach(t => {
            const amount = Number(t.totalAmount) || 0;

            if (t.type === 'ABONO' || t.type === 'PAGO') {
                totalAbonos += amount;
            } else {
                // Es un consumo
                totalConsumed += amount;
                const itemKey = (t.itemType || 'otro').toLowerCase();
                if (!breakdownByType[itemKey]) {
                    breakdownByType[itemKey] = { count: 0, total: 0, label: itemKey, icon: '📦' };
                }
                breakdownByType[itemKey].count += (Number(t.quantity) || 1);
                breakdownByType[itemKey].total += amount;

                if (t.paymentStatus === 'PAID') {
                    totalPaidDirectly += amount;
                } else {
                    totalPendingDebt += amount;
                }
            }
        });

        // El saldo pendiente neto es la deuda pendiente menos los abonos a favor
        const netDebt = Math.max(0, totalPendingDebt - totalAbonos);
        const creditBalance = Math.max(0, totalAbonos - totalPendingDebt);

        return {
            playerId,
            businessId,
            totalConsumed,
            totalPaidDirectly,
            totalPendingDebt,
            totalAbonos,
            netDebt,          // Deuda pendiente de liquidar
            creditBalance,    // Saldo a favor disponible
            hasPendingDebt: netDebt > 0,
            hasCredit: creditBalance > 0,
            transactionsCount: activeTx.length,
            breakdownByType,
            transactions
        };
    }

    /**
     * Registra un nuevo consumo de un jugador.
     */
    async recordConsumption({
        businessId,
        playerId,
        playerUsername = '',
        playerName = '',
        playerPhone = '',
        itemType = 'otro',
        concept = '',
        quantity = 1,
        unitPrice = 0,
        notes = '',
        paymentStatus = 'PAID', // 'PAID' (Pagado al momento) o 'PENDING' (A la cuenta / Por pagar)
        paymentMethod = 'CASH', // 'CASH', 'CARD', 'TRANSFER', 'ACCOUNT_CREDIT'
        reservationId = null,
        createdBy = null
    }) {
        if (!businessId) throw new Error("Se requiere la sucursal (businessId) para registrar el consumo.");
        if (!playerId) throw new Error("Se requiere el jugador (playerId) para registrar el consumo.");

        const numQty = Math.max(1, Number(quantity) || 1);
        const numPrice = Math.max(0, Number(unitPrice) || 0);
        const totalAmount = numQty * numPrice;
        const currentStaff = createdBy || authManager.getCurrentUser()?.name || 'Encargado';

        const typeMeta = this.getTypeById(itemType);
        const finalConcept = (concept || typeMeta.defaultConcept || 'Consumo').trim();

        const consumptionId = `csm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const newRecord = {
            id: consumptionId,
            businessId,
            playerId,
            playerUsername: playerUsername || '',
            playerName: playerName || '',
            playerPhone: playerPhone || '',
            type: 'CONSUMO',
            itemType: typeMeta.id,
            concept: finalConcept,
            quantity: numQty,
            unitPrice: numPrice,
            totalAmount,
            paymentStatus: paymentStatus === 'PENDING' ? 'PENDING' : 'PAID',
            paymentMethod: paymentMethod || 'CASH',
            notes: (notes || '').trim(),
            reservationId: reservationId || null,
            status: 'ACTIVE',
            createdBy: currentStaff,
            createdAt: new Date().toISOString()
        };

        // 1. Guardar en Firestore si está disponible
        if (isFirebaseAvailable && db) {
            try {
                const consumptionRef = doc(db, COLLECTIONS.CONSUMPTIONS, consumptionId);
                await setDoc(consumptionRef, newRecord);

                // Actualizar resumen de cuenta en el documento del jugador (piu_players)
                await this.syncPlayerAccountSummary(businessId, playerId);
            } catch (err) {
                console.warn("⚠️ Error guardando consumo en Firestore, usando almacenamiento local:", err);
            }
        }

        // 2. Guardar en LocalStorage como respaldo
        const localKey = `piu_consumptions_${businessId}_${playerId}`;
        const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
        localList.unshift(newRecord);
        localStorage.setItem(localKey, JSON.stringify(localList));

        // 3. Si el consumo fue pagado y el local tiene acumulación de lealtad por consumo, acreditar puntos
        const business = tenantManager.getBusinessById(businessId);
        if (business && business.loyaltyEnabled && business.loyaltyMode !== 'VISITS' && paymentStatus === 'PAID' && totalAmount > 0) {
            try {
                const ratio = Number(business.pointsRatio) || 10;
                const ptsEarned = Math.floor(totalAmount / ratio);
                if (ptsEarned > 0) {
                    await loyaltyManager.adjustPlayerPoints(
                        businessId, 
                        playerId, 
                        ptsEarned, 
                        0, 
                        `Consumo registrado (${typeMeta.label}: ${finalConcept}) $${totalAmount}`
                    );
                }
            } catch (ltyErr) {
                console.warn("No se pudo auto-acreditar puntos de lealtad por el consumo:", ltyErr);
            }
        }

        return newRecord;
    }

    /**
     * Registra un Abono / Pago a la cuenta para liquidar saldos pendientes o recargar saldo a favor.
     */
    async recordPayment({
        businessId,
        playerId,
        playerUsername = '',
        playerName = '',
        amount = 0,
        paymentMethod = 'CASH',
        notes = '',
        createdBy = null
    }) {
        if (!businessId || !playerId) throw new Error("Sucursal y jugador son requeridos para registrar un abono.");
        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) throw new Error("El monto del abono debe ser mayor a 0.");

        const currentStaff = createdBy || authManager.getCurrentUser()?.name || 'Encargado';
        const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const paymentRecord = {
            id: paymentId,
            businessId,
            playerId,
            playerUsername: playerUsername || '',
            playerName: playerName || '',
            type: 'ABONO',
            itemType: 'abono',
            concept: 'Abono / Pago a cuenta',
            quantity: 1,
            unitPrice: numAmount,
            totalAmount: numAmount,
            paymentStatus: 'PAID',
            paymentMethod: paymentMethod || 'CASH',
            notes: (notes || '').trim(),
            status: 'ACTIVE',
            createdBy: currentStaff,
            createdAt: new Date().toISOString()
        };

        if (isFirebaseAvailable && db) {
            try {
                const docRef = doc(db, COLLECTIONS.CONSUMPTIONS, paymentId);
                await setDoc(docRef, paymentRecord);
                await this.syncPlayerAccountSummary(businessId, playerId);
            } catch (err) {
                console.warn("⚠️ Error guardando abono en Firestore:", err);
            }
        }

        const localKey = `piu_consumptions_${businessId}_${playerId}`;
        const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
        localList.unshift(paymentRecord);
        localStorage.setItem(localKey, JSON.stringify(localList));

        return paymentRecord;
    }

    /**
     * Cancela o anula un movimiento (consumo o abono) revertiendo sus efectos.
     */
    async cancelTransaction(businessId, playerId, transactionId, reason = 'Cancelado por el encargado') {
        if (!businessId || !playerId || !transactionId) throw new Error("Datos insuficientes para cancelar la transacción.");

        if (isFirebaseAvailable && db) {
            try {
                const docRef = doc(db, COLLECTIONS.CONSUMPTIONS, transactionId);
                await updateDoc(docRef, {
                    status: 'CANCELLED',
                    cancelledReason: reason,
                    cancelledAt: new Date().toISOString()
                });
                await this.syncPlayerAccountSummary(businessId, playerId);
            } catch (err) {
                console.warn("⚠️ Error cancelando en Firestore:", err);
            }
        }

        const localKey = `piu_consumptions_${businessId}_${playerId}`;
        const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
        const idx = localList.findIndex(t => t.id === transactionId);
        if (idx !== -1) {
            localList[idx].status = 'CANCELLED';
            localList[idx].cancelledReason = reason;
            localList[idx].cancelledAt = new Date().toISOString();
            localStorage.setItem(localKey, JSON.stringify(localList));
        }

        return true;
    }

    /**
     * Sincroniza y cachea el resumen de saldos en el perfil del jugador en piu_players.
     */
    async syncPlayerAccountSummary(businessId, playerId) {
        if (!isFirebaseAvailable || !db || !playerId) return;

        try {
            const account = await this.getPlayerAccount(businessId, playerId);
            const playerRef = doc(db, COLLECTIONS.PLAYERS, playerId);
            const playerSnap = await getDoc(playerRef);

            if (playerSnap.exists()) {
                const curData = playerSnap.data();
                const accountsMap = curData.accounts || {};
                accountsMap[businessId] = {
                    netDebt: account.netDebt,
                    creditBalance: account.creditBalance,
                    totalConsumed: account.totalConsumed,
                    hasPendingDebt: account.hasPendingDebt,
                    lastUpdated: new Date().toISOString()
                };

                await updateDoc(playerRef, {
                    accounts: accountsMap
                });
            }
        } catch (err) {
            console.warn("No se pudo sincronizar resumen de cuenta en piu_players:", err);
        }
    }

    /**
     * Obtiene el resumen global de consumos de la sucursal para analíticas o cierres de caja.
     */
    async getBusinessConsumptionsSummary(businessId) {
        if (!businessId) return { totalSales: 0, pendingDebt: 0, itemsCount: 0, byType: {} };
        let allConsumptions = [];

        if (isFirebaseAvailable && db) {
            try {
                const q = query(
                    collection(db, COLLECTIONS.CONSUMPTIONS),
                    where("businessId", "==", businessId)
                );
                const snap = await getDocs(q);
                snap.forEach(d => allConsumptions.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando consumos globales de la sucursal:", e);
            }
        }

        const activeList = allConsumptions.filter(c => c.status !== 'CANCELLED');
        let totalSales = 0;
        let pendingDebt = 0;
        const byType = {};

        activeList.forEach(c => {
            const amount = Number(c.totalAmount) || 0;
            if (c.type === 'CONSUMO') {
                totalSales += amount;
                if (c.paymentStatus === 'PENDING') {
                    pendingDebt += amount;
                }
                const tKey = c.itemType || 'otro';
                byType[tKey] = (byType[tKey] || 0) + amount;
            }
        });

        return {
            totalSales,
            pendingDebt,
            itemsCount: activeList.length,
            byType
        };
    }
}

export const accountManager = new AccountManager();
