// js/core/tenantManager.js
// Gestor de negocios / sucursales (Multi-tenant modular)
import { 
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    setDoc, 
    doc, 
    updateDoc, 
    deleteDoc 
} from '../firebaseConfig.js';

const TENANTS_STORAGE_KEY = 'piu_system_tenants_v1';
const ACTIVE_TENANT_STORAGE_KEY = 'piu_active_tenant_id_v1';

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
        openingTime: '11:00',
        closingTime: '22:00',
        slotDuration: 60, // en minutos
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
        this.listeners = [];
    }

    /**
     * Inicializa los negocios cargando desde Firebase o fallback LocalStorage
     */
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

        // Si Firebase estaba vacío o falló, buscar en LocalStorage
        if (loaded.length === 0) {
            const localData = localStorage.getItem(TENANTS_STORAGE_KEY);
            if (localData) {
                try {
                    loaded = JSON.parse(localData);
                } catch (e) {
                    loaded = [];
                }
            }
        }

        // Si sigue vacío, inicializar con los negocios predeterminados
        if (loaded.length === 0) {
            loaded = [...DEFAULT_BUSINESSES];
            this.saveLocally(loaded);
            // Intentar persistir a Firebase
            if (isFirebaseAvailable && db) {
                for (const b of loaded) {
                    try {
                        await setDoc(doc(db, COLLECTIONS.BUSINESSES, b.id), b);
                    } catch (e) {
                        console.warn("No se pudo guardar negocio inicial en Firebase:", e);
                    }
                }
            }
        }

        this.businesses = loaded;

        // Recuperar negocio activo seleccionado previamente
        const savedActiveId = localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
        if (savedActiveId && this.businesses.some(b => b.id === savedActiveId)) {
            this.activeBusinessId = savedActiveId;
        } else {
            this.activeBusinessId = this.businesses[0].id;
        }

        return this.getActiveBusiness();
    }

    saveLocally(businesses) {
        localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(businesses));
    }

    getAllBusinesses() {
        return this.businesses;
    }

    getActiveBusiness() {
        return this.businesses.find(b => b.id === this.activeBusinessId) || this.businesses[0];
    }

    async setActiveBusiness(businessId) {
        if (this.businesses.some(b => b.id === businessId)) {
            this.activeBusinessId = businessId;
            localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, businessId);
            this.notify();
            return this.getActiveBusiness();
        }
        return null;
    }

    /**
     * Crea un nuevo negocio / sucursal
     */
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

        await this.setActiveBusiness(newId);
        return newBusiness;
    }

    /**
     * Actualiza la información de un negocio existente
     */
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
     * Elimina un negocio (siempre y cuando haya más de uno)
     */
    async deleteBusiness(businessId) {
        if (this.businesses.length <= 1) {
            throw new Error("No se puede eliminar el único negocio disponible.");
        }

        this.businesses = this.businesses.filter(b => b.id !== businessId);
        this.saveLocally(this.businesses);

        if (isFirebaseAvailable && db) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.BUSINESSES, businessId));
            } catch (err) {
                console.warn("Error eliminando negocio en Firebase:", err);
            }
        }

        if (this.activeBusinessId === businessId) {
            await this.setActiveBusiness(this.businesses[0].id);
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
        this.listeners.forEach(cb => cb(active, this.businesses));
    }
}

export const tenantManager = new TenantManager();
