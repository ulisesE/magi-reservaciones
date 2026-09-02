import { 
    db, 
    auth,
    signInAnonymously,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    setDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    getDoc, 
    limit, 
    onSnapshot 
} from '../firebaseConfig.js';
import { tenantManager } from './tenantManager.js';
import { loyaltyManager } from './loyaltyManager.js';
import { hashPin, verifyPin, sanitizeUserSession } from './securityUtils.js';
import { auditLogger, AUDIT_ACTIONS } from './auditLogger.js';
import { handleAppError } from './errorHandler.js';

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
        this.unsubscribeStaff = null;
    }

    async init() {
        // Pre-calcular hashes para los usuarios de semilla (solo respaldo)
        for (const u of DEFAULT_STAFF_USERS) {
            if (!u.pinHash && u.pin) {
                u.pinHash = await hashPin(u.pin);
                delete u.pin;
            }
        }

        // 1. Control reactivo real del estado de sesión con onAuthStateChanged
        if (isFirebaseAvailable && auth) {
            onAuthStateChanged(auth, async (fbUser) => {
                if (fbUser) {
                    console.log(`🔐 Sesión activa en Firebase Auth: UID = ${fbUser.uid} (${fbUser.email || 'anónimo'})`);
                    try {
                        // Sincronizar automáticamente el perfil de Staff desde Firestore
                        const staffDoc = await getDoc(doc(db, COLLECTIONS.STAFF_USERS, fbUser.uid));
                        if (staffDoc.exists()) {
                            const staffData = staffDoc.data();
                            this.currentUser = sanitizeUserSession({ id: staffDoc.id, ...staffData });
                            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
                            this.notify();
                            return;
                        }

                        // Sincronizar automáticamente el perfil de Jugador desde Firestore
                        const playerDoc = await getDoc(doc(db, COLLECTIONS.PLAYERS, fbUser.uid));
                        if (playerDoc.exists()) {
                            const playerData = playerDoc.data();
                            this.currentUser = sanitizeUserSession({ id: playerDoc.id, ...playerData });
                            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
                            this.notify();
                            return;
                        }
                    } catch (err) {
                        console.warn("Advertencia sincronizando sesión desde Firestore:", err);
                    }
                } else {
                    // Si Firebase Auth no tiene usuario activo, purgar cualquier sesión de Staff
                    if (this.currentUser && (this.currentUser.role === 'SUPERADMIN' || this.currentUser.role === 'MANAGER')) {
                        console.warn("⚠️ Firebase Auth desconectado. Purgando sesión de Staff.");
                        this.currentUser = null;
                        localStorage.removeItem(AUTH_STORAGE_KEY);
                        this.notify();
                    }
                }
            });
        }

        // 2. Cargar caché local y semillas
        const localStaff = localStorage.getItem('piu_staff_users_cache');
        if (localStaff) {
            try { this.staffUsers = JSON.parse(localStaff); } catch (e) { this.staffUsers = []; }
        }
        if (this.staffUsers.length === 0) {
            this.staffUsers = [...DEFAULT_STAFF_USERS];
        }

        const localClients = localStorage.getItem('piu_registered_players_cache');
        if (localClients) {
            try { this.clientUsers = JSON.parse(localClients); } catch (e) { this.clientUsers = []; }
        }

        // Recuperar y validar sesión activa contra Firestore y Firebase Auth (Cero sesiones no verificadas)
        const savedSession = localStorage.getItem(AUTH_STORAGE_KEY);
        if (savedSession) {
            try {
                const user = JSON.parse(savedSession);
                let verifiedUser = null;
                const isStaff = user.role === 'SUPERADMIN' || user.role === 'MANAGER';

                if (isFirebaseAvailable && db && user.id) {
                    try {
                        const coll = isStaff ? COLLECTIONS.STAFF_USERS : COLLECTIONS.PLAYERS;
                        // Para staff, verificar que exista el documento y que haya sesión en Firebase Auth
                        const targetDocId = user.authUid || user.id;
                        const docSnap = await getDoc(doc(db, coll, targetDocId));
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            // Verificar que el rol en Firestore sea exactamente el esperado
                            if (data.role === user.role) {
                                verifiedUser = { id: docSnap.id, ...data };
                            }
                        }
                    } catch (e) {
                        console.warn("Error verificando usuario guardado en Firestore:", e);
                    }
                }

                if (verifiedUser) {
                    // Para staff/manager, exigir que auth.currentUser esté activo en Firebase Auth
                    if (isStaff && (!auth || !auth.currentUser)) {
                        console.warn("⚠️ Sesión de Staff requiere re-autenticación en Firebase Auth. Cerrando sesión local.");
                        this.currentUser = null;
                        localStorage.removeItem(AUTH_STORAGE_KEY);
                    } else {
                        this.currentUser = sanitizeUserSession(verifiedUser);
                        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
                        this.syncRealtimeUsers();
                    }
                } else {
                    // Purgar credenciales inválidas o manipuladas de LocalStorage
                    console.warn("⚠️ Sesión local no verificada en Firestore. Purgando credenciales de LocalStorage.");
                    this.currentUser = null;
                    localStorage.removeItem(AUTH_STORAGE_KEY);
                }
            } catch (e) {
                this.currentUser = null;
                localStorage.removeItem(AUTH_STORAGE_KEY);
            }
        }

        return this.currentUser;
    }

    syncRealtimeUsers() {
        if (!isFirebaseAvailable || !db || !this.isStaff()) return;

        try {
            this.unsubscribeStaff?.();
            this.unsubscribeStaff = onSnapshot(collection(db, COLLECTIONS.STAFF_USERS), (snapshot) => {
                if (!snapshot.empty) {
                    const rawLoaded = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    this.staffUsers = rawLoaded;
                    localStorage.setItem('piu_staff_users_cache', JSON.stringify(rawLoaded));
                    this.notify();
                }
            }, (err) => console.warn("Sincronización staff:", err.message));

            this.unsubscribePlayers?.();
            this.unsubscribePlayers = onSnapshot(collection(db, COLLECTIONS.PLAYERS), (snapshot) => {
                const loaded = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                this.clientUsers = loaded;
                localStorage.setItem('piu_registered_players_cache', JSON.stringify(loaded));
                this.notify();
            }, (err) => console.warn("Sincronización jugadores:", err.message));
        } catch (e) {
            console.warn("Error iniciando sincronización de usuarios:", e);
        }
    }

    async fetchClientUsers() {
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDocs(collection(db, COLLECTIONS.PLAYERS));
                const loaded = [];
                snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
                this.clientUsers = loaded;
                localStorage.setItem('piu_registered_players_cache', JSON.stringify(loaded));
            } catch (e) {
                console.warn("Error fetching client users from Firestore:", e);
            }
        }
        return this.getClientUsers();
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
                        const activeInLoaded = loaded.find(u => u.id === this.currentUser.id || (this.currentUser.role === 'SUPERADMIN' && u.role === 'SUPERADMIN'));
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

        // 1. Buscar en Firestore (Mandante principal) y semillas locales
        if (isFirebaseAvailable && db) {
            try {
                // Buscar en Staff
                const qStaffUser = query(collection(db, COLLECTIONS.STAFF_USERS), where("username", "==", uTrim));
                const staffSnap = await getDocs(qStaffUser);
                staffSnap.forEach(d => candidateUsers.push({ id: d.id, ...d.data(), _coll: COLLECTIONS.STAFF_USERS }));

                if (candidateUsers.length === 0) {
                    const qStaffEmail = query(collection(db, COLLECTIONS.STAFF_USERS), where("email", "==", uTrim));
                    const emailSnap = await getDocs(qStaffEmail);
                    emailSnap.forEach(d => candidateUsers.push({ id: d.id, ...d.data(), _coll: COLLECTIONS.STAFF_USERS }));
                }

                // Buscar en Jugadores
                const qPlayerUser = query(collection(db, COLLECTIONS.PLAYERS), where("username", "==", uTrim));
                const playerSnap = await getDocs(qPlayerUser);
                playerSnap.forEach(d => candidateUsers.push({ id: d.id, ...d.data(), _coll: COLLECTIONS.PLAYERS }));

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
                console.warn("Búsqueda online falló, usando candidatos locales:", err);
            }
        }

        // Incorporar semillas locales y caché
        const localStaff = this.staffUsers.length > 0 ? this.staffUsers : DEFAULT_STAFF_USERS;
        const localPlayers = this.clientUsers || [];

        localStaff.forEach(d => {
            if (!candidateUsers.some(c => c.username?.toLowerCase() === d.username?.toLowerCase())) {
                candidateUsers.push({ ...d, _coll: COLLECTIONS.STAFF_USERS });
            }
        });
        localPlayers.forEach(d => {
            if (!candidateUsers.some(c => c.id === d.id)) {
                candidateUsers.push({ ...d, _coll: COLLECTIONS.PLAYERS });
            }
        });

        // 2. Validar credenciales contra el hash del PIN o PIN plano legado
        for (const candidate of candidateUsers) {
            const matchesUsername = candidate.username?.toLowerCase() === uTrim || candidate.email?.toLowerCase() === uTrim;
            const matchesPhone = candidate.phone && candidate.phone.replace(/\D/g, '') === uTrim.replace(/\D/g, '');
            if (matchesUsername || matchesPhone) {
                const storedPinOrHash = candidate.pinHash || candidate.pin;
                const isValid = await verifyPin(pTrim, storedPinOrHash);
                if (isValid) {
                    user = candidate;
                    break;
                }
            }
        }

        if (!user) {
            throw new Error("Usuario/GamerTag o PIN incorrecto. Verifica tus credenciales o solicita registro.");
        }

        const isStaff = user.role === 'SUPERADMIN' || user.role === 'MANAGER';

        // 3. Autenticación OBLIGATORIA en Firebase Auth (signInWithEmailAndPassword exclusivamente, NUNCA crear aquí)
        let authUid = null;
        if (!isFirebaseAvailable || !auth) {
            if (isStaff) {
                throw new Error("Conexión con Firebase no disponible. Las sesiones de Staff requieren autenticación activa con el servidor.");
            }
        } else {
            const fbEmail = user.email || `${uTrim}@piuhub.internal`;
            const fbPassword = await hashPin(`${pTrim}_MAGI_PIU_SECURE_AUTH_PEPPER_2026_SALT`);

            try {
                if (auth.currentUser) {
                    await signOut(auth);
                }
                const cred = await signInWithEmailAndPassword(auth, fbEmail, fbPassword);
                authUid = cred.user.uid;
            } catch (authErr) {
                // Si la cuenta aún no existe en Firebase Auth pero el PIN fue verificado contra Firestore/Seed, auto-crearla en Auth
                if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
                    try {
                        const newCred = await createUserWithEmailAndPassword(auth, fbEmail, fbPassword);
                        authUid = newCred.user.uid;
                    } catch (createErr) {
                        if (createErr.code === 'auth/email-already-in-use') {
                            try {
                                const retryCred = await signInWithEmailAndPassword(auth, fbEmail, fbPassword);
                                authUid = retryCred.user.uid;
                            } catch (e) {}
                        }
                    }
                }

                if (!authUid && isStaff) {
                    if (authErr.code === 'auth/configuration-not-found' || authErr.message?.includes('configuration-not-found')) {
                        throw new Error("El proveedor 'Correo electrónico/contraseña' está desactivado en Firebase Authentication. Habilítalo en la consola de Firebase: Authentication ➔ Sign-in method ➔ Correo electrónico/contraseña ➔ Habilitar.");
                    }
                    throw new Error(`Acceso denegado: Falló la autenticación en Firebase Auth (${authErr.code || authErr.message}).`);
                }
            }

            // Para Staff/Manager: La autoridad de permisos reside 100% en Firestore
            if (isStaff) {
                if (!authUid) {
                    throw new Error("No se pudo obtener una identidad criptográfica válida de Firebase Auth. Acceso de Staff denegado.");
                }

                if (db) {
                    const staffDocSnap = await getDoc(doc(db, COLLECTIONS.STAFF_USERS, authUid));
                    if (staffDocSnap.exists()) {
                        // AUTORIDAD DEL SERVIDOR: role y businessId provienen directamente de Firestore
                        const serverData = staffDocSnap.data();
                        user = {
                            id: authUid,
                            authUid: authUid,
                            ...serverData,
                            role: serverData.role,
                            businessId: serverData.businessId || null
                        };
                    } else {
                        // Migración controlada de cuentas semilla legacy (usr_xxx) a authUid
                        const legacyDocId = (user.id && user.id !== authUid) ? user.id : null;
                        if (legacyDocId) {
                            const legacySnap = await getDoc(doc(db, COLLECTIONS.STAFF_USERS, legacyDocId));
                            if (legacySnap.exists()) {
                                const legacyData = legacySnap.data();
                                user = {
                                    id: authUid,
                                    authUid: authUid,
                                    ...legacyData,
                                    role: legacyData.role,
                                    businessId: legacyData.businessId || null
                                };
                                // Asegurar que el PIN quede hasheado de forma segura y sin texto plano
                                if (!user.pinHash) {
                                    user.pinHash = await hashPin(pTrim);
                                }
                                delete user.pin;

                                await setDoc(doc(db, COLLECTIONS.STAFF_USERS, authUid), user, { merge: true });
                                try {
                                    await deleteDoc(doc(db, COLLECTIONS.STAFF_USERS, legacyDocId));
                                    console.log(`🧹 Migrado exitosamente Staff de "${legacyDocId}" a UID canónico "${authUid}".`);
                                } catch (delErr) {
                                    console.warn(`Advertencia al limpiar documento legacy ${legacyDocId}:`, delErr);
                                }
                            } else {
                                throw new Error("Acceso denegado: El usuario no existe en la plantilla de personal de Firestore.");
                            }
                        } else {
                            throw new Error("Acceso denegado: Tu cuenta de Firebase Auth no está autorizada en piu_staff_users.");
                        }
                    }
                }
            } else if (authUid) {
                user.authUid = authUid;
                // Migración progresiva y silenciosa para jugadores de versiones anteriores
                if (db && user.id) {
                    try {
                        const playerUpdate = { authUid: authUid };
                        if (!user.pinHash) {
                            playerUpdate.pinHash = await hashPin(pTrim);
                        }
                        await updateDoc(doc(db, COLLECTIONS.PLAYERS, user.id), playerUpdate);
                    } catch (e) {
                        console.warn("Actualización progresiva de jugador:", e);
                    }
                }
            }
        }

        // Sanitizar sesión para nunca exponer PIN ni hash en LocalStorage
        const safeSessionUser = sanitizeUserSession(user);
        this.currentUser = safeSessionUser;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeSessionUser));

        if (user.role === 'MANAGER' && user.businessId) {
            await tenantManager.selectLocal(user.businessId);
        }

        // Registrar evento de auditoría de inicio de sesión tipificado por rol
        const isStaffUser = safeSessionUser.role === 'SUPERADMIN' || safeSessionUser.role === 'MANAGER';
        const loginAction = isStaffUser ? AUDIT_ACTIONS.STAFF_LOGIN : AUDIT_ACTIONS.CLIENT_LOGIN;

        await auditLogger.logEvent({
            businessId: safeSessionUser.businessId || 'global',
            action: loginAction,
            actor: safeSessionUser,
            details: `Inicio de sesión exitoso como ${safeSessionUser.role}: ${safeSessionUser.name} (@${safeSessionUser.username || ''})`
        });

        this.syncRealtimeUsers();
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
        let cachedStaff = this.staffUsers.length > 0 ? this.staffUsers : DEFAULT_STAFF_USERS;
        if (localStaff) {
            try { cachedStaff = JSON.parse(localStaff); } catch(e) {}
        }
        const staffExists = cachedStaff.some(u => u.username?.toLowerCase() === cleanUsername);

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
            try {
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
            } catch (err) {
                handleAppError(err, { context: "Error validando unicidad de usuario", rethrow: true });
            }
        }

        // Hashear el PIN de forma segura antes de guardar
        const securePinHash = await hashPin(cleanPin);

        // Crear sesión en Firebase Auth para que request.auth.uid coincida con playerId
        let authUid = null;
        if (isFirebaseAvailable && auth) {
            const fbEmail = clientData.email?.trim() || `${cleanUsername}@player.piuhub.internal`;
            const fbPassword = await hashPin(`${cleanPin}_MAGI_PIU_SECURE_AUTH_PEPPER_2026_SALT`);
            try {
                if (auth.currentUser) {
                    await signOut(auth);
                }
                const cred = await createUserWithEmailAndPassword(auth, fbEmail, fbPassword);
                authUid = cred.user.uid;
            } catch (authErr) {
                if (authErr.code === 'auth/email-already-in-use') {
                    try {
                        const cred = await signInWithEmailAndPassword(auth, fbEmail, fbPassword);
                        authUid = cred.user.uid;
                    } catch (e) {}
                }
            }
        }

        const newPlayerId = authUid || (isFirebaseAvailable && db ? doc(collection(db, COLLECTIONS.PLAYERS)).id : `player_${Date.now()}`);

        const newPlayer = {
            id: newPlayerId,
            authUid: authUid,
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

        // 1. FIRESTORE ES PRIMERO
        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.PLAYERS, newPlayer.id), newPlayer, { merge: true });
            } catch (e) {
                handleAppError(e, { context: "Error guardando nuevo jugador en Firestore", showToast: true, rethrow: true });
            }
        }

        // 2. Actualizar caché local tras confirmación de Firestore
        const existingPlayers = this.clientUsers;
        if (!existingPlayers.some(p => p.id === newPlayer.id)) {
            existingPlayers.push(newPlayer);
            this.clientUsers = existingPlayers;
            localStorage.setItem('piu_registered_players_cache', JSON.stringify(existingPlayers));
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
        delete updatedFields.accounts;
        delete updatedFields.loyaltyPoints;

        // Si se actualizó el PIN, hashearlo
        if (updatedFields.pin) {
            updatedFields.pinHash = await hashPin(updatedFields.pin);
            delete updatedFields.pin;
        }

        // 1. FIRESTORE ES PRIMERO
        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.PLAYERS, clientId), updatedFields, { merge: true });
            } catch (e) {
                handleAppError(e, { context: "Error actualizando perfil en Firestore", showToast: true, rethrow: true });
            }
        }

        // 2. Actualizar memoria y caché local tras confirmación de Firestore
        let cachedPlayers = this.clientUsers;
        const index = cachedPlayers.findIndex(u => u.id === clientId);
        let updatedPlayer = null;
        if (index !== -1) {
            cachedPlayers[index] = { ...cachedPlayers[index], ...updatedFields };
            updatedPlayer = cachedPlayers[index];
            localStorage.setItem('piu_registered_players_cache', JSON.stringify(cachedPlayers));
        }

        if (this.currentUser && this.currentUser.id === clientId) {
            this.currentUser = sanitizeUserSession({ ...this.currentUser, ...updatedFields });
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
            if (!updatedPlayer) updatedPlayer = this.currentUser;
        }

        this.notify();
        return updatedPlayer;
    }

    async logout() {
        if (this.currentUser) {
            const isStaffUser = this.currentUser.role === 'SUPERADMIN' || this.currentUser.role === 'MANAGER';
            const logoutAction = isStaffUser ? AUDIT_ACTIONS.STAFF_LOGOUT : AUDIT_ACTIONS.CLIENT_LOGOUT;

            try {
                await auditLogger.logEvent({
                    businessId: this.currentUser.businessId || 'global',
                    action: logoutAction,
                    actor: this.currentUser,
                    details: `Cierre de sesión de ${this.currentUser.name} (${this.currentUser.role})`
                });
            } catch (e) {
                console.warn("Advertencia registrando auditoría de logout:", e);
            }
        }

        this.currentUser = null;
        localStorage.removeItem(AUTH_STORAGE_KEY);

        if (isFirebaseAvailable && auth) {
            try {
                await signOut(auth);
            } catch (e) {}
        }

        this.notify();
    }

    async createStaffManager(userData) {
        if (!this.isSuperAdmin()) {
            throw new Error("Solo un Superadministrador puede registrar nuevos encargados o administradores.");
        }

        if (!isFirebaseAvailable || !auth || !db) {
            throw new Error("No hay conexión con Firebase. La creación de personal con privilegios de Staff/Manager está bloqueada offline.");
        }

        const cleanUsername = userData.username.trim().toLowerCase().replace(/\s+/g, '_');
        const cleanPin = (userData.pin || '').trim();
        if (!cleanPin || cleanPin.length < 4) {
            throw new Error("El PIN de acceso debe tener al menos 4 dígitos.");
        }

        const fbEmail = userData.email?.trim() || `${cleanUsername}@piuhub.internal`;
        const fbPassword = await hashPin(`${cleanPin}_MAGI_PIU_SECURE_AUTH_PEPPER_2026_SALT`);
        let staffAuthUid = null;

        // 1. Crear credencial canónica OBLIGATORIA en Firebase Auth
        try {
            const cred = await createUserWithEmailAndPassword(auth, fbEmail, fbPassword);
            staffAuthUid = cred.user.uid;
        } catch (createErr) {
            if (createErr.code === 'auth/email-already-in-use') {
                throw new Error(`El email o identificador "${fbEmail}" ya existe en Firebase Auth.`);
            }
            throw new Error(`Error creando credencial en Firebase Auth (${createErr.code || createErr.message}).`);
        }

        if (!staffAuthUid) {
            throw new Error("No se pudo obtener un UID de Firebase Auth. Creación de personal abortada.");
        }

        const pinHash = await hashPin(cleanPin);

        const newStaff = {
            id: staffAuthUid,
            authUid: staffAuthUid,
            username: cleanUsername,
            pinHash,
            name: userData.name.trim(),
            role: userData.role || 'MANAGER',
            businessId: userData.businessId || null,
            email: userData.email?.trim() || fbEmail,
            avatar: userData.avatar || '🕹️',
            createdAt: new Date().toISOString()
        };

        // 2. FIRESTORE ES PRIMERO (Mandante de Seguridad y Reglas)
        try {
            await setDoc(doc(db, COLLECTIONS.STAFF_USERS, staffAuthUid), newStaff, { merge: true });
            await auditLogger.logEvent({
                businessId: newStaff.businessId || 'global',
                action: AUDIT_ACTIONS.STAFF_CREATED,
                target: { type: 'STAFF_USER', id: staffAuthUid, name: newStaff.name },
                details: `Creado usuario staff con rol ${newStaff.role} (${newStaff.name}) [UID: ${staffAuthUid}] por ${this.currentUser?.name || 'Superadmin'}`
            });
        } catch (e) {
            handleAppError(e, { context: "Error guardando usuario staff en Firestore", showToast: true, rethrow: true });
        }

        // 3. Actualizar caché local tras confirmación exitosa de Firestore
        this.staffUsers.push(newStaff);
        localStorage.setItem('piu_staff_users_cache', JSON.stringify(this.staffUsers));

        this.notify();
        return newStaff;
    }

    async updateStaffManager(userId, updatedFields) {
        if (!this.isSuperAdmin() && this.currentUser?.id !== userId) {
            throw new Error("No tienes autorización para modificar datos de este usuario.");
        }

        if (updatedFields.pin) {
            updatedFields.pinHash = await hashPin(updatedFields.pin);
            delete updatedFields.pin;
        }

        // 1. FIRESTORE ES PRIMERO
        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.STAFF_USERS, userId), updatedFields, { merge: true });
                await auditLogger.logEvent({
                    businessId: updatedFields.businessId || this.currentUser?.businessId || 'global',
                    action: AUDIT_ACTIONS.STAFF_UPDATED,
                    target: { type: 'STAFF_USER', id: userId, name: updatedFields.name || 'Staff' },
                    details: `Actualizados datos de usuario staff ID: ${userId}`
                });
            } catch (e) {
                handleAppError(e, { context: "Error editando usuario staff en Firestore", showToast: true, rethrow: true });
            }
        }

        // 2. Actualizar caché local
        const index = this.staffUsers.findIndex(u => u.id === userId);
        if (index !== -1) {
            this.staffUsers[index] = { ...this.staffUsers[index], ...updatedFields };
        } else {
            this.staffUsers.push({ id: userId, ...updatedFields });
        }
        localStorage.setItem('piu_staff_users_cache', JSON.stringify(this.staffUsers));

        if (this.currentUser && (this.currentUser.id === userId || (this.currentUser.role === 'SUPERADMIN' && updatedFields.role === 'SUPERADMIN'))) {
            this.currentUser = sanitizeUserSession({ ...this.currentUser, ...updatedFields });
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
        }

        this.notify();
        return this.staffUsers.find(u => u.id === userId);
    }

    async deleteStaffManager(userId) {
        if (!this.isSuperAdmin()) {
            throw new Error("Solo un Superadministrador puede eliminar usuarios de personal.");
        }

        const deletedUser = this.staffUsers.find(u => u.id === userId);

        // 1. FIRESTORE ES PRIMERO
        if (isFirebaseAvailable && db) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.STAFF_USERS, userId));
                await auditLogger.logEvent({
                    businessId: deletedUser?.businessId || 'global',
                    action: AUDIT_ACTIONS.STAFF_DELETED,
                    target: { type: 'STAFF_USER', id: userId, name: deletedUser?.name || 'Staff' },
                    details: `Eliminado usuario staff ID: ${userId}`
                });
            } catch (e) {
                handleAppError(e, { context: "Error eliminando staff de Firestore", showToast: true, rethrow: true });
            }
        }

        // 2. Actualizar caché local
        this.staffUsers = this.staffUsers.filter(u => u.id !== userId);
        localStorage.setItem('piu_staff_users_cache', JSON.stringify(this.staffUsers));

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
