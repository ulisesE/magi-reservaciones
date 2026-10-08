// js/core/pwaManager.js
// Gestor de Instalación PWA (Progressive Web App) — RevelVO Play (v1.9.7)
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.listeners = [];
        this.init();
    }

    init() {
        if (typeof window === 'undefined') return;

        // Limpiar flags obsoletos de localStorage que causaban falsos positivos en navegadores normales
        try {
            localStorage.removeItem('piu_pwa_installed_v1');
        } catch (e) {}

        // 1. Detectar si corre en modo standalone real (PWA instalada)
        if (this.isStandaloneMode()) {
            console.log("📱 [PWA] Ejecutándose en modo Standalone nativo (App Instalada).");
        }

        // 2. Escuchar evento nativo beforeinstallprompt (Chromium, Android Chrome, Edge, etc.)
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevenir banner nativo automático para controlarlo con nuestra UI arcade
            e.preventDefault();
            this.deferredPrompt = e;
            console.log("📲 [PWA] Evento beforeinstallprompt capturado con éxito. Listo para instalación inmediata.");
            this.notify();
        });

        // 3. Escuchar confirmación de instalación completada
        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            console.log("🎉 [PWA] Aplicación instalada exitosamente en el dispositivo.");
            toast.success("¡RevelVO Play instalado exitosamente en tu dispositivo! 🕹️");
            this.notify();
        });
    }

    /**
     * Detecta si la ventana actual se está ejecutando como aplicación independiente (PWA instalada)
     */
    isStandaloneMode() {
        if (typeof window === 'undefined') return false;
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.navigator.standalone === true ||
            document.referrer.includes('android-app://')
        );
    }

    /**
     * Retorna si la aplicación está instalada / ejecutándose en standalone
     */
    isAppInstalled() {
        return this.isStandaloneMode();
    }

    /**
     * Retorna si la aplicación puede ser instalada desde el entorno actual
     */
    canInstall() {
        return !this.isStandaloneMode();
    }

    /**
     * Detecta si el dispositivo es un iPhone, iPad o iPod
     */
    isIos() {
        if (typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || '';
        return /iPhone|iPad|iPod/i.test(ua) && !window.MSStream;
    }

    /**
     * Detecta si el dispositivo corre Android
     */
    isAndroid() {
        if (typeof navigator === 'undefined') return false;
        return /Android/i.test(navigator.userAgent || '');
    }

    /**
     * Detecta si la página se abrió dentro del navegador interno de una app (WhatsApp, Facebook, Instagram, TikTok)
     */
    isInAppBrowser() {
        if (typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || navigator.vendor || window.opera || '';
        return /FBAN|FBAV|Instagram|WhatsApp|Line|Twitter|Snapchat|BytedanceWebview/i.test(ua);
    }

    /**
     * Dispara el flujo de instalación nativo o modal de ayuda ilustrado según la plataforma
     */
    async promptInstall() {
        // Si ya está en modo standalone, mostrar modal informativo
        if (this.isStandaloneMode()) {
            this.showAlreadyInstalledModal();
            return;
        }

        // Si el navegador capturó el evento beforeinstallprompt nativo
        if (this.deferredPrompt) {
            try {
                this.deferredPrompt.prompt();
                const choiceResult = await this.deferredPrompt.userChoice;
                if (choiceResult.outcome === 'accepted') {
                    console.log("✅ [PWA] El usuario aceptó la instalación.");
                    toast.success("¡Instalando RevelVO Play! En unos segundos aparecerá en tu dispositivo. 🕹️");
                } else {
                    console.log("ℹ️ [PWA] El usuario canceló la instalación.");
                    toast.info("Instalación cancelada. Puedes volver a intentarlo cuando desees.");
                }
                this.deferredPrompt = null;
                this.notify();
                return;
            } catch (err) {
                console.warn("[PWA] Error durante el prompt nativo de instalación:", err);
            }
        }

        // Flujos ilustrados si no hay prompt nativo disponible de inmediato
        if (this.isIos()) {
            this.showIosInstructionsModal();
            return;
        }

        if (this.isAndroid()) {
            this.showAndroidInstructionsModal();
            return;
        }

        // Escritorio (PC / Mac / Linux)
        this.showDesktopInstructionsModal();
    }

    /**
     * Modal interactivo ilustrado para Android (Chrome, Samsung Internet, Webviews)
     */
    showAndroidInstructionsModal() {
        const inApp = this.isInAppBrowser();
        const contentHtml = `
            <div style="display:flex; flex-direction:column; gap:16px; padding:6px 2px;">
                <div style="text-align:center;">
                    <div style="font-size:3rem; margin-bottom:6px;">🤖</div>
                    <h3 style="color:#ffffff; margin:0 0 6px 0; font-family:var(--font-heading); font-size:1.25rem;">Instalar en tu Android</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">Disfruta de RevelVO Play como una App rápida, a pantalla completa y con acceso directo.</p>
                </div>

                ${inApp ? `
                    <div style="background:rgba(255, 187, 0, 0.12); border:1px solid var(--color-neon-gold); border-radius:8px; padding:12px; display:flex; align-items:flex-start; gap:10px;">
                        <span style="font-size:1.3rem;">⚠️</span>
                        <div style="font-size:0.8rem; color:#fff; line-height:1.4;">
                            <strong>Estás dentro del navegador de una red social</strong> (WhatsApp / Instagram / Facebook).<br>
                            Toca los tres puntos <strong>(⋮)</strong> en la esquina superior y selecciona <strong style="color:var(--color-neon-gold);">"Abrir en Chrome"</strong> para habilitar la instalación.
                        </div>
                    </div>
                ` : ''}

                <div style="background:var(--bg-dark-900); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:14px;">
                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <span style="background:var(--bg-dark-700); border:1px solid var(--color-neon-cyan); color:var(--color-neon-cyan); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem; flex-shrink:0;">1</span>
                        <div>
                            <strong style="color:#ffffff; font-size:0.9rem; display:block;">Toca el menú del navegador (⋮)</strong>
                            <small style="color:var(--text-muted); font-size:0.8rem;">En Google Chrome o Samsung Internet, toca los 3 puntos verticales en la esquina superior derecha.</small>
                        </div>
                    </div>

                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <span style="background:var(--bg-dark-700); border:1px solid var(--color-neon-lime); color:var(--color-neon-lime); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem; flex-shrink:0;">2</span>
                        <div>
                            <strong style="color:#ffffff; font-size:0.9rem; display:block;">Selecciona "Instalar aplicación"</strong>
                            <small style="color:var(--text-muted); font-size:0.8rem;">Busca en la lista la opción <strong style="color:var(--color-neon-lime);">📲 Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.</small>
                        </div>
                    </div>

                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <span style="background:var(--bg-dark-700); border:1px solid var(--color-neon-gold); color:var(--color-neon-gold); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem; flex-shrink:0;">3</span>
                        <div>
                            <strong style="color:#ffffff; font-size:0.9rem; display:block;">Confirma en "Instalar"</strong>
                            <small style="color:var(--text-muted); font-size:0.8rem;">Toca "Instalar" y el icono oficial aparecerá en tu menú de apps listo para jugar.</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.open({
            title: 'Instalación PWA en Android',
            icon: '🤖',
            contentHtml,
            footerHtml: `<button type="button" class="btn btn-primary glow-cyan" onclick="window.__closeCurrentModal ? window.__closeCurrentModal() : document.querySelector('.modal-backdrop')?.remove()">¡Entendido!</button>`,
            maxWidth: '460px'
        });
    }

    /**
     * Modal interactivo ilustrado para computadoras (Windows / Mac / Chrome / Edge)
     */
    showDesktopInstructionsModal() {
        const contentHtml = `
            <div style="display:flex; flex-direction:column; gap:16px; padding:6px 2px;">
                <div style="text-align:center;">
                    <div style="font-size:3rem; margin-bottom:6px;">💻</div>
                    <h3 style="color:#ffffff; margin:0 0 6px 0; font-family:var(--font-heading); font-size:1.25rem;">Instalar en Computadora (PC / Mac)</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">Ejecuta el sistema en ventana propia de alto rendimiento con acceso directo en tu escritorio.</p>
                </div>

                <div style="background:var(--bg-dark-900); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:14px;">
                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <span style="background:var(--bg-dark-700); border:1px solid var(--color-neon-cyan); color:var(--color-neon-cyan); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem; flex-shrink:0;">1</span>
                        <div>
                            <strong style="color:#ffffff; font-size:0.9rem; display:block;">Ubica el icono en la barra de direcciones</strong>
                            <small style="color:var(--text-muted); font-size:0.8rem;">En Google Chrome o Microsoft Edge, busca el icono <strong style="color:var(--color-neon-cyan);">🖥️ ⊕ (Instalar App)</strong> a la derecha de la barra de URLs (junto a la estrella).</small>
                        </div>
                    </div>

                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <span style="background:var(--bg-dark-700); border:1px solid var(--color-neon-lime); color:var(--color-neon-lime); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem; flex-shrink:0;">2</span>
                        <div>
                            <strong style="color:#ffffff; font-size:0.9rem; display:block;">O usa el menú del navegador (⋮)</strong>
                            <small style="color:var(--text-muted); font-size:0.8rem;">Haz clic en los tres puntos (⋮) de la esquina superior derecha > <strong>Guardar y compartir</strong> > <strong style="color:var(--color-neon-lime);">Instalar RevelVO Play...</strong></small>
                        </div>
                    </div>

                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <span style="background:var(--bg-dark-700); border:1px solid var(--color-neon-gold); color:var(--color-neon-gold); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem; flex-shrink:0;">3</span>
                        <div>
                            <strong style="color:#ffffff; font-size:0.9rem; display:block;">Confirma en "Instalar"</strong>
                            <small style="color:var(--text-muted); font-size:0.8rem;">Se creará un acceso directo en tu Escritorio para abrir la app al instante a pantalla completa.</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.open({
            title: 'Instalación PWA en Computadora',
            icon: '💻',
            contentHtml,
            footerHtml: `<button type="button" class="btn btn-primary glow-cyan" onclick="window.__closeCurrentModal ? window.__closeCurrentModal() : document.querySelector('.modal-backdrop')?.remove()">¡Entendido!</button>`,
            maxWidth: '460px'
        });
    }

    /**
     * Despliega modal con pasos para agregar a inicio en iPhone/iPad
     */
    showIosInstructionsModal() {
        const contentHtml = `
            <div style="display:flex; flex-direction:column; gap:16px; padding:6px 2px;">
                <div style="text-align:center;">
                    <div style="font-size:3rem; margin-bottom:6px;">📲</div>
                    <h3 style="color:#ffffff; margin:0 0 6px 0; font-family:var(--font-heading); font-size:1.25rem;">Instalar en tu iPhone o iPad</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">Disfruta de RevelVO Play en pantalla completa sin barra de navegación.</p>
                </div>

                <div style="background:var(--bg-dark-900); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:14px;">
                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <span style="background:var(--bg-dark-700); border:1px solid var(--color-neon-cyan); color:var(--color-neon-cyan); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem; flex-shrink:0;">1</span>
                        <div>
                            <strong style="color:#ffffff; font-size:0.9rem; display:block;">Pulsa el botón "Compartir" en Safari</strong>
                            <small style="color:var(--text-muted); font-size:0.8rem;">Ubica el icono de compartir <span style="font-size:1.1rem; color:var(--color-neon-cyan);">⎋</span> (un cuadrado con una flecha hacia arriba) en la barra inferior de Safari.</small>
                        </div>
                    </div>

                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <span style="background:var(--bg-dark-700); border:1px solid var(--color-neon-lime); color:var(--color-neon-lime); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem; flex-shrink:0;">2</span>
                        <div>
                            <strong style="color:#ffffff; font-size:0.9rem; display:block;">Selecciona "Agregar a inicio"</strong>
                            <small style="color:var(--text-muted); font-size:0.8rem;">Desplázate hacia abajo en la lista de opciones y pulsa <strong style="color:var(--color-neon-lime);">➕ Agregar a inicio</strong> (o Add to Home Screen).</small>
                        </div>
                    </div>

                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <span style="background:var(--bg-dark-700); border:1px solid var(--color-neon-gold); color:var(--color-neon-gold); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem; flex-shrink:0;">3</span>
                        <div>
                            <strong style="color:#ffffff; font-size:0.9rem; display:block;">Confirma en "Agregar"</strong>
                            <small style="color:var(--text-muted); font-size:0.8rem;">Pulsa el botón "Agregar" en la esquina superior derecha para crear el acceso directo en tu pantalla de inicio.</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.open({
            title: 'Instalación PWA en iOS',
            icon: '🍏',
            contentHtml,
            footerHtml: `<button type="button" class="btn btn-primary glow-cyan" onclick="window.__closeCurrentModal ? window.__closeCurrentModal() : document.querySelector('.modal-backdrop')?.remove()">¡Entendido!</button>`,
            maxWidth: '440px'
        });
    }

    /**
     * Modal informativo cuando el usuario ya tiene la app abierta en modo standalone
     */
    showAlreadyInstalledModal(business) {
        const cleanName = business?.name || 'RevelVO Play';
        const contentHtml = `
            <div style="display:flex; flex-direction:column; gap:16px; padding:6px 2px; text-align:center;">
                <div style="font-size:3rem; margin-bottom:4px;">🕹️</div>
                <h3 style="color:#ffffff; margin:0 0 6px 0; font-family:var(--font-heading); font-size:1.2rem;">¡Ya estás ejecutando la App!</h3>
                <p style="color:var(--text-muted); font-size:0.88rem; margin:0;">
                    Actualmente tienes abierta esta aplicación en modo nativo <strong>Standalone</strong> en tu dispositivo.
                </p>
                <div style="background:var(--bg-dark-900); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:14px; text-align:left; font-size:0.82rem; color:var(--text-muted); display:flex; flex-direction:column; gap:8px;">
                    <div>✅ <strong>Instalada:</strong> Está fijada como app en tu pantalla de inicio o menú de aplicaciones.</div>
                    <div>✅ <strong>Modo Offline activado:</strong> Tus pases y códigos QR se guardan en el dispositivo.</div>
                    <div>✅ <strong>Actualizaciones automáticas:</strong> Recibirás las nuevas funciones automáticamente sin reinstalar.</div>
                </div>
            </div>
        `;
        modal.open({
            title: 'App Instalada',
            icon: '✨',
            contentHtml,
            footerHtml: `<button type="button" class="btn btn-primary glow-cyan" onclick="window.__closeCurrentModal ? window.__closeCurrentModal() : document.querySelector('.modal-backdrop')?.remove()">¡Excelente!</button>`,
            maxWidth: '420px'
        });
    }

    /**
     * Actualiza metadatos y asegura que el Web App Manifest se mantenga como archivo estático HTTP
     * NOTA CRÍTICA: Chromium / Android prohíbe terminantemente URLs tipo "blob:" para manifests.
     * Mantener siempre link[rel="manifest"] apuntando a "manifest.json".
     */
    updateDynamicManifest(business) {
        if (typeof window === 'undefined' || !business) return;

        try {
            let manifestEl = document.querySelector('link[rel="manifest"]');
            if (!manifestEl) {
                manifestEl = document.createElement('link');
                manifestEl.rel = 'manifest';
                manifestEl.href = '/manifest.json';
                document.head.appendChild(manifestEl);
            } else if (manifestEl.getAttribute('href') !== '/manifest.json' && manifestEl.getAttribute('href') !== 'manifest.json') {
                // Si existía un blob anterior, revocarlo y restablecer a /manifest.json
                if (this.currentManifestBlobUrl) {
                    URL.revokeObjectURL(this.currentManifestBlobUrl);
                    this.currentManifestBlobUrl = null;
                }
                manifestEl.setAttribute('href', '/manifest.json');
            }

            const cleanBizName = business.name || 'RevelVO Play';
            const shortBizName = cleanBizName.length > 14 ? cleanBizName.substring(0, 14) : cleanBizName;

            // Actualizar título del documento y meta tags de Apple / Web App
            document.title = `${cleanBizName} • RevelVO Play`;

            let appleTitleEl = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (appleTitleEl) {
                appleTitleEl.setAttribute('content', shortBizName);
            }

            let appNameEl = document.querySelector('meta[name="application-name"]');
            if (appNameEl) {
                appNameEl.setAttribute('content', shortBizName);
            }
        } catch (e) {
            console.warn("[PWA] Error en updateDynamicManifest:", e);
        }
    }

    /**
     * Retorna la URL directa de descarga e instalación para una sucursal específica
     */
    getInstallShareUrl(businessId) {
        if (typeof window === 'undefined') return '';
        const base = window.location.origin + window.location.pathname;
        return `${base}?local=${businessId || ''}`;
    }

    subscribe(callback) {
        this.listeners.push(callback);
        // Notificar inmediatamente el estado actual
        callback(this.canInstall(), this.isAppInstalled());
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notify() {
        const canInst = this.canInstall();
        const isInst = this.isAppInstalled();
        this.listeners.forEach(cb => {
            try {
                cb(canInst, isInst);
            } catch (e) {
                console.warn("[PWA] Error en listener:", e);
            }
        });
    }
}

export const pwaManager = new PWAManager();


