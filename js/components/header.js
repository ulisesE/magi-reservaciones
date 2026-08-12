// js/components/header.js
// Barra superior con bloqueo de local y botón para regresar al Index
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { openBookingModal } from '../views/clientBookingModal.js';
import { modal } from './modal.js';
import { toast } from './toast.js';

export function renderHeader(container) {
    const isLocalSelected = tenantManager.isLocalSelected;
    const business = store.currentBusiness || tenantManager.getActiveBusiness();
    const currentUser = authManager.getCurrentUser();
    const isSuperAdmin = authManager.isSuperAdmin();
    const isManager = authManager.isManager();
    const isClient = authManager.isClient();
    const pendingCount = store.getPendingRequestsCount();
    const currentView = store.currentView;

    // Si estamos en la pantalla de bienvenida (sin local seleccionado)
    if (!isLocalSelected && !isSuperAdmin) {
        container.innerHTML = `
            <header class="app-header">
                <div class="header-top-row">
                    <div class="header-brand">
                        <div class="brand-badge-icon pulse-glow">🕹️</div>
                        <div class="brand-text">
                            <div class="brand-title">
                                <span class="piu-highlight">PUMP IT UP</span> HUB
                            </div>
                            <div class="brand-subtitle">Plataforma Modular de Reservaciones</div>
                        </div>
                    </div>

                    <div class="header-actions">
                        <button id="btn-open-login" class="btn btn-outline btn-sm">
                            <span>🔐 Acceso Staff / Superadmin</span>
                        </button>
                    </div>
                </div>
            </header>
        `;

        container.querySelector('#btn-open-login')?.addEventListener('click', () => {
            openLoginModal();
        });
        return;
    }

    // Cabecera dentro de un local específico
    container.innerHTML = `
        <header class="app-header">
            <div class="header-top-row">
                <!-- Branding & Botón Regresar al Index -->
                <div class="header-brand">
                    <button id="btn-back-to-index" class="btn btn-outline btn-sm btn-back-hub" title="Regresar al inicio para cambiar de sucursal">
                        <span>← Cambiar de Local</span>
                    </button>
                    
                    <div class="brand-badge-icon">${business.logoIcon || '🕹️'}</div>
                    <div class="brand-text">
                        <div class="brand-title" style="font-size:1.15rem;">
                            <span class="piu-highlight">${business.name}</span>
                        </div>
                        <div class="brand-subtitle">${business.city}</div>
                    </div>
                </div>

                <!-- Indicador de Local Bloqueado -->
                <div class="header-tenant-selector" style="border-color:rgba(0, 229, 255, 0.4); background:rgba(0, 229, 255, 0.06);">
                    <span style="font-size:0.85rem; font-weight:700; color:var(--piu-cyan);">
                        📍 Sala Activa: <strong>${business.name}</strong>
                    </span>
                </div>

                <!-- Control de Acceso y Acciones -->
                <div class="header-actions">
                    ${isClient ? `
                        <button id="btn-open-login" class="btn btn-outline btn-sm" title="Iniciar sesión como Encargado">
                            <span>🔐 Acceso Staff</span>
                        </button>
                    ` : `
                        <div class="user-session-pill" style="display:flex; align-items:center; gap:8px; background:var(--bg-dark-700); padding:4px 10px; border-radius:var(--radius-full); border:1px solid var(--border-color);">
                            <span style="font-size:1rem;">${currentUser.avatar || '👤'}</span>
                            <div style="display:flex; flex-direction:column; line-height:1.1;">
                                <strong style="font-size:0.8rem; color:#fff;">${currentUser.name}</strong>
                                <small style="font-size:0.68rem; color:${isSuperAdmin ? 'var(--piu-red)' : 'var(--piu-gold)'}; font-weight:700;">
                                    ${isSuperAdmin ? 'SUPERADMIN' : 'ENCARGADO'}
                                </small>
                            </div>
                            <button id="btn-logout" class="btn-xs btn-danger btn" style="margin-left:4px;" title="Cerrar sesión">Salir</button>
                        </div>
                    `}

                    <button id="btn-quick-book" class="btn btn-primary btn-sm glow-red">
                        <span>➕ ${!isClient ? 'Asignar Reserva' : 'Reservar'}</span>
                    </button>
                </div>
            </div>

            <!-- Barra de Pestañas y Vistas del Local -->
            <div class="header-nav-row">
                <nav class="view-nav-tabs">
                    <button class="nav-tab ${currentView === 'DAY' ? 'active' : ''}" data-view="DAY">
                        <span class="tab-icon">📅</span>
                        <span class="tab-text">Vista Día (Grid)</span>
                    </button>
                    <button class="nav-tab ${currentView === 'WEEK' ? 'active' : ''}" data-view="WEEK">
                        <span class="tab-icon">📊</span>
                        <span class="tab-text">Vista Semana</span>
                    </button>
                    <button class="nav-tab ${currentView === 'MONTH' ? 'active' : ''}" data-view="MONTH">
                        <span class="tab-icon">🗓️</span>
                        <span class="tab-text">Vista Mes</span>
                    </button>
                    <button class="nav-tab ${currentView === 'MACHINES' ? 'active' : ''}" data-view="MACHINES">
                        <span class="tab-icon">🕹️</span>
                        <span class="tab-text">Máquinas</span>
                    </button>
                    
                    ${!isClient ? `
                        <button class="nav-tab ${currentView === 'REQUESTS' ? 'active' : ''}" data-view="REQUESTS">
                            <span class="tab-icon">📥</span>
                            <span class="tab-text">Solicitudes</span>
                            ${pendingCount > 0 ? `<span class="badge-counter glow-red animate-bounce">${pendingCount}</span>` : ''}
                        </button>
                        <button class="nav-tab ${currentView === 'BUSINESS' ? 'active' : ''}" data-view="BUSINESS">
                            <span class="tab-icon">⚙️</span>
                            <span class="tab-text">Ajustes Local</span>
                        </button>
                    ` : ''}

                    ${isSuperAdmin ? `
                        <button class="nav-tab ${currentView === 'SUPERADMIN' ? 'active' : ''}" data-view="SUPERADMIN" style="border-bottom-color:var(--piu-gold); color:var(--piu-gold);">
                            <span class="tab-icon">👑</span>
                            <span class="tab-text">Panel Global</span>
                        </button>
                    ` : ''}
                </nav>
            </div>
        </header>
    `;

    // Evento Regresar al Index para cambiar de local
    container.querySelector('#btn-back-to-index')?.addEventListener('click', () => {
        tenantManager.clearSelectedLocal();
        store.setCurrentView('DAY');
        toast.info("Regresando a la selección de locales...");
    });

    const loginBtn = container.querySelector('#btn-open-login');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            openLoginModal();
        });
    }

    const logoutBtn = container.querySelector('#btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            authManager.logout();
            store.setCurrentView('DAY');
            toast.info("Sesión cerrada. Regresando a la pantalla de bienvenida.");
        });
    }

    const quickBookBtn = container.querySelector('#btn-quick-book');
    if (quickBookBtn) {
        quickBookBtn.addEventListener('click', () => {
            openBookingModal();
        });
    }

    const navTabs = container.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.view;
            store.setCurrentView(view);
        });
    });
}

/**
 * Modal de Inicio de Sesión
 */
export function openLoginModal() {
    const staffList = authManager.getStaffUsers();

    const contentHtml = `
        <div class="cyber-form">
            <p style="font-size:0.9rem;">Ingresa tus credenciales de Encargado de Local o Super Administrador:</p>

            <div class="form-group">
                <label for="login-username"><span class="neon-arrow">◆</span> Usuario</label>
                <input type="text" id="login-username" class="cyber-input" placeholder="Ej. encargado_centro o superadmin" autofocus required>
            </div>

            <div class="form-group">
                <label for="login-pin"><span class="neon-arrow">◆</span> PIN de Seguridad</label>
                <input type="password" id="login-pin" class="cyber-input" placeholder="Ej. 1234" maxlength="6" required>
            </div>

            <div id="login-error" class="form-error-msg hidden"></div>

            <!-- Accesos Rápidos Demo -->
            <div style="background:var(--bg-dark-700); padding:12px; border-radius:var(--radius-sm); border:1px dashed var(--border-color); margin-top:8px;">
                <span style="font-size:0.75rem; color:var(--piu-cyan); font-weight:700; display:block; margin-bottom:8px;">
                    ⚡ ACCESOS RÁPIDOS PARA PRUEBA (1-CLICK):
                </span>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${staffList.map(u => `
                        <button type="button" class="btn btn-outline btn-xs btn-quick-login" data-user="${u.username}" data-pin="${u.pin}" style="justify-content:space-between;">
                            <span>${u.avatar || '👤'} <strong>${u.name}</strong> (${u.role})</span>
                            <code style="color:var(--piu-gold);">PIN: ${u.pin}</code>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-login">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-submit-login">🔐 Iniciar Sesión</button>
    `;

    const modalEl = modal.open({
        title: 'Acceso de Personal / Staff',
        icon: '🔐',
        contentHtml,
        footerHtml,
        maxWidth: '480px'
    });

    const userInput = modalEl.querySelector('#login-username');
    const pinInput = modalEl.querySelector('#login-pin');
    const errorMsg = modalEl.querySelector('#login-error');

    modalEl.querySelectorAll('.btn-quick-login').forEach(btn => {
        btn.addEventListener('click', () => {
            userInput.value = btn.dataset.user;
            pinInput.value = btn.dataset.pin;
            modalEl.querySelector('#btn-submit-login').click();
        });
    });

    modalEl.querySelector('#btn-cancel-login').onclick = () => modal.close();

    modalEl.querySelector('#btn-submit-login').onclick = async () => {
        const username = userInput.value.trim();
        const pin = pinInput.value.trim();

        if (!username || !pin) {
            errorMsg.textContent = 'Por favor ingresa usuario y PIN.';
            errorMsg.classList.remove('hidden');
            return;
        }

        try {
            const user = await authManager.login(username, pin);
            modal.close();
            toast.success(`¡Bienvenido ${user.name}!`);
            if (user.role === 'SUPERADMIN') {
                store.setCurrentView('SUPERADMIN');
            } else {
                store.setCurrentView('DAY');
            }
        } catch (err) {
            errorMsg.textContent = err.message || 'Credenciales incorrectas';
            errorMsg.classList.remove('hidden');
        }
    };
}
