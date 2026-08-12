// js/core/tenantManager.js
// Gestor de negocios / sucursales (Multi-tenant modular con eliminación en cascada)
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
        currency: 'MXN',
        currencySymbol: '$',
        themeColor: '#ff2a5f',
        logoIcon: '🎮',
        imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
        openingTime: '11:00',
        closingTime: '22:00',
        slotDuration: 60,
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
        currency: 'MXN',
        currencySymbol: '$',
        themeColor: '#00e5ff',
        logoIcon: '⚡',
        imageUrl: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=800&q=80',
        openingTime: '12:00',
        closingTime: '23:00',
        slotDuration: 60,
        createdAt: new Date().toISOString()
    }
];

class TenantManager {
    constructor() {
        this.businesses = [];
        this.activeBusinessId = null;
        this.isLocalSelected = false; // Controla si el usuario ya eligió local o debe ver la pantalla de selección inicial
        this.listeners = [];
    }

    async init() {
        let loaded = [];

        if (isFirebaseAvailable && db) {
            try {
                const querySnapshot = await getDocs(collection(db, COLLECTIONS.BUSINESSES));
                if (!querySnapshot.empty) {
                    querySnapshot.forEach(docSnap => {
                        loaded.push({ id: docSnap.id, ...docSnap.data() });
                    });
                }
            } catch (err) {
                console.warn("Error cargando negocios desde Firebase, usando LocalStorage:", err);
            }
        }

        if (loaded.length === 0) {
            const localData = localStorage.getItem(TENANTS_STORAGE_KEY);
            if (localData) {
                try { loaded = JSON.parse(localData); } catch (e) { loaded = []; }
            }
        }

        if (loaded.length === 0) {
            loaded = [...DEFAULT_BUSINESSES];
            this.saveLocally(loaded);
            if (isFirebaseAvailable && db) {
                for (const b of loaded) {
                    try { await setDoc(doc(db, COLLECTIONS.BUSINESSES, b.id), b); } catch (e) {}
                }
            }
        }

        this.businesses = loaded;

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
            currency: businessData.currency || 'MXN',
            currencySymbol: businessData.currencySymbol || '$',
            themeColor: businessData.themeColor || '#ff2a5f',
            logoIcon: businessData.logoIcon || '🕹️',
            imageUrl: businessData.imageUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
            openingTime: businessData.openingTime || '11:00',
            closingTime: businessData.closingTime || '22:00',
            slotDuration: parseInt(businessData.slotDuration, 10) || 60,
            createdAt: new Date().toISOString()
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

    async updateBusiness(businessId, updatedFields) {
        const index = this.businesses.findIndex(b => b.id === businessId);
        if (index === -1) return null;

        this.businesses[index] = {
            ...this.businesses[index],
            ...updatedFields,
            updatedAt: new Date().toISOString()
        };

        this.saveLocally(this.businesses);

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.BUSINESSES, businessId), updatedFields);
            } catch (err) {
                console.warn("Error actualizando negocio en Firebase:", err);
            }
        }

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
