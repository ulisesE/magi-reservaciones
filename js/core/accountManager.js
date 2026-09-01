// js/core/accountManager.js
// Módulo de Gestión de Cuentas, Consumos, Catálogo de Productos y Flujo de Caja (Cuenta Fácil v1.6.0)
// Principio Rector: FIRESTORE ES EL MANDANTE (Single Source of Truth) con Aislamiento Estricto por Local
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
    limit,
    onSnapshot 
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
        defaultConcept: 'Bebida / Refresco / Hidratación',
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
        this.productsCache = new Map();
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

    // =========================================================================
    // 1. CATÁLOGO DE PRODUCTOS Y PRECIOS POR SUCURSAL (Aislamiento Multi-Tenant)
    // =========================================================================

    /**
     * Carga el catálogo de productos y precios de una sucursal específica.
     */
    async getProducts(businessId) {
        if (!businessId) return [];
        let list = [];

        // 1. Cargar desde Firestore (Firestore es el Mandante)
        if (isFirebaseAvailable && db) {
            try {
                const q = query(
                    collection(db, COLLECTIONS.PRODUCTS),
                    where("businessId", "==", businessId)
                );
                const snap = await getDocs(q);
                snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            } catch (err) {
                console.warn("⚠️ Error cargando productos de Firestore, usando caché local:", err);
            }
        }

        // 2. Fallback de LocalStorage si no hay conexión
        if (list.length === 0) {
            const localKey = `piu_products_${businessId}`;
            const localData = localStorage.getItem(localKey);
            if (localData) {
                try { list = JSON.parse(localData); } catch (e) { list = []; }
            }
        } else {
            localStorage.setItem(`piu_products_${businessId}`, JSON.stringify(list));
        }

        // Ordenar alfabéticamente por nombre
        list.sort((a, b) => a.name.localeCompare(b.name));
        this.productsCache.set(businessId, list);
        return list;
    }

    /**
     * Guarda o actualiza un producto en el catálogo del local.
     */
    async saveProduct(businessId, productData) {
        if (!businessId) throw new Error("Se requiere la sucursal (businessId) para guardar el producto.");
        if (!productData.name || !productData.name.trim()) throw new Error("El nombre del producto es obligatorio.");

        const productId = productData.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const finalProduct = {
            id: productId,
            businessId,
            name: productData.name.trim(),
            category: (productData.category || 'otro').toLowerCase(),
            icon: productData.icon || '🛍️',
            price: Math.max(0, Number(productData.price) || 0),
            status: productData.status || 'ACTIVE',
            updatedAt: new Date().toISOString()
        };
        if (!productData.id) {
            finalProduct.createdAt = new Date().toISOString();
        }

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.PRODUCTS, productId), finalProduct, { merge: true });
            } catch (err) {
                console.warn("⚠️ Error guardando producto en Firestore:", err);
            }
        }

        // Actualizar caché local
        let currentList = await this.getProducts(businessId);
        const idx = currentList.findIndex(p => p.id === productId);
        if (idx !== -1) {
            currentList[idx] = { ...currentList[idx], ...finalProduct };
        } else {
            currentList.push(finalProduct);
        }
        localStorage.setItem(`piu_products_${businessId}`, JSON.stringify(currentList));
        this.productsCache.set(businessId, currentList);

        return finalProduct;
    }

    /**
     * Elimina un producto del catálogo del local.
     */
    async deleteProduct(businessId, productId) {
        if (!businessId || !productId) return false;

        if (isFirebaseAvailable && db) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productId));
            } catch (err) {
                console.warn("⚠️ Error eliminando producto de Firestore:", err);
            }
        }

        let currentList = await this.getProducts(businessId);
        currentList = currentList.filter(p => p.id !== productId);
        localStorage.setItem(`piu_products_${businessId}`, JSON.stringify(currentList));
        this.productsCache.set(businessId, currentList);

        return true;
    }

    // =========================================================================
    // 2. REGISTRO DE VENTAS, CONSUMOS Y ABONOS (MULTI-ITEM & TIEMPO REAL)
    // =========================================================================

    /**
     * Registra una venta / consumo multi-producto o individual con registro exacto de fecha y hora.
     */
    async recordSale({
        businessId,
        playerId,
        playerUsername = '',
        playerName = '',
        playerPhone = '',
        items = [], // Array de { id, name, category, quantity, unitPrice, subtotal, icon }
        customConcept = '',
        customPrice = 0,
        notes = '',
        paymentStatus = 'PAID', // 'PAID' (Pagado al momento) o 'PENDING' (Fiado / A la cuenta)
        paymentMethod = 'CASH', // 'CASH', 'CARD', 'TRANSFER', 'ACCOUNT_CREDIT'
        reservationId = null,
        createdBy = null
    }) {
        if (!businessId) throw new Error("Se requiere la sucursal (businessId) para registrar la venta.");
        if (!playerId) throw new Error("Se requiere seleccionar un cliente o registrar venta de mostrador.");

        const currentStaff = createdBy || authManager.getCurrentUser()?.name || 'Encargado';
        const nowIso = new Date().toISOString();

        // 1. Calcular desglose de items y total
        let finalItems = [];
        let totalAmount = 0;
        let mainType = 'otro';

        if (Array.isArray(items) && items.length > 0) {
            items.forEach(it => {
                const qty = Math.max(1, Number(it.quantity) || 1);
                const price = Math.max(0, Number(it.unitPrice ?? it.price) || 0);
                const sub = qty * price;
                totalAmount += sub;
                finalItems.push({
                    productId: it.id || it.productId || null,
                    name: it.name || 'Producto',
                    category: it.category || 'otro',
                    icon: it.icon || '🛍️',
                    quantity: qty,
                    unitPrice: price,
                    subtotal: sub
                });
            });
            if (finalItems[0]) {
                mainType = finalItems[0].category;
            }
        }

        // Sumar concepto personalizado si se especificó
        if (customConcept && customConcept.trim() && Number(customPrice) > 0) {
            const cPrice = Number(customPrice);
            totalAmount += cPrice;
            finalItems.push({
                productId: null,
                name: customConcept.trim(),
                category: 'otro',
                icon: '📦',
                quantity: 1,
                unitPrice: cPrice,
                subtotal: cPrice
            });
        }

        if (totalAmount <= 0) {
            throw new Error("El total de la venta debe ser mayor a 0.");
        }

        // Construir concepto descriptivo legible
        let finalConcept = '';
        if (finalItems.length === 1) {
            const it = finalItems[0];
            finalConcept = it.quantity > 1 ? `${it.name} x${it.quantity}` : it.name;
        } else if (finalItems.length > 1) {
            finalConcept = finalItems.map(it => `${it.name} x${it.quantity}`).join(', ');
        } else {
            finalConcept = customConcept || 'Consumo en sala';
        }

        const consumptionId = `csm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const newRecord = {
            id: consumptionId,
            businessId,
            playerId,
            playerUsername: playerUsername || '',
            playerName: playerName || '',
            playerPhone: playerPhone || '',
            type: 'CONSUMO',
            itemType: mainType,
            concept: finalConcept,
            items: finalItems,
            quantity: finalItems.reduce((acc, i) => acc + i.quantity, 0),
            unitPrice: totalAmount,
            totalAmount,
            paymentStatus: paymentStatus === 'PENDING' ? 'PENDING' : 'PAID',
            paymentMethod: paymentMethod || 'CASH',
            notes: (notes || '').trim(),
            reservationId: reservationId || null,
            status: 'ACTIVE',
            createdBy: currentStaff,
            createdAt: nowIso
        };

        // 1. Guardar en Firestore (Firestore es el Mandante)
        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.CONSUMPTIONS, consumptionId), newRecord, { merge: true });
                if (playerId && playerId !== 'guest_walkin') {
                    await this.syncPlayerAccountSummary(businessId, playerId);
                }
            } catch (err) {
                console.warn("⚠️ Error guardando venta en Firestore:", err);
            }
        }

        // 2. Guardar en LocalStorage como respaldo
        const localKey = `piu_consumptions_${businessId}_${playerId}`;
        const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
        localList.unshift(newRecord);
        localStorage.setItem(localKey, JSON.stringify(localList));

        // 3. Auto-acreditación de lealtad si fue pagado de contado
        const business = tenantManager.getBusinessById(businessId);
        if (business && business.loyaltyEnabled && business.loyaltyMode !== 'VISITS' && paymentStatus === 'PAID' && totalAmount > 0 && playerId !== 'guest_walkin') {
            try {
                const ratio = Number(business.pointsRatio) || 10;
                const ptsEarned = Math.floor(totalAmount / ratio);
                if (ptsEarned > 0) {
                    await loyaltyManager.adjustPlayerPoints(
                        businessId, 
                        playerId, 
                        ptsEarned, 
                        0, 
                        `Consumo registrado (${finalConcept}) $${totalAmount}`
                    );
                }
            } catch (ltyErr) {
                console.warn("No se pudo auto-acreditar puntos de lealtad:", ltyErr);
            }
        }

        return newRecord;
    }

    /**
     * Mantiene retrocompatibilidad con recordConsumption simple.
     */
    async recordConsumption(payload) {
        return this.recordSale({
            businessId: payload.businessId,
            playerId: payload.playerId,
            playerUsername: payload.playerUsername,
            playerName: payload.playerName,
            playerPhone: payload.playerPhone,
            items: [{
                name: payload.concept || this.getTypeById(payload.itemType).label,
                category: payload.itemType || 'otro',
                quantity: payload.quantity || 1,
                unitPrice: payload.unitPrice || 0,
                icon: this.getTypeById(payload.itemType).icon
            }],
            notes: payload.notes,
            paymentStatus: payload.paymentStatus,
            paymentMethod: payload.paymentMethod,
            reservationId: payload.reservationId,
            createdBy: payload.createdBy
        });
    }

    /**
     * Registra un Abono / Pago a la cuenta para amortizar o liquidar adeudos pendientes.
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
        const nowIso = new Date().toISOString();

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
            createdAt: nowIso
        };

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.CONSUMPTIONS, paymentId), paymentRecord, { merge: true });
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
     * Liquida de golpe la totalidad de la deuda pendiente de un jugador en este local.
     */
    async liquidatePlayerDebt(businessId, playerId, { paymentMethod = 'CASH', notes = '' } = {}) {
        const account = await this.getPlayerAccount(businessId, playerId);
        if (!account || account.netDebt <= 0) {
            throw new Error("El jugador no tiene deudas pendientes en este local.");
        }

        const client = authManager.getClientUsers().find(c => c.id === playerId) || { name: 'Jugador', username: '' };

        return this.recordPayment({
            businessId,
            playerId,
            playerName: client.name,
            playerUsername: client.username,
            amount: account.netDebt,
            paymentMethod,
            notes: notes || 'Liquidación total de saldo pendiente'
        });
    }

    /**
     * Cancela o anula un movimiento (consumo o abono) revirtiendo su impacto en la cuenta.
     */
    async cancelTransaction(businessId, playerId, transactionId, reason = 'Cancelado por el encargado') {
        if (!businessId || !transactionId) throw new Error("Datos insuficientes para cancelar la transacción.");

        const nowIso = new Date().toISOString();
        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.CONSUMPTIONS, transactionId), {
                    status: 'CANCELLED',
                    cancelledReason: reason,
                    cancelledAt: nowIso
                }, { merge: true });

                if (playerId) {
                    await this.syncPlayerAccountSummary(businessId, playerId);
                }
            } catch (err) {
                console.warn("⚠️ Error cancelando en Firestore:", err);
            }
        }

        if (playerId) {
            const localKey = `piu_consumptions_${businessId}_${playerId}`;
            const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
            const idx = localList.findIndex(t => t.id === transactionId);
            if (idx !== -1) {
                localList[idx].status = 'CANCELLED';
                localList[idx].cancelledReason = reason;
                localList[idx].cancelledAt = nowIso;
                localStorage.setItem(localKey, JSON.stringify(localList));
            }
        }

        return true;
    }

    /**
     * Elimina permanentemente una única transacción de la base de datos de Firestore.
     */
    async deleteTransaction(businessId, playerId, transactionId) {
        if (!businessId || !transactionId) throw new Error("Datos insuficientes para eliminar la transacción.");

        if (isFirebaseAvailable && db) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.CONSUMPTIONS, transactionId));
                if (playerId && playerId !== 'guest_walkin') {
                    await this.syncPlayerAccountSummary(businessId, playerId);
                }
            } catch (err) {
                console.warn("⚠️ Error eliminando transacción de Firestore:", err);
            }
        }

        if (playerId) {
            const localKey = `piu_consumptions_${businessId}_${playerId}`;
            const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
            const filtered = localList.filter(t => t.id !== transactionId);
            localStorage.setItem(localKey, JSON.stringify(filtered));
        }

        return true;
    }

    // =========================================================================
    // 3. CONSULTAS, ESTADO DE CUENTA Y RESÚMENES (AISLAMIENTO STRICTO POR LOCAL)
    // =========================================================================

    /**
     * Carga el historial de movimientos de un jugador en una sucursal específica con arrastre de deuda.
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
                snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            } catch (err) {
                console.warn("⚠️ Error cargando transacciones de Firestore:", err);
            }
        }

        if (list.length === 0) {
            const localKey = `piu_consumptions_${businessId}_${playerId}`;
            const localData = localStorage.getItem(localKey);
            if (localData) {
                try { list = JSON.parse(localData); } catch (e) { list = []; }
            }
        }

        // Ordenar cronológicamente descendente (más reciente primero)
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return list;
    }

    /**
     * Calcula el estado de cuenta y saldos continuos de un jugador en la sucursal actual.
     * Las deudas se arrastran a lo largo de los días hasta ser saldadas.
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

        // El saldo neto por cobrar se arrastra acumulado
        const netDebt = Math.max(0, totalPendingDebt - totalAbonos);
        const creditBalance = Math.max(0, totalAbonos - totalPendingDebt);

        return {
            playerId,
            businessId,
            totalConsumed,
            totalPaidDirectly,
            totalPendingDebt,
            totalAbonos,
            netDebt,          // Deuda pendiente acumulada arrastrada
            creditBalance,    // Saldo a favor disponible
            hasPendingDebt: netDebt > 0,
            hasCredit: creditBalance > 0,
            transactionsCount: activeTx.length,
            breakdownByType,
            transactions
        };
    }

    /**
     * Obtiene todos los movimientos de la sucursal con filtros de cliente, estado y fecha.
     */
    async getBusinessTransactions(businessId, { playerId = null, dateFilter = 'ALL', status = 'ALL' } = {}) {
        if (!businessId) return [];
        let list = [];

        if (isFirebaseAvailable && db) {
            try {
                let q = query(
                    collection(db, COLLECTIONS.CONSUMPTIONS),
                    where("businessId", "==", businessId)
                );
                if (playerId) {
                    q = query(
                        collection(db, COLLECTIONS.CONSUMPTIONS),
                        where("businessId", "==", businessId),
                        where("playerId", "==", playerId)
                    );
                }
                const snap = await getDocs(q);
                snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            } catch (err) {
                console.warn("⚠️ Error cargando movimientos de la sucursal de Firestore:", err);
            }
        }

        // Ordenar cronológicamente descendente
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Aplicar filtros en memoria
        if (playerId) {
            list = list.filter(t => t.playerId === playerId);
        }

        if (status === 'PAID') {
            list = list.filter(t => t.type === 'CONSUMO' && t.paymentStatus === 'PAID' && t.status !== 'CANCELLED');
        } else if (status === 'PENDING') {
            list = list.filter(t => t.type === 'CONSUMO' && t.paymentStatus === 'PENDING' && t.status !== 'CANCELLED');
        } else if (status === 'ABONO') {
            list = list.filter(t => t.type === 'ABONO' && t.status !== 'CANCELLED');
        } else if (status === 'CANCELLED') {
            list = list.filter(t => t.status === 'CANCELLED');
        }

        if (dateFilter === 'TODAY') {
            const todayStr = new Date().toISOString().slice(0, 10);
            list = list.filter(t => (t.createdAt || '').slice(0, 10) === todayStr);
        } else if (dateFilter === 'WEEK') {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            list = list.filter(t => new Date(t.createdAt) >= weekAgo);
        } else if (dateFilter === 'MONTH') {
            const now = new Date();
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            list = list.filter(t => new Date(t.createdAt) >= monthAgo);
        }

        return list;
    }

    /**
     * Calcula el resumen integral de Cuenta Fácil para la sucursal activa:
     * - Por Cobrar General (Deuda total histórica acumulada).
     * - Conteo de clientes con cuenta pendiente.
     * - Total de venta fiada histórica.
     * - Directorio de clientes deudores ordenado por mayor saldo pendiente.
     */
    async getDebtorsSummary(businessId) {
        if (!businessId) return { totalReceivableDebt: 0, totalDebtorsCount: 0, totalCreditSales: 0, debtorsList: [] };

        // Obtener todos los movimientos activos de este negocio
        let allTransactions = [];
        if (isFirebaseAvailable && db) {
            try {
                const q = query(
                    collection(db, COLLECTIONS.CONSUMPTIONS),
                    where("businessId", "==", businessId)
                );
                const snap = await getDocs(q);
                snap.forEach(d => allTransactions.push({ id: d.id, ...d.data() }));
            } catch (err) {
                console.warn("Error cargando deudores de Firestore:", err);
            }
        }

        const activeTx = allTransactions.filter(t => t.status !== 'CANCELLED');

        // Agrupar por jugador
        const playerMap = new Map();
        let totalCreditSales = 0;

        activeTx.forEach(t => {
            const pId = t.playerId || 'guest_walkin';
            const amount = Number(t.totalAmount) || 0;

            if (!playerMap.has(pId)) {
                playerMap.set(pId, {
                    playerId: pId,
                    playerName: t.playerName || (pId === 'guest_walkin' ? 'Venta Mostrador' : 'Jugador'),
                    playerUsername: t.playerUsername || '',
                    playerPhone: t.playerPhone || '',
                    totalConsumed: 0,
                    totalPendingDebt: 0,
                    totalAbonos: 0,
                    lastActivity: t.createdAt
                });
            }

            const pData = playerMap.get(pId);
            if (new Date(t.createdAt) > new Date(pData.lastActivity)) {
                pData.lastActivity = t.createdAt;
            }

            if (t.type === 'ABONO' || t.type === 'PAGO') {
                pData.totalAbonos += amount;
            } else {
                pData.totalConsumed += amount;
                if (t.paymentStatus === 'PENDING') {
                    pData.totalPendingDebt += amount;
                    totalCreditSales += amount;
                }
            }
        });

        // Calcular balances netos por jugador
        let totalReceivableDebt = 0;
        const debtorsList = [];

        playerMap.forEach(p => {
            const netDebt = Math.max(0, p.totalPendingDebt - p.totalAbonos);
            const creditBalance = Math.max(0, p.totalAbonos - p.totalPendingDebt);

            p.netDebt = netDebt;
            p.creditBalance = creditBalance;

            if (netDebt > 0 && p.playerId !== 'guest_walkin') {
                totalReceivableDebt += netDebt;
                debtorsList.push(p);
            }
        });

        // Ordenar deudores de mayor a menor deuda
        debtorsList.sort((a, b) => b.netDebt - a.netDebt);

        return {
            totalReceivableDebt,
            totalDebtorsCount: debtorsList.length,
            totalCreditSales,
            debtorsList,
            allPlayersAccounts: Array.from(playerMap.values())
        };
    }

    /**
     * Sincroniza y cachea el resumen de saldos en el perfil del jugador en piu_players.
     */
    async syncPlayerAccountSummary(businessId, playerId) {
        if (!isFirebaseAvailable || !db || !playerId || playerId === 'guest_walkin') return;

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
}

export const accountManager = new AccountManager();
