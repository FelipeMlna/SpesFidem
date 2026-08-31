/**
 * Spesfidem Mini-Builder (Teen Section Game)
 * Allows users to configure a virtual window/door system.
 */

const SYSTEMS = {
    'corrediza': { name: 'Sistema Corredizo', image: 'images/gallery/ventana_corrediza/1.png', price: 100 },
    'batiente': { name: 'Sistema Batiente', image: 'images/gallery/ventana_batiente/1.png', price: 120 },
    'bioclimatica': { name: 'Pérgola Bioclimática', image: 'images/gallery/pergola/1.png', price: 500 } // Assuming generic images for now
};

class MiniBuilder {
    constructor() {
        this.config = {
            system: 'corrediza',
            glass: 'clear', // clear, mirror, dark
            profile: 'black' // black, white, silver
        };
        this.init();
    }

    init() {
        this.render();
    }

    setSystem(sys) {
        this.config.system = sys;
        this.render();
        this.animatePreview();
    }

    setGlass(type) {
        this.config.glass = type;
        this.render();
    }

    setProfile(color) {
        this.config.profile = color;
        this.render();
    }

    animatePreview() {
        const preview = document.getElementById('builder-preview-img');
        if (preview) {
            preview.style.transform = 'scale(0.95)';
            setTimeout(() => preview.style.transform = 'scale(1)', 200);
        }
    }

    render() {
        // Update UI State
        document.querySelectorAll('.builder-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`btn-sys-${this.config.system}`)?.classList.add('active');
        document.getElementById(`btn-glass-${this.config.glass}`)?.classList.add('active');
        document.getElementById(`btn-prof-${this.config.profile}`)?.classList.add('active');

        // Update Preview (Simulation via CSS Filters/Overlays)
        const previewImg = document.getElementById('builder-preview-img');
        const overlay = document.getElementById('builder-overlay');

        if (previewImg) {
            // In a real app, we'd swap images. Here we simulate.
            // Try to find specific image if available, else fallback
            previewImg.src = SYSTEMS[this.config.system]?.image || 'images/gallery/ventana_corrediza/1.png';

            // Apply CSS filters to simulate glass/profile
            let filters = '';
            if (this.config.glass === 'dark') filters += 'brightness(0.7) ';
            if (this.config.glass === 'mirror') filters += 'contrast(1.2) sepia(0.2) ';

            previewImg.style.filter = filters;

            // Simulate Profile Color via Border/Outline on the container
            const container = document.getElementById('builder-preview-container');
            if (container) {
                const colors = { 'black': '#000', 'white': '#fff', 'silver': '#c0c0c0' };
                container.style.borderColor = colors[this.config.profile];
            }
        }

        // Update Stats
        const cost = SYSTEMS[this.config.system].price * (this.config.glass === 'mirror' ? 1.5 : 1);
        document.getElementById('builder-cost').textContent = `$${cost} EXP`; // Gamified currency
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.builder = new MiniBuilder();
});
