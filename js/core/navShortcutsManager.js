// js/core/navShortcutsManager.js
// Gestor de Accesos Directos Personalizados para la Barra de Staff (v1.6.0)

export const STAFF_MODULES = [
    {
        id: 'ACCOUNTS',
        viewId: 'ACCOUNTS',
        title: 'Cuenta Fácil',
        icon: '💳',
        description: 'Caja rápida, cuentas por cobrar, fiados y abonos',
        defaultPinned: true,
        requiresSuperAdmin: false
    },
    {
        id: 'CLIENTS',
        viewId: 'CLIENTS',
        title: 'Jugadores',
        icon: '👥',
        description: 'Directorio, perfiles y lealtad de clientes',
        defaultPinned: true,
        requiresSuperAdmin: false
    },
    {
        id: 'REQUESTS',
        viewId: 'REQUESTS',
        title: 'Solicitudes',
        icon: '📥',
        description: 'Bandeja de reservaciones en revisión',
        defaultPinned: true,
        requiresSuperAdmin: false,
        hasCounter: true
    },
    {
        id: 'ANALYTICS',
        viewId: 'ANALYTICS',
        title: 'Rendimiento',
        icon: '📈',
        description: 'Ingresos, horas jugadas, ocupación y comisiones',
        defaultPinned: false,
        requiresSuperAdmin: false
    },
    {
        id: 'BUSINESS',
        viewId: 'BUSINESS',
        title: 'Ajustes',
        icon: '⚙️',
        description: 'Horarios, reglas de anticipo, marca y lealtad',
        defaultPinned: false,
        requiresSuperAdmin: false
    },
    {
        id: 'CATALOGS',
        viewId: 'CATALOGS',
        title: 'Catálogos',
        icon: '🛍️',
        description: 'Precios en sala, gabinetes y versiones PIU',
        defaultPinned: false,
        requiresSuperAdmin: false
    },
    {
        id: 'SUPERADMIN',
        viewId: 'SUPERADMIN',
        title: 'Consola Global',
        icon: '👑',
        description: 'Gestión de sucursales globales y personal',
        defaultPinned: false,
        requiresSuperAdmin: true
    }
];

class NavShortcutsManager {
    constructor() {
        this.STORAGE_KEY_PREFIX = 'piu_staff_shortcuts_';
    }

    /**
     * Retorna la lista completa de módulos disponibles según permisos
     */
    getAvailableModules(isSuperAdmin = false) {
        return STAFF_MODULES.filter(m => !m.requiresSuperAdmin || isSuperAdmin);
    }

    /**
     * Obtiene los IDs de los módulos anclados en la barra fija del staff
     */
    getPinnedShortcuts(userId = 'default', isSuperAdmin = false) {
        const available = this.getAvailableModules(isSuperAdmin);
        const availableIds = new Set(available.map(m => m.id));

        try {
            const raw = localStorage.getItem(`${this.STORAGE_KEY_PREFIX}${userId}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Filtrar solo los que siguen estando disponibles
                    const valid = parsed.filter(id => availableIds.has(id));
                    if (valid.length > 0) return valid;
                }
            }
        } catch (e) {
            console.warn("Error leyendo accesos directos personalizados:", e);
        }

        // Si no hay configuración previa, retornar los fijados por defecto
        return available.filter(m => m.defaultPinned).map(m => m.id);
    }

    /**
     * Guarda la selección de accesos directos fijados
     */
    savePinnedShortcuts(userId = 'default', shortcutsArray = []) {
        try {
            localStorage.setItem(`${this.STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(shortcutsArray));
            return true;
        } catch (e) {
            console.error("Error guardando accesos directos:", e);
            return false;
        }
    }

    /**
     * Restablece los accesos directos a los valores predeterminados
     */
    resetToDefaults(userId = 'default') {
        try {
            localStorage.removeItem(`${this.STORAGE_KEY_PREFIX}${userId}`);
            return true;
        } catch (e) {
            console.error("Error restableciendo accesos directos:", e);
            return false;
        }
    }
}

export const navShortcutsManager = new NavShortcutsManager();
