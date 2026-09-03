// sw.js
// Service Worker Intermediario para Notificaciones del Navegador — Pump It Up Hub (v1.9.0)
const CACHE_NAME = 'piu-notifications-sw-v1';

// Instalación inmediata del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker de Notificaciones instalado.');
    self.skipWaiting();
});

// Activación y control inmediato de clientes
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker de Notificaciones activado.');
    event.waitUntil(self.clients.claim());
});

/**
 * Receptor Genérico de Mensajes desde la Aplicación Principal
 * Escucha eventos postMessage tipo 'SHOW_NOTIFICATION' y despliega la notificación nativa
 */
self.addEventListener('message', (event) => {
    if (!event.data) return;

    const { type, title, body, icon, badge, tag, data, url, vibrate, actions, silent, requireInteraction } = event.data;

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
