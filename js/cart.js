/**
 * Spesfidem Floating Cart Module
 * Injects UI and handles logic without modifying HTML structure.
 */

const CART_STYLES = `
    #spesfidem-cart-fab {
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 60px;
        height: 60px;
        background: var(--accent, #ca8a04) !important;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white !important;
        font-size: 24px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        cursor: pointer;
        z-index: 9999;
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #spesfidem-cart-fab:hover {
        transform: scale(1.1);
    }
    #cart-count {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ef4444 !important;
        color: white !important;
        font-size: 12px;
        font-weight: bold;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #0f172a;
    }
    #spesfidem-cart-sidebar {
        position: fixed;
        top: 0;
        right: -400px;
        width: 350px;
        height: 100vh;
        background: #0f172a !important; /* Dark theme match */
        border-left: 1px solid rgba(255,255,255,0.1);
        z-index: 10000;
        transition: right 0.4s ease;
        display: flex;
        flex-direction: column;
        box-shadow: -10px 0 50px rgba(0,0,0,0.8);
        font-family: 'Outfit', sans-serif;
    }
    #spesfidem-cart-sidebar.open {
        right: 0;
    }
    .cart-header {
        padding: 20px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(0,0,0,0.2) !important;
    }
    #cart-header-title {
        color: white !important;
        margin: 0;
        font-size: 1.2rem;
    }
    .close-cart {
        color: #94a3b8 !important;
        cursor: pointer;
        font-size: 1.5rem;
    }
    .cart-items {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
    }
    .cart-item {
        display: flex;
        gap: 15px;
        background: rgba(255,255,255,0.05) !important;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
        border: 1px solid rgba(255,255,255,0.05);
    }
    .cart-item img {
        width: 60px;
        height: 60px;
        object-fit: cover;
        border-radius: 6px;
    }
    .cart-item-info {
        flex: 1;
    }
    .cart-item-title {
        color: white !important;
        font-size: 0.9rem;
        margin-bottom: 5px;
        font-weight: 600;
    }
    .cart-item-meta {
        color: #94a3b8 !important;
        font-size: 0.8rem;
    }
    .cart-remove {
        color: #ef4444 !important;
        cursor: pointer;
        font-size: 0.9rem;
        margin-top: 5px;
        display: inline-block;
    }
    .cart-footer {
        padding: 20px;
        border-top: 1px solid rgba(255,255,255,0.1);
        background: rgba(0,0,0,0.4) !important;
    }
    .checkout-btn {
        width: 100%;
        padding: 15px;
        background: linear-gradient(135deg, #ca8a04 0%, #eab308 100%) !important;
        border: none;
        color: black !important;
        font-weight: 800;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font-size: 1rem;
        transition: opacity 0.3s;
    }
    .checkout-btn:hover {
        opacity: 0.9;
    }
    /* Button inside Gallery - Injected via CSS class */
    .btn-add-cart {
        position: absolute;
        bottom: 10px;
        right: 10px;
        background: var(--accent, #ca8a04);
        color: white;
        border: none;
        width: 35px;
        height: 35px;
        border-radius: 50%;
        display: flex; /* Initially hidden, logic might verify this */
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        opacity: 0; 
        transform: translateY(20px);
        transition: 0.3s;
        z-index: 10;
    }
    .gallery-item:hover .btn-add-cart {
        opacity: 1;
        transform: translateY(0);
    }

    .btn-card-cart {
        margin-top: 0.8rem;
        background: linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #b45309 100%) !important;
        color: #0f172a !important;
        font-weight: 800 !important;
        font-size: 0.85rem !important;
        padding: 0.45rem 1rem !important;
        border-radius: 50px !important;
        border: 1px solid #fde68a !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 0.4rem !important;
        cursor: pointer !important;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4) !important;
        transition: all 0.3s ease !important;
        text-decoration: none !important;
    }
    .btn-card-cart:hover {
        transform: translateY(-2px) scale(1.05) !important;
        box-shadow: 0 6px 18px rgba(245, 158, 11, 0.6) !important;
        color: #000000 !important;
    }

    @media (max-width: 768px) {
        .btn-add-cart {
            opacity: 0.95 !important;
            transform: none !important;
            width: 40px !important;
            height: 40px !important;
            font-size: 1.1rem !important;
        }
    }

    /* --- NUCLEAR VISIBILITY FIX V2 (SUPER SPECIFICITY) --- */
    html body #spesfidem-cart-sidebar,
    html body #spesfidem-cart-sidebar * {
        color: white !important;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8) !important; /* Fail-safe visibility */
        opacity: 1 !important;
        visibility: visible !important;
    }

    /* EXCEPTIONS (Must come after) */
    html body #spesfidem-cart-sidebar .checkout-btn {
        color: black !important;
        text-shadow: none !important;
    }

    html body #spesfidem-cart-sidebar .cart-remove {
        color: #ef4444 !important;
        text-shadow: none !important;
    }
    
    html body #spesfidem-cart-sidebar .cart-item-meta {
        color: #cbd5e1 !important;
    }
`;

function showCartToast(msg) {
    let toast = document.getElementById('spesfidem-cart-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'spesfidem-cart-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 30px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid #10b981;
            color: #ffffff;
            padding: 0.82rem 1.4rem;
            border-radius: 14px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.7), 0 0 20px rgba(16, 185, 129, 0.3);
            z-index: 100000;
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            gap: 0.6rem;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            opacity: 0;
            transform: translateY(20px);
            pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fas fa-check-circle" style="color: #10b981; font-size: 1.3rem;"></i> ${msg}`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3000);
}

class SpesfidemCart {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('spesfidem_cart')) || [];
        this.init();
    }

    init() {
        this.injectStyles();
        this.injectHTML();
        this.render();
        this.updateCount();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = CART_STYLES;
        document.head.appendChild(style);
    }

    injectHTML() {
        // Floating Button
        const fab = document.createElement('div');
        fab.id = 'spesfidem-cart-fab';
        fab.innerHTML = `<i class="fas fa-shopping-cart"></i><span id="cart-count">0</span>`;
        fab.onclick = () => this.toggleUI();
        document.body.appendChild(fab);

        // Sidebar
        const sidebar = document.createElement('div');
        sidebar.id = 'spesfidem-cart-sidebar';
        sidebar.innerHTML = `
            <div class="cart-header">
                <h3 id="cart-header-title" style="color: white !important; text-shadow: 0 1px 2px black !important;">Mi Cotización</h3>
                <span class="close-cart" onclick="cart.toggleUI()" style="color: white !important;">&times;</span>
            </div>
            <div class="cart-items" id="cart-items-container">
                <!-- Items go here -->
            </div>
            <div class="cart-footer">
                <button class="checkout-btn" onclick="cart.checkout()">
                    <i class="fab fa-whatsapp"></i> Cotizar por WhatsApp
                </button>
            </div>
        `;
        document.body.appendChild(sidebar);
    }

    toggleUI() {
        document.getElementById('spesfidem-cart-sidebar').classList.toggle('open');
    }

    addItem(product) {
        this.items.push(product);
        this.save();
        this.render();
        this.updateCount();

        // Visual Feedback
        const fab = document.getElementById('spesfidem-cart-fab');
        if (fab) {
            fab.style.transform = 'scale(1.2)';
            fab.style.background = '#10b981'; // Green flash
            setTimeout(() => {
                fab.style.transform = 'scale(1)';
                fab.style.background = 'var(--accent, #ca8a04)';
            }, 300);
        }
    }

    removeItem(index) {
        this.items.splice(index, 1);
        this.save();
        this.render();
        this.updateCount();
    }

    save() {
        localStorage.setItem('spesfidem_cart', JSON.stringify(this.items));
    }

    updateCount() {
        const countEl = document.getElementById('cart-count');
        if (countEl) countEl.textContent = this.items.length;
    }

    render() {
        const container = document.getElementById('cart-items-container');
        if (!container) return;

        if (this.items.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; color:#cbd5e1;">
                    <i class="fas fa-shopping-basket" style="font-size:3rem; margin-bottom:15px; opacity:0.5;"></i>
                    <p>Tu cotización está vacía.</p>
                    <button onclick="cart.toggleUI(); window.location.href='index.html#productos'" 
                        style="margin-top:15px; background:var(--accent, #ca8a04); color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">
                        Ver Catálogo
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = this.items.map((item, index) => `
            <div class="cart-item">
                <img src="${item.image}" alt="Prod" onerror="this.src='images/products/ventanas_hq.png'">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.category}</div>
                    <div class="cart-item-meta">Ref: ${item.ref}</div>
                    <div class="cart-remove" onclick="cart.removeItem(${index})">Eliminar</div>
                </div>
            </div>
        `).join('');
    }

    checkout() {
        if (typeof window.handleDesignAccess === 'function') {
            const isAllowed = window.handleDesignAccess(null, 'Cotización por WhatsApp', 'index.html#productos');
            if (!isAllowed) return;
        }

        if (this.items.length === 0) {
            showCartToast("Agrega productos a tu cotización primero.");
            return;
        }

        // Build Rich WhatsApp Message
        let msg = "¡Hola SpesFidem Aluminio! 🛠️%0ADeseo solicitar la cotización formal de los siguientes productos:%0A%0A";
        this.items.forEach((item, i) => {
            msg += `*${i + 1}. ${item.category}*%0A   📌 Referencia: ${item.ref}%0A`;
        });
        msg += "%0AQuedo atento a su respuesta para verificar medidas y presupuesto. ¡Gracias!";

        const phone = "573232045129";
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    }
}

// Global instance
window.cart = new SpesfidemCart();

// Helper for catalog cards
window.addToCartFromCatalog = function (category, imagePath, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (typeof window.handleDesignAccess === 'function') {
        const isAllowed = window.handleDesignAccess(event, 'Cotización de Productos', window.location.href);
        if (!isAllowed) return;
    }
    const cleanCategory = category ? category.replace(/_/g, ' ').toUpperCase() : 'PRODUCTO ÉLITE';
    const ref = imagePath ? imagePath.split('/').pop().split('.')[0] : 'REF-' + Math.floor(100 + Math.random() * 900);

    window.cart.addItem({
        category: cleanCategory,
        image: imagePath || 'images/products/ventanas_hq.png',
        ref: ref
    });
    showCartToast(`Añadido a cotización: ${cleanCategory}`);
};

// Helper for gallery buttons
window.addToCartFromGallery = function (category, imagePath, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (typeof window.handleDesignAccess === 'function') {
        const isAllowed = window.handleDesignAccess(event, 'Cotización de Productos', window.location.href);
        if (!isAllowed) return;
    }
    const cleanCategory = category ? category.replace(/_/g, ' ').toUpperCase() : 'PRODUCTO ÉLITE';
    const ref = imagePath ? imagePath.split('/').pop().split('.')[0] : 'REF-' + Math.floor(100 + Math.random() * 900);

    window.cart.addItem({
        category: cleanCategory,
        image: imagePath,
        ref: ref
    });
    showCartToast(`Añadido a cotización: ${cleanCategory} (#${ref})`);
};
