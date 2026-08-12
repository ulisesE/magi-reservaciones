// js/core/catalogsManager.js
// Módulo de Gestión de Catálogos del Sistema (Versiones de Juego, Reglas Operativas, Reasignación de Máquinas)
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

// Versiones oficiales iniciales de Pump It Up
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

class CatalogsManager {
    constructor() {
        this.gameVersions = [];
        this.operatingRulesByBiz = {};
    }

    async init() {
        // 1. Cargar Versiones de Juego
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
    // CATÁLOGO DE VERSIONES DE JUEGO (CRUD)
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
    // REASIGNACIÓN / TRANSFERENCIA DE MÁQUINAS ENTRE NEGOCIOS
    // ==========================================
    /**
     * Transfiere una máquina de un local a otro
     * @param {string} machineId
     * @param {string} sourceBusinessId
     * @param {string} targetBusinessId
     */
    async reassignMachine(machineId, sourceBusinessId, targetBusinessId) {
        if (sourceBusinessId === targetBusinessId) {
            throw new Error("El local de destino debe ser diferente al actual.");
        }

        const targetBiz = tenantManager.getBusinessById(targetBusinessId);
        if (!targetBiz) throw new Error("Local de destino no válido.");

        // 1. Obtener lista de máquinas de origen y destino
        let sourceMachines = JSON.parse(localStorage.getItem(`piu_machines_${sourceBusinessId}`) || '[]');
        let targetMachines = JSON.parse(localStorage.getItem(`piu_machines_${targetBusinessId}`) || '[]');

        const machIndex = sourceMachines.findIndex(m => m.id === machineId);
        if (machIndex === -1) {
            // Buscar en store activo
            const foundInStore = store.machines.find(m => m.id === machineId);
            if (!foundInStore) throw new Error("Máquina no encontrada en el local de origen.");
            sourceMachines.push(foundInStore);
        }

        const [machineToMove] = sourceMachines.splice(machIndex >= 0 ? machIndex : 0, 1);
        machineToMove.businessId = targetBusinessId;
        machineToMove.transferredAt = new Date().toISOString();

        targetMachines.push(machineToMove);

        // 2. Guardar localmente
        localStorage.setItem(`piu_machines_${sourceBusinessId}`, JSON.stringify(sourceMachines));
        localStorage.setItem(`piu_machines_${targetBusinessId}`, JSON.stringify(targetMachines));

        // 3. Sincronizar en Firebase Firestore
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

        // Recargar datos en store
        await store.loadBusinessData();
        store.notify();

        return machineToMove;
    }
}

export const catalogsManager = new CatalogsManager();
