// js/core/authManager.js
// Gestor de Autenticación, Roles y Control de Acceso Multi-Nivel
// Niveles: SUPERADMIN, MANAGER (Encargado de Local), CLIENT (Cliente del Local)
import { db, isFirebaseAvailable, COLLECTIONS, collection, getDocs, setDoc, doc, updateDoc, deleteDoc, query, where, getDoc } from '../firebaseConfig.js';
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
        this.clientUsers = [];
        this.listeners = [];
    }

    async init() {
        // 1. Cargar Usuarios de Staff (Superadmin y Encargados)
        let loadedStaff = [];
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDocs(collection(db, COLLECTIONS.STAFF_USERS));
                snap.forEach(d => loadedStaff.push({ id: d.id, ...d.data() }));
            } catch (err) {
                console.warn("Error cargando staff de Firebase:", err);
            }
        }

        if (loadedStaff.length === 0) {
            const local = localStorage.getItem('piu_staff_users_cache');
            if (local) {
                try { loadedStaff = JSON.parse(local); } catch (e) { loadedStaff = []; }
            }
        }

        if (loadedStaff.length === 0) {
            loadedStaff = [...DEFAULT_STAFF_USERS];
            localStorage.setItem('piu_staff_users_cache', JSON.stringify(loadedStaff));
            if (isFirebaseAvailable && db) {
                for (const u of loadedStaff) {
                    try { await setDoc(doc(db, COLLECTIONS.STAFF_USERS, u.id), u); } catch (e) {}
                }
            }
        }

        this.staffUsers = loadedStaff;

        // 2. Cargar Clientes / Jugadores Registrados
        let loadedClients = [];
        if (isFirebaseAvailable && db) {
            try {
                const clientSnap = await getDocs(collection(db, COLLECTIONS.PLAYERS));
                clientSnap.forEach(d => loadedClients.push({ id: d.id, ...d.data() }));
            } catch (err) {
                console.warn("Error cargando jugadores de Firebase:", err);
            }
        }

        if (loadedClients.length === 0) {
            const localClients = localStorage.getItem('piu_registered_players_cache');
            if (localClients) {
                try { loadedClients = JSON.parse(localClients); } catch (e) { loadedClients = []; }
            }
        }

        this.clientUsers = loadedClients;

        // 3. Recuperar sesión activa si existía
        const savedSession = localStorage.getItem(AUTH_STORAGE_KEY);
        if (savedSession) {
            try {
                const user = JSON.parse(savedSession);
                // Buscar en staff
                let exists = this.staffUsers.find(u => u.username === user.username && u.pin === user.pin);
                // Si no, buscar en clientes
                if (!exists) {
                    if (isFirebaseAvailable && db && user.id) {
                        try {
                            const docRef = doc(db, COLLECTIONS.PLAYERS, user.id);
                            const docSnap = await getDoc(docRef);
                            if (docSnap.exists()) {
                                exists = { id: docSnap.id, ...docSnap.data() };
                            }
                        } catch (e) {
                            console.warn("Error refreshing user on init:", e);
                        }
                    }
                    if (!exists) {
                        exists = this.clientUsers.find(u => (u.id === user.id || u.username === user.username) && u.pin === user.pin);
                    }
                }

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

    getClientUsers() {
        return this.clientUsers;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getRole() {
        if (!this.currentUser) return 'CLIENT';
        return this.currentUser.role || 'CLIENT';
    }

    isSuperAdmin() {
        return !!(this.currentUser && this.currentUser.role === 'SUPERADMIN');
    }

    isManager() {
        return !!(this.currentUser && this.currentUser.role === 'MANAGER');
    }

    isStaff() {
        return !!(this.currentUser && (this.currentUser.role === 'SUPERADMIN' || this.currentUser.role === 'MANAGER'));
    }

    isClientUser() {
        return !!(this.currentUser && this.currentUser.role === 'CLIENT');
    }

    isClient() {
        return !this.currentUser || this.currentUser.role === 'CLIENT';
    }

    async login(username, pin) {
        const uTrim = username.trim().toLowerCase();
        const pTrim = pin.trim();

        // 1. Buscar en Staff (Superadmin y Encargados)
        let user = this.staffUsers.find(
            u => u.username.toLowerCase() === uTrim && u.pin === pTrim
        );

        // 2. Si no es staff, buscar en Clientes / Jugadores Registrados
        if (!user) {
            if (isFirebaseAvailable && db) {
                try {
                    const snap = await getDocs(collection(db, COLLECTIONS.PLAYERS));
                    snap.forEach(d => {
                        const data = d.data();
                        const matchesUsername = data.username?.toLowerCase() === uTrim;
                        const matchesPhone = data.phone?.replace(/\D/g, '') === uTrim.replace(/\D/g, '');
                        if ((matchesUsername || matchesPhone) && data.pin === pTrim) {
                            user = { id: d.id, ...data };
                        }
                    });
                } catch (err) {
                    console.warn("Error login query Firestore:", err);
                }
            }

            if (!user) {
                user = this.clientUsers.find(
                    u => (u.username?.toLowerCase() === uTrim || u.phone?.replace(/\D/g, '') === uTrim.replace(/\D/g, '')) && u.pin === pTrim
                );
            }
        }

        if (!user) {
            throw new Error("Usuario/GamerTag o PIN incorrecto. Verifica tus credenciales o regístrate como jugador.");
        }

        this.currentUser = user;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));

        if (user.role === 'MANAGER' && user.businessId) {
            await tenantManager.selectLocal(user.businessId);
        }

        this.notify();
        return user;
    }

    async registerClient(clientData) {
        const cleanUsername = (clientData.username || clientData.name).trim().toLowerCase().replace(/\s+/g, '_');
        const cleanPin = (clientData.pin || '').trim();

        if (!clientData.name || !cleanPin) {
            throw new Error("El nombre de jugador y el PIN de acceso son obligatorios.");
        }

        if (cleanPin.length < 4) {
            throw new Error("El PIN de seguridad debe contener al menos 4 dígitos.");
        }

        // Verificar si el usuario ya existe en Staff o en Clientes localmente
        const staffExists = this.staffUsers.some(u => u.username.toLowerCase() === cleanUsername);
        const clientExists = this.clientUsers.some(u => u.username?.toLowerCase() === cleanUsername);

        if (staffExists || clientExists) {
            throw new Error(`El nombre de usuario o GamerTag "${cleanUsername}" ya está registrado. Por favor elige otro.`);
        }

        // Verificar en tiempo real en Firebase
        if (isFirebaseAvailable && db) {
            const playersRef = collection(db, COLLECTIONS.PLAYERS);
            const q = query(playersRef, where('username', '==', cleanUsername));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                throw new Error(`El nombre de usuario o GamerTag "${cleanUsername}" ya está registrado. Por favor elige otro.`);
            }
        }

        const newPlayer = {
            id: 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            username: cleanUsername,
            pin: cleanPin,
            name: clientData.name.trim(),
            role: 'CLIENT',
            phone: clientData.phone?.trim() || '',
            email: clientData.email?.trim() || '',
            avatar: clientData.avatar || '🕺',
            skillLevel: clientData.skillLevel || 'Liga C',
            preferredMode: clientData.preferredMode || 'Single / Double',
            notes: clientData.notes?.trim() || 'Jugador de la comunidad Pump It Up',
            loyaltyPoints: 0,
            loyaltyVisits: 0,
            loyaltyTier: 'Bronce',
            createdAt: new Date().toISOString()
        };

        this.clientUsers.push(newPlayer);
        localStorage.setItem('piu_registered_players_cache', JSON.stringify(this.clientUsers));

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.PLAYERS, newPlayer.id), newPlayer);
            } catch (e) {
                console.warn("Error guardando jugador en Firebase:", e);
            }
        }

        // Iniciar sesión automáticamente
        this.currentUser = newPlayer;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newPlayer));

        this.notify();
        return newPlayer;
    }

    async updateClientProfile(clientId, updatedFields) {
        const index = this.clientUsers.findIndex(u => u.id === clientId);
        if (index === -1) {
            throw new Error("Perfil de cliente no encontrado.");
        }

        // Validar que no cambie su rol
        delete updatedFields.role;
        delete updatedFields.id;

        this.clientUsers[index] = { ...this.clientUsers[index], ...updatedFields };
        localStorage.setItem('piu_registered_players_cache', JSON.stringify(this.clientUsers));

        if (this.currentUser && this.currentUser.id === clientId) {
            this.currentUser = { ...this.currentUser, ...updatedFields };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
        }

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.PLAYERS, clientId), updatedFields);
            } catch (e) {
                console.warn("Error actualizando perfil en Firebase:", e);
            }
        }

        this.notify();
        return this.clientUsers[index];
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem(AUTH_STORAGE_KEY);
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

    getCurrentUserDiscount(business) {
        if (!this.currentUser || this.currentUser.role !== 'CLIENT') return 0;
        if (!business || !business.loyaltyEnabled) return 0;

        const loyaltyMap = this.currentUser.loyalty || {};
        const bizLoyalty = loyaltyMap[business.id] || { points: 0, visits: 0, tier: 'Bronce' };

        const activeMode = business.loyaltyMode || 'POINTS';
        const val = activeMode === 'VISITS' ? (bizLoyalty.visits || 0) : (bizLoyalty.points || 0);

        if (activeMode === 'VISITS') {
            if (val >= 60) return 0.15; // Platino
            if (val >= 30) return 0.10; // Oro
            if (val >= 10) return 0.05; // Plata
        } else {
            if (val >= 600) return 0.15; // Platino
            if (val >= 300) return 0.10; // Oro
            if (val >= 100) return 0.05; // Plata
        }
        return 0; // Bronce
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
