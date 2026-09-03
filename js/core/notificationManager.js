// js/core/notificationManager.js
// Gestor Centralizado de Notificaciones del Navegador y Comunicación con Service Worker (v1.9.0)
import { isFirebaseAvailable, db, COLLECTIONS, collection, query, where, onSnapshot } from '../firebaseConfig.js';
import { toast } from '../components/toast.js';

class NotificationManager {
    constructor() {
        this.swRegistration = null;
        this.isInitialized = false;
        this.realtimeUnsubscribers = [];
        this.knownChallengeIds = new Set();
        this.knownReservationIds = new Set();
        this.hasInitializedSnapshot = false;
    }

    /**
     * Inicializa el Service Worker y valida compatibilidad en el navegador.
     */
    async init() {
        if (!this.isSupported()) {
            console.log("ℹ️ Las notificaciones del navegador o Service Workers no son soportados en este entorno.");
            return false;
        }

        try {
            this.swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            console.log("🔔 Service Worker de Notificaciones registrado con éxito. Scope:", this.swRegistration.scope);
            this.isInitialized = true;

            // Escuchar cambios de controlador
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log("🔔 Nuevo Service Worker tomó el control de la página.");
            });

            return true;
        } catch (err) {
            console.warn("No se pudo registrar el Service Worker de notificaciones:", err);
            return false;
        }
    }

    /**
     * Verifica si el navegador soporta Notificaciones y Service Workers.
     */
    isSupported() {
        return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
    }

    /**
     * Retorna el estado actual de los permisos ('default', 'granted', 'denied').
     */
    getPermissionStatus() {
        if (!this.isSupported()) return 'unsupported';
        return Notification.permission;
    }

    /**
     * Solicita permiso al usuario para mostrar notificaciones flotantes en su dispositivo.
     */
    async requestPermission() {
        if (!this.isSupported()) {
            toast.warning("Tu navegador no soporta notificaciones de escritorio.");
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                toast.success("🔔 ¡Notificaciones activadas! Recibirás alertas de retas y reservaciones.");
                // Enviar notificación de bienvenida
                await this.sendNotification({
                    title: '🎮 Pump It Up Hub',
                    body: '¡Notificaciones activadas con éxito! Te avisaremos cuando recibas retos o tus reservas sean confirmadas.',
                    tag: 'welcome-notification'
                });
                return true;
            } else if (permission === 'denied') {
                toast.error("Permiso de notificaciones denegado en el navegador.");
                return false;
            }
            return false;
        } catch (e) {
            console.warn("Error solicitando permisos:", e);
            return false;
        }
    }

    /**
     * MÉTODO GENÉRICO PRINCIPAL
     * Envía una petición al Service Worker intermediario para desplegar cualquier tipo de notificación.
     */
    async sendNotification({
        title = 'Pump It Up Hub',
        body = '',
        icon = 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f579.png',
        badge = 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f579.png',
        tag = `piu-${Date.now()}`,
        url = '/',
        data = {},
        vibrate = [200, 100, 200, 100, 200],
        actions = [],
        silent = false,
        requireInteraction = false
    } = {}) {
        if (this.getPermissionStatus() !== 'granted') {
            console.log(`[NotificationManager] Notificación suprimida (permiso: ${this.getPermissionStatus()}): ${title}`);
            return false;
        }

        const payload = {
            type: 'SHOW_NOTIFICATION',
            title,
            body,
            icon,
            badge,
            tag,
            url,
            data,
            vibrate,
            actions,
            silent,
            requireInteraction
        };

        // 1. Vía Service Worker postMessage (Intermediario Activo)
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage(payload);
            return true;
        }

        // 2. Vía Service Worker Registration directo
        if (this.swRegistration && this.swRegistration.showNotification) {
            try {
                await this.swRegistration.showNotification(title, {
                    body,
                    icon,
                    badge,
                    tag,
                    data: { url, ...data },
                    vibrate,
                    actions
                });
                return true;
            } catch (e) {
                console.warn("Error en swRegistration.showNotification, intentando fallback:", e);
            }
        }

        // 3. Fallback a Notification API tradicional
        try {
            const notif = new Notification(title, {
                body,
                icon,
                tag,
                data: { url, ...data }
            });
            notif.onclick = () => {
                window.focus();
                if (url && url !== '/') {
                    window.location.href = url;
                }
                notif.close();
            };
            return true;
        } catch (err) {
            console.warn("Error mostrando notificación nativa:", err);
            return false;
        }
    }

    // =========================================================================
    // HELPERS CONVENIENTES PARA MÓDULOS DE LA APLICACIÓN
    // =========================================================================

    /**
     * Alerta de Reto PVP Recibido
     */
    async notifyChallengeReceived({ challengerName, league = 'Liga C', date, startTime, businessName, challengeId }) {
        return this.sendNotification({
            title: `⚔️ ¡Nuevo Reto de ${challengerName}!`,
            body: `@${challengerName} (${league}) te ha desafiado a una reta para el ${date} a las ${startTime} en ${businessName || 'la Sala'}. ¡Entra a responder!`,
            tag: `challenge-received-${challengeId}`,
            url: `/?view=VERSUS&challenge=${challengeId}`,
            requireInteraction: true
        });
    }

    /**
     * Alerta de Reto Aceptado
     */
    async notifyChallengeAccepted({ opponentName, date, startTime, businessName, challengeId }) {
        return this.sendNotification({
            title: `🟢 ¡Reto Aceptado con ${opponentName}!`,
            body: `El encuentro ha sido confirmado para el ${date} a las ${startTime} en ${businessName}. La reservación ya está agendada.`,
            tag: `challenge-accepted-${challengeId}`,
            url: `/?view=VERSUS&challenge=${challengeId}`
        });
    }

    /**
     * Alerta de Estado de Reservación (Aprobada / Modificada)
     */
    async notifyBookingStatus({ status, date, startTime, machineName, businessName, reservationId }) {
        const isApproved = status === 'CONFIRMED';
        const isCancelled = status === 'CANCELLED';
        const isRejected = status === 'REJECTED';

        let title = '🎟️ Actualización de Reservación';
        if (isApproved) title = '✔️ ¡Reservación Aprobada!';
        if (isCancelled) title = '❌ Reservación Cancelada';
        if (isRejected) title = '⚠️ Reservación No Aprobada';

        const body = `Tu turno para ${machineName || 'la máquina'} el ${date} (${startTime}) en ${businessName || 'la sucursal'} se encuentra ${status}.`;

        return this.sendNotification({
            title,
            body,
            tag: `booking-status-${reservationId}`,
            url: `/?view=MY_PROFILE&res=${reservationId}`
        });
    }

    /**
     * Alerta Genérica Personalizada
     */
    async notifyCustom({ title, body, url = '/', tag = `custom-${Date.now()}` }) {
        return this.sendNotification({ title, body, url, tag });
    }

    /**
     * Escuchador reactivo en tiempo real para disparar notificaciones al usuario activo
     */
    setupRealtimeListeners(currentUser) {
        // Limpiar escuchadores anteriores
        this.realtimeUnsubscribers.forEach(unsub => unsub());
        this.realtimeUnsubscribers = [];

        if (!currentUser || !currentUser.id || !isFirebaseAvailable || !db) return;

        try {
            // 1. Escuchar retos entrantes
            const qChallenges = query(
                collection(db, COLLECTIONS.CHALLENGES),
                where("opponent.id", "==", currentUser.id)
            );

            const unsubChallenges = onSnapshot(qChallenges, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const chal = { id: change.doc.id, ...change.doc.data() };
                    
                    if (change.type === 'added') {
                        if (this.hasInitializedSnapshot && !this.knownChallengeIds.has(chal.id)) {
                            if (chal.status === 'PENDING' && chal.turn === currentUser.id) {
                                this.notifyChallengeReceived({
                                    challengerName: chal.challenger.name,
                                    league: chal.challenger.league,
                                    date: chal.schedule.date,
                                    startTime: chal.schedule.startTime,
                                    businessName: chal.location.businessName || chal.location.externalName,
                                    challengeId: chal.id
                                });
                            }
                        }
                        this.knownChallengeIds.add(chal.id);
                    } else if (change.type === 'modified') {
                        if (chal.status === 'COUNTER_OFFERED' && chal.turn === currentUser.id) {
                            this.sendNotification({
                                title: `🔄 Contrapropuesta de ${chal.challenger.name}`,
                                body: `Ha propuesto un nuevo horario: ${chal.schedule.date} a las ${chal.schedule.startTime} en ${chal.location.businessName || chal.location.externalName}.`,
                                tag: `challenge-counter-${chal.id}`,
                                url: `/?view=VERSUS&challenge=${chal.id}`
                            });
                        }
                    }
                });
            });

            this.realtimeUnsubscribers.push(unsubChallenges);

            // 2. Escuchar reservaciones
            const qReservations = query(
                collection(db, COLLECTIONS.RESERVATIONS),
                where("clientId", "==", currentUser.id)
            );

            const unsubReservations = onSnapshot(qReservations, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const res = { id: change.doc.id, ...change.doc.data() };
                    if (change.type === 'added') {
                        this.knownReservationIds.add(res.id);
                    } else if (change.type === 'modified') {
                        if (this.hasInitializedSnapshot) {
                            this.notifyBookingStatus({
                                status: res.status,
                                date: res.date,
                                startTime: res.startTime,
                                machineName: res.machineName,
                                businessName: res.businessName,
                                reservationId: res.id
                            });
                        }
                    }
                });
            });

            this.realtimeUnsubscribers.push(unsubReservations);

            // Marcar snapshot inicial para no disparar notificaciones de eventos viejos
            setTimeout(() => {
                this.hasInitializedSnapshot = true;
            }, 3000);

        } catch (err) {
            console.warn("Error configurando escuchadores en tiempo real de notificaciones:", err);
        }
    }
}

export const notificationManager = new NotificationManager();
