// js/components/header.js
// Barra superior con acceso a todos los catálogos y gestión de perfiles de clientes y staff
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
    const isStaff = authManager.isStaff();
    const isClientUser = authManager.isClientUser();
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
                        ${currentUser ? `
                            <div class="user-session-pill" style="display:flex; align-items:center; gap:8px; background:var(--bg-dark-700); padding:4px 12px; border-radius:var(--radius-full); border:1px solid var(--border-color);">
                                <span style="font-size:1.1rem;">${currentUser.avatar || '👤'}</span>
                                <div style="display:flex; flex-direction:column; line-height:1.1;">
                                    <strong style="font-size:0.8rem; color:#fff;">${currentUser.name}</strong>
                                    <small style="font-size:0.68rem; color:${isClientUser ? 'var(--piu-cyan)' : 'var(--color-neon-lime)'}; font-weight:700;">
                                        ${isClientUser ? 'JUGADOR' : (isSuperAdmin ? 'SUPERADMIN' : 'ENCARGADO')}
                                    </small>
                                </div>
                                <button id="btn-logout" class="btn-xs btn-danger btn" style="margin-left:6px;" title="Cerrar sesión">Salir</button>
                            </div>
                        ` : `
                            <button id="btn-open-login" class="btn btn-outline btn-sm">
                                <span>🔐 Iniciar Sesión / Registro</span>
                            </button>
                        `}
                    </div>
                </div>
            </header>
        `;

        container.querySelector('#btn-open-login')?.addEventListener('click', () => {
            openLoginModal();
        });

        container.querySelector('#btn-logout')?.addEventListener('click', () => {
            authManager.logout();
            store.setCurrentView('DAY');
            toast.info("Sesión cerrada.");
        });
        return;
    }

    // Cabecera dentro de un local específico o modo Superadmin
    container.innerHTML = `
        <header class="app-header">
            <div class="header-top-row">
                <!-- Branding & Botón Regresar al Index -->
                <div class="header-brand">
                    ${!isManager ? `
                        <button id="btn-back-to-index" class="btn btn-outline btn-sm btn-back-hub" title="Regresar al inicio para cambiar de sucursal">
                            <span>← Cambiar de Local</span>
                        </button>
                    ` : ''}
                    
                    <div class="brand-badge-icon">${business?.logoIcon || '🕹️'}</div>
                    <div class="brand-text">
                        <div class="brand-title" style="font-size:1.15rem;">
                            <span class="piu-highlight">${business?.name || 'Pump It Up'}</span>
                        </div>
                        <div class="brand-subtitle">${business?.city || 'Arcade'}</div>
                    </div>
                </div>

                <!-- Indicador de Local Bloqueado -->
                <div class="header-tenant-selector" style="border-color:rgba(104, 242, 5, 0.4); background:rgba(104, 242, 5, 0.06);">
                    <span style="font-size:0.85rem; font-weight:700; color:var(--color-neon-lime);">
                        📍 Sala Activa: <strong>${business?.name || 'Local'}</strong>
                    </span>
                </div>

                <!-- Control de Acceso y Acciones -->
                <div class="header-actions">
                    <button id="btn-mobile-nav" class="btn btn-outline btn-sm btn-mobile-nav" type="button" aria-label="Abrir menú de navegación" aria-expanded="false">
                        <span>☰</span>
                    </button>
                    ${!currentUser ? `
                        <button id="btn-open-login" class="btn btn-outline btn-sm" title="Iniciar sesión o registrarte como Jugador">
                            <span>🔐 Iniciar Sesión / Registro</span>
                        </button>
                    ` : `
                        <div class="user-session-pill" style="display:flex; align-items:center; gap:8px; background:var(--bg-dark-700); padding:4px 10px; border-radius:var(--radius-full); border:1px solid var(--border-color);">
                            <span style="font-size:1rem;">${currentUser.avatar || '👤'}</span>
                            <div style="display:flex; flex-direction:column; line-height:1.1;">
                                <strong style="font-size:0.8rem; color:#fff;">${currentUser.name}</strong>
                                <small style="font-size:0.68rem; color:${isClientUser ? 'var(--piu-cyan)' : (isSuperAdmin ? 'var(--color-neon-lime)' : 'var(--color-chartreuse)')}; font-weight:700;">
                                    ${isClientUser ? '🎮 JUGADOR' : (isSuperAdmin ? 'SUPERADMIN' : 'ENCARGADO')}
                                </small>
                            </div>
                            <button id="btn-logout" class="btn-xs btn-danger btn" style="margin-left:4px;" title="Cerrar sesión">Salir</button>
                        </div>
                    `}

                    <button id="btn-quick-book" class="btn btn-primary btn-sm glow-red">
                        <span>➕ ${isStaff ? 'Asignar Reserva' : 'Reservar Máquina'}</span>
                    </button>
                </div>
            </div>

            <!-- Barra de Pestañas y Vistas del Local -->
            <div class="header-nav-row">
                <nav class="view-nav-tabs">
                    <button class="nav-tab ${currentView === 'HOME' ? 'active' : ''}" data-view="HOME">
                        <span class="tab-icon">🏠</span>
                        <span class="tab-text">Inicio</span>
                    </button>
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
                    
                    <!-- Pestaña para Clientes / Jugadores -->
                    ${isClientUser ? `
                        <button class="nav-tab ${currentView === 'MY_PROFILE' ? 'active' : ''}" data-view="MY_PROFILE" style="border-bottom-color:var(--piu-cyan); color:var(--piu-cyan);">
                            <span class="tab-icon">👤</span>
                            <span class="tab-text">Mi Perfil y Reservas</span>
                        </button>
                    ` : ''}

                    <!-- Pestañas exclusivas para Staff (Encargado y Superadmin) -->
                    ${isStaff ? `
                        <button class="nav-tab ${currentView === 'REQUESTS' ? 'active' : ''}" data-view="REQUESTS">
                            <span class="tab-icon">📥</span>
                            <span class="tab-text">Solicitudes</span>
                            ${pendingCount > 0 ? `<span class="badge-counter glow-red animate-bounce">${pendingCount}</span>` : ''}
                        </button>
                        <button class="nav-tab ${currentView === 'CLIENTS' ? 'active' : ''}" data-view="CLIENTS">
                            <span class="tab-icon">👥</span>
                            <span class="tab-text">Directorio</span>
                        </button>
                        <button class="nav-tab ${currentView === 'CATALOGS' ? 'active' : ''}" data-view="CATALOGS">
                            <span class="tab-icon">🗄️</span>
                            <span class="tab-text">Catálogos</span>
                        </button>
                        <button class="nav-tab ${currentView === 'BUSINESS' ? 'active' : ''}" data-view="BUSINESS">
                            <span class="tab-icon">⚙️</span>
                            <span class="tab-text">Ajustes Local</span>
                        </button>
                    ` : ''}

                    ${isSuperAdmin ? `
                        <button class="nav-tab ${currentView === 'SUPERADMIN' ? 'active' : ''}" data-view="SUPERADMIN" style="border-bottom-color:var(--color-neon-lime); color:var(--color-neon-lime);">
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
            toast.info("Sesión cerrada.");
        });
    }

    const quickBookBtn = container.querySelector('#btn-quick-book');
    if (quickBookBtn) {
        quickBookBtn.addEventListener('click', () => {
            openBookingModal();
        });
    }

    const mobileNavBtn = container.querySelector('#btn-mobile-nav');
    const navRow = container.querySelector('.header-nav-row');
    mobileNavBtn?.addEventListener('click', () => {
        const isOpen = navRow?.classList.toggle('mobile-nav-open');
        mobileNavBtn.setAttribute('aria-expanded', String(isOpen));
        mobileNavBtn.querySelector('span').textContent = isOpen ? '✕' : '☰';
    });

    const navTabs = container.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.view;
            navRow?.classList.remove('mobile-nav-open');
            mobileNavBtn?.setAttribute('aria-expanded', 'false');
            if (mobileNavBtn?.querySelector('span')) mobileNavBtn.querySelector('span').textContent = '☰';
            store.setCurrentView(view);
        });
    });
}

/**
 * Modal Unificado: Inicio de Sesión y Creación de Perfil para Clientes y Personal
 */
export function openLoginModal(initialTab = 'login') {
    const AVATAR_OPTIONS = ['🕺', '💃', '🕹️', '⚡', '🎧', '🔥', '🚀', '👑'];

    const contentHtml = `
        <div class="auth-modal-wrapper">
            <!-- Tabs del Modal -->
            <div style="display:flex; gap:8px; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
                <button type="button" id="tab-btn-login" class="btn btn-sm ${initialTab === 'login' ? 'btn-primary active' : 'btn-outline'}" style="flex:1;">
                    <span>🔐 Iniciar Sesión</span>
                </button>
                <button type="button" id="tab-btn-register" class="btn btn-sm ${initialTab === 'register' ? 'btn-primary active' : 'btn-outline'}" style="flex:1;">
                    <span>✨ Crear Perfil de Jugador</span>
                </button>
            </div>

            <!-- Panel 1: Login -->
            <div id="auth-panel-login" class="${initialTab === 'login' ? '' : 'hidden'}">
                <form id="form-auth-login" class="cyber-form">
                    <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:12px;">
                        Ingresa con tu Usuario / GamerTag o Teléfono y tu PIN de seguridad:
                    </p>

                    <div class="form-group">
                        <label for="login-username"><span class="neon-arrow">◆</span> Usuario / GamerTag o Teléfono</label>
                        <input type="text" id="login-username" class="cyber-input" placeholder="Ej. alex_step o 5512345678" autofocus required>
                    </div>

                    <div class="form-group">
                        <label for="login-pin"><span class="neon-arrow">◆</span> PIN de Seguridad</label>
                        <input type="password" id="login-pin" class="cyber-input" placeholder="PIN de acceso" maxlength="6" required>
                    </div>

                    <div id="login-error" class="form-error-msg hidden"></div>

                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
                        <button type="button" class="btn btn-secondary" id="btn-cancel-login">Cancelar</button>
                        <button type="submit" class="btn btn-primary glow-red" id="btn-submit-login">🔐 Iniciar Sesión</button>
                    </div>
                </form>
            </div>

            <!-- Panel 2: Registro de Perfil de Cliente / Jugador -->
            <div id="auth-panel-register" class="${initialTab === 'register' ? '' : 'hidden'}">
                <form id="form-auth-register" class="cyber-form">
                    <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:12px;">
                        Crea tu perfil de jugador para apartar máquinas rápidamente y llevar control de tus reservaciones:
                    </p>

                    <!-- Avatar Picker -->
                    <div class="form-group">
                        <label><span class="neon-arrow">◆</span> Elige tu Avatar</label>
                        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                            ${AVATAR_OPTIONS.map((a, idx) => `
                                <button type="button" class="btn btn-outline btn-xs btn-reg-avatar ${idx === 0 ? 'active glow-red' : ''}" data-avatar="${a}" style="font-size:1.2rem; padding:4px 8px;">
                                    ${a}
                                </button>
                            `).join('')}
                        </div>
                        <input type="hidden" id="reg-avatar" value="🕺">
                    </div>

                    <div class="form-row grid-2">
                        <div class="form-group">
                            <label for="reg-name"><span class="neon-arrow">◆</span> Nombre / GamerTag *</label>
                            <input type="text" id="reg-name" class="cyber-input" placeholder="Ej. Alex Step" required>
                        </div>
                        <div class="form-group">
                            <label for="reg-username"><span class="neon-arrow">◆</span> Nombre de Usuario *</label>
                            <input type="text" id="reg-username" class="cyber-input" placeholder="Ej. alex_step99" required>
                        </div>
                    </div>

                    <div class="form-row grid-2">
                        <div class="form-group">
                            <label for="reg-phone"><span class="neon-arrow">◆</span> Teléfono / WhatsApp *</label>
                            <input type="tel" id="reg-phone" class="cyber-input" placeholder="Ej. 5512345678" required>
                        </div>
                        <div class="form-group">
                            <label for="reg-pin"><span class="neon-arrow">◆</span> PIN de Seguridad (4-6 dígitos) *</label>
                            <input type="password" id="reg-pin" class="cyber-input" placeholder="PIN secreto" maxlength="6" required>
                        </div>
                    </div>

                    <div class="form-row grid-2">
                        <div class="form-group">
                            <label for="reg-email"><span class="neon-arrow">◆</span> Correo Electrónico (Opcional)</label>
                            <input type="email" id="reg-email" class="cyber-input" placeholder="jugador@correo.com">
                        </div>
                        <div class="form-group">
                            <label for="reg-level"><span class="neon-arrow">◆</span> Nivel / Liga (Ligas Potosinas)</label>
                            <select id="reg-level" class="cyber-select">
                                <option value="Liga D">Liga D</option>
                                <option value="Liga C" selected>Liga C</option>
                                <option value="Liga B">Liga B</option>
                                <option value="Liga A">Liga A</option>
                                <option value="Liga S">Liga S</option>
                                <option value="Liga SS">Liga SS</option>
                                <option value="Liga SSS">Liga SSS</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="reg-mode"><span class="neon-arrow">◆</span> Modo Preferido</label>
                        <input type="text" id="reg-mode" class="cyber-input" placeholder="Ej. Single Speed, Doubles, Freestyle" value="Single / Double">
                    </div>

                    <div id="register-error" class="form-error-msg hidden"></div>

                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
                        <button type="button" class="btn btn-secondary" id="btn-cancel-reg">Cancelar</button>
                        <button type="submit" class="btn btn-primary glow-red" id="btn-submit-reg">🚀 Crear Perfil y Entrar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const modalEl = modal.open({
        title: 'Acceso a Pump It Up Hub',
        icon: '🕹️',
        contentHtml,
        maxWidth: '520px'
    });

    // Cambiar pestañas
    const tabLogin = modalEl.querySelector('#tab-btn-login');
    const tabRegister = modalEl.querySelector('#tab-btn-register');
    const panelLogin = modalEl.querySelector('#auth-panel-login');
    const panelRegister = modalEl.querySelector('#auth-panel-register');

    tabLogin.onclick = () => {
        tabLogin.classList.add('btn-primary', 'active');
        tabLogin.classList.remove('btn-outline');
        tabRegister.classList.remove('btn-primary', 'active');
        tabRegister.classList.add('btn-outline');
        panelLogin.classList.remove('hidden');
        panelRegister.classList.add('hidden');
    };

    tabRegister.onclick = () => {
        tabRegister.classList.add('btn-primary', 'active');
        tabRegister.classList.remove('btn-outline');
        tabLogin.classList.remove('btn-primary', 'active');
        tabLogin.classList.add('btn-outline');
        panelRegister.classList.remove('hidden');
        panelLogin.classList.add('hidden');
    };

    // Selector de Avatar en Registro
    modalEl.querySelectorAll('.btn-reg-avatar').forEach(btn => {
        btn.addEventListener('click', () => {
            modalEl.querySelectorAll('.btn-reg-avatar').forEach(b => b.classList.remove('active', 'glow-red'));
            btn.classList.add('active', 'glow-red');
            modalEl.querySelector('#reg-avatar').value = btn.dataset.avatar;
        });
    });

    // Auto-completar nombre de usuario
    const regNameInput = modalEl.querySelector('#reg-name');
    const regUserInput = modalEl.querySelector('#reg-username');
    regNameInput?.addEventListener('input', () => {
        if (!regUserInput.dataset.manuallyEdited) {
            regUserInput.value = regNameInput.value.toLowerCase().replace(/[^a-z0-9]/g, '_');
        }
    });
    regUserInput?.addEventListener('input', () => {
        regUserInput.dataset.manuallyEdited = 'true';
    });

    modalEl.querySelector('#btn-cancel-login').onclick = () => modal.close();
    modalEl.querySelector('#btn-cancel-reg').onclick = () => modal.close();

    // Enviar Login
    modalEl.querySelector('#form-auth-login').onsubmit = async (e) => {
        e.preventDefault();
        const userInput = modalEl.querySelector('#login-username');
        const pinInput = modalEl.querySelector('#login-pin');
        const errorMsg = modalEl.querySelector('#login-error');

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
            } else if (user.role === 'CLIENT') {
                store.setCurrentView('MY_PROFILE');
            } else {
                store.setCurrentView('DAY');
            }
        } catch (err) {
            errorMsg.textContent = err.message || 'Credenciales incorrectas';
            errorMsg.classList.remove('hidden');
        }
    };

    // Enviar Registro
    modalEl.querySelector('#form-auth-register').onsubmit = async (e) => {
        e.preventDefault();
        const name = modalEl.querySelector('#reg-name').value.trim();
        const username = modalEl.querySelector('#reg-username').value.trim();
        const phone = modalEl.querySelector('#reg-phone').value.trim();
        const pin = modalEl.querySelector('#reg-pin').value.trim();
        const email = modalEl.querySelector('#reg-email').value.trim();
        const skillLevel = modalEl.querySelector('#reg-level').value;
        const preferredMode = modalEl.querySelector('#reg-mode').value.trim();
        const avatar = modalEl.querySelector('#reg-avatar').value;
        const errorMsg = modalEl.querySelector('#register-error');

        if (!name || !phone || !pin) {
            errorMsg.textContent = 'Por favor completa todos los campos requeridos (*).';
            errorMsg.classList.remove('hidden');
            return;
        }

        if (pin.length < 4) {
            errorMsg.textContent = 'El PIN debe tener al menos 4 caracteres.';
            errorMsg.classList.remove('hidden');
            return;
        }

        try {
            const newPlayer = await authManager.registerClient({
                name, username, phone, pin, email, skillLevel, preferredMode, avatar
            });
            modal.close();
            toast.success(`¡Perfil de jugador creado con éxito! Bienvenido ${newPlayer.name}`);
            store.setCurrentView('MY_PROFILE');
        } catch (err) {
            errorMsg.textContent = err.message || 'Error al crear perfil';
            errorMsg.classList.remove('hidden');
        }
    };
}

