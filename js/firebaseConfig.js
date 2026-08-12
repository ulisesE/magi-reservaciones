// js/firebaseConfig.js
// Firebase SDKs v10.11.1 (Modular via CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    query, 
    where, 
    getDocs, 
    setDoc, 
    getDoc,
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDdG6B2oYfSSDxutp1D9NNa-kkKswHPw8g",
    authDomain: "test-89a00.firebaseapp.com",
    projectId: "test-89a00",
    storageBucket: "test-89a00.firebasestorage.app",
    messagingSenderId: "739684870971",
    appId: "1:739684870971:web:dc404978c2afae43f3251e",
    measurementId: "G-627Z7J2MJ3"
};

// Inicializar instancia de Firebase
let app = null;
let db = null;
let isFirebaseAvailable = false;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isFirebaseAvailable = true;
    console.log("⚡ Firebase conectado exitosamente al proyecto: test-89a00");
} catch (error) {
    console.warn("⚠️ No se pudo inicializar Firebase, operando en modo LocalStorage:", error);
}

/**
 * ============================================================================
 * CATÁLOGOS AISLADOS (BUCKET VIRTUAL / NAMESPACE):
 * Para proteger y NO tocar las colecciones existentes del usuario ('booking', 'settings', 'users'),
 * todos los catálogos y datos de esta app residen en colecciones dedicadas con prefijo 'piu_':
 * ============================================================================
 * 1. piu_businesses      -> Catálogo de Negocios y Sucursales independientes (Multi-Tenant)
 * 2. piu_staff_users     -> Catálogo de Usuarios del Sistema (Superadmin y Encargados asignados por local)
 * 3. piu_machines        -> Catálogo de Maquinitas Pump It Up (Gabinetes LX/TX/FX, versiones, sensores)
 * 4. piu_reservations    -> Catálogo de Reservaciones y Solicitudes de Horarios
 * 5. piu_operating_rules -> Catálogo de Horarios de Apertura y Reglas Operativas
 * 6. piu_game_versions   -> Catálogo de Versiones del Juego (Phoenix, XX, Prime 2, etc.)
 * 7. piu_players         -> Catálogo / Directorio de Jugadores y Gamertags
 * 8. piu_audit_logs      -> Catálogo de Auditoría de Acciones de Encargados
 */
export const FIRESTORE_PREFIX = "piu";

export const COLLECTIONS = {
    BUSINESSES: `${FIRESTORE_PREFIX}_businesses`,
    STAFF_USERS: `${FIRESTORE_PREFIX}_staff_users`,
    MACHINES: `${FIRESTORE_PREFIX}_machines`,
    RESERVATIONS: `${FIRESTORE_PREFIX}_reservations`,
    OPERATING_RULES: `${FIRESTORE_PREFIX}_operating_rules`,
    GAME_VERSIONS: `${FIRESTORE_PREFIX}_game_versions`,
    PLAYERS: `${FIRESTORE_PREFIX}_players`,
    AUDIT_LOGS: `${FIRESTORE_PREFIX}_audit_logs`
};

export { 
    app, 
    db, 
    isFirebaseAvailable,
    collection, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    query, 
    where, 
    getDocs, 
    setDoc, 
    getDoc,
    serverTimestamp,
    orderBy
};
