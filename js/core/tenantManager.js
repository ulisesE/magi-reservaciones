// js/core/tenantManager.js
// Gestor de negocios / sucursales (Multi-tenant modular con eliminación en cascada)
import { 
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    setDoc, 
    getDoc,
    doc, 
    updateDoc, 
    deleteDoc,
    onSnapshot,
    runTransaction,
    query,
    where,
    canMakeFirestoreRead,
    markQuotaExhausted
} from '../firebaseConfig.js';
import { auditLogger, AUDIT_ACTIONS } from './auditLogger.js';

const TENANTS_STORAGE_KEY = 'piu_system_tenants_v1';
const ACTIVE_TENANT_STORAGE_KEY = 'piu_active_tenant_id_v1';
const SESSION_LOCKED_KEY = 'piu_session_local_locked_v1';

export const DEFAULT_BUSINESS_MODULES = {
    accounts: true,      // Cuenta Fácil (POS & Fiados)
    clients: true,       // Directorio de Jugadores
    loyalty: true,       // Programa de Lealtad y Recompensas
    requests: true,      // Bandeja de Solicitudes
    analytics: true,    // Rendimiento y Analítica
    business: true,     // Ajustes de Sucursal por Encargado
    catalogs: true,     // Catálogos en Sala & Productos
    calendarWeek: true, // Vista Semanal
    calendarMonth: true,// Vista Mensual
    machines: true,     // Ficha de Máquinas
    myProfile: true,    // Portal Mi Perfil (Gamer Pass)
    versus: true        // Retas PVP & Arena Matchmaking
};

// Negocios iniciales predeterminados (Seed data en memoria)
export const DEFAULT_BUSINESSES = [
    {
        id: 'biz_1786567885850',
        name: 'X-Games',
        tagline: 'BARcade CLUB  local al publico',
        city: 'NEZAHUALCOYOTL',
        address: 'Jorge Jiménez Cantú 32, Ejidos de San Agustin, 56344 Cdad. Nezahualcóyotl, Méx',
        phone: '5585481784',
        whatsapp: '5585481784',
        mapsUrl: 'https://maps.app.goo.gl/RBHt62CE89EmdhCT8',
        facebookUrl: 'https://www.facebook.com/share/1KT9TURdQD/',
        instagramUrl: '',
        currency: 'MXN',
        currencySymbol: '$',
        themeId: 'phoenix',
        themeColor: '#ff7b00',
        logoIcon: '🕹️',
        imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTv7tSyFGQUwEKjIK9i4PvQL0O_jZ8DcBLTwmlY0EHKEA&s=10',
        openingTime: '10:00',
        closingTime: '00:00',
        slotDuration: 30,
        maxAdvanceDays: 7,
        minCancelNoticeHours: 4,
        maxActiveBookingsPerUser: 3,
        requiresDeposit: true,
        depositPercentage: 50,
        paymentInstructions: '',
        rules: '',
        wifiNetwork: '',
        wifiPassword: '',
        isActive: true,
        status: 'ACTIVE',
        allowClientCancellation: false,
        disableChangeLocal: false,
        loyaltyEnabled: true,
        loyaltyMode: 'VISITS',
        loyaltyDiscountType: 'PERMANENT',
        pointsRatio: 10,
        hasSeededOvernightSchedule: true,
        blockedUsers: [],
        enabledModules: { ...DEFAULT_BUSINESS_MODULES },
        operatingHours: {
            0: { open: '10:00', close: '00:00', closed: false },
            1: { open: '10:00', close: '00:00', closed: false },
            2: { open: '10:00', close: '00:00', closed: false },
            3: { open: '10:00', close: '00:00', closed: false },
            4: { open: '10:00', close: '00:00', closed: false },
            5: { open: '10:00', close: '03:00', closed: false },
            6: { open: '10:00', close: '03:00', closed: false }
        },
        customRates: [],
        createdAt: '2026-08-12T20:51:25.850Z'
    },
    {
        id: 'biz_1786547370675',
        name: 'SKY GAMES',
        tagline: 'Arcade & Rhythm Gaming Center',
        city: 'CDMX, Tlahuac.',
        address: 'Diego cayetano, San sebastian, Tláhuac',
        phone: '5573989585',
        whatsapp: '5573989585',
        mapsUrl: 'https://maps.app.goo.gl/fDq8HPCc6y4jo2KF8?g_st=ac',
        facebookUrl: 'https://www.facebook.com/share/1EpEWLvDfr/',
        instagramUrl: '',
        currency: 'MXN',
        currencySymbol: '$',
        themeId: 'xx',
        themeColor: '#bd00ff',
        logoIcon: '🐺',
        imageUrl: 'https://res.cloudinary.com/w3k9lgf8/image/upload/f_auto,q_auto/207697',
        openingTime: '16:00',
        closingTime: '23:00',
        slotDuration: 30,
        maxAdvanceDays: 60,
        minCancelNoticeHours: 24,
        maxActiveBookingsPerUser: 10,
        requiresDeposit: false,
        depositPercentage: 50,
        paymentInstructions: 'Mercado Pago\nGuadalupe Vargas Aguilar\n5428785985692432',
        rules: '⚠️ AVISOS IMPORTANTES ⚠️\n1. Pregunten primero si se les puede fiar antes de pedir. De caso contrario se les cobrará $15 pesos diarios hasta que liquiden su cuenta. \n2. Recuerden tirar sus latas y botellas en las bolsas de atrás APLASTENLAS (a lado de los cartones de cerveza) \n3. Se les cobrará el tiempo que reserven, sin importar si no llegan, si llegan tarde, si se cansaron y se bajaron antes, sea cual sea la razón, SE LES COBRARÁ EL TIEMPO QUE RESERVEN.\n4. Recuerden avisar cuando suban a jugar y cuando bajen (aún más si quieres jugar sin haber reservado)\n5. Precio PHOENIX 2\n$80 la hora x persona\n$130 la hora x 2 personas  \nMOD\n$60 la hora x persona \n$50 la hora x persona desde 2 hora en adelante',
        wifiNetwork: '',
        wifiPassword: '',
        isActive: true,
        status: 'ACTIVE',
        allowClientCancellation: false,
        disableChangeLocal: false,
        loyaltyEnabled: true,
        loyaltyMode: 'VISITS',
        loyaltyDiscountType: 'ONCE',
        pointsRatio: 10,
        hasSeededOvernightSchedule: true,
        loyaltyTiers: {
            BRONCE: { minVisits: 0, minPoints: 0, discount: 0 },
            PLATA: { minVisits: 10, minPoints: 100, discount: 0.05 },
            ORO: { minVisits: 20, minPoints: 200, discount: 0.1 },
            PLATINO: { minVisits: 30, minPoints: 300, discount: 0.15 }
        },
        blockedUsers: [],
        enabledModules: { ...DEFAULT_BUSINESS_MODULES },
        operatingHours: {
            0: { open: '12:00', close: '21:00', closed: false },
            1: { open: '16:00', close: '23:00', closed: false },
            2: { open: '16:00', close: '23:00', closed: false },
            3: { open: '16:00', close: '23:00', closed: false },
            4: { open: '16:00', close: '23:00', closed: false },
            5: { open: '16:00', close: '23:00', closed: false },
            6: { open: '12:00', close: '02:00', closed: false }
        },
        customRates: [],
        createdAt: '2026-08-12T15:09:30.675Z'
    },
    {
        id: 'biz_1787248656226',
        name: 'Eugenia Games',
        tagline: 'Arcade & Rhythm Gaming Center',
        city: 'CDMX, Benito Juárez',
        address: 'Anaxágoras 744, Mexico City, Mexico, 03020',
        phone: '5536556657',
        whatsapp: '5536556657',
        mapsUrl: 'https://maps.app.goo.gl/ThZKFhknFhApH95y6',
        facebookUrl: 'https://www.facebook.com/profile.php?id=61573162676214&mibextid=ZbWKwL',
        instagramUrl: 'https://www.instagram.com/eugenia_games_?igsi=MWxqZ28zNGd1bXV4aQ==',
        currency: 'MXN',
        currencySymbol: '$',
        themeId: 'prime',
        themeColor: '#ff2a5f',
        logoIcon: '🦆',
        imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTh3Curm-Q1DtqEjHNvpciOG78ZZOjX_4Whs_7P4oVVkQ&s=10',
        openingTime: '09:00',
        closingTime: '23:00',
        slotDuration: 30,
        maxAdvanceDays: 14,
        minCancelNoticeHours: 24,
        maxActiveBookingsPerUser: 3,
        requiresDeposit: false,
        depositPercentage: 50,
        paymentInstructions: 'Rosendo Alberto Zárate Escorza \nBanco BBVA \nCuenta Clave: 012 180 015233774909\nCuenta: 152 337 7490',
        rules: '',
        wifiNetwork: '',
        wifiPassword: '',
        isActive: true,
        status: 'ACTIVE',
        allowClientCancellation: false,
        disableChangeLocal: false,
        loyaltyEnabled: false,
        loyaltyMode: 'POINTS',
        loyaltyDiscountType: 'PERMANENT',
        pointsRatio: 10,
        hasSeededOvernightSchedule: true,
        blockedUsers: [],
        enabledModules: {
            ...DEFAULT_BUSINESS_MODULES,
            accounts: false,
            catalogs: false,
            analytics: false,
            loyalty: false
        },
        operatingHours: {
            0: { open: '09:00', close: '23:00', closed: false },
            1: { open: '09:00', close: '23:00', closed: false },
            2: { open: '09:00', close: '23:00', closed: false },
            3: { open: '09:00', close: '23:00', closed: false },
            4: { open: '09:00', close: '23:00', closed: false },
            5: { open: '09:00', close: '23:00', closed: false },
            6: { open: '09:00', close: '23:00', closed: false }
        },
        customRates: [],
        createdAt: '2026-08-20T17:57:36.226Z'
    },
    {
        id: 'biz_1786986908881',
        name: 'DemoApp',
        tagline: 'Arcade & Rhythm Gaming Center',
        city: 'CDMX',
        address: '',
        phone: '',
        whatsapp: '1122334455',
        mapsUrl: '',
        facebookUrl: '',
        instagramUrl: '',
        currency: 'MXN',
        currencySymbol: '$',
        themeId: 'phoenix',
        themeColor: '#ff2a5f',
        logoIcon: '⚡',
        imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
        openingTime: '11:00',
        closingTime: '22:00',
        slotDuration: 60,
        maxAdvanceDays: 14,
        minCancelNoticeHours: 2,
        maxActiveBookingsPerUser: 3,
        requiresDeposit: false,
        depositPercentage: 50,
        paymentInstructions: '',
        rules: '',
        wifiNetwork: '',
        wifiPassword: '',
        isActive: false,
        status: 'INACTIVE',
        allowClientCancellation: false,
        disableChangeLocal: false,
        loyaltyEnabled: true,
        loyaltyMode: 'POINTS',
        loyaltyDiscountType: 'NONE',
        pointsRatio: 10,
        hasSeededOvernightSchedule: true,
        blockedUsers: [],
        enabledModules: { ...DEFAULT_BUSINESS_MODULES },
        operatingHours: {
            0: { open: '11:00', close: '22:00', closed: false },
            1: { open: '11:00', close: '22:00', closed: false },
            2: { open: '11:00', close: '22:00', closed: false },
            3: { open: '11:00', close: '22:00', closed: false },
            4: { open: '11:00', close: '22:00', closed: false },
            5: { open: '11:00', close: '22:00', closed: false },
            6: { open: '11:00', close: '22:00', closed: false }
        },
        customRates: [],
        createdAt: '2026-08-17T17:15:08.881Z'
    },
    {
        id: 'biz_1787593488970',
        name: 'Nieves Games',
        tagline: 'Arcade & Rhythm Gaming Center',
        city: 'Tultepec',
        address: '',
        phone: '',
        whatsapp: '5581440139',
        mapsUrl: '',
        facebookUrl: '',
        instagramUrl: '',
        currency: 'MXN',
        currencySymbol: '$',
        themeId: 'phoenix',
        themeColor: '#ff7b00',
        logoIcon: '🍦',
        imageUrl: 'https://scontent.fmex32-1.fna.fbcdn.net/v/t39.30808-6/760620613_122127303741353714_1984263366024861538_n.jpg?stp=dst-jpg_tt6&cstp=mx1164x1170&ctp=s1164x1170&_nc_cat=104&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=kcWpCGMSjo0Q7kNvwErv4hF&_nc_oc=Adpqj0mE5vU9QZ2OkWH0SjQVktUFGaVTKs2IvkFDnTRbSwvn9k9I10hhfPttYVFaswI&_nc_zt=23&_nc_ht=scontent.fmex32-1.fna&_nc_gid=_CZPC5OO25cxBgBuPk4ZgQ&_nc_ss=7a2a8&oh=00_AQF00fg2rtg6H8oG-T_URENH1kH63nOoNOKMB6bcLtrqMg&oe=6A9270D3',
        openingTime: '11:00',
        closingTime: '22:00',
        slotDuration: 60,
        maxAdvanceDays: 14,
        minCancelNoticeHours: 2,
        maxActiveBookingsPerUser: 3,
        requiresDeposit: false,
        depositPercentage: 50,
        paymentInstructions: '',
        rules: '',
        wifiNetwork: '',
        wifiPassword: '',
        isActive: false,
        status: 'INACTIVE',
        allowClientCancellation: false,
        disableChangeLocal: false,
        loyaltyEnabled: false,
        loyaltyMode: 'POINTS',
        loyaltyDiscountType: 'NONE',
        pointsRatio: 10,
        hasSeededOvernightSchedule: false,
        blockedUsers: [],
        enabledModules: { ...DEFAULT_BUSINESS_MODULES },
        operatingHours: {
            0: { open: '11:00', close: '22:00', closed: false },
            1: { open: '11:00', close: '22:00', closed: false },
            2: { open: '11:00', close: '22:00', closed: false },
            3: { open: '11:00', close: '22:00', closed: false },
            4: { open: '11:00', close: '22:00', closed: false },
            5: { open: '11:00', close: '22:00', closed: false },
            6: { open: '11:00', close: '22:00', closed: false }
        },
        customRates: [],
        createdAt: '2026-08-24T17:44:48.970Z'
    },
    {
        id: 'biz_1787717273923',
        name: 'Berrys Games',
        tagline: 'Arcade & Rhythm Gaming Center',
        city: 'Nezahualcóyotl',
        address: '',
        phone: '',
        whatsapp: '',
        mapsUrl: '',
        facebookUrl: '',
        instagramUrl: '',
        currency: 'MXN',
        currencySymbol: '$',
        themeId: 'classic',
        themeColor: '#ff2a5f',
        logoIcon: '🍒',
        imageUrl: 'https://i.ibb.co/kghYy4WV/FB-IMG-1787717201083.jpg',
        openingTime: '00:00',
        closingTime: '00:00',
        slotDuration: 30,
        maxAdvanceDays: 14,
        minCancelNoticeHours: 2,
        maxActiveBookingsPerUser: 3,
        requiresDeposit: false,
        depositPercentage: 50,
        paymentInstructions: '',
        rules: '',
        wifiNetwork: '',
        wifiPassword: '',
        isActive: false,
        status: 'INACTIVE',
        allowClientCancellation: false,
        disableChangeLocal: false,
        loyaltyEnabled: false,
        loyaltyMode: 'POINTS',
        loyaltyDiscountType: 'PERMANENT',
        pointsRatio: 10,
        hasSeededOvernightSchedule: true,
        blockedUsers: [],
        enabledModules: { ...DEFAULT_BUSINESS_MODULES },
        operatingHours: {
            0: { open: '00:00', close: '00:00', closed: false },
            1: { open: '00:00', close: '00:00', closed: false },
            2: { open: '00:00', close: '00:00', closed: false },
            3: { open: '00:00', close: '00:00', closed: false },
            4: { open: '00:00', close: '00:00', closed: false },
            5: { open: '00:00', close: '00:00', closed: false },
            6: { open: '00:00', close: '00:00', closed: false }
        },
        customRates: [],
        createdAt: '2026-08-26T04:07:53.924Z'
    }
];

class TenantManager {
    constructor() {
        this.businesses = [];
        this.activeBusinessId = null;
        this.isLocalSelected = false; // Controla si el usuario ya eligió local o debe ver la pantalla de selección inicial
        this.listeners = [];
        this.unsubscribeBusinesses = null;
        this.unsubscribeGlobalConfig = null;
        this.disableChangeLocalGlobally = false;
    }

    async init() {
        let loaded = [];

        // 1. Cargar Configuración Global desde LocalStorage (Zero-Read)
        const localConfig = localStorage.getItem('piu_global_config_v1');
        if (localConfig) {
            try {
                const parsed = JSON.parse(localConfig);
                this.disableChangeLocalGlobally = !!parsed.disableChangeLocalGlobally;
            } catch (e) {}
        }

        // 2. Cargar Negocios desde LocalStorage o Semillas en Memoria (Zero-Read)
        const localData = localStorage.getItem(TENANTS_STORAGE_KEY);
        if (localData) {
            try { loaded = JSON.parse(localData); } catch (e) { loaded = []; }
        }

        // Migración automática: si está vacío, si tiene el seed demo antiguo o si no incluye X-Games
        if (!Array.isArray(loaded) || loaded.length === 0 || loaded.some(b => b.id === 'biz_piu_centro') || !loaded.some(b => b.id === 'biz_1786567885850')) {
            const merged = Array.isArray(loaded) ? [...loaded.filter(b => b.id !== 'biz_piu_centro' && b.id !== 'biz_arcade_galaxy')] : [];
            for (const defBiz of DEFAULT_BUSINESSES) {
                const idx = merged.findIndex(b => b.id === defBiz.id);
                if (idx === -1) {
                    merged.push(defBiz);
                } else {
                    merged[idx] = { ...defBiz, ...merged[idx] };
                }
            }
            loaded = merged;
            this.saveLocally(loaded);
        }

        this.businesses = loaded;

        // Comprobar si hay una sesión activa de Encargado bloqueada a una sucursal específica
        const sessionRaw = localStorage.getItem('piu_auth_current_user_v1');
        let managerBizId = null;
        if (sessionRaw) {
            try {
                const sess = JSON.parse(sessionRaw);
                if (sess && sess.role === 'MANAGER' && sess.businessId) {
                    managerBizId = sess.businessId;
                }
            } catch (e) {}
        }

        const isSuperAdmin = this.isCurrentUserSuperAdmin();

        if (managerBizId && this.businesses.some(b => b.id === managerBizId)) {
            const mgrBiz = this.businesses.find(b => b.id === managerBizId);
            if (this.isBusinessActive(mgrBiz) || isSuperAdmin) {
                this.activeBusinessId = managerBizId;
                this.isLocalSelected = true;
                localStorage.setItem(SESSION_LOCKED_KEY, managerBizId);
            } else {
                this.isLocalSelected = false;
                localStorage.removeItem(SESSION_LOCKED_KEY);
                const firstActive = this.businesses.find(b => this.isBusinessActive(b));
                this.activeBusinessId = firstActive ? firstActive.id : (this.businesses[0]?.id || null);
            }
        } else {
            // Comprobar si la URL trae un parámetro de local explícito o si la ruta es /local/biz_ID o /local/slug
            const urlParams = new URLSearchParams(window.location.search);
            let urlBizId = urlParams.get('local') || urlParams.get('business') || urlParams.get('sucursal');
            
            if (!urlBizId) {
                const pathParts = window.location.pathname.split('/');
                const localIdx = pathParts.indexOf('local');
                if (localIdx !== -1 && pathParts[localIdx + 1]) {
                    urlBizId = pathParts[localIdx + 1];
                }
            }

            // Normalización para búsqueda flexible: por ID exacto, slug o coincidencia de nombre
            let targetBiz = null;
            if (urlBizId) {
                const cleanQuery = decodeURIComponent(urlBizId).trim().toLowerCase();
                const cleanQuerySlug = cleanQuery.replace(/[^a-z0-9]/g, '');
                targetBiz = this.businesses.find(b => {
                    if (b.id === urlBizId) return true;
                    const bSlug = (b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return bSlug && (bSlug === cleanQuerySlug || bSlug.includes(cleanQuerySlug) || cleanQuerySlug.includes(bSlug));
                });
                if (targetBiz) {
                    urlBizId = targetBiz.id;
                }
            }

            if (targetBiz && (this.isBusinessActive(targetBiz) || isSuperAdmin)) {
                this.activeBusinessId = urlBizId;
                this.isLocalSelected = true;
                localStorage.setItem(SESSION_LOCKED_KEY, urlBizId);
                localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, urlBizId);
            } else {
                // Si el local de la URL está inactivo y no es superadmin, limpiar el parámetro de la URL
                if (urlBizId && targetBiz && !this.isBusinessActive(targetBiz) && !isSuperAdmin) {
                    if (window.history.replaceState) {
                        const cleanUrl = window.location.pathname;
                        window.history.replaceState({}, '', cleanUrl);
                    }
                }

                // Verificar si había un local seleccionado y bloqueado en sesión
                const savedLocked = localStorage.getItem(SESSION_LOCKED_KEY) || localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
                const savedBiz = savedLocked ? this.businesses.find(b => b.id === savedLocked) : null;
                if (savedBiz && (this.isBusinessActive(savedBiz) || isSuperAdmin)) {
                    this.activeBusinessId = savedLocked;
                    this.isLocalSelected = true;
                } else {
                    // No hay local seleccionado todavía o el guardado está inactivo -> Debe mostrar el index de bienvenida
                    this.isLocalSelected = false;
                    localStorage.removeItem(SESSION_LOCKED_KEY);
                    const firstActive = this.businesses.find(b => this.isBusinessActive(b));
                    this.activeBusinessId = firstActive ? firstActive.id : (this.businesses[0]?.id || null);
                }
            }
        }

        // Si hay conexión y cuota disponible, sincronizar cambios frescos en segundo plano sin bloquear el arranque
        if (canMakeFirestoreRead()) {
            this.syncFromFirestore().catch(e => console.warn("[TenantManager] Sync Firestore diferido:", e));
        }

        syncMetadataToServer(this.businesses);
        return this.getActiveBusiness();
    }

    async syncFromFirestore() {
        if (!canMakeFirestoreRead()) return;
        try {
            const querySnapshot = await getDocs(collection(db, COLLECTIONS.BUSINESSES));
            if (!querySnapshot.empty) {
                const remote = [];
                querySnapshot.forEach(docSnap => {
                    remote.push({ id: docSnap.id, ...docSnap.data() });
                });
                this.businesses = remote;
                this.saveLocally(this.businesses);
                syncMetadataToServer(this.businesses);
                this.notify();
            }
        } catch (err) {
            if (err?.code === 'resource-exhausted') markQuotaExhausted();
            console.warn("Error sincronizando negocios de Firestore:", err);
        }
    }

    detachListeners() {
        this.unsubscribeBusinesses?.();
        this.unsubscribeGlobalConfig?.();
        this.unsubscribeBusinesses = null;
        this.unsubscribeGlobalConfig = null;
    }

    isCurrentUserSuperAdmin() {
        const sessionRaw = localStorage.getItem('piu_auth_current_user_v1');
        if (sessionRaw) {
            try {
                const sess = JSON.parse(sessionRaw);
                return sess && (sess.role === 'SUPERADMIN' || sess.isSuperAdmin === true);
            } catch (e) {}
        }
        return false;
    }

    saveLocally(businesses) {
        localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(businesses));
    }

    getAllBusinesses() {
        return this.businesses;
    }

    getActiveBusinesses() {
        return this.businesses.filter(b => this.isBusinessActive(b));
    }

    getBusinessById(id) {
        if (!id) return null;
        const clean = String(id).trim().toLowerCase();
        const cleanSlug = clean.replace(/[^a-z0-9]/g, '');
        return this.businesses.find(b => 
            b.id === id || 
            (b.name && b.name.toLowerCase() === clean) ||
            (b.name && b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanSlug)
        ) || null;
    }

    getActiveBusiness() {
        const activeBiz = this.businesses.find(b => b.id === this.activeBusinessId);
        if (activeBiz && (this.isBusinessActive(activeBiz) || this.isCurrentUserSuperAdmin())) {
            return activeBiz;
        }
        const firstActive = this.businesses.find(b => this.isBusinessActive(b));
        return firstActive || this.businesses[0];
    }

    /**
     * El usuario selecciona un local desde la pantalla de bienvenida (Index)
     */
    async selectLocal(businessId) {
        const isSuperAdmin = this.isCurrentUserSuperAdmin();
        const targetBiz = this.businesses.find(b => b.id === businessId);
        if (!targetBiz) return null;

        // Candado estricto: Si el local está deshabilitado y no es Superadmin, denegar acceso
        if (!this.isBusinessActive(targetBiz) && !isSuperAdmin) {
            console.warn(`[TenantManager] Acceso denegado a sucursal inactiva: ${businessId}`);
            return null;
        }

        const sessionRaw = localStorage.getItem('piu_auth_current_user_v1');
        if (sessionRaw) {
            try {
                const sess = JSON.parse(sessionRaw);
                if (sess && sess.role === 'MANAGER' && sess.businessId) {
                    businessId = sess.businessId; // Forzar sucursal asignada al encargado
                }
            } catch (e) {}
        }

        this.activeBusinessId = businessId;
        this.isLocalSelected = true;
        localStorage.setItem(SESSION_LOCKED_KEY, businessId);
        localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, businessId);
        this.notify();
        return this.getActiveBusiness();
    }

    /**
     * Regresar al Index para cambiar de local
     */
    clearSelectedLocal() {
        const sessionRaw = localStorage.getItem('piu_auth_current_user_v1');
        let isSuperAdmin = false;
        if (sessionRaw) {
            try {
                const sess = JSON.parse(sessionRaw);
                if (sess && sess.role === 'MANAGER' && sess.businessId) {
                    // El encargado no puede salir de su sucursal asignada
                    return;
                }
                if (sess && (sess.role === 'SUPERADMIN' || sess.isSuperAdmin === true)) {
                    isSuperAdmin = true;
                }
            } catch (e) {}
        }

        // Si el cambio de local está bloqueado globalmente, el superadmin sí puede salir, pero otros no
        if (this.disableChangeLocalGlobally && !isSuperAdmin) {
            return;
        }

        this.isLocalSelected = false;
        localStorage.removeItem(SESSION_LOCKED_KEY);
        // Limpiar query params de la URL sin recargar
        if (window.history.pushState) {
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.pushState({ path: newUrl }, '', newUrl);
        }
        this.notify();
    }

    async setActiveBusiness(businessId) {
        const isSuperAdmin = this.isCurrentUserSuperAdmin();
        const targetBiz = this.businesses.find(b => b.id === businessId);
        if (!targetBiz) return null;

        if (!this.isBusinessActive(targetBiz) && !isSuperAdmin) {
            return null;
        }

        this.activeBusinessId = businessId;
        this.isLocalSelected = true;
        localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, businessId);
        localStorage.setItem(SESSION_LOCKED_KEY, businessId);
        this.notify();
        return this.getActiveBusiness();
    }

    async createBusiness(businessData, autoSelect = true) {
        const newId = 'biz_' + Date.now();
        const newBusiness = {
            id: newId,
            name: businessData.name.trim(),
            tagline: businessData.tagline?.trim() || 'Arcade & Rhythm Gaming Center',
            city: businessData.city?.trim() || 'General',
            address: businessData.address?.trim() || '',
            phone: businessData.phone?.trim() || '',
            whatsapp: (businessData.whatsapp || '').replace(/\D/g, ''),
            mapsUrl: businessData.mapsUrl?.trim() || '',
            facebookUrl: businessData.facebookUrl?.trim() || '',
            instagramUrl: businessData.instagramUrl?.trim() || '',
            currency: businessData.currency || 'MXN',
            currencySymbol: businessData.currencySymbol || '$',
            themeId: businessData.themeId || 'phoenix',
            logoIcon: businessData.logoIcon || '🕹️',
            imageUrl: businessData.imageUrl?.trim() || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
            openingTime: businessData.openingTime || '11:00',
            closingTime: businessData.closingTime || '22:00',
            slotDuration: parseInt(businessData.slotDuration, 10) || 60,
            maxAdvanceDays: parseInt(businessData.maxAdvanceDays, 10) || 14,
            minCancelNoticeHours: parseInt(businessData.minCancelNoticeHours, 10) || 2,
            maxActiveBookingsPerUser: parseInt(businessData.maxActiveBookingsPerUser, 10) || 3,
            requiresDeposit: businessData.requiresDeposit === true || businessData.requiresDeposit === 'true',
            depositPercentage: parseInt(businessData.depositPercentage, 10) || 50,
            paymentInstructions: businessData.paymentInstructions?.trim() || '',
            rules: businessData.rules?.trim() || '',
            wifiNetwork: businessData.wifiNetwork?.trim() || '',
            wifiPassword: businessData.wifiPassword?.trim() || '',
            isActive: businessData.isActive !== false,
            status: businessData.status || (businessData.isActive === false ? 'INACTIVE' : 'ACTIVE'),
            enabledModules: this.normalizeModules(businessData.enabledModules),
            operatingHours: (() => {
                const oh = {};
                for (let i = 0; i < 7; i++) {
                    oh[i] = {
                        open: businessData.openingTime || '11:00',
                        close: businessData.closingTime || '22:00',
                        closed: false
                    };
                }
                return oh;
            })(),
            createdAt: new Date().toISOString(),
            version: 1
        };

        this.businesses.push(newBusiness);
        this.saveLocally(this.businesses);

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.BUSINESSES, newId), newBusiness);
            } catch (err) {
                console.warn("Error guardando nuevo negocio en Firebase:", err);
            }
        }

        if (autoSelect) {
            await this.selectLocal(newId);
        } else {
            this.notify();
        }
        return newBusiness;
    }

    async updateBusiness(businessId, updatedFields, expectedVersion = null) {
        const index = this.businesses.findIndex(b => b.id === businessId);
        if (index === -1) return null;

        const currentVersion = expectedVersion ?? this.businesses[index].version ?? 0;
        const persistedFields = {
            ...updatedFields,
            version: currentVersion + 1,
            updatedAt: new Date().toISOString()
        };

        if (isFirebaseAvailable && db) {
            await runTransaction(db, async (transaction) => {
                const businessRef = doc(db, COLLECTIONS.BUSINESSES, businessId);
                const latest = await transaction.get(businessRef);
                if (!latest.exists()) throw new Error('El local ya no existe.');
                if ((latest.data().version || 0) !== currentVersion) {
                    throw new Error('La configuración cambió en otro dispositivo. Recarga la página antes de volver a guardar.');
                }
                transaction.update(businessRef, persistedFields);

                // Inyectar auditoría de configuración en la misma transacción atómica
                auditLogger.appendTransactionAudit(transaction, {
                    businessId,
                    action: AUDIT_ACTIONS.BUSINESS_SETTINGS_UPDATED,
                    target: { type: 'BUSINESS', id: businessId, name: this.businesses[index].name },
                    details: `Actualizada configuración de sucursal: ${this.businesses[index].name} (v${persistedFields.version})`
                });
            });
        }

        this.businesses[index] = {
            ...this.businesses[index],
            ...persistedFields
        };

        this.saveLocally(this.businesses);
        syncMetadataToServer(this.businesses);

        this.notify();
        return this.businesses[index];
    }

    /**
     * ELIMINACIÓN EN CASCADA:
     * Al eliminar un negocio, se eliminan todas sus máquinas, reservaciones,
     * usuarios encargados asignados y configuraciones tanto en LocalStorage como en Firebase.
     */
    async deleteBusiness(businessId) {
        if (this.businesses.length <= 1) {
            throw new Error("No se puede eliminar el único negocio existente. Debe haber al menos una sucursal.");
        }

        // 1. Eliminar negocio del catálogo
        this.businesses = this.businesses.filter(b => b.id !== businessId);
        this.saveLocally(this.businesses);

        // 2. Limpiar datos locales en cascada
        localStorage.removeItem(`piu_machines_${businessId}`);
        localStorage.removeItem(`piu_reservations_${businessId}`);

        // Limpiar staff asignado en cache local
        const staffRaw = localStorage.getItem('piu_staff_users_cache');
        if (staffRaw) {
            try {
                const staffList = JSON.parse(staffRaw).filter(u => u.businessId !== businessId);
                localStorage.setItem('piu_staff_users_cache', JSON.stringify(staffList));
            } catch (e) {}
        }

        // 3. Eliminar en Firebase Firestore en Cascada
        if (isFirebaseAvailable && db) {
            try {
                // Borrar documento del negocio
                await deleteDoc(doc(db, COLLECTIONS.BUSINESSES, businessId));

                // Borrar máquinas del negocio
                const machSnap = await getDocs(query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", businessId)));
                machSnap.forEach(async (d) => {
                    await deleteDoc(doc(db, COLLECTIONS.MACHINES, d.id));
                });

                // Borrar reservaciones del negocio
                const resSnap = await getDocs(query(collection(db, COLLECTIONS.RESERVATIONS), where("businessId", "==", businessId)));
                resSnap.forEach(async (d) => {
                    await deleteDoc(doc(db, COLLECTIONS.RESERVATIONS, d.id));
                });

                // Borrar usuarios staff de ese negocio
                const staffSnap = await getDocs(query(collection(db, COLLECTIONS.STAFF_USERS), where("businessId", "==", businessId)));
                staffSnap.forEach(async (d) => {
                    await deleteDoc(doc(db, COLLECTIONS.STAFF_USERS, d.id));
                });

                console.log(`🗑️ Eliminación en cascada completa para negocio: ${businessId}`);
            } catch (err) {
                console.warn("Error en eliminación en cascada en Firebase:", err);
            }
        }

        // Si el negocio eliminado estaba activo, resetear a landing
        if (this.activeBusinessId === businessId) {
            this.clearSelectedLocal();
        } else {
            this.notify();
        }

        return true;
    }

    /**
     * Normaliza el objeto de módulos habilitados asegurando compatibilidad total (default true).
     */
    normalizeModules(rawModules) {
        if (!rawModules || typeof rawModules !== 'object') {
            return { ...DEFAULT_BUSINESS_MODULES };
        }
        return {
            accounts: rawModules.accounts !== false,
            clients: rawModules.clients !== false,
            loyalty: rawModules.loyalty !== false,
            requests: rawModules.requests !== false,
            analytics: rawModules.analytics !== false,
            business: rawModules.business !== false,
            catalogs: rawModules.catalogs !== false,
            calendarWeek: rawModules.calendarWeek !== false,
            calendarMonth: rawModules.calendarMonth !== false,
            machines: rawModules.machines !== false,
            myProfile: rawModules.myProfile !== false,
            versus: rawModules.versus !== false
        };
    }

    /**
     * Valida si un módulo o vista específica está habilitada para el negocio activo o especificado.
     * Retorna true por defecto si no está restringido o el local no existe.
     */
    isModuleEnabled(moduleId, business = null) {
        if (!moduleId) return true;
        const biz = business || this.getActiveBusiness();
        if (!biz) return true;

        const modules = this.normalizeModules(biz.enabledModules);
        const key = String(moduleId).toLowerCase().replace(/[^a-z]/g, '');

        if (key === 'accounts' || key === 'pos') return modules.accounts !== false;
        if (key === 'clients' || key === 'players') return modules.clients !== false;
        if (key === 'loyalty' || key === 'rewards') return modules.loyalty !== false;
        if (key === 'requests' || key === 'solicitudes') return modules.requests !== false;
        if (key === 'analytics' || key === 'rendimiento') return modules.analytics !== false;
        if (key === 'business' || key === 'settings' || key === 'ajustes') return modules.business !== false;
        if (key === 'catalogs' || key === 'products' || key === 'catalogos') return modules.catalogs !== false;
        if (key === 'week' || key === 'calendarweek') return modules.calendarWeek !== false;
        if (key === 'month' || key === 'calendarmonth') return modules.calendarMonth !== false;
        if (key === 'machines' || key === 'maquinas') return modules.machines !== false;
        if (key === 'myprofile' || key === 'profile' || key === 'perfil') return modules.myProfile !== false;
        if (key === 'versus' || key === 'retas' || key === 'matchmaking') return modules.versus !== false;

        if (moduleId in modules) {
            return modules[moduleId] !== false;
        }
        return true;
    }

    /**
     * Valida si el local está operativo (Activo).
     */
    isBusinessActive(business = null) {
        const biz = business || this.getActiveBusiness();
        if (!biz) return true;
        return biz.isActive !== false && biz.status !== 'INACTIVE';
    }

    /**
     * Activa o Pausa una sucursal (Operación Superadmin).
     */
    async toggleBusinessStatus(businessId, isActive) {
        const biz = this.businesses.find(b => b.id === businessId);
        if (!biz) return null;
        return await this.updateBusiness(businessId, {
            isActive: !!isActive,
            status: isActive ? 'ACTIVE' : 'INACTIVE'
        });
    }

    /**
     * Actualiza la matriz de Feature Toggles de una sucursal (Operación Superadmin).
     */
    async updateBusinessModules(businessId, modulesObj) {
        const biz = this.businesses.find(b => b.id === businessId);
        if (!biz) return null;
        const normalized = this.normalizeModules(modulesObj);
        return await this.updateBusiness(businessId, {
            enabledModules: normalized
        });
    }

    async updateGlobalConfig(configData) {
        this.disableChangeLocalGlobally = !!configData.disableChangeLocalGlobally;
        localStorage.setItem('piu_global_config_v1', JSON.stringify({
            disableChangeLocalGlobally: this.disableChangeLocalGlobally
        }));

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, 'piu_system_settings', 'global_config'), {
                    disableChangeLocalGlobally: this.disableChangeLocalGlobally,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (e) {
                console.warn("Error guardando config global en Firebase:", e);
            }
        }
        this.notify();
    }

    /**
     * Comprueba si un cliente/jugador está bloqueado en una sucursal específica.
     */
    isClientBlocked(business, clientData = {}) {
        if (!business || !Array.isArray(business.blockedUsers) || business.blockedUsers.length === 0) {
            return false;
        }

        const clientId = (clientData.id || clientData.clientId || '').toLowerCase().trim();
        const clientUsername = (clientData.username || clientData.clientUsername || '').toLowerCase().trim();
        const clientPhone = (clientData.phone || clientData.clientPhone || '').replace(/\D/g, '');
        const clientName = (clientData.name || clientData.clientName || '').toLowerCase().trim();

        return business.blockedUsers.some(b => {
            const bId = (b.id || '').toLowerCase().trim();
            const bUsername = (b.username || '').toLowerCase().trim();
            const bPhone = (b.phone || '').replace(/\D/g, '');
            const bName = (b.name || '').toLowerCase().trim();

            if (clientId && bId && clientId === bId) return true;
            if (clientUsername && bUsername && (clientUsername === bUsername || clientUsername === bUsername.replace(/^@/, ''))) return true;
            if (clientPhone && bPhone && clientPhone === bPhone) return true;
            if (clientName && bName && clientName === bName) return true;
            return false;
        });
    }

    /**
     * Bloquea a un cliente para impedirle reservar en una sucursal.
     */
    async blockClientInBusiness(businessId, clientData, reason = 'Bloqueado por locatario') {
        const business = this.businesses.find(b => b.id === businessId);
        if (!business) throw new Error("Sucursal no encontrada.");

        const currentBlocked = Array.isArray(business.blockedUsers) ? [...business.blockedUsers] : [];
        const alreadyBlocked = this.isClientBlocked(business, clientData);
        if (alreadyBlocked) {
            return business;
        }

        const newBlockEntry = {
            id: clientData.id || '',
            username: clientData.username || '',
            name: clientData.name || 'Jugador',
            phone: clientData.phone ? clientData.phone.replace(/\D/g, '') : '',
            reason: (reason || 'Sin motivo especificado').trim(),
            blockedAt: new Date().toISOString()
        };

        currentBlocked.push(newBlockEntry);
        return await this.updateBusiness(businessId, { blockedUsers: currentBlocked });
    }

    /**
     * Desbloquea a un cliente en una sucursal.
     */
    async unblockClientInBusiness(businessId, clientIdOrPhone) {
        const business = this.businesses.find(b => b.id === businessId);
        if (!business) throw new Error("Sucursal no encontrada.");

        const currentBlocked = Array.isArray(business.blockedUsers) ? [...business.blockedUsers] : [];
        const key = (clientIdOrPhone || '').toLowerCase().trim();
        const cleanPhone = key.replace(/\D/g, '');

        const filtered = currentBlocked.filter(b => {
            const bId = (b.id || '').toLowerCase().trim();
            const bUsername = (b.username || '').toLowerCase().trim();
            const bPhone = (b.phone || '').replace(/\D/g, '');

            if (bId && bId === key) return false;
            if (bUsername && bUsername === key) return false;
            if (cleanPhone && bPhone && bPhone === cleanPhone) return false;
            return true;
        });

        return await this.updateBusiness(businessId, { blockedUsers: filtered });
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notify() {
        const active = this.getActiveBusiness();
        this.listeners.forEach(cb => cb(active, this.businesses, this.isLocalSelected));
    }
}

export const tenantManager = new TenantManager();

async function syncMetadataToServer(businesses) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
    }
    try {
        const payload = businesses.map(b => ({
            id: b.id,
            name: b.name,
            tagline: b.tagline || b.city || '',
            imageUrl: b.imageUrl || ''
        }));
        await fetch('/api/save-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch(e) {
        // Ignorar silenciosamente si falla la llamada
    }
}
