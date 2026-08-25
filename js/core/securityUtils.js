// js/core/securityUtils.js
// Utilidades de seguridad para la sanitización, prevención de XSS y protección criptográfica de credenciales

const PIN_SALT = "piu_hub_sec_salt_2026";

/**
 * Genera un hash criptográfico SHA-256 a partir de un PIN o contraseña con salt.
 * @param {string} pin - El PIN o contraseña a hashear.
 * @param {string} [salt] - Salt opcional para fortalecer el hash.
 * @returns {Promise<string>} Cadena hexadecimal del hash.
 */
export async function hashPin(pin, salt = PIN_SALT) {
    if (!pin) return "";
    const cleanPin = String(pin).trim();
    const encoder = new TextEncoder();
    const data = encoder.encode(`${salt}:${cleanPin}:${salt}`);
    
    if (window.crypto && window.crypto.subtle) {
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        return `sha256_${hashHex}`;
    } else {
        // Fallback matemático básico para entornos sin Web Crypto API
        let hash = 0;
        const str = `${salt}:${cleanPin}:${salt}`;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return `fallback_${Math.abs(hash).toString(16)}`;
    }
}

/**
 * Verifica si un PIN ingresado coincide con un PIN almacenado (sea hash seguro o legado).
 * @param {string} inputPin - El PIN ingresado por el usuario.
 * @param {string} storedPinOrHash - El valor almacenado (hash o PIN anterior).
 * @returns {Promise<boolean>} true si coincide, false si no.
 */
export async function verifyPin(inputPin, storedPinOrHash) {
    if (!inputPin || !storedPinOrHash) return false;
    const cleanInput = String(inputPin).trim();
    const stored = String(storedPinOrHash).trim();

    // 1. Si está almacenado como hash SHA-256
    if (stored.startsWith("sha256_") || stored.startsWith("fallback_")) {
        const inputHash = await hashPin(cleanInput);
        return inputHash === stored;
    }

    // 2. Soporte de compatibilidad temporal para PINs legados en texto plano
    return cleanInput === stored;
}

/**
 * Elimina credenciales sensibles (PIN, pinHash, tokens) antes de guardar el usuario en LocalStorage o exponerlo a la UI.
 * @param {object} user - Objeto de usuario.
 * @returns {object} Objeto de usuario sanitizado sin campos sensibles.
 */
export function sanitizeUserSession(user) {
    if (!user || typeof user !== "object") return null;
    const clean = { ...user };
    delete clean.pin;
    delete clean.pinHash;
    delete clean.password;
    return clean;
}

/**
 * Escapa caracteres especiales HTML para prevenir la inyección de código (XSS).
 * Convierte &, <, >, ", y ' a sus entidades HTML seguras correspondientes.
 * 
 * @param {any} val - El valor que se quiere sanitizar.
 * @returns {string} El valor sanitizado en formato string.
 */
export function escapeHTML(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str.replace(/[&<>"']/g, function(m) {
        switch (m) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return m;
        }
    });
}

