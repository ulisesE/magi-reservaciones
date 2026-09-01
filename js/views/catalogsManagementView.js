// js/views/catalogsManagementView.js
// Módulo centralizado de administración de catálogos para el Encargado del Local
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { catalogsManager } from '../core/catalogsManager.js';
import { accountManager } from '../core/accountManager.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { DAYS_OF_WEEK, format12Hour, timeToMinutes } from '../core/timeUtils.js';
import { loyaltyManager } from '../core/loyaltyManager.js';

let activeCatalogTab = 'PRODUCTS'; // 'PRODUCTS', 'FEATURES', 'RULES', 'VERSIONS', 'REWARDS'

export async function renderCatalogsManagementView(container) {
    const business = store.currentBusiness || tenantManager.getActiveBusiness();
    const businesses = tenantManager.getAllBusinesses();
    const gameVersions = catalogsManager.getGameVersions();
    const features = await catalogsManager.getFeaturesByBusiness(business.id);
    const rewards = await loyaltyManager.getRewardsCatalog(business.id);
    const products = await accountManager.getProducts(business.id);
    const isSuperAdmin = authManager.isSuperAdmin();

    container.innerHTML = `
        <div class="catalogs-view-wrapper animate-fade-in">
            <!-- Header -->
            <div class="view-header-bar">
                <div class="header-left">
                    <h2 class="friendly-date-title">🗄️ Administración de Catálogos de la Sucursal</h2>
                    <p class="subtitle-text">Configuración de productos en venta, hardware, periféricos y horarios de <strong>${business.name}</strong></p>
                </div>
            </div>

            <!-- Navegación de Pestañas de Catálogos -->
            <div class="requests-filter-bar" style="margin-bottom:20px;">
                <button class="filter-tab ${activeCatalogTab === 'PRODUCTS' ? 'active' : ''}" data-cat-tab="PRODUCTS">
                    <span>🛍️ Productos y Precios (${products.length})</span>
                </button>
                <button class="filter-tab ${activeCatalogTab === 'FEATURES' ? 'active' : ''}" data-cat-tab="FEATURES">
                    <span>🔌 Accesorios y Hardware (${features.length})</span>
                </button>
                <button class="filter-tab ${activeCatalogTab === 'RULES' ? 'active' : ''}" data-cat-tab="RULES">
                    <span>⏰ Reglas y Horarios de Sucursal</span>
                </button>
                <button class="filter-tab ${activeCatalogTab === 'VERSIONS' ? 'active' : ''}" data-cat-tab="VERSIONS">
                    <span>💿 Versiones de Software PIU (${gameVersions.length})</span>
                </button>
                <button class="filter-tab ${activeCatalogTab === 'REWARDS' ? 'active' : ''}" data-cat-tab="REWARDS">
                    <span>🎁 Premios de Lealtad (${rewards.length})</span>
                </button>
            </div>

            <!-- Contenido de Pestaña -->
            <div id="catalog-tab-content">
                ${renderCatalogContent(activeCatalogTab, features, gameVersions, businesses, business, isSuperAdmin, rewards, products)}
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
    // Eventos de Productos y Precios (Local)
    // ==========================================
    container.querySelector('#btn-add-product')?.addEventListener('click', () => {
        openProductModal(business.id, null, container);
    });

    container.querySelectorAll('.btn-edit-product').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const prod = products.find(p => p.id === id);
            if (prod) openProductModal(business.id, prod, container);
        });
    });

    container.querySelectorAll('.btn-delete-product').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Estás seguro de eliminar este producto del catálogo de la sala?")) {
                await accountManager.deleteProduct(business.id, id);
                toast.info("Producto eliminado del catálogo.");
                renderCatalogsManagementView(container);
            }
        });
    });

    // ==========================================
    // Eventos de Recompensas (Local)
    // ==========================================
    container.querySelector('#btn-add-reward')?.addEventListener('click', () => {
        openRewardModal(business.id, null, container);
    });

    container.querySelectorAll('.btn-edit-reward').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const rew = rewards.find(r => r.id === id);
            if (rew) openRewardModal(business.id, rew, container);
        });
    });

    container.querySelectorAll('.btn-delete-reward').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Estás seguro de eliminar este premio del catálogo del local?")) {
                await loyaltyManager.deleteReward(business.id, id);
                toast.info("Premio eliminado del catálogo.");
                renderCatalogsManagementView(container);
            }
        });
    });

    container.querySelector('#btn-edit-tiers')?.addEventListener('click', () => {
        openConfigureTiersModal(business, container);
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
            await catalogsManager.toggleFeatureStatus(business.id, id, current);
            toast.info("Estado del accesorio actualizado.");
            renderCatalogsManagementView(container);
        });
    });

    container.querySelectorAll('.btn-delete-feature').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Estás seguro de eliminar este componente del catálogo del local?")) {
                await catalogsManager.deleteFeature(business.id, id);
                toast.info("Accesorio eliminado.");
                renderCatalogsManagementView(container);
            }
        });
    });

    // ==========================================
    // Eventos de Versiones de Software (Solo Superadmin)
    // ==========================================
    if (isSuperAdmin) {
        container.querySelector('#btn-add-version')?.addEventListener('click', () => {
            openGameVersionModal(null, container);
        });

        container.querySelectorAll('.btn-edit-version').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const v = gameVersions.find(gv => gv.id === id);
                if (v) openGameVersionModal(v, container);
            });
        });

        container.querySelectorAll('.btn-delete-version').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (confirm("⚠️ ¿Estás seguro de eliminar esta versión de juego del catálogo global?")) {
                    await catalogsManager.deleteGameVersion(id);
                    toast.info("Versión eliminada del catálogo.");
                    renderCatalogsManagementView(container);
                }
            });
        });
    }

    // Evento de redirección a Ajustes del Local
    container.querySelector('#btn-edit-rules-shortcut')?.addEventListener('click', () => {
        store.setCurrentView('BUSINESS');
    });
}

function renderCatalogContent(tab, features, gameVersions, businesses, currentBusiness, isSuperAdmin, rewards = [], products = []) {
    if (tab === 'PRODUCTS') {
        return `
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">🛍️</span>
                        <div>
                            <h3>Catálogo de Productos y Precios en Sala</h3>
                            <small>Configura los artículos, bebidas, fichas y snacks con sus precios de venta en ${currentBusiness.name}</small>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm glow-red" id="btn-add-product">
                        <span>➕ Registrar Nuevo Producto</span>
                    </button>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Icono</th>
                                <th>Producto / Artículo</th>
                                <th>Categoría</th>
                                <th>Precio Unitario</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.length === 0 ? `
                                <tr>
                                    <td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">
                                        No hay productos registrados en este local. Haz clic en "➕ Registrar Nuevo Producto".
                                    </td>
                                </tr>
                            ` : products.map(p => {
                                const isActive = p.status === 'ACTIVE';
                                return `
                                    <tr>
                                        <td style="font-size:1.6rem; text-align:center;">${p.icon || '🛍️'}</td>
                                        <td><strong style="color:#ffffff; font-size:0.95rem;">${p.name}</strong></td>
                                        <td><span class="badge badge-primary">${(p.category || 'otro').toUpperCase()}</span></td>
                                        <td><strong class="highlight-gold" style="font-size:1.05rem; font-family:var(--font-mono);">${currentBusiness.currencySymbol || '$'}${Number(p.price).toFixed(2)}</strong></td>
                                        <td>
                                            <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">
                                                ${isActive ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style="display:flex; gap:6px;">
                                                <button class="btn btn-outline btn-xs btn-edit-product" data-id="${p.id}">✏️ Editar</button>
                                                <button class="btn btn-danger btn-xs btn-delete-product" data-id="${p.id}" title="Eliminar producto">🗑️</button>
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
                            <small>${isSuperAdmin ? 'Configuración de bloques horarios por cada sucursal' : 'Reglas operativas y del local'}</small>
                        </div>
                    </div>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Sucursal / Local</th>
                                <th>Ubicación</th>
                                <th>Horario General</th>
                                <th>Duración del Bloque</th>
                                <th>Moneda</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayedBusinesses.map(b => {
                                const openMinutes = timeToMinutes(b.openingTime);
                                const closeMinutes = timeToMinutes(b.closingTime);
                                const isOvernight = closeMinutes < openMinutes;
                                const hoursLabel = `${format12Hour(b.openingTime)} - ${format12Hour(b.closingTime)}${isOvernight ? ' (Siguiente día)' : ''}`;
                                return `
                                    <tr>
                                        <td><strong>${b.logoIcon || '🕹️'} ${b.name}</strong></td>
                                        <td>${b.city}</td>
                                        <td><span class="badge badge-dark">${hoursLabel}</span></td>
                                        <td><span class="badge badge-primary">${b.slotDuration || 60} Minutos</span></td>
                                        <td><strong class="highlight-gold">${b.currencySymbol} (${b.currency})</strong></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            ${currentBusiness ? `
                <div class="settings-card" style="margin-top: 20px;">
                    <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div class="title-with-icon">
                            <span class="t-icon">📅</span>
                            <div>
                                <h3>Horario Operativo Semanal Detallado</h3>
                                <span>Revisa los horarios específicos configurados por día para <strong>${currentBusiness.name}</strong></span>
                            </div>
                        </div>
                        <button class="btn btn-primary btn-sm glow-red" id="btn-edit-rules-shortcut">
                            ⚙️ Configurar Horarios en Ajustes
                        </button>
                    </div>

                    <div class="catalogs-table-wrapper">
                        <table class="catalogs-table">
                            <thead>
                                <tr>
                                    <th>Día de la Semana</th>
                                    <th>Estado</th>
                                    <th>Hora Apertura</th>
                                    <th>Hora Cierre</th>
                                    <th>Rango de Servicio</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${DAYS_OF_WEEK.map(day => {
                                    const dayConfig = currentBusiness.operatingHours?.[day.id] || currentBusiness.operatingHours?.[String(day.id)] || {
                                        open: currentBusiness.openingTime || '11:00',
                                        close: currentBusiness.closingTime || '22:00',
                                        closed: false
                                    };
                                    const isOpen = !dayConfig.closed;
                                    const isOvernight = isOpen && timeToMinutes(dayConfig.close) < timeToMinutes(dayConfig.open);
                                    const rangeLabel = dayConfig.closed 
                                        ? '<span style="color:var(--text-muted);">Cerrado</span>' 
                                        : `${format12Hour(dayConfig.open)} - ${format12Hour(dayConfig.close)}${isOvernight ? ' <small style="color:var(--color-neon-lime);">(Siguiente día)</small>' : ''}`;
                                    
                                    return `
                                        <tr>
                                            <td><strong style="color:#ffffff;">${day.name}</strong></td>
                                            <td>
                                                <span class="badge ${isOpen ? 'badge-success' : 'badge-danger'}">
                                                    ${isOpen ? 'ABIERTO' : 'CERRADO'}
                                                </span>
                                            </td>
                                            <td>${isOpen ? `<code>${dayConfig.open}</code>` : '-'}</td>
                                            <td>${isOpen ? `<code>${dayConfig.close}</code>` : '-'}</td>
                                            <td>${rangeLabel}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
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

    if (tab === 'REWARDS') {
        const isVisitsMode = store.currentBusiness?.loyaltyMode === 'VISITS';
        const activeMode = currentBusiness.loyaltyMode || 'POINTS';
        const tiers = loyaltyManager.getBusinessTiers(currentBusiness);

        return `
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">🎁</span>
                        <div>
                            <h3>Catálogo de Premios y Recompensas de Lealtad</h3>
                            <small>Premios y artículos que los clientes pueden canjear en la sucursal con sus puntos</small>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm glow-red" id="btn-add-reward">
                        <span>➕ Registrar Nuevo Premio</span>
                    </button>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Icono</th>
                                <th>Nombre del Premio</th>
                                <th>Costo (${isVisitsMode ? 'Visitas' : 'Puntos'})</th>
                                <th>Descripción</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rewards.map(r => {
                                const isActive = r.active !== false;
                                return `
                                    <tr>
                                        <td style="font-size:1.5rem; text-align:center;">${r.icon || '🎁'}</td>
                                        <td><strong style="color:#ffffff;">${r.name}</strong></td>
                                        <td><span class="badge badge-success" style="font-weight:bold; font-size:0.85rem;">${r.costPoints} ${isVisitsMode ? 'Visitas' : 'Puntos'}</span></td>
                                        <td style="font-size:0.82rem; color:var(--text-secondary);">${r.description || 'Sin descripción'}</td>
                                        <td>
                                            <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">
                                                ${isActive ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style="display:flex; gap:6px;">
                                                <button class="btn btn-outline btn-xs btn-edit-reward" data-id="${r.id}">✏️ Editar</button>
                                                <button class="btn btn-danger btn-xs btn-delete-reward" data-id="${r.id}" title="Eliminar premio">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Estructura de Niveles y Beneficios por Local -->
            <div class="settings-card" style="margin-top:24px;">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">🏆</span>
                        <div>
                            <h3>Estructura de Niveles (Tiers) y Beneficios</h3>
                            <small>Rangos de fidelización y porcentajes de descuento por nivel para <strong>${currentBusiness.name}</strong></small>
                        </div>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-edit-tiers" style="background:transparent; border:1px solid var(--border-color); color:#fff; font-weight:700;">
                        ✏️ Configurar Niveles y Beneficios
                    </button>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Icono</th>
                                <th>Nombre del Nivel</th>
                                <th>Requisito (${isVisitsMode ? 'Visitas' : 'Puntos'})</th>
                                <th>Descuento Directo</th>
                                <th>Color de Badge</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.values(tiers).map(t => {
                                const requirement = activeMode === 'VISITS' 
                                    ? (t.name === 'Bronce' ? '0 visitas' : `${t.minVisits}+ visitas`)
                                    : (t.name === 'Bronce' ? '0 pts' : `${t.minPoints}+ pts`);
                                return `
                                    <tr>
                                        <td style="font-size:1.5rem; text-align:center;">${t.badge}</td>
                                        <td>
                                            <span class="badge ${t.class}" style="font-size:0.85rem; padding:4px 8px;">${t.name}</span>
                                        </td>
                                        <td><code style="font-size:0.9rem;">${requirement}</code></td>
                                        <td><strong style="color:var(--color-neon-lime); font-size:0.95rem;">${t.discount * 100}%</strong></td>
                                        <td><span style="display:inline-block; width:14px; height:14px; border-radius:50%; background:${t.color}; margin-right:6px; vertical-align:middle;"></span> <code>${t.color}</code></td>
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

function openRewardModal(businessId, reward = null, mainContainer) {
    const isEdit = !!reward;
    const REWARD_ICONS = ['🎁', '💳', '🎟️', '🥤', '🦶', '⚡', '🎧', '🔑', '🎒', '👕', '🌟', '🏆', '🍿'];

    const contentHtml = `
        <form id="form-reward" class="cyber-form">
            <div class="form-group">
                <label><span class="neon-arrow">◆</span> Icono del Premio</label>
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                    ${REWARD_ICONS.map(ic => `
                        <button type="button" class="btn btn-outline btn-xs btn-rew-icon ${ic === (reward?.icon || '🎁') ? 'active glow-red' : ''}" data-icon="${ic}" style="font-size:1.2rem; padding:4px 8px;">
                            ${ic}
                        </button>
                    `).join('')}
                </div>
                <input type="hidden" id="rew-icon" value="${reward ? reward.icon : '🎁'}">
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="rew-name"><span class="neon-arrow">◆</span> Nombre del Premio *</label>
                    <input type="text" id="rew-name" class="cyber-input" value="${reward ? reward.name : ''}" placeholder="Ej. 1 Hora de Juego Gratis" required>
                </div>
                <div class="form-group">
                    <label for="rew-points"><span class="neon-arrow">◆</span> Costo en ${store.currentBusiness?.loyaltyMode === 'VISITS' ? 'Visitas' : 'Puntos'} *</label>
                    <input type="number" id="rew-points" class="cyber-input" value="${reward ? reward.costPoints : '50'}" min="1" required>
                </div>
            </div>

            <div class="form-group">
                <label for="rew-desc"><span class="neon-arrow">◆</span> Descripción / Términos del Premio *</label>
                <textarea id="rew-desc" class="cyber-textarea" rows="3" placeholder="Ej. Válido para cualquier día de la semana..." required>${reward ? reward.description : ''}</textarea>
            </div>

            <div class="form-group">
                <label for="rew-active"><span class="neon-arrow">◆</span> Estado en Catálogo</label>
                <select id="rew-active" class="cyber-select">
                    <option value="true" ${reward?.active !== false ? 'selected' : ''}>Activo (Disponible para canje)</option>
                    <option value="false" ${reward?.active === false ? 'selected' : ''}>Inactivo (Ocultar temporalmente)</option>
                </select>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-rew">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-rew">
            ${isEdit ? '💾 Guardar Cambios' : '➕ Registrar Premio'}
        </button>
    `;

    const modalEl = modal.open({
        title: isEdit ? `Editar Premio: ${reward.name}` : 'Registrar Nuevo Premio de Lealtad',
        icon: '🎁',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    modalEl.querySelectorAll('.btn-rew-icon').forEach(btn => {
        btn.addEventListener('click', () => {
            modalEl.querySelectorAll('.btn-rew-icon').forEach(b => b.classList.remove('active', 'glow-red'));
            btn.classList.add('active', 'glow-red');
            modalEl.querySelector('#rew-icon').value = btn.dataset.icon;
        });
    });

    modalEl.querySelector('#btn-cancel-rew').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-rew').onclick = async () => {
        const name = modalEl.querySelector('#rew-name').value.trim();
        const costPoints = parseInt(modalEl.querySelector('#rew-points').value, 10);
        const description = modalEl.querySelector('#rew-desc').value.trim();
        const icon = modalEl.querySelector('#rew-icon').value;
        const active = modalEl.querySelector('#rew-active').value === 'true';

        if (!name || !costPoints || !description) {
            toast.error("Por favor completa todos los campos marcados con asterisco.");
            return;
        }

        try {
            if (isEdit) {
                await loyaltyManager.updateReward(businessId, reward.id, {
                    name, costPoints, description, icon, active
                });
                toast.success(`Premio "${name}" actualizado.`);
            } else {
                await loyaltyManager.addReward(businessId, {
                    name, costPoints, description, icon, active
                });
                toast.success(`Premio "${name}" registrado en la sucursal.`);
            }
            modal.close();
            renderCatalogsManagementView(mainContainer);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

function openConfigureTiersModal(business, mainContainer) {
    const activeMode = business.loyaltyMode || 'POINTS';
    const tiers = loyaltyManager.getBusinessTiers(business);

    const contentHtml = `
        <form id="form-configure-tiers" class="cyber-form">
            <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:14px;">
                Configura los requisitos de entrada y descuentos en porcentaje (%) para cada nivel en este local.
            </p>
            
            <!-- Bronce -->
            <div style="background:var(--bg-dark-700); padding:10px 14px; border-radius:4px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="font-size:1.2rem; margin-right:6px;">🟫</span>
                    <strong>Bronce (Inicial)</strong>
                </div>
                <div style="font-size:0.85rem; color:var(--text-muted);">
                    Por defecto: 0 ${activeMode === 'VISITS' ? 'visitas' : 'pts'} | 0% desc.
                </div>
            </div>

            <!-- Plata -->
            <div style="border:1px solid var(--border-color); padding:14px; border-radius:4px; margin-bottom:14px; background:rgba(255,255,255,0.01);">
                <h4 style="margin:0 0 10px 0; color:#fff; display:flex; align-items:center; gap:6px;">
                    <span>⬜</span> Plata
                </h4>
                <div class="form-row grid-2">
                    <div class="form-group">
                        <label for="tier-plata-req"><span class="neon-arrow">◆</span> Requisito Mínimo (${activeMode === 'VISITS' ? 'Visitas' : 'Puntos'})</label>
                        <input type="number" id="tier-plata-req" class="cyber-input" value="${activeMode === 'VISITS' ? tiers.PLATA.minVisits : tiers.PLATA.minPoints}">
                    </div>
                    <div class="form-group">
                        <label for="tier-plata-desc"><span class="neon-arrow">◆</span> Descuento (%)</label>
                        <input type="number" id="tier-plata-desc" class="cyber-input" value="${tiers.PLATA.discount * 100}" min="0" max="100">
                    </div>
                </div>
            </div>

            <!-- Oro -->
            <div style="border:1px solid var(--border-color); padding:14px; border-radius:4px; margin-bottom:14px; background:rgba(255,255,255,0.01);">
                <h4 style="margin:0 0 10px 0; color:#fff; display:flex; align-items:center; gap:6px;">
                    <span>🟨</span> Oro
                </h4>
                <div class="form-row grid-2">
                    <div class="form-group">
                        <label for="tier-oro-req"><span class="neon-arrow">◆</span> Requisito Mínimo (${activeMode === 'VISITS' ? 'Visitas' : 'Puntos'})</label>
                        <input type="number" id="tier-oro-req" class="cyber-input" value="${activeMode === 'VISITS' ? tiers.ORO.minVisits : tiers.ORO.minPoints}">
                    </div>
                    <div class="form-group">
                        <label for="tier-oro-desc"><span class="neon-arrow">◆</span> Descuento (%)</label>
                        <input type="number" id="tier-oro-desc" class="cyber-input" value="${tiers.ORO.discount * 100}" min="0" max="100">
                    </div>
                </div>
            </div>

            <!-- Platino -->
            <div style="border:1px solid var(--border-color); padding:14px; border-radius:4px; margin-bottom:10px; background:rgba(255,255,255,0.01);">
                <h4 style="margin:0 0 10px 0; color:#fff; display:flex; align-items:center; gap:6px;">
                    <span>🟦</span> Platino
                </h4>
                <div class="form-row grid-2">
                    <div class="form-group">
                        <label for="tier-platino-req"><span class="neon-arrow">◆</span> Requisito Mínimo (${activeMode === 'VISITS' ? 'Visitas' : 'Puntos'})</label>
                        <input type="number" id="tier-platino-req" class="cyber-input" value="${activeMode === 'VISITS' ? tiers.PLATINO.minVisits : tiers.PLATINO.minPoints}">
                    </div>
                    <div class="form-group">
                        <label for="tier-platino-desc"><span class="neon-arrow">◆</span> Descuento (%)</label>
                        <input type="number" id="tier-platino-desc" class="cyber-input" value="${tiers.PLATINO.discount * 100}" min="0" max="100">
                    </div>
                </div>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-tiers">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-tiers">💾 Guardar Configuración</button>
    `;

    const modalEl = modal.open({
        title: `Niveles de Lealtad: ${business.name}`,
        icon: '🏆',
        contentHtml,
        footerHtml,
        maxWidth: '500px'
    });

    modalEl.querySelector('#btn-cancel-tiers').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-tiers').onclick = async () => {
        const plataReq = parseInt(modalEl.querySelector('#tier-plata-req').value, 10) || 0;
        const plataDesc = parseFloat(modalEl.querySelector('#tier-plata-desc').value) / 100 || 0;

        const oroReq = parseInt(modalEl.querySelector('#tier-oro-req').value, 10) || 0;
        const oroDesc = parseFloat(modalEl.querySelector('#tier-oro-desc').value) / 100 || 0;

        const platinoReq = parseInt(modalEl.querySelector('#tier-platino-req').value, 10) || 0;
        const platinoDesc = parseFloat(modalEl.querySelector('#tier-platino-desc').value) / 100 || 0;

        // Validaciones de progresión lógica
        if (plataReq >= oroReq || oroReq >= platinoReq) {
            toast.error("Los requisitos deben ir en progresión ascendente (Plata < Oro < Platino).");
            return;
        }

        const loyaltyTiers = {
            BRONCE: { minPoints: 0, minVisits: 0, discount: 0.00 },
            PLATA: {
                minPoints: activeMode === 'VISITS' ? plataReq * 10 : plataReq,
                minVisits: activeMode === 'VISITS' ? plataReq : Math.floor(plataReq / 10),
                discount: plataDesc
            },
            ORO: {
                minPoints: activeMode === 'VISITS' ? oroReq * 10 : oroReq,
                minVisits: activeMode === 'VISITS' ? oroReq : Math.floor(oroReq / 10),
                discount: oroDesc
            },
            PLATINO: {
                minPoints: activeMode === 'VISITS' ? platinoReq * 10 : platinoReq,
                minVisits: activeMode === 'VISITS' ? platinoReq : Math.floor(platinoReq / 10),
                discount: platinoDesc
            }
        };

        try {
            await tenantManager.updateBusiness(business.id, { loyaltyTiers });
            toast.success("Estructura de niveles y beneficios guardada exitosamente.");
            modal.close();
            renderCatalogsManagementView(mainContainer);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

function openProductModal(businessId, product = null, mainContainer) {
    const isEdit = !!product;
    const PRODUCT_ICONS = ['🥤', '🍺', '🍿', '🍫', '🪙', '🕹️', '🏆', '🛍️', '⚡', '☕', '🧁', '📦'];

    const contentHtml = `
        <form id="form-product" class="cyber-form">
            <div class="form-group">
                <label><span class="neon-arrow">◆</span> Icono del Producto</label>
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                    ${PRODUCT_ICONS.map(ic => `
                        <button type="button" class="btn btn-outline btn-xs btn-prod-icon ${ic === (product?.icon || '🥤') ? 'active glow-red' : ''}" data-icon="${ic}" style="font-size:1.3rem; padding:4px 8px;">
                            ${ic}
                        </button>
                    `).join('')}
                </div>
                <input type="hidden" id="prod-icon" value="${product ? product.icon : '🥤'}">
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="prod-name"><span class="neon-arrow">◆</span> Nombre del Producto / Artículo *</label>
                    <input type="text" id="prod-name" class="cyber-input" value="${product ? product.name : ''}" placeholder="Ej. Boing Mango 500ml" required>
                </div>
                <div class="form-group">
                    <label for="prod-category"><span class="neon-arrow">◆</span> Categoría *</label>
                    <select id="prod-category" class="cyber-select">
                        <option value="bebida" ${product?.category === 'bebida' ? 'selected' : ''}>🥤 Bebida / Hidratación</option>
                        <option value="alimento" ${product?.category === 'alimento' ? 'selected' : ''}>🍿 Alimento / Snack</option>
                        <option value="ficha" ${product?.category === 'ficha' ? 'selected' : ''}>🪙 Ficha / Token PIU</option>
                        <option value="juego" ${product?.category === 'juego' ? 'selected' : ''}>🕹️ Tiempo de Juego / Reta</option>
                        <option value="inscripcion" ${product?.category === 'inscripcion' ? 'selected' : ''}>🏆 Inscripción Torneo</option>
                        <option value="producto" ${product?.category === 'producto' ? 'selected' : ''}>🛍️ Accesorio / AM.PASS / Merch</option>
                        <option value="otro" ${product?.category === 'otro' ? 'selected' : ''}>📦 Otro / Varios</option>
                    </select>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="prod-price"><span class="neon-arrow">◆</span> Precio Unitario ($) *</label>
                    <input type="number" id="prod-price" class="cyber-input" value="${product ? product.price : 20}" min="0" step="0.5" placeholder="20.00" required>
                </div>
                <div class="form-group">
                    <label for="prod-status"><span class="neon-arrow">◆</span> Estado en Catálogo *</label>
                    <select id="prod-status" class="cyber-select">
                        <option value="ACTIVE" ${product?.status === 'ACTIVE' || !product ? 'selected' : ''}>🟢 Activo (Disponible para venta)</option>
                        <option value="INACTIVE" ${product?.status === 'INACTIVE' ? 'selected' : ''}>⚪ Inactivo (Oculto)</option>
                    </select>
                </div>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-prod">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-prod">💾 ${isEdit ? 'Guardar Cambios' : 'Registrar Producto'}</button>
    `;

    const modalEl = modal.open({
        title: isEdit ? `Editar Producto: ${product.name}` : 'Registrar Producto en Sala',
        icon: '🛍️',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    modalEl.querySelectorAll('.btn-prod-icon').forEach(btn => {
        btn.onclick = () => {
            modalEl.querySelectorAll('.btn-prod-icon').forEach(b => b.classList.remove('active', 'glow-red'));
            btn.classList.add('active', 'glow-red');
            modalEl.querySelector('#prod-icon').value = btn.dataset.icon;
        };
    });

    modalEl.querySelector('#btn-cancel-prod').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-prod').onclick = async () => {
        const name = modalEl.querySelector('#prod-name').value.trim();
        const category = modalEl.querySelector('#prod-category').value;
        const price = parseFloat(modalEl.querySelector('#prod-price').value) || 0;
        const status = modalEl.querySelector('#prod-status').value;
        const icon = modalEl.querySelector('#prod-icon').value || '🛍️';

        if (!name) {
            toast.error("El nombre del producto es obligatorio.");
            return;
        }

        try {
            await accountManager.saveProduct(businessId, {
                ...(product ? { id: product.id } : {}),
                name,
                category,
                price,
                status,
                icon
            });

            toast.success(isEdit ? `Producto "${name}" actualizado.` : `Producto "${name}" agregado al catálogo.`);
            modal.close();
            renderCatalogsManagementView(mainContainer);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

