// ============================================================
//  SPESFIDEM — CRM Data Module
//  Clients, Quotations, Prices — Firebase + localStorage fallback
// ============================================================

const CRM_CLIENTS_KEY  = 'crm_clients';
const CRM_PRICES_KEY   = 'crm_prices';

// ── Default price catalog (used if Firebase not configured) ──
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
  updatedBy: 'Sistema'
};

// ══════════════════════════════════════════════════════════════
//  PRICES
// ══════════════════════════════════════════════════════════════
const CrmPrices = {
  _cache: null,

  async getAll() {
    if (this._cache) return this._cache;

    // Firebase first
    if (window.SpesFirebase?.isFirebaseReady()) {
      try {
        const db = window.SpesFirebase.getFirestoreDB();
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const snap = await getDoc(doc(db, 'config', 'prices'));
        if (snap.exists()) { this._cache = snap.data(); return this._cache; }
      } catch(e) { console.warn('CRM: No se pudieron cargar precios de Firebase:', e.message); }
    }

    // Local fallback
    try {
      const local = localStorage.getItem(CRM_PRICES_KEY);
      this._cache = local ? JSON.parse(local) : DEFAULT_PRICES;
    } catch { this._cache = DEFAULT_PRICES; }

    return this._cache;
  },

  async save(prices) {
    prices.updatedAt = new Date().toISOString();
    prices.updatedBy = window.CrmAuth?.currentUser?.name || 'Admin';
    this._cache = prices;
    localStorage.setItem(CRM_PRICES_KEY, JSON.stringify(prices));

    if (window.SpesFirebase?.isFirebaseReady()) {
      try {
        const db = window.SpesFirebase.getFirestoreDB();
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(db, 'config', 'prices'), prices);
      } catch(e) { console.warn('CRM: No se pudieron guardar precios en Firebase:', e.message); }
    }
  }
};

// ══════════════════════════════════════════════════════════════
//  CLIENTS
// ══════════════════════════════════════════════════════════════
const CrmClients = {

  async getAll() {
    if (window.SpesFirebase?.isFirebaseReady()) {
      try {
        const db = window.SpesFirebase.getFirestoreDB();
        const { collection, getDocs, query, where, orderBy } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const q = query(collection(db, 'clients'), where('deleted', '!=', true), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e) { console.warn('CRM: Error al cargar clientes de Firebase:', e.message); }
    }
    // Fallback local
    try { return JSON.parse(localStorage.getItem(CRM_CLIENTS_KEY) || '[]').filter(c => !c.deleted); }
    catch { return []; }
  },

  async save(clientData) {
    const isNew = !clientData.id;
    if (isNew) {
      clientData.id       = 'c_' + Date.now();
      clientData.createdAt = new Date().toISOString();
      clientData.createdBy = window.CrmAuth?.currentUser?.uid || 'local';
      clientData.quotations = [];
    }
    clientData.updatedAt = new Date().toISOString();
    clientData.deleted   = false;

    if (window.SpesFirebase?.isFirebaseReady()) {
      try {
        const db = window.SpesFirebase.getFirestoreDB();
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(db, 'clients', clientData.id), clientData);
      } catch(e) { console.warn('CRM: Error al guardar cliente:', e.message); }
    }

    this._saveLocal(clientData);
    return clientData;
  },

  async delete(id) {
    if (window.SpesFirebase?.isFirebaseReady()) {
      try {
        const db = window.SpesFirebase.getFirestoreDB();
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await updateDoc(doc(db, 'clients', id), { deleted: true, deletedAt: new Date().toISOString() });
      } catch(e) { console.warn('CRM: Error soft-delete:', e.message); }
    }
    const clients = this._getAllLocal();
    const idx = clients.findIndex(c => c.id === id);
    if (idx >= 0) { clients[idx].deleted = true; localStorage.setItem(CRM_CLIENTS_KEY, JSON.stringify(clients)); }
  },

  async getById(id) {
    if (window.SpesFirebase?.isFirebaseReady()) {
      try {
        const db = window.SpesFirebase.getFirestoreDB();
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const snap = await getDoc(doc(db, 'clients', id));
        if (snap.exists()) return { id: snap.id, ...snap.data() };
      } catch(e) {}
    }
    return this._getAllLocal().find(c => c.id === id) || null;
  },

  _getAllLocal() {
    try { return JSON.parse(localStorage.getItem(CRM_CLIENTS_KEY) || '[]'); } catch { return []; }
  },

  _saveLocal(client) {
    const all = this._getAllLocal();
    const idx = all.findIndex(c => c.id === client.id);
    idx >= 0 ? all.splice(idx, 1, client) : all.push(client);
    localStorage.setItem(CRM_CLIENTS_KEY, JSON.stringify(all));
  }
};

// ══════════════════════════════════════════════════════════════
//  QUOTATIONS (sub-collection of clients)
// ══════════════════════════════════════════════════════════════
const CrmQuotations = {

  async save(clientId, quotationData) {
    quotationData.id         = 'q_' + Date.now();
    quotationData.clientId   = clientId;
    quotationData.createdAt  = new Date().toISOString();
    quotationData.createdBy  = window.CrmAuth?.currentUser?.name || 'Sistema';
    quotationData.status     = quotationData.status || 'Pendiente';

    if (window.SpesFirebase?.isFirebaseReady()) {
      try {
        const db = window.SpesFirebase.getFirestoreDB();
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(db, 'clients', clientId, 'quotations', quotationData.id), quotationData);
      } catch(e) { console.warn('CRM: Error al guardar cotización:', e.message); }
    }

    // Also save in local cache
    const client = await CrmClients.getById(clientId);
    if (client) {
      client.quotations = client.quotations || [];
      client.quotations.push(quotationData);
      client.lastQuotation = quotationData.createdAt;
      await CrmClients.save(client);
    }
    return quotationData;
  },

  async getForClient(clientId) {
    if (window.SpesFirebase?.isFirebaseReady()) {
      try {
        const db = window.SpesFirebase.getFirestoreDB();
        const { collection, getDocs, orderBy, query } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const q = query(collection(db, 'clients', clientId, 'quotations'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e) { console.warn('CRM: Error al obtener cotizaciones:', e.message); }
    }
    const client = await CrmClients.getById(clientId);
    return client?.quotations || [];
  },

  async duplicate(clientId, quotationId) {
    const quotations = await this.getForClient(clientId);
    const original   = quotations.find(q => q.id === quotationId);
    if (!original) return null;
    const copy = { ...original, status: 'Pendiente', originalId: quotationId };
    delete copy.id;
    return this.save(clientId, copy);
  },

  async updateStatus(clientId, quotationId, status) {
    if (window.SpesFirebase?.isFirebaseReady()) {
      try {
        const db = window.SpesFirebase.getFirestoreDB();
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await updateDoc(doc(db, 'clients', clientId, 'quotations', quotationId), { status, updatedAt: new Date().toISOString() });
      } catch(e) {}
    }
  }
};

// ══════════════════════════════════════════════════════════════
//  PDF EXPORT (jsPDF via CDN)
// ══════════════════════════════════════════════════════════════
async function exportQuotationPDF(client, quotation) {
  // Load jsPDF dynamically
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Header
  doc.setFillColor(2, 6, 23);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text('SPESFIDEM ALUMINIO', 15, 18);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Ventanas · Puertas · Divisiones · Espejos', 15, 26);
  doc.text('Tel: 3046291152', 15, 33);

  // Quote info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('COTIZACIÓN', 150, 18);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${quotation.id}`, 150, 25);
  doc.text(`Fecha: ${new Date(quotation.createdAt).toLocaleDateString('es-CO')}`, 150, 31);
  doc.text(`Estado: ${quotation.status}`, 150, 37);

  // Client info
  let y = 55;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text('DATOS DEL CLIENTE', 15, y);
  y += 7;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${client.fullName || client.name || ''}`, 15, y); y += 6;
  doc.text(`Teléfono: ${client.cellphone || client.phone || ''}`, 15, y); y += 6;
  doc.text(`Dirección: ${client.address || ''}`, 15, y); y += 6;
  doc.text(`Ciudad: ${client.city || ''}`, 15, y); y += 6;

  // Items table
  y += 5;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text('DETALLE DE PRODUCTOS', 15, y);
  y += 7;

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(10, y-4, 190, 8, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('Producto', 12, y+1);
  doc.text('Cant.', 80, y+1);
  doc.text('Vidrio', 95, y+1);
  doc.text('Medida', 130, y+1);
  doc.text('Color', 155, y+1);
  doc.text('Total', 180, y+1);
  y += 10;

  const items = quotation.items || [];
  doc.setFont('helvetica', 'normal');
  items.forEach((item, i) => {
    if (i % 2 === 0) { doc.setFillColor(250,250,250); doc.rect(10, y-4, 190, 8, 'F'); }
    doc.text(String(item.product || '').substring(0, 25), 12, y+1);
    doc.text(String(item.quantity || 1), 80, y+1);
    doc.text(String(item.glass || '').substring(0, 18), 95, y+1);
    doc.text(String(item.size || ''), 130, y+1);
    doc.text(String(item.color || ''), 155, y+1);
    doc.text(`$${(item.total || 0).toLocaleString('es-CO')}`, 178, y+1, { align: 'right' });
    y += 9;
    if (y > 265) { doc.addPage(); y = 20; }
  });

  // Totals
  y += 5;
  doc.line(120, y, 200, y); y += 6;
  doc.setFontSize(9);
  doc.text('Subtotal:', 120, y);  doc.text(`$${(quotation.subtotal||0).toLocaleString('es-CO')}`, 200, y, {align:'right'}); y += 6;
  doc.text('IVA (19%):', 120, y); doc.text(`$${(quotation.iva||0).toLocaleString('es-CO')}`, 200, y, {align:'right'}); y += 6;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 120, y); doc.text(`$${(quotation.grandTotal||0).toLocaleString('es-CO')}`, 200, y, {align:'right'}); y += 8;

  // Plan de pago
  if (quotation.paymentPlan) {
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`Plan de pago: ${quotation.paymentPlan}`, 15, y);
    const plan = String(quotation.paymentPlan).split('-');
    if (plan.length === 2) {
      const p1 = Math.round((quotation.grandTotal||0) * parseInt(plan[0]) / 100);
      const p2 = Math.round((quotation.grandTotal||0) * parseInt(plan[1]) / 100);
      y += 5; doc.text(`Anticipo (${plan[0]}%): $${p1.toLocaleString('es-CO')}  |  Saldo (${plan[1]}%): $${p2.toLocaleString('es-CO')}`, 15, y);
    }
  }

  // Footer
  doc.setFontSize(7); doc.setTextColor(120,120,120);
  doc.text('Esta cotización tiene vigencia de 30 días. Precios sujetos a variación sin previo aviso.', 105, 285, {align:'center'});

  doc.save(`Cotizacion_${client.fullName || 'Cliente'}_${quotation.id}.pdf`);
}

// ── WhatsApp sender ──
function sendWhatsApp(clientPhone, client, quotation) {
  const total = (quotation.grandTotal || 0).toLocaleString('es-CO');
  const items = (quotation.items || []).map(i => `  • ${i.product} (${i.quantity}) — $${(i.total||0).toLocaleString('es-CO')}`).join('\n');
  const msg = `Hola ${client.fullName || client.name || ''},\n\n` +
    `Aquí tiene su cotización de *SPESFIDEM ALUMINIO*:\n\n` +
    `${items}\n\n` +
    `*Total: $${total}*\n` +
    `Plan de pago: ${quotation.paymentPlan || '75-25'}\n\n` +
    `Cotización N°: ${quotation.id}\n` +
    `Válida por 30 días.`;
  const phone = String(clientPhone || '').replace(/\D/g,'');
  const url = `https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

window.CrmPrices     = CrmPrices;
window.CrmClients    = CrmClients;
window.CrmQuotations = CrmQuotations;
window.exportQuotationPDF = exportQuotationPDF;
window.sendWhatsApp       = sendWhatsApp;
