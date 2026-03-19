// ============================================================
//  SPESFIDEM — Firebase Configuration
//  ⚠️ INSTRUCCIONES:
//  1. Abre https://console.firebase.google.com
//  2. Crea un proyecto llamado "spesfidem-crm"
//  3. Ve a "Configuración > Aplicaciones > Web" y copia tu config
//  4. Pega los valores en el objeto FIREBASE_CONFIG de abajo
//  5. Activa Firestore, Authentication (email/password) y Rules
// ============================================================

const FIREBASE_CONFIG = {
  apiKey:            "TU_API_KEY_AQUI",
  authDomain:        "TU_PROYECTO.firebaseapp.com",
  projectId:         "TU_PROYECTO_ID",
  storageBucket:     "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId:             "TU_APP_ID"
};

// ── Detect if Firebase is configured ──
const FIREBASE_CONFIGURED = FIREBASE_CONFIG.apiKey !== "TU_API_KEY_AQUI";

// ── Initialize Firebase (only if configured) ──
let _db = null, _auth = null;

async function initFirebase() {
  if (!FIREBASE_CONFIGURED) {
    console.warn("[Spesfidem CRM] Firebase no está configurado. Usando modo LOCAL (localStorage). Edita js/firebase-config.js para conectar.");
    return false;
  }
  try {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getFirestore }           = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const { getAuth }                = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");

    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    _db   = getFirestore(app);
    _auth = getAuth(app);
    console.log("[Spesfidem CRM] ✅ Firebase conectado al proyecto:", FIREBASE_CONFIG.projectId);
    return true;
  } catch (e) {
    console.error("[Spesfidem CRM] Error al inicializar Firebase:", e);
    return false;
  }
}

function getFirestoreDB() { return _db; }
function getFirebaseAuth() { return _auth; }
function isFirebaseReady() { return !!_db && !!_auth; }

window.SpesFirebase = { initFirebase, getFirestoreDB, getFirebaseAuth, isFirebaseReady, FIREBASE_CONFIGURED };
