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

        this.apiUrl = `${base}/api/clients`;
        this.loginUrl = `${base}/api/login`;
        this._retried = false;
        console.log(`ClientDB: Connection Layer - Using Base: ${base} (Target: ${this.apiUrl})`);
    }

    // Initialization is simple health check or no-op
    async init() {
        console.log("Connected to Spesfidem Persistent Server (Hybrid Mode)");
    }

    async save(client) {
        let savedToServer = false;
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(client)
            });
            if (response.ok) {
                savedToServer = true;
                console.log("Saver: Saved to Server Successfully.");
            } else {
                throw new Error('Server returned ' + response.status);
            }
        } catch (e) {
            console.warn("Saver: Server failed, saving to LocalStorage...", e);
        }

        // ALWAYS save to local as backup/hybrid cache
        this.saveToLocal(client);
        console.log("Saver: Saved to LocalStorage (Hybrid Sync).");
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
        let serverData = [];
        let localData = [];

        // 1. Try Server
        try {
            console.log("Fetcher: Attempting Server Connection...");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout
            const response = await fetch(`${this.apiUrl}?t=${Date.now()}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (response.ok) {
                serverData = await response.json();
                console.log(`Fetcher: Server returned ${serverData.length} records.`);
            } else {
                console.warn(`Fetcher: Server Error ${response.status}`);
            }
        } catch (e) {
            console.warn("Fetcher: Server unreachable (Offline/Timeout). Using Local.", e);
        }

        // 2. Get Local
        try {
            localData = this.getFromLocal();
            console.log(`Fetcher: LocalStorage returned ${localData.length} records.`);
        } catch (e) {
            console.error("Fetcher: LocalStorage Error", e);
            localData = [];
        }

        // 3. MERGE & DEDUPLICATE
        try {
            const clientMap = new Map();

            // Load Local first
            if (Array.isArray(localData)) {
                localData.forEach(c => {
                    if (c && c.id) clientMap.set(String(c.id), c);
                });
            }

            // Overlay Server
            if (Array.isArray(serverData)) {
                serverData.forEach(c => {
                    if (c && c.id) clientMap.set(String(c.id), c);
                });
            }

            const result = Array.from(clientMap.values());
            console.log(`Fetcher: Merge Complete. Total Unique Records: ${result.length}`);
            return result;
        } catch (e) {
            console.error("Fetcher: Merge Logic Failed!", e);
            // Emergency fallback: return whatever we have
            return [...serverData, ...localData];
        }
    }

    // --- LocalStorage Fallback Methods ---
    saveToLocal(client) {
        const clients = this.getFromLocal();
        const index = clients.findIndex(c => String(c.id) === String(client.id));
        if (index >= 0) {
            clients[index] = { ...clients[index], ...client };
        } else {
            clients.push(client);
        }
        localStorage.setItem(DB_KEY, JSON.stringify(clients));
    }

    deleteFromLocal(id) {
        const clients = this.getFromLocal();
        const index = clients.findIndex(c => String(c.id) === String(id));
        if (index >= 0) {
            clients[index].deleted = true;
            localStorage.setItem(DB_KEY, JSON.stringify(clients));
        }
    }

    getFromLocal() {
        try {
            // 1. Primary Key
            let data = localStorage.getItem(DB_KEY);
            if (data) return JSON.parse(data);

            // 2. RECOVERY: Search for any other likely keys if primary is empty
            const legacyKeys = ['clients', 'spesfidem_clients', 'registros', 'db_spesfidem', 'spesfidem_db'];
            for (const key of legacyKeys) {
                const oldData = localStorage.getItem(key);
                if (oldData) {
                    try {
                        const parsed = JSON.parse(oldData);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            console.log(`RECOVERY: Found ${parsed.length} records in legacy key '${key}'`);
                            // Migrar a la llave principal para el futuro
                            localStorage.setItem(DB_KEY, oldData);
                            return parsed;
                        }
                    } catch (e) { }
                }
            }

            return [];
        } catch (e) {
            console.error("getFromLocal failed:", e);
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
    try {
        const legacyData = localStorage.getItem(DB_KEY);
        if (legacyData) {
            const clients = JSON.parse(legacyData);
            if (Array.isArray(clients) && clients.length > 0) {
                console.log(`Syncing ${clients.length} local records with server...`);
                let successCount = 0;
                for (const client of clients) {
                    try {
                        // Check server for this specific client first to avoid redundant POSTs if desired
                        // or just rely on the server's upsert logic.
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
                // We DON'T removeItem(DB_KEY) here anymore to preserve the Hybrid Cache/Backup
                // This prevents data loss if the server is unreachable.
            }
        }
    } catch (e) {
        console.error("Sync failed:", e);
    }
}

// [REMOVED DUPLICATE DOMContentLoaded LISTENER]
// Mobile menu and other init logic moved to initApp()
window.toggleMobileMenu = toggleMobileMenu;

// Duplicate migrateData removed
// 5. Gallery Init (if on gallery.html)
if (window.location.pathname.includes('gallery.html')) {
    initGalleryPage();
}

// 6. Simulator Slots Init (if on simulator.html)
const slotsContainer = document.getElementById('slotsContainer');
if (slotsContainer && window.location.pathname.includes('simulator.html')) {
    initSimulatorSlots(slotsContainer);
}

function initSimulatorSlots(container) {
    const prodOptions = `
        <option value="" selected disabled>Seleccione Producto...</option>
        <optgroup label="Sistemas de Ventanas">
            <option value="Ventana Corrediza">Ventana Corrediza</option>
            <option value="Ventana Proyectante">Ventana Proyectante</option>
            <option value="Ventana Fija">Ventana Fija</option>
        </optgroup>
        <optgroup label="Sistemas de Puertas">
            <option value="Puerta Principal">Puerta Principal</option>
            <option value="Puerta de Patio">Puerta de Patio</option>
            <option value="Puerta de Baño">Puerta de Baño</option>
        </optgroup>
        <optgroup label="Especialidades">
            <option value="División de Baño (Vidrio Templado)">División de Baño (Vidrio Templado)</option>
            <option value="División de Baño (Acrílico)">División de Baño (Acrílico)</option>
            <option value="Vidrio Templado">Vidrio Templado</option>
            <option value="Espejos">Espejos</option>
        </optgroup>
    `;

    // Add 2 more slots (1st is static in HTML, or cleared here)
    for (let i = 2; i <= 3; i++) {
        const div = document.createElement('div');
        div.className = 'product-slot-card';
        div.style.background = 'rgba(255,255,255,0.03)';
        div.style.padding = '1.2rem';
        div.style.borderRadius = '1.2rem';
        div.style.border = '1px solid rgba(255,255,255,0.05)';
        div.innerHTML = `
            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1rem; margin-bottom: 0.8rem;">
                <select class="form-control product-slot" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);">
                    <option value="">Añadir Producto ${i}...</option>
                    ${prodOptions}
                </select>
                <input type="number" class="form-control quantity-slot" min="1" value="1" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);">
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.8rem;">
                <select class="form-control color-slot" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);">
                    <option value="Natural">Natural</option>
                    <option value="Negro">Negro</option>
                    <option value="Madera">Madera</option>
                    <option value="Blanco">Blanco</option>
                    <option value="Champagne">Champagne</option>
                </select>
                <div style="display: flex; gap: 0.5rem;">
                    <input type="number" class="form-control width-slot" placeholder="Ancho (m)" step="0.01" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); width: 50%;">
                    <input type="number" class="form-control height-slot" placeholder="Alto (m)" step="0.01" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); width: 50%;">
                </div>
                <select class="form-control glass-slot" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);">
                    <option value="">Vidrio...</option>
                    <optgroup label="Monolítico (Crudo)">
                        <option value="Claro (4mm)">Claro (4mm)</option>
                        <option value="Claro (5mm)">Claro (5mm)</option>
                        <option value="Bronce">Bronce</option>
                        <option value="Gris (Humo)">Gris (Humo)</option>
                        <option value="Azul">Azul</option>
                        <option value="Verde">Verde</option>
                    </optgroup>
                    <optgroup label="Reflectivo / Especial">
                        <option value="Bronce Reflectivo">Bronce Reflectivo</option>
                        <option value="Azul Reflectivo">Azul Reflectivo</option>
                        <option value="Esmeralizado (Sandblasted)">Esmeralizado</option>
                    </optgroup>
                    <optgroup label="Templado">
                        <option value="Templado 6mm Incoloro">6mm Incoloro</option>
                        <option value="Templado 8mm Incoloro">8mm Incoloro</option>
                        <option value="Templado 10mm Incoloro">10mm Incoloro</option>
                    </optgroup>
                </select>
            </div>
        `;
        container.appendChild(div);
    }
}

// --- Client Registration & Quotation Logic ---
async function saveClient(event) {
    event.preventDefault();
    const clientData = collectFormData(false); // Registration mode
    if (!clientData) return;

    try {
        await db.save(clientData);
        showToast("¡Registro Exitoso! Redirigiendo a pagos...", "success");
        event.target.reset();
        setTimeout(() => window.location.replace("checkout.html"), 1500);
    } catch (e) {
        console.error("Save failed:", e);
        showToast("Error al guardar registro.", "error");
    }
}

function prepareQuotation(event) {
    if (event) event.preventDefault();

    // Simulation only requires products, no form validation
    const clientData = collectFormData(true); // Simulation mode
    if (!clientData) return;

    // AUTO-SAVE as "Lead/Simulation" before moving to register
    // This addresses the user's request for data to be saved upon "Agregar"
    clientData.status = 'Pendiente (Simulación)';
    db.save(clientData).catch(err => console.error("Auto-save simulation failed:", err));

    // Store in sessionStorage for the quotation page
    sessionStorage.setItem('currentQuotation', JSON.stringify(clientData));
    window.location.href = 'quotation.html';
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
    tableBody.innerHTML = '<tr><td colspan="17" style="text-align:center; padding:2rem; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Cargando datos...</td></tr>';

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

        const { items, total } = await db.getPaged(currentPage, pageSize, query, isTrashMode);

        // Debug/Feedback
        showToast(`Datos cargados: ${total} registros`, "info");

        const countHeader = document.getElementById('clientCountHeader');
        if (countHeader) countHeader.textContent = total;

        updateTrashCounter();
        updatePaginationUI(Math.ceil(total / pageSize));

        tableBody.innerHTML = '';
        if (items.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="17" style="text-align:center; padding:2rem;">No se encontraron resultados en la base de datos (Local/Server).</td></tr>';
            return;
        }

        items.forEach(client => {
            const isChecked = selectedClientIds.has(client.id);
            const row = document.createElement('tr');
            if (isChecked) row.classList.add('is-selected');
            if (client.deleted) row.style.background = '#fff1f2'; // Light red bg for deleted

            // Action Buttons Logic
            let actionBtns = '';
            if (isTrashMode) {
                // Restore Button and Permanent Delete
                actionBtns = `
                    <button onclick="console.log('Restore clicked'); window.restoreClient('${client.id}')" class="btn-restore" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:4px;" title="Restaurar Cliente">
                        <i class="fas fa-trash-restore"></i> <span>Restaurar</span>
                    </button>
                    <button onclick="console.log('Delete permanent clicked'); window.hardDeleteClient('${client.id}')" class="btn-delete" style="background:#64748b; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:4px;" title="Eliminar Permanentemente">
                        <i class="fas fa-trash-slash"></i> <span>Eliminar</span>
                    </button>
                `;
            } else {
                // Edit / Delete
                actionBtns = `
                    <button onclick="openEditModal('${client.id}')" class="btn-edit" style="background:#f59e0b; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right:5px; font-weight:600; display:flex; align-items:center; gap:4px;" title="Editar">
                        <i class="fas fa-edit"></i> <span>Editar</span>
                    </button>
                    <button onclick="deleteClient('${client.id}')" class="btn-delete" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:4px;" title="Borrar">
                        <i class="fas fa-trash-alt"></i> <span>Borrar</span>
                    </button>
                `;
            }

            row.innerHTML = `
                <td style="text-align:center;">
                    <input type="checkbox" class="client-checkbox" value="${client.id}" 
                        ${isChecked ? 'checked' : ''} 
                        onclick="toggleSelectClient(${client.id}, this)" 
                        style="cursor:pointer; width: 16px; height: 16px;">
                </td>
                <td>${client.date}</td>
                <td style="font-weight:bold; color:var(--accent);">COT-${String(client.serial || 0).padStart(7, '0')}</td>
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
                <td><div style="color:#64748b; font-size:0.9rem;">$${(client.subtotal || 0).toLocaleString()}</div></td>
                <td><div style="color:#64748b; font-size:0.9rem;">$${(client.iva || 0).toLocaleString()}</div></td>
                <td>
                    <div style="font-weight:700; color:#059669; font-size:1rem;">$${(client.grandTotal || 0).toLocaleString()}</div>
                    ${client.paymentPlan === '75-25' ?
                    `<div style="font-size:0.7rem; color:#3b82f6; margin-top:2px;">
                            75%: $${Math.round((client.grandTotal || 0) * 0.75).toLocaleString()}
                         </div>`
                    : ''}
                </td>
                <td>
                    ${client.paymentPlan === '100' ?
                    '<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.8rem;">100% Total</span>' :
                    '<span style="background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:4px; font-weight:600; font-size:0.8rem;">75% / 25%</span>'}
                </td>
                <td><span class="status-badge status-${(client.deliveryStatus || 'Pendiente').toLowerCase()}">${client.deliveryStatus || 'Pendiente'}</span></td>
                <td><span class="status-badge status-${(client.paymentStatus || 'Cancelado').toLowerCase()}">${client.paymentStatus || 'Cancelado'}</span></td>
                <td style="display:flex; gap:0.5rem; justify-content: center; align-items: center; background: white; position: sticky; right: 0; z-index: 5; box-shadow: -2px 0 5px rgba(0,0,0,0.05); min-width: 200px; padding: 10px;">
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
    if (!confirm("¿ESTÁ SEGURO? Esta acción ELIMINARÁ PERMANENTEMENTE todos los registros de la papelera y no se puede deshacer.")) return;

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
    if (!confirm("¿Restaurar este cliente a la lista activa?")) return;
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
    if (!confirm("¿ELIMINAR PERMANENTEMENTE? Esta acción no se puede deshacer.")) return;
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
    if (!confirm("¿Mover este cliente a la papelera?")) return;
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

function showToast(msg, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? '' : 'error'}`;
    toast.innerHTML = `<div class="toast-message">${msg}</div>`;
    container.appendChild(toast);
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
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
    document.getElementById('editDeliveryStatus').value = client.deliveryStatus || 'Pendiente';
    document.getElementById('editPaymentStatus').value = client.paymentStatus || 'Cancelado';
    document.getElementById('editPaymentPlan').value = client.paymentPlan || '75-25';

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
    client.deliveryStatus = document.getElementById('editDeliveryStatus').value;
    client.paymentStatus = document.getElementById('editPaymentStatus').value;
    client.paymentPlan = document.getElementById('editPaymentPlan').value;

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
    if (!valFullName || !valDoc || !valCellphone || !valCity || !valAddress) {
        showToast('Por favor complete todos los campos obligatorios.', 'error');
        const container = document.getElementById(formContainerId);
        if (container) container.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    // Update Data
    data.fullName = valFullName;
    data.idCard = valDoc;
    data.cellphone = valCellphone;
    data.email = valEmail;
    data.city = valCity;
    data.address = valAddress;
    data.status = data.items.length > 0 ? 'Cotización Confirmada' : 'Cliente Registrado';

    try {
        if (typeof db !== 'undefined') {
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

        showToast('¡Registro exitoso! Datos guardados correctamente.', 'success');
        sessionStorage.removeItem('currentQuotation');

        // Redirect to checkout or success page
        setTimeout(() => {
            if (shouldRedirect) {
                window.location.href = 'checkout.html';
            } else {
                window.location.href = 'index.html';
            }
        }, 1500);

    } catch (e) {
        console.error("Save Failed:", e);
        // Emergency Manual Save (Direct to LocalStorage)
        try {
            const DB_KEY = 'spesfidem_clients';
            const stored = localStorage.getItem(DB_KEY);
            const clients = stored ? JSON.parse(stored) : [];
            const idx = clients.findIndex(c => String(c.id) === String(data.id));
            if (idx >= 0) clients[idx] = data;
            else clients.push(data);
            localStorage.setItem(DB_KEY, JSON.stringify(clients));

            showToast('¡Registro exitoso! (Guardado local)', 'success');
            sessionStorage.removeItem('currentQuotation');
            setTimeout(() => {
                if (shouldRedirect) {
                    window.location.href = 'checkout.html';
                } else {
                    window.location.href = 'index.html';
                }
            }, 1500);
        } catch (localErr) {
            showToast("Error crítico al guardar. Tome captura de pantalla.", "error");
        }
    }
};

function openGallery(cat) {
    window.location.href = `gallery.html?category=${cat}`;
}

// --- Admin Auth & Utilities ---

function logout() {
    if (confirm("¿Seguro que desea cerrar sesión?")) {
        sessionStorage.removeItem("isAdmin");
        document.documentElement.classList.remove('is-admin');
        window.location.reload();
    }
}

/* --- PQR LOGIC --- */
function updateCharCount(textarea) {
    const count = textarea.value.length;
    const counterDisplay = document.getElementById('charCount');
    counterDisplay.textContent = `${count} / 500`;

    if (count >= 500) {
        counterDisplay.style.color = '#ef4444'; // Red warning
    } else {
        counterDisplay.style.color = '#64748b';
    }
}

function updateFileName(input) {
    const display = document.getElementById('fileNameDisplay');
    if (input.files && input.files.length > 0) {
        display.textContent = input.files[0].name;
        display.style.color = '#facc15';
    } else {
        display.textContent = 'Seleccionar Archivo (Img, PDF)';
        display.style.color = '#cbd5e1';
    }
}

function handlePQRSubmit(e) {
    e.preventDefault();

    // Get form values
    const form = e.target;
    const type = form.userType.value;
    const name = form.pqrName.value;
    const city = form.pqrCity.value;
    const phone = form.pqrPhone.value;
    const email = form.pqrEmail.value;
    const message = form.pqrMessage.value;

    // Construct Email Body
    const subject = `PQR: ${type} - ${name}`;
    const body = `
Hola Spesfidem Aluminio,

Envío la siguiente solicitud desde el formulario web:

--- DATOS DEL USUARIO ---
Tipo: ${type}
Nombre: ${name}
Ciudad: ${city}
Celular: ${phone}
Correo: ${email}

--- MENSAJE ---
${message}
    `.trim();

    // Check file for alert (still needed as browser restriction warning)
    const fileInput = document.getElementById('pqrFile');
    if (fileInput.files.length > 0) {
        alert("NOTA IMPORTANTE:\n\nPor seguridad del navegador, el archivo seleccionado NO se puede adjuntar automáticamente.\n\nPor favor, ARRASTRE O ADJUNTE SU ARCHIVO manualmente en el correo que se abrirá a continuación.");
    }

    // UX Feedback - IMMEDIATE ACTION
    const btn = form.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fas fa-check"></i> PROCESANDO...';
    btn.disabled = true;

    // Open Mail Client IMMEDIATELY
    window.location.href = `mailto:spesfidemaluminio@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Show Success Modal (simulating "Received" feedback)
    const modal = document.getElementById('pqrSuccessModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        // Fallback if modal not present (e.g. old page cache)
        alert("¡Gracias! Su solicitud ha sido procesada. Por favor confirme el envío en su correo.");
        window.location.href = 'index.html';
    }
}

function closePQRModal() {
    window.location.href = 'index.html';
}
async function adminLogin(e) {
    e.preventDefault();
    const user = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value.trim();
    const errorMsg = document.getElementById('loginError');
    const loginBtn = e.target.querySelector('button[type="submit"]');

    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    }
    if (errorMsg) errorMsg.style.display = 'none';

    // ============================================================
    // PORTABLE CREDENTIALS (work on any device, without server)
    // To add/change users, update this object here AND in server.py
    // ============================================================
    const ADMIN_USERS = {
        '14298116':   { pass: '14298116Je*', name: 'Jhon Espinosa' },
        '1106227253': { pass: '7253pipe',    name: 'Felipe Molina' },
        '1005703432': { pass: '3432sergio',  name: 'Sergio Suarez' },
        '1104942399': { pass: '2399caleb',   name: 'Caleb Perez' }
    };

    const userData = ADMIN_USERS[user];

    if (userData && userData.pass === pass) {
        // ✅ AUTHENTICATION SUCCESS (Client-side — works anywhere)
        sessionStorage.setItem('isAdmin', 'true');
        sessionStorage.setItem('adminName', userData.name);
        document.documentElement.classList.add('is-admin');

        // Hide login overlay
        const overlay = document.getElementById('loginOverlay');
        if (overlay) overlay.style.setProperty('display', 'none', 'important');

        // Show admin content
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('.main-content');
        if (sidebar) sidebar.style.setProperty('display', 'block', 'important');
        if (main)    main.style.setProperty('display', 'block', 'important');

        showToast(`Bienvenido, ${userData.name}`, "success");
        loadAdminData();

        // Optionally sync with server in the background (non-blocking)
        db.adminLogin(user, pass).catch(() => {
            console.info("Server sync skipped (offline mode). Data from LocalStorage will be used.");
        });

    } else {
        // ❌ AUTHENTICATION FAILED
        if (errorMsg) {
            errorMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> Documento o contraseña incorrectos.';
            errorMsg.style.display = 'block';
        }
    }

    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'INGRESAR AL SISTEMA';
    }
}





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
        let csv = "Fecha,Cotizacion,Nombre,Documento,Celular,Fijo,Ciudad,Direccion,Email,Productos,Subtotal,IVA (19%),Total,Plan Pago,Estado de Entrega,Estado de Pago\n";

        // Rows
        clientsToExport.forEach(c => {
            const prods = getProductString(c).replace(/,/g, " |");
            const cot = `COT-${String(c.serial || 0).padStart(7, '0')}`;
            csv += `"${c.date || ''}","${cot}","${c.fullName || ''}","${c.idCard || 'N/A'}","${c.cellphone || ''}","${c.landline || ''}","${c.city || ''}","${c.address || ''}","${c.email || ''}","${prods}","$${(c.subtotal || 0).toLocaleString()}","$${(c.iva || 0).toLocaleString()}","$${(c.grandTotal || 0).toLocaleString()}","${c.paymentPlan || '75-25'}","${c.deliveryStatus || 'Pendiente'}","${c.paymentStatus || 'Cancelado'}"\n`;
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

    // 2. Initialize Accessibility Events
    initAccessibility();

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

    // 4. Material Filtering Event
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
        // Only load data if already logged in
        if (sessionStorage.getItem('isAdmin') === 'true') {
            document.documentElement.classList.add('is-admin');
            loadAdminData();
        }
        // Note: Overlay visibility is now handled purely by CSS based on is-admin class
        // No need to manually manipulate overlay.style.display here
    }

    // Check for Gallery Page specifics
    if (window.location.pathname.includes('gallery.html')) {
        initGalleryPage();
    }
}

// Ensure trash functions are globally reachable for onclicks
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
