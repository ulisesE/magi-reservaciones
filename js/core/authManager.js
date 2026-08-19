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
        // Verificar si la base de datos de staff necesita inicialización (seeding)
        if (isFirebaseAvailable && db) {
            try {
                // Hacer una consulta super ligera de 1 documento para verificar si hay personal creado
                const checkSnap = await getDocs(query(collection(db, COLLECTIONS.STAFF_USERS), limit(1)));
                if (checkSnap.empty) {
                    // Si está vacío, subimos los usuarios por defecto
                    console.log("🌱 Inicializando base de datos de staff con usuarios por defecto...");
                    for (const u of DEFAULT_STAFF_USERS) {
                        await setDoc(doc(db, COLLECTIONS.STAFF_USERS, u.id), u);
                    }
                }
            } catch (err) {
                console.warn("Error verificando/inicializando staff de Firebase:", err);
            }
        }

        // Cargar caché local del personal si existe
        const localStaff = localStorage.getItem('piu_staff_users_cache');
        if (localStaff) {
            try { this.staffUsers = JSON.parse(localStaff); } catch (e) { this.staffUsers = []; }
        }
        if (this.staffUsers.length === 0) {
            this.staffUsers = [...DEFAULT_STAFF_USERS];
        }

        // Cargar caché local de jugadores si existe (sin consulta a Firestore en el arranque de la app!)
        const localClients = localStorage.getItem('piu_registered_players_cache');
        if (localClients) {
            try { this.clientUsers = JSON.parse(localClients); } catch (e) { this.clientUsers = []; }
        }

        // Recuperar sesión activa si existía de forma segura y directa
        const savedSession = localStorage.getItem(AUTH_STORAGE_KEY);
        if (savedSession) {
            try {
                const user = JSON.parse(savedSession);
                let exists = null;

                // Si hay conexión, refrescar los datos del usuario directamente por su ID
                if (isFirebaseAvailable && db && user.id) {
                    try {
                        const coll = (user.role === 'SUPERADMIN' || user.role === 'MANAGER') ? COLLECTIONS.STAFF_USERS : COLLECTIONS.PLAYERS;
                        const docSnap = await getDoc(doc(db, coll, user.id));
                        if (docSnap.exists()) {
                            exists = { id: docSnap.id, ...docSnap.data() };
                        }
                    } catch (e) {
                        console.warn("Error refreshing user on init:", e);
                    }
                }

                // Fallback offline a las listas cacheadas locales
                if (!exists) {
                    exists = this.staffUsers.find(u => u.username === user.username && u.pin === user.pin);
                }
                if (!exists) {
                    exists = this.clientUsers.find(u => (u.id === user.id || u.username === user.username) && u.pin === user.pin);
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

    async loadStaffUsers() {
        if (!this.isSuperAdmin()) return this.staffUsers;
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDocs(collection(db, COLLECTIONS.STAFF_USERS));
                const loaded = [];
                snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
                this.staffUsers = loaded;
                localStorage.setItem('piu_staff_users_cache', JSON.stringify(loaded));
            } catch (err) {
                console.warn("Error loading staff from Firebase:", err);
            }
        }
        return this.staffUsers;
    }

    getStaffUsers() {
        if (this.staffUsers.length === 0) {
            const local = localStorage.getItem('piu_staff_users_cache');
            if (local) {
                try { this.staffUsers = JSON.parse(local); } catch (e) { this.staffUsers = []; }
            }
        }
        if (this.staffUsers.length === 0) {
            this.staffUsers = [...DEFAULT_STAFF_USERS];
        }
        return this.staffUsers;
    }

    getClientUsers() {
        if (this.clientUsers.length === 0) {
            const localClients = localStorage.getItem('piu_registered_players_cache');
            if (localClients) {
                try { this.clientUsers = JSON.parse(localClients); } catch (e) { this.clientUsers = []; }
            }
        }
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
        let user = null;

        if (isFirebaseAvailable && db) {
            try {
                const qStaff = query(collection(db, COLLECTIONS.STAFF_USERS), where("username", "==", uTrim));
                const staffSnap = await getDocs(qStaff);
                staffSnap.forEach(d => {
                    const data = d.data();
                    if (data.pin === pTrim) {
                        user = { id: d.id, ...data };
                    }
                });

                if (!user) {
                    const qPlayer = query(collection(db, COLLECTIONS.PLAYERS), where("username", "==", uTrim));
                    const playerSnap = await getDocs(qPlayer);
                    playerSnap.forEach(d => {
                        const data = d.data();
                        if (data.pin === pTrim) {
                            user = { id: d.id, ...data };
                        }
                    });
                }

                if (!user) {
                    const termPhone = uTrim.replace(/\D/g, '');
                    if (termPhone) {
                        const qPhone = query(collection(db, COLLECTIONS.PLAYERS), where("phone", "==", termPhone));
                        const phoneSnap = await getDocs(qPhone);
                        phoneSnap.forEach(d => {
                            const data = d.data();
                            if (data.pin === pTrim) {
                                user = { id: d.id, ...data };
                            }
                        });
                    }
                }
            } catch (err) {
                console.warn("Error login query Firestore:", err);
            }
        }

        if (!user) {
            user = DEFAULT_STAFF_USERS.find(
                u => u.username.toLowerCase() === uTrim && u.pin === pTrim
            );
            if (!user) {
                const localStaff = localStorage.getItem('piu_staff_users_cache');
                if (localStaff) {
                    try {
                        const cachedStaff = JSON.parse(localStaff);
                        user = cachedStaff.find(u => u.username.toLowerCase() === uTrim && u.pin === pTrim);
                    } catch(e) {}
                }
            }
            if (!user) {
                const localClients = localStorage.getItem('piu_registered_players_cache');
                if (localClients) {
                    try {
                        const cachedClients = JSON.parse(localClients);
                        user = cachedClients.find(u => {
                            const matchesUsername = u.username?.toLowerCase() === uTrim;
                            const matchesPhone = u.phone?.replace(/\D/g, '') === uTrim.replace(/\D/g, '');
                            return (matchesUsername || matchesPhone) && u.pin === pTrim;
                        });
                    } catch(e) {}
                }
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

        // Verificar si el usuario ya existe en Staff o en Clientes localmente (desde caché/defaults)
        const localStaff = localStorage.getItem('piu_staff_users_cache');
        let cachedStaff = DEFAULT_STAFF_USERS;
        if (localStaff) {
            try { cachedStaff = JSON.parse(localStaff); } catch(e) {}
        }
        const staffExists = cachedStaff.some(u => u.username.toLowerCase() === cleanUsername);

        const localPlayers = localStorage.getItem('piu_registered_players_cache');
        let cachedPlayers = [];
        if (localPlayers) {
            try { cachedPlayers = JSON.parse(localPlayers); } catch(e) {}
        }
        const clientExists = cachedPlayers.some(u => u.username?.toLowerCase() === cleanUsername);

        if (staffExists || clientExists) {
            throw new Error(`El nombre de usuario o GamerTag "${cleanUsername}" ya está registrado. Por favor elige otro.`);
        }

        // Verificar en tiempo real en Firebase
        if (isFirebaseAvailable && db) {
            // Verificar en StaffUsers
            const staffRef = collection(db, COLLECTIONS.STAFF_USERS);
            const qStaff = query(staffRef, where('username', '==', cleanUsername));
            const staffSnapshot = await getDocs(qStaff);
            if (!staffSnapshot.empty) {
                throw new Error(`El nombre de usuario o GamerTag "${cleanUsername}" ya está registrado. Por favor elige otro.`);
            }

            // Verificar en Players
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

        cachedPlayers.push(newPlayer);
        this.clientUsers = cachedPlayers;
        localStorage.setItem('piu_registered_players_cache', JSON.stringify(cachedPlayers));

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
        delete updatedFields.role;
        delete updatedFields.id;

        let cachedPlayers = [];
        const localPlayers = localStorage.getItem('piu_registered_players_cache');
        if (localPlayers) {
            try { cachedPlayers = JSON.parse(localPlayers); } catch(e) {}
        }
        const index = cachedPlayers.findIndex(u => u.id === clientId);
        let updatedPlayer = null;
        if (index !== -1) {
            cachedPlayers[index] = { ...cachedPlayers[index], ...updatedFields };
            updatedPlayer = cachedPlayers[index];
            localStorage.setItem('piu_registered_players_cache', JSON.stringify(cachedPlayers));
            this.clientUsers = cachedPlayers;
        }

        if (this.currentUser && this.currentUser.id === clientId) {
            this.currentUser = { ...this.currentUser, ...updatedFields };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
            if (!updatedPlayer) updatedPlayer = this.currentUser;
        }

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.PLAYERS, clientId), updatedFields);
            } catch (e) {
                console.warn("Error actualizando perfil en Firebase:", e);
            }
        }

        this.notify();
        return updatedPlayer;
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

        if (this.staffUsers.length === 0) {
            const local = localStorage.getItem('piu_staff_users_cache');
            if (local) {
                try { this.staffUsers = JSON.parse(local); } catch (e) { this.staffUsers = []; }
            }
        }

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
        if (this.staffUsers.length === 0) {
            const local = localStorage.getItem('piu_staff_users_cache');
            if (local) {
                try { this.staffUsers = JSON.parse(local); } catch (e) { this.staffUsers = []; }
            }
        }
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
        if (this.staffUsers.length === 0) {
            const local = localStorage.getItem('piu_staff_users_cache');
            if (local) {
                try { this.staffUsers = JSON.parse(local); } catch (e) { this.staffUsers = []; }
            }
        }
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
