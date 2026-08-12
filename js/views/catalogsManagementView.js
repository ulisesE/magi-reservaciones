// js/views/catalogsManagementView.js
// Módulo centralizado de administración de catálogos (Versiones de Juego, Reglas Operativas, Máquinas y Personal)
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { catalogsManager } from '../core/catalogsManager.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

let activeCatalogTab = 'VERSIONS'; // 'VERSIONS', 'RULES', 'MACHINES_OVERVIEW'

export function renderCatalogsManagementView(container) {
    const businesses = tenantManager.getAllBusinesses();
    const gameVersions = catalogsManager.getGameVersions();
    const isSuperAdmin = authManager.isSuperAdmin();

    container.innerHTML = `
        <div class="catalogs-view-wrapper animate-fade-in">
            <!-- Header -->
            <div class="view-header-bar">
                <div class="header-left">
                    <h2 class="friendly-date-title">🗄️ Administración de Catálogos Maestros</h2>
                    <p class="subtitle-text">Control de versiones de juego compatibles, reglas operativas y asignación de activos.</p>
                </div>
            </div>

            <!-- Navegación de Pestañas de Catálogos -->
            <div class="requests-filter-bar" style="margin-bottom:20px;">
                <button class="filter-tab ${activeCatalogTab === 'VERSIONS' ? 'active' : ''}" data-cat-tab="VERSIONS">
                    <span>💿 Versiones de Juego (${gameVersions.length})</span>
                </button>
                <button class="filter-tab ${activeCatalogTab === 'RULES' ? 'active' : ''}" data-cat-tab="RULES">
                    <span>⏰ Reglas y Horarios por Negocio</span>
                </button>
            </div>

            <!-- Contenido de Pestaña -->
            <div id="catalog-tab-content">
                ${renderCatalogContent(activeCatalogTab, gameVersions, businesses)}
            </div>
        </div>
    `;

    // Eventos de Pestañas
    container.querySelectorAll('.filter-tab[data-cat-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            activeCatalogTab = tab.dataset.catTab;
            renderCatalogsManagementView(container);
        });
    });

    // Eventos de Versiones de Juego
    container.querySelector('#btn-add-game-ver')?.addEventListener('click', () => {
        openGameVersionModal(null, container);
    });

    container.querySelectorAll('.btn-edit-game-ver').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const version = catalogsManager.getGameVersions().find(v => v.id === id);
            if (version) openGameVersionModal(version, container);
        });
    });

    container.querySelectorAll('.btn-delete-game-ver').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Eliminar esta versión de juego del catálogo maestro?")) {
                await catalogsManager.deleteGameVersion(id);
                toast.info("Versión eliminada del catálogo.");
                renderCatalogsManagementView(container);
            }
        });
    });
}

function renderCatalogContent(tab, gameVersions, businesses) {
    if (tab === 'VERSIONS') {
        return `
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">💿</span>
                        <div>
                            <h3>Catálogo Maestro de Versiones de Software PIU</h3>
                            <small>Versiones de Pump It Up disponibles para asociar a las máquinas</small>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm glow-red" id="btn-add-game-ver">
                        <span>➕ Agregar Versión de Juego</span>
                    </button>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Nombre de Versión</th>
                                <th>Año</th>
                                <th>Último Parche</th>
                                <th>Modos Soportados</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${gameVersions.map(v => `
                                <tr>
                                    <td><strong style="color:#ffffff;">${v.name}</strong></td>
                                    <td>${v.releaseYear}</td>
                                    <td><code>${v.latestPatch}</code></td>
                                    <td>
                                        <div style="display:flex; gap:4px; flex-wrap:wrap;">
                                            ${(v.supportedModes || []).map(m => `<span class="badge badge-dark" style="font-size:0.68rem;">${m}</span>`).join('')}
                                        </div>
                                    </td>
                                    <td>
                                        <span class="badge ${v.status === 'CURRENT' ? 'badge-success' : 'badge-warning'}">
                                            ${v.status === 'CURRENT' ? 'OFICIAL / VIGENTE' : 'LEGACY'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="display:flex; gap:6px;">
                                            <button class="btn btn-outline btn-xs btn-edit-game-ver" data-id="${v.id}">✏️ Editar</button>
                                            <button class="btn btn-danger btn-xs btn-delete-game-ver" data-id="${v.id}" title="Eliminar versión">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    if (tab === 'RULES') {
        return `
            <div class="settings-card">
                <div class="card-title-bar">
                    <div class="title-with-icon">
                        <span class="t-icon">⏰</span>
                        <div>
                            <h3>Catálogo de Horarios de Apertura y Duración por Negocio</h3>
                            <small>Configuración de bloques horarios por cada sucursal</small>
                        </div>
                    </div>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Sucursal / Local</th>
                                <th>Ubicación</th>
                                <th>Hora Apertura</th>
                                <th>Hora Cierre</th>
                                <th>Duración del Bloque</th>
                                <th>Moneda</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${businesses.map(b => `
                                <tr>
                                    <td><strong>${b.logoIcon || '🕹️'} ${b.name}</strong></td>
                                    <td>${b.city}</td>
                                    <td><span class="badge badge-dark">${b.openingTime}</span></td>
                                    <td><span class="badge badge-dark">${b.closingTime}</span></td>
                                    <td><span class="badge badge-primary">${b.slotDuration || 60} Minutos</span></td>
                                    <td><strong class="highlight-gold">${b.currencySymbol} (${b.currency})</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    return '';
}

function openGameVersionModal(version = null, mainContainer) {
    const isEdit = !!version;

    const contentHtml = `
        <form id="form-game-ver" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="ver-name"><span class="neon-arrow">◆</span> Nombre de la Versión *</label>
                    <input type="text" id="ver-name" class="cyber-input" value="${version ? version.name : ''}" placeholder="Ej. Pump It Up Phoenix" required>
                </div>
                <div class="form-group">
                    <label for="ver-year"><span class="neon-arrow">◆</span> Año de Lanzamiento *</label>
                    <input type="number" id="ver-year" class="cyber-input" value="${version ? version.releaseYear : new Date().getFullYear()}" required>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="ver-patch"><span class="neon-arrow">◆</span> Versión / Parche Actual</label>
                    <input type="text" id="ver-patch" class="cyber-input" value="${version ? version.latestPatch : 'v1.00.0'}" placeholder="v1.08.0">
                </div>
                <div class="form-group">
                    <label for="ver-status"><span class="neon-arrow">◆</span> Estado en Catálogo</label>
                    <select id="ver-status" class="cyber-select">
                        <option value="CURRENT" ${version?.status === 'CURRENT' ? 'selected' : ''}>Oficial / Vigente (Actual)</option>
                        <option value="LEGACY" ${version?.status === 'LEGACY' ? 'selected' : ''}>Legacy / Versión Anterior</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label for="ver-modes"><span class="neon-arrow">◆</span> Modos Soportados (separados por coma)</label>
                <input type="text" id="ver-modes" class="cyber-input" value="${version ? (version.supportedModes || []).join(', ') : 'Single, Double, Co-Op, Premium Mode'}" placeholder="Single, Double, Co-Op">
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-ver">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-ver">
            ${isEdit ? '💾 Guardar Cambios' : '➕ Agregar al Catálogo'}
        </button>
    `;

    const modalEl = modal.open({
        title: isEdit ? `Editar Versión: ${version.name}` : 'Registrar Nueva Versión de Software',
        icon: '💿',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    modalEl.querySelector('#btn-cancel-ver').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-ver').onclick = async () => {
        const name = modalEl.querySelector('#ver-name').value.trim();
        const releaseYear = modalEl.querySelector('#ver-year').value;
        const latestPatch = modalEl.querySelector('#ver-patch').value.trim();
        const status = modalEl.querySelector('#ver-status').value;
        const modesRaw = modalEl.querySelector('#ver-modes').value.trim();
        const supportedModes = modesRaw ? modesRaw.split(',').map(m => m.trim()).filter(Boolean) : ['Single', 'Double'];

        if (!name) {
            toast.error("Por favor ingresa el nombre de la versión.");
            return;
        }

        try {
            if (isEdit) {
                await catalogsManager.updateGameVersion(version.id, { name, releaseYear, latestPatch, status, supportedModes });
                toast.success("Versión de software actualizada.");
            } else {
                await catalogsManager.addGameVersion({ name, releaseYear, latestPatch, status, supportedModes });
                toast.success("Nueva versión de software registrada.");
            }
            modal.close();
            renderCatalogsManagementView(mainContainer);
        } catch (e) {
            toast.error(e.message);
        }
    };
}
