// js/core/pwaManager.js
// Gestor de Instalación PWA (Progressive Web App) — Pump It Up Hub (v1.7.5)
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.listeners = [];
        this.init();
    }

    init() {
        if (typeof window === 'undefined') return;

        // 1. Detectar si ya corre como Standalone / App instalada
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
            || window.navigator.standalone === true 
            || document.referrer.includes('android-app://')
            || window.location.search.includes('source=pwa')
            || window.location.search.includes('utm_source=pwa')
            || localStorage.getItem('piu_pwa_installed_v1') === 'true';

        if (isStandalone) {
            this.isInstalled = true;
            try {
                localStorage.setItem('piu_pwa_installed_v1', 'true');
            } catch (e) {}
            console.log("📱 [PWA] Ejecutándose en modo Standalone (App Instalada).");
        }

        // 2. Escuchar evento nativo beforeinstallprompt (Chromium, Android, Edge, etc.)
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevenir banner nativo automático para controlarlo con nuestra UI arcade
            e.preventDefault();
            this.deferredPrompt = e;
            console.log("📲 [PWA] Evento beforeinstallprompt capturado. Listo para instalación.");
            this.notify();
        });

        // 3. Escuchar confirmación de instalación completada
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.deferredPrompt = null;
            try {
                localStorage.setItem('piu_pwa_installed_v1', 'true');
            } catch (e) {}
            console.log("🎉 [PWA] Aplicación instalada exitosamente en el dispositivo.");
            toast.success("¡Pump It Up Hub instalado exitosamente en tu dispositivo! 🕹️");
            this.notify();
        });
    }

    /**
     * Retorna si la aplicación ya está instalada en el dispositivo
     */
    isAppInstalled() {
        if (typeof window === 'undefined') return false;
        if (this.isInstalled) return true;
        const installed = window.matchMedia('(display-mode: standalone)').matches 
            || window.navigator.standalone === true 
            || document.referrer.includes('android-app://')
            || window.location.search.includes('source=pwa')
            || window.location.search.includes('utm_source=pwa')
            || localStorage.getItem('piu_pwa_installed_v1') === 'true';
        if (installed) {
            this.isInstalled = true;
        }
        return !!installed;
    }

    /**
     * Retorna si la aplicación puede ser promovida para instalación
     */
    canInstall() {
        if (this.isAppInstalled()) return false;
        return !!this.deferredPrompt || this.isIos();
    }

    /**
     * Detecta si el dispositivo es un iPhone o iPad en Safari
     */
    isIos() {
        if (typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || '';
        return /iPhone|iPad|iPod/i.test(ua) && !window.MSStream;
    }

    /**
     * Dispara el flujo de instalación nativo o modal de ayuda en iOS
     */
    async promptInstall() {
        if (this.isInstalled) {
            toast.info("La aplicación ya está instalada y funcionando en tu dispositivo.");
            return;
        }

        // Flujo para navegadores con soporte de beforeinstallprompt
        if (this.deferredPrompt) {
            try {
                this.deferredPrompt.prompt();
                const choiceResult = await this.deferredPrompt.userChoice;
                if (choiceResult.outcome === 'accepted') {
                    console.log("✅ [PWA] El usuario aceptó la instalación.");
                } else {
                    console.log("ℹ️ [PWA] El usuario canceló la instalación.");
                }
                this.deferredPrompt = null;
                this.notify();
            } catch (err) {
                console.warn("[PWA] Error durante el prompt de instalación:", err);
            }
            return;
        }

        // Flujo educativo para iOS Safari
        if (this.isIos()) {
            this.showIosInstructionsModal();
            return;
        }

        // Fallback genérico para navegadores de escritorio que no disparan prompt inmediato
        toast.info("Para instalar: haz clic en el icono de instalación (🖥️ / ➕) en la barra de direcciones de tu navegador.");
    }

    /**
     * Despliega modal con pasos para agregar a inicio en iPhone/iPad
     */
    showIosInstructionsModal() {
        const contentHtml = `
            <div style="display:flex; flex-direction:column; gap:16px; padding:6px 2px;">
                <div style="text-align:center;">
                    <div style="font-size:3rem; margin-bottom:6px;">📲</div>
                    <h3 style="color:#ffffff; margin:0 0 6px 0; font-family:var(--font-heading);">Instalar en tu iPhone o iPad</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">Disfruta de Pump It Up Hub en pantalla completa sin barra de navegación.</p>
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
            footerHtml: `<button type="button" class="btn btn-primary glow-cyan" onclick="window.__closeCurrentModal ? window.__closeCurrentModal() : document.querySelector('.modal-container')?.remove()">¡Entendido!</button>`,
            maxWidth: '440px'
        });
    }

    /**
     * Actualiza dinámicamente el Web App Manifest y metadatos de iOS para la sucursal activa
     */
    updateDynamicManifest(business) {
        if (typeof window === 'undefined' || !business) return;

        try {
            let manifestEl = document.querySelector('link[rel="manifest"]');
            if (!manifestEl) {
                manifestEl = document.createElement('link');
                manifestEl.rel = 'manifest';
                document.head.appendChild(manifestEl);
            }

            const cleanBizName = business.name || 'PIU Hub';
            const shortBizName = cleanBizName.length > 12 ? cleanBizName.substring(0, 12) : cleanBizName;

            const dynamicManifest = {
                name: `${cleanBizName} • Pump It Up Hub`,
                short_name: shortBizName,
                description: `Sistema de reservaciones de maquinitas Pump It Up y retas Versus para ${cleanBizName} (${business.city || 'Arcade'}).`,
                id: `/?local=${business.id}`,
                start_url: `/?local=${business.id}&source=pwa`,
                scope: "/",
                display: "standalone",
                orientation: "portrait-primary",
                background_color: "#080a0f",
                theme_color: "#080a0f",
                lang: "es-MX",
                categories: ["entertainment", "games", "sports"],
                icons: [
                    {
                        src: "icons/icon-192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any"
                    },
                    {
                        src: "icons/icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any"
                    },
                    {
                        src: "icons/icon-maskable.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable"
                    },
                    {
                        src: "icons/icon.svg",
                        sizes: "512x512",
                        type: "image/svg+xml",
                        purpose: "any"
                    }
                ]
            };

            const manifestBlob = new Blob([JSON.stringify(dynamicManifest, null, 2)], { type: 'application/json' });
            if (this.currentManifestBlobUrl) {
                URL.revokeObjectURL(this.currentManifestBlobUrl);
            }
            this.currentManifestBlobUrl = URL.createObjectURL(manifestBlob);
            manifestEl.setAttribute('href', this.currentManifestBlobUrl);

            // Actualizar meta tags para dispositivos Apple iOS
            let appleTitleEl = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (appleTitleEl) {
                appleTitleEl.setAttribute('content', shortBizName);
            }
        } catch (e) {
            console.warn("[PWA] Error actualizando manifest dinámico:", e);
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

