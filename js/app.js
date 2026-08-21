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
import { renderBusinessView } from './views/businessView.js';
import { renderSuperadminView } from './views/superadminView.js';
import { renderClientProfileView } from './views/clientProfileView.js';
import { isFirebaseAvailable } from './firebaseConfig.js';

class App {
    constructor() {
        this.headerContainer = document.getElementById('header-container');
        this.mainContent = document.getElementById('main-content');
        this.syncStatusEl = document.getElementById('cloud-sync-status');
    }

    async init() {
        console.log("🎮 Inicializando Pump It Up Hub...");

        // 1. Inicializar Gestor de Negocios
        await tenantManager.init();

        // 2. Inicializar Autenticación y Roles
        await authManager.init();

        // 3. Inicializar Catálogos Maestros (Versiones de Juego, Reglas)
        await catalogsManager.init();

        // 4. Inicializar Store y datos de la sucursal activa
        await store.init();

        // 4.5. Inicializar Gestor de Temas
        themeManager.init();

        // Los enlaces compartidos de una sucursal abren su página pública.
        const hasBusinessInUrl = new URLSearchParams(window.location.search).has('local')
            || new URLSearchParams(window.location.search).has('business')
            || new URLSearchParams(window.location.search).has('sucursal');
        if (hasBusinessInUrl && tenantManager.isLocalSelected && store.currentView === 'DAY' && !authManager.isStaff()) {
            store.currentView = 'HOME';
        }

        if (authManager.isSuperAdmin() && store.currentView === 'DAY' && !tenantManager.isLocalSelected) {
            store.currentView = 'SUPERADMIN';
        }

        // 5. Renderizar Header y Vista Activa
        this.render();

        // 6. Suscripciones para reactividad
        store.subscribe(() => this.render());
        tenantManager.subscribe(() => this.render());
        authManager.subscribe(() => this.render());

        // 7. Actualizar indicador de conexión
        this.updateSyncIndicator();
    }

    updateSyncIndicator() {
        if (this.syncStatusEl) {
            if (isFirebaseAvailable) {
                this.syncStatusEl.innerHTML = `
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#68F205; box-shadow: 0 0 8px #68F205;"></span>
                    <span style="color:var(--text-muted);">Servidor Remoto Conectado (piu_app_v1.3.0.2)</span>
                `;
            } else {
                this.syncStatusEl.innerHTML = `
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#C3D91E; box-shadow: 0 0 8px #C3D91E;"></span>
                    <span style="color:var(--text-muted);">Modo Local (Sin conexión)</span>
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
            const currentView = store.currentView;

            // Actualizar título de la pestaña dinámicamente en el navegador
            const activeBusiness = tenantManager.getActiveBusiness();
            if (activeBusiness && isLocalSelected) {
                document.title = `${activeBusiness.name} • Pump It Up Hub`;
            } else {
                document.title = "Pump It Up Hub • Sistema de Reservaciones de Maquinitas";
            }

            if (!isLocalSelected && (!isSuperAdmin || currentView !== 'SUPERADMIN')) {
                renderLandingView(this.mainContent);
                return;
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
                case 'CLIENTS':
                    renderClientsView(this.mainContent);
                    break;
                case 'CATALOGS':
                    renderCatalogsManagementView(this.mainContent);
                    break;
                case 'BUSINESS':
                    renderBusinessView(this.mainContent);
                    break;
                case 'MY_PROFILE':
                    renderClientProfileView(this.mainContent);
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
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
