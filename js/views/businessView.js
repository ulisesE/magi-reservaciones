import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { COLLECTIONS } from '../firebaseConfig.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export function renderBusinessView(container) {
    const business = store.currentBusiness;
    const allBusinesses = tenantManager.getAllBusinesses();
    const isSuperAdmin = authManager.isSuperAdmin();

    container.innerHTML = `
        <div class="business-view-wrapper animate-fade-in">
            <!-- Header -->
            <div class="view-header-bar">
                <div class="header-left">
                    <h2 class="friendly-date-title">🏢 Configuración de la Sucursal: ${business.name}</h2>
                    <p class="subtitle-text">Ajustes operativos, horarios de apertura y datos de contacto de esta sucursal.</p>
                </div>
                ${isSuperAdmin ? `
                    <button class="btn btn-primary glow-red" id="btn-create-biz">
                        <span>➕ Registrar Nueva Sucursal / Negocio</span>
                    </button>
                ` : ''}
            </div>

            <!-- Grid de Configuración -->
            <div class="settings-grid">
                <!-- Tarjeta de Sucursal Activa -->
                <div class="settings-card">
                    <div class="card-title-bar">
                        <div class="title-with-icon">
                            <span class="t-icon">${business.logoIcon || '🕹️'}</span>
                            <div>
                                <h3>Perfil de Sucursal Activa: ${business.name}</h3>
                                <small>Configuración comercial y horarios de operación</small>
                            </div>
                        </div>
                    </div>

                    <form id="form-edit-active-biz" class="cyber-form settings-form-body">
                        <div class="form-row grid-2">
                            <div class="form-group">
                                <label for="biz-name"><span class="neon-arrow">◆</span> Nombre del Negocio *</label>
                                <input type="text" id="biz-name" class="cyber-input" value="${business.name}" required>
                            </div>
                            <div class="form-group">
                                <label for="biz-tagline"><span class="neon-arrow">◆</span> Eslogan / Subtítulo</label>
                                <input type="text" id="biz-tagline" class="cyber-input" value="${business.tagline || ''}">
                            </div>
                        </div>

                        <div class="form-row grid-3">
                            <div class="form-group">
                                <label for="biz-city"><span class="neon-arrow">◆</span> Ciudad / Zona *</label>
                                <input type="text" id="biz-city" class="cyber-input" value="${business.city}" required>
                            </div>
                            <div class="form-group">
                                <label for="biz-phone"><span class="neon-arrow">◆</span> Teléfono de Atención</label>
                                <input type="text" id="biz-phone" class="cyber-input" value="${business.phone || ''}">
                            </div>
                            <div class="form-group">
                                <label for="biz-whatsapp"><span class="neon-arrow">◆</span> WhatsApp (sin espacios)</label>
                                <input type="text" id="biz-whatsapp" class="cyber-input" value="${business.whatsapp || ''}" placeholder="Ej. 5512345678">
                            </div>
                        </div>

                        <div class="form-row grid-3">
                            <div class="form-group">
                                <label for="biz-open"><span class="neon-arrow">◆</span> Hora de Apertura</label>
                                <input type="time" id="biz-open" class="cyber-input" value="${business.openingTime || '11:00'}">
                            </div>
                            <div class="form-group">
                                <label for="biz-close"><span class="neon-arrow">◆</span> Hora de Cierre</label>
                                <input type="time" id="biz-close" class="cyber-input" value="${business.closingTime || '22:00'}">
                            </div>
                            <div class="form-group">
                                <label for="biz-currency"><span class="neon-arrow">◆</span> Moneda y Símbolo</label>
                                <div class="input-duo">
                                    <input type="text" id="biz-symbol" class="cyber-input" value="${business.currencySymbol || '$'}" style="max-width: 60px;">
                                    <input type="text" id="biz-curr" class="cyber-input" value="${business.currency || 'MXN'}">
                                </div>
                            </div>
                        </div>

                        <div class="settings-actions">
                            <button type="submit" class="btn btn-primary glow-red">
                                💾 Guardar Cambios de Sucursal
                            </button>
                        </div>
                    </form>
                </div>

                ${isSuperAdmin ? `
                    <!-- Tarjeta de Catálogos del Sistema -->
                    <div class="settings-card">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">🗄️</span>
                                <div>
                                    <h3>Catálogos del Sistema Aislados (Namespace PIU)</h3>
                                    <small>Colecciones de Firestore protegidas contra colisiones</small>
                                </div>
                            </div>
                        </div>

                        <div class="catalogs-table-wrapper">
                            <table class="catalogs-table">
                                <thead>
                                    <tr>
                                        <th>Colección en Firebase</th>
                                        <th>Propósito / Contenido</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><code>${COLLECTIONS.BUSINESSES}</code></td>
                                        <td>Catálogo de Negocios y Sucursales independientes</td>
                                        <td><span class="badge badge-success">Activo (${allBusinesses.length})</span></td>
                                    </tr>
                                    <tr>
                                        <td><code>${COLLECTIONS.MACHINES}</code></td>
                                        <td>Catálogo de Gabinetes PIU (LX, TX, FX, sensores, tarifas)</td>
                                        <td><span class="badge badge-success">Activo (${store.machines.length})</span></td>
                                    </tr>
                                    <tr>
                                        <td><code>${COLLECTIONS.RESERVATIONS}</code></td>
                                        <td>Catálogo de Reservaciones y Solicitudes de Pistas</td>
                                        <td><span class="badge badge-success">Activo (${store.reservations.length})</span></td>
                                    </tr>
                                    <tr>
                                        <td><code>${COLLECTIONS.OPERATING_RULES}</code></td>
                                        <td>Horarios y Reglas Operativas por Día</td>
                                        <td><span class="badge badge-primary">Configurado</span></td>
                                    </tr>
                                    <tr>
                                        <td><code>${COLLECTIONS.GAME_VERSIONS}</code></td>
                                        <td>Catálogo de Versiones (Phoenix 2024, XX, Prime 2)</td>
                                        <td><span class="badge badge-primary">Estándar</span></td>
                                    </tr>
                                    <tr>
                                        <td><code>${COLLECTIONS.PLAYERS}</code></td>
                                        <td>Directorio de Jugadores y Gamertags</td>
                                        <td><span class="badge badge-primary">Dinámico</span></td>
                                    </tr>
                                    <tr>
                                        <td><code>${COLLECTIONS.AUDIT_LOGS}</code></td>
                                        <td>Bitácora de Aprobaciones y Acciones de Encargados</td>
                                        <td><span class="badge badge-primary">Automático</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Tarjeta de Gestión de Sucursales Registradas -->
                    <div class="settings-card">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">🌐</span>
                                <div>
                                    <h3>Todas las Sucursales (${allBusinesses.length})</h3>
                                    <small>Alterna o administra las sucursales existentes</small>
                                </div>
                            </div>
                        </div>

                        <div class="biz-list-grid">
                            ${allBusinesses.map(b => {
                                const isCurrent = b.id === business.id;
                                return `
                                    <div class="biz-item-card ${isCurrent ? 'biz-active-highlight' : ''}">
                                        <div class="biz-item-logo">${b.logoIcon || '🕹️'}</div>
                                        <div class="biz-item-info">
                                            <h4>${b.name}</h4>
                                            <p>${b.city} • ${b.openingTime} - ${b.closingTime}</p>
                                        </div>
                                        <div class="biz-item-actions">
                                            ${isCurrent 
                                                ? '<span class="badge badge-success">Activa Ahora</span>' 
                                                : `<button class="btn btn-outline btn-xs btn-switch-biz" data-id="${b.id}">Cambiar</button>`
                                            }
                                            ${allBusinesses.length > 1 ? `
                                                <button class="btn btn-danger btn-xs btn-del-biz" data-id="${b.id}" title="Eliminar Sucursal">🗑️</button>
                                            ` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Respaldo y Restauración -->
                    <div class="settings-card">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">💾</span>
                                <div>
                                    <h3>Respaldo y Mantenimiento de Datos</h3>
                                    <small>Exporta o restaura la base de datos completa en formato JSON</small>
                                </div>
                            </div>
                        </div>

                        <div class="backup-actions-row">
                            <button class="btn btn-outline" id="btn-export-backup">
                                📥 Exportar Respaldo JSON
                            </button>
                            <label class="btn btn-outline" for="input-import-backup">
                                📤 Importar Respaldo JSON
                                <input type="file" id="input-import-backup" accept=".json" class="hidden">
                            </label>
                            <button class="btn btn-danger btn-outline" id="btn-reset-demo">
                                🔄 Restaurar Datos Demo
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Guardar cambios de sucursal activa
    container.querySelector('#form-edit-active-biz')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updated = {
            name: container.querySelector('#biz-name').value.trim(),
            tagline: container.querySelector('#biz-tagline').value.trim(),
            city: container.querySelector('#biz-city').value.trim(),
            phone: container.querySelector('#biz-phone').value.trim(),
            whatsapp: container.querySelector('#biz-whatsapp').value.trim().replace(/\D/g, ''),
            openingTime: container.querySelector('#biz-open').value,
            closingTime: container.querySelector('#biz-close').value,
            currencySymbol: container.querySelector('#biz-symbol').value.trim(),
            currency: container.querySelector('#biz-curr').value.trim()
        };

        try {
            await tenantManager.updateBusiness(business.id, updated);
            toast.success("Perfil de sucursal actualizado exitosamente.");
        } catch (err) {
            toast.error(err.message);
        }
    });

    // Registrar nuevo negocio
    container.querySelector('#btn-create-biz')?.addEventListener('click', () => {
        openCreateBusinessModal();
    });

    // Cambiar de sucursal
    container.querySelectorAll('.btn-switch-biz').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await tenantManager.setActiveBusiness(id);
            toast.info(`Sucursal cambiada.`);
        });
    });

    // Eliminar sucursal
    container.querySelectorAll('.btn-del-biz').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Estás seguro de eliminar esta sucursal? Se perderán sus configuraciones locales.")) {
                try {
                    await tenantManager.deleteBusiness(id);
                    toast.warning("Sucursal eliminada.");
                } catch (e) {
                    toast.error(e.message);
                }
            }
        });
    });

    // Exportar JSON
    container.querySelector('#btn-export-backup')?.addEventListener('click', () => {
        const backupData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            businesses: tenantManager.getAllBusinesses(),
            activeTenantId: tenantManager.getActiveBusiness().id,
            machines: store.machines,
            reservations: store.reservations
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `piu_backup_${new Date().toISOString().slice(0,10)}.json`);
        dlAnchorElem.click();
        toast.success("Archivo de respaldo exportado.");
    });

    // Importar JSON
    container.querySelector('#input-import-backup')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                if (data.businesses) tenantManager.saveLocally(data.businesses);
                if (data.machines) store.saveLocalMachines(tenantManager.getActiveBusiness().id, data.machines);
                if (data.reservations) store.saveLocalReservations(tenantManager.getActiveBusiness().id, data.reservations);
                toast.success("Datos restaurados correctamente. Recargando...");
                setTimeout(() => window.location.reload(), 800);
            } catch (err) {
                toast.error("Error al procesar el archivo JSON: " + err.message);
            }
        };
        reader.readAsText(file);
    });

    // Resetear a datos demo
    container.querySelector('#btn-reset-demo')?.addEventListener('click', () => {
        if (confirm("¿Restaurar todos los datos demo de prueba? Se reiniciarán las máquinas y reservas.")) {
            localStorage.clear();
            toast.info("Reiniciando datos...");
            setTimeout(() => window.location.reload(), 500);
        }
    });
}

/**
 * Modal para registrar una nueva sucursal o negocio
 */
function openCreateBusinessModal() {
    const contentHtml = `
        <form id="form-create-biz" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="new-biz-name"><span class="neon-arrow">◆</span> Nombre del Negocio *</label>
                    <input type="text" id="new-biz-name" class="cyber-input" placeholder="Ej. PIU Arena Guadalajara" required>
                </div>
                <div class="form-group">
                    <label for="new-biz-icon"><span class="neon-arrow">◆</span> Icono / Logo Emoji</label>
                    <input type="text" id="new-biz-icon" class="cyber-input" value="⚡" style="max-width: 80px;">
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="new-biz-city"><span class="neon-arrow">◆</span> Ciudad / Ubicación *</label>
                    <input type="text" id="new-biz-city" class="cyber-input" placeholder="Ej. Guadalajara, Jal." required>
                </div>
                <div class="form-group">
                    <label for="new-biz-wa"><span class="neon-arrow">◆</span> WhatsApp de Contacto</label>
                    <input type="text" id="new-biz-wa" class="cyber-input" placeholder="Ej. 3312345678">
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="new-biz-open"><span class="neon-arrow">◆</span> Apertura</label>
                    <input type="time" id="new-biz-open" class="cyber-input" value="11:00">
                </div>
                <div class="form-group">
                    <label for="new-biz-close"><span class="neon-arrow">◆</span> Cierre</label>
                    <input type="time" id="new-biz-close" class="cyber-input" value="22:00">
                </div>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-create-biz">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-submit-create-biz">➕ Crear Negocio</button>
    `;

    const modalEl = modal.open({
        title: 'Registrar Nueva Sucursal / Negocio',
        icon: '🏢',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    modalEl.querySelector('#btn-cancel-create-biz').onclick = () => modal.close();

    modalEl.querySelector('#btn-submit-create-biz').onclick = async () => {
        const name = modalEl.querySelector('#new-biz-name').value.trim();
        const city = modalEl.querySelector('#new-biz-city').value.trim();
        const logoIcon = modalEl.querySelector('#new-biz-icon').value.trim() || '🕹️';
        const whatsapp = modalEl.querySelector('#new-biz-wa').value.trim();
        const openingTime = modalEl.querySelector('#new-biz-open').value;
        const closingTime = modalEl.querySelector('#new-biz-close').value;

        if (!name || !city) {
            toast.error("Por favor ingresa nombre y ciudad del negocio.");
            return;
        }

        try {
            const newBiz = await tenantManager.createBusiness({
                name, city, logoIcon, whatsapp, openingTime, closingTime
            });
            modal.close();
            toast.success(`¡Sucursal "${newBiz.name}" creada y activada con éxito!`);
        } catch (e) {
            toast.error(e.message);
        }
    };
}
