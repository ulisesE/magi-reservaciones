// js/core/updateManager.js
// Gestor Centralizado de Actualizaciones Forzadas y Control de Versión PWA — Pump It Up Hub (v1.7.4)
import { toast } from '../components/toast.js';

export const CURRENT_APP_VERSION = '1.7.4';

class UpdateManager {
    constructor() {
        this.currentVersion = CURRENT_APP_VERSION;
        this.swRegistration = null;
        this.pendingUpdate = null;
        this.isReloading = false;
        this.countdownInterval = null;
        this.countdownSeconds = 8;
        this.bannerEl = null;
        this.isChecking = false;
    }

    /**
     * Inicializa los listeners y el monitoreo continuo de nuevas versiones
     */
    init() {
        if (typeof window === 'undefined') return;

        // Guardar versión actual en almacenamiento local
        try {
            localStorage.setItem('piu_current_version', this.currentVersion);
        } catch (e) {
            console.warn('[UpdateManager] LocalStorage no disponible:', e);
        }

        // 1. Escuchar mensajes provenientes del Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (!event.data) return;
                if (event.data.type === 'SW_ACTIVATED') {
                    console.log('🔄 [UpdateManager] Nuevo Service Worker activado en background:', event.data.cacheName);
                }
            });

            // 2. Escuchar cuando un nuevo Service Worker toma el control (controllerchange)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('⚡ [UpdateManager] controllerchange detectado.');
                if (!this.isReloading && sessionStorage.getItem('piu_pending_reload')) {
                    sessionStorage.removeItem('piu_pending_reload');
                    this.isReloading = true;
                    window.location.reload();
                }
            });
        }

        // 3. Chequeo automático al ganar foco o volver a la pestaña (Mobile/Desktop)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                setTimeout(() => this.checkForUpdates(false), 2000);
            }
        });

        // 4. Chequeo al recuperar conexión a Internet
        window.addEventListener('online', () => {
            setTimeout(() => this.checkForUpdates(false), 1500);
        });

        // 5. Chequeo periódico continuo cada 15 minutos
        setInterval(() => {
            this.checkForUpdates(false);
        }, 15 * 60 * 1000);

        // 6. Primer chequeo suave 3 segundos después del inicio de la aplicación
        setTimeout(() => {
            this.checkForUpdates(false);
        }, 3500);

        // Exponer helpers en window para soporte y pruebas rápidas en consola
        window.piuUpdateManager = this;
        window.piuForceUpdate = () => this.forceCleanReload();
    }

    /**
     * Vincula la instancia activa del Service Worker para monitorear eventos de ciclo de vida
     */
    bindServiceWorker(registration) {
        if (!registration) return;
        this.swRegistration = registration;

        // Si ya hay un worker en espera de activación (waiting)
        if (registration.waiting) {
            console.log('📦 [UpdateManager] Se encontró un Service Worker esperando activación.');
            this.onWorkerWaitingFound(registration.waiting);
        }

        // Escuchar si se encuentra una actualización de Service Worker
        registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            console.log('📥 [UpdateManager] Descargando nueva versión del Service Worker...');

            installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('✨ [UpdateManager] Nueva versión instalada y lista para activarse.');
                    this.onWorkerWaitingFound(installingWorker);
                }
            });
        });
    }

    /**
     * Compara semánticamente dos cadenas de versión (ej. '1.7.5' vs '1.7.4')
     * Retorna 1 si v1 > v2, -1 si v1 < v2, y 0 si son iguales
     */
    compareVersions(v1, v2) {
        if (!v1 || !v2) return 0;
        const clean1 = v1.toString().replace(/^v/i, '').trim();
        const clean2 = v2.toString().replace(/^v/i, '').trim();

        const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
        const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

        const maxLength = Math.max(parts1.length, parts2.length);
        for (let i = 0; i < maxLength; i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }

    /**
     * Consulta el servidor para verificar si existe una nueva versión
     * @param {boolean} isManual Indica si la petición fue provocada por clic del usuario
     */
    async checkForUpdates(isManual = false) {
        if (this.isChecking) return;
        this.isChecking = true;

        if (isManual) {
            toast.info("🔍 Buscando actualizaciones en el servidor...", 2000);
        }

        try {
            // 1. Forzar chequeo en el Service Worker si está registrado
            if (this.swRegistration) {
                try {
                    await this.swRegistration.update();
                } catch (swErr) {
                    console.warn('[UpdateManager] Error al chequear registro de SW:', swErr);
                }
            }

            // 2. Fetch directo al manifiesto estático version.json evitando cualquier caché
            const response = await fetch(`/version.json?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const serverVersion = data.version;
            const isNewer = this.compareVersions(serverVersion, this.currentVersion) > 0;

            console.log(`[UpdateManager] Versión local: v${this.currentVersion} | Servidor: v${serverVersion}`);

            if (isNewer) {
                this.pendingUpdate = data;
                this.showUpdateBanner(data);
            } else if (this.swRegistration && this.swRegistration.waiting) {
                // Hay un SW listo aunque el version.json reporte igual (ej. hotfix de assets)
                this.showUpdateBanner({
                    version: this.currentVersion + ' (Parche)',
                    releaseNotes: 'Optimizaciones de recursos y mejoras de rendimiento.',
                    forceUpdate: false
                });
            } else {
                if (isManual) {
                    toast.success(`✅ Tienes la versión más reciente (v${this.currentVersion}). Todo está al día.`);
                }
            }
        } catch (error) {
            console.warn('[UpdateManager] Error comprobando actualizaciones:', error);
            if (isManual) {
                toast.warning("No se pudo contactar al servidor de actualización. Verifica tu conexión.");
            }
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Manejador cuando un nuevo Service Worker entra en estado waiting
     */
    onWorkerWaitingFound(worker) {
        // Consultar el version.json para obtener los detalles de la nueva versión
        this.checkForUpdates(false);
    }

    /**
     * Despliega el banner arcade cyberpunk flotante notificando la actualización
     */
    showUpdateBanner(data) {
        if (this.bannerEl && document.body.contains(this.bannerEl)) {
            return; // Ya está visible
        }

        const isForce = data.forceUpdate === true;
        this.countdownSeconds = isForce ? 8 : null;

        const banner = document.createElement('div');
        banner.className = 'app-update-banner visible';
        banner.id = 'app-update-banner';

        banner.innerHTML = `
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="font-size:2rem; animation:pulse-glow 1.5s infinite alternate;">🚀</div>
                    <div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <strong style="color:#ffffff; font-size:1.05rem; font-family:var(--font-heading);">¡Nueva Versión Disponible!</strong>
                            <span class="badge badge-success" style="font-size:0.75rem; font-family:var(--font-mono);">v${data.version}</span>
                        </div>
                        <p style="color:var(--text-muted); font-size:0.82rem; margin:2px 0 0 0; line-height:1.35;">
                            ${data.releaseNotes || 'Mejoras de rendimiento, estabilidad y nuevas funciones.'}
                        </p>
                    </div>
                </div>
                ${!isForce ? `
                    <button type="button" class="btn-close-update" style="background:transparent; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:2px;" title="Cerrar">&times;</button>
                ` : ''}
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-top:4px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08);">
                <div id="update-timer-notice" style="font-size:0.8rem; color:${isForce ? 'var(--color-neon-lime)' : 'var(--text-muted)'}; display:flex; align-items:center; gap:6px;">
                    ${isForce ? `<span>⏱️ Actualización requerida en <strong id="update-countdown-text">8s</strong></span>` : `<span>Versión actual: v${this.currentVersion}</span>`}
                </div>
                <div style="display:flex; gap:8px;">
                    ${isForce ? `
                        <button type="button" id="btn-pause-update" class="btn btn-outline btn-sm" style="font-size:0.78rem; padding:4px 10px;">
                            ⏸️ Pausar 1 min
                        </button>
                    ` : `
                        <button type="button" id="btn-dismiss-update" class="btn btn-outline btn-sm" style="font-size:0.78rem; padding:4px 10px;">
                            Recordar luego
                        </button>
                    `}
                    <button type="button" id="btn-apply-update-now" class="btn btn-primary btn-sm glow-lime" style="font-size:0.82rem; padding:6px 14px; font-weight:700;">
                        ⚡ Actualizar Ahora
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);
        this.bannerEl = banner;

        // Listeners de botones
        const btnApply = banner.querySelector('#btn-apply-update-now');
        btnApply?.addEventListener('click', () => this.applyUpdate());

        const btnClose = banner.querySelector('.btn-close-update');
        btnClose?.addEventListener('click', () => this.dismissBanner());

        const btnDismiss = banner.querySelector('#btn-dismiss-update');
        btnDismiss?.addEventListener('click', () => this.dismissBanner());

        const btnPause = banner.querySelector('#btn-pause-update');
        btnPause?.addEventListener('click', () => {
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
            const noticeEl = banner.querySelector('#update-timer-notice');
            if (noticeEl) {
                noticeEl.innerHTML = `<span style="color:var(--color-neon-cyan);">⏸️ Pausado. Puedes terminar tu tarea y pulsar Actualizar.</span>`;
            }
            if (btnPause) btnPause.style.display = 'none';
        });

        // Iniciar cuenta regresiva si es forzada
        if (isForce) {
            this.startCountdown();
        }
    }

    /**
     * Inicia la cuenta regresiva antes de recargar automáticamente
     */
    startCountdown() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        const countdownEl = document.getElementById('update-countdown-text');
        this.countdownInterval = setInterval(() => {
            this.countdownSeconds--;
            if (countdownEl) {
                countdownEl.textContent = `${this.countdownSeconds}s`;
            }

            if (this.countdownSeconds <= 0) {
                clearInterval(this.countdownInterval);
                this.applyUpdate();
            }
        }, 1000);
    }

    /**
     * Descarta el banner de actualización
     */
    dismissBanner() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        if (this.bannerEl) {
            this.bannerEl.classList.remove('visible');
            setTimeout(() => {
                this.bannerEl?.remove();
                this.bannerEl = null;
            }, 300);
        }
    }

    /**
     * Aplica la actualización de forma segura e infalible:
     * 1. Solicita skipWaiting al nuevo Service Worker
     * 2. Limpia todos los cachés viejos del navegador
     * 3. Recarga la página
     */
    async applyUpdate() {
        if (this.isReloading) return;
        this.isReloading = true;

        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        toast.info("🚀 Aplicando actualización y limpiando caché...", 2500);

        try {
            // 1. Enviar mensaje de activación inmediata (SKIP_WAITING) al SW en espera
            if (this.swRegistration && this.swRegistration.waiting) {
                this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
            }

            // 2. Limpiar todos los cachés almacenados en CacheStorage
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
                console.log('🧹 [UpdateManager] Todas las cachés locales han sido purgadas.');
            }

            // 3. Marcar recarga en sessionStorage para evitar loops
            sessionStorage.setItem('piu_pending_reload', 'true');
            if (this.pendingUpdate?.version) {
                localStorage.setItem('piu_current_version', this.pendingUpdate.version);
            }

            // 4. Pequeño delay visual para que el usuario perciba la acción
            setTimeout(() => {
                // Forzar recarga con bypass de caché en el navegador
                window.location.reload();
            }, 600);

        } catch (err) {
            console.error('[UpdateManager] Error aplicando actualización:', err);
            // Fallback directo a recarga
            window.location.reload();
        }
    }

    /**
     * Función de emergencia para el usuario o soporte técnico:
     * Elimina el registro del Service Worker, purga todas las cachés y fuerza recarga limpia
     */
    async forceCleanReload() {
        toast.info("⚡ Ejecutando purga total de caché y reinicio...", 3000);

        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let reg of registrations) {
                    await reg.unregister();
                }
            }

            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }

            localStorage.removeItem('piu_pending_reload');
            sessionStorage.clear();

            setTimeout(() => {
                const url = new URL(window.location.href);
                url.searchParams.set('_clearCache', Date.now().toString());
                window.location.href = url.toString();
            }, 700);
        } catch (e) {
            console.error('Error durante la purga forzada:', e);
            window.location.reload();
        }
    }
}

export const updateManager = new UpdateManager();
