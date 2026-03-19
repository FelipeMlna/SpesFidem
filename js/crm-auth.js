// ============================================================
//  SPESFIDEM — CRM Authentication Module
//  Handles Firebase Auth + local fallback roles
// ============================================================

const CRM_LOCAL_USERS = {
  'jhon@spesfidem.com':   { pass: 'Spesfidem2024!', name: 'Jhon Espinosa',  role: 'admin'    },
  'felipe@spesfidem.com': { pass: 'Felipe2024!',    name: 'Felipe Molina',  role: 'admin'    },
  'sergio@spesfidem.com': { pass: 'Sergio2024!',    name: 'Sergio Suarez',  role: 'vendedor' },
  'caleb@spesfidem.com':  { pass: 'Caleb2024!',     name: 'Caleb Perez',    role: 'vendedor' }
};

const CRM_AUTH_KEY = 'spesfidem_crm_session';

const CrmAuth = {
  // ── Current session ──
  currentUser: null,

  // ── Login (Firebase first, local fallback) ──
  async login(email, password) {
    // Try Firebase first
    if (window.SpesFirebase && window.SpesFirebase.isFirebaseReady()) {
      try {
        const auth = window.SpesFirebase.getFirebaseAuth();
        const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
        const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

        const cred = await signInWithEmailAndPassword(auth, email, password);
        const db = window.SpesFirebase.getFirestoreDB();
        const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
        const userData = userDoc.exists() ? userDoc.data() : { name: email, role: 'vendedor' };

        this.currentUser = { uid: cred.user.uid, email, name: userData.name, role: userData.role, source: 'firebase' };
        sessionStorage.setItem(CRM_AUTH_KEY, JSON.stringify(this.currentUser));
        return { success: true, user: this.currentUser };
      } catch (e) {
        if (e.code !== 'auth/network-request-failed') {
          return { success: false, message: 'Correo o contraseña incorrectos.' };
        }
        // If network error, fall through to local
      }
    }

    // Local fallback
    const localUser = CRM_LOCAL_USERS[email.toLowerCase()];
    if (localUser && localUser.pass === password) {
      this.currentUser = { uid: email, email, name: localUser.name, role: localUser.role, source: 'local' };
      sessionStorage.setItem(CRM_AUTH_KEY, JSON.stringify(this.currentUser));
      return { success: true, user: this.currentUser };
    }
    return { success: false, message: 'Correo o contraseña incorrectos.' };
  },

  // ── Logout ──
  async logout() {
    if (window.SpesFirebase && window.SpesFirebase.isFirebaseReady()) {
      try {
        const auth = window.SpesFirebase.getFirebaseAuth();
        const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
        await signOut(auth);
      } catch (e) {}
    }
    this.currentUser = null;
    sessionStorage.removeItem(CRM_AUTH_KEY);
    window.location.href = 'crm-login.html';
  },

  // ── Restore session ──
  restoreSession() {
    try {
      const data = sessionStorage.getItem(CRM_AUTH_KEY);
      if (data) this.currentUser = JSON.parse(data);
    } catch (e) {}
    return this.currentUser;
  },

  // ── Role check ──
  isAdmin()    { return this.currentUser?.role === 'admin'; },
  isVendedor() { return ['admin','vendedor'].includes(this.currentUser?.role); },

  // ── Guard: redirect to login if not authenticated ──
  requireAuth(requiredRole = null) {
    this.restoreSession();
    if (!this.currentUser) { window.location.href = 'crm-login.html'; return false; }
    if (requiredRole === 'admin' && !this.isAdmin()) {
      alert('Acceso denegado. Se requiere rol de administrador.');
      window.location.href = 'crm.html'; return false;
    }
    return true;
  }
};

window.CrmAuth = CrmAuth;
