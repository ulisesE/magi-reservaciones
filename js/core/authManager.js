// js/core/authManager.js
// Gestor de Autenticación, Roles y Control de Acceso Multi-Nivel con Protección Criptográfica SHA-256
// Niveles: SUPERADMIN, MANAGER (Encargado de Local), CLIENT (Cliente del Local)
import { db, isFirebaseAvailable, COLLECTIONS, collection, getDocs, setDoc, doc, updateDoc, deleteDoc, query, where, getDoc, limit } from '../firebaseConfig.js';
import { tenantManager } from './tenantManager.js';
import { loyaltyManager } from './loyaltyManager.js';
import { hashPin, verifyPin, sanitizeUserSession } from './securityUtils.js';

const AUTH_STORAGE_KEY = 'piu_auth_current_user_v1';

export const DEFAULT_STAFF_USERS = [
    {
        id: 'usr_superadmin',
        username: 'superadmin',
        pinHash: 'sha256_e1069f1bf3fa201b131979cfa4ef5cb0a221f7584024508933faeb0ce6c459f0', // PIN 8888 hasheado
        name: 'Super Administrador',
        role: 'SUPERADMIN',
        businessId: null,
        email: 'admin@piuhub.com',
        avatar: '👑'
    },
    {
        id: 'usr_encargado_centro',
        username: 'encargado_centro',
        pinHash: 'sha256_9c22eb4f89d38c117d917f8b965f3fef8cbb72c0199e46a782bfa881b953d6ab', // PIN 1234 hasheado
        name: 'Carlos (Encargado Centro)',
        role: 'MANAGER',
        businessId: 'biz_piu_centro',
        email: 'centro@piuhub.com',
        avatar: '🕹️'
    },
    {
        id: 'usr_encargado_galaxy',
        username: 'encargado_galaxy',
        pinHash: 'sha256_fb17f90f235b376b6b71bfb5c2a11b643a059b027ff7799d19a3b6f00db12b32', // PIN 5678 hasheado
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
        // Pre-calcular hashes para los usuarios de semilla
        for (const u of DEFAULT_STAFF_USERS) {
            if (!u.pinHash && u.pin) {
                u.pinHash = await hashPin(u.pin);
                delete u.pin;
            }
        }

        // Verificar si la base de datos de staff necesita inicialización (seeding)
        if (isFirebaseAvailable && db) {
            try {
                const checkSnap = await getDocs(query(collection(db, COLLECTIONS.STAFF_USERS), limit(1)));
                if (checkSnap.empty) {
                    console.log("🌱 Inicializando base de datos de staff con usuarios protegidos por hash...");
                    for (const u of DEFAULT_STAFF_USERS) {
                        const secureUser = { ...u };
                        delete secureUser.pin;
                        if (!secureUser.pinHash && u.pin) {
                            secureUser.pinHash = await hashPin(u.pin);
                        }
                        await setDoc(doc(db, COLLECTIONS.STAFF_USERS, u.id), secureUser);
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

        // Cargar caché local de jugadores si existe
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

                if (exists) {
                    this.currentUser = sanitizeUserSession(exists);
                } else {
                    this.currentUser = sanitizeUserSession(user);
                }
            } catch (e) {
                this.currentUser = null;
            }
        }

        return this.currentUser;
    }

    async loadStaffUsers() {
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDocs(collection(db, COLLECTIONS.STAFF_USERS));
                const loaded = [];
                snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
                if (loaded.length > 0) {
                    this.staffUsers = loaded;
                    localStorage.setItem('piu_staff_users_cache', JSON.stringify(loaded));

                    if (this.currentUser && (this.currentUser.role === 'SUPERADMIN' || this.currentUser.role === 'MANAGER')) {
                        const activeInLoaded = loaded.find(u => u.id === this.currentUser.id);
                        if (activeInLoaded) {
                            this.currentUser = sanitizeUserSession({ ...this.currentUser, ...activeInLoaded });
                            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
                        }
                    }
                }
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
        let candidateUsers = [];

        // 1. Buscar en Firestore
        if (isFirebaseAvailable && db) {
            try {
                // Staff por username
                const qStaff = query(collection(db, COLLECTIONS.STAFF_USERS), where("username", "==", uTrim));
                const staffSnap = await getDocs(qStaff);
                staffSnap.forEach(d => candidateUsers.push({ id: d.id, ...d.data(), _coll: COLLECTIONS.STAFF_USERS }));

                // Jugador por username
                const qPlayer = query(collection(db, COLLECTIONS.PLAYERS), where("username", "==", uTrim));
                const playerSnap = await getDocs(qPlayer);
                playerSnap.forEach(d => candidateUsers.push({ id: d.id, ...d.data(), _coll: COLLECTIONS.PLAYERS }));

                // Jugador por teléfono
                const termPhone = uTrim.replace(/\D/g, '');
                if (termPhone) {
                    const qPhone = query(collection(db, COLLECTIONS.PLAYERS), where("phone", "==", termPhone));
                    const phoneSnap = await getDocs(qPhone);
                    phoneSnap.forEach(d => {
                        if (!candidateUsers.some(c => c.id === d.id)) {
                            candidateUsers.push({ id: d.id, ...d.data(), _coll: COLLECTIONS.PLAYERS });
                        }
                    });
                }
            } catch (err) {
                console.warn("Error login query Firestore:", err);
            }
        }

        // Fallback local a semillas o caché si no se encontraron en Firestore
        if (candidateUsers.length === 0) {
            DEFAULT_STAFF_USERS.forEach(u => {
                if (u.username.toLowerCase() === uTrim) {
                    candidateUsers.push({ ...u });
                }
            });

            const localStaff = localStorage.getItem('piu_staff_users_cache');
            if (localStaff) {
                try {
                    const cached = JSON.parse(localStaff);
                    cached.forEach(u => {
                        if (u.username.toLowerCase() === uTrim && !candidateUsers.some(c => c.id === u.id)) {
                            candidateUsers.push({ ...u });
                        }
                    });
                } catch(e) {}
            }

            const localClients = localStorage.getItem('piu_registered_players_cache');
            if (localClients) {
                try {
                    const cached = JSON.parse(localClients);
                    cached.forEach(u => {
                        const matchesUsername = u.username?.toLowerCase() === uTrim;
                        const matchesPhone = u.phone?.replace(/\D/g, '') === uTrim.replace(/\D/g, '');
                        if ((matchesUsername || matchesPhone) && !candidateUsers.some(c => c.id === u.id)) {
                            candidateUsers.push({ ...u });
                        }
                    });
                } catch(e) {}
            }
        }

        // 2. Validar credenciales de forma segura con verifyPin
        for (const candidate of candidateUsers) {
            const storedPinOrHash = candidate.pinHash || candidate.pin;
            const isValid = await verifyPin(pTrim, storedPinOrHash);
            if (isValid) {
                user = candidate;

                // Auto-migración si el usuario aún tenía PIN en texto plano
                if (!user.pinHash && user.pin) {
                    const newHash = await hashPin(pTrim);
                    user.pinHash = newHash;
                    delete user.pin;

                    if (isFirebaseAvailable && db && user._coll && user.id) {
                        try {
                            await updateDoc(doc(db, user._coll, user.id), {
                                pinHash: newHash,
                                pin: deleteDoc // eliminar campo legado
                            });
                        } catch(e) {}
                    }
                }
                break;
            }
        }

        if (!user) {
            throw new Error("Usuario/GamerTag o PIN incorrecto. Verifica tus credenciales o regístrate como jugador.");
        }

        // Sanitizar sesión para nunca exponer PIN ni hash en LocalStorage
        const safeSessionUser = sanitizeUserSession(user);
        this.currentUser = safeSessionUser;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeSessionUser));

        if (user.role === 'MANAGER' && user.businessId) {
            await tenantManager.selectLocal(user.businessId);
        }

        this.notify();
        return safeSessionUser;
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

        // Verificar unicidad de username
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

        if (isFirebaseAvailable && db) {
            const staffRef = collection(db, COLLECTIONS.STAFF_USERS);
            const qStaff = query(staffRef, where('username', '==', cleanUsername));
            const staffSnapshot = await getDocs(qStaff);
            if (!staffSnapshot.empty) {
                throw new Error(`El nombre de usuario o GamerTag "${cleanUsername}" ya está registrado. Por favor elige otro.`);
            }

            const playersRef = collection(db, COLLECTIONS.PLAYERS);
            const q = query(playersRef, where('username', '==', cleanUsername));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                throw new Error(`El nombre de usuario o GamerTag "${cleanUsername}" ya está registrado. Por favor elige otro.`);
            }
        }

        // Hashear el PIN de forma segura antes de guardar
        const securePinHash = await hashPin(cleanPin);

        const newPlayer = {
            id: 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            username: cleanUsername,
            pinHash: securePinHash,
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

        const safeSession = sanitizeUserSession(newPlayer);
        this.currentUser = safeSession;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeSession));

        this.notify();
        return safeSession;
    }

    async updateClientProfile(clientId, updatedFields) {
        delete updatedFields.role;
        delete updatedFields.id;

        // Si se actualizó el PIN, hashearlo
        if (updatedFields.pin) {
            updatedFields.pinHash = await hashPin(updatedFields.pin);
            delete updatedFields.pin;
        }

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
            this.currentUser = sanitizeUserSession({ ...this.currentUser, ...updatedFields });
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
        const pinHash = await hashPin(userData.pin);

        const newStaff = {
            id: 'usr_' + Date.now(),
            username: userData.username.trim().toLowerCase().replace(/\s+/g, '_'),
            pinHash,
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
        if (updatedFields.pin) {
            updatedFields.pinHash = await hashPin(updatedFields.pin);
            delete updatedFields.pin;
        }

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

        if (this.currentUser && this.currentUser.id === userId) {
            this.currentUser = sanitizeUserSession({ ...this.currentUser, ...updatedFields });
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
        }

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
                console.warn("Error eliminando staff de Firebase:", e);
            }
        }

        this.notify();
        return true;
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(l => l(this.currentUser));
    }
}

export const authManager = new AuthManager();
