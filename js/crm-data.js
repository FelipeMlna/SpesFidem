// ============================================================
//  SPESFIDEM — CRM Data Module
//  Conexión Exclusiva con PostgreSQL vía API REST
// ============================================================

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
  ? 'http://localhost:3000'
  : 'https://spesfidem-crm-server.onrender.com';

// ── Catálogo de precios de referencia ──
const DEFAULT_PRICES = {
  profiles: {
    '8025': { natural: 38000, negro: 48000, champagne: 55000, madera: 70000 },
    '744':  { natural: 32000, negro: 42000, champagne: 50000, madera: 65000 },
    '5020': { natural: 28000, negro: 38000, champagne: 46000, madera: 60000 },
    'serie3': { natural: 25000, negro: 35000 }
  },
  glass: {
    'Espejo 3mm':  { priceM2: 40000 },
    'Espejo 4mm':  { priceM2: 75000 },
    'Claro 3mm':   { priceM2: 26000 },
    'Claro 4mm':   { priceM2: 30000 },
    'Claro 5mm':   { priceM2: 40000 },
    'Bronce 4mm':  { priceM2: 38000 },
    'Bronce Reflectivo': { priceM2: 55000 },
    'Templado 6mm': { priceM2: 155000 },
    'Templado 8mm': { priceM2: 210000 },
    'Templado 10mm': { priceM2: 280000 }
  },
  extras: {
    'Manija':      12000,
    'Cerradura':   35000,
    'Riel':        28000,
    'Silicón':     8000,
    'Tornillería': 5000
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema PostgreSQL'
};

// ══════════════════════════════════════════════════════════════
//  PRICES
// ══════════════════════════════════════════════════════════════
const CrmPrices = {
  _cache: DEFAULT_PRICES,
  async getAll() {
    return this._cache;
  },
  async save(prices) {
    this._cache = prices;
    return prices;
  }
};

// ══════════════════════════════════════════════════════════════
//  CLIENTS (PostgreSQL Exclusivo)
// ══════════════════════════════════════════════════════════════
const CrmClients = {
  async getAll() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/usuarios`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data.usuarios || data.data || []);
    } catch (e) {
      console.error('❌ CRM: Error al cargar clientes desde PostgreSQL:', e);
      return [];
    }
  },

  async save(clientData) {
    try {
      const res = await fetch(`${API_BASE}/api/registered-users/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('❌ CRM: Error al guardar cliente en PostgreSQL:', e);
      throw e;
    }
  },

  async getById(id) {
    try {
      const clients = await this.getAll();
      return clients.find(c => String(c.id || c.id_usuario) === String(id)) || null;
    } catch (e) {
      console.error(`❌ CRM: Error al consultar cliente ${id}:`, e);
      return null;
    }
  }
};
