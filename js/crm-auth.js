// ============================================================
//  SPESFIDEM — CRM Authentication Module
//  Handles Firebase Auth + local fallback roles
// ============================================================

const CRM_LOCAL_USERS = {
  '14298116':             { pass: '14298116Je*', name: 'Jhon Espinosa',    role: 'admin'    },
  '1106227253':           { pass: '7253pipe',    name: 'Felipe Molina',   role: 'admin'    },
  '1005703432':           { pass: '3432sergio',  name: 'Sergio Suarez',   role: 'admin'    },
  '1104942399':           { pass: '2399caleb',   name: 'Caleb Perez',     role: 'admin'    },
  'jhon@spesfidem.com':   { pass: 'Ventas2026!', name: 'Jhon Espinosa',   role: 'admin'    },
  'felipe@spesfidem.com': { pass: 'Felipe2026!', name: 'Felipe Molina',   role: 'admin'    },
  'ventas@spesfidem.com': { pass: 'Ventas2026!', name: 'Ventas Spesfidem', role: 'vendedor' },
  'sergio@spesfidem.com': { pass: 'Sergio2026!', name: 'Sergio Suarez',   role: 'vendedor' },
  'caleb@spesfidem.com':  { pass: 'Caleb2026!',  name: 'Caleb Perez',     role: 'vendedor' }
};

const CRM_AUTH_KEY = 'spesfidem_crm_session';

const CrmAuth = {
  // ── Current session ──
  currentUser: null,

  async login(email, password) {
    let authenticatedUser = null;

    // 1. Try Server API /api/user-login
    try {
      const res = await fetch('/api/user-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        authenticatedUser = {
          uid: data.user.id,
          email: data.user.email,
          name: data.user.name || data.user.fullName,
          role: data.user.role || 'user',
          source: 'api'
        };
      }
    } catch(e) {
      console.warn("API login offline, using local check:", e);
    }

    // 2. Try Firebase if available
    if (!authenticatedUser && window.SpesFirebase && window.SpesFirebase.isFirebaseReady()) {
      try {
        const auth = window.SpesFirebase.getFirebaseAuth();
        const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
        const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

        const cred = await signInWithEmailAndPassword(auth, email, password);
        const db = window.SpesFirebase.getFirestoreDB();
        const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
        const userData = userDoc.exists() ? userDoc.data() : { name: email, role: 'user' };

        authenticatedUser = { uid: cred.user.uid, email, name: userData.name, role: userData.role || 'user', source: 'firebase' };
      } catch (e) {
        console.warn('Firebase login err:', e.code);
      }
    }

    // 3. Local fallback for static admin users
    if (!authenticatedUser) {
      const localUser = CRM_LOCAL_USERS[email.toLowerCase()];
      if (localUser && localUser.pass === password) {
        authenticatedUser = { uid: email, email, name: localUser.name, role: localUser.role, source: 'local' };
      }
    }

    // 4. Local fallback for registered users in localStorage
    if (!authenticatedUser) {
      try {
        const stored = localStorage.getItem('spesfidem_registered_users');
        if (stored) {
          const users = JSON.parse(stored);
          const found = users.find(u => (u.email.toLowerCase() === email.toLowerCase() || u.idCard === email) && u.password === password);
          if (found) {
            authenticatedUser = { uid: found.id, email: found.email, name: found.fullName, role: found.role || 'user', source: 'local_user' };
          }
        }
      } catch(e){}
    }

    if (authenticatedUser) {
      this.currentUser = authenticatedUser;
      sessionStorage.setItem(CRM_AUTH_KEY, JSON.stringify(this.currentUser));
      localStorage.setItem('spesfidem_client_user', JSON.stringify({ fullName: this.currentUser.name, email: this.currentUser.email, role: this.currentUser.role, loggedIn: true }));
      if (this.currentUser.role === 'admin') {
        sessionStorage.setItem('isAdmin', 'true');
        sessionStorage.setItem('adminName', this.currentUser.name);
        document.documentElement.classList.add('is-admin');
      } else {
        sessionStorage.removeItem('isAdmin');
        document.documentElement.classList.remove('is-admin');
      }
      return { success: true, user: this.currentUser };
    }

    return { success: false, message: 'Correo, usuario o contraseña incorrectos.' };
  },

  // ── Logout ──
  logout() {
    try {
      fetch('/api/logout', { method: 'POST' }).catch(() => {});
    } catch(e) {}

    if (window.SpesFirebase && window.SpesFirebase.isFirebaseReady()) {
      try {
        const auth = window.SpesFirebase.getFirebaseAuth();
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js")
          .then(m => m.signOut(auth))
          .catch(() => {});
      } catch (e) {}
    }
    this.currentUser = null;
    try {
      sessionStorage.clear();
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('adminName');
      localStorage.removeItem('spesfidem_crm_session');
      localStorage.removeItem('spesfidem_client_user');
      document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "isAdmin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch (e) {}
    document.documentElement.classList.remove('is-admin');
    window.location.replace('index.html');
  },

  // ── Restore session ──
  restoreSession() {
    try {
      const data = sessionStorage.getItem(CRM_AUTH_KEY);
      if (data) {
        this.currentUser = JSON.parse(data);
        if (this.currentUser && this.currentUser.role === 'admin') {
          sessionStorage.setItem('isAdmin', 'true');
          sessionStorage.setItem('adminName', this.currentUser.name);
          document.documentElement.classList.add('is-admin');
        }
      } else if (sessionStorage.getItem('isAdmin') === 'true') {
        const adminName = sessionStorage.getItem('adminName') || 'Administrador';
        this.currentUser = { uid: 'admin', email: 'admin@spesfidem.com', name: adminName, role: 'admin', source: 'local' };
        document.documentElement.classList.add('is-admin');
      }
    } catch (e) {}
    return this.currentUser;
  },

  // ── Role check ──
  isAdmin()    { return this.currentUser?.role === 'admin' || sessionStorage.getItem('isAdmin') === 'true'; },
  isVendedor() { return ['admin','vendedor'].includes(this.currentUser?.role) || sessionStorage.getItem('isAdmin') === 'true'; },

  // ── Guard: redirect to login if not authenticated ──
  requireAuth(requiredRole = null) {
    this.restoreSession();
    if (!this.currentUser) { window.location.href = 'crm-login.html?redirect=admin.html'; return false; }
    if (requiredRole === 'admin' && !this.isAdmin()) {
      window.location.href = 'crm-login.html?redirect=admin.html'; return false;
    }
    return true;
  }
};

window.CrmAuth = CrmAuth;
