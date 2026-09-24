const CACHE_NAME = 'spesfidem-v5-no-gallery';

// Core Application Assets
const CORE_ASSETS = [
    './',
    './index.html',
    './admin.html',
    './cortes.html',
    './gallery.html',
    './photo_design.html',
    './pqr.html',
    './touch_mirror_calc.html',
    './view_photo.html',
    './css/style.css',
    './js/app.js',
    './js/translations.js',
    './js/cart.js',
    './manifest.json',
    './images/logo.png'
];

// External Dependencies (CDNs)
const EXTERNAL_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://unpkg.com/aos@2.3.1/dist/aos.css',
    'https://unpkg.com/aos@2.3.1/dist/aos.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@300;400;600&family=Orbitron:wght@400;700;900&display=swap'
];

// Local Image Assets (Verified from usage)
const IMAGE_ASSETS = [
    './images/architecture/skyscraper.png',
    './images/architecture/atrium.png',
    './images/architecture/residence.png',
    './images/contact_bg.png',
    './images/faq_workshop.png',
    './images/hero_glass_mansion.png',
    './images/products/ventana_corrediza.jpg',
    './images/products/ventana_proyectante.jpg',
    './images/products/puerta_principal_hq.png',
    './images/products/division_bano_hq.png', // Inferred common usage
    './images/products/vidrio_templado.jpg'
];

const ASSETS_TO_CACHE = [...CORE_ASSETS, ...EXTERNAL_ASSETS, ...IMAGE_ASSETS];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Handle cross-origin requests (like Google Fonts)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match('./index.html');
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached response if found
            if (cachedResponse) {
                return cachedResponse;
            }

            // Otherwise network request
            return fetch(event.request).then((networkResponse) => {
                // Cache the new resource for future use (Dynamic Caching)
                // We only cache valid responses with http/https schemes
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // Clone response because it can only be consumed once
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    // Don't cache chrome-extension schemes or non-http
                    if (event.request.url.startsWith('http')) {
                        cache.put(event.request, responseToCache);
                    }
                });

                return networkResponse;
            });
        })
    );
});
