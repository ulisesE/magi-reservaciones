// js/views/superadminView.js
// Panel de Control Global para SUPERADMIN (Gestión de todos los negocios, encargados y enlaces de clientes)
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { COLLECTIONS } from '../firebaseConfig.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export function renderSuperadminView(container) {
    const businesses = tenantManager.getAllBusinesses();
    const staffUsers = authManager.getStaffUsers();
    const managers = staffUsers.filter(u => u.role === 'MANAGER');

    // Métricas globales
    const totalBusinesses = businesses.length;
    const totalStaff = staffUsers.length;

    container.innerHTML = `
        <div class="superadmin-view-wrapper animate-fade-in">
            <!-- Header Global -->
            <div class="view-header-bar">
                <div class="header-left">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.8rem;">👑</span>
                        <h2 class="friendly-date-title">Panel de Control Global (Superadmin)</h2>
                    </div>
                    <p class="subtitle-text">Administración de todos los locales de maquinitas, encargados asignados y enlaces de clientes.</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-outline" id="btn-create-manager">
                        <span>👤 Crear Nuevo Encargado</span>
                    </button>
                    <button class="btn btn-primary glow-red" id="btn-add-global-biz">
                        <span>🏢 Registrar Nuevo Negocio</span>
                    </button>
                </div>
            </div>

            <!-- Métricas Globales -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:24px;">
                <div class="settings-card" style="padding:16px; display:flex; align-items:center; gap:14px;">
                    <div style="font-size:2.2rem; background:rgba(0,229,255,0.1); padding:10px; border-radius:8px;">🏢</div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">TOTAL DE NEGOCIOS</div>
                        <div style="font-size:1.8rem; font-family:var(--font-heading); color:#fff; font-weight:800;">${totalBusinesses}</div>
                    </div>
                </div>
                <div class="settings-card" style="padding:16px; display:flex; align-items:center; gap:14px;">
                    <div style="font-size:2.2rem; background:rgba(255,208,0,0.1); padding:10px; border-radius:8px;">👥</div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">ENCARGADOS ACTIVOS</div>
                        <div style="font-size:1.8rem; font-family:var(--font-heading); color:var(--piu-gold); font-weight:800;">${managers.length}</div>
                    </div>
                </div>
                <div class="settings-card" style="padding:16px; display:flex; align-items:center; gap:14px;">
                    <div style="font-size:2.2rem; background:rgba(0,255,136,0.1); padding:10px; border-radius:8px;">🕹️</div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">SUCURSAL SELECCIONADA</div>
                        <div style="font-size:1.1rem; font-family:var(--font-heading); color:var(--piu-green); font-weight:700;">${store.currentBusiness?.name || 'N/A'}</div>
                    </div>
                </div>
            </div>

            <!-- Tabla de Negocios y Enlaces de Clientes -->
            <div class="settings-card" style="margin-bottom:24px;">
                <div class="card-title-bar">
                    <div class="title-with-icon">
                        <span class="t-icon">🏢</span>
                        <div>
                            <h3>Catálogo de Negocios y Enlaces para Clientes</h3>
                            <small>Cada negocio tiene su propio enlace directo para sus clientes</small>
                        </div>
                    </div>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Local / Negocio</th>
                                <th>Ciudad / Ubicación</th>
                                <th>Horario</th>
                                <th>Encargado Asignado</th>
                                <th>Enlace Directo para Clientes</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${businesses.map(b => {
                                const assignedManager = managers.find(m => m.businessId === b.id);
                                const clientUrl = `${window.location.origin}${window.location.pathname}?local=${b.id}`;

                                return `
                                    <tr>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:8px;">
                                                <span style="font-size:1.4rem;">${b.logoIcon || '🕹️'}</span>
                                                <div>
                                                    <strong style="color:#ffffff;">${b.name}</strong>
                                                    <div style="font-size:0.72rem; color:var(--text-muted);">${b.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>${b.city}</td>
                                        <td><span class="badge badge-dark">${b.openingTime} - ${b.closingTime}</span></td>
                                        <td>
                                            ${assignedManager ? `
                                                <span class="badge badge-warning" title="Usuario: ${assignedManager.username} (PIN: ${assignedManager.pin})">
                                                    👤 ${assignedManager.name}
                                                </span>
                                            ` : `
                                                <span class="badge badge-dark">Sin asignar</span>
                                            `}
                                        </td>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:6px;">
                                                <input type="text" readonly value="${clientUrl}" class="cyber-input" style="font-size:0.75rem; padding:4px 8px; max-width:200px; background:var(--bg-dark-800);">
                                                <button class="btn btn-outline btn-xs btn-copy-link" data-url="${clientUrl}" title="Copiar enlace del cliente">
                                                    📋 Copiar
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <div style="display:flex; gap:6px;">
                                                <button class="btn btn-primary btn-xs btn-enter-biz glow-red" data-id="${b.id}" title="Entrar a administrar este negocio">
                                                    ⚡ Entrar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Directorio de Encargados / Staff -->
            <div class="settings-card">
                <div class="card-title-bar">
                    <div class="title-with-icon">
                        <span class="t-icon">👥</span>
                        <div>
                            <h3>Directorio de Cuentas de Acceso (Encargados y Superadmin)</h3>
                            <small>Credenciales para inicio de sesión por negocio</small>
                        </div>
                    </div>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Usuario</th>
                                <th>PIN de Acceso</th>
                                <th>Rol</th>
                                <th>Negocio Asignado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${staffUsers.map(u => {
                                const biz = businesses.find(b => b.id === u.businessId);
                                const isSuper = u.role === 'SUPERADMIN';

                                return `
                                    <tr>
                                        <td>
                                            <strong>${u.avatar || '👤'} ${u.name}</strong>
                                        </td>
                                        <td><code>${u.username}</code></td>
                                        <td><code style="color:var(--piu-gold);">${u.pin}</code></td>
                                        <td>
                                            <span class="badge ${isSuper ? 'badge-danger' : 'badge-warning'}">
                                                ${isSuper ? '👑 SUPERADMIN' : '🕹️ ENCARGADO'}
                                            </span>
                                        </td>
                                        <td>
                                            ${isSuper ? '<span class="highlight-cyan">Acceso a Todos los Negocios</span>' : (biz ? biz.name : 'No asignado')}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Copiar enlace de cliente
    container.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            navigator.clipboard.writeText(url).then(() => {
                toast.success("¡Enlace de cliente copiado al portapapeles!");
            }).catch(() => {
                prompt("Copia el enlace de cliente:", url);
            });
        });
    });

    // Entrar a gestionar un negocio directamente
    container.querySelectorAll('.btn-enter-biz').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await tenantManager.setActiveBusiness(id);
            store.setCurrentView('DAY');
            toast.info(`Administrando: ${tenantManager.getActiveBusiness().name}`);
        });
    });

    // Registrar nuevo negocio
    container.querySelector('#btn-add-global-biz')?.addEventListener('click', () => {
        import('./businessView.js').then(module => {
            container.querySelector('#btn-add-global-biz');
            store.setCurrentView('BUSINESS');
        });
    });

    // Crear nuevo encargado
    container.querySelector('#btn-create-manager')?.addEventListener('click', () => {
        openCreateManagerModal();
    });
}

function openCreateManagerModal() {
    const businesses = tenantManager.getAllBusinesses();

    const bizOptions = businesses.map(b => `
        <option value="${b.id}">${b.name} (${b.city})</option>
    `).join('');

    const contentHtml = `
        <form id="form-create-manager" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mgr-name"><span class="neon-arrow">◆</span> Nombre del Encargado *</label>
                    <input type="text" id="mgr-name" class="cyber-input" placeholder="Ej. Roberto Martínez" required>
                </div>
                <div class="form-group">
                    <label for="mgr-user"><span class="neon-arrow">◆</span> Usuario de Acceso *</label>
                    <input type="text" id="mgr-user" class="cyber-input" placeholder="Ej. manager_norte" required>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mgr-pin"><span class="neon-arrow">◆</span> PIN de Acceso (4 dígitos) *</label>
                    <input type="password" id="mgr-pin" class="cyber-input" placeholder="Ej. 1234" maxlength="6" required>
                </div>
                <div class="form-group">
                    <label for="mgr-biz"><span class="neon-arrow">◆</span> Negocio Asignado *</label>
                    <select id="mgr-biz" class="cyber-select" required>
                        ${bizOptions}
                    </select>
                </div>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-mgr">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-mgr">👤 Crear Encargado</button>
    `;

    const modalEl = modal.open({
        title: 'Crear Cuenta de Encargado de Negocio',
        icon: '👥',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    modalEl.querySelector('#btn-cancel-mgr').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-mgr').onclick = async () => {
        const name = modalEl.querySelector('#mgr-name').value.trim();
        const username = modalEl.querySelector('#mgr-user').value.trim();
        const pin = modalEl.querySelector('#mgr-pin').value.trim();
        const businessId = modalEl.querySelector('#mgr-biz').value;

        if (!name || !username || !pin) {
            toast.error("Por favor completa todos los campos requeridos.");
            return;
        }

        try {
            await authManager.createStaffManager({ name, username, pin, businessId });
            modal.close();
            toast.success(`Encargado "${name}" registrado exitosamente.`);
            renderSuperadminView(document.getElementById('main-content'));
        } catch (e) {
            toast.error(e.message);
        }
    };
}
