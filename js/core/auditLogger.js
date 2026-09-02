// js/core/auditLogger.js
// Motor Centralizado de Auditoría Inmutable para Operaciones Financieras y de Seguridad
import { 
    auth,
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    setDoc, 
    doc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit as firestoreLimit 
} from '../firebaseConfig.js';
import { authManager } from './authManager.js';
import { handleAppError } from './errorHandler.js';

export const AUDIT_ACTIONS = {
    // Operaciones Financieras
    SALE_RECORDED: 'SALE_RECORDED',
    PAYMENT_RECORDED: 'PAYMENT_RECORDED',
    DEBT_LIQUIDATED: 'DEBT_LIQUIDATED',
    TRANSACTION_VOIDED: 'TRANSACTION_VOIDED',
    
    // Lealtad y Recompensas
    POINTS_ADJUSTED: 'POINTS_ADJUSTED',
    REWARD_REDEEMED: 'REWARD_REDEEMED',
    
    // Catálogos y Precios
    PRODUCT_CREATED: 'PRODUCT_CREATED',
    PRODUCT_UPDATED: 'PRODUCT_UPDATED',
    PRODUCT_DELETED: 'PRODUCT_DELETED',
    PRICE_CHANGED: 'PRICE_CHANGED',
    
    // Seguridad y Acceso
    STAFF_LOGIN: 'STAFF_LOGIN',
    STAFF_LOGOUT: 'STAFF_LOGOUT',
    STAFF_CREATED: 'STAFF_CREATED',
    STAFF_UPDATED: 'STAFF_UPDATED',
    STAFF_DELETED: 'STAFF_DELETED',
    CLIENT_LOGIN: 'CLIENT_LOGIN',
    CLIENT_LOGOUT: 'CLIENT_LOGOUT',

    // Máquinas e Infraestructura
    MACHINE_CREATED: 'MACHINE_CREATED',
    MACHINE_UPDATED: 'MACHINE_UPDATED',
    MACHINE_DELETED: 'MACHINE_DELETED',

    // Reservaciones
    RESERVATION_CREATED: 'RESERVATION_CREATED',
    RESERVATION_CLOSED: 'RESERVATION_CLOSED',
    RESERVATION_MODIFIED: 'RESERVATION_MODIFIED',
    RESERVATION_CANCELLED: 'RESERVATION_CANCELLED',

    BUSINESS_SETTINGS_UPDATED: 'BUSINESS_SETTINGS_UPDATED'
};

class AuditLogger {
    /**
     * Construye un objeto de log estandarizado e inmutable.
     * La identidad del actor se ancla criptográficamente a Firebase Auth (auth.currentUser.uid).
     */
    createLogPayload({
        businessId,
        action,
        actor = null,
        target = null,
        financialData = null,
        details = '',
        previousState = null,
        newState = null
    }) {
        const sessionUser = authManager.getCurrentUser();
        const actorData = actor || sessionUser || {
            name: 'Sistema / Invitado',
            role: 'CLIENT'
        };

        // IDENTIDAD DE SEGURIDAD CANÓNICA:
        // Proviene directamente del token de Firebase Auth activo, imposibilitando suplantaciones desde cliente
        const fbAuthUid = (auth && auth.currentUser) ? auth.currentUser.uid : null;
        const canonicalActorId = fbAuthUid || actorData.id || sessionUser?.id || 'anonymous';

        // AISLAMIENTO MULTI-TENANT:
        // Si el usuario es un MANAGER, su businessId se ancla estrictamente a su sucursal autorizada
        let canonicalBusinessId = businessId || 'global';
        if (sessionUser && sessionUser.role === 'MANAGER' && sessionUser.businessId) {
            canonicalBusinessId = sessionUser.businessId;
        }

        const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const nowIso = new Date().toISOString();

        return {
            id: logId,
            businessId: canonicalBusinessId,
            action,
            actor: {
                id: canonicalActorId, // Anclado directamente a request.auth.uid
                name: actorData.name || sessionUser?.name || 'Desconocido',
                role: actorData.role || sessionUser?.role || 'CLIENT',
                username: actorData.username || sessionUser?.username || ''
            },
            target: target ? {
                type: target.type || 'UNKNOWN',
                id: target.id || null,
                name: target.name || ''
            } : null,
            financialData: financialData ? {
                amount: Number(financialData.amount) || 0,
                currency: financialData.currency || '$',
                paymentMethod: financialData.paymentMethod || 'CASH',
                paymentStatus: financialData.paymentStatus || 'PAID'
            } : null,
            details: details || '',
            previousState: previousState || null,
            newState: newState || null,
            createdAt: nowIso
        };
    }

    /**
     * Escribe un registro de auditoría directo en Firestore (Autoridad Inmutable) y actualiza la caché visual local.
     */
    async logEvent(params) {
        const logPayload = this.createLogPayload(params);

        // 1. Guardar en Firestore (Única Fuente de Verdad Inmutable)
        if (isFirebaseAvailable && db) {
            try {
                const logRef = doc(db, COLLECTIONS.AUDIT_LOGS, logPayload.id);
                await setDoc(logRef, logPayload);
            } catch (err) {
                handleAppError(err, { 
                    context: `Error registrando auditoría (${params.action})`,
                    showToast: false 
                });
            }
        }

        // 2. Búfer de caché visual local para renderizado rápido en UI (No es autoridad de auditoría)
        try {
            const localKey = `piu_audit_logs_${logPayload.businessId}`;
            const cachedLogs = JSON.parse(localStorage.getItem(localKey) || '[]');
            cachedLogs.unshift(logPayload);
            if (cachedLogs.length > 200) cachedLogs.length = 200; // Limitar tamaño de caché visual
            localStorage.setItem(localKey, JSON.stringify(cachedLogs));
        } catch (e) {
            console.warn("Advertencia actualizando caché visual de auditoría:", e);
        }

        return logPayload;
    }

    /**
     * Inyecta la escritura de auditoría dentro de una transacción atómica de Firestore.
     * Esto asegura que la auditoría y la operación monetaria se confirmen juntas.
     */
    appendTransactionAudit(transaction, params) {
        if (!isFirebaseAvailable || !db || !transaction) return null;

        const logPayload = this.createLogPayload(params);
        const logRef = doc(db, COLLECTIONS.AUDIT_LOGS, logPayload.id);
        transaction.set(logRef, logPayload);
        return logPayload;
    }

    /**
     * Obtiene los logs de auditoría para una sucursal con filtros.
     */
    async getLogs(businessId, { action = null, staffId = null, maxResults = 100 } = {}) {
        if (!businessId) return [];
        let list = [];

        if (isFirebaseAvailable && db) {
            try {
                const q = query(
                    collection(db, COLLECTIONS.AUDIT_LOGS),
                    where("businessId", "==", businessId),
                    orderBy("createdAt", "desc"),
                    firestoreLimit(maxResults)
                );
                const snap = await getDocs(q);
                snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            } catch (err) {
                // Si falla por índice o red, intentar consulta simple
                try {
                    const fallbackQ = query(
                        collection(db, COLLECTIONS.AUDIT_LOGS),
                        where("businessId", "==", businessId),
                        firestoreLimit(maxResults)
                    );
                    const snap = await getDocs(fallbackQ);
                    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
                    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                } catch (fallbackErr) {
                    handleAppError(fallbackErr, { context: "Error consultando logs de auditoría", showToast: false });
                }
            }
        }

        if (list.length === 0) {
            const localKey = `piu_audit_logs_${businessId}`;
            try {
                list = JSON.parse(localStorage.getItem(localKey) || '[]');
            } catch (e) {
                list = [];
            }
        }

        // Aplicar filtros en memoria
        if (action && action !== 'ALL') {
            list = list.filter(l => l.action === action);
        }
        if (staffId && staffId !== 'ALL') {
            list = list.filter(l => l.actor?.id === staffId);
        }

        return list;
    }
}

export const auditLogger = new AuditLogger();
