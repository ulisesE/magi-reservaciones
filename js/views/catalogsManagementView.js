// js/views/catalogsManagementView.js
// Módulo centralizado de administración de catálogos para el Encargado del Local
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { catalogsManager } from '../core/catalogsManager.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

let activeCatalogTab = 'FEATURES'; // 'FEATURES', 'RULES', 'VERSIONS'

export async function renderCatalogsManagementView(container) {
    const business = store.currentBusiness || tenantManager.getActiveBusiness();
    const businesses = tenantManager.getAllBusinesses();
    const gameVersions = catalogsManager.getGameVersions();
    const features = await catalogsManager.getFeaturesByBusiness(business.id);
    const isSuperAdmin = authManager.isSuperAdmin();

    container.innerHTML = `
        <div class="catalogs-view-wrapper animate-fade-in">
            <!-- Header -->
            <div class="view-header-bar">
                <div class="header-left">
                    <h2 class="friendly-date-title">🗄️ Administración de Catálogos de la Sucursal</h2>
                    <p class="subtitle-text">Configuración de accesorios de hardware, periféricos (Pantallas, AM.PASS, Audio) y horarios de <strong>${business.name}</strong></p>
                </div>
            </div>

            <!-- Navegación de Pestañas de Catálogos -->
            <div class="requests-filter-bar" style="margin-bottom:20px;">
                <button class="filter-tab ${activeCatalogTab === 'FEATURES' ? 'active' : ''}" data-cat-tab="FEATURES">
                    <span>🔌 Accesorios y Hardware (${features.length})</span>
                </button>
                <button class="filter-tab ${activeCatalogTab === 'RULES' ? 'active' : ''}" data-cat-tab="RULES">
                    <span>⏰ Reglas y Horarios de Sucursal</span>
                </button>
                <button class="filter-tab ${activeCatalogTab === 'VERSIONS' ? 'active' : ''}" data-cat-tab="VERSIONS">
                    <span>💿 Versiones de Software PIU (${gameVersions.length})</span>
                </button>
            </div>

            <!-- Contenido de Pestaña -->
            <div id="catalog-tab-content">
                ${renderCatalogContent(activeCatalogTab, features, gameVersions, businesses, business, isSuperAdmin)}
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

    // ==========================================
    // Eventos de Accesorios / Hardware (Local)
    // ==========================================
    container.querySelector('#btn-add-feature')?.addEventListener('click', () => {
        openFeatureModal(business.id, null, container);
    });

    container.querySelectorAll('.btn-edit-feature').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const feat = features.find(f => f.id === id);
            if (feat) openFeatureModal(business.id, feat, container);
        });
    });

    container.querySelectorAll('.btn-toggle-feature').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const current = btn.dataset.current;
            const nextStatus = current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            try {
                await catalogsManager.updateFeature(business.id, id, { status: nextStatus });
                toast.success(`Accesorio ${nextStatus === 'ACTIVE' ? 'activado' : 'desactivado'} para el catálogo de máquinas.`);
                renderCatalogsManagementView(container);
            } catch (e) {
                toast.error(e.message);
            }
        });
    });

    container.querySelectorAll('.btn-delete-feature').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Eliminar este accesorio/hardware del catálogo del local?")) {
                await catalogsManager.deleteFeature(business.id, id);
                toast.info("Accesorio eliminado del catálogo.");
                renderCatalogsManagementView(container);
            }
        });
    });

    // ==========================================
    // Eventos de Versiones de Juego (Global)
    // ==========================================
    if (isSuperAdmin) {
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
}

function renderCatalogContent(tab, features, gameVersions, businesses, currentBusiness, isSuperAdmin) {
    if (tab === 'FEATURES') {
        return `
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">🔌</span>
                        <div>
                            <h3>Catálogo de Accesorios y Componentes de Hardware</h3>
                            <small>Componentes configurables para asociar a las máquinas de ${currentBusiness.name} (Pantallas, AM.PASS, Audio, Cámaras, etc.)</small>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm glow-red" id="btn-add-feature">
                        <span>➕ Registrar Nuevo Accesorio</span>
                    </button>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Icono</th>
                                <th>Nombre del Componente</th>
                                <th>Categoría</th>
                                <th>Descripción / Notas</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${features.map(f => {
                                const isActive = f.status === 'ACTIVE';
                                return `
                                    <tr>
                                        <td style="font-size:1.5rem; text-align:center;">${f.icon || '⚡'}</td>
                                        <td><strong style="color:#ffffff;">${f.name}</strong></td>
                                        <td><span class="badge badge-primary">${f.category || 'General'}</span></td>
                                        <td style="font-size:0.82rem; color:var(--text-secondary);">${f.description || 'Sin notas adicionales'}</td>
                                        <td>
                                            <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">
                                                ${isActive ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style="display:flex; gap:6px;">
                                                <button class="btn ${isActive ? 'btn-warning' : 'btn-success'} btn-xs btn-toggle-feature" data-id="${f.id}" data-current="${f.status}">
                                                    ${isActive ? 'Desactivar' : 'Activar'}
                                                </button>
                                                <button class="btn btn-outline btn-xs btn-edit-feature" data-id="${f.id}">✏️ Editar</button>
                                                <button class="btn btn-danger btn-xs btn-delete-feature" data-id="${f.id}" title="Eliminar componente">🗑️</button>
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

    if (tab === 'RULES') {
        const displayedBusinesses = isSuperAdmin ? businesses : [currentBusiness];
        return `
            <div class="settings-card">
                <div class="card-title-bar">
                    <div class="title-with-icon">
                        <span class="t-icon">⏰</span>
                        <div>
                            <h3>Horarios de Apertura y Duración ${isSuperAdmin ? 'por Negocio' : `de ${currentBusiness.name}`}</h3>
                            <small>${isSuperAdmin ? 'Configuración de bloques horarios por cada sucursal' : 'Reglas operativas y horarios configurados para esta sucursal'}</small>
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
                            ${displayedBusinesses.map(b => `
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

    if (tab === 'VERSIONS') {
        return `
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">💿</span>
                        <div>
                            <h3>Catálogo Maestro de Versiones de Software PIU</h3>
                            <small>Versiones globales registradas en la plataforma</small>
                        </div>
                    </div>
                    ${isSuperAdmin ? `
                        <button class="btn btn-primary btn-sm glow-red" id="btn-add-game-ver">
                            <span>➕ Agregar Versión de Juego</span>
                        </button>
                    ` : ''}
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
                                ${isSuperAdmin ? '<th>Acciones</th>' : ''}
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
                                    ${isSuperAdmin ? `
                                        <td>
                                            <div style="display:flex; gap:6px;">
                                                <button class="btn btn-outline btn-xs btn-edit-game-ver" data-id="${v.id}">✏️ Editar</button>
                                                <button class="btn btn-danger btn-xs btn-delete-game-ver" data-id="${v.id}" title="Eliminar versión">🗑️</button>
                                            </div>
                                        </td>
                                    ` : ''}
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

// ==========================================
// Modales de Gestión
// ==========================================
function openFeatureModal(businessId, feature = null, mainContainer) {
    const isEdit = !!feature;
    const FEATURE_ICONS = ['🖥️', '📺', '💳', '🏷️', '🔊', '🎧', '🦾', '📹', '✨', '⚡', '🦶', '🕹️', '🛡️', '⚙️'];

    const contentHtml = `
        <form id="form-feature" class="cyber-form">
            <div class="form-group">
                <label><span class="neon-arrow">◆</span> Icono Identificador</label>
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                    ${FEATURE_ICONS.map(ic => `
                        <button type="button" class="btn btn-outline btn-xs btn-feat-icon ${ic === (feature?.icon || '⚡') ? 'active glow-red' : ''}" data-icon="${ic}" style="font-size:1.2rem; padding:4px 8px;">
                            ${ic}
                        </button>
                    `).join('')}
                </div>
                <input type="hidden" id="feat-icon" value="${feature ? feature.icon : '⚡'}">
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="feat-name"><span class="neon-arrow">◆</span> Nombre del Componente *</label>
                    <input type="text" id="feat-name" class="cyber-input" value="${feature ? feature.name : ''}" placeholder="Ej. Pantalla 55\" 120Hz" required>
                </div>
                <div class="form-group">
                    <label for="feat-cat"><span class="neon-arrow">◆</span> Categoría *</label>
                    <select id="feat-cat" class="cyber-select">
                        <option value="Pantalla" ${feature?.category === 'Pantalla' ? 'selected' : ''}>Pantalla</option>
                        <option value="Lector AM.PASS" ${feature?.category === 'Lector AM.PASS' ? 'selected' : ''}>Lector AM.PASS</option>
                        <option value="Audio" ${feature?.category === 'Audio' ? 'selected' : ''}>Sistema de Audio</option>
                        <option value="Sensores" ${feature?.category === 'Sensores' ? 'selected' : ''}>Sensores / Pads</option>
                        <option value="Estructura" ${feature?.category === 'Estructura' ? 'selected' : ''}>Estructura / Barra</option>
                        <option value="Transmisión" ${feature?.category === 'Transmisión' ? 'selected' : ''}>Transmisión / Cámara</option>
                        <option value="Iluminación" ${feature?.category === 'Iluminación' ? 'selected' : ''}>Iluminación LED</option>
                        <option value="General" ${feature?.category === 'General' ? 'selected' : ''}>General / Extra</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label for="feat-desc"><span class="neon-arrow">◆</span> Descripción / Especificaciones</label>
                <textarea id="feat-desc" class="cyber-textarea" rows="2" placeholder="Ej. Lector oficial USB para tarjetas AM.PASS y PIU Profile">${feature ? feature.description : ''}</textarea>
            </div>

            <div class="form-group">
                <label for="feat-status"><span class="neon-arrow">◆</span> Estado en Catálogo</label>
                <select id="feat-status" class="cyber-select">
                    <option value="ACTIVE" ${feature?.status === 'ACTIVE' ? 'selected' : ''}>Activo (Disponible para seleccionar en máquinas)</option>
                    <option value="INACTIVE" ${feature?.status === 'INACTIVE' ? 'selected' : ''}>Inactivo (Ocultar temporalmente)</option>
                </select>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-feat">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-feat">
            ${isEdit ? '💾 Guardar Cambios' : '➕ Guardar Accesorio'}
        </button>
    `;

    const modalEl = modal.open({
        title: isEdit ? `Editar Accesorio: ${feature.name}` : 'Registrar Nuevo Componente / Accesorio',
        icon: '🔌',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    modalEl.querySelectorAll('.btn-feat-icon').forEach(btn => {
        btn.addEventListener('click', () => {
            modalEl.querySelectorAll('.btn-feat-icon').forEach(b => b.classList.remove('active', 'glow-red'));
            btn.classList.add('active', 'glow-red');
            modalEl.querySelector('#feat-icon').value = btn.dataset.icon;
        });
    });

    modalEl.querySelector('#btn-cancel-feat').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-feat').onclick = async () => {
        const name = modalEl.querySelector('#feat-name').value.trim();
        const category = modalEl.querySelector('#feat-cat').value;
        const icon = modalEl.querySelector('#feat-icon').value;
        const description = modalEl.querySelector('#feat-desc').value.trim();
        const status = modalEl.querySelector('#feat-status').value;

        if (!name) {
            toast.error("Por favor ingresa el nombre del accesorio.");
            return;
        }

        try {
            if (isEdit) {
                await catalogsManager.updateFeature(businessId, feature.id, {
                    name, category, icon, description, status
                });
                toast.success("Accesorio actualizado correctamente.");
            } else {
                await catalogsManager.addFeature(businessId, {
                    name, category, icon, description, status
                });
                toast.success("Nuevo accesorio agregado al catálogo.");
            }
            modal.close();
            renderCatalogsManagementView(mainContainer);
        } catch (e) {
            toast.error(e.message);
        }
    };
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
