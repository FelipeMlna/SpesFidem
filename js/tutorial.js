/**
 * Spesfidem Aluminio - Interactive Tutorial & Help System
 * Uses driver.js to create a step-by-step guided tour
 * Features: Professional Help Menu, Executive Tone, PWA Integration
 */

const driver = window.driver.js.driver;

// Professional Configuration
const driverConfig = {
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: 'rgba(2, 6, 23, 0.9)', // Deep Elite Dark
    doneBtnText: 'Concluir Recorrido',
    closeBtnText: 'Cerrar',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    popoverClass: 'driverjs-theme-elite'
};

/* --- Professional Content Definitions --- */

// 1. Full Executive Tour (Index)
const indexSteps = [
    {
        element: '.logo-premium-final',
        popover: {
            title: 'Bienvenido a la Experiencia Spesfidem',
            description: 'Representamos la cúspide en ingeniería de aluminio y sistemas arquitectónicos de alto desempeño. Su visión, materializada.',
            side: "bottom",
            align: 'start'
        }
    },
    {
        element: '#hero h1',
        popover: {
            title: 'Filosofía: Arquitectura Invisible',
            description: 'Fusionamos diseño minimalista con resistencia estructural. Maximizamos la entrada de luz sin comprometer la seguridad.',
            side: "bottom",
            align: 'start'
        }
    },
    {
        element: '#beneficios',
        popover: {
            title: 'Estándares de Calidad Certificada',
            description: 'Conozca nuestros pilares: Aislamiento térmico superior, ingeniería acústica y durabilidad garantizada por años.',
            side: "top",
            align: 'start'
        }
    },
    {
        element: '#productos',
        popover: {
            title: 'Catálogo de Soluciones Élite',
            description: 'Explore nuestra exclusiva selección de ventanería europea, puertas monumentales y sistemas de vidrio templado de seguridad.',
            side: "top",
            align: 'start'
        }
    },
    {
        element: '#metodo',
        popover: {
            title: 'Metodología de Ejecución',
            description: 'Un proceso transparente y técnico: Desde la consultoría inicial y simulación digital, hasta la instalación de precisión.',
            side: "top",
            align: 'start'
        }
    },
    {
        element: '#perfil',
        popover: {
            title: 'Dirección Técnica Especializada',
            description: 'Liderazgo a cargo de Jhon Edinson Espinosa García. Respaldo técnico y compromiso ético en cada proyecto.',
            side: "top",
            align: 'start'
        }
    },
    {
        element: '#contacto',
        popover: {
            title: 'Canales de Atención Preferencial',
            description: 'Inicie su proyecto hoy. Contacte directamente con nuestro equipo de ingeniería vía WhatsApp o solicite una visita técnica.',
            side: "top",
            align: 'start'
        }
    }
];

/* --- Help Menu System (Overlay) --- */

function toggleHelpMenu() {
    // Check if menu exists
    let menu = document.getElementById('spesfidem-help-menu');

    if (menu) {
        // Toggle visibility
        if (menu.style.display === 'none') {
            menu.style.display = 'flex';
            requestAnimationFrame(() => menu.style.opacity = '1');
        } else {
            menu.style.opacity = '0';
            setTimeout(() => menu.style.display = 'none', 300);
        }
        return;
    }

    // Create Menu
    menu = document.createElement('div');
    menu.id = 'spesfidem-help-menu';
    menu.innerHTML = `
        <div class="help-card">
            <div class="help-header">
                <h3><i class="fas fa-compass"></i> Centro de Ayuda Élite</h3>
                <button onclick="toggleHelpMenu()" class="close-help"><i class="fas fa-times"></i></button>
            </div>
            <div class="help-body">
                <p class="help-intro">Seleccione el tipo de asistencia que requiere:</p>
                
                <button onclick="launchFullTour()" class="help-option-btn primary">
                    <div class="icon-wrap"><i class="fas fa-flag-checkered"></i></div>
                    <div class="text-wrap">
                        <strong>Recorrido Guiado Completo</strong>
                        <span>Experiencia paso a paso por toda la plataforma.</span>
                    </div>
                    <i class="fas fa-chevron-right arrow"></i>
                </button>

                <div class="help-divider"><span>Temas Específicos</span></div>

                <div class="help-grid">
                    <button onclick="launchMiniTour('products')" class="help-option-btn secondary">
                        <i class="fas fa-box-open"></i> Catálogo
                    </button>
                    <button onclick="launchMiniTour('contact')" class="help-option-btn secondary">
                        <i class="fas fa-envelope"></i> Contacto
                    </button>
                </div>

                <div class="help-footer">
                    <a href="https://wa.me/573046291152" target="_blank" class="live-support-link">
                        <i class="fab fa-whatsapp"></i> Soporte en Vivo con Ingeniero
                    </a>
                </div>
            </div>
        </div>
    `;

    // Inject Styles Dynamically
    const style = document.createElement('style');
    style.textContent = `
        #spesfidem-help-menu {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(2, 6, 23, 0.8);
            backdrop-filter: blur(8px);
            z-index: 10000;
            display: flex; justify-content: center; align-items: center;
            opacity: 0; transition: opacity 0.3s ease;
        }
        .help-card {
            background: #0f172a;
            border: 1px solid rgba(255,255,255,0.1);
            width: 90%; max-width: 500px;
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            overflow: hidden;
            font-family: 'Inter', sans-serif;
            animation: slideUp 0.3s ease-out;
        }
        .help-header {
            background: linear-gradient(to right, #0f172a, #1e293b);
            padding: 1.5rem;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .help-header h3 { color: #f8fafc; margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.2rem; }
        .close-help { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1.2rem; transition: 0.3s; }
        .close-help:hover { color: #ef4444; transform: rotate(90deg); }
        
        .help-body { padding: 2rem; }
        .help-intro { color: #cbd5e1; margin-bottom: 1.5rem; font-size: 0.95rem; }
        
        .help-option-btn {
            width: 100%; text-align: left;
            border: none; border-radius: 12px;
            cursor: pointer; transition: 0.3s;
            display: flex; align-items: center;
        }
        .help-option-btn.primary {
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            padding: 1rem; color: white;
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
        }
        .help-option-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(14, 165, 233, 0.4); }
        
        .icon-wrap { background: rgba(255,255,255,0.2); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; }
        .text-wrap { flex: 1; }
        .text-wrap strong { display: block; font-size: 1rem; margin-bottom: 2px; }
        .text-wrap span { font-size: 0.8rem; opacity: 0.9; }
        .arrow { opacity: 0.6; }

        .help-divider { margin: 1.5rem 0; display: flex; align-items: center; color: #64748b; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .help-divider::before, .help-divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1); }
        .help-divider span { padding: 0 10px; }

        .help-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .help-option-btn.secondary {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
            flex-direction: column; justify-content: center;
            padding: 1rem 0.5rem; color: #cbd5e1;
            gap: 10px; font-size: 0.9rem; font-weight: 500;
        }
        .help-option-btn.secondary:hover { background: rgba(255,255,255,0.08); color: white; border-color: rgba(255,255,255,0.2); }
        .help-option-btn.secondary i { font-size: 1.2rem; color: #38bdf8; }

        .help-footer { margin-top: 2rem; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.5rem; }
        .live-support-link { color: #10b981; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: 0.3s; display: inline-flex; align-items: center; gap: 8px; }
        .live-support-link:hover { color: #34d399; text-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }

        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `;

    document.head.appendChild(style);
    document.body.appendChild(menu);
    requestAnimationFrame(() => {
        menu.style.display = 'flex';
        requestAnimationFrame(() => menu.style.opacity = '1');
    });
}

function launchFullTour() {
    toggleHelpMenu(); // Close menu
    const path = window.location.pathname;
    let steps = [];

function launchFullTour() {
    toggleHelpMenu(); // Close menu
    startDriver(indexSteps);
}

function launchMiniTour(topic) {
    toggleHelpMenu(); // Close menu
    let steps = [];

    if (topic === 'products') {
        steps = [
            { element: '#productos', popover: { title: 'Catálogo', description: 'Explore nuestra gama completa.', side: "top" } },
            { element: '.category-title-metallic', popover: { title: 'Categorías', description: 'Organizado por tipo de sistema.', side: "bottom" } }
        ];
    } else if (topic === 'contact') {
        // Generic contact selector
        steps = [{ element: '#contacto', popover: { title: 'Contacto', description: 'Estamos listos para atenderle.', side: "top" } }];
    }

    startDriver(steps);
}

function startDriver(steps) {
    const driverObj = driver({
        ...driverConfig,
        steps: steps
    });
    driverObj.drive();
}

// Function called by the HTML button
function startTutorial() {
    toggleHelpMenu();
}

// Handle redirects with tours (e.g., coming from help menu on another page)
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tourParam = urlParams.get('tour');

    if (tourParam) {
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);

        setTimeout(() => {
            if (tourParam === 'products') launchMiniTour('products');
            if (tourParam === 'full') launchFullTour();
        }, 800); // Slight delay for rendering
    }

    // Ensure button hookup
    const btn = document.getElementById('startTutorialBtn');
    if (btn) {
        btn.onclick = (e) => {
            e.preventDefault();
            toggleHelpMenu();
        };
    }
});
