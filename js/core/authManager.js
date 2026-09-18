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
        // Pre-calcular hashes para los usuarios de semilla
        for (const u of DEFAULT_STAFF_USERS) {
            if (!u.pinHash && u.pin) {
                u.pinHash = await hashPin(u.pin);
                delete u.pin;
            }
        }

        // 1. Cargar caché local y semillas
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
// Cargar catálogo completo de jugadores desde Firestore
if (isFirebaseAvailable && db) {
    await this.loadClientUsers();
}

        // 2. Control reactivo no destructivo del estado de sesión con Firebase Auth
        if (isFirebaseAvailable && auth) {
            onAuthStateChanged(auth, async (fbUser) => {
                if (fbUser) {
                    console.log(`🔐 Sesión activa en Firebase Auth: UID = ${fbUser.uid} (${fbUser.email || 'anónimo'})`);
                    try {
                        // Sincronizar automáticamente el perfil de Staff desde Firestore
                        let staffDoc = await getDoc(doc(db, COLLECTIONS.STAFF_USERS, fbUser.uid));
                        if (staffDoc.exists()) {
                            const staffData = staffDoc.data();
                            this.currentUser = sanitizeUserSession({ id: staffDoc.id, authUid: fbUser.uid, ...staffData });
                            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
                            this.notify();
                            return;
                        }

                        // Sincronizar automáticamente el perfil de Jugador desde Firestore (por ID o por authUid)
                        let playerDoc = await getDoc(doc(db, COLLECTIONS.PLAYERS, fbUser.uid));
                        if (playerDoc.exists()) {
                            const playerData = playerDoc.data();
                            this.currentUser = sanitizeUserSession({ id: playerDoc.id, authUid: fbUser.uid, ...playerData });
                            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
                            this.notify();
                            return;
                        }

                        // Búsqueda por campo authUid en caso de IDs legacy
                        const qPlayer = query(collection(db, COLLECTIONS.PLAYERS), where("authUid", "==", fbUser.uid), limit(1));
                        const qPlayerSnap = await getDocs(qPlayer);
                        if (!qPlayerSnap.empty) {
                            const pDoc = qPlayerSnap.docs[0];
                            this.currentUser = sanitizeUserSession({ id: pDoc.id, authUid: fbUser.uid, ...pDoc.data() });
                            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
                            this.notify();
                            return;
                        }
                    } catch (err) {
                        console.warn("Advertencia sincronizando sesión desde Firestore:", err);
                    }
                }
            });
        }

        // 3. Recuperar sesión guardada localmente (Modo Híbrido tolerante)
        const savedSession = localStorage.getItem(AUTH_STORAGE_KEY);
        if (savedSession) {
            try {
                const user = JSON.parse(savedSession);
                let verifiedUser = user;

                if (isFirebaseAvailable && db && user.id) {
                    try {
                        const isStaff = user.role === 'SUPERADMIN' || user.role === 'MANAGER';
                        const coll = isStaff ? COLLECTIONS.STAFF_USERS : COLLECTIONS.PLAYERS;
                        const targetDocId = user.id;
                        const docSnap = await getDoc(doc(db, coll, targetDocId));
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            verifiedUser = { id: docSnap.id, ...data };
                        }
                    } catch (e) {
                        console.warn("Error verificando usuario guardado en Firestore, usando copia local:", e);
                    }
                }

                if (verifiedUser) {
                    this.currentUser = sanitizeUserSession(verifiedUser);
                    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
                    this.syncRealtimeUsers();
                }
            } catch (e) {
                console.warn("Error parseando sesión guardada:", e);
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
        } catch (e) {
            console.warn("Error configurando listener staff:", e);
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getClientUsers() {
        return this.clientUsers;
    }

    getStaffUsers() {
        return this.staffUsers;
    }

    async loadStaffUsers() {
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDocs(collection(db, COLLECTIONS.STAFF_USERS));
                if (!snap.empty) {
                    this.staffUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    localStorage.setItem('piu_staff_users_cache', JSON.stringify(this.staffUsers));
                }
            } catch (e) {
                console.warn("Error cargando staff de Firestore:", e);
            }
        }
        return this.staffUsers.length > 0 ? this.staffUsers : DEFAULT_STAFF_USERS;
    }
async loadClientUsers() {
    if (isFirebaseAvailable && db) {
        try {
            console.log("🔄 Actualizando jugadores desde Firestore...");

            const snap = await getDocs(
                collection(db, COLLECTIONS.PLAYERS)
            );

            // Firestore es la fuente de verdad
            this.clientUsers = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            // Reemplazar el cache viejo
            localStorage.setItem(
                'piu_registered_players_cache',
                JSON.stringify(this.clientUsers)
            );

            console.log(
                `✅ Jugadores actualizados: ${this.clientUsers.length}`
            );

        } catch (e) {
            console.warn(
                "⚠️ Error cargando jugadores de Firestore:",
                e
            );
        }
    }

    return this.clientUsers;
}
    getRole() {
        return this.currentUser ? this.currentUser.role : 'CLIENT';
    }

    isSuperAdmin() {
        return this.currentUser?.role === 'SUPERADMIN';
    }

    isManager() {
        return this.currentUser?.role === 'MANAGER';
    }

    isStaff() {
        return this.isSuperAdmin() || this.isManager();
    }

    isClientUser() {
        return this.currentUser?.role === 'CLIENT';
    }

    isClient() {
        return !this.currentUser || this.currentUser.role === 'CLIENT';
    }

    async login(username, pin) {
        const uTrim = username.trim().toLowerCase();
        const pTrim = pin.trim();
        let user = null;
        let candidateUsers = [];

        // 1. Buscar en Firestore (Staff y Jugadores)
        if (isFirebaseAvailable && db) {
            try {
                // Buscar en Staff por username o email
                const qStaffUser = query(collection(db, COLLECTIONS.STAFF_USERS), where("username", "==", uTrim));
                const staffSnap = await getDocs(qStaffUser);
                staffSnap.forEach(d => candidateUsers.push({ id: d.id, ...d.data(), _coll: COLLECTIONS.STAFF_USERS }));

                if (candidateUsers.length === 0) {
                    const qStaffEmail = query(collection(db, COLLECTIONS.STAFF_USERS), where("email", "==", uTrim));
                    const emailSnap = await getDocs(qStaffEmail);
                    emailSnap.forEach(d => candidateUsers.push({ id: d.id, ...d.data(), _coll: COLLECTIONS.STAFF_USERS }));
                }

                // Buscar en Jugadores por username o teléfono o ID directo o PIU ID (piugame.com)
                const qPlayerUser = query(collection(db, COLLECTIONS.PLAYERS), where("username", "==", uTrim));
                const playerSnap = await getDocs(qPlayerUser);
                playerSnap.forEach(d => candidateUsers.push({ id: d.id, ...d.data(), _coll: COLLECTIONS.PLAYERS }));

                // Buscar por PIU ID oficial (ej. megajefelink#1234)
                if (uTrim.includes('#')) {
                    const qPiuId = query(collection(db, COLLECTIONS.PLAYERS), where("piuGameId", "==", uTrim));
                    const piuSnap = await getDocs(qPiuId);
                    piuSnap.forEach(d => {
                        if (!candidateUsers.some(c => c.id === d.id)) {
                            candidateUsers.push({ id: d.id, ...d.data(), _coll: COLLECTIONS.PLAYERS });
                        }
                    });
                }

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

                // Buscar por ID directo si empieza con usr_ o p_
                if (candidateUsers.length === 0 && (uTrim.startsWith('usr_') || uTrim.startsWith('p_'))) {
                    try {
                        const pDoc = await getDoc(doc(db, COLLECTIONS.PLAYERS, uTrim));
                        if (pDoc.exists()) {
                            candidateUsers.push({ id: pDoc.id, ...pDoc.data(), _coll: COLLECTIONS.PLAYERS });
                        }
                    } catch (e) {}
                }
            } catch (err) {
                console.warn("Búsqueda online falló, usando candidatos locales:", err);
            }
        }

        // Incorporar semillas locales y caché
        const localStaff = this.staffUsers.length > 0 ? this.staffUsers : DEFAULT_STAFF_USERS;
        const localPlayers = this.clientUsers || [];

        localStaff.forEach(d => {
            if (!candidateUsers.some(c => c.id === d.id || c.username?.toLowerCase() === d.username?.toLowerCase())) {
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
            const matchesPiuId = candidate.piuGameId?.toLowerCase() === uTrim || (candidate.piuGameId && candidate.piuGameId.toLowerCase().replace(/#/g, '') === uTrim.replace(/#/g, ''));
            const matchesPhone = candidate.phone && candidate.phone.replace(/\D/g, '') === uTrim.replace(/\D/g, '');
            const matchesId = candidate.id?.toLowerCase() === uTrim;

            if (matchesUsername || matchesPiuId || matchesPhone || matchesId) {
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

        // 3. Autenticación y vinculación transparente en Firebase Auth (Modo Híbrido tolerante)
        let authUid = user.authUid || null;
        if (isFirebaseAvailable && auth) {
            const cleanUser = (user.username || user.name || 'user').toLowerCase().replace(/\s+/g, '_');
            const fbEmail = user.email || `${cleanUser}@piuhub.internal`;
            const fbPassword = await hashPin(`${pTrim}_MAGI_PIU_SECURE_AUTH_PEPPER_2026_SALT`);

            try {
                if (auth.currentUser) {
                    await signOut(auth);
                }
                const cred = await signInWithEmailAndPassword(auth, fbEmail, fbPassword);
                authUid = cred.user.uid;
            } catch (authErr) {
                // Si no existe aún en Firebase Auth, auto-crearlo de forma silenciosa
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
                } else if (authErr.code === 'auth/configuration-not-found') {
                    console.warn("Firebase Auth Email/Password provider no configurado. Operando en modo Híbrido Firestore.");
                }
            }

            // Si se obtuvo un authUid, vincularlo al documento en Firestore sin cambiar su ID histórico
            if (authUid) {
                user.authUid = authUid;
                if (db && user.id) {
                    try {
                        const coll = isStaff ? COLLECTIONS.STAFF_USERS : COLLECTIONS.PLAYERS;
                        const updateData = { authUid: authUid };
                        if (!user.pinHash) {
                            updateData.pinHash = await hashPin(pTrim);
                        }
                        await setDoc(doc(db, coll, user.id), updateData, { merge: true });
                        console.log(`🔗 Perfil ${user.name} (${user.id}) vinculado transparentemente a Firebase Auth UID: ${authUid}`);
                    } catch (syncErr) {
                        console.warn("Advertencia vinculando authUid a Firestore:", syncErr);
                    }
                }
            }
        }

        // Sanitizar sesión para no almacenar PINs en plano
        const safeSessionUser = sanitizeUserSession(user);
        this.currentUser = safeSessionUser;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeSessionUser));

        if (user.role === 'MANAGER' && user.businessId) {
            await tenantManager.selectLocal(user.businessId);
        }

        // Registrar auditoría
        try {
            const loginAction = isStaff ? AUDIT_ACTIONS.STAFF_LOGIN : AUDIT_ACTIONS.CLIENT_LOGIN;
            await auditLogger.logEvent({
                businessId: safeSessionUser.businessId || 'global',
                action: loginAction,
                actor: safeSessionUser,
                details: `Inicio de sesión exitoso como ${safeSessionUser.role}: ${safeSessionUser.name} (@${safeSessionUser.username || ''})`
            });
        } catch (e) {}

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
                console.warn("Validación de unicidad en Firestore:", err);
            }
        }

        const securePinHash = await hashPin(cleanPin);

        // Crear credencial en Firebase Auth si es auto-registro y no hay staff activo
        let authUid = null;
        if (isFirebaseAvailable && auth && !this.isStaff()) {
            const fbEmail = clientData.email?.trim() || `${cleanUsername}@player.piuhub.internal`;
            const fbPassword = await hashPin(`${cleanPin}_MAGI_PIU_SECURE_AUTH_PEPPER_2026_SALT`);
            try {
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

        const newPlayerId = 'usr_player_' + Date.now();

        const newPlayer = {
            id: newPlayerId,
            authUid: authUid,
            username: cleanUsername,
            piuGameId: clientData.piuGameId?.trim() || '',
            pinHash: securePinHash,
            name: clientData.name.trim(),
            role: 'CLIENT',
            phone: clientData.phone?.trim() || '',
            email: clientData.email?.trim() || '',
            avatar: clientData.avatar || '🕺',
            skillLevel: clientData.skillLevel || 'Liga C',
            preferredMode: clientData.preferredMode || 'Single / Double',
            notes: clientData.notes?.trim() || 'Jugador registrado',
            loyaltyPoints: 0,
            loyaltyVisits: 0,
            loyaltyTier: 'Bronce',
            createdAt: new Date().toISOString()
        };

        // 1. Guardar en Firestore (tolerante a reglas pendientes)
        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.PLAYERS, newPlayer.id), newPlayer, { merge: true });
            } catch (e) {
                console.warn("Aviso de reglas Firestore: Guardado en local mientras se aplican las reglas en la consola.", e);
            }
        }

        // 2. Actualizar memoria y caché local limpia
        if (!this.clientUsers) this.clientUsers = [];
        this.clientUsers = this.clientUsers.filter(p => p.id !== newPlayer.id);
        this.clientUsers.push(newPlayer);
        localStorage.setItem('piu_registered_players_cache', JSON.stringify(this.clientUsers));

        const safeSession = sanitizeUserSession(newPlayer);

        // Si se auto-registró un cliente, activar su sesión
        if (!this.isStaff()) {
            this.currentUser = safeSession;
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeSession));
            this.notify();
        }

        return safeSession;
    }

    /**
     * Vinculación o migración asistida de un cliente a Firebase Auth
     */
    async linkClientToFirebaseAuth(clientId, email = null, rawPin = '1234') {
        if (!isFirebaseAvailable || !auth || !db) {
            throw new Error("Se requiere conexión activa con Firebase para vincular a Firebase Auth.");
        }

        const playerDocRef = doc(db, COLLECTIONS.PLAYERS, clientId);
        const playerSnap = await getDoc(playerDocRef);
        if (!playerSnap.exists()) {
            throw new Error("El cliente no fue encontrado en la base de datos.");
        }

        const playerData = playerSnap.data();
        const username = playerData.username || ('player_' + clientId.substr(-4));
        const fbEmail = email || playerData.email || `${username}@player.piuhub.internal`;
        const fbPassword = await hashPin(`${rawPin}_MAGI_PIU_SECURE_AUTH_PEPPER_2026_SALT`);

        let authUid = null;
        try {
            const cred = await createUserWithEmailAndPassword(auth, fbEmail, fbPassword);
            authUid = cred.user.uid;
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                try {
                    const cred = await signInWithEmailAndPassword(auth, fbEmail, fbPassword);
                    authUid = cred.user.uid;
                } catch (signInErr) {
                    throw new Error(`El correo ${fbEmail} ya está en uso en Firebase Auth con otra contraseña.`);
                }
            } else {
                throw new Error(`Error en Firebase Auth: ${err.message || err.code}`);
            }
        }

        if (!authUid) {
            throw new Error("No se pudo obtener el UID de Firebase Auth.");
        }

        const updatePayload = {
            authUid: authUid,
            email: fbEmail,
            isAuthMigrated: true,
            migratedAt: new Date().toISOString()
        };

        if (rawPin) {
            updatePayload.pinHash = await hashPin(rawPin);
        }

        await updateDoc(playerDocRef, updatePayload);

        // Actualizar caché en memoria
        const idx = this.clientUsers.findIndex(c => c.id === clientId);
        if (idx !== -1) {
            this.clientUsers[idx] = { ...this.clientUsers[idx], ...updatePayload };
            localStorage.setItem('piu_registered_players_cache', JSON.stringify(this.clientUsers));
        }

        return { success: true, authUid, email: fbEmail };
    }

    async updateClientProfile(clientId, updatedFields) {
        delete updatedFields.role;
        delete updatedFields.id;
        delete updatedFields.accounts;
        delete updatedFields.loyaltyPoints;

        if (updatedFields.pin) {
            updatedFields.pinHash = await hashPin(updatedFields.pin);
            delete updatedFields.pin;
        }

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.PLAYERS, clientId), updatedFields, { merge: true });
            } catch (e) {
                handleAppError(e, { context: "Error actualizando perfil en Firestore", showToast: true, rethrow: true });
            }
        }

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
            } catch (e) {}
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

        const cleanUsername = userData.username.trim().toLowerCase().replace(/\s+/g, '_');
        const cleanPin = (userData.pin || '').trim();
        if (!cleanPin || cleanPin.length < 4) {
            throw new Error("El PIN de acceso debe tener al menos 4 dígitos.");
        }

        const pinHash = await hashPin(cleanPin);
        let staffAuthUid = null;

        if (isFirebaseAvailable && auth) {
            const fbEmail = userData.email?.trim() || `${cleanUsername}@piuhub.internal`;
            const fbPassword = await hashPin(`${cleanPin}_MAGI_PIU_SECURE_AUTH_PEPPER_2026_SALT`);
            try {
                const cred = await createUserWithEmailAndPassword(auth, fbEmail, fbPassword);
                staffAuthUid = cred.user.uid;
            } catch (createErr) {
                if (createErr.code === 'auth/email-already-in-use') {
                    try {
                        const cred = await signInWithEmailAndPassword(auth, fbEmail, fbPassword);
                        staffAuthUid = cred.user.uid;
                    } catch (e) {}
                }
            }
        }

        const newStaffId = staffAuthUid || `usr_staff_${Date.now()}`;

        const newStaff = {
            id: newStaffId,
            authUid: staffAuthUid,
            username: cleanUsername,
            pinHash,
            name: userData.name.trim(),
            role: userData.role || 'MANAGER',
            businessId: userData.businessId || null,
            email: userData.email?.trim() || `${cleanUsername}@piuhub.internal`,
            avatar: userData.avatar || '🕹️',
            createdAt: new Date().toISOString()
        };

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.STAFF_USERS, newStaff.id), newStaff, { merge: true });
                await auditLogger.logEvent({
                    businessId: newStaff.businessId || 'global',
                    action: AUDIT_ACTIONS.STAFF_CREATED,
                    target: { type: 'STAFF_USER', id: newStaff.id, name: newStaff.name },
                    details: `Creado usuario staff con rol ${newStaff.role} (${newStaff.name}) por ${this.currentUser?.name || 'Superadmin'}`
                });
            } catch (e) {
                handleAppError(e, { context: "Error guardando usuario staff en Firestore", showToast: true, rethrow: true });
            }
        }

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
