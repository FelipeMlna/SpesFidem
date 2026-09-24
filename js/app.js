console.log("Spesfidem App v5 Loading...");
const DB_KEY = 'spesfidem_clients';
const DB_NAME = 'SpesfidemDB';
const DB_VERSION = 1;
const STORE_NAME = 'clients';

// --- Database Layer (Python Server API) ---
class ClientDB {
    constructor() {
        // --- UNIVERSAL CONNECTION LOGIC ---
        // This logic ensures the app can find the Python backend (port 3000)
        // regardless of whether it's served via localhost, LAN IP, or a Public Tunnel.

        const hostname = window.location.hostname || 'localhost';
        const port = window.location.port;

        // 1. Check for manual override
        const manualOverride = localStorage.getItem('spesfidem_api_base');
        if (manualOverride) {
            this.apiUrl = manualOverride.endsWith('/') ? `${manualOverride}api/clients` : `${manualOverride}/api/clients`;
            this.loginUrl = manualOverride.endsWith('/') ? `${manualOverride}api/login` : `${manualOverride}/api/login`;
            return;
        }

        // 2. Identify the base URL dynamically
        let base = '';
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        const isFile = window.location.protocol === 'file:';

        if (isLocal || isFile) {
            base = 'http://localhost:3000';
        } else {
            // PRODUCCIÓN: URL de Render para el Backend de Base de Datos (Python)
            base = 'https://spesfidem-crm-server.onrender.com';
        }

        this.apiUrl = `${base}/api/admin/usuarios`;
        this.loginUrl = `${base}/api/auth/login`;
        this._retried = false;
        console.log(`ClientDB: PostgreSQL Connection Layer - Base: ${base} (Target: ${this.apiUrl})`);
    }

    // Initialization is simple health check or no-op
    async init() {
        console.log("Connected to Spesfidem Persistent Server (Hybrid Mode)");
    }

    async save(client) {
        try {
            const response = await fetch(`${base}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(client)
            });
            if (response.ok) {
                const result = await response.json();
                return result;
            } else {
                throw new Error('El servidor PostgreSQL respondió con error status ' + response.status);
            }
        } catch (e) {
            console.error("Saver: Error al guardar usuario en PostgreSQL:", e);
            throw e;
        }
    }

    async delete(id) {
        // ALWAYS update local first for immediate UI responsiveness (Optimistic)
        this.deleteFromLocal(id);

        try {
            const response = await fetch(`${this.apiUrl}/${id}`, { method: 'DELETE' });
            if (response.ok) {
                console.log("Deleter: Server confirmed deletion.");
            } else {
                throw new Error('Server returned ' + response.status);
            }
        } catch (e) {
            console.warn("Deleter: Server unreachable, kept in LocalStorage as deleted:", e);
        }
    }

    async adminLogin(username, password) {
        try {
            const response = await fetch(this.loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, token: data.token, name: data.name };
            } else {
                return { success: false, message: "Acceso denegado" };
            }
        } catch (e) {
            console.error("Login attempt failed:", e);
            throw e; // Re-throw to allow UI to handle the connection error 
        }
    }

    async emptyTrash() {
        try {
            const response = await fetch(`${this.apiUrl}/trash`, { method: 'DELETE' });
            if (response.ok) {
                console.log("Empty Trash: Server confirmed permanent deletion.");
                // Wipe ALL potential local cache keys of deleted items
                const keysToClear = [DB_KEY, 'clients', 'spesfidem_clients', 'registros', 'db_spesfidem', 'spesfidem_db'];
                keysToClear.forEach(key => {
                    try {
                        let data = localStorage.getItem(key);
                        if (data) {
                            let clients = JSON.parse(data);
                            if (Array.isArray(clients)) {
                                let filtered = clients.filter(c => !c.deleted);
                                localStorage.setItem(key, JSON.stringify(filtered));
                            }
                        }
                    } catch (err) { }
                });
                return true;
            } else {
                throw new Error('Server returned ' + response.status);
            }
        } catch (e) {
            console.error("Empty Trash failed:", e);
            return false;
        }
    }

    async hardDelete(id) {
        try {
            const response = await fetch(`${this.apiUrl}/${id}?permanent=true`, { method: 'DELETE' });
            if (response.ok) {
                console.log(`Hard Delete: Server confirmed permanent deletion of ${id}.`);
                // Wipe from ALL potential local cache keys
                const keysToClear = [DB_KEY, 'clients', 'spesfidem_clients', 'registros', 'db_spesfidem', 'spesfidem_db'];
                keysToClear.forEach(key => {
                    try {
                        let data = localStorage.getItem(key);
                        if (data) {
                            let clients = JSON.parse(data);
                            if (Array.isArray(clients)) {
                                let filtered = clients.filter(c => String(c.id) !== String(id));
                                localStorage.setItem(key, JSON.stringify(filtered));
                            }
                        }
                    } catch (err) { }
                });
                return true;
            } else {
                throw new Error('Server returned ' + response.status);
            }
        } catch (e) {
            console.error("Hard Delete failed:", e);
            return false;
        }
    }

    async getAll() {
        try {
            console.log("Fetcher: Solicitando cotizaciones a la API PostgreSQL (http://localhost:3000/api/cotizaciones)...");
            const response = await fetch(`${this.apiUrl}?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`Servidor de base de datos devolvió status: ${response.status}`);
            }

            const jsonResponse = await response.json();
            const rawList = Array.isArray(jsonResponse) ? jsonResponse : (jsonResponse.data || []);

            console.log(`Fetcher: Recibidos ${rawList.length} registros desde PostgreSQL.`);

            // Mapeo seguro de atributos PostgreSQL a las claves que renderiza la interfaz
            return rawList.map(item => {
                const subtotal = Number(item.costo_materiales || 0);
                const grandTotal = Number(item.total || 0);
                const iva = Math.round(grandTotal - subtotal);

                return {
                    id: item.id_usuario || item.id_cotizacion || item.id,
                    serial: item.id_cotizacion || item.id_usuario || item.id,
                    id_usuario: item.id_usuario || item.id,
                    id_rol: item.id_rol,
                    rol: item.rol || item.role,
                    role: item.role || item.rol,
                    date: item.fecha_registro
                        ? (isNaN(new Date(item.fecha_registro).getTime()) ? item.fecha_registro : new Date(item.fecha_registro).toLocaleDateString('es-CO'))
                        : (item.fecha_emision ? new Date(item.fecha_emision).toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO')),
                    fullName: item.nombre_completo || item.fullName || item.cliente || 'Cliente Sin Nombre',
                    idCard: item.numero_documento || item.idCard || item.doc || item.id_card || 'N/A',
                    cellphone: item.celular || item.cellphone || 'N/A',
                    landline: '',
                    email: item.email || 'N/A',
                    city: item.ciudad_municipio || item.city || item.ciudad_obra || item.ciudad_cliente || 'Ibagué',
                    address: item.direccion || item.direccion_obra || 'N/A',
                    product: item.titulo_proyecto || item.product || 'Proyecto de Obra',
                    subtotal: subtotal,
                    iva: iva > 0 ? iva : 0,
                    grandTotal: grandTotal,
                    paymentPlan: '75-25',
                    deliveryStatus: item.deliveryStatus || item.estado || 'Pendiente',
                    inProduction: item.inProduction || false,
                    paymentStatus: (item.estado === 'Aprobado' || item.estado === 'Entregado') ? 'Pago' : 'Pendiente',
                    items: item.items || []
                };
            });
        } catch (e) {
            console.error("Fetcher: Error al conectar con PostgreSQL API:", e);
            return [];
        }
    }



    async getById(id) {
        // Fetch all and find (Simpler for this scale)
        const clients = await this.getAll();
        return clients.find(c => String(c.id) === String(id)) || null;
    }

    async getByIdCard(idCard) {
        if (!idCard) return null;
        const clients = await this.getAll();
        // Normalize comparison
        return clients.find(c => String(c.idCard).trim() === String(idCard).trim()) || null;
    }

    async getPaged(page, pageSize, searchQuery = '', showTrash = false) {
        let clients = await this.getAll();

        // Ensure we are working with an array
        if (!Array.isArray(clients)) clients = [];

        // Sort Newest First
        clients.sort((a, b) => (b.id || 0) - (a.id || 0));

        const query = searchQuery.toLowerCase();

        // Safe Filter: Prevent crash on null/undefined fields
        const filtered = clients.filter(c => {
            try {
                if (!c) return false;

                const matchesQuery = !query ||
                    (c.fullName && String(c.fullName).toLowerCase().includes(query)) ||
                    (c.cellphone && String(c.cellphone).includes(query)) ||
                    (c.idCard && String(c.idCard).includes(query)) ||
                    (c.city && String(c.city).toLowerCase().includes(query));

                const isDeleted = !!c.deleted || (c.status && c.status.toLowerCase() === 'papelera');
                const matchesStatus = showTrash ? isDeleted : !isDeleted;

                return matchesQuery && matchesStatus;
            } catch (err) {
                console.warn("Filter skip on item:", c, err);
                return false;
            }
        });

        const start = (page - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);

        return { items: pageItems, total: filtered.length };
    }

    async count(searchQuery = '') {
        const clients = await this.getAll();
        const query = searchQuery.toLowerCase();
        if (!query) return clients.length;

        return clients.filter(c =>
            (c.fullName && c.fullName.toLowerCase().includes(query)) ||
            (c.cellphone && String(c.cellphone).includes(query))
        ).length;
    }

    async getNextSerial() {
        const clients = await this.getAll();
        if (clients.length === 0) return 1;
        // Ignore deleted status for serial continuity
        const serials = clients.map(c => c.serial || 0);
        return Math.max(...serials) + 1;
    }
}

let currentCrmPrices = null;
const db = new ClientDB();
window.db = db;

// --- Accessibility (Visual Modes: Standard, Light, Dark, High Contrast) ---
// Accessibility init consolidated at bottom


// Consolidated below


function showToast(message, type = "info") {
    let container = document.getElementById('spesfidem-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'spesfidem-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 20000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #0f172a;
        color: white;
        padding: 12px 24px;
        border-radius: 50px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        font-weight: 600;
        font-size: 0.9rem;
        border: 1px solid rgba(255,255,255,0.1);
        animation: toastFadeIn 0.3s ease-out;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 10px;
    `;

    const icon = type === "success" ? "fa-check-circle" : "fa-info-circle";
    const color = type === "success" ? "#10b981" : "#3b82f6";

    toast.innerHTML = `<i class="fas ${icon}" style="color: ${color}"></i> <span>${message}</span>`;

    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.textContent = `
            @keyframes toastFadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes toastFadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-20px); } }
        `;
        document.head.appendChild(style);
    }

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
window.showToast = showToast;

// Global override: Replace native blocking alert() dialogs with non-blocking toast notifications
window.alert = function (message) {
    if (typeof showToast === 'function') {
        showToast(message, 'info');
    } else {
        console.log('[Alert Toast Replacement]:', message);
    }
};

// Sleek, non-blocking custom modal confirmation replacing native browser confirm() dialogs
window.showCustomConfirm = function ({
    title = '¿Confirmar Acción?',
    message = '¿Está seguro de realizar esta acción?',
    iconClass = 'fa-exclamation-triangle',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmColor = '#ef4444'
} = {}) {
    return new Promise((resolve) => {
        let modal = document.getElementById('customConfirmOverlay');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'customConfirmOverlay';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(14px); z-index: 20000; display: flex; align-items: center; justify-content: center; padding: 1.5rem; animation: fadeIn 0.3s ease-out;';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 2rem; padding: 3rem 2.5rem; text-align: center; max-width: 480px; width: 100%; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8), 0 0 30px ${confirmColor}33; animation: modalPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <div style="width: 70px; height: 70px; background: ${confirmColor}1f; border: 2px solid ${confirmColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; box-shadow: 0 0 20px ${confirmColor}44;">
                    <i class="fas ${iconClass}" style="font-size: 2.2rem; color: ${confirmColor};"></i>
                </div>
                <h3 style="color: white; font-family: 'Outfit', sans-serif; font-size: 1.5rem; margin-bottom: 0.8rem; font-weight: 800;">${title}</h3>
                <p style="color: #cbd5e1; font-size: 1.05rem; line-height: 1.6; margin-bottom: 2.2rem;">${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="customConfirmCancelBtn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; padding: 0.9rem 1.8rem; border-radius: 50px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: all 0.2s ease;">
                        ${cancelText}
                    </button>
                    <button id="customConfirmOkBtn" style="background: ${confirmColor}; border: none; color: white; padding: 0.9rem 2rem; border-radius: 50px; font-weight: 800; font-size: 1rem; cursor: pointer; box-shadow: 0 0 18px ${confirmColor}66; transition: all 0.2s ease;">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        document.getElementById('customConfirmCancelBtn').onclick = () => {
            modal.style.display = 'none';
            resolve(false);
        };

        document.getElementById('customConfirmOkBtn').onclick = () => {
            modal.style.display = 'none';
            resolve(true);
        };
    });
};

function getModeName(mode) {
    const names = { 'standard': 'Estándar', 'hc': 'Alto Contraste', 'light': 'Claro', 'dark-pure': 'Oscuro' };
    return names[mode] || mode;
}

function setFontZoom(level, notify = true) {
    const zoom = Math.min(Math.max(level, 0.8), 1.5); // Limit between 0.8x and 1.5x
    document.documentElement.style.setProperty('--font-zoom', zoom);
    localStorage.setItem('fontZoom', zoom);
    if (notify && window.showToast) {
        window.showToast(`Tamaño de letra: ${Math.round(zoom * 100)}%`, "success");
    }
}

function adjustFontSize(delta) {
    const current = parseFloat(localStorage.getItem('fontZoom') || '1');
    setFontZoom(current + delta);
}

// Global scope exposure
// --- Visual Modes & Accessibility ---

function setVisualMode(mode, notify = true) {
    // Clean all potential theme classes
    document.body.classList.remove('theme-light', 'theme-dark-pure', 'high-contrast');

    // Map 'hc' mode to the specific class expected by CSS (.high-contrast)
    if (mode === 'hc') {
        document.body.classList.add('high-contrast');
    } else if (mode === 'standard') {
        // Standard is default (no class), do nothing but save
    } else {
        // light -> theme-light, dark-pure -> theme-dark-pure
        document.body.classList.add(`theme-${mode}`);
    }

    localStorage.setItem('visualMode', mode);

    if (notify && window.showToast) {
        window.showToast(`Modo Visual: ${getModeName(mode)}`, "info");
    }
}

function cycleVisualMode() {
    const modes = ['standard', 'hc', 'light', 'dark-pure'];
    const current = localStorage.getItem('visualMode') || 'standard';
    const nextIndex = (modes.indexOf(current) + 1) % modes.length;
    setVisualMode(modes[nextIndex]);
}

function toggleHighContrast() {
    const current = localStorage.getItem('visualMode');
    if (current === 'hc') {
        setVisualMode('standard');
    } else {
        setVisualMode('hc');
    }
}

// --- Mobile Menu Logic ---
function toggleMobileMenu() {
    const menu = document.querySelector('.big-menu');
    if (menu) {
        menu.classList.toggle('active');
    }
}

// Event Listener for Mobile Menu
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('mobile-menu-btn');
    if (btn) {
        btn.onclick = toggleMobileMenu;
    }

    // Restore Saved Mode
    const savedMode = localStorage.getItem('visualMode');
    if (savedMode) setVisualMode(savedMode, false);

    // Restore Saved Zoom
    const savedZoom = localStorage.getItem('fontZoom');
    if (savedZoom) setFontZoom(parseFloat(savedZoom), false);

    // Enable theme transitions AFTER initial load to prevent flicker
    setTimeout(() => {
        document.body.classList.add('theme-transitions-active');
    }, 50);
});

// Global scope exposure
window.setVisualMode = setVisualMode;
window.cycleVisualMode = cycleVisualMode;
window.setFontZoom = setFontZoom;
window.adjustFontSize = adjustFontSize;
window.getModeName = getModeName;
window.toggleHighContrast = toggleHighContrast;
window.toggleMobileMenu = toggleMobileMenu;

// Legacy toggle support to avoid breaking existing HTML onclicks immediately
// Legacy toggle consolidated


async function migrateData() {
    if (sessionStorage.getItem('spesfidem_migrated') === 'true') return;
    try {
        const legacyData = localStorage.getItem(DB_KEY);
        if (legacyData) {
            const clients = JSON.parse(legacyData);
            if (Array.isArray(clients) && clients.length > 0) {
                console.log(`Syncing ${clients.length} local records with server...`);
                let successCount = 0;
                for (const client of clients) {
                    try {
                        const response = await fetch(db.apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(client)
                        });
                        if (response.ok) successCount++;
                    } catch (err) {
                        console.warn(`Sync failed for client ${client.id}:`, err);
                    }
                }
                console.log(`Sync complete. ${successCount}/${clients.length} records successfully sent to server.`);
            }
        }
        sessionStorage.setItem('spesfidem_migrated', 'true');
    } catch (e) {
        console.error("Sync failed:", e);
    }
}

function toggleMobileMenu(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.querySelector('.big-menu');
    if (menu) {
        menu.classList.toggle('active');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                if (menu.classList.contains('active')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                } else {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        }
    }
}
window.toggleMobileMenu = toggleMobileMenu;

// Duplicate migrateData removed
// 5. Gallery Init (if on gallery.html)
if (window.location.pathname.includes('gallery.html')) {
    initGalleryPage();
}

// --- Client Registration & Quotation Logic ---
async function saveClient(event) {
    event.preventDefault();
    const clientData = collectFormData(false); // Registration mode
    if (!clientData) return;

    try {
        await db.save(clientData);
        localStorage.setItem('spesfidem_client_user', JSON.stringify({ fullName: clientData.fullName, email: clientData.email, loggedIn: true }));
        showToast("¡Registro Exitoso! Bienvenido a Spesfidem Aluminio.", "success");
        event.target.reset();
        setTimeout(() => window.location.replace("photo_design.html"), 1500);
    } catch (e) {
        console.error("Save failed:", e);
        showToast("Error al guardar registro.", "error");
    }
}


function collectFormData(isSimulation = false) {
    const fullName = document.getElementById('fullName').value || 'Invitado';
    const cellphone = document.getElementById('cellphone').value || '';
    const city = document.getElementById('city').value || '';
    const address = document.getElementById('address').value || '';
    const email = document.getElementById('email').value || '';
    const landline = '';

    // Payment Plan
    const paymentPlanInput = document.querySelector('input[name="paymentPlan"]:checked');
    const paymentPlan = paymentPlanInput ? paymentPlanInput.value : '75-25';

    // If registering, we need actual data
    if (!isSimulation) {
        if (!document.getElementById('fullName').value || !cellphone || !city) {
            showToast("Por favor complete nombre, celular y ciudad en el Registro.", "error");
            return null;
        }
    }

    const items = [];
    const prodSlots = document.querySelectorAll('.product-slot');
    const qtySlots = document.querySelectorAll('.quantity-slot');
    const colorSlots = document.querySelectorAll('.color-slot');
    const glassSlots = document.querySelectorAll('.glass-slot');

    prodSlots.forEach((slot, i) => {
        const prod = slot.value;
        const qty = parseInt(qtySlots[i].value) || 1;
        if (prod) {
            // Price calculation logic (Simulator estimation)
            const basePrice = getBasePrice(prod);
            const profileMarkup = getProfileMarkup(colorSlots[i].value);
            const glassMarkup = getGlassMarkup(glassSlots[i].value);
            const unitPrice = basePrice + profileMarkup + glassMarkup;
            const total = unitPrice * qty;

            const width = document.querySelectorAll('.width-slot')[i].value;
            const height = document.querySelectorAll('.height-slot')[i].value;
            const sizeString = (width && height) ? `${width}m x ${height}m` : 'N/A';

            items.push({
                product: prod,
                quantity: qty,
                color: colorSlots[i].value,
                size: sizeString,
                glass: glassSlots[i].value,
                unitPrice: unitPrice,
                total: total
            });
        }
    });

    if (items.length === 0) {
        showToast("Seleccione al menos un producto en el Simulador.", "error");
        // Scroll to simulator if empty
        document.getElementById('productSlots').scrollIntoView({ behavior: 'smooth' });
        return null;
    }

    const subtotal = items.reduce((acc, item) => acc + item.total, 0);
    const iva = Math.round(subtotal * 0.19);
    const grandTotal = subtotal + iva;

    return {
        id: Date.now(),
        date: new Date().toLocaleDateString('es-CO'),
        fullName, cellphone, landline, city, address, email,
        status: 'Pendiente',
        product: items[0].product,
        quantity: items[0].quantity,
        items: items,
        paymentPlan: paymentPlan,
        subtotal: subtotal,
        iva: iva,
        grandTotal: grandTotal
    };
}

// ── NEW: Load CRM prices on startup ──
async function loadCrmPrices() {
    if (window.CrmPrices) {
        try {
            currentCrmPrices = await window.CrmPrices.getAll();
            console.log("[Spesfidem CRM] Precios dinámicos cargados.");
        } catch (e) { console.error("Error loading CRM prices:", e); }
    }
}
document.addEventListener('DOMContentLoaded', loadCrmPrices);

function getBasePrice(product) {
    // If we have CRM prices, we could map them here. 
    // For now, let's keep the base prices but allow override if we implement a "products" collection in CRM later.
    const prices = {
        // Ventanas
        'Ventana Corrediza': 380000,
        'Ventana Proyectante': 450000,
        'Ventana Casement': 480000,
        'Ventana Fija': 320000,
        'Ventana Basculante': 430000,
        // Puertas
        'Puerta Principal': 1350000,
        'Puerta de Patio': 980000,
        'Puerta Plegable': 1500000,
        'Puerta de Baño': 550000,
        // Otros
        'División de Baño': 650000, // Legacy fallback
        'División de Baño (Vidrio Templado)': 650000,
        'División de Baño (Acrílico)': 580000, // Slightly cheaper base
        'Vidrio Templado': 180000,
        'Espejos': 140000,
        'Fachada Flotante': 2500000,
        'Pasamanos / Otros': 220000
    };
    return prices[product] || 350000;
}

function getProfileMarkup(color) {
    if (currentCrmPrices && currentCrmPrices.profiles) {
        // Find if any series matches or use a default
        // For simplicity, we'll take the first series available or use '8025' as reference
        const p = currentCrmPrices.profiles['8025'] || Object.values(currentCrmPrices.profiles)[0];
        const colorKey = color.toLowerCase();
        if (p && p[colorKey]) return p[colorKey] - (p['natural'] || 38000); 
    }

    const markups = {
        'Natural': 0,
        'Blanco': 0,
        'Negro': 50000,
        'Champagne': 80000,
        'Madera': 160000
    };
    return markups[color] || 0;
}

function getGlassMarkup(glassSpec) {
    if (!glassSpec) return 0;

    // TRY CRM OVERRIDE
    if (currentCrmPrices && currentCrmPrices.glass) {
        const match = Object.keys(currentCrmPrices.glass).find(k => glassSpec.toLowerCase().includes(k.toLowerCase()));
        if (match) return currentCrmPrices.glass[match].priceM2 || 0;
    }

    let baseMarkup = 0;

    // Thickness/Type Logic
    if (glassSpec.includes('4mm')) baseMarkup = 60000;
    else if (glassSpec.includes('5mm')) baseMarkup = 85000;
    else if (glassSpec.includes('6mm')) baseMarkup = 155000;
    else if (glassSpec.includes('8mm')) baseMarkup = 230000;
    else if (glassSpec.includes('10mm')) baseMarkup = 310000;
    else if (glassSpec.includes('6.38mm')) baseMarkup = 260000;
    else if (glassSpec.includes('8.38mm')) baseMarkup = 380000;

    // Type Multipliers/Additives
    if (glassSpec.includes('Templado')) baseMarkup += 20000;
    if (glassSpec.includes('Laminado')) baseMarkup += 40000;
    if (glassSpec.includes('Acrílico')) baseMarkup = 95000; // Base Acrylic cost
    if (glassSpec.includes('Espejo')) baseMarkup = Math.max(baseMarkup, 100000);

    // Tones
    // Standard Colors
    if (glassSpec.includes('Bronce') && !glassSpec.includes('Reflectivo')) baseMarkup += 15000;
    if (glassSpec.includes('Gris') || glassSpec.includes('Humo')) baseMarkup += 15000;
    if (glassSpec.includes('Azul') && !glassSpec.includes('Reflectivo')) baseMarkup += 15000;
    if (glassSpec.includes('Verde')) baseMarkup += 15000;

    // Specialties
    if (glassSpec.includes('Reflectivo')) baseMarkup += 55000;
    if (glassSpec.includes('Esmeralizado') || glassSpec.includes('Sandblasted')) baseMarkup += 45000;

    return baseMarkup;
}

// --- Admin Panel Dashboard ---
let currentPage = 1;
const pageSize = 50;
let lastDeletedClient = null;
let selectedClientIds = new Set();
let isTrashMode = false;

async function loadAdminData() {
    const tableBody = document.getElementById('clientTableBody');
    if (!tableBody) {
        console.error("Loader: Table Body not found!");
        return;
    }

    console.log("Loader: Starting loadAdminData...");

    // Show Loading
    tableBody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:2rem; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Cargando datos...</td></tr>';

    try {
        const query = document.getElementById('adminSearch')?.value || '';

        // Update Title based on mode
        const titleSpan = document.getElementById('tableTitleStatus');
        if (titleSpan) {
            titleSpan.textContent = isTrashMode ? " (Papelera)" : "";
            titleSpan.style.color = isTrashMode ? "#ef4444" : "inherit";
        }

        // Update Greeting Name
        const nameDisplay = document.getElementById('adminNameDisplay');
        if (nameDisplay) {
            const storedName = sessionStorage.getItem('adminName') || 'Administrador';
            nameDisplay.textContent = storedName;
        }

        // Load Registered Users Table automatically first to cache roles
        await loadRegisteredUsersTable();

        const { items, total } = await db.getPaged(currentPage, pageSize, query, isTrashMode);

        const countHeader = document.getElementById('clientCountHeader');
        if (countHeader) countHeader.textContent = total;

        updateTrashCounter();
        updatePaginationUI(Math.ceil(total / pageSize));

        tableBody.innerHTML = '';
        if (items.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:2rem;">No se encontraron resultados en la base de datos (Local/Server).</td></tr>';
            return;
        }

        items.forEach(client => {
            let isAdmin = Number(client.id_rol) === 1 || client.rol === 'administrador' || client.rol === 'admin' || client.role === 'admin' || client.role === 'administrador';

            if (!isAdmin && window._cachedRegisteredUsers && window._cachedRegisteredUsers.length > 0) {
                const matchedUser = window._cachedRegisteredUsers.find(u => 
                    String(u.id || u.id_usuario) === String(client.id || client.id_usuario) ||
                    (u.email && client.email && u.email.toLowerCase().trim() === client.email.toLowerCase().trim()) ||
                    (u.numero_documento && client.idCard && String(u.numero_documento).trim() === String(client.idCard).trim())
                );
                if (matchedUser) {
                    const uRol = Number(matchedUser.id_rol);
                    const uRoleStr = String(matchedUser.rol || matchedUser.role || '').toLowerCase();
                    if (uRol === 1 || uRoleStr.includes('admin')) {
                        isAdmin = true;
                    }
                }
            }

            if (isAdmin) return; // Exclude admin accounts completely from project panel

            const isChecked = selectedClientIds.has(client.id);
            const row = document.createElement('tr');
            if (isChecked) row.classList.add('is-selected');
            if (client.deleted) row.style.background = '#fff1f2'; // Light red bg for deleted

            const isStarted = client.inProduction === true || client.deliveryStatus === 'En Fabricación' || client.deliveryStatus === 'En Proceso' || client.deliveryStatus === 'En Trabajo' || client.deliveryStatus === 'En Instalación' || client.deliveryStatus === 'Entregado';

            let actionBtns = '';
            if (isStarted) {
                actionBtns = `
                    <span style="background:#dbeafe; color:#1e40af; padding:6px 10px; border-radius:4px; font-weight:700; font-size:0.78rem; display:inline-flex; align-items:center; gap:4px;" title="Proyecto en Producción">
                        <i class="fas fa-hammer"></i> <span>En Producción</span>
                    </span>
                `;
            } else {
                actionBtns = `
                    <button onclick="window.startProject('${client.id}')" class="btn-start-project" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:600; display:inline-flex; align-items:center; gap:4px;" title="Iniciar Proyecto en Producción">
                        <i class="fas fa-play"></i> <span>Iniciar Proyecto</span>
                    </button>
                `;
            }

            let stageBadge = `<span style="color:#94a3b8; font-size:0.85rem; font-style:italic;">Sin Iniciar</span>`;
            if (isStarted) {
                const currentStage = client.deliveryStatus || 'En Fabricación';
                if (currentStage === 'En Fabricación' || currentStage === 'En Proceso' || currentStage === 'En Trabajo') {
                    stageBadge = `<span style="background:#bfdbfe; color:#1e40af; padding:4px 10px; border-radius:6px; font-weight:700; font-size:0.8rem;"><i class="fas fa-hammer"></i> En Fabricación</span>`;
                } else if (currentStage === 'En Instalación' || currentStage === 'Listo para Despacho' || currentStage === 'Listo') {
                    stageBadge = `<span style="background:#e0e7ff; color:#3730a3; padding:4px 10px; border-radius:6px; font-weight:700; font-size:0.8rem;"><i class="fas fa-truck"></i> En Instalación</span>`;
                } else if (currentStage === 'Entregado') {
                    stageBadge = `<span style="background:#bbf7d0; color:#166534; padding:4px 10px; border-radius:6px; font-weight:700; font-size:0.8rem;"><i class="fas fa-check-circle"></i> Entregado</span>`;
                }
            }

            row.innerHTML = `
                <td style="text-align:center;">
                    <input type="checkbox" class="client-checkbox" value="${client.id}" 
                        ${isChecked ? 'checked' : ''} 
                        onclick="toggleSelectClient(${client.id}, this)" 
                        style="cursor:pointer; width: 16px; height: 16px;">
                </td>
                <td>${client.date}</td>
                <td style="font-weight:bold;">${client.fullName}</td>
                <td style="color:#64748b; font-family:monospace;">${client.idCard || 'N/A'}</td>
                <td>
                    <div>Cel: ${client.cellphone}</div>
                    ${client.landline ? `<div style="font-size:0.8rem; color:#64748b;">Fijo: ${client.landline}</div>` : ''}
                </td>
                <td><span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-weight:600;">${client.city || 'N/A'}</span></td>
                <td><div style="font-weight:600; color:var(--accent); font-size:0.85rem;">${getProductString(client)}</div></td>
                <td>${client.email}</td>
                <td style="max-width:200px;">${client.address}</td>
                <td>${stageBadge}</td>
                <td style="display:flex; gap:0.5rem; justify-content: center; align-items: center; background: white; position: sticky; right: 0; z-index: 5; box-shadow: -2px 0 5px rgba(0,0,0,0.05); min-width: 180px; padding: 10px;">
                    ${actionBtns}
                </td>
            `;

            // Adjust background for highlighted rows
            if (client.deleted) {
                row.querySelector('td:last-child').style.background = '#fff1f2';
            }
            tableBody.appendChild(row);
        });

        updateHeaderCheckbox();
    } catch (e) {
        console.error("Load data failed:", e);
    }
}

function getProductString(client) {
    if (client.items && Array.isArray(client.items)) {
        return client.items.map(item => {
            const parts = [
                item.quantity > 1 ? `${item.quantity}x` : '',
                item.product,
                item.color && item.color !== 'N/A' ? `(${item.color})` : '',
                item.glass && item.glass !== 'N/A' ? `| ${item.glass}` : '',
                item.size && item.size !== 'N/A' ? `[${item.size}]` : ''
            ].filter(p => p && p.trim() !== '').join(' ');
            return parts;
        }).join(', ');
    }
    return `${client.quantity || 1}x ${client.product || 'N/A'}`;
}

function updatePaginationUI(totalPages) {
    const container = document.getElementById('paginationControls');
    if (!container) return;
    container.innerHTML = `
        <button onclick="changePage(-1)" ${currentPage <= 1 ? 'disabled' : ''} class="btn-nav">Anterior</button>
        <span style="font-weight:bold; color:#64748b;">Página ${currentPage} de ${totalPages || 1}</span>
        <button onclick="changePage(1)" ${currentPage >= totalPages ? 'disabled' : ''} class="btn-nav">Siguiente</button>
    `;
}

function changePage(delta) {
    currentPage += delta;
    loadAdminData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window._cachedRegisteredUsers = [];

async function loadRegisteredUsersTable() {
    const tbody = document.getElementById('registeredUsersTableBody');
    const badge = document.getElementById('registeredUserCountBadge');
    if (!tbody) return;

    let users = [];

    // 1. Obtener usuarios desde la API de PostgreSQL
    try {
        const origin = (window.location.protocol.startsWith('http')) ? '' : 'http://localhost:3000';
        const response = await fetch(`${origin}/api/auth/users`);
        if (response.ok) {
            users = await response.json();
        }
    } catch (e) {
        console.warn("Error al cargar usuarios desde PostgreSQL:", e);
    }

    window._cachedRegisteredUsers = users || [];

    if (badge) badge.textContent = users ? users.length : 0;

    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding: 2rem; text-align: center; color: #94a3b8;">No se han encontrado usuarios registrados.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const id = u.id_usuario || u.id;
        const nombre = u.nombre_completo || u.fullName || u.name || 'Usuario';
        const doc = u.idCard || u.idcard || u.numero_documento || u.doc || 'N/A';
        const cel = u.celular || u.cellphone || u.phone || 'N/A';
        const email = u.email || 'N/A';
        const ciudad = u.city || u.ciudad_municipio || u.ciudad || 'Ibagué';
        const fechaRaw = u.registrationDate || u.registrationdate || u.fecha_registro;
        const fecha = fechaRaw 
            ? (isNaN(new Date(fechaRaw).getTime()) ? fechaRaw : new Date(fechaRaw).toLocaleDateString('es-CO'))
            : 'Reciente';

        const esAdmin = (u.rol === 'administrador' || u.rol === 'admin' || String(u.id_rol) === '1');
        const badgeRolHtml = esAdmin
            ? `<span style="background: rgba(56, 189, 248, 0.15); color: #0284c7; border: 1px solid rgba(56, 189, 248, 0.3); padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 700; font-size: 0.75rem;"><i class="fas fa-user-shield"></i> Administrador</span>`
            : `<span style="background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 700; font-size: 0.75rem;"><i class="fas fa-user"></i> Usuario</span>`;

        const actionBtnHtml = esAdmin
            ? `<span style="padding: 0.4rem 0.7rem; background: #64748b; color: white; border-radius: 6px; font-size: 0.78rem; font-weight: bold; opacity: 0.85;" title="Credencial Administrador Predeterminada"><i class="fas fa-lock"></i> Predeterminado</span>`
            : `<button onclick="window.openEditUserModal('${id}')" title="Editar Usuario" style="padding: 0.4rem 0.8rem; background: #0284c7; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: background 0.2s;"><i class="fas fa-edit"></i> Editar</button>`;

        return `
        <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
            <td style="padding: 1rem; font-weight: 700; color: #0f172a;">
                <div style="display:flex; align-items:center; gap: 0.6rem;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: ${esAdmin ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${esAdmin ? '#0284c7' : '#059669'}; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size: 0.85rem;">
                        ${nombre.charAt(0).toUpperCase()}
                    </div>
                    <span>${nombre}</span>
                </div>
            </td>
            <td style="padding: 1rem; color: #475569;">${doc}</td>
            <td style="padding: 1rem; color: #0284c7; font-weight: 600;">${cel}</td>
            <td style="padding: 1rem; color: #0284c7; font-weight: 600;">${email}</td>
            <td style="padding: 1rem; color: #475569;">${ciudad}</td>
            <td style="padding: 1rem; color: #64748b; font-size: 0.85rem;">${fecha}</td>
            <td style="padding: 1rem; text-align: center;">
                ${badgeRolHtml}
            </td>
            <td style="padding: 1rem; text-align: center;">
                <div style="display:flex; gap:0.4rem; justify-content:center;">
                    ${actionBtnHtml}
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

window.loadRegisteredUsersTable = loadRegisteredUsersTable;

function setModalError(boxId, textId, msg) {
    const box = document.getElementById(boxId);
    const text = document.getElementById(textId);
    if (box && text) {
        text.textContent = msg;
        box.style.display = 'flex';
    } else {
        showToast(msg, 'error');
    }
}

function clearModalError(boxId) {
    const box = document.getElementById(boxId);
    if (box) box.style.display = 'none';
}

// --- Admin User Management CRUD Modals & Actions ---

window.openEditUserModal = function(userId) {
    clearModalError('editUserErrorBox');
    const user = (window._cachedRegisteredUsers || []).find(u => String(u.id || u.id_usuario) === String(userId));
    if (!user) {
        showToast('No se encontró información del usuario seleccionado.', 'error');
        return;
    }

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserName').value = user.fullName || user.name || '';
    document.getElementById('editUserDoc').value = user.idCard || user.doc || '';
    document.getElementById('editUserCell').value = user.cellphone || '';
    document.getElementById('editUserEmail').value = user.email || '';
    document.getElementById('editUserCity').value = user.city || '';
    document.getElementById('editUserPassword').value = user.password || user.pass || '';
    document.getElementById('editUserRole').value = user.role || 'user';
    document.getElementById('editUserStatus').value = user.status || 'Activo';

    const overlay = document.getElementById('editUserOverlay');
    if (overlay) overlay.style.display = 'flex';
};

window.closeEditUserModal = function() {
    clearModalError('editUserErrorBox');
    const overlay = document.getElementById('editUserOverlay');
    if (overlay) overlay.style.display = 'none';
};

window.saveEditUser = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    clearModalError('editUserErrorBox');

    const id = document.getElementById('editUserId')?.value;
    const name = document.getElementById('editUserName')?.value.trim();
    const doc = document.getElementById('editUserDoc')?.value.trim();
    const cell = document.getElementById('editUserCell')?.value.trim();
    const email = document.getElementById('editUserEmail')?.value.trim();
    const city = document.getElementById('editUserCity')?.value.trim();
    const pass = document.getElementById('editUserPassword')?.value;
    const role = document.getElementById('editUserRole')?.value || 'user';
    const status = document.getElementById('editUserStatus')?.value || 'Activo';

    // Strict Validations
    if (!name || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(name)) {
        setModalError('editUserErrorBox', 'editUserErrorText', 'El nombre solo debe contener letras y espacios.');
        return;
    }
    if (!doc || !/^[a-zA-Z0-9.\-\s]+$/.test(doc)) {
        setModalError('editUserErrorBox', 'editUserErrorText', 'Por favor ingrese un número de documento válido.');
        return;
    }
    if (!cell || !/^\d{10}$/.test(cell)) {
        setModalError('editUserErrorBox', 'editUserErrorText', 'El número telefónico debe contener exactamente 10 dígitos numéricos.');
        return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setModalError('editUserErrorBox', 'editUserErrorText', 'Por favor ingrese un correo electrónico válido.');
        return;
    }
    if (!city || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(city)) {
        setModalError('editUserErrorBox', 'editUserErrorText', 'La ciudad solo debe contener letras.');
        return;
    }
    if (pass && (pass.length < 6 || !/[A-Z]/.test(pass) || !/[0-9]/.test(pass))) {
        setModalError('editUserErrorBox', 'editUserErrorText', 'La contraseña debe tener al menos 6 caracteres, incluir al menos una letra mayúscula y un número.');
        return;
    }

    try {
        const response = await fetch('/api/registered-users/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id,
                id_usuario: id,
                nombre_completo: name,
                numero_documento: doc,
                celular: cell,
                email,
                ciudad_municipio: city,
                password: pass,
                role
            })
        });
        const resData = await response.json();
        if (response.ok && (resData.success || resData.ok)) {
            showToast('¡Usuario actualizado correctamente en PostgreSQL!', 'success');
            window.closeEditUserModal();
            loadRegisteredUsersTable();
            return;
        } else {
            setModalError('editUserErrorBox', 'editUserErrorText', resData.message || resData.mensaje || 'Error al actualizar usuario.');
        }
    } catch(err) {
        console.error("Error al actualizar usuario en PostgreSQL:", err);
        setModalError('editUserErrorBox', 'editUserErrorText', 'Error de conexión con el servidor PostgreSQL.');
    }
};

window.startProject = async function(clientId) {
    try {
        const { items } = await db.getPaged(1, 1000, '', false);
        let client = items.find(c => String(c.id || c.id_usuario) === String(clientId));

        if (!client && window._cachedRegisteredUsers) {
            const regUser = window._cachedRegisteredUsers.find(u => String(u.id || u.id_usuario) === String(clientId));
            if (regUser) {
                client = {
                    id: regUser.id_usuario || regUser.id,
                    id_usuario: regUser.id_usuario || regUser.id,
                    fullName: regUser.nombre_completo || regUser.fullName || regUser.name || 'Cliente',
                    idCard: regUser.numero_documento || regUser.idCard || regUser.doc || 'N/A',
                    cellphone: regUser.celular || regUser.cellphone || 'N/A',
                    email: regUser.email || 'N/A',
                    city: regUser.ciudad_municipio || regUser.city || 'Ibagué',
                    address: regUser.direccion || 'N/A',
                    product: 'Proyecto de Obra',
                    deliveryStatus: 'Pendiente',
                    id_rol: regUser.id_rol,
                    rol: regUser.rol || regUser.role
                };
            }
        }

        if (!client) {
            showToast("No se encontró la información del cliente.", "error");
            return;
        }

        const isAdmin = Number(client.id_rol) === 1 || client.rol === 'administrador' || client.rol === 'admin' || client.role === 'admin' || client.role === 'administrador';
        if (isAdmin) {
            showToast("Las cuentas de administrador no pueden tener proyectos iniciados. Esta función es exclusiva para usuarios.", "error");
            return;
        }

        const clientName = client.fullName || client.nombre_completo || 'este cliente';
        const confirmed = window.showCustomConfirm ? await window.showCustomConfirm({
            title: '¿Iniciar Proyecto?',
            message: `¿Desea iniciar el proyecto de fabricación para <strong style="color:white;">${clientName}</strong> e ingresarlo a la Planta de Producción?`,
            iconClass: 'fa-play-circle',
            confirmText: 'Sí, Iniciar Proyecto',
            cancelText: 'Cancelar',
            confirmColor: '#10b981'
        }) : confirm(`¿Desea iniciar el proyecto para ${clientName}?`);

        if (!confirmed) return;

        client.inProduction = true;
        client.deliveryStatus = 'En Fabricación';
        await db.save(client);
        showToast(`¡Proyecto de ${clientName} iniciado e ingresado a Producción!`, "success");
        loadAdminData();
        if (window.loadProductionData) window.loadProductionData();
    } catch (e) {
        console.error("Error al iniciar proyecto:", e);
        showToast("Error al iniciar proyecto.", "error");
    }
};

function filterClients() {
    currentPage = 1;
    loadAdminData();
}

function updateCSVBtnText() {
    const btnText = document.getElementById('csvBtnText');
    if (!btnText) return;
    if (selectedClientIds.size > 0) {
        btnText.textContent = `Descargar Seleccionados (${selectedClientIds.size})`;
    } else {
        btnText.textContent = "Exportar Todos (CSV)";
    }
}

function toggleSelectClient(id, checkbox) {
    const row = checkbox.closest('tr');
    if (checkbox.checked) {
        selectedClientIds.add(id);
        if (row) row.classList.add('is-selected');
    } else {
        selectedClientIds.delete(id);
        if (row) row.classList.remove('is-selected');
    }
    updateCSVBtnText();
    updateHeaderCheckbox();
}

function toggleSelectAll(headerCheckbox) {
    const checkboxes = document.querySelectorAll('.client-checkbox');
    checkboxes.forEach(cb => {
        const id = parseInt(cb.value);
        const row = cb.closest('tr');
        cb.checked = headerCheckbox.checked;
        if (headerCheckbox.checked) {
            selectedClientIds.add(id);
            if (row) row.classList.add('is-selected');
        } else {
            selectedClientIds.delete(id);
            if (row) row.classList.remove('is-selected');
        }
    });
    updateCSVBtnText();
}

function updateHeaderCheckbox() {
    const headerCheckbox = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.client-checkbox');
    if (!headerCheckbox || checkboxes.length === 0) return;

    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    headerCheckbox.checked = allChecked;
}

// --- Admin Actions ---

async function updateTrashCounter() {
    try {
        const { total } = await db.getPaged(1, 1000, '', true);
        const counter = document.getElementById('trashCountBadge');
        if (counter) {
            counter.textContent = total;
            counter.style.display = total > 0 ? 'inline-block' : 'none';
        }
    } catch (e) {
        console.warn("Trash counter update failed:", e);
    }
}

function toggleTrashMode() {
    isTrashMode = !isTrashMode;
    const btn = document.getElementById('btnTrashToggle');
    const badge = document.getElementById('trashCountBadge');
    const btnEmpty = document.getElementById('btnEmptyTrash');

    if (btn) {
        if (isTrashMode) {
            btn.style.background = '#ef4444';
            btn.innerHTML = `<i class="fas fa-arrow-left"></i> Volver a Clientes`;
            if (btnEmpty) btnEmpty.style.display = 'flex';
        } else {
            btn.style.background = '#64748b';
            btn.innerHTML = `<i class="fas fa-trash"></i> Ver Papelera <span id="trashCountBadge" style="background:#ef4444; color:white; padding: 0.1rem 0.5rem; border-radius: 10px; font-size: 0.75rem; font-weight: bold; margin-left: 5px; display: none;">0</span>`;
            if (btnEmpty) btnEmpty.style.display = 'none';
            // Trigger refresh to update the new badge
            updateTrashCounter();
        }
    }
    currentPage = 1;
    loadAdminData();
}

window.emptyTrash = async function () {
    console.log("Action: emptyTrash initiated");
    const confirmed = await window.showCustomConfirm({
        title: '¿Vaciar Papelera?',
        message: 'Esta acción ELIMINARÁ PERMANENTEMENTE todos los registros de la papelera y no se puede deshacer.',
        iconClass: 'fa-trash-alt',
        confirmText: 'Sí, Vaciar Todo',
        cancelText: 'Cancelar',
        confirmColor: '#ef4444'
    });
    if (!confirmed) return;

    try {
        const success = await db.emptyTrash();
        if (success) {
            showToast("Papelera vaciada permanentemente.", "success");
            loadAdminData();
        } else {
            showToast("Error al vaciar la papelera.", "error");
        }
    } catch (e) {
        console.error("emptyTrash Error:", e);
        showToast("Error de conexión.", "error");
    }
};

window.restoreClient = async function (id) {
    console.log(`Action: restoreClient(${id})`);
    const confirmed = await window.showCustomConfirm({
        title: '¿Restaurar Cliente?',
        message: '¿Desea restaurar este cliente a la lista activa?',
        iconClass: 'fa-undo',
        confirmText: 'Restaurar',
        cancelText: 'Cancelar',
        confirmColor: '#10b981'
    });
    if (!confirmed) return;

    try {
        const client = await db.getById(id);
        if (client) {
            client.deleted = false;
            await db.save(client);
            loadAdminData();
            showToast("Cliente restaurado exitosamente.", "success");
        }
    } catch (e) {
        console.error("Restore failed:", e);
        showToast("Error al restaurar.", "error");
    }
};

window.hardDeleteClient = async function (id) {
    console.log(`Action: hardDeleteClient(${id})`);
    const confirmed = await window.showCustomConfirm({
        title: '¿Eliminar Definitivamente?',
        message: 'Esta acción eliminará el registro de forma permanente. ¿Desea continuar?',
        iconClass: 'fa-exclamation-triangle',
        confirmText: 'Sí, Eliminar',
        cancelText: 'Cancelar',
        confirmColor: '#ef4444'
    });
    if (!confirmed) return;

    try {
        const success = await db.hardDelete(id);
        if (success) {
            showToast("Cliente eliminado para siempre.", "success");
            loadAdminData();
        } else {
            showToast("Error al eliminar permanentemente.", "error");
        }
    } catch (e) {
        console.error("Hard delete failed:", e);
        showToast("Error de conexión.", "error");
    }
};

window.deleteClient = async function (id) {
    console.log(`Action: deleteClient(${id})`);
    const confirmed = await window.showCustomConfirm({
        title: '¿Mover a Papelera?',
        message: '¿Está seguro de mover este cliente a la papelera?',
        iconClass: 'fa-archive',
        confirmText: 'Mover a Papelera',
        cancelText: 'Cancelar',
        confirmColor: '#f59e0b'
    });
    if (!confirmed) return;

    try {
        await db.delete(id);
        loadAdminData();
        showToast("Cliente movido a la papelera.", "info");
    } catch (e) { console.error("deleteClient Error:", e); }
};

async function undoLastDelete() {
    // Deprecated in favor of Trash Mode but keeping for compatibility if invoked
    if (!lastDeletedClient) return;
    restoreClient(lastDeletedClient.id);
}

function showUndoToast(msg) {
    const container = document.querySelector('.toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = 'toast show';
    toast.style.cssText = 'display:flex; align-items:center; gap:1rem; padding: 1rem;';
    toast.innerHTML = `
        <span>${msg}</span>
        <button onclick="undoLastDelete(); this.parentElement.remove();" style="background:#fbbf24; border:none; padding:5px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">DESHACER</button>
    `;
    container.appendChild(toast);
    if (deleteTimeout) clearTimeout(deleteTimeout);
    deleteTimeout = setTimeout(() => {
        toast.remove();
        lastDeletedClient = null;
    }, 6000);
}

function showToast(msg, type = 'info') {
    let container = document.getElementById('spesfidem-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'spesfidem-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 25px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            pointer-events: none;
            width: 90%;
            max-width: 520px;
        `;
        document.body.appendChild(container);
    }

    const isSuccess = type === 'success';
    const isError = type === 'error' || type === 'danger';
    
    const bgColor = isError 
        ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)' 
        : isSuccess 
            ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)' 
            : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';

    const borderColor = isError ? 'rgba(248, 113, 113, 0.5)' : isSuccess ? 'rgba(52, 211, 153, 0.5)' : 'rgba(245, 158, 11, 0.5)';
    const iconClass = isError ? 'fa-exclamation-circle' : isSuccess ? 'fa-check-circle' : 'fa-info-circle';
    const iconColor = isError ? '#fca5a5' : isSuccess ? '#6ee7b7' : '#fde047';

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${bgColor};
        border: 1.5px solid ${borderColor};
        color: #ffffff;
        padding: 1rem 1.8rem;
        border-radius: 50px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 25px ${borderColor};
        font-weight: 700;
        font-size: 1rem;
        font-family: 'Inter', sans-serif;
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        box-sizing: border-box;
        text-align: center;
        justify-content: center;
        animation: toastSlideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: auto;
    `;

    toast.innerHTML = `<i class="fas ${iconClass}" style="font-size: 1.3rem; color: ${iconColor}; flex-shrink: 0;"></i> <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px) scale(0.95)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- Edit Modal Logic ---
async function openEditModal(id) {
    const client = await db.getById(id);
    if (!client) return;

    document.getElementById('editId').value = client.id;
    document.getElementById('editName').value = client.fullName;
    document.getElementById('editDoc').value = client.idCard || '';
    document.getElementById('editCel').value = client.cellphone;
    document.getElementById('editTel').value = client.landline || '';
    document.getElementById('editCity').value = client.city;
    document.getElementById('editAddress').value = client.address;
    document.getElementById('editEmail').value = client.email;
    if (document.getElementById('editDeliveryStatus')) {
        document.getElementById('editDeliveryStatus').value = client.deliveryStatus || 'Pendiente';
    }

    const container = document.getElementById('editProductSlots');
    if (container) {
        container.innerHTML = '';
        const prodOptions = `
            <option value="">Producto...</option>
            <optgroup label="Sistemas de Ventanas">
                <option value="Ventana Corrediza">Ventana Corrediza</option>
                <option value="Ventana Proyectante">Ventana Proyectante</option>
                <option value="Ventana Casement">Ventana Casement</option>
                <option value="Ventana Fija">Ventana Fija</option>
                <option value="Ventana Basculante">Ventana Basculante</option>
            </optgroup>
            <optgroup label="Sistemas de Puertas">
                <option value="Puerta Principal">Puerta Principal</option>
                <option value="Puerta de Patio">Puerta de Patio</option>
                <option value="Puerta Plegable">Puerta Plegable</option>
                <option value="Puerta de Baño">Puerta de Baño</option>
            </optgroup>
            <optgroup label="Especialidades">
                <option value="División de Baño (Vidrio Templado)">División de Baño (Vidrio Templado)</option>
                <option value="División de Baño (Acrílico)">División de Baño (Acrílico)</option>
                <option value="Vidrio Templado">Vidrio Templado</option>
                <option value="Espejos">Espejos</option>
                <option value="Fachada Flotante">Fachada Flotante</option>
                <option value="Pasamanos / Otros">Pasamanos / Otros</option>
            </optgroup>
        `;

        const items = client.items || [{ product: client.product, quantity: client.quantity }];

        // LIMIT: 3 Slots (Matching Simulator)
        for (let i = 0; i < 3; i++) {
            const item = items[i] || { product: '', quantity: 1, color: 'Natural', size: '', glass: 'Monolítico' };
            const div = document.createElement('div');
            div.style.padding = '10px';
            div.style.borderBottom = '1px solid #eee';
            div.style.marginBottom = '10px';
            div.innerHTML = `
                <div style="display:grid; grid-template-columns: 2fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
                    <select class="edit-product-slot" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px;">
                        ${prodOptions}
                    </select>
                    <input type="number" class="edit-quantity-slot" value="${item.quantity}" min="1" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px;">
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.4rem;">
                    <select class="edit-color-slot" style="padding:5px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.8rem;">
                        <option value="Natural">Natural</option>
                        <option value="Negro">Negro</option>
                        <option value="Madera">Madera</option>
                        <option value="Blanco">Blanco</option>
                        <option value="Champagne">Champagne</option>
                    </select>
                    <input type="text" class="edit-size-slot" placeholder="Tamaño" value="${item.size || ''}" style="padding:5px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.8rem;">
                    <select class="edit-glass-slot" style="padding:5px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.8rem;">
                        <option value="">Vidrio...</option>
                        <optgroup label="Monolítico">
                            <option value="Monolítico 4mm Incoloro">4mm Incoloro</option>
                            <option value="Monolítico 4mm Bronce">4mm Bronce</option>
                            <option value="Monolítico 4mm Gris">4mm Gris</option>
                            <option value="Monolítico 5mm Incoloro">5mm Incoloro</option>
                        </optgroup>
                        <optgroup label="Templado">
                            <option value="Templado 6mm Incoloro">6mm Incoloro</option>
                            <option value="Templado 6mm Bronce">6mm Bronce</option>
                            <option value="Templado 6mm Gris">6mm Gris</option>
                            <option value="Templado 8mm Incoloro">8mm Incoloro</option>
                        </optgroup>
                        <optgroup label="Laminado">
                            <option value="Laminado 6.38mm Incoloro">6.38mm Incoloro</option>
                            <option value="Laminado 8.38mm Incoloro">8.38mm Incoloro</option>
                        </optgroup>
                        <optgroup label="Acrílicos (Baños)">
                            <option value="Acrílico Azul Brisa">Azul Brisa</option>
                            <option value="Acrílico Fucsia">Fucsia</option>
                            <option value="Acrílico Cristal">Cristal (Incoloro)</option>
                            <option value="Acrílico Opalizado">Opalizado</option>
                        </optgroup>
                        <optgroup label="Espejos/Otros">
                            <option value="Espejo 3mm">Espejo 3mm</option>
                            <option value="Espejo 4mm">Espejo 4mm</option>
                            <option value="Vidrio Sandblasting">Sandblasting</option>
                        </optgroup>
                    </select>
                </div>
            `;
            const pSlot = div.querySelector('.edit-product-slot');
            const cSlot = div.querySelector('.edit-color-slot');
            const gSlot = div.querySelector('.edit-glass-slot');
            pSlot.value = item.product;
            cSlot.value = item.color || 'Natural';
            gSlot.value = item.glass || 'Monolítico';
            container.appendChild(div);
        }
    }

    document.getElementById('editOverlay').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editOverlay').style.display = 'none';
}

async function saveEditClient(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('editId').value);
    const client = await db.getById(id);
    if (!client) return;

    client.fullName = document.getElementById('editName').value;
    client.idCard = document.getElementById('editDoc').value;
    client.cellphone = document.getElementById('editCel').value;
    client.landline = document.getElementById('editTel').value;
    client.city = document.getElementById('editCity').value;
    client.address = document.getElementById('editAddress').value;
    client.email = document.getElementById('editEmail').value;
    if (document.getElementById('editDeliveryStatus')) {
        client.deliveryStatus = document.getElementById('editDeliveryStatus').value;
    }

    const items = [];
    const pSlots = document.querySelectorAll('.edit-product-slot');
    const qSlots = document.querySelectorAll('.edit-quantity-slot');
    const colorSlots = document.querySelectorAll('.edit-color-slot');
    const sizeSlots = document.querySelectorAll('.edit-size-slot');
    const glassSlots = document.querySelectorAll('.edit-glass-slot');

    pSlots.forEach((slot, i) => {
        const prod = slot.value;
        const qty = parseInt(qSlots[i].value) || 1;
        if (prod) {
            const basePrice = getBasePrice(prod);
            const profileMarkup = getProfileMarkup(colorSlots[i].value);
            const glassMarkup = getGlassMarkup(glassSlots[i].value);
            const unitPrice = basePrice + profileMarkup + glassMarkup;

            items.push({
                product: prod,
                quantity: qty,
                color: colorSlots[i].value,
                size: sizeSlots[i].value,
                glass: glassSlots[i].value,
                unitPrice: unitPrice,
                total: unitPrice * qty
            });
        }
    });

    if (items.length > 0) {
        client.product = items[0].product;
        client.quantity = items[0].quantity;
        client.items = items;
        const subtotal = items.reduce((acc, it) => acc + it.total, 0);
        client.subtotal = subtotal;
        client.iva = Math.round(subtotal * 0.19);
        client.grandTotal = subtotal + client.iva;
    }

    await db.save(client);
    closeEditModal();
    loadAdminData();
    showToast("Cambios guardados correctamente.");
}

// --- Gallery Logic (for gallery.html) ---
const galleries = {
    'ventana_corrediza': 5, 'ventana_proyectante': 103, 'ventana_casement': 20,
    'ventana_batiente': 14, 'ventana_fija': 100, 'ventana_basculante': 100,
    'puerta_principal': 232, 'puerta_patio': 100, 'puerta_plegable': 100,
    'puerta_bano': 100, 'division_bano': 59, 'espejos': 0,
    'espejos_decorativos': 50, 'division_acrilico': 0, 'ventana_abatible': 105,
    'vidrio_templado': 103
};

function initGalleryPage() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    const grid = document.getElementById('galleryGrid');
    const title = document.getElementById('pageTitle');
    if (!cat || !grid) return;

    if (title) title.textContent = cat.replace(/_/g, ' ').toUpperCase();
    grid.innerHTML = '';

    const count = galleries[cat] || 0;
    const version = Date.now(); // Cache buster

    for (let i = 1; i <= count; i++) {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        // Relative container to position button absolute
        item.style.position = 'relative';

        const img = new Image();
        img.className = 'gallery-img';
        img.alt = `${cat} Model ${i}`;

        // Add to DOM first so we can append button
        item.appendChild(img);

        // Add Cart Button
        const btn = document.createElement('button');
        btn.className = 'btn-add-cart';
        btn.innerHTML = '<i class="fas fa-plus"></i>';
        btn.title = "Agregar a Cotización";

        // We need the final src for the cart, which resolves after error handling.
        // Simplified approach: Pass the base JPG path, if it fails, the user wouldn't see/click it anyway (hidden).
        // Actually, if it fails to PNG, the cart might register JPG. 
        // For now, let's just pass a generic reference.
        btn.onclick = (e) => {
            e.stopPropagation(); // Prevent gallery viewer open
            addToCartFromGallery(cat, img.src);
        };

        item.appendChild(btn);

        // SMART FORMAT HANDLING: Try .jpg first (usually real photos), then .png (placeholders or logo-style)
        const tryPngFallback = () => {
            img.src = `./images/gallery/${cat}/${i}.png?v=${version}`;
            img.onerror = () => {
                item.style.display = 'none'; // Only hide if BOTH fail
            };
        };

        img.onerror = tryPngFallback;
        img.src = `./images/gallery/${cat}/${i}.jpg?v=${version}`;

        img.onclick = () => {
            window.location.href = `view_photo.html?src=${encodeURIComponent(img.src)}&cat=${encodeURIComponent(cat)}`;
        };



        const caption = document.createElement('div');
        caption.className = 'gallery-caption';
        caption.textContent = `Modelo Premium #${i}`;
        item.appendChild(caption);
        grid.appendChild(item);
    }
}

// --- Admin Auth & Utilities ---
window.toggleSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
};

// --- Global Registration & Quotation Logic ---

/**
 * Searches for an existing client by Document/ID Card.
 * Used in registration forms across the site.
 */
window.searchExistingClient = async function (inputId, fieldsMap) {
    const doc = document.getElementById(inputId)?.value.trim();
    if (!doc) {
        showToast("Por favor ingrese su Documento o NIT para buscar.", "error");
        return;
    }

    try {
        if (typeof db === 'undefined') {
            await window.db.init();
        }
        const client = await window.db.getByIdCard(doc);
        if (client) {
            // Map return data to form fields
            for (const [dataKey, fieldId] of Object.entries(fieldsMap)) {
                const el = document.getElementById(fieldId);
                if (el) {
                    el.value = client[dataKey] || '';
                    el.style.border = '2px solid #10b981';
                    el.style.background = '#f0fdf4';
                }
            }
            showToast(`¡Hola ${client.fullName}! Hemos cargado tus datos registrados.`, "success");
        } else {
            showToast("No encontramos un registro previo. Por favor, completa tus datos.", "info");
        }
    } catch (e) {
        console.error("Search failed:", e);
        showToast("Error al buscar el cliente.", "error");
    }
};

/**
 * Confirms an order or registration.
 * Handles both standalone registration and quotation-linked registration.
 */
window.confirmOrder = async function (formIds, options = {}) {
    const { fullName, doc, cellphone, email, city, address, formContainerId } = formIds;
    const { shouldRedirect = true } = options;

    const data = JSON.parse(sessionStorage.getItem('currentQuotation')) || {
        id: Date.now(),
        date: new Date().toLocaleDateString('es-CO'),
        status: 'Nuevo Registro',
        items: [],
        grandTotal: 0
    };

    // Get Form Data
    const valFullName = document.getElementById(fullName)?.value.trim();
    const valDoc = document.getElementById(doc)?.value.trim();
    const valCellphone = document.getElementById(cellphone)?.value.trim();
    const valEmail = document.getElementById(email)?.value.trim();
    const valCity = document.getElementById(city)?.value.trim();
    const valAddress = document.getElementById(address)?.value.trim();

    // Validate
    if (!valFullName || !valDoc || !valCellphone || !valCity) {
        showToast('Por favor complete Nombre, Documento/NIT, Celular y Ciudad.', 'error');
        const container = document.getElementById(formContainerId);
        if (container) container.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    const safeAddress = valAddress || 'Ibagué, Tolima';
    const safeEmail = valEmail || `${valDoc}@spesfidem.com`;

    // Update Data
    data.fullName = valFullName;
    data.idCard = valDoc;
    data.cellphone = valCellphone;
    data.email = safeEmail;
    data.city = valCity;
    data.address = safeAddress;
    data.status = (data.items && data.items.length > 0) ? 'Cotización Confirmada' : 'Cliente Registrado';

    try {
        if (typeof db !== 'undefined' && db.save) {
            await db.save(data);
        } else if (window.db && window.db.save) {
            await window.db.save(data);
        }

        // ── CRM INTEGRATION ──
        if (window.CrmClients && window.CrmQuotations) {
            console.log("[Spesfidem CRM] Sincronizando registro...");
            const client = await window.CrmClients.save({
                id: valDoc, // Use document as ID for consistency
                fullName: valFullName,
                cellphone: valCellphone,
                email: valEmail,
                city: valCity,
                address: valAddress,
                clientType: 'Nuevo'
            });

            if (data.items && data.items.length > 0) {
                await window.CrmQuotations.save(client.id, {
                    items: data.items,
                    subtotal: data.subtotal || 0,
                    iva: data.iva || 0,
                    grandTotal: data.grandTotal || 0,
                    paymentPlan: data.paymentPlan || '75-25',
                    notes: data.notes || 'Cotización desde sitio web'
                });
            }
            console.log("[Spesfidem CRM] ✅ Sincronización exitosa");
        }

        localStorage.setItem('spesfidem_client_user', JSON.stringify({ fullName: valFullName, doc: valDoc, email: valEmail, loggedIn: true }));
        showToast('¡Registro exitoso! Datos guardados correctamente.', 'success');
        sessionStorage.removeItem('currentQuotation');

        // Redirect to photo_design or main page
        setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirect') || (shouldRedirect ? 'photo_design.html' : 'index.html');
            window.location.href = redirectUrl;
        }, 1500);

    } catch (e) {
        console.error("❌ Error al guardar en PostgreSQL:", e);
        showToast("Error de conexión con la base de datos PostgreSQL. No se pudieron guardar los datos.", "error");
    }
};

window.registerUser = async function (formIds) {
    const { fullName, email, password, confirmPassword, doc, cellphone, city } = formIds;

    const elFullName = document.getElementById(fullName);
    const elEmail = document.getElementById(email);
    const elPassword = document.getElementById(password);
    const elConfirmPassword = document.getElementById(confirmPassword);
    const elDoc = document.getElementById(doc);
    const elCellphone = document.getElementById(cellphone);
    const elCity = document.getElementById(city);

    const valFullName = elFullName?.value.trim() || '';
    const valEmail = elEmail?.value.trim() || '';
    const valPassword = elPassword?.value || '';
    const valConfirmPassword = elConfirmPassword?.value || '';
    const valDoc = elDoc?.value.trim() || '';
    const valCellphone = elCellphone?.value.trim() || '';
    const valCity = elCity?.value.trim() || '';

    // Clear previous error states
    document.querySelectorAll('.field-error').forEach(err => err.classList.remove('active'));
    document.querySelectorAll('.input-group input').forEach(input => {
        input.classList.remove('invalid-input');
        input.classList.remove('valid-input');
    });

    const setFieldError = (inputEl, errId) => {
        if (inputEl) inputEl.classList.add('invalid-input');
        const errSpan = document.getElementById(errId);
        if (errSpan) errSpan.classList.add('active');
        if (inputEl) inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // Validations:
    let hasError = false;

    // 1. Nombre solo letras
    if (!valFullName || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(valFullName)) {
        setFieldError(elFullName, 'err-regFull');
        hasError = true;
    }

    // 2. Número de cédula / documento (Persona Natural - solo números, 6 a 12 dígitos)
    if (!valDoc || !/^\d{6,12}$/.test(valDoc)) {
        setFieldError(elDoc, 'err-regId');
        if (!hasError) hasError = true;
    }

    // 3. Teléfono solo números, 10 números
    if (!valCellphone || !/^\d{10}$/.test(valCellphone)) {
        setFieldError(elCellphone, 'err-regCell');
        if (!hasError) hasError = true;
    }

    // 4. Correo validación
    if (!valEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valEmail)) {
        setFieldError(elEmail, 'err-regMail');
        if (!hasError) hasError = true;
    }

    // 5. Ciudad solo letras
    if (!valCity || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(valCity)) {
        setFieldError(elCity, 'err-regCit');
        if (!hasError) hasError = true;
    }

    // 6. Contraseña mínimo 6 caracteres, una mayúscula y un número mínimo
    if (!valPassword || valPassword.length < 6 || !/[A-Z]/.test(valPassword) || !/[0-9]/.test(valPassword)) {
        setFieldError(elPassword, 'err-regPassword');
        if (!hasError) hasError = true;
    }

    // 7. Confirmación de contraseña
    if (valPassword !== valConfirmPassword) {
        setFieldError(elConfirmPassword, 'err-regConfirmPassword');
        if (!hasError) hasError = true;
    }

    if (hasError) {
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_completo: valFullName,
                fullName: valFullName,
                numero_documento: valDoc,
                idCard: valDoc,
                celular: valCellphone,
                cellphone: valCellphone,
                email: valEmail,
                ciudad_municipio: valCity,
                city: valCity,
                password: valPassword
            })
        });

        const resData = await response.json();

        if (response.ok && (resData.success || resData.ok)) {
            if (typeof window.showRegistrationSuccessModal === 'function') {
                window.showRegistrationSuccessModal(valEmail);
            } else {
                window.location.href = `crm-login.html?registered=true&email=${encodeURIComponent(valEmail)}`;
            }
        } else {
            setFieldError(elEmail, 'err-regMail');
            const errSpan = document.getElementById('err-regMail');
            if (errSpan) errSpan.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${resData.mensaje || resData.message || 'Error al completar el registro.'}`;
        }
    } catch (err) {
        console.error("Error al registrar usuario en PostgreSQL:", err);
        setFieldError(elEmail, 'err-regMail');
        const errSpan = document.getElementById('err-regMail');
        if (errSpan) errSpan.innerHTML = `<i class="fas fa-exclamation-circle"></i> Error de comunicación con el servidor de base de datos PostgreSQL.`;
    }
};

function checkUserWelcomeBanner() {
    const banner = document.getElementById('userWelcomeBanner');
    const nameEl = document.getElementById('welcomeUserName');
    const regBtns = document.querySelectorAll('.nav-btn-register, #navRegisterBtn');
    const loginBtns = document.querySelectorAll('.nav-btn-login, #navLoginBtn');
    const logoutBtns = document.querySelectorAll('.nav-btn-logout, #navLogoutBtn');

    let currentUser = null;

    try {
        const crmData = JSON.parse(sessionStorage.getItem('spesfidem_crm_session') || '{}');
        if (crmData && crmData.name) {
            currentUser = crmData;
        }
    } catch (e) { }

    if (!currentUser) {
        try {
            const clientUser = JSON.parse(localStorage.getItem('spesfidem_client_user') || '{}');
            if (clientUser && clientUser.loggedIn && (clientUser.fullName || clientUser.name)) {
                currentUser = { name: clientUser.fullName || clientUser.name, email: clientUser.email, role: clientUser.role || 'user' };
            }
        } catch (e) { }
    }

    // Admin Containment Guard: If current user is Admin, they MUST remain inside the admin section
    if (currentUser && (currentUser.role === 'admin' || sessionStorage.getItem('isAdmin') === 'true')) {
        const path = window.location.pathname;
        if (path.includes('index.html') || path.endsWith('/') || path.endsWith('\\')) {
            window.location.replace('admin.html');
            return;
        }
    }

    if (currentUser && currentUser.name) {
        const fullRealName = currentUser.name.trim();
        if (nameEl) nameEl.textContent = fullRealName;
        if (banner) banner.style.display = 'flex';

        regBtns.forEach(btn => btn.style.setProperty('display', 'none', 'important'));
        loginBtns.forEach(btn => btn.style.setProperty('display', 'none', 'important'));
        logoutBtns.forEach(btn => btn.style.setProperty('display', 'inline-flex', 'important'));
    } else {
        if (banner) banner.style.display = 'none';

        regBtns.forEach(btn => btn.style.removeProperty('display'));
        loginBtns.forEach(btn => btn.style.removeProperty('display'));
        logoutBtns.forEach(btn => btn.style.setProperty('display', 'none', 'important'));
    }
}

function userLogout(e) {
    if (e && e.preventDefault) e.preventDefault();
    try {
        fetch('/api/logout', { method: 'POST' }).catch(() => { });
    } catch (e) { }
    try {
        sessionStorage.clear();
        localStorage.removeItem('spesfidem_client_user');
        localStorage.removeItem('spesfidem_crm_session');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminName');
    } catch (e) { }

    document.documentElement.classList.remove('is-admin');
    checkUserWelcomeBanner();

    showToast('Sesión cerrada correctamente.', 'info');
    setTimeout(() => {
        if (window.location.pathname.includes('admin.html') || window.location.pathname.includes('photo_design.html')) {
            window.location.replace('index.html');
        } else {
            window.location.reload();
        }
    }, 400);
}

window.handleDesignAccess = function (e, featureType = 'Foto Diseño', targetUrl = '') {
    let isAuthenticated = false;

    try {
        const crmData = JSON.parse(sessionStorage.getItem('spesfidem_crm_session') || '{}');
        const clientUser = JSON.parse(localStorage.getItem('spesfidem_client_user') || '{}');
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        if (isAdmin || (crmData && crmData.name) || (clientUser && clientUser.loggedIn)) {
            isAuthenticated = true;
        }
    } catch (err) { }

    if (isAuthenticated) {
        return true;
    } else {
        if (e && e.preventDefault) e.preventDefault();

        let redirectTarget = 'index.html';
        if (targetUrl) {
            redirectTarget = targetUrl;
        } else if (featureType.toLowerCase().includes('video')) {
            redirectTarget = 'videocall.html';
        } else if (featureType.toLowerCase().includes('whatsapp') || featureType.toLowerCase().includes('cotiza')) {
            redirectTarget = 'index.html#productos';
        } else {
            redirectTarget = 'photo_design.html';
        }

        injectAuthModalAndShow(featureType, redirectTarget);
        return false;
    }
};

function injectAuthModalAndShow(featureType, redirectTarget) {
    let modal = document.getElementById('designAuthModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'designAuthModal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 99999; display: none; justify-content: center; align-items: center; padding: 1.5rem;';
        modal.innerHTML = `
            <div style="background: #0f172a; border: 1.5px solid rgba(245, 158, 11, 0.5); border-radius: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(245, 158, 11, 0.2); max-width: 520px; width: 100%; padding: 2.5rem; text-align: center; position: relative;">
                <button type="button" onclick="closeDesignAuthModal()" style="position: absolute; top: 15px; right: 20px; background: none; border: none; color: #94a3b8; font-size: 1.8rem; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#94a3b8'">&times;</button>

                <div style="width: 70px; height: 70px; background: rgba(245, 158, 11, 0.15); border: 2px solid #f59e0b; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #f59e0b; font-size: 2rem;">
                    <i class="fas fa-lock"></i>
                </div>

                <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.8rem; font-weight: 800; color: #ffffff; margin-bottom: 1rem;">Registro o Inicio de Sesión Requerido</h3>

                <p id="designAuthModalDesc" style="color: #cbd5e1; font-size: 1.1rem; line-height: 1.6; margin-bottom: 2rem;">
                    Para acceder al servicio de <strong>${featureType}</strong> y realizar tus cotizaciones, debes <strong>registrarte primero</strong> o <strong>iniciar sesión</strong> si ya posees una cuenta registrada.
                </p>

                <div style="display: flex; flex-direction: column; gap: 0.9rem;">
                    <a id="modalRegBtn" href="register.html?redirect=${encodeURIComponent(redirectTarget)}" style="background: linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #b45309 100%); color: #0f172a; font-weight: 900; padding: 1rem 1.5rem; border-radius: 50px; text-decoration: none; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; gap: 0.6rem; box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);">
                        <i class="fas fa-user-plus"></i> <span>Registrarse gratis para cotizar</span>
                    </a>
                    <a id="modalLoginBtn" href="crm-login.html?redirect=${encodeURIComponent(redirectTarget)}" style="background: rgba(56, 189, 248, 0.15); border: 1.5px solid #38bdf8; color: #38bdf8; font-weight: 800; padding: 0.9rem 1.5rem; border-radius: 50px; text-decoration: none; font-size: 1.05rem; display: flex; align-items: center; justify-content: center; gap: 0.6rem; transition: background 0.3s;">
                        <i class="fas fa-sign-in-alt"></i> <span>Ya tengo una cuenta (Iniciar sesión)</span>
                    </a>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        const modalDesc = document.getElementById('designAuthModalDesc') || modal.querySelector('p');
        const regLink = document.getElementById('modalRegBtn') || modal.querySelector('a[href*="register.html"]');
        const loginLink = document.getElementById('modalLoginBtn') || modal.querySelector('a[href*="crm-login.html"]');

        if (modalDesc) {
            modalDesc.innerHTML = `Para acceder al servicio de <strong>${featureType}</strong> y realizar tus cotizaciones, debes <strong>registrarte primero</strong> o <strong>iniciar sesión</strong> si ya posees una cuenta registrada.`;
        }
        if (regLink) {
            regLink.href = `register.html?redirect=${encodeURIComponent(redirectTarget)}`;
        }
        if (loginLink) {
            loginLink.href = `crm-login.html?redirect=${encodeURIComponent(redirectTarget)}`;
        }
    }
    modal.style.display = 'flex';
}

window.closeDesignAuthModal = function () {
    const modal = document.getElementById('designAuthModal');
    if (modal) modal.style.display = 'none';
};

window.checkUserWelcomeBanner = checkUserWelcomeBanner;
window.userLogout = userLogout;

function openGallery(cat) {
    window.location.href = `gallery.html?category=${cat}`;
}

// --- Admin Auth & Utilities ---
async function adminLogin(e) {
    if (e) e.preventDefault();
    const userEl = document.getElementById('adminUser');
    const passEl = document.getElementById('adminPass');
    if (!userEl || !passEl) return;
    const user = userEl.value.trim();
    const pass = passEl.value.trim();
    const errorMsg = document.getElementById('loginError');
    const loginBtn = e && e.target ? e.target.querySelector('button[type="submit"]') : null;

    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
    }
    if (errorMsg) errorMsg.style.display = 'none';

    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero_documento: user, password: pass })
        });

        const data = await response.json();

        if (response.ok && data.ok) {
            const u = data.usuario;
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('adminName', u.nombre_completo);
            sessionStorage.setItem('spesfidem_crm_session', JSON.stringify({ uid: u.id_usuario, email: u.email, name: u.nombre_completo, role: u.rol, token: data.token }));
            document.documentElement.classList.add('is-admin');

            const overlay = document.getElementById('loginOverlay');
            const sidebar = document.querySelector('.sidebar');
            const main = document.querySelector('.main-content');
            if (overlay) overlay.style.removeProperty('display');
            if (sidebar) sidebar.style.removeProperty('display');
            if (main)    main.style.removeProperty('display');

            const nameDisplay = document.getElementById('adminNameDisplay');
            if (nameDisplay) nameDisplay.textContent = u.nombre_completo;

            showToast(`Bienvenido, ${u.nombre_completo}`, "success");
            if (typeof loadAdminData === 'function') loadAdminData();
        } else {
            if (errorMsg) {
                errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.mensaje || 'Documento o contraseña incorrectos.'}`;
                errorMsg.style.display = 'block';
            }
        }
    } catch (err) {
        console.error("❌ Error de conexión al autenticar con PostgreSQL:", err);
        if (errorMsg) {
            errorMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error de conexión con el servidor de base de datos.';
            errorMsg.style.display = 'block';
        }
    }

    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'INGRESAR AL SISTEMA';
    }
}

function logout(e) {
    if (e && e.preventDefault) e.preventDefault();

    // 1. Non-blocking server logout notification
    try {
        fetch('/api/logout', { method: 'POST' }).catch(() => {});
    } catch (err) {}

    // 2. Non-blocking Firebase signOut
    if (window.SpesFirebase && window.SpesFirebase.isFirebaseReady()) {
        try {
            const auth = window.SpesFirebase.getFirebaseAuth();
            import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js")
                .then(m => m.signOut(auth))
                .catch(() => {});
        } catch (err) {}
    }

    // 3. IMMEDIATELY & SYNCHRONOUSLY clear all storage
    try {
        sessionStorage.clear();
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminName');
        localStorage.removeItem('spesfidem_crm_session');
        localStorage.removeItem('spesfidem_client_user');
    } catch (err) {}

    // 4. Expire cookies
    try {
        document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "isAdmin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch (err) {}

    // 5. Remove inline display property overrides
    try {
        const overlay = document.getElementById('loginOverlay');
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('.main-content');
        if (overlay) overlay.style.removeProperty('display');
        if (sidebar) sidebar.style.removeProperty('display');
        if (main)    main.style.removeProperty('display');
    } catch (err) {}

    // 6. Instantly strip admin class and force redirect
    document.documentElement.classList.remove('is-admin');
    window.location.replace('index.html');
}

window.adminLogin = adminLogin;
window.logout = logout;
window.adminLogout = logout;





async function downloadCSV() {
    try {
        let clientsToExport = [];
        if (selectedClientIds.size > 0) {
            for (const id of selectedClientIds) {
                const client = await db.getById(id);
                if (client) clientsToExport.push(client);
            }
        } else {
            clientsToExport = await db.getAll();
        }

        if (clientsToExport.length === 0) {
            showToast("No hay datos para exportar.", "error");
            return;
        }

        // Header
        let csv = "Fecha,Nombre,Documento,Celular,Fijo,Ciudad,Direccion,Email,Productos,Subtotal,IVA (19%),Total,Plan Pago,Estado de Entrega,Estado de Pago\n";

        // Rows
        clientsToExport.forEach(c => {
            const prods = getProductString(c).replace(/,/g, " |");
            csv += `"${c.date || ''}","${c.fullName || ''}","${c.idCard || 'N/A'}","${c.cellphone || ''}","${c.landline || ''}","${c.city || ''}","${c.address || ''}","${c.email || ''}","${prods}","$${(c.subtotal || 0).toLocaleString()}","$${(c.iva || 0).toLocaleString()}","$${(c.grandTotal || 0).toLocaleString()}","${c.paymentPlan || '75-25'}","${c.deliveryStatus || 'Pendiente'}","${c.paymentStatus || 'Cancelado'}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Spesfidem_Clientes_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Export failed:", e);
    }
}

function printClients() {
    const table = document.querySelector('table');
    const printDate = document.getElementById('printDate');
    if (printDate) printDate.textContent = new Date().toLocaleDateString('es-CO') + ' ' + new Date().toLocaleTimeString('es-CO');
    if (!table) return;

    const selectionActive = selectedClientIds.size > 0;
    if (selectionActive) {
        table.classList.add('print-selection-active');
    }

    window.print();

    if (selectionActive) {
        table.classList.remove('print-selection-active');
    }
}

function toggleFAQ(el) {
    el.parentElement.classList.toggle('active');
}

// --- Initialization ---
function initAccessibility() {
    const launcher = document.getElementById('themeLauncher');
    const panel = document.getElementById('accessibilityPanel');

    if (!launcher || !panel) return;

    // Toggle Logic
    launcher.onclick = (e) => {
        e.stopPropagation();
        const isOpen = panel.style.display === 'flex';
        panel.style.display = isOpen ? 'none' : 'flex';
        launcher.setAttribute('aria-expanded', !isOpen);
    };

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !launcher.contains(e.target)) {
            panel.style.display = 'none';
            launcher.setAttribute('aria-expanded', 'false');
        }
    });
}

async function initApp() {
    // 1. DB Init & Migration
    try {
        await db.init();
        await migrateData();
    } catch (e) {
        console.error("App startup failed:", e);
    }

    // 2. Initialize Accessibility Events & User Welcome Banner
    initAccessibility();
    checkUserWelcomeBanner();

    // 3. Mobile Menu Logic
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const menu = document.querySelector('.big-menu');
    if (mobileBtn && menu) {
        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('active');
            const icon = mobileBtn.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
        // Close menu on link click
        menu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.remove('active');
                const icon = mobileBtn.querySelector('i');
                if (icon) {
                    icon.classList.add('fa-bars');
                    icon.classList.remove('fa-times');
                }
            });
        });
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!menu && !mobileBtn) return;
            if (menu.contains(e.target) || mobileBtn.contains(e.target)) return;

            menu.classList.remove('active');
            const icon = mobileBtn.querySelector('i');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        });
    }
    // 4. Smooth Scrolling for Anchor Links (#disena, #productos, #perfil, #contacto, etc)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId && targetId !== '#') {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // 5. Material Filtering Event
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('product-slot')) {
            const card = e.target.closest('.product-slot-card') || e.target.closest('.product-slot-card-edit');
            if (card) {
                // Implement logic if needed, or call specific handler
                // Assuming logic acts on change events bubbling up
            }
        }
    });

    // 5. Admin Page specifics
    if (window.location.pathname.includes('admin.html')) {
        let isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        if (!isAdmin) {
            try {
                const crm = JSON.parse(sessionStorage.getItem('spesfidem_crm_session') || '{}');
                if (crm && crm.role === 'admin') isAdmin = true;
            } catch(e){}
        }

        if (isAdmin) {
            sessionStorage.setItem('isAdmin', 'true');
            document.documentElement.classList.add('is-admin');
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.style.setProperty('display', 'none', 'important');

            const adminName = sessionStorage.getItem('adminName') || 'Administrador';
            const nameDisplay = document.getElementById('adminNameDisplay');
            if (nameDisplay) nameDisplay.textContent = adminName;

            loadAdminData();
            loadRegisteredUsersTable();
        } else {
            loadRegisteredUsersTable();
        }
    }

    // Check for Gallery Page specifics
    if (window.location.pathname.includes('gallery.html')) {
        initGalleryPage();
    }
}

// Ensure functions are globally reachable
window.emptyTrash = emptyTrash;
window.hardDeleteClient = hardDeleteClient;
window.toggleTrashMode = toggleTrashMode;
window.restoreClient = restoreClient;
window.deleteClient = deleteClient;
window.loadAdminData = loadAdminData;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
