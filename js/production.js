// Intense ERP Production Logic with History, Tiras Conversion, and Advanced Architectural Profiles

const INVENTORY_KEY = 'spesfidem_carpentry_inventory';

// Advanced Inventory Structure mapped by exact names
const DEFAULT_INVENTORY = {
    glass: {
        // Scraps/Retazos in m2
        scraps: {
            'Claro 3mm': 10,
            'Claro 4mm': 10,
            'Claro 5mm': 10,
            'Bronce 4mm': 5,
            'Bronce Reflectivo 4mm': 5,
            'Espejo 3mm': 5,
            'Espejo 4mm': 5
        },
        // Complete sheets (Láminas)
        sheets: {
            'Claro 3mm': 5,
            'Claro 4mm': 5,
            'Claro 5mm': 5,
            'Bronce 4mm': 3,
            'Bronce Reflectivo 4mm': 3,
            'Espejo 3mm': 3,
            'Espejo 4mm': 2
        }
    },
    // 1 Tira = 6 Metros. We store the absolute value in Metros. 
    // Format: ProfileName: { Color: Meters }
    alum: {
        '8025': { 'Natural': 60, 'Negro': 0, 'Blanco': 0, 'Madera': 0, 'Champagne': 0 },  // 10 tiras = 60m
        '744': { 'Natural': 60, 'Negro': 0, 'Blanco': 0, 'Madera': 0, 'Champagne': 0 },
        '5020': { 'Natural': 60, 'Negro': 0, 'Blanco': 0, 'Madera': 0, 'Champagne': 0 },
        'U_Asentador': { 'Natural': 30, 'Negro': 30, 'Blanco': 30, 'Madera': 30, 'Champagne': 30 }
    }
};

// Glass Pricing and Dimensions Matrix
const GLASS_CONFIG = {
    'Claro 3mm': { width: 1.83, height: 2.44, sheetPrice: 125000, m2Price: 26000 },
    'Claro 4mm': { width: 3.30, height: 2.20, sheetPrice: 210000, m2Price: 30000 },
    'Claro 5mm': { width: 3.30, height: 2.20, sheetPrice: 260000, m2Price: 40000 },
    'Bronce 4mm': { width: 3.30, height: 2.14, sheetPrice: 230000, m2Price: 38000 },
    'Bronce Reflectivo 4mm': { width: 3.30, height: 2.14, sheetPrice: 240000, m2Price: 40000 },
    'Espejo 3mm': { width: 1.83, height: 2.44, sheetPrice: 165000, m2Price: 40000 },
    'Espejo 4mm': { width: 3.30, height: 2.14, sheetPrice: 450000, m2Price: 75000 }
};

let invState = JSON.parse(JSON.stringify(DEFAULT_INVENTORY));

// Dictionary of Architectural Requirements (Carpentry Engine)
// How many meters of EACH specific profile type does a product consume?
const CARPENTRY_PROFILES = {
    'Ventana Corrediza': { '8025': 2.5, '744': 2.5, 'U_Asentador': 1 }, 
    'Ventana Proyectante': { '5020': 4.0 },
    'Ventana Casement': { '5020': 5.0 },
    'Ventana Fija': { '8025': 3.0 }, // Marco basico
    'Puerta Principal': { '5020': 7.0, 'U_Asentador': 2 },
    'Puerta de Patio': { '8025': 3.0, '744': 4.0 }, 
    'Puerta Plegable': { '5020': 10.0 }, // Heavy system
    'Puerta de Baño': { '744': 4.5 },
    'División de Baño (Vidrio Templado)': { 'U_Asentador': 3.0 },
    'División de Baño': { 'U_Asentador': 3.0 },
    'División de Baño (Acrílico)': { '744': 2.0, 'U_Asentador': 2.0 }, 
    'Vidrio Templado': {}, // No aluminum
    'Espejos': {},
    'Fachada Flotante': { '5020': 15.0 },
    'Pasamanos / Otros': { '8025': 2.0 }
};

// Base glass requirement per item
const CARPENTRY_GLASS = {
    'Ventana Corrediza': 2.0,
    'Ventana Proyectante': 1.5,
    'Ventana Casement': 2.0,
    'Ventana Fija': 2.0,
    'Puerta Principal': 2.0,
    'Puerta de Patio': 3.0,
    'Puerta Plegable': 4.0,
    'Puerta de Baño': 1.0,
    'División de Baño (Vidrio Templado)': 3.0,
    'División de Baño': 3.0,
    'División de Baño (Acrílico)': 0, // Uses acrylic
    'Vidrio Templado': 1.0,
    'Espejos': 1.0,
    'Fachada Flotante': 6.0,
    'Pasamanos / Otros': 1.0
};

// Time per unit mapping (in hours)
const MANUFACTURE_TIMES = {
    'Ventana Corrediza': 3,
    'Ventana Proyectante': 4,
    'Ventana Casement': 4,
    'Ventana Fija': 2,
    'Puerta Principal': 6,
    'Puerta de Patio': 5,
    'Puerta Plegable': 7,
    'Puerta de Baño': 3,
    'División de Baño (Vidrio Templado)': 4,
    'División de Baño (Acrílico)': 3,
    'División de Baño': 4, 
    'Vidrio Templado': 1,
    'Espejos': 1,
    'Fachada Flotante': 12,
    'Pasamanos / Otros': 3
};

let isHistoryMode = false;

document.addEventListener('DOMContentLoaded', () => {
    loadVirtualInventory();
    setTimeout(loadProductionData, 300); // Trigger sequence
});

/* INVENTORY MANAGEMENT */
function loadVirtualInventory() {
    const saved = localStorage.getItem(INVENTORY_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(invState.glass, parsed.glass || {});
            
            // Deep merge for structured aluminum profiles
            if (parsed.alum) {
                for (let ref in parsed.alum) {
                    if (!invState.alum[ref]) invState.alum[ref] = {};
                    Object.assign(invState.alum[ref], parsed.alum[ref]);
                }
            }
        } catch(e) {}
    }
}

function openInventoryModal() {
    renderInventoryFields();
    document.getElementById('invModal').style.display = 'flex';
}

function switchInvTab(tabName, btnElement) {
    document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.inv-panel').forEach(p => p.classList.remove('active'));
    
    btnElement.classList.add('active');
    document.getElementById('panel-' + tabName).classList.add('active');
}

function renderInventoryFields() {
    const pGlass = document.getElementById('panel-vidrios');
    const pAlum = document.getElementById('alum-body');

    // Render glass using Sheets + Scraps Logic
    pGlass.innerHTML = `
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; padding: 10px; background: #f1f5f9; font-weight: bold; font-size: 0.8rem; border-radius: 4px; margin-bottom: 10px;">
            <div>Referencia de Vidrio</div>
            <div>Láminas Integ.</div>
            <div>Retazo (m²)</div>
        </div>
    `;
    
    for (let key in GLASS_CONFIG) {
        const sheetQty = invState.glass.sheets[key] || 0;
        const scrapQty = invState.glass.scraps[key] || 0;
        
        pGlass.innerHTML += `
            <div class="inv-row" style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; align-items: center; border-bottom: 1px solid #f1f5f9;">
                <label style="font-size: 0.8rem;">${key}</label>
                <input type="number" step="1" min="0" class="inv-glass-sheets-input" data-key="${key}" value="${sheetQty}" style="width: 100%;">
                <input type="number" step="0.1" min="0" class="inv-glass-scraps-input" data-key="${key}" value="${scrapQty}" style="width: 100%;">
            </div>
        `;
    }

    // Render structured aluminum using Tiras Logic
    pAlum.innerHTML = '';
    for(let profile in invState.alum) {
        for(let color in invState.alum[profile]) {
            const meters = invState.alum[profile][color] || 0;
            const tiras = Math.floor(meters / 6);
            const remainingMeters = (meters % 6).toFixed(2);
            
            addAluminumRowHTML(pAlum, profile, color, tiras, remainingMeters);
        }
    }
}

function addAluminumRowHTML(container, selRef = '8025', selCol = 'Natural', tVal = 0, mVal = 0) {
    const div = document.createElement('div');
    div.className = 'alum-item-row';
    div.innerHTML = `
        <select class="alum-ref-input form-control">
            <option value="8025" ${selRef==='8025'?'selected':''}>8025</option>
            <option value="744" ${selRef==='744'?'selected':''}>744</option>
            <option value="5020" ${selRef==='5020'?'selected':''}>5020</option>
            <option value="U_Asentador" ${selRef==='U_Asentador'?'selected':''}>U Asentador</option>
        </select>
        <select class="alum-col-input form-control">
            <option value="Natural" ${selCol==='Natural'?'selected':''}>Natural</option>
            <option value="Negro" ${selCol==='Negro'?'selected':''}>Negro</option>
            <option value="Blanco" ${selCol==='Blanco'?'selected':''}>Blanco</option>
            <option value="Madera" ${selCol==='Madera'?'selected':''}>Madera</option>
            <option value="Champagne" ${selCol==='Champagne'?'selected':''}>Champagne</option>
        </select>
        <div class="tiras-calc">
            <input type="number" min="0" step="1" class="alum-tiras-input form-control" placeholder="Tiras" value="${tVal}" oninput="updateAlumTotal(this)">
            <span>tiras +</span>
            <input type="number" min="0" step="0.1" class="alum-m-input form-control" placeholder="M" value="${mVal}" oninput="updateAlumTotal(this)">
            <span>m</span>
        </div>
        <div class="alum-total-display"><strong>${((tVal*6)+parseFloat(mVal||0)).toFixed(2)}m</strong></div>
        <button onclick="this.parentElement.remove()" class="btn-remove"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(div);
}

function addNewProfileRow() {
    addAluminumRowHTML(document.getElementById('alum-body'), '8025', 'Natural', 0, 0);
}

function updateAlumTotal(inputEl) {
    const row = inputEl.closest('.alum-item-row');
    const tiras = parseInt(row.querySelector('.alum-tiras-input').value) || 0;
    const extraM = parseFloat(row.querySelector('.alum-m-input').value) || 0;
    const total = (tiras * 6) + extraM;
    row.querySelector('.alum-total-display strong').innerText = total.toFixed(2) + 'm';
}

function saveInventory() {
    // 1. Save Glass (Sheets vs Scraps)
    let newGlass = { sheets: {}, scraps: {} };
    document.querySelectorAll('.inv-glass-sheets-input').forEach(input => {
        const key = input.getAttribute('data-key');
        newGlass.sheets[key] = Math.max(0, parseInt(input.value) || 0);
    });
    document.querySelectorAll('.inv-glass-scraps-input').forEach(input => {
        const key = input.getAttribute('data-key');
        newGlass.scraps[key] = Math.max(0, parseFloat(input.value) || 0);
    });
    invState.glass = newGlass;

    // 2. Save Aluminum (Reset & Reconstruct)
    // We clear to avoid ghost categories, but we must ensure required dict structure exists
    let newAlum = {
        '8025': {}, '744': {}, '5020': {}, 'U_Asentador': {}
    };

    document.querySelectorAll('.alum-item-row').forEach(row => {
        const ref = row.querySelector('.alum-ref-input').value;
        const col = row.querySelector('.alum-col-input').value;
        const tiras = parseInt(row.querySelector('.alum-tiras-input').value) || 0;
        const extraM = parseFloat(row.querySelector('.alum-m-input').value) || 0;
        const totalLineal = (tiras * 6) + extraM;

        if(!newAlum[ref]) newAlum[ref] = {};
        // Aggregate if duplicates
        newAlum[ref][col] = (newAlum[ref][col] || 0) + totalLineal;
    });

    invState.alum = newAlum;

    // Save and Reflow
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(invState));
    document.getElementById('invModal').style.display = 'none';
    window.showToast("Inventario detallado actualizado", "success");
    loadProductionData(); // Trigger analytical pipeline
}


/* VIEW TOGGLE */
function toggleViewMode() {
    isHistoryMode = !isHistoryMode;
    const btn = document.getElementById('btnToggleView');
    const kanban = document.getElementById('kanbanBoard');
    const history = document.getElementById('historyBoard');

    if(isHistoryMode) {
        kanban.style.display = 'none';
        history.style.display = 'block';
        btn.innerHTML = `<i class="fas fa-network-wired"></i> Volver a Planta Kanban`;
        btn.style.background = '#3b82f6';
    } else {
        kanban.style.display = 'flex';
        history.style.display = 'none';
        btn.innerHTML = `<i class="fas fa-archive"></i> Ver Historial de Entregas`;
        btn.style.background = '#64748b';
    }
    loadProductionData();
}


/* GLASS OPTIMIZATION ENGINE */
function getOptimalGlassDeduction(type, areaNeeded, workingInv) {
    const config = GLASS_CONFIG[type];
    if (!config) {
        // Fallback for types not in pricing matrix (Acrilico, etc)
        return { missing: false, message: "Material estándar", defect: 0 };
    }

    const sheetArea = config.width * config.height;
    const m2Price = config.m2Price;
    const sheetPrice = config.sheetPrice;

    // 1. Calculate cost by m2
    const costM2 = areaNeeded * m2Price;
    
    // 2. Calculate cost by sheet (assuming 1 sheet covers it, or proportional)
    const sheetsNeeded = Math.ceil(areaNeeded / sheetArea);
    const costSheets = sheetsNeeded * sheetPrice;

    // Logic: If area > 70% of a sheet, or sheets are cheaper, use sheets.
    const useSheet = (areaNeeded / sheetArea > 0.7) || (costSheets < costM2);
    
    if (useSheet) {
        // Try to deduct from sheets
        if (workingInv.glass.sheets[type] >= sheetsNeeded) {
            workingInv.glass.sheets[type] -= sheetsNeeded;
            return { 
                missing: false, 
                message: `Lámina Optimizada: Usar ${sheetsNeeded} plancha(s) de ${type}.`, 
                defect: 0 
            };
        }
    }

    // Try to deduct from scraps
    if (workingInv.glass.scraps[type] >= areaNeeded) {
        workingInv.glass.scraps[type] -= areaNeeded;
        return { 
            missing: false, 
            message: `Retazo Optimizado: Consumir ${areaNeeded.toFixed(2)}m² de retacería.`, 
            defect: 0 
        };
    } else {
        // Try to combine? For simplicity, if scraps not enough, try 1 sheet if available
        if (workingInv.glass.sheets[type] >= 1) {
             workingInv.glass.sheets[type] -= 1;
             return { 
                missing: false, 
                message: `Lámina de Emergencia: Usar 1 plancha para cubrir ${areaNeeded.toFixed(2)}m².`, 
                defect: 0 
            };
        }
    }

    // Missing material
    return { 
        missing: true, 
        message: `${areaNeeded.toFixed(2)}m² de ${type}`, 
        defect: areaNeeded 
    };
}

/* CARPENTRY ERP ENGINE */
async function loadProductionData() {
    try {
        if (!db) return;
        const clients = await db.getAll();
        
        let pending = [];
        let producing = [];
        let ready = [];
        let historical = [];
        
        let totalHours = 0;

        // Working memory copy to test flow sequentially (FIFO strict requirement)
        let workingInventory = JSON.parse(JSON.stringify(invState));
        let missingAlertsMap = {}; 

        clients.forEach(c => {
            if (c.deliveryStatus === 'Entregado' || c.status === 'Cancelado') {
                if(!c.deleted) historical.push(c); 
                return;
            }
            if (c.deleted) return; 

            const items = Array.isArray(c.items) ? c.items : [{
                product: c.product || 'N/A', quantity: c.quantity || 1, glass: c.glass || 'N/A', color: c.color || 'N/A'
            }];

            if (c.deliveryStatus === 'Listo para Despacho' || c.deliveryStatus === 'Listo') {
                ready.push({ order: c, items });
                return;
            }

            let canFulfillFullOrder = true;
            let orderMissingMessages = [];
            let orderHours = 0;

            // Transact each sub-item
            items.forEach(it => {
                const qty = parseInt(it.quantity) || 1;
                const prodName = it.product;
                const reqColorAlum = it.color || 'Natural';
                
                // --- NEW GLASS OPTIMIZATION LOGIC ---
                let reqNameGlass = it.glass || 'Claro 4mm'; 
                // Normalize names to match GLASS_CONFIG
                if (reqNameGlass.includes('Claro') && reqNameGlass.includes('4mm')) reqNameGlass = 'Claro 4mm';
                else if (reqNameGlass.includes('Claro') && reqNameGlass.includes('5mm')) reqNameGlass = 'Claro 5mm';
                else if (reqNameGlass.includes('Claro') && reqNameGlass.includes('3mm')) reqNameGlass = 'Claro 3mm';
                else if (reqNameGlass.includes('Bronce') && reqNameGlass.includes('Reflectivo')) reqNameGlass = 'Bronce Reflectivo 4mm';
                else if (reqNameGlass.includes('Bronce')) reqNameGlass = 'Bronce 4mm';
                else if (reqNameGlass.includes('Espejo') && reqNameGlass.includes('3mm')) reqNameGlass = 'Espejo 3mm';
                else if (reqNameGlass.includes('Espejo')) reqNameGlass = 'Espejo 4mm';
                
                const glassMulti = CARPENTRY_GLASS[prodName] !== undefined ? CARPENTRY_GLASS[prodName] : 2;
                const totalAreaNeeded = glassMulti * qty;

                const optimization = getOptimalGlassDeduction(reqNameGlass, totalAreaNeeded, workingInventory);
                
                if (optimization.missing) {
                    canFulfillFullOrder = false;
                    orderMissingMessages.push(optimization.message);
                    missingAlertsMap[reqNameGlass] = (missingAlertsMap[reqNameGlass] || 0) + optimization.defect;
                } else {
                    // Optimization metadata for UI
                    it.optimizationMsg = optimization.message;
                }
                // -------------------------------------

                // Extraction Profile logic

                // Check Aluminum Profiles Complex Stock
                let missingProfileFlag = false;
                for (let ref in requestedProfiles) {
                    const costProfile = requestedProfiles[ref] * qty;
                    // If profile dict exists but color is missing, init it conceptually as 0
                    const stock = (workingInventory.alum[ref] && workingInventory.alum[ref][reqColorAlum]) ? workingInventory.alum[ref][reqColorAlum] : 0;
                    
                    if (stock < costProfile) {
                        canFulfillFullOrder = false;
                        missingProfileFlag = true;
                        const defect = costProfile - stock;
                        const alertStr = `Perf. ${ref} ${reqColorAlum}`;
                        orderMissingMessages.push(`${defect.toFixed(2)}m ${alertStr}`);
                        missingAlertsMap[alertStr] = (missingAlertsMap[alertStr] || 0) + defect;
                        
                        // Zero out locking out flow
                        if(workingInventory.alum[ref] && workingInventory.alum[ref][reqColorAlum] !== undefined) {
                            workingInventory.alum[ref][reqColorAlum] = 0;
                        }
                    } else {
                        // Success -> transact dynamically
                        if(workingInventory.alum[ref]) workingInventory.alum[ref][reqColorAlum] -= costProfile;
                    }
                }

            });

            if (canFulfillFullOrder) {
                totalHours += orderHours;
                producing.push({ order: c, items, hours: orderHours });
            } else {
                pending.push({ order: c, items, missing: orderMissingMessages });
            }
        });

        // 5. Update UI Dashboards
        document.getElementById('countPending').textContent = pending.length;
        document.getElementById('countProduction').textContent = producing.length;
        document.getElementById('countDispatch').textContent = ready.length;

        document.getElementById('kpiDelayed').textContent = pending.length;
        document.getElementById('kpiProduction').textContent = producing.length;
        document.getElementById('kpiDispatch').textContent = ready.length;
        document.getElementById('kpiHours').textContent = totalHours + ' hrs';

        if(isHistoryMode) {
            renderHistory(historical);
        } else {
            renderColumn('colPending', pending, 'pending');
            renderColumn('colProduction', producing, 'production');
            renderColumn('colDispatch', ready, 'dispatch');
        }

        handleRecommendations(missingAlertsMap, pending.length);

    } catch (e) {
        console.error("Error Carpentry ERP engine:", e);
    }
}

function renderColumn(containerId, dataList, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (dataList.length === 0) {
        let msg = '<i class="fas fa-box-open"></i> Sin tareas';
        if(type === 'pending') msg = '<i class="fas fa-check-circle" style="color:#10b981;"></i><br> Flujo limpio<br>Sin retrasos';
        if(type === 'dispatch') msg = '<i class="fas fa-truck" style="color:#d1d5db;"></i><br> No hay despachos <br> pendientes';
        
        container.innerHTML = `<div class="empty-state">${msg}</div>`;
        return;
    }

    dataList.forEach(data => {
        const order = data.order;
        const serialStr = `COT-${String(order.serial || 0).padStart(7, '0')}`;
        
        let productsHtml = data.items.map(it => {
            let spec = [];
            if(it.color && it.color !== 'N/A') spec.push(it.color);
            if(it.glass && it.glass !== 'N/A') spec.push(it.glass);
            let s = spec.length > 0 ? ` <i>(${spec.join(', ')})</i>` : '';
            
            let optInfo = it.optimizationMsg ? `<div style="font-size:0.7rem; color:#059669; font-weight:bold; margin-top:2px;"><i class="fas fa-magic"></i> ${it.optimizationMsg}</div>` : '';
            
            return `<div style="margin-bottom: 5px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px;">
                <div>• <strong>${it.quantity}x</strong> ${it.product}${s}</div>
                ${optInfo}
            </div>`;
        }).join('');

        let borderLeftColor = '#cbd5e1';
        let alertHtml = '';
        let actionBtn = '';

        if (type === 'pending') {
            borderLeftColor = '#be123c';
            alertHtml = `
                <div class="card-alert" style="flex-direction:column; align-items:flex-start;">
                    <strong style="margin-bottom:5px;"><i class="fas fa-exclamation-circle"></i> Faltante Confirmado ERP:</strong> 
                    <ul style="margin:0; padding-left:20px; font-weight:normal; font-size:0.8rem;">
                        ${data.missing.map(m => `<li>${m}</li>`).join('')}
                    </ul>
                </div>`;
        } else if (type === 'production') {
            borderLeftColor = '#3b82f6';
            alertHtml = `
                <div style="margin-top:0.8rem; font-size:0.8rem; color:#64748b; background:#f1f5f9; padding:5px; border-radius:4px;">
                    <i class="fas fa-stopwatch" style="color:#3b82f6;"></i> Est. Fabricación: <strong>${data.hours} hrs</strong>
                </div>`;
            actionBtn = `<button class="btn-complete" onclick="changeOrderStatus('${order.id}', 'Listo para Despacho')"><i class="fas fa-check"></i> Terminar Fabricación</button>`;
        } else if (type === 'dispatch') {
            borderLeftColor = '#10b981';
            actionBtn = `<button class="btn-complete" style="background:#0f172a;" onclick="changeOrderStatus('${order.id}', 'Entregado')"><i class="fas fa-truck-loading"></i> Finalizar y Despachar</button>`;
        }

        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.style.borderLeftColor = borderLeftColor;

        card.innerHTML = `
            <div class="card-header">
                <span style="color: #0f172a;">${serialStr}</span>
                <span style="color: #64748b; font-size:0.8rem;"><i class="fas fa-calendar-alt"></i> ${order.date}</span>
            </div>
            <div class="card-body">
                <div style="font-weight: bold; margin-bottom: 0.5rem; font-size:0.95rem; color:#1e293b;">${order.fullName}</div>
                <div style="margin-bottom: 0.8rem; font-size:0.8rem; color:#64748b;">
                    <i class="fas fa-map-marker-alt"></i> ${order.address || 'Recoger en local'} - ${order.city || ''} 
                </div>
                <div style="background:#f8fafc; padding:8px; border-radius:4px; border:1px solid #e2e8f0;">
                    ${productsHtml}
                </div>
                ${alertHtml}
                ${actionBtn}
            </div>
        `;

        container.appendChild(card);
    });
}

function handleRecommendations(missingMap, pendingCount) {
    const recBox = document.getElementById('recommendationBox');
    const recText = document.getElementById('recommendationText');

    if (pendingCount === 0 || Object.keys(missingMap).length === 0) {
        recBox.style.display = 'block';
        recBox.style.borderLeftColor = '#10b981';
        recBox.style.backgroundColor = '#ecfdf5';
        recBox.querySelector('strong').style.color = '#047857';
        recBox.querySelector('strong').innerHTML = '<i class="fas fa-leaf"></i> Análisis de Disponibilidad';
        recText.style.color = '#065f46';
        recText.innerHTML = "Materiales suficientes en stock. Todas las órdenes asignadas están en cola de manufactura continua y sin bloqueos.";
    } else {
        recBox.style.display = 'block';
        recBox.style.borderLeftColor = '#f59e0b';
        recBox.style.backgroundColor = '#fffbeb';
        recBox.querySelector('strong').style.color = '#b45309';
        recBox.querySelector('strong').innerHTML = '<i class="fas fa-lightbulb"></i> Consolidado de Compras Recomendado (Justificaciones de Retraso):';
        recText.style.color = '#92400e';
        
        // Unify alerts, converting meters back to 'Tiras' for display
        let msg = '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:10px; margin-top:10px;">';
        for(let key in missingMap) {
            const val = parseFloat(missingMap[key]);
            if(key.includes('Perf.')) {
                // Determine Tiras
                const ceilTiras = Math.ceil(val / 6);
                msg += `
                <div style="background:white; border:1px solid #fcd34d; padding:8px; border-radius:4px;">
                    <strong>Comprar ${ceilTiras} Tira(s)</strong><br>
                    <small>(${val.toFixed(1)}m equivalentes de ${key})</small>
                </div>`;
            } else {
                msg += `
                <div style="background:white; border:1px solid #fcd34d; padding:8px; border-radius:4px;">
                    <strong>Comprar ${Math.ceil(val)} m²</strong><br>
                    <small>Vidriería: ${key}</small>
                </div>`;
            }
        }
        msg += "</div>";
        recText.innerHTML = msg;
    }
}

function renderHistory(hist) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    if(hist.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:#64748b;">No hay historial de despachos.</td></tr>';
        return;
    }
    
    hist.sort((a,b) => (b.id || 0) - (a.id || 0)).forEach(c => {
        const serialStr = `COT-${String(c.serial || 0).padStart(7, '0')}`;
        const sColor = c.status === 'Cancelado' ? '#ef4444' : '#10b981';
        
        const productsInfo = (c.items && Array.isArray(c.items)) ? c.items.map(it => `${it.product}`).join(', ') : c.product;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:1rem; border-bottom:1px solid #e2e8f0; font-weight:bold;">${serialStr}</td>
            <td style="padding:1rem; border-bottom:1px solid #e2e8f0;">${c.fullName}<br><small style="color:#64748b;">${c.date}</small></td>
            <td style="padding:1rem; border-bottom:1px solid #e2e8f0; font-size:0.85rem;">${productsInfo}</td>
            <td style="padding:1rem; border-bottom:1px solid #e2e8f0; font-weight:bold; color:${sColor};"><i class="fas fa-check"></i> ${c.deliveryStatus || c.status}</td>
            <td style="padding:1rem; border-bottom:1px solid #e2e8f0; text-align:right;">
                <button onclick="changeOrderStatus('${c.id}', 'En Producción', true)" class="btn-history-restore" title="Regresar al Flujo de Trabajo">
                    <i class="fas fa-undo"></i> Restaurar Orden
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function changeOrderStatus(id, newStatus, removeCancel = false) {
    try {
        let client = await db.getById(id);
        if (client) {
            client.deliveryStatus = newStatus;
            if(removeCancel && client.status === 'Cancelado') client.status = 'Pendiente';
            
            await db.save(client);
            window.showToast(`Estado ajustado: ${newStatus}`, "success");
            loadProductionData(); 
        }
    } catch(e) {
        console.error("Error cambiando estado:", e);
    }
}
