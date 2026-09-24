// ============================================================
//  SPESFIDEM — CRM Authentication Module
//  Conectado Exclusivamente a PostgreSQL (API Express REST)
// ============================================================

const CRM_AUTH_KEY = 'spesfidem_crm_session';
const API_AUTH_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
  ? 'http://localhost:3000/api/auth/login'
  : '/api/auth/login';

const CrmAuth = {
  currentUser: null,

  async login(emailOrDoc, password) {
    const numero_documento = String(emailOrDoc || '').trim();
    const pass = String(password || '').trim();

    try {
      const res = await fetch(API_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_documento, password: pass })
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        const u = data.usuario;
        this.currentUser = {
          uid: u.id_usuario,
          id_usuario: u.id_usuario,
          email: u.email,
          name: u.nombre_completo,
          doc: u.numero_documento,
          role: u.rol === 'administrador' ? 'admin' : u.rol,
          token: data.token
        };

        sessionStorage.setItem(CRM_AUTH_KEY, JSON.stringify(this.currentUser));

        if (this.currentUser.role === 'admin' || u.rol === 'administrador') {
          sessionStorage.setItem('isAdmin', 'true');
          sessionStorage.setItem('adminName', this.currentUser.name);
          document.documentElement.classList.add('is-admin');
        } else {
          sessionStorage.removeItem('isAdmin');
          document.documentElement.classList.remove('is-admin');
        }

        return { success: true, user: this.currentUser, token: data.token };
      } else {
        return { success: false, message: data.mensaje || 'Credenciales inválidas en PostgreSQL.' };
      }
    } catch (e) {
      console.error('❌ Error de conexión al autenticar con PostgreSQL:', e);
      return { success: false, message: 'Error de conexión con el servidor de base de datos.' };
    }
  },

  logout() {
    this.currentUser = null;
    try {
      sessionStorage.clear();
      document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "isAdmin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch (e) {}
    document.documentElement.classList.remove('is-admin');
    window.location.replace('index.html');
  },

  restoreSession() {
    try {
      const data = sessionStorage.getItem(CRM_AUTH_KEY);
      if (data) {
        this.currentUser = JSON.parse(data);
        if (this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'administrador')) {
          sessionStorage.setItem('isAdmin', 'true');
          sessionStorage.setItem('adminName', this.currentUser.name);
          document.documentElement.classList.add('is-admin');
        }
      }
    } catch (e) {}
    return this.currentUser;
  },

  isAdmin() {
    return this.currentUser?.role === 'admin' || this.currentUser?.role === 'administrador' || sessionStorage.getItem('isAdmin') === 'true';
  },

  isVendedor() {
    return this.isAdmin() || this.currentUser?.role === 'vendedor';
  },

  requireAuth(requiredRole = null) {
    this.restoreSession();
    if (!this.currentUser) {
      window.location.href = 'crm-login.html?redirect=admin.html';
      return false;
    }
    if (requiredRole === 'admin' && !this.isAdmin()) {
      window.location.href = 'crm-login.html?redirect=admin.html';
      return false;
    }
    return true;
  }
};

window.CrmAuth = CrmAuth;
