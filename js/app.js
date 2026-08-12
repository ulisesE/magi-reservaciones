// js/app.js
// Controlador Principal y Punto de Entrada de la Aplicación
import { tenantManager } from './core/tenantManager.js';
import { authManager } from './core/authManager.js';
import { store } from './core/store.js';
import { renderHeader } from './components/header.js';
import { renderDayView } from './views/dayView.js';
import { renderWeekView } from './views/weekView.js';
import { renderMonthView } from './views/monthView.js';
import { renderMachinesView } from './views/machinesView.js';
import { renderRequestsView } from './views/requestsView.js';
import { renderBusinessView } from './views/businessView.js';
import { renderSuperadminView } from './views/superadminView.js';
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

        // 3. Inicializar Store y datos de la sucursal activa
        await store.init();

        // Si el usuario es Superadmin, abrir la vista de superadmin por defecto
        if (authManager.isSuperAdmin() && store.currentView === 'DAY') {
            store.currentView = 'SUPERADMIN';
        }

        // 4. Renderizar Header y Vista Activa
        this.render();

        // 5. Suscribirse a cambios del Store para reactividad en tiempo real
        store.subscribe(() => {
            this.render();
        });

        // 6. Actualizar indicador de conexión
        this.updateSyncIndicator();
    }

    updateSyncIndicator() {
        if (this.syncStatusEl) {
            if (isFirebaseAvailable) {
                this.syncStatusEl.innerHTML = `
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#00ff88; box-shadow: 0 0 8px #00ff88;"></span>
                    <span style="color:var(--text-muted);">Sincronización en la Nube (Firestore <code>piu_app_v1</code>)</span>
                `;
            } else {
                this.syncStatusEl.innerHTML = `
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ffd000; box-shadow: 0 0 8px #ffd000;"></span>
                    <span style="color:var(--text-muted);">Modo LocalStorage (Sin conexión remota)</span>
                `;
            }
        }
    }

    render() {
        // Renderizar Header
        if (this.headerContainer) {
            renderHeader(this.headerContainer);
        }

        // Renderizar Vista Seleccionada
        if (this.mainContent) {
            const currentView = store.currentView;

            switch (currentView) {
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
                case 'BUSINESS':
                    renderBusinessView(this.mainContent);
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

// Inicialización en DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
