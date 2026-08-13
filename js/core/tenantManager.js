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
    where 
} from '../firebaseConfig.js';

const TENANTS_STORAGE_KEY = 'piu_system_tenants_v1';
const ACTIVE_TENANT_STORAGE_KEY = 'piu_active_tenant_id_v1';
const SESSION_LOCKED_KEY = 'piu_session_local_locked_v1';

// Negocios iniciales predeterminados (Seed data)
export const DEFAULT_BUSINESSES = [
    {
        id: 'biz_piu_centro',
        name: 'Pump Zone Centro',
        tagline: 'El Templo del Step - Arcade & Rhythm Game Lounge',
        city: 'Ciudad de México, Centro',
        address: 'Av. Juárez #142, Piso 2 (Zona Rosa)',
        phone: '+52 55 1234 5678',
        whatsapp: '5512345678',
        mapsUrl: 'https://maps.google.com/?q=Av.+Juarez+142+CDMX',
        facebookUrl: 'https://facebook.com/pumpzonecentro',
        instagramUrl: 'https://instagram.com/pumpzonecentro',
        currency: 'MXN',
        currencySymbol: '$',
        themeColor: '#ff2a5f',
        logoIcon: '🎮',
        imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
        openingTime: '11:00',
        closingTime: '22:00',
        slotDuration: 60,
        maxAdvanceDays: 14,
        minCancelNoticeHours: 2,
        maxActiveBookingsPerUser: 3,
        requiresDeposit: true,
        depositPercentage: 50,
        paymentInstructions: 'Transferencia BBVA - CLABE: 012180001234567890\nBeneficiario: Pump Zone Centro S.A.\nEnviar comprobante por WhatsApp con tu ID de reserva.',
        rules: '1. Uso obligatorio de tenis deportivos limpios.\n2. No pisar las barras de soporte con las suelas descalzas.\n3. Tolerancia de espera de 10 minutos antes de liberar la máquina.',
        wifiNetwork: 'PumpZone_Clientes',
        wifiPassword: 'StepManiaPhoenix',
        createdAt: new Date().toISOString()
    },
    {
        id: 'biz_arcade_galaxy',
        name: 'Arcade Galaxy Norte',
        tagline: 'Rhythm Arena & Pump It Up Pro Hub',
        city: 'Monterrey, N.L.',
        address: 'Plaza Galerías Norte, Local B-12',
        phone: '+52 81 9876 5432',
        whatsapp: '8198765432',
        mapsUrl: 'https://maps.google.com/?q=Plaza+Galerias+Monterrey',
        facebookUrl: 'https://facebook.com/arcadegalaxynorte',
        instagramUrl: 'https://instagram.com/arcadegalaxy',
        currency: 'MXN',
        currencySymbol: '$',
        themeColor: '#00e5ff',
        logoIcon: '⚡',
        imageUrl: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=800&q=80',
        openingTime: '12:00',
        closingTime: '23:00',
        slotDuration: 60,
        maxAdvanceDays: 14,
        minCancelNoticeHours: 2,
        maxActiveBookingsPerUser: 3,
        requiresDeposit: false,
        depositPercentage: 0,
        paymentInstructions: 'Pago en caja / recepción al llegar a tu sesión de juego (Efectivo o Tarjeta).',
        rules: '1. Respetar el tiempo asignado de máquina.\n2. Cuidar los paneles acrílicos y sensores.\n3. Bebidas y alimentos sólo en el área de descanso.',
        wifiNetwork: 'Galaxy_Gaming_Free',
        wifiPassword: 'GalaxyPump2024',
        createdAt: new Date().toISOString()
    }
];

class TenantManager {
    constructor() {
        this.businesses = [];
        this.activeBusinessId = null;
        this.isLocalSelected = false; // Controla si el usuario ya eligió local o debe ver la pantalla de selección inicial
        this.listeners = [];
        this.unsubscribeBusinesses = null;
        this.disableChangeLocalGlobally = false;
    }

    async init() {
        let loaded = [];
        let loadedFromFirestore = false;

        // Cargar Configuración Global
        this.disableChangeLocalGlobally = false;
        if (isFirebaseAvailable && db) {
            try {
                const docSnap = await getDoc(doc(db, 'piu_system_settings', 'global_config'));
                if (docSnap.exists()) {
                    this.disableChangeLocalGlobally = !!docSnap.data().disableChangeLocalGlobally;
                }
            } catch (err) {
                console.warn("Error cargando config global de Firebase:", err);
            }
        }
        
        const localConfig = localStorage.getItem('piu_global_config_v1');
        if (localConfig) {
            try {
                const parsed = JSON.parse(localConfig);
                if (!isFirebaseAvailable || this.disableChangeLocalGlobally === undefined) {
                    this.disableChangeLocalGlobally = !!parsed.disableChangeLocalGlobally;
                }
            } catch (e) {}
        }

        if (isFirebaseAvailable && db) {
            try {
                const querySnapshot = await getDocs(collection(db, COLLECTIONS.BUSINESSES));
                loadedFromFirestore = true;
                if (!querySnapshot.empty) {
                    querySnapshot.forEach(docSnap => {
                        loaded.push({ id: docSnap.id, ...docSnap.data() });
                    });
                }
            } catch (err) {
                console.warn("Error cargando negocios desde Firebase, usando LocalStorage:", err);
            }
        }

        if (!loadedFromFirestore && loaded.length === 0) {
            const localData = localStorage.getItem(TENANTS_STORAGE_KEY);
            if (localData) {
                try { loaded = JSON.parse(localData); } catch (e) { loaded = []; }
            }
        }

        if (!loadedFromFirestore && loaded.length === 0) {
            loaded = [...DEFAULT_BUSINESSES];
            this.saveLocally(loaded);
            if (isFirebaseAvailable && db) {
                for (const b of loaded) {
                    try { await setDoc(doc(db, COLLECTIONS.BUSINESSES, b.id), b); } catch (e) {}
                }
            }
        }

        this.businesses = loaded;

        if (isFirebaseAvailable && db) {
            this.unsubscribeBusinesses?.();
            this.unsubscribeBusinesses = onSnapshot(collection(db, COLLECTIONS.BUSINESSES), (snapshot) => {
                this.businesses = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                this.saveLocally(this.businesses);
                this.notify();
            }, (error) => console.warn('Error de sincronización de locales:', error));
        }

        // Comprobar si hay una sesión activa de Encargado bloqueada a una sucursal específica
        const sessionRaw = localStorage.getItem('piu_active_user_session');
        let managerBizId = null;
        if (sessionRaw) {
            try {
                const sess = JSON.parse(sessionRaw);
                if (sess && sess.role === 'MANAGER' && sess.businessId) {
                    managerBizId = sess.businessId;
                }
            } catch (e) {}
        }

        if (managerBizId && this.businesses.some(b => b.id === managerBizId)) {
            this.activeBusinessId = managerBizId;
            this.isLocalSelected = true;
            localStorage.setItem(SESSION_LOCKED_KEY, managerBizId);
        } else {
            // Comprobar si la URL trae un parámetro de local explícito (?local=id o ?business=id)
            const urlParams = new URLSearchParams(window.location.search);
            const urlBizId = urlParams.get('local') || urlParams.get('business') || urlParams.get('sucursal');

            if (urlBizId && this.businesses.some(b => b.id === urlBizId)) {
                this.activeBusinessId = urlBizId;
                this.isLocalSelected = true;
                localStorage.setItem(SESSION_LOCKED_KEY, urlBizId);
            } else {
                // Verificar si había un local seleccionado y bloqueado en sesión
                const savedLocked = localStorage.getItem(SESSION_LOCKED_KEY);
                if (savedLocked && this.businesses.some(b => b.id === savedLocked)) {
                    this.activeBusinessId = savedLocked;
                    this.isLocalSelected = true;
                } else {
                    // No hay local seleccionado todavía -> Debe mostrar el index de bienvenida con selector
                    this.isLocalSelected = false;
                    this.activeBusinessId = this.businesses[0]?.id || null;
                }
            }
        }

        return this.getActiveBusiness();
    }

    saveLocally(businesses) {
        localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(businesses));
    }

    getAllBusinesses() {
        return this.businesses;
    }

    getBusinessById(id) {
        return this.businesses.find(b => b.id === id);
    }

    getActiveBusiness() {
        return this.businesses.find(b => b.id === this.activeBusinessId) || this.businesses[0];
    }

    /**
     * El usuario selecciona un local desde la pantalla de bienvenida (Index)
     */
    async selectLocal(businessId) {
        const sessionRaw = localStorage.getItem('piu_active_user_session');
        if (sessionRaw) {
            try {
                const sess = JSON.parse(sessionRaw);
                if (sess && sess.role === 'MANAGER' && sess.businessId) {
                    businessId = sess.businessId; // Forzar sucursal asignada al encargado
                }
            } catch (e) {}
        }

        if (this.businesses.some(b => b.id === businessId)) {
            this.activeBusinessId = businessId;
            this.isLocalSelected = true;
            localStorage.setItem(SESSION_LOCKED_KEY, businessId);
            localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, businessId);
            this.notify();
            return this.getActiveBusiness();
        }
        return null;
    }

    /**
     * Regresar al Index para cambiar de local (Bloqueado para encargados)
     */
    clearSelectedLocal() {
        const sessionRaw = localStorage.getItem('piu_active_user_session');
        if (sessionRaw) {
            try {
                const sess = JSON.parse(sessionRaw);
                if (sess && sess.role === 'MANAGER' && sess.businessId) {
                    // El encargado no puede salir de su sucursal asignada
                    return;
                }
            } catch (e) {}
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
        if (this.businesses.some(b => b.id === businessId)) {
            this.activeBusinessId = businessId;
            this.isLocalSelected = true;
            localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, businessId);
            localStorage.setItem(SESSION_LOCKED_KEY, businessId);
            this.notify();
            return this.getActiveBusiness();
        }
        return null;
    }

    async createBusiness(businessData) {
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
            themeColor: businessData.themeColor || '#ff2a5f',
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

        await this.selectLocal(newId);
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
            });
        }

        this.businesses[index] = {
            ...this.businesses[index],
            ...persistedFields
        };

        this.saveLocally(this.businesses);

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
                });
            } catch (e) {
                console.warn("Error guardando config global en Firebase:", e);
            }
        }
        this.notify();
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
