// js/components/header.js
// Barra superior con acceso a todos los catálogos y gestión de perfiles de clientes y staff
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { openBookingModal } from '../views/clientBookingModal.js';
import { openChangelogModal } from './changelogModal.js';
import { modal } from './modal.js';
import { toast } from './toast.js';
import { navShortcutsManager } from '../core/navShortcutsManager.js';

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

    const userId = currentUser ? (currentUser.id || currentUser.username || 'staff') : 'default';
    const availableStaffModules = isStaff ? navShortcutsManager.getAvailableModules(isSuperAdmin) : [];
    const pinnedShortcutIds = isStaff ? navShortcutsManager.getPinnedShortcuts(userId, isSuperAdmin) : [];

    const pinnedModules = availableStaffModules.filter(m => pinnedShortcutIds.includes(m.id));
    const unpinnedModules = availableStaffModules.filter(m => !pinnedShortcutIds.includes(m.id));

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
                            <div class="brand-subtitle" style="display:flex; align-items:center; gap:6px;">
                                <span>Plataforma Modular de Reservaciones</span>
                                <button type="button" class="btn-open-changelog-header" style="background:rgba(104,242,5,0.12); color:var(--color-neon-lime); border:1px solid rgba(104,242,5,0.3); border-radius:var(--radius-full); font-size:0.65rem; padding:1px 6px; font-weight:700; cursor:pointer; font-family:var(--font-mono);" title="Ver novedades de la versión v1.7.0">v1.7.0</button>
                            </div>
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
                            <button id="btn-open-login" class="btn btn-primary btn-sm">
                                <span>🔐 Acceso Staff</span>
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
        <header class="app-header ${currentUser ? 'header-authenticated' : 'header-guest'}">
            <div class="header-top-row">
                <!-- Branding & Botón Regresar al Index -->
                <div class="header-brand">
                    ${(!isManager && ((!business?.disableChangeLocal && !tenantManager.disableChangeLocalGlobally) || isSuperAdmin)) ? `
                        <button id="btn-back-to-index" class="btn btn-outline btn-sm btn-back-hub" title="Regresar al inicio para cambiar de sucursal">
                            <span>← Cambiar de Local</span>
                        </button>
                    ` : ''}
                    
                    <div class="brand-badge-icon">${business?.logoIcon || '🕹️'}</div>
                    <div class="brand-text">
                        <div class="brand-title" style="font-size:1.15rem;">
                            <span class="piu-highlight">${business?.name || 'Pump It Up'}</span>
                        </div>
                        <div class="brand-subtitle" style="display:flex; align-items:center; gap:6px;">
                            <span>${business?.city || 'Arcade'}</span>
                            <button type="button" class="btn-open-changelog-header" style="background:rgba(104,242,5,0.12); color:var(--color-neon-lime); border:1px solid rgba(104,242,5,0.3); border-radius:var(--radius-full); font-size:0.65rem; padding:1px 6px; font-weight:700; cursor:pointer; font-family:var(--font-mono);" title="Ver novedades de la versión v1.7.0">v1.7.0</button>
                        </div>
                    </div>
                </div>

                <!-- Control de Acceso, Red y Acciones -->
                <div class="header-actions" style="display:flex; align-items:center; gap:12px;">
                    <!-- Indicador de Conexión de Red -->
                    <div id="header-network-status" class="network-status-badge ${navigator.onLine ? 'online' : 'offline'}" style="display:flex; align-items:center; gap:5px; font-size:0.72rem; padding:3px 8px; border-radius:12px; background:${navigator.onLine ? 'rgba(104,242,5,0.1)' : 'rgba(255,184,0,0.15)'}; border:1px solid ${navigator.onLine ? 'rgba(104,242,5,0.3)' : 'rgba(255,184,0,0.4)'}; color:${navigator.onLine ? 'var(--color-neon-lime)' : 'var(--color-neon-gold)'}; font-weight:700;" title="${navigator.onLine ? 'Conectado a Firestore' : 'Modo Sin Conexión'}">
                        <span style="font-size:0.6rem;">${navigator.onLine ? '🟢' : '🟡'}</span>
                        <span class="network-status-text">${navigator.onLine ? 'En Línea' : 'Offline'}</span>
                    </div>

                    <button id="btn-quick-book" class="btn btn-primary btn-sm glow-red" style="padding:7px 16px; font-weight:800; border-radius:var(--radius-full); box-shadow: 0 0 14px rgba(255, 0, 85, 0.45);">
                        <span class="quick-book-label">➕ ${isStaff ? 'Asignar Reserva' : 'Reservar Máquina'}</span>
                    </button>

                    <div class="header-action-divider"></div>

                    ${!currentUser ? `
                        <button id="btn-open-login" class="btn btn-outline btn-sm" title="Iniciar sesión o registrarte como Jugador" style="border-radius:var(--radius-full);">
                            <span class="login-action-label">🔐 Iniciar Sesión / Registro</span>
                        </button>
                    ` : `
                        <!-- Menú Desplegable de Usuario (Perfil y Salir) -->
                        <div class="nav-dropdown-wrapper">
                            <button class="user-session-pill nav-dropdown-btn" type="button" title="Opciones de cuenta y perfil" style="cursor:pointer; display:flex; align-items:center; gap:8px;">
                                <span style="font-size:1.15rem;">${currentUser.avatar || '👤'}</span>
                                <div style="display:flex; flex-direction:column; line-height:1.1; text-align:left;">
                                    <strong style="font-size:0.82rem; color:#fff;">${currentUser.name}</strong>
                                    <small style="font-size:0.68rem; color:${isClientUser ? 'var(--piu-cyan)' : (isSuperAdmin ? 'var(--color-neon-lime)' : 'var(--color-chartreuse)')}; font-weight:700;">
                                        ${isClientUser ? '🎮 JUGADOR' : (isSuperAdmin ? '👑 SUPERADMIN' : '🕹️ ENCARGADO')}
                                    </small>
                                </div>
                                <span class="dropdown-caret" style="font-size:0.75rem; margin-left:2px;">▾</span>
                            </button>
                            <div class="nav-dropdown-menu align-right" style="min-width:260px;">
                                <div style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.08); margin-bottom:4px;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <span style="font-size:1.6rem;">${currentUser.avatar || '👤'}</span>
                                        <div>
                                            <strong style="color:#ffffff; font-size:0.92rem; display:block;">${currentUser.name}</strong>
                                            <span style="color:${isClientUser ? 'var(--piu-cyan)' : 'var(--color-neon-lime)'}; font-size:0.75rem; font-weight:700;">
                                                ${isClientUser ? 'Jugador Registrado' : (isSuperAdmin ? 'Superadministrador Global' : 'Encargado de Sucursal')}
                                            </span>
                                            ${currentUser.username ? `<span style="display:block; font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono);">@${currentUser.username}</span>` : ''}
                                        </div>
                                    </div>
                                </div>

                                <button class="dropdown-item" data-view="MY_PROFILE">
                                    <span class="item-icon">👤</span>
                                    <div class="item-info">
                                        <strong>${isClientUser ? 'Mi Perfil & Pase Digital' : 'Mi Cuenta'}</strong>
                                        <small>Ver estadísticas y reservaciones</small>
                                    </div>
                                </button>

                                ${isStaff ? `
                                    <button class="dropdown-item btn-customize-shortcuts" type="button">
                                        <span class="item-icon">✏️</span>
                                        <div class="item-info">
                                            <strong>Personalizar Barra Staff...</strong>
                                            <small>Elegir accesos directos visibles</small>
                                        </div>
                                    </button>
                                ` : ''}

                                <button class="dropdown-item btn-open-changelog-header" type="button">
                                    <span class="item-icon">📜</span>
                                    <div class="item-info">
                                        <strong>Novedades (v1.7.0)</strong>
                                        <small>Ver registro de cambios</small>
                                    </div>
                                </button>

                                <div class="dropdown-divider"></div>

                                <button class="dropdown-item" id="btn-logout" style="color:var(--color-neon-pink);">
                                    <span class="item-icon">🚪</span>
                                    <div class="item-info">
                                        <strong style="color:var(--color-neon-pink);">Cerrar Sesión</strong>
                                        <small>Salir de la cuenta en este equipo</small>
                                    </div>
                                </button>
                            </div>
                        </div>
                    `}

                    <button id="btn-mobile-nav" class="btn btn-outline btn-sm btn-mobile-nav" type="button" aria-label="Abrir menú de navegación" aria-expanded="false">
                        <span>☰</span>
                    </button>
                </div>
            </div>

            <!-- Barra de Navegación -->
            <div class="header-nav-row">
                <nav class="view-nav-tabs">
                    <div class="nav-cluster">
                        <button class="nav-tab ${currentView === 'HOME' ? 'active' : ''}" data-view="HOME" title="Inicio">
                            <span class="tab-icon">🏠</span>
                            <span class="tab-text">Inicio</span>
                        </button>

                        <div class="nav-dropdown-wrapper">
                            <button class="nav-tab nav-dropdown-btn ${['DAY', 'WEEK', 'MONTH'].includes(currentView) ? 'active' : ''}" type="button" title="Vistas de Calendario y Horarios">
                                <span class="tab-icon">📅</span>
                                <span class="tab-text">${currentView === 'WEEK' ? 'Semana' : currentView === 'MONTH' ? 'Mes' : 'Calendario'}</span>
                                <span class="dropdown-caret">▾</span>
                            </button>
                            <div class="nav-dropdown-menu">
                                <button class="dropdown-item ${currentView === 'DAY' ? 'active' : ''}" data-view="DAY">
                                    <span class="item-icon">📅</span>
                                    <div class="item-info">
                                        <strong>Vista Día</strong>
                                        <small>Cuadrícula de slots por máquina</small>
                                    </div>
                                </button>
                                <button class="dropdown-item ${currentView === 'WEEK' ? 'active' : ''}" data-view="WEEK">
                                    <span class="item-icon">📊</span>
                                    <div class="item-info">
                                        <strong>Vista Semana</strong>
                                        <small>Disponibilidad y afluencia 7 días</small>
                                    </div>
                                </button>
                                <button class="dropdown-item ${currentView === 'MONTH' ? 'active' : ''}" data-view="MONTH">
                                    <span class="item-icon">🗓️</span>
                                    <div class="item-info">
                                        <strong>Vista Mes</strong>
                                        <small>Calendario mensual global</small>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <button class="nav-tab ${currentView === 'MACHINES' ? 'active' : ''}" data-view="MACHINES">
                            <span class="tab-icon">🕹️</span>
                            <span class="tab-text">Máquinas</span>
                        </button>

                        ${currentUser ? `
                            <button class="nav-tab ${currentView === 'MY_PROFILE' ? 'active' : ''}" data-view="MY_PROFILE">
                                <span class="tab-icon">👤</span>
                                <span class="tab-text">${isClientUser ? 'Mi Perfil' : 'Mi Cuenta'}</span>
                            </button>
                        ` : ''}
                    </div>

                    <!-- Cluster de Operación & Staff (Personalizable por el usuario) -->
                    ${isStaff ? `
                        <div class="nav-cluster staff-zone" title="Herramientas del Encargado / Staff">
                            ${pinnedModules.map(m => `
                                <button class="nav-tab staff-tab ${currentView === m.viewId ? 'active' : ''}" data-view="${m.viewId}" title="${m.title}: ${m.description}">
                                    <span class="tab-icon">${m.icon}</span>
                                    <span class="tab-text">${m.title}</span>
                                    ${m.hasCounter && pendingCount > 0 ? `<span class="badge-counter glow-red animate-bounce">${pendingCount}</span>` : ''}
                                </button>
                            `).join('')}

                            ${unpinnedModules.length > 0 ? `
                                <!-- Dropdown de Módulos Restantes y Personalización -->
                                <div class="nav-dropdown-wrapper">
                                    <button class="nav-tab staff-tab nav-dropdown-btn ${unpinnedModules.some(m => m.viewId === currentView) ? 'active' : ''}" type="button" title="Módulos de Gestión y Ajustes">
                                        <span class="tab-icon">⚙️</span>
                                        <span class="tab-text">${unpinnedModules.some(m => m.viewId === currentView) ? (unpinnedModules.find(m => m.viewId === currentView)?.title || 'Gestión') : 'Gestión'}</span>
                                        <span class="dropdown-caret">▾</span>
                                    </button>
                                    <div class="nav-dropdown-menu align-right">
                                        ${unpinnedModules.map(m => `
                                            <button class="dropdown-item ${m.id === 'SUPERADMIN' ? 'superadmin-item' : ''} ${currentView === m.viewId ? 'active' : ''}" data-view="${m.viewId}">
                                                <span class="item-icon">${m.icon}</span>
                                                <div class="item-info">
                                                    <strong ${m.id === 'SUPERADMIN' ? 'style="color:var(--color-neon-lime);"' : ''}>${m.title}</strong>
                                                    <small>${m.description}</small>
                                                </div>
                                            </button>
                                        `).join('')}
                                        <div class="dropdown-divider"></div>
                                        <button class="dropdown-item btn-customize-shortcuts" style="color:var(--color-neon-cyan);" title="Elegir qué botones ver fijos en la barra">
                                            <span class="item-icon">✏️</span>
                                            <div class="item-info">
                                                <strong style="color:var(--color-neon-cyan);">Personalizar Barra...</strong>
                                                <small>Elegir accesos directos visibles</small>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            ` : `
                                <button class="nav-tab staff-tab btn-customize-shortcuts" title="Personalizar accesos directos de staff">
                                    <span class="tab-icon">✏️</span>
                                </button>
                            `}
                        </div>
                    ` : ''}
                </nav>
            </div>
        </header>
    `;

    // Evento para abrir el Changelog modal
    container.querySelectorAll('.btn-open-changelog-header').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openChangelogModal();
        });
    });

    // Evento Regresar al Index para cambiar de local
    container.querySelector('#btn-back-to-index')?.addEventListener('click', () => {
        tenantManager.clearSelectedLocal();
        store.setCurrentView('DAY');
        toast.info("Regresando a la selección de locales...");
    });

    // Botón para personalizar accesos directos
    container.querySelectorAll('.btn-customize-shortcuts').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            container.querySelectorAll('.nav-dropdown-wrapper.open').forEach(w => w.classList.remove('open'));
            openCustomizeShortcutsModal(userId, isSuperAdmin, container);
        });
    });

    const loginBtn = container.querySelector('#btn-open-login');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            openLoginModal();
        });
    }

    const profileBtn = container.querySelector('#btn-user-profile-header');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            store.setCurrentView('MY_PROFILE');
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

    // Toggle para dropdowns de navegación (Calendario y Gestión)
    container.querySelectorAll('.nav-dropdown-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wrapper = btn.closest('.nav-dropdown-wrapper');
            const isOpen = wrapper.classList.contains('open');
            container.querySelectorAll('.nav-dropdown-wrapper.open').forEach(w => w.classList.remove('open'));
            if (!isOpen) {
                wrapper.classList.add('open');
            }
        });
    });

    // Eventos en botones de navegación directa y elementos de menú desplegable
    container.querySelectorAll('.nav-tab[data-view], .dropdown-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const view = item.dataset.view;
            if (view) {
                container.querySelectorAll('.nav-dropdown-wrapper.open').forEach(w => w.classList.remove('open'));
                navRow?.classList.remove('mobile-nav-open');
                mobileNavBtn?.setAttribute('aria-expanded', 'false');
                if (mobileNavBtn?.querySelector('span')) mobileNavBtn.querySelector('span').textContent = '☰';
                store.setCurrentView(view);
            }
        });
    });

    // Cerrar dropdowns al hacer clic en cualquier parte fuera del header
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            container.querySelectorAll('.nav-dropdown-wrapper.open').forEach(w => w.classList.remove('open'));
        }
    });
}

/**
 * Modal Interactivo: Personalizar Accesos Directos de la Barra de Staff
 */
export function openCustomizeShortcutsModal(userId, isSuperAdmin, headerContainer) {
    const available = navShortcutsManager.getAvailableModules(isSuperAdmin);
    const currentPinned = new Set(navShortcutsManager.getPinnedShortcuts(userId, isSuperAdmin));

    const contentHtml = `
        <div style="display:flex; flex-direction:column; gap:14px;">
            <p style="font-size:0.88rem; color:var(--text-secondary); margin:0;">
                Selecciona los módulos que deseas tener como <strong>accesos directos visibles</strong> en tu barra de herramientas. Los no seleccionados permanecerán accesibles dentro del desplegable <strong>"Gestión ▾"</strong>:
            </p>

            <div style="display:flex; flex-direction:column; gap:8px; max-height:340px; overflow-y:auto; padding:4px 2px;">
                ${available.map(m => {
                    const isChecked = currentPinned.has(m.id);
                    return `
                        <label class="shortcut-option-card" style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:var(--bg-dark-800); border:1px solid ${isChecked ? 'var(--color-neon-lime)' : 'rgba(255,255,255,0.08)'}; border-radius:var(--radius-sm); cursor:pointer; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="font-size:1.4rem;">${m.icon}</span>
                                <div>
                                    <strong style="color:#ffffff; font-size:0.92rem; display:block;">${m.title}</strong>
                                    <small style="color:var(--text-muted); font-size:0.75rem;">${m.description}</small>
                                </div>
                            </div>
                            <input type="checkbox" class="shortcut-checkbox" value="${m.id}" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer; accent-color:var(--color-neon-lime);">
                        </label>
                    `;
                }).join('')}
            </div>

            <div style="background:rgba(0,229,255,0.06); border-left:3px solid var(--piu-cyan); padding:8px 12px; border-radius:4px; font-size:0.78rem; color:var(--text-muted);">
                💡 <strong>Consejo</strong>: Recomendamos fijar entre 3 y 4 accesos directos para mantener una navegación limpia y sin desplazamientos en cualquier pantalla.
            </div>
        </div>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-reset-shortcuts" style="margin-right:auto;">🔄 Restablecer Defaults</button>
        <button type="button" class="btn btn-outline" id="btn-cancel-shortcuts">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btn-save-shortcuts">💾 Guardar Accesos</button>
    `;

    const modalEl = modal.open({
        title: 'Personalizar Barra de Accesos Staff',
        icon: '✏️',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    modalEl.querySelector('#btn-cancel-shortcuts').onclick = () => modal.close();

    modalEl.querySelector('#btn-reset-shortcuts').onclick = () => {
        navShortcutsManager.resetToDefaults(userId);
        toast.info("Accesos directos restablecidos por defecto.");
        modal.close();
        if (headerContainer) renderHeader(headerContainer);
    };

    modalEl.querySelector('#btn-save-shortcuts').onclick = () => {
        const checkedBoxes = modalEl.querySelectorAll('.shortcut-checkbox:checked');
        const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);

        if (selectedIds.length === 0) {
            toast.error("Debes seleccionar al menos 1 acceso directo para tu barra.");
            return;
        }

        navShortcutsManager.savePinnedShortcuts(userId, selectedIds);
        toast.success("Barra de accesos directos actualizada exitosamente.");
        modal.close();
        if (headerContainer) renderHeader(headerContainer);
    };
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

                    <div style="text-align: right; margin-top: 8px; margin-bottom: 8px;">
                        <a href="#" id="btn-forgot-pin" style="font-size: 0.8rem; color: var(--piu-cyan, #00e5ff); text-decoration: none; border-bottom: 1px dotted var(--piu-cyan, #00e5ff); transition: opacity 0.2s;">
                            ¿Olvidaste tu PIN de acceso?
                        </a>
                    </div>

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
                            <label for="reg-piu-id"><span class="neon-arrow">◆</span> PIU ID (piugame.com) - Opcional</label>
                            <input type="text" id="reg-piu-id" class="cyber-input" placeholder="Ej. megajefelink#1234">
                        </div>
                    </div>

                    <div class="form-row grid-2">
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
                        <div class="form-group">
                            <label for="reg-mode"><span class="neon-arrow">◆</span> Modo Preferido</label>
                            <input type="text" id="reg-mode" class="cyber-input" placeholder="Ej. Single Speed, Doubles, Freestyle" value="Single / Double">
                        </div>
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

    // Evento: Olvidé mi PIN
    modalEl.querySelector('#btn-forgot-pin')?.addEventListener('click', (e) => {
        e.preventDefault();
        const activeBiz = store.currentBusiness || tenantManager.getActiveBusiness();
        const whatsappNumber = activeBiz ? activeBiz.whatsapp : '';
        const phoneFallback = activeBiz ? activeBiz.phone : '';
        const bizName = activeBiz ? activeBiz.name : 'la sala';

        const textMessage = `Hola, soy un jugador de Pump It Up y olvidé mi PIN de acceso para Magi Reservaciones en ${bizName}. ¿Me podrían ayudar a restablecerlo?`;
        const encodedText = encodeURIComponent(textMessage);

        const targetPhone = whatsappNumber || phoneFallback;
        if (targetPhone) {
            const cleanPhone = targetPhone.replace(/\D/g, '');
            const waUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
            window.open(waUrl, '_blank', 'noopener,noreferrer');
            toast.info("Abriendo WhatsApp para contactar al encargado...");
        } else {
            toast.warning("No hay un número de WhatsApp de contacto configurado para esta sucursal. Por favor solicita ayuda en mostrador.");
        }
    });

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
        const piuGameId = modalEl.querySelector('#reg-piu-id').value.trim();
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
                name, username, phone, pin, email, piuGameId, skillLevel, preferredMode, avatar
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

