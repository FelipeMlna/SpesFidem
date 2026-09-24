// Intense Carpentry Production Workflow Engine

// Time per unit mapping (in hours) for manufacturing load calculations
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
    setTimeout(loadProductionData, 300); // Trigger sequence
});

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

/* CARPENTRY WORKFLOW ENGINE */
async function loadProductionData() {
    try {
        if (!db) return;
        const clients = await db.getAll();
        
        let pending = [];
        let producing = [];
        let ready = [];
        let historical = [];
        
        let totalHours = 0;

        clients.forEach(c => {
            if (c.deleted) return;

            const isInWork = c.inProduction === true || 
                             c.deliveryStatus === 'En Fabricación' || 
                             c.deliveryStatus === 'En Proceso' || 
                             c.deliveryStatus === 'En Trabajo' || 
                             c.deliveryStatus === 'En Instalación' || 
                             c.deliveryStatus === 'Listo para Despacho' || 
                             c.deliveryStatus === 'Listo';

            if (c.deliveryStatus === 'Entregado' || c.status === 'Cancelado') {
                if (isInWork || c.deliveredInProduction) historical.push(c); 
                return;
            }

            // Exclude users/clients whose project has NOT been started by admin yet
            if (!isInWork) return;

            const items = Array.isArray(c.items) ? c.items : [{
                product: c.product || 'N/A', quantity: c.quantity || 1, glass: c.glass || 'N/A', color: c.color || 'N/A'
            }];

            let orderHours = 0;
            items.forEach(it => {
                const qty = parseInt(it.quantity) || 1;
                const timePerUnit = MANUFACTURE_TIMES[it.product] || 3;
                orderHours += timePerUnit * qty;
            });

            if (c.deliveryStatus === 'En Instalación' || c.deliveryStatus === 'Listo para Despacho' || c.deliveryStatus === 'Listo') {
                ready.push({ order: c, items, hours: orderHours });
            } else if (c.deliveryStatus === 'En Fabricación' || c.deliveryStatus === 'En Proceso' || c.deliveryStatus === 'En Trabajo') {
                totalHours += orderHours;
                producing.push({ order: c, items, hours: orderHours });
            } else {
                pending.push({ order: c, items, hours: orderHours });
            }
        });

        // Update UI Dashboards
        const countPending = document.getElementById('countPending');
        if (countPending) countPending.textContent = pending.length;
        const countProduction = document.getElementById('countProduction');
        if (countProduction) countProduction.textContent = producing.length;
        const countDispatch = document.getElementById('countDispatch');
        if (countDispatch) countDispatch.textContent = ready.length;

        const kpiPending = document.getElementById('kpiPending');
        if (kpiPending) kpiPending.textContent = pending.length;
        const kpiDelayed = document.getElementById('kpiDelayed');
        if (kpiDelayed) kpiDelayed.textContent = pending.length;

        const kpiProduction = document.getElementById('kpiProduction');
        if (kpiProduction) kpiProduction.textContent = producing.length;

        const kpiDispatch = document.getElementById('kpiDispatch');
        if (kpiDispatch) kpiDispatch.textContent = ready.length;

        const kpiHours = document.getElementById('kpiHours');
        if (kpiHours) kpiHours.textContent = totalHours + ' hrs';

        if(isHistoryMode) {
            renderHistory(historical);
        } else {
            renderColumn('colPending', pending, 'pending');
            renderColumn('colProduction', producing, 'production');
            renderColumn('colDispatch', ready, 'dispatch');
        }

    } catch (e) {
        console.error("Error Carpentry ERP engine:", e);
    }
}

function renderColumn(containerId, dataList, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (dataList.length === 0) {
        let msg = '<i class="fas fa-box-open"></i> Sin proyectos';
        if(type === 'pending') msg = '<i class="fas fa-clock" style="color:#cbd5e1;"></i><br> No hay proyectos pendientes en medición';
        if(type === 'production') msg = '<i class="fas fa-hammer" style="color:#cbd5e1;"></i><br> No hay proyectos en fabricación activa<br><span style="font-size:0.75rem; color:#64748b; font-weight:normal;">Inicie un proyecto desde el Panel Admin</span>';
        if(type === 'dispatch') msg = '<i class="fas fa-truck" style="color:#cbd5e1;"></i><br> No hay proyectos en instalación';
        
        container.innerHTML = `<div class="empty-state">${msg}</div>`;
        return;
    }

    dataList.forEach(data => {
        const order = data.order;
        const serialStr = `PROY-${String(order.id || 0).padStart(5, '0')}`;
        
        let productsHtml = data.items.map(it => {
            let spec = [];
            if(it.color && it.color !== 'N/A') spec.push(it.color);
            if(it.glass && it.glass !== 'N/A') spec.push(it.glass);
            let s = spec.length > 0 ? ` <i>(${spec.join(', ')})</i>` : '';
            
            return `<div style="margin-bottom: 5px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px;">
                <div>• <strong>${it.quantity}x</strong> ${it.product}${s}</div>
            </div>`;
        }).join('');

        let borderLeftColor = '#cbd5e1';
        let alertHtml = '';
        let actionBtn = '';

        if (type === 'pending') {
            borderLeftColor = '#f59e0b';
            alertHtml = `
                <div style="margin-top:0.8rem; font-size:0.8rem; color:#854d0e; background:#fef08a; padding:6px; border-radius:4px; font-weight:700;">
                    <i class="fas fa-ruler-combined"></i> Etapa: <strong>Medición y Diseño Inicial</strong>
                </div>`;
            actionBtn = `<button class="btn-complete" style="background:#3b82f6;" onclick="changeOrderStatus('${order.id}', 'En Fabricación')"><i class="fas fa-play"></i> Avanzar a Fabricación</button>`;
        } else if (type === 'production') {
            borderLeftColor = '#3b82f6';
            alertHtml = `
                <div style="margin-top:0.8rem; font-size:0.8rem; color:#1e40af; background:#bfdbfe; padding:6px; border-radius:4px; font-weight:700;">
                    <i class="fas fa-hammer"></i> Etapa: <strong>En Fabricación Activa</strong> (${data.hours} hrs est.)
                </div>`;
            actionBtn = `<button class="btn-complete" style="background:#6366f1;" onclick="changeOrderStatus('${order.id}', 'En Instalación')"><i class="fas fa-truck"></i> Pasar a Instalación</button>`;
        } else if (type === 'dispatch') {
            borderLeftColor = '#10b981';
            alertHtml = `
                <div style="margin-top:0.8rem; font-size:0.8rem; color:#166534; background:#bbf7d0; padding:6px; border-radius:4px; font-weight:700;">
                    <i class="fas fa-truck"></i> Etapa: <strong>En Instalación / Listo para Entrega</strong>
                </div>`;
            actionBtn = `<button class="btn-complete" style="background:#0f172a;" onclick="changeOrderStatus('${order.id}', 'Entregado')"><i class="fas fa-check-circle"></i> Finalizar y Entregar</button>`;
        }

        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.style.borderLeftColor = borderLeftColor;

        card.innerHTML = `
            <div class="card-header">
                <span style="color: #0f172a; font-weight: 800;">${serialStr}</span>
                <span style="color: #64748b; font-size:0.8rem;"><i class="fas fa-calendar-alt"></i> ${order.date || 'Reciente'}</span>
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
