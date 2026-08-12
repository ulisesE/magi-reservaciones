// js/core/catalogsManager.js
// Módulo de Gestión de Catálogos del Sistema
// Globales: Modelos de Gabinete, Versiones de Software, Reasignación de Máquinas
// Por Negocio: Accesorios y Componentes de Hardware, Reglas de Operación
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
import { tenantManager } from './tenantManager.js';
import { store } from './store.js';

// ==========================================
// MODELOS DE GABINETE PREDETERMINADOS (GLOBAL)
// ==========================================
export const DEFAULT_CABINET_MODELS = [
    {
        id: 'cab_lx_55',
        name: 'LX 55" LED Cabinet (Pro Stage)',
        shortName: 'LX 55"',
        screenSize: '55" 120Hz Full HD/4K',
        dimensions: '210cm x 175cm x 240cm',
        type: 'LX',
        description: 'Gabinete insignia de competición con pantalla LED 55", sonido 2.1 y barras pro.',
        status: 'ACTIVE'
    },
    {
        id: 'cab_tx_50',
        name: 'TX 50" HD Cabinet',
        shortName: 'TX 50"',
        screenSize: '50" HD 1080p',
        dimensions: '195cm x 170cm x 230cm',
        type: 'TX',
        description: 'Gabinete estándar moderno con marcos luminosos y excelente sonido.',
        status: 'ACTIVE'
    },
    {
        id: 'cab_fx_42',
        name: 'FX 42" HD Cabinet',
        shortName: 'FX 42"',
        screenSize: '42" HD LCD',
        dimensions: '180cm x 165cm x 220cm',
        type: 'FX',
        description: 'Gabinete compacto ideal para espacios medianos con sonido envolvente.',
        status: 'ACTIVE'
    },
    {
        id: 'cab_cx_43',
        name: 'CX 43" Wide Cabinet',
        shortName: 'CX 43"',
        screenSize: '43" LED Widescreen',
        dimensions: '185cm x 165cm x 225cm',
        type: 'CX',
        description: 'Gabinete estilizado con iluminación lateral y alta durabilidad.',
        status: 'ACTIVE'
    },
    {
        id: 'cab_sd_29',
        name: 'SD 29" CRT Retro Cabinet',
        shortName: 'SD 29" CRT',
        screenSize: '29" CRT 15/31kHz',
        dimensions: '170cm x 150cm x 210cm',
        type: 'SD',
        description: 'Gabinete clásico original para torneos retro y máxima respuesta de refresco.',
        status: 'ACTIVE'
    }
];

// ==========================================
// VERSIONES OFICIALES PREDETERMINADAS (GLOBAL)
// ==========================================
export const DEFAULT_GAME_VERSIONS = [
    {
        id: 'ver_phoenix_2024',
        name: 'Pump It Up Phoenix (2024)',
        releaseYear: 2024,
        latestPatch: 'v1.08.0',
        supportedModes: ['Single', 'Double', 'Co-Op', 'UCS (Custom Steps)', 'Premium Mode'],
        minCabinet: 'LX 55" / TX 50"',
        status: 'CURRENT'
    },
    {
        id: 'ver_xx_20th',
        name: 'Pump It Up XX (20th Anniversary)',
        releaseYear: 2019,
        latestPatch: 'v2.08.0',
        supportedModes: ['Single', 'Double', 'Co-Op', 'Mission Zone'],
        minCabinet: 'TX 50" / FX 42"',
        status: 'LEGACY'
    },
    {
        id: 'ver_prime_2',
        name: 'Pump It Up Prime 2',
        releaseYear: 2017,
        latestPatch: 'v2.05.0',
        supportedModes: ['Single', 'Double', 'Rank Mode'],
        minCabinet: 'FX 42" / CX 43"',
        status: 'LEGACY'
    }
];

// ==========================================
// ACCESORIOS Y COMPONENTES POR DEFECTO
// ==========================================
export const DEFAULT_FEATURES_LIST = [
    { id: 'feat_scr_55_120', name: '55" 120Hz Display', category: 'Pantalla', icon: '🖥️', status: 'ACTIVE' },
    { id: 'feat_scr_50_hd', name: '50" HD Screen', category: 'Pantalla', icon: '📺', status: 'ACTIVE' },
    { id: 'feat_scr_42_hd', name: '42" Screen', category: 'Pantalla', icon: '📺', status: 'ACTIVE' },
    { id: 'feat_ampass_rfid', name: 'AM.PASS Card Reader', category: 'Lector AM.PASS', icon: '💳', status: 'ACTIVE' },
    { id: 'feat_ampass_official', name: 'AM.PASS Oficial Andamiro', category: 'Lector AM.PASS', icon: '🏷️', status: 'ACTIVE' },
    { id: 'feat_sound_sub', name: 'Sound Subwoofer 2.1', category: 'Audio', icon: '🔊', status: 'ACTIVE' },
    { id: 'feat_sound_high', name: 'Subwoofer High-Power', category: 'Audio', icon: '🎧', status: 'ACTIVE' },
    { id: 'feat_bar_pro', name: 'Barra Pro Reforzada', category: 'Estructura', icon: '🦾', status: 'ACTIVE' },
    { id: 'feat_cam_stream', name: 'Cámara Stream Integrada', category: 'Transmisión', icon: '📹', status: 'ACTIVE' },
    { id: 'feat_rgb_led', name: 'Iluminación Neón LED RGB', category: 'Iluminación', icon: '✨', status: 'ACTIVE' },
    { id: 'feat_sensors_fsr', name: 'Sensores FSR Competición', category: 'Sensores', icon: '⚡', status: 'ACTIVE' },
    { id: 'feat_soft_pads', name: 'Pads Suaves Recreativos', category: 'Sensores', icon: '🦶', status: 'ACTIVE' }
];

class CatalogsManager {
    constructor() {
        this.cabinetModels = [];
        this.gameVersions = [];
        this.featuresByBiz = {};
    }

    async init() {
        // 1. Cargar Modelos de Gabinete (Global)
        let loadedCabinets = [];
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDocs(collection(db, COLLECTIONS.CABINET_MODELS));
                snap.forEach(d => loadedCabinets.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando modelos de gabinete de Firebase:", e);
            }
        }
        if (loadedCabinets.length === 0) {
            const local = localStorage.getItem('piu_cabinet_models_cache');
            if (local) {
                try { loadedCabinets = JSON.parse(local); } catch (e) { loadedCabinets = []; }
            }
        }
        if (loadedCabinets.length === 0) {
            loadedCabinets = [...DEFAULT_CABINET_MODELS];
            localStorage.setItem('piu_cabinet_models_cache', JSON.stringify(loadedCabinets));
            if (isFirebaseAvailable && db) {
                for (const c of loadedCabinets) {
                    try { await setDoc(doc(db, COLLECTIONS.CABINET_MODELS, c.id), c); } catch (e) {}
                }
            }
        }
        this.cabinetModels = loadedCabinets;

        // 2. Cargar Versiones de Juego (Global)
        let loadedVersions = [];
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDocs(collection(db, COLLECTIONS.GAME_VERSIONS));
                snap.forEach(d => loadedVersions.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando versiones de Firebase:", e);
            }
        }
        if (loadedVersions.length === 0) {
            const local = localStorage.getItem('piu_game_versions_cache');
            if (local) {
                try { loadedVersions = JSON.parse(local); } catch (e) { loadedVersions = []; }
            }
        }
        if (loadedVersions.length === 0) {
            loadedVersions = [...DEFAULT_GAME_VERSIONS];
            localStorage.setItem('piu_game_versions_cache', JSON.stringify(loadedVersions));
            if (isFirebaseAvailable && db) {
                for (const v of loadedVersions) {
                    try { await setDoc(doc(db, COLLECTIONS.GAME_VERSIONS, v.id), v); } catch (e) {}
                }
            }
        }
        this.gameVersions = loadedVersions;
    }

    // ==========================================
    // 1. CATÁLOGO GLOBAL: MODELOS DE GABINETE (CRUD)
    // ==========================================
    getCabinetModels() {
        return this.cabinetModels;
    }

    async addCabinetModel(cabData) {
        const newCab = {
            id: 'cab_' + Date.now(),
            name: cabData.name.trim(),
            shortName: cabData.shortName?.trim() || cabData.name.trim(),
            screenSize: cabData.screenSize?.trim() || '55"',
            dimensions: cabData.dimensions?.trim() || '',
            type: cabData.type?.trim() || 'CUSTOM',
            description: cabData.description?.trim() || '',
            status: cabData.status || 'ACTIVE',
            createdAt: new Date().toISOString()
        };

        this.cabinetModels.push(newCab);
        localStorage.setItem('piu_cabinet_models_cache', JSON.stringify(this.cabinetModels));

        if (isFirebaseAvailable && db) {
            try { await setDoc(doc(db, COLLECTIONS.CABINET_MODELS, newCab.id), newCab); } catch (e) {}
        }
        return newCab;
    }

    async updateCabinetModel(cabId, updatedFields) {
        const index = this.cabinetModels.findIndex(c => c.id === cabId);
        if (index === -1) return null;

        this.cabinetModels[index] = { ...this.cabinetModels[index], ...updatedFields };
        localStorage.setItem('piu_cabinet_models_cache', JSON.stringify(this.cabinetModels));

        if (isFirebaseAvailable && db) {
            try { await updateDoc(doc(db, COLLECTIONS.CABINET_MODELS, cabId), updatedFields); } catch (e) {}
        }
        return this.cabinetModels[index];
    }

    async deleteCabinetModel(cabId) {
        this.cabinetModels = this.cabinetModels.filter(c => c.id !== cabId);
        localStorage.setItem('piu_cabinet_models_cache', JSON.stringify(this.cabinetModels));

        if (isFirebaseAvailable && db) {
            try { await deleteDoc(doc(db, COLLECTIONS.CABINET_MODELS, cabId)); } catch (e) {}
        }
        return true;
    }

    // ==========================================
    // 2. CATÁLOGO GLOBAL: VERSIONES DE JUEGO (CRUD)
    // ==========================================
    getGameVersions() {
        return this.gameVersions;
    }

    async addGameVersion(versionData) {
        const newVersion = {
            id: 'ver_' + Date.now(),
            name: versionData.name.trim(),
            releaseYear: Number(versionData.releaseYear) || new Date().getFullYear(),
            latestPatch: versionData.latestPatch?.trim() || 'v1.0',
            supportedModes: versionData.supportedModes || ['Single', 'Double'],
            minCabinet: versionData.minCabinet || 'Todos',
            status: versionData.status || 'CURRENT',
            createdAt: new Date().toISOString()
        };

        this.gameVersions.push(newVersion);
        localStorage.setItem('piu_game_versions_cache', JSON.stringify(this.gameVersions));

        if (isFirebaseAvailable && db) {
            try { await setDoc(doc(db, COLLECTIONS.GAME_VERSIONS, newVersion.id), newVersion); } catch (e) {}
        }
        return newVersion;
    }

    async updateGameVersion(versionId, updatedFields) {
        const index = this.gameVersions.findIndex(v => v.id === versionId);
        if (index === -1) return null;

        this.gameVersions[index] = { ...this.gameVersions[index], ...updatedFields };
        localStorage.setItem('piu_game_versions_cache', JSON.stringify(this.gameVersions));

        if (isFirebaseAvailable && db) {
            try { await updateDoc(doc(db, COLLECTIONS.GAME_VERSIONS, versionId), updatedFields); } catch (e) {}
        }
        return this.gameVersions[index];
    }

    async deleteGameVersion(versionId) {
        this.gameVersions = this.gameVersions.filter(v => v.id !== versionId);
        localStorage.setItem('piu_game_versions_cache', JSON.stringify(this.gameVersions));

        if (isFirebaseAvailable && db) {
            try { await deleteDoc(doc(db, COLLECTIONS.GAME_VERSIONS, versionId)); } catch (e) {}
        }
        return true;
    }

    // ==========================================
    // 3. CATÁLOGO LOCAL POR NEGOCIO: ACCESORIOS Y FEATURES (CRUD)
    // ==========================================
    async getFeaturesByBusiness(businessId) {
        if (!businessId) return DEFAULT_FEATURES_LIST;

        let loaded = [];
        if (isFirebaseAvailable && db) {
            try {
                const q = query(collection(db, COLLECTIONS.MACHINE_FEATURES), where("businessId", "==", businessId));
                const snap = await getDocs(q);
                snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando accesorios de Firebase:", e);
            }
        }

        if (loaded.length === 0) {
            const local = localStorage.getItem(`piu_features_${businessId}`);
            if (local) {
                try { loaded = JSON.parse(local); } catch (e) { loaded = []; }
            }
        }

        if (loaded.length === 0) {
            loaded = DEFAULT_FEATURES_LIST.map(f => ({ ...f, businessId: businessId }));
            localStorage.setItem(`piu_features_${businessId}`, JSON.stringify(loaded));
            if (isFirebaseAvailable && db) {
                for (const item of loaded) {
                    try { await setDoc(doc(db, COLLECTIONS.MACHINE_FEATURES, `${businessId}_${item.id}`), item); } catch (e) {}
                }
            }
        }

        this.featuresByBiz[businessId] = loaded;
        return loaded;
    }

    async addFeature(businessId, featureData) {
        const newFeature = {
            id: 'feat_' + Date.now(),
            businessId: businessId,
            name: featureData.name.trim(),
            category: featureData.category?.trim() || 'General',
            icon: featureData.icon?.trim() || '⚡',
            description: featureData.description?.trim() || '',
            status: featureData.status || 'ACTIVE',
            createdAt: new Date().toISOString()
        };

        const list = await this.getFeaturesByBusiness(businessId);
        list.push(newFeature);
        localStorage.setItem(`piu_features_${businessId}`, JSON.stringify(list));

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.MACHINE_FEATURES, `${businessId}_${newFeature.id}`), newFeature);
            } catch (e) {}
        }
        return newFeature;
    }

    async updateFeature(businessId, featureId, updatedFields) {
        const list = await this.getFeaturesByBusiness(businessId);
        const index = list.findIndex(f => f.id === featureId);
        if (index === -1) return null;

        list[index] = { ...list[index], ...updatedFields };
        localStorage.setItem(`piu_features_${businessId}`, JSON.stringify(list));

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.MACHINE_FEATURES, `${businessId}_${featureId}`), updatedFields);
            } catch (e) {}
        }
        return list[index];
    }

    async deleteFeature(businessId, featureId) {
        let list = await this.getFeaturesByBusiness(businessId);
        list = list.filter(f => f.id !== featureId);
        localStorage.setItem(`piu_features_${businessId}`, JSON.stringify(list));

        if (isFirebaseAvailable && db) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.MACHINE_FEATURES, `${businessId}_${featureId}`));
            } catch (e) {}
        }
        return true;
    }

    // ==========================================
    // 4. REASIGNACIÓN / TRANSFERENCIA DE MÁQUINAS ENTRE NEGOCIOS
    // ==========================================
    async reassignMachine(machineId, sourceBusinessId, targetBusinessId) {
        if (sourceBusinessId === targetBusinessId) {
            throw new Error("El local de destino debe ser diferente al actual.");
        }

        const targetBiz = tenantManager.getBusinessById(targetBusinessId);
        if (!targetBiz) throw new Error("Local de destino no válido.");

        let sourceMachines = JSON.parse(localStorage.getItem(`piu_machines_${sourceBusinessId}`) || '[]');
        let targetMachines = JSON.parse(localStorage.getItem(`piu_machines_${targetBusinessId}`) || '[]');

        const machIndex = sourceMachines.findIndex(m => m.id === machineId);
        if (machIndex === -1) {
            const foundInStore = store.machines.find(m => m.id === machineId);
            if (!foundInStore) throw new Error("Máquina no encontrada en el local de origen.");
            sourceMachines.push(foundInStore);
        }

        const [machineToMove] = sourceMachines.splice(machIndex >= 0 ? machIndex : 0, 1);
        machineToMove.businessId = targetBusinessId;
        machineToMove.transferredAt = new Date().toISOString();

        targetMachines.push(machineToMove);

        localStorage.setItem(`piu_machines_${sourceBusinessId}`, JSON.stringify(sourceMachines));
        localStorage.setItem(`piu_machines_${targetBusinessId}`, JSON.stringify(targetMachines));

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.MACHINES, machineId), {
                    businessId: targetBusinessId,
                    transferredAt: machineToMove.transferredAt
                });
            } catch (e) {
                console.warn("Error reasignando máquina en Firebase:", e);
            }
        }

        await store.loadBusinessData();
        store.notify();

        return machineToMove;
    }
}

export const catalogsManager = new CatalogsManager();
