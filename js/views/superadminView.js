// js/views/superadminView.js
// Panel de Control Global para SUPERADMIN (Gestión integral de todos los catálogos y eliminación en cascada)
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

let activeSuperTab = 'BUSINESSES'; // 'BUSINESSES', 'MACHINES', 'STAFF', 'SETTINGS'

export function renderSuperadminView(container) {
    const businesses = tenantManager.getAllBusinesses();
    const staffUsers = authManager.getStaffUsers();
    const managers = staffUsers.filter(u => u.role === 'MANAGER');
    const totalBusinesses = businesses.length;

    container.innerHTML = `
        <div class="superadmin-view-wrapper animate-fade-in">
            <!-- Header Global -->
            <div class="view-header-bar">
                <div class="header-left">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.8rem;">👑</span>
                        <h2 class="friendly-date-title">Consola Global de Super Administrador</h2>
                    </div>
                    <p class="subtitle-text">Administración completa de todos los locales, máquinas, encargados y catálogos de la plataforma.</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-outline" id="btn-create-manager">
                        <span>👤 Nuevo Encargado</span>
                    </button>
                    <button class="btn btn-primary glow-red" id="btn-add-global-biz">
                        <span>🏢 Registrar Nuevo Local</span>
                    </button>
                </div>
            </div>

            <!-- Navegación de Pestañas de Superadmin -->
            <div class="requests-filter-bar" style="margin-bottom:20px;">
                <button class="filter-tab ${activeSuperTab === 'BUSINESSES' ? 'active' : ''}" data-tab="BUSINESSES">
                    <span>🏢 Locales (${totalBusinesses})</span>
                </button>
                <button class="filter-tab ${activeSuperTab === 'MACHINES' ? 'active' : ''}" data-tab="MACHINES">
                    <span>🕹️ Máquinas por Local</span>
                </button>
                <button class="filter-tab ${activeSuperTab === 'STAFF' ? 'active' : ''}" data-tab="STAFF">
                    <span>👥 Encargados (${managers.length})</span>
                </button>
            </div>

            <!-- Contenido Dinámico de la Pestaña -->
            <div id="superadmin-tab-content">
                ${renderTabContent(activeSuperTab, businesses, staffUsers, managers)}
            </div>
        </div>
    `;

    // Eventos de Pestañas
    container.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            activeSuperTab = tab.dataset.tab;
            renderSuperadminView(container);
        });
    });

    // Copiar enlaces de clientes
    container.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            navigator.clipboard.writeText(url).then(() => {
                toast.success("¡Enlace de cliente copiado al portapapeles!");
            }).catch(() => prompt("Copia el enlace:", url));
        });
    });

    // Entrar a gestionar un negocio
    container.querySelectorAll('.btn-enter-biz').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await tenantManager.selectLocal(id);
            store.setCurrentView('DAY');
            toast.info(`Ingresando a: ${tenantManager.getActiveBusiness().name}`);
        });
    });

    // Registrar nuevo negocio
    container.querySelector('#btn-add-global-biz')?.addEventListener('click', () => {
        openCreateBusinessModal(container);
    });

    // Crear nuevo encargado
    container.querySelector('#btn-create-manager')?.addEventListener('click', () => {
        openCreateManagerModal(container);
    });

    // Eliminar Negocio en Cascada
    container.querySelectorAll('.btn-delete-biz-cascade').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const biz = tenantManager.getBusinessById(id);
            const confirmed = confirm(
                `⚠️ ELIMINACIÓN EN CASCADA:\n\n¿Estás seguro de eliminar el local "${biz.name}"?\n\n` +
                `Se eliminarán permanentemente todas sus máquinas, horarios, reservaciones y cuentas de encargados asignadas a este local.`
            );

            if (confirmed) {
                try {
                    await tenantManager.deleteBusiness(id);
                    toast.warning(`Local "${biz.name}" y todos sus datos asociados fueron eliminados.`);
                    renderSuperadminView(container);
                } catch (e) {
                    toast.error(e.message);
                }
            }
        });
    });

    // Eliminar Encargado
    container.querySelectorAll('.btn-delete-staff').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Eliminar esta cuenta de encargado?")) {
                await authManager.deleteStaffManager(id);
                toast.info("Cuenta de encargado eliminada.");
                renderSuperadminView(container);
            }
        });
    });
}

function renderTabContent(tab, businesses, staffUsers, managers) {
    if (tab === 'BUSINESSES') {
        return `
            <div class="settings-card">
                <div class="card-title-bar">
                    <div class="title-with-icon">
                        <span class="t-icon">🏢</span>
                        <div>
                            <h3>Catálogo Global de Locales y Enlaces de Acceso</h3>
                            <small>Cada negocio opera de manera aislada con su propio enlace directo</small>
                        </div>
                    </div>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Local / Negocio</th>
                                <th>Ubicación</th>
                                <th>Horarios</th>
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
                                                <input type="text" readonly value="${clientUrl}" class="cyber-input" style="font-size:0.75rem; padding:4px 8px; max-width:190px; background:var(--bg-dark-800);">
                                                <button class="btn btn-outline btn-xs btn-copy-link" data-url="${clientUrl}" title="Copiar enlace del cliente">
                                                    📋 Copiar
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <div style="display:flex; gap:6px;">
                                                <button class="btn btn-primary btn-xs btn-enter-biz glow-red" data-id="${b.id}">
                                                    ⚡ Entrar
                                                </button>
                                                ${businesses.length > 1 ? `
                                                    <button class="btn btn-danger btn-xs btn-delete-biz-cascade" data-id="${b.id}" title="Eliminar local y todos sus datos en cascada">
                                                        🗑️ Eliminar
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    if (tab === 'MACHINES') {
        const currentBiz = store.currentBusiness || businesses[0];
        const machines = store.getMachines();

        return `
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="title-with-icon">
                        <span class="t-icon">🕹️</span>
                        <div>
                            <h3>Catálogo de Máquinas de: ${currentBiz.name}</h3>
                            <small>Pistas registradas en la sucursal actual</small>
                        </div>
                    </div>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Máquina</th>
                                <th>Gabinete</th>
                                <th>Versión</th>
                                <th>Tarifa/hr</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${machines.map(m => `
                                <tr>
                                    <td><strong>${m.name}</strong></td>
                                    <td>${m.model}</td>
                                    <td><span class="badge badge-primary">${m.version}</span></td>
                                    <td><strong class="highlight-gold">${currentBiz.currencySymbol}${m.hourlyRate}</strong></td>
                                    <td>
                                        <span class="badge ${m.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}">
                                            ${m.status === 'AVAILABLE' ? 'DISPONIBLE' : 'MANTENIMIENTO'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    if (tab === 'STAFF') {
        return `
            <div class="settings-card">
                <div class="card-title-bar">
                    <div class="title-with-icon">
                        <span class="t-icon">👥</span>
                        <div>
                            <h3>Catálogo de Cuentas de Encargados y Superadministradores</h3>
                            <small>Administra quién tiene acceso a cada local</small>
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
                                <th>Local Asignado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${staffUsers.map(u => {
                                const biz = businesses.find(b => b.id === u.businessId);
                                const isSuper = u.role === 'SUPERADMIN';

                                return `
                                    <tr>
                                        <td><strong>${u.avatar || '👤'} ${u.name}</strong></td>
                                        <td><code>${u.username}</code></td>
                                        <td><code style="color:var(--piu-gold); font-weight:700;">${u.pin}</code></td>
                                        <td>
                                            <span class="badge ${isSuper ? 'badge-danger' : 'badge-warning'}">
                                                ${isSuper ? '👑 SUPERADMIN' : '🕹️ ENCARGADO'}
                                            </span>
                                        </td>
                                        <td>
                                            ${isSuper ? '<span class="highlight-cyan">Acceso a Todos los Locales</span>' : (biz ? biz.name : 'Sin asignar')}
                                        </td>
                                        <td>
                                            ${!isSuper ? `
                                                <button class="btn btn-danger btn-xs btn-delete-staff" data-id="${u.id}" title="Eliminar encargado">
                                                    🗑️ Eliminar
                                                </button>
                                            ` : '<span style="color:var(--text-dimmed); font-size:0.75rem;">Protegido</span>'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    return '';
}

function openCreateBusinessModal(container) {
    const contentHtml = `
        <form id="form-create-biz-global" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="new-b-name"><span class="neon-arrow">◆</span> Nombre del Local *</label>
                    <input type="text" id="new-b-name" class="cyber-input" placeholder="Ej. PIU Arena Guadalajara" required>
                </div>
                <div class="form-group">
                    <label for="new-b-icon"><span class="neon-arrow">◆</span> Emoji Logo</label>
                    <input type="text" id="new-b-icon" class="cyber-input" value="⚡" style="max-width:80px;">
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="new-b-city"><span class="neon-arrow">◆</span> Ciudad / Zona *</label>
                    <input type="text" id="new-b-city" class="cyber-input" placeholder="Ej. Guadalajara, Jal." required>
                </div>
                <div class="form-group">
                    <label for="new-b-wa"><span class="neon-arrow">◆</span> WhatsApp de Atención</label>
                    <input type="text" id="new-b-wa" class="cyber-input" placeholder="Ej. 3312345678">
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="new-b-open"><span class="neon-arrow">◆</span> Apertura</label>
                    <input type="time" id="new-b-open" class="cyber-input" value="11:00">
                </div>
                <div class="form-group">
                    <label for="new-b-close"><span class="neon-arrow">◆</span> Cierre</label>
                    <input type="time" id="new-b-close" class="cyber-input" value="22:00">
                </div>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-cb">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-submit-cb">🏢 Crear Local</button>
    `;

    const modalEl = modal.open({
        title: 'Registrar Nuevo Local / Sucursal',
        icon: '🏢',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    modalEl.querySelector('#btn-cancel-cb').onclick = () => modal.close();

    modalEl.querySelector('#btn-submit-cb').onclick = async () => {
        const name = modalEl.querySelector('#new-b-name').value.trim();
        const city = modalEl.querySelector('#new-b-city').value.trim();
        const logoIcon = modalEl.querySelector('#new-b-icon').value.trim() || '🕹️';
        const whatsapp = modalEl.querySelector('#new-b-wa').value.trim();
        const openingTime = modalEl.querySelector('#new-b-open').value;
        const closingTime = modalEl.querySelector('#new-b-close').value;

        if (!name || !city) {
            toast.error("Por favor ingresa nombre y ciudad.");
            return;
        }

        try {
            await tenantManager.createBusiness({ name, city, logoIcon, whatsapp, openingTime, closingTime });
            modal.close();
            toast.success(`¡Local "${name}" creado exitosamente!`);
            renderSuperadminView(container);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

function openCreateManagerModal(container) {
    const businesses = tenantManager.getAllBusinesses();
    const bizOptions = businesses.map(b => `<option value="${b.id}">${b.name} (${b.city})</option>`).join('');

    const contentHtml = `
        <form id="form-create-manager" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mgr-name"><span class="neon-arrow">◆</span> Nombre del Encargado *</label>
                    <input type="text" id="mgr-name" class="cyber-input" placeholder="Ej. Roberto Martínez" required>
                </div>
                <div class="form-group">
                    <label for="mgr-user"><span class="neon-arrow">◆</span> Usuario de Acceso *</label>
                    <input type="text" id="mgr-user" class="cyber-input" placeholder="Ej. manager_gdl" required>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mgr-pin"><span class="neon-arrow">◆</span> PIN de Acceso *</label>
                    <input type="password" id="mgr-pin" class="cyber-input" placeholder="Ej. 1234" maxlength="6" required>
                </div>
                <div class="form-group">
                    <label for="mgr-biz"><span class="neon-arrow">◆</span> Local Asignado *</label>
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
        title: 'Crear Cuenta de Encargado',
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
            toast.error("Por favor completa los campos requeridos.");
            return;
        }

        try {
            await authManager.createStaffManager({ name, username, pin, businessId });
            modal.close();
            toast.success(`Encargado "${name}" creado exitosamente.`);
            renderSuperadminView(container);
        } catch (e) {
            toast.error(e.message);
        }
    };
}
