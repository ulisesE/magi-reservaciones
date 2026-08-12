// js/core/authManager.js
// Gestor de Autenticación, Roles y Control de Acceso Multi-Nivel
// Niveles: SUPERADMIN, MANAGER (Encargado de Local), CLIENT (Cliente del Local)
import { db, isFirebaseAvailable, COLLECTIONS, collection, getDocs, setDoc, doc, updateDoc, deleteDoc } from '../firebaseConfig.js';
import { tenantManager } from './tenantManager.js';

const AUTH_STORAGE_KEY = 'piu_auth_current_user_v1';

export const DEFAULT_STAFF_USERS = [
    {
        id: 'usr_superadmin',
        username: 'superadmin',
        pin: '8888',
        name: 'Super Administrador',
        role: 'SUPERADMIN',
        businessId: null,
        email: 'admin@piuhub.com',
        avatar: '👑'
    },
    {
        id: 'usr_encargado_centro',
        username: 'encargado_centro',
        pin: '1234',
        name: 'Carlos (Encargado Centro)',
        role: 'MANAGER',
        businessId: 'biz_piu_centro',
        email: 'centro@piuhub.com',
        avatar: '🕹️'
    },
    {
        id: 'usr_encargado_galaxy',
        username: 'encargado_galaxy',
        pin: '5678',
        name: 'Elena (Encargada Galaxy Norte)',
        role: 'MANAGER',
        businessId: 'biz_arcade_galaxy',
        email: 'galaxy@piuhub.com',
        avatar: '⚡'
    }
];

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.staffUsers = [];
        this.listeners = [];
    }

    async init() {
        let loaded = [];
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDocs(collection(db, COLLECTIONS.STAFF_USERS));
                snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
            } catch (err) {
                console.warn("Error cargando staff de Firebase:", err);
            }
        }

        if (loaded.length === 0) {
            const local = localStorage.getItem('piu_staff_users_cache');
            if (local) {
                try { loaded = JSON.parse(local); } catch (e) { loaded = []; }
            }
        }

        if (loaded.length === 0) {
            loaded = [...DEFAULT_STAFF_USERS];
            localStorage.setItem('piu_staff_users_cache', JSON.stringify(loaded));
            if (isFirebaseAvailable && db) {
                for (const u of loaded) {
                    try { await setDoc(doc(db, COLLECTIONS.STAFF_USERS, u.id), u); } catch (e) {}
                }
            }
        }

        this.staffUsers = loaded;

        // Recuperar sesión activa si existía
        const savedSession = localStorage.getItem(AUTH_STORAGE_KEY);
        if (savedSession) {
            try {
                const user = JSON.parse(savedSession);
                const exists = this.staffUsers.find(u => u.username === user.username && u.pin === user.pin);
                if (exists) {
                    this.currentUser = exists;
                    if (exists.role === 'MANAGER' && exists.businessId) {
                        await tenantManager.selectLocal(exists.businessId);
                    }
                }
            } catch (e) {
                this.currentUser = null;
            }
        }

        return this.currentUser;
    }

    getStaffUsers() {
        return this.staffUsers;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getRole() {
        if (!this.currentUser) return 'CLIENT';
        return this.currentUser.role;
    }

    isSuperAdmin() {
        return this.currentUser && this.currentUser.role === 'SUPERADMIN';
    }

    isManager() {
        return this.currentUser && this.currentUser.role === 'MANAGER';
    }

    isClient() {
        return !this.currentUser;
    }

    async login(username, pin) {
        const user = this.staffUsers.find(
            u => u.username.toLowerCase() === username.trim().toLowerCase() && u.pin === pin.trim()
        );

        if (!user) {
            throw new Error("Usuario o PIN incorrecto. Verifica tus credenciales.");
        }

        this.currentUser = user;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));

        if (user.role === 'MANAGER' && user.businessId) {
            await tenantManager.selectLocal(user.businessId);
        }

        this.notify();
        return user;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem(AUTH_STORAGE_KEY);
        tenantManager.clearSelectedLocal();
        this.notify();
    }

    async createStaffManager(userData) {
        const newStaff = {
            id: 'usr_' + Date.now(),
            username: userData.username.trim().toLowerCase().replace(/\s+/g, '_'),
            pin: userData.pin.trim(),
            name: userData.name.trim(),
            role: 'MANAGER',
            businessId: userData.businessId,
            email: userData.email?.trim() || '',
            avatar: userData.avatar || '🕹️',
            createdAt: new Date().toISOString()
        };

        this.staffUsers.push(newStaff);
        localStorage.setItem('piu_staff_users_cache', JSON.stringify(this.staffUsers));

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.STAFF_USERS, newStaff.id), newStaff);
            } catch (e) {
                console.warn("Error guardando staff en Firebase:", e);
            }
        }

        this.notify();
        return newStaff;
    }

    async updateStaffManager(userId, updatedFields) {
        const index = this.staffUsers.findIndex(u => u.id === userId);
        if (index === -1) return null;

        this.staffUsers[index] = { ...this.staffUsers[index], ...updatedFields };
        localStorage.setItem('piu_staff_users_cache', JSON.stringify(this.staffUsers));

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.STAFF_USERS, userId), updatedFields);
            } catch (e) {
                console.warn("Error editando staff en Firebase:", e);
            }
        }

        this.notify();
        return this.staffUsers[index];
    }

    async deleteStaffManager(userId) {
        this.staffUsers = this.staffUsers.filter(u => u.id !== userId);
        localStorage.setItem('piu_staff_users_cache', JSON.stringify(this.staffUsers));

        if (isFirebaseAvailable && db) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.STAFF_USERS, userId));
            } catch (e) {
                console.warn("Error borrando staff en Firebase:", e);
            }
        }

        this.notify();
        return true;
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notify() {
        this.listeners.forEach(cb => cb(this.currentUser, this.getRole()));
    }
}

export const authManager = new AuthManager();
