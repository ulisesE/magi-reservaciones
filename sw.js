// sw.js
// Service Worker PWA & Notificaciones — Pump It Up Hub (v1.7.5)
const CACHE_NAME = 'piu-hub-pwa-v1.7.5';

const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/css/components.css',
    '/css/views.css',
    '/icons/icon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png'
];

// Instalación inmediata y precaching de recursos esenciales
self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker PWA instalándose...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch(err => {
                console.warn('[SW] Aviso precaching assets (alguno puede no estar disponible aún):', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker PWA activado:', CACHE_NAME);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Limpiando caché obsoleta:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim()).then(() => {
            // Notificar a las pestañas y PWA que el nuevo Service Worker está activo
            return self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SW_ACTIVATED', cacheName: CACHE_NAME });
                });
            });
        })
    );
});

/**
 * Estrategia de Fetch para PWA y Offline
 * 1. Para peticiones de navegación (HTML): Network-First con fallback a index.html en caché
 * 2. Para assets estáticos locales: Stale-While-Revalidate
 * 3. Para Firebase y APIs externas: Network-Only
 */
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Solo interceptar peticiones GET HTTP/HTTPS
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // No interceptar peticiones a Firebase Firestore, Auth o APIs externas
    if (
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('identitytoolkit') ||
        url.pathname.startsWith('/api/')
    ) {
        return;
    }

    // version.json SIEMPRE debe obtenerse de la red (sin caché) para detectar nuevas versiones
    if (url.pathname.endsWith('/version.json') || url.pathname === '/version.json') {
        event.respondWith(
            fetch(request, { cache: 'no-store' }).catch(() => {
                return new Response(JSON.stringify({ version: 'unknown', offline: true }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Navegación principal (HTML) -> Network First con fallback offline
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => {
                return caches.match('/index.html') || caches.match('/');
            })
        );
        return;
    }

    // Recursos estáticos locales (CSS, JS, iconos, imágenes) -> Stale While Revalidate
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            })
        );
    }
});

/**
 * Receptor Genérico de Mensajes desde la Aplicación Principal
 * Escucha eventos postMessage tipo 'SHOW_NOTIFICATION' y despliega la notificación nativa
 */
self.addEventListener('message', (event) => {
    if (!event.data) return;

    const { type, title, body, icon, badge, tag, data, url, vibrate, actions, silent, requireInteraction } = event.data;

    // Manejo de actualización forzada / bypass de espera
    if (type === 'SKIP_WAITING') {
        console.log('[SW] Mensaje SKIP_WAITING recibido. Forzando activación inmediata...');
        self.skipWaiting();
        return;
    }

    if (type === 'SHOW_NOTIFICATION') {
        const notifTitle = title || 'Pump It Up Hub';
        const notifOptions = {
            body: body || '',
            icon: icon || 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f579.png',
            badge: badge || 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f579.png',
            tag: tag || `piu-notif-${Date.now()}`,
            data: {
                url: url || '/',
                timestamp: Date.now(),
                ...(data || {})
            },
            vibrate: vibrate || [200, 100, 200, 100, 200],
            silent: !!silent,
            requireInteraction: !!requireInteraction,
            actions: Array.isArray(actions) ? actions : [
                { action: 'open', title: 'Abrir en App' }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(notifTitle, notifOptions)
        );
    }
});

/**
 * Manejador de Notificaciones Push (Web Push API / FCM)
 */
self.addEventListener('push', (event) => {
    let payload = {
        title: 'Pump It Up Hub',
        body: 'Tienes una nueva notificación.',
        url: '/'
    };

    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    const notifOptions = {
        body: payload.body || '',
        icon: payload.icon || 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f579.png',
        badge: payload.badge || 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f579.png',
        tag: payload.tag || `push-${Date.now()}`,
        data: {
            url: payload.url || '/',
            timestamp: Date.now(),
            ...(payload.data || {})
        },
        vibrate: payload.vibrate || [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(payload.title || 'Pump It Up Hub', notifOptions)
    );
});

/**
 * Manejador de Clic en la Notificación
 * Enfoca la pestaña activa de la app o abre la URL correspondiente
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = (event.notification.data && event.notification.data.url) 
        ? event.notification.data.url 
        : '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Si ya hay una pestaña abierta de nuestro origen, enfocarla y navegar
            for (let client of windowClients) {
                if ('focus' in client) {
                    if (targetUrl && targetUrl !== '/') {
                        client.navigate(targetUrl);
                    }
                    return client.focus();
                }
            }
            // Si no hay pestañas abiertas, abrir una nueva ventana
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
