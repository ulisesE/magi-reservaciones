// js/core/securityUtils.js
// Utilidades de seguridad para la sanitización y prevención de ataques de inyección (XSS)

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
