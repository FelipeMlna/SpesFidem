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
        color: #cbd5e1 !important; /* Lighter gray for better contrast on dark */
    }
`;

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
        fab.style.transform = 'scale(1.2)';
        fab.style.background = '#10b981'; // Green flash
        setTimeout(() => {
            fab.style.transform = 'scale(1)';
            fab.style.background = 'var(--accent, #ca8a04)';
        }, 300);

        // Optional: Show sidebar briefly or just notify
        // this.toggleUI(); 
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
        document.getElementById('cart-count').textContent = this.items.length;
    }

    render() {
        const container = document.getElementById('cart-items-container');
        if (!container) return;

        if (this.items.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; color:#cbd5e1;">
                    <i class="fas fa-shopping-basket" style="font-size:3rem; margin-bottom:15px; opacity:0.5;"></i>
                    <p>Tu cotización está vacía.</p>
                    <button onclick="cart.toggleUI(); window.location.href='index.html?section=productos'" 
                        style="margin-top:15px; background:var(--accent, #ca8a04); color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">
                        Ver Catálogo
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = this.items.map((item, index) => `
            <div class="cart-item">
                <img src="${item.image}" alt="Prod">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.category}</div>
                    <div class="cart-item-meta">Ref: ${item.ref}</div>
                    <div class="cart-remove" onclick="cart.removeItem(${index})">Eliminar</div>
                </div>
            </div>
        `).join('');
    }

    checkout() {
        if (this.items.length === 0) {
            if (typeof showToast === 'function') showToast("Agrega productos al carrito para cotizar.", "warning");
            return;
        }

        // Build WhatsApp Message
        let msg = "Hola Spesfidem, deseo cotizar estos productos:%0A%0A";
        this.items.forEach(item => {
            msg += `- ${item.category} (Ref: ${item.ref})%0A`;
        });

        // Use the main phone number from footer/header
        const phone = "573046291152";
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    }
}

// Global instance
window.cart = new SpesfidemCart();

// Helper for gallery buttons (called from onclick in HTML)
window.addToCartFromGallery = function (category, imagePath) {
    // Extract a "Reference" from the filename
    const ref = imagePath.split('/').pop().split('.')[0];

    window.cart.addItem({
        category: category.replace(/_/g, ' ').toUpperCase(),
        image: imagePath,
        ref: ref
    });
};
