// js/app.js
// Controlador Principal y Punto de Entrada de la Aplicación
import { tenantManager } from './core/tenantManager.js';
import { authManager } from './core/authManager.js';
import { catalogsManager } from './core/catalogsManager.js';
import { store } from './core/store.js';
import { themeManager } from './core/themeManager.js';
import { renderHeader } from './components/header.js';
import { renderLandingView } from './views/landingView.js';
import { renderBusinessHomeView } from './views/businessHomeView.js';
import { renderDayView } from './views/dayView.js';
import { renderWeekView } from './views/weekView.js';
import { renderMonthView } from './views/monthView.js';
import { renderMachinesView } from './views/machinesView.js';
import { renderRequestsView } from './views/requestsView.js';
import { renderClientsView } from './views/clientsView.js';
import { renderCatalogsManagementView } from './views/catalogsManagementView.js';
import { renderAccountsView } from './views/accountsView.js';
import { renderBusinessView } from './views/businessView.js';
import { renderSuperadminView } from './views/superadminView.js';
import { renderClientProfileView } from './views/clientProfileView.js';
import { renderTenantAnalyticsView } from './views/tenantAnalyticsView.js';
import { renderVersusView } from './views/versusView.js';
import { renderDownloadAppView } from './views/downloadAppView.js';
import { notificationManager } from './core/notificationManager.js';
import { pwaManager } from './core/pwaManager.js';
import { openChangelogModal } from './components/changelogModal.js';
import { updateManager } from './core/updateManager.js';
import { isFirebaseAvailable, isQuotaExhausted, canMakeFirestoreRead, onReadCountChange, getTotalSessionReads } from './firebaseConfig.js';
import './core/financialTests.js';

class App {
    constructor() {
        this.headerContainer = document.getElementById('header-container');
        this.mainContent = document.getElementById('main-content');
        
        // Listener global para abrir el Changelog desde el footer (botón o contenedor de estado)
        document.addEventListener('click', (e) => {
            const changelogTrigger = e.target.closest('#btn-open-changelog-footer, .btn-open-changelog-footer, #cloud-sync-status');
            if (changelogTrigger) {
                e.preventDefault();
                openChangelogModal();
            }
        });

        // Configurar estado de conexión a Firestore en el footer
        this.setupFooterNetworkStatus();
    }

    async init() {
        console.log("🎮 Inicializando Pump It Up Hub v1.9.0 (Versus & Notifications)...");

        // 1. Inicializar Gestor de Negocios (Zero-Read: Caché / Semillas)
        await tenantManager.init();

        // 2. Inicializar Autenticación y Roles (Zero-Read: Caché / Semillas)
        await authManager.init();

        // 2.5. Inicializar Service Worker de Notificaciones y Gestor de Actualizaciones
        await notificationManager.init();
        updateManager.init();

        // 3. Inicializar Catálogos Maestros (Zero-Read: Caché / Semillas)
        await catalogsManager.init();

        // 4. Inicializar Store (Solo lee Firestore si hay usuario logueado)
        await store.init();

        // Si ya hay usuario autenticado en sesión, activar listeners y mapas
        const currentUser = authManager.getCurrentUser();
        if (currentUser) {
            notificationManager.setupRealtimeListeners(currentUser);
            if (canMakeFirestoreRead()) {
                this.syncAuthenticatedSession(currentUser);
            }
        }

        // 4.5. Inicializar Gestor de Temas
        themeManager.init();

        // Los enlaces compartidos de una sucursal abren su página pública o la vista solicitada.
        const urlParams = new URLSearchParams(window.location.search);
        const hasBusinessInUrl = urlParams.has('local')
            || urlParams.has('business')
            || urlParams.has('sucursal')
            || window.location.pathname.includes('/local/');
        const viewFromUrl = urlParams.get('view')?.toUpperCase();

        if (viewFromUrl === 'DOWNLOAD' || viewFromUrl === 'INSTALL') {
            store.currentView = 'DOWNLOAD';
        } else if (viewFromUrl) {
            store.currentView = viewFromUrl;
        } else if (hasBusinessInUrl && tenantManager.isLocalSelected && store.currentView === 'DAY' && !authManager.isStaff()) {
            store.currentView = 'HOME';
        }

        if (authManager.isSuperAdmin() && store.currentView === 'DAY' && !tenantManager.isLocalSelected) {
            store.currentView = 'SUPERADMIN';
        }

        // Sincronizar Web App Manifest para la sucursal activa
        if (tenantManager.getActiveBusiness()) {
            pwaManager.updateDynamicManifest(tenantManager.getActiveBusiness());
        }

        // 5. Renderizar Header y Vista Activa
        this.render();

        // 6. Suscripciones para reactividad
        store.subscribe(() => this.render());
        tenantManager.subscribe(() => this.render());
        authManager.subscribe(async () => {
            const current = authManager.getCurrentUser();
            if (current) {
                notificationManager.setupRealtimeListeners(current);
                await store.loadBusinessData();
                this.syncAuthenticatedSession(current);
            } else {
                notificationManager.setupRealtimeListeners(null);
                store.detachAllListeners();
                tenantManager.detachListeners();
                await store.loadBusinessData();
            }
            this.updateSyncIndicator();
            this.render();
        });

        // 7. Actualizar indicador de conexión y escuchar lecturas en tiempo real
        onReadCountChange(() => this.updateSyncIndicator());
        this.updateSyncIndicator();
    }

    async syncAuthenticatedSession(user) {
        if (!user || !canMakeFirestoreRead()) return;
        try {
            if (user.role === 'SUPERADMIN' || user.role === 'MANAGER') {
                await authManager.loadStaffUsers();
                await tenantManager.syncFromFirestore();
            }
        } catch (e) {
            console.warn("Sincronización suave de sesión falló:", e);
        }
    }

    updateSyncIndicator() {
        if (this.syncStatusEl) {
            const reads = getTotalSessionReads();
            const readPill = reads > 0 ? ` • 📊 ${reads} doc${reads === 1 ? '' : 's'}` : '';

            if (isQuotaExhausted()) {
                this.syncStatusEl.innerHTML = `
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#FFB800; box-shadow: 0 0 8px #FFB800;"></span>
                    <span style="color:#FFB800; border-bottom: 1px dotted rgba(255,184,0,0.5); cursor:pointer;">Modo Local (Cuota Protegida 🛡️${readPill})</span>
                `;
            } else if (isFirebaseAvailable) {
                this.syncStatusEl.innerHTML = `
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#68F205; box-shadow: 0 0 8px #68F205;"></span>
                    <span style="color:var(--text-muted); border-bottom: 1px dotted rgba(255,255,255,0.3); cursor:pointer;">Conexión Segura (v1.9.0${readPill} • Novedades 📜)</span>
                `;
            } else {
                this.syncStatusEl.innerHTML = `
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#C3D91E; box-shadow: 0 0 8px #C3D91E;"></span>
                    <span style="color:var(--text-muted); border-bottom: 1px dotted rgba(255,255,255,0.3); cursor:pointer;">Modo Local (v1.9.0${readPill} • Novedades 📜)</span>
                `;
            }
        }
    }


    render() {
        if (this.headerContainer) {
            renderHeader(this.headerContainer);
        }

        if (this.mainContent) {
            const isLocalSelected = tenantManager.isLocalSelected;
            const isSuperAdmin = authManager.isSuperAdmin();
            const activeBusiness = tenantManager.getActiveBusiness();
            let currentView = store.currentView;

            // Actualizar título de la pestaña dinámicamente en el navegador
            if (activeBusiness && isLocalSelected) {
                document.title = `${activeBusiness.name} • Pump It Up Hub`;
            } else {
                document.title = "Pump It Up Hub • Sistema de Reservaciones de Maquinitas";
            }

            if (!isLocalSelected && (!isSuperAdmin || currentView !== 'SUPERADMIN')) {
                renderLandingView(this.mainContent);
                return;
            }

            // GUARDIA 1: SUCURSAL DESHABILITADA (Solo Superadmin puede acceder)
            if (isLocalSelected && activeBusiness && !tenantManager.isBusinessActive(activeBusiness) && !isSuperAdmin) {
                tenantManager.clearSelectedLocal();
                store.currentView = 'DAY';
                renderLandingView(this.mainContent);
                return;
            }

            // GUARDIA 2: FEATURE TOGGLES (Módulos deshabilitados por sucursal para no Superadmin)
            if (isLocalSelected && !isSuperAdmin && !tenantManager.isModuleEnabled(currentView, activeBusiness)) {
                // Redirigir suavemente a la vista principal disponible
                const fallbackView = tenantManager.isModuleEnabled('HOME', activeBusiness) ? 'HOME' : 'DAY';
                store.currentView = fallbackView;
                currentView = fallbackView;
            }

            switch (currentView) {
                case 'HOME':
                    renderBusinessHomeView(this.mainContent);
                    break;
                case 'DAY':
                    renderDayView(this.mainContent);
                    break;
                case 'WEEK':
                    renderWeekView(this.mainContent);
                    break;
                case 'MONTH':
                    renderMonthView(this.mainContent);
                    break;
                case 'MACHINES':
                    renderMachinesView(this.mainContent);
                    break;
                case 'REQUESTS':
                    renderRequestsView(this.mainContent);
                    break;
                case 'ACCOUNTS':
                    renderAccountsView(this.mainContent);
                    break;
                case 'CLIENTS':
                    renderClientsView(this.mainContent);
                    break;
                case 'CATALOGS':
                    renderCatalogsManagementView(this.mainContent);
                    break;
                case 'BUSINESS':
                    renderBusinessView(this.mainContent);
                    break;
                case 'ANALYTICS':
                    renderTenantAnalyticsView(this.mainContent);
                    break;
                case 'MY_PROFILE':
                    renderClientProfileView(this.mainContent);
                    break;
                case 'VERSUS':
                    renderVersusView(this.mainContent);
                    break;
                case 'DOWNLOAD':
                case 'INSTALL':
                    renderDownloadAppView(this.mainContent);
                    break;
                case 'SUPERADMIN':
                    renderSuperadminView(this.mainContent);
                    break;
                default:
                    renderDayView(this.mainContent);
                    break;
            }
        }
    }

    renderInactiveBusinessView(container, business) {
        container.innerHTML = `
            <div class="animate-fade-in" style="max-width: 680px; margin: 40px auto; padding: 32px; background: var(--bg-dark-800); border: 2px solid var(--color-neon-yellow); border-radius: var(--radius-lg); text-align: center; box-shadow: 0 0 30px rgba(255, 184, 0, 0.15);">
                <div style="font-size: 4rem; margin-bottom: 12px; animation: bounce 2s infinite;">⏸️</div>
                <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2.2rem; font-weight: 800; color: #ffffff; text-transform: uppercase; margin: 0 0 8px 0;">
                    ${business.name}
                </h2>
                <div class="badge badge-warning" style="font-size: 0.85rem; padding: 6px 14px; margin-bottom: 20px;">
                    ⚠️ SUCURSAL TEMPORALMENTE EN PAUSA
                </div>
                <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6; margin-bottom: 24px;">
                    Esta sucursal se encuentra en mantenimiento programado o pausada por la administración central. Las reservaciones de máquinas y la atención en mostrador se encuentran suspendidas temporalmente.
                </p>

                ${business.phone || business.whatsapp ? `
                    <div style="background: var(--bg-dark-900); padding: 14px; border-radius: var(--radius-md); border: 1px dashed var(--border-color); margin-bottom: 24px; font-size: 0.9rem; color: var(--text-muted);">
                        <span>📞 ¿Dudas o informes? Comunícate al </span>
                        <strong style="color: var(--color-neon-lime);">${business.phone || business.whatsapp}</strong>
                    </div>
                ` : ''}

                ${(!tenantManager.disableChangeLocalGlobally || authManager.isSuperAdmin()) ? `
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button type="button" class="btn btn-outline" id="btn-back-to-landing-paused">
                            <span>🏠 Cambiar de Sucursal</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        container.querySelector('#btn-back-to-landing-paused')?.addEventListener('click', () => {
            tenantManager.clearSelectedLocal();
        });
    }

    setupFooterNetworkStatus() {
        const updateNetworkStatus = () => {
            const footerStatus = document.getElementById('footer-network-status');
            if (!footerStatus) return;

            const isOnline = navigator.onLine;
            const dot = footerStatus.querySelector('.status-indicator-dot');
            const text = footerStatus.querySelector('.network-status-text');

            if (isOnline) {
                footerStatus.className = 'network-status-badge online';
                footerStatus.style.background = 'rgba(104,242,5,0.1)';
                footerStatus.style.borderColor = 'rgba(104,242,5,0.3)';
                footerStatus.style.color = 'var(--color-neon-lime)';
                footerStatus.title = 'Conectado en tiempo real a Firebase / Firestore';
                if (dot) {
                    dot.style.background = '#68F205';
                    dot.style.boxShadow = '0 0 8px #68F205';
                }
                if (text) text.textContent = 'Conectado a Firestore';
            } else {
                footerStatus.className = 'network-status-badge offline';
                footerStatus.style.background = 'rgba(255,184,0,0.15)';
                footerStatus.style.borderColor = 'rgba(255,184,0,0.4)';
                footerStatus.style.color = 'var(--color-neon-gold)';
                footerStatus.title = 'Modo Sin Conexión';
                if (dot) {
                    dot.style.background = '#FFB800';
                    dot.style.boxShadow = '0 0 8px #FFB800';
                }
                if (text) text.textContent = 'Modo Sin Conexión';
            }
        };

        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
