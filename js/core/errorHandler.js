// js/core/errorHandler.js
// Manejador centralizado y transparente de errores de Firebase, Firestore y Conectividad
import { toast } from '../components/toast.js';

export const ERROR_MAPPINGS = {
    'permission-denied': 'Acceso denegado: Las reglas de seguridad rechazaron la operación. No tienes permisos para modificar estos datos en esta sucursal.',
    'unauthenticated': 'Sesión no autenticada: Tu sesión expiró o no ha sido validada por el servidor. Por favor inicia sesión nuevamente.',
    'unavailable': 'Servicio no disponible: No hay conexión con los servidores de Firestore. Verifica tu conexión a internet.',
    'failed-precondition': 'Conflicto de concurrencia: La información fue actualizada por otro usuario o la condición previa falló. Intenta de nuevo.',
    'aborted': 'Transacción abortada: Se detectó un conflicto de escritura o un intento de registro duplicado.',
    'already-exists': 'El registro ya existe en el sistema y no puede duplicarse.',
    'not-found': 'El documento o registro solicitado no existe o fue eliminado.',
    'resource-exhausted': 'Límite de peticiones alcanzado. Espera un momento antes de reintentar.',
    'invalid-argument': 'Parámetros o datos inválidos para la operación solicitada.',
    'deadline-exceeded': 'Tiempo de espera agotado al conectar con el servidor. Reintenta la operación.',
    'auth/invalid-credential': 'Credenciales incorrectas. Verifica tu usuario y PIN.',
    'auth/user-not-found': 'Usuario no registrado en el sistema.',
    'auth/wrong-password': 'PIN o clave incorrecta.',
    'auth/network-request-failed': 'Error de red al intentar autenticar con Firebase.',
    'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde.'
};

/**
 * Traduce un error de Firebase/JavaScript a un mensaje claro y comprensible para el usuario.
 * @param {Error|object|string} error 
 * @param {string} [contextMessage] 
 * @returns {string} Mensaje traducido
 */
export function formatErrorMessage(error, contextMessage = '') {
    if (!error) return contextMessage || 'Ocurrió un error inesperado.';

    const code = error.code || '';
    const rawMessage = error.message || String(error);

    // 1. Buscar coincidencia exacta por código
    if (code && ERROR_MAPPINGS[code]) {
        return contextMessage ? `${contextMessage}: ${ERROR_MAPPINGS[code]}` : ERROR_MAPPINGS[code];
    }

    // 2. Buscar por coincidencia parcial en el mensaje
    for (const [key, translated] of Object.entries(ERROR_MAPPINGS)) {
        if (rawMessage.toLowerCase().includes(key.toLowerCase())) {
            return contextMessage ? `${contextMessage}: ${translated}` : translated;
        }
    }

    // 3. Errores de validación de negocio
    if (rawMessage.includes('Se requiere') || rawMessage.includes('obligatorio') || rawMessage.includes('debe ser mayor')) {
        return rawMessage;
    }

    // 4. Fallback con contexto
    return contextMessage ? `${contextMessage}: ${rawMessage}` : `Error: ${rawMessage}`;
}

/**
 * Procesa un error de forma transparente:
 * 1. Muestra toast al usuario con el mensaje traducido.
 * 2. Emite log técnico detallado en consola con el stack trace.
 * 3. Lanza el error hacia arriba si shouldRethrow es true.
 * 
 * @param {Error|object|string} error 
 * @param {object} options
 * @param {string} [options.context] - Contexto de la operación (ej: "Error al registrar venta")
 * @param {boolean} [options.showToast=true] - Si debe emitir un toast de error a la UI
 * @param {boolean} [options.rethrow=false] - Si debe relanzar el error
 * @returns {string} El mensaje formateado
 */
export function handleAppError(error, { context = '', showToast = true, rethrow = false } = {}) {
    const formatted = formatErrorMessage(error, context);

    // Registro técnico obligatorio para diagnóstico y depuración
    console.error(`🚨 [MAGI_ERROR] [${new Date().toISOString()}] ${context || 'Operación Fallida'}:`, {
        code: error?.code,
        message: error?.message || error,
        stack: error?.stack,
        rawError: error
    });

    if (showToast && typeof toast !== 'undefined' && toast?.error) {
        toast.error(formatted);
    }

    if (rethrow) {
        throw (error instanceof Error) ? error : new Error(formatted);
    }

    return formatted;
}
