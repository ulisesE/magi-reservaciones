import { 
    db, 
    isFirebaseAvailable, 
    isOnline,
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
    runTransaction,
    onSnapshot 
} from '../firebaseConfig.js';
import { tenantManager } from './tenantManager.js';
import { authManager } from './authManager.js';
import { loyaltyManager } from './loyaltyManager.js';
import { auditLogger, AUDIT_ACTIONS } from './auditLogger.js';
import { handleAppError } from './errorHandler.js';

/**
 * POLÍTICA DE CONFIABILIDAD FINANCIERA MAGI:
 * "Consulta offline: SÍ. Operación financiera offline: NO."
 * Toda operación monetaria (ventas, abonos, liquidaciones, anulaciones) exige conexión activa con Firestore.
 */
function assertFinancialOnline() {
    if (!isOnline() || !isFirebaseAvailable || !db) {
        throw new Error("No hay conexión a Internet. Las operaciones monetarias requieren conexión activa con Firestore para garantizar la consistencia contable y auditoría.");
    }
}

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
        this.processedIdempotencyKeys = new Set();
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
                handleAppError(err, { context: "Error cargando catálogo de productos de Firestore", showToast: false });
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

        const isNew = !productData.id;
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
        if (isNew) {
            finalProduct.createdAt = new Date().toISOString();
        }

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.PRODUCTS, productId), finalProduct, { merge: true });
                
                await auditLogger.logEvent({
                    businessId,
                    action: isNew ? AUDIT_ACTIONS.PRODUCT_CREATED : AUDIT_ACTIONS.PRODUCT_UPDATED,
                    target: { type: 'PRODUCT', id: productId, name: finalProduct.name },
                    financialData: { amount: finalProduct.price },
                    details: `${isNew ? 'Creado' : 'Actualizado'} producto: ${finalProduct.name} ($${finalProduct.price})`
                });
            } catch (err) {
                handleAppError(err, { context: "Error guardando producto en catálogo", showToast: true, rethrow: true });
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

        let deletedProduct = null;
        const currentProducts = await this.getProducts(businessId);
        deletedProduct = currentProducts.find(p => p.id === productId);

        if (isFirebaseAvailable && db) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productId));
                await auditLogger.logEvent({
                    businessId,
                    action: AUDIT_ACTIONS.PRODUCT_DELETED,
                    target: { type: 'PRODUCT', id: productId, name: deletedProduct?.name || 'Producto' },
                    details: `Eliminado producto de catálogo: ${deletedProduct?.name || productId}`
                });
            } catch (err) {
                handleAppError(err, { context: "Error eliminando producto del catálogo", showToast: true, rethrow: true });
            }
        }

        let currentList = await this.getProducts(businessId);
        currentList = currentList.filter(p => p.id !== productId);
        localStorage.setItem(`piu_products_${businessId}`, JSON.stringify(currentList));
        this.productsCache.set(businessId, currentList);

        return true;
    }

    // =========================================================================
    // 2. REGISTRO TRANSACCIONAL ATÓMICO CON IDEMPOTENCIA (VENTAS, ABONOS Y ANULACIONES)
    // =========================================================================

    /**
     * Registra una venta / consumo multi-producto o individual mediante runTransaction() atómico.
     * Cero riesgo de registros duplicados (Idempotencia) y actualización garantizada de saldos y auditoría.
     */
    async recordSale({
        businessId,
        playerId,
        playerUsername = '',
        playerName = '',
        playerPhone = '',
        items = [],
        customConcept = '',
        customPrice = 0,
        notes = '',
        paymentStatus = 'PAID', // 'PAID' o 'PENDING'
        paymentMethod = 'CASH', // 'CASH', 'CARD', 'TRANSFER', 'ACCOUNT_CREDIT'
        reservationId = null,
        createdBy = null,
        idempotencyKey = null
    }) {
        if (!businessId) throw new Error("Se requiere la sucursal (businessId) para registrar la venta.");
        if (!playerId) throw new Error("Se requiere seleccionar un cliente o registrar venta de mostrador.");

        // Validar conexión activa obligatoria (Política: Consulta offline SÍ, Operación monetaria NO)
        assertFinancialOnline();

        // Validar idempotencia en memoria rápida
        const finalIdempotencyKey = idempotencyKey || `idem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        if (this.processedIdempotencyKeys.has(finalIdempotencyKey)) {
            console.warn(`[IDEMPOTENCY_INTERCEPT] Petición duplicada interceptada: ${finalIdempotencyKey}`);
            throw new Error("Esta venta ya está siendo procesada o fue completada. Evitando cargo duplicado.");
        }
        this.processedIdempotencyKeys.add(finalIdempotencyKey);
        setTimeout(() => this.processedIdempotencyKeys.delete(finalIdempotencyKey), 10000); // Expiración 10s

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

        let finalConcept = '';
        if (finalItems.length === 1) {
            const it = finalItems[0];
            finalConcept = it.quantity > 1 ? `${it.name} x${it.quantity}` : it.name;
        } else if (finalItems.length > 1) {
            finalConcept = finalItems.map(it => `${it.name} x${it.quantity}`).join(', ');
        } else {
            finalConcept = customConcept || 'Consumo en sala';
        }

        // ID determinista de documento anclado a la clave de idempotencia
        const consumptionId = `csm_${finalIdempotencyKey}`;

        const newRecord = {
            id: consumptionId,
            idempotencyKey: finalIdempotencyKey,
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

        let resultingRecord = newRecord;

        // 2. EJECUCIÓN ATÓMICA CON runTransaction EN FIRESTORE (IDEMPOTENCIA GARANTIZADA)
        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    const consumptionRef = doc(db, COLLECTIONS.CONSUMPTIONS, consumptionId);

                    // Verificación de Idempotencia persistente en Firestore:
                    // Si la transacción ya existe (ej: reintento de red, doble clic tardío), abortar sin duplicar cobro
                    const existingTx = await transaction.get(consumptionRef);
                    if (existingTx.exists()) {
                        console.warn(`[IDEMPOTENCY_PERSISTED] Transacción ${consumptionId} ya existe en Firestore. Retornando registro original sin duplicar.`);
                        resultingRecord = existingTx.data();
                        return;
                    }

                    // A. Escribir el documento de consumo
                    transaction.set(consumptionRef, newRecord);

                    // B. Si es un jugador registrado, leer y actualizar saldo acumulado en la misma transacción
                    if (playerId && playerId !== 'guest_walkin') {
                        const playerRef = doc(db, COLLECTIONS.PLAYERS, playerId);
                        const playerDoc = await transaction.get(playerRef);

                        if (playerDoc.exists()) {
                            const playerData = playerDoc.data();
                            const accountsMap = playerData.accounts || {};
                            const curBizAccount = accountsMap[businessId] || { netDebt: 0, totalConsumed: 0 };

                            const newConsumed = (curBizAccount.totalConsumed || 0) + totalAmount;
                            const newDebt = paymentStatus === 'PENDING'
                                ? (curBizAccount.netDebt || 0) + totalAmount
                                : (curBizAccount.netDebt || 0);

                            accountsMap[businessId] = {
                                ...curBizAccount,
                                netDebt: Math.max(0, newDebt),
                                totalConsumed: newConsumed,
                                hasPendingDebt: newDebt > 0,
                                lastUpdated: nowIso
                            };

                            // C. Acreditación atómica de puntos de lealtad si fue pagado al contado
                            let updatedLoyaltyPoints = playerData.loyaltyPoints || 0;
                            const business = tenantManager.getBusinessById(businessId);
                            if (business && business.loyaltyEnabled && business.loyaltyMode !== 'VISITS' && paymentStatus === 'PAID') {
                                const ratio = Number(business.pointsRatio) || 10;
                                const ptsEarned = Math.floor(totalAmount / ratio);
                                if (ptsEarned > 0) {
                                    updatedLoyaltyPoints += ptsEarned;
                                }
                            }

                            transaction.update(playerRef, {
                                accounts: accountsMap,
                                loyaltyPoints: updatedLoyaltyPoints,
                                updatedAt: nowIso
                            });
                        }
                    }

                    // D. Inyectar auditoría inmutable en la misma transacción atómica
                    auditLogger.appendTransactionAudit(transaction, {
                        businessId,
                        action: AUDIT_ACTIONS.SALE_RECORDED,
                        target: { type: 'CONSUMPTION', id: consumptionId, name: finalConcept },
                        financialData: {
                            amount: totalAmount,
                            paymentMethod: newRecord.paymentMethod,
                            paymentStatus: newRecord.paymentStatus
                        },
                        details: `Venta registrada: "${finalConcept}" ($${totalAmount}) [${paymentStatus === 'PENDING' ? 'A Cuenta' : 'Pagado'}] por ${currentStaff}`
                    });
                });
            } catch (err) {
                handleAppError(err, { context: "Error en transacción atómica de venta", showToast: true, rethrow: true });
            }
        }

        // 3. Guardar en LocalStorage como respaldo
        const localKey = `piu_consumptions_${businessId}_${playerId}`;
        const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
        if (!localList.some(r => r.id === resultingRecord.id)) {
            localList.unshift(resultingRecord);
            localStorage.setItem(localKey, JSON.stringify(localList));
        }

        return resultingRecord;
    }

    /**
     * Mantiene retrocompatibilidad con recordConsumption.
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
     * Registra un Abono / Pago a la cuenta mediante runTransaction() atómico.
     * Actualiza el saldo vivo del jugador, descuenta adeudo y escribe el log inmutable.
     */
    async recordPayment({
        businessId,
        playerId,
        playerUsername = '',
        playerName = '',
        amount = 0,
        paymentMethod = 'CASH',
        notes = '',
        createdBy = null,
        idempotencyKey = null
    }) {
        if (!businessId || !playerId) throw new Error("Sucursal y jugador son requeridos para registrar un abono.");
        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) throw new Error("El monto del abono debe ser mayor a 0.");

        // Validar conexión activa obligatoria (Política: Consulta offline SÍ, Operación monetaria NO)
        assertFinancialOnline();

        const finalIdempotencyKey = idempotencyKey || `pay_idem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        if (this.processedIdempotencyKeys.has(finalIdempotencyKey)) {
            throw new Error("Este abono ya está siendo procesado. Evitando registro duplicado.");
        }
        this.processedIdempotencyKeys.add(finalIdempotencyKey);
        setTimeout(() => this.processedIdempotencyKeys.delete(finalIdempotencyKey), 10000);

        const currentStaff = createdBy || authManager.getCurrentUser()?.name || 'Encargado';
        const paymentId = `pay_${finalIdempotencyKey}`;
        const nowIso = new Date().toISOString();

        const paymentRecord = {
            id: paymentId,
            idempotencyKey: finalIdempotencyKey,
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

        let resultingRecord = paymentRecord;

        // Transacción Atómica de Abono con Idempotencia Persistente
        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    const paymentRef = doc(db, COLLECTIONS.CONSUMPTIONS, paymentId);

                    // Verificar si este abono ya fue procesado en Firestore (anti-doble cargo persistente)
                    const existingPayment = await transaction.get(paymentRef);
                    if (existingPayment.exists()) {
                        console.warn(`[IDEMPOTENCY_PERSISTED] Abono ${paymentId} ya existe en Firestore. Retornando registro original.`);
                        resultingRecord = existingPayment.data();
                        return;
                    }

                    transaction.set(paymentRef, paymentRecord);

                    if (playerId && playerId !== 'guest_walkin') {
                        const playerRef = doc(db, COLLECTIONS.PLAYERS, playerId);
                        const playerDoc = await transaction.get(playerRef);

                        if (playerDoc.exists()) {
                            const playerData = playerDoc.data();
                            const accountsMap = playerData.accounts || {};
                            const curBizAccount = accountsMap[businessId] || { netDebt: 0 };

                            const previousDebt = curBizAccount.netDebt || 0;
                            const newDebt = Math.max(0, previousDebt - numAmount);
                            const creditBalance = Math.max(0, numAmount - previousDebt);

                            accountsMap[businessId] = {
                                ...curBizAccount,
                                netDebt: newDebt,
                                creditBalance: creditBalance,
                                hasPendingDebt: newDebt > 0,
                                lastUpdated: nowIso
                            };

                            transaction.update(playerRef, {
                                accounts: accountsMap,
                                updatedAt: nowIso
                            });
                        }
                    }

                    auditLogger.appendTransactionAudit(transaction, {
                        businessId,
                        action: AUDIT_ACTIONS.PAYMENT_RECORDED,
                        target: { type: 'PLAYER_ACCOUNT', id: playerId, name: playerName },
                        financialData: {
                            amount: numAmount,
                            paymentMethod: paymentRecord.paymentMethod,
                            paymentStatus: 'PAID'
                        },
                        details: `Abono de $${numAmount} registrado por ${currentStaff} para ${playerName}`
                    });
                });
            } catch (err) {
                handleAppError(err, { context: "Error en transacción atómica de abono", showToast: true, rethrow: true });
            }
        }

        const localKey = `piu_consumptions_${businessId}_${playerId}`;
        const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
        if (!localList.some(r => r.id === resultingRecord.id)) {
            localList.unshift(resultingRecord);
            localStorage.setItem(localKey, JSON.stringify(localList));
        }

        return resultingRecord;
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
     * ANULACIÓN FORMAL DE MOVIMIENTO (Consumo o Abono).
     * Reemplaza por completo el borrado físico (deleteDoc).
     * Marca el estado a 'VOIDED', guarda motivo/autor y revierte el impacto financiero de forma atómica.
     */
    async voidTransaction(businessId, playerId, transactionId, { reason = 'Anulación autorizada por encargado', actor = null } = {}) {
        if (!businessId || !transactionId) throw new Error("Datos insuficientes para anular la transacción.");
        if (!reason || !reason.trim()) throw new Error("Se requiere especificar un motivo claro para la anulación.");

        // Validar conexión activa obligatoria (Política: Consulta offline SÍ, Operación monetaria NO)
        assertFinancialOnline();

        const currentStaff = actor || authManager.getCurrentUser()?.name || 'Encargado';
        const nowIso = new Date().toISOString();

        if (isFirebaseAvailable && db) {
            try {
                await runTransaction(db, async (transaction) => {
                    const txRef = doc(db, COLLECTIONS.CONSUMPTIONS, transactionId);
                    const txDoc = await transaction.get(txRef);

                    if (!txDoc.exists()) {
                        throw new Error("La transacción no existe en la base de datos.");
                    }

                    const txData = txDoc.data();
                    if (txData.status === 'VOIDED' || txData.status === 'CANCELLED') {
                        throw new Error("Esta transacción ya se encuentra anulada previamente.");
                    }

                    // 1. Marcar como VOIDED (Inmutable en historial)
                    transaction.update(txRef, {
                        status: 'VOIDED',
                        voidReason: reason.trim(),
                        voidedAt: nowIso,
                        voidedBy: currentStaff,
                        updatedAt: nowIso
                    });

                    // 2. Revertir impacto en la cuenta del jugador
                    if (playerId && playerId !== 'guest_walkin') {
                        const playerRef = doc(db, COLLECTIONS.PLAYERS, playerId);
                        const playerDoc = await transaction.get(playerRef);

                        if (playerDoc.exists()) {
                            const playerData = playerDoc.data();
                            const accountsMap = playerData.accounts || {};
                            const curBizAccount = accountsMap[businessId] || { netDebt: 0, totalConsumed: 0 };
                            const amount = Number(txData.totalAmount) || 0;

                            let newDebt = curBizAccount.netDebt || 0;
                            let newConsumed = curBizAccount.totalConsumed || 0;

                            if (txData.type === 'ABONO') {
                                // Si se anula un abono, se RESTAURA la deuda que había sido amortizada
                                newDebt += amount;
                            } else {
                                // Si se anula un consumo
                                newConsumed = Math.max(0, newConsumed - amount);
                                if (txData.paymentStatus === 'PENDING') {
                                    newDebt = Math.max(0, newDebt - amount);
                                }
                            }

                            accountsMap[businessId] = {
                                ...curBizAccount,
                                netDebt: Math.max(0, newDebt),
                                totalConsumed: newConsumed,
                                hasPendingDebt: newDebt > 0,
                                lastUpdated: nowIso
                            };

                            transaction.update(playerRef, {
                                accounts: accountsMap,
                                updatedAt: nowIso
                            });
                        }
                    }

                    // 3. Registrar auditoría obligatoria de la anulación
                    auditLogger.appendTransactionAudit(transaction, {
                        businessId,
                        action: AUDIT_ACTIONS.TRANSACTION_VOIDED,
                        target: { type: 'CONSUMPTION', id: transactionId, name: txData.concept || 'Movimiento' },
                        financialData: {
                            amount: txData.totalAmount,
                            paymentMethod: txData.paymentMethod,
                            paymentStatus: txData.paymentStatus
                        },
                        details: `Transacción ${transactionId} ($${txData.totalAmount}) ANULADA por ${currentStaff}. Motivo: "${reason.trim()}"`
                    });
                });
            } catch (err) {
                handleAppError(err, { context: "Error al anular transacción en base de datos", showToast: true, rethrow: true });
            }
        }

        // Actualizar caché local
        if (playerId) {
            const localKey = `piu_consumptions_${businessId}_${playerId}`;
            const localList = JSON.parse(localStorage.getItem(localKey) || '[]');
            const idx = localList.findIndex(t => t.id === transactionId);
            if (idx !== -1) {
                localList[idx].status = 'VOIDED';
                localList[idx].voidReason = reason.trim();
                localList[idx].voidedAt = nowIso;
                localList[idx].voidedBy = currentStaff;
                localStorage.setItem(localKey, JSON.stringify(localList));
            }
        }

        return true;
    }

    /**
     * Alias de retrocompatibilidad que redirige a voidTransaction garantizando que NUNCA se borren datos.
     */
    async cancelTransaction(businessId, playerId, transactionId, reason = 'Cancelado por el encargado') {
        return this.voidTransaction(businessId, playerId, transactionId, { reason });
    }

    /**
     * Alias de seguridad: redirige deleteTransaction a anulación inmutable en lugar de borrado físico.
     */
    async deleteTransaction(businessId, playerId, transactionId, reason = 'Anulación solicitada por encargado') {
        console.warn(`[INMUTABILITY_GUARD] Redirigiendo deleteTransaction a anulación formal (VOIDED) para ID: ${transactionId}`);
        return this.voidTransaction(businessId, playerId, transactionId, { reason });
    }

    // =========================================================================
    // 3. CONSULTAS, ESTADO DE CUENTA Y RESÚMENES (EXCLUSIÓN DE ANULACIONES)
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
                handleAppError(err, { context: "Error consultando transacciones de jugador", showToast: false });
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
     * Excluye estrictamente las transacciones CANCELLED y VOIDED del cálculo de saldo vivo.
     */
    async getPlayerAccount(businessId, playerId) {
        const transactions = await this.getPlayerTransactions(businessId, playerId);
        const activeTx = transactions.filter(t => t.status !== 'CANCELLED' && t.status !== 'VOIDED');

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
            netDebt,          // Deuda pendiente acumulada viva
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
                handleAppError(err, { context: "Error cargando movimientos del negocio", showToast: false });
            }
        }

        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Filtros en memoria
        if (playerId) {
            list = list.filter(t => t.playerId === playerId);
        }

        if (status === 'PAID') {
            list = list.filter(t => t.type === 'CONSUMO' && t.paymentStatus === 'PAID' && t.status !== 'CANCELLED' && t.status !== 'VOIDED');
        } else if (status === 'PENDING') {
            list = list.filter(t => t.type === 'CONSUMO' && t.paymentStatus === 'PENDING' && t.status !== 'CANCELLED' && t.status !== 'VOIDED');
        } else if (status === 'ABONO') {
            list = list.filter(t => t.type === 'ABONO' && t.status !== 'CANCELLED' && t.status !== 'VOIDED');
        } else if (status === 'VOIDED' || status === 'CANCELLED') {
            list = list.filter(t => t.status === 'CANCELLED' || t.status === 'VOIDED');
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
     * Calcula el resumen integral de Cuenta Fácil para la sucursal activa.
     */
    async getDebtorsSummary(businessId) {
        if (!businessId) return { totalReceivableDebt: 0, totalDebtorsCount: 0, totalCreditSales: 0, debtorsList: [] };

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
                handleAppError(err, { context: "Error consultando resumen de deudores", showToast: false });
            }
        }

        const activeTx = allTransactions.filter(t => t.status !== 'CANCELLED' && t.status !== 'VOIDED');
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
            handleAppError(err, { context: "Error sincronizando resumen de cuenta en perfil", showToast: false });
        }
    }
}

export const accountManager = new AccountManager();
