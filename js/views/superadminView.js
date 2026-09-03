// js/views/superadminView.js
// Panel de Control Global para SUPERADMIN (Gestión integral de todos los catálogos y eliminación en cascada)
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { catalogsManager } from '../core/catalogsManager.js';
import { clientDirManager, openClientFormModal } from './clientsView.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { escapeHTML } from '../core/securityUtils.js';
import { 
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    setDoc, 
    doc 
} from '../firebaseConfig.js';
import { formatFriendlyDate, format12Hour } from '../core/timeUtils.js';
import { showReservationTicket } from './clientBookingModal.js';
import { openModifyModal } from './requestsView.js';

let activeSuperTab = 'BUSINESSES'; // 'BUSINESSES', 'RESERVATIONS', 'PLAYERS', 'CABINETS', 'VERSIONS', 'MACHINES', 'STAFF'
let resSearchQuery = '';
let resFilterBiz = '';
let resFilterStatus = 'ALL';

export async function renderSuperadminView(container) {
    const businesses = tenantManager.getAllBusinesses();
    const staffUsers = await authManager.loadStaffUsers();
    const managers = staffUsers.filter(u => u.role === 'MANAGER');
    const cabinetModels = catalogsManager.getCabinetModels();
    const gameVersions = catalogsManager.getGameVersions();
    const players = await clientDirManager.loadClients();
    const totalBusinesses = businesses.length;

    let globalReservations = [];
    if (isFirebaseAvailable && db) {
        try {
            const snap = await getDocs(collection(db, COLLECTIONS.RESERVATIONS));
            snap.forEach(d => globalReservations.push({ id: d.id, ...d.data() }));
        } catch(e) {
            console.warn("Error cargando reservaciones globales:", e);
        }
    }
    globalReservations.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    container.innerHTML = `
        <div class="superadmin-view-wrapper animate-fade-in">
            <!-- Header Global -->
            <div class="view-header-bar">
                <div class="header-left">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.8rem;">👑</span>
                        <h2 class="friendly-date-title">Consola Global de Super Administrador</h2>
                    </div>
                    <p class="subtitle-text">Administración completa de todos los locales, jugadores globales, modelos de gabinete, versiones de software, reservaciones y personal.</p>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn btn-outline" id="btn-export-backup" style="border-color:var(--color-neon-lime); color:var(--color-neon-lime);" title="Descargar copia de seguridad en JSON">
                        <span>💾 Bajar Respaldo</span>
                    </button>
                    <button class="btn btn-outline" id="btn-import-backup" style="border-color:var(--piu-cyan); color:var(--piu-cyan);" title="Cargar copia de seguridad de un archivo JSON">
                        <span>📤 Cargar Configuración</span>
                    </button>
                    <input type="file" id="input-import-file" accept=".json" style="display:none;">
                    <button class="btn btn-outline" id="btn-create-manager">
                        <span>👤 Nuevo Encargado</span>
                    </button>
                    <button class="btn btn-primary glow-red" id="btn-add-global-biz">
                        <span>🏢 Registrar Nuevo Local</span>
                    </button>
                </div>
            </div>

            <!-- Navegación de Pestañas de Superadmin -->
            <div class="requests-filter-bar" style="margin-bottom:20px; flex-wrap:wrap;">
                <button class="filter-tab ${activeSuperTab === 'BUSINESSES' ? 'active' : ''}" data-tab="BUSINESSES">
                    <span>🏢 Locales (${totalBusinesses})</span>
                </button>
                <button class="filter-tab ${activeSuperTab === 'RESERVATIONS' ? 'active' : ''}" data-tab="RESERVATIONS">
                    <span>📋 Auditoría de Reservas (${globalReservations.length})</span>
                </button>
                <button class="filter-tab ${activeSuperTab === 'PLAYERS' ? 'active' : ''}" data-tab="PLAYERS">
                    <span>🕺 Clientes / Jugadores (${players.length})</span>
                </button>
                <button class="filter-tab ${activeSuperTab === 'CABINETS' ? 'active' : ''}" data-tab="CABINETS">
                    <span>🖥️ Modelos de Gabinete (${cabinetModels.length})</span>
                </button>
                <button class="filter-tab ${activeSuperTab === 'VERSIONS' ? 'active' : ''}" data-tab="VERSIONS">
                    <span>💿 Versiones de Software (${gameVersions.length})</span>
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
                ${renderTabContent(activeSuperTab, businesses, staffUsers, managers, cabinetModels, gameVersions, players, globalReservations)}
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

    // Alternar Estado Operativo de Sucursal (Activo / En Pausa)
    container.querySelectorAll('.btn-toggle-biz-status').forEach(btn => {
        btn.addEventListener('click', async () => {
            const bizId = btn.dataset.id;
            const isCurrentlyActive = btn.dataset.active === 'true';
            const newActive = !isCurrentlyActive;
            try {
                await tenantManager.toggleBusinessStatus(bizId, newActive);
                toast.success(`Sucursal ${newActive ? 'activada 🟢' : 'pausada ⏸️'}.`);
                renderSuperadminView(container);
            } catch (e) {
                toast.error(e.message);
            }
        });
    });

    // Abrir Modal de Feature Toggles / Módulos por Sucursal
    container.querySelectorAll('.btn-biz-modules').forEach(btn => {
        btn.addEventListener('click', () => {
            const bizId = btn.dataset.id;
            const biz = tenantManager.getAllBusinesses().find(b => b.id === bizId);
            if (biz) {
                openBusinessModulesModal(biz, container);
            }
        });
    });

    // Registrar nuevo negocio
    container.querySelector('#btn-add-global-biz')?.addEventListener('click', () => {
        openCreateBusinessModal(container);
    });

    // Cambiar configuración global
    container.querySelector('#sys-disable-change-local-globally')?.addEventListener('change', async (e) => {
        try {
            await tenantManager.updateGlobalConfig({
                disableChangeLocalGlobally: e.target.checked
            });
            toast.success("Configuración global actualizada.");
        } catch (err) {
            toast.error("Error al actualizar la configuración global.");
        }
    });

    // Exportar Copia de Seguridad
    container.querySelector('#btn-export-backup')?.addEventListener('click', async () => {
        if (!isFirebaseAvailable || !db) {
            toast.error("Firebase no está disponible para realizar la copia de seguridad.");
            return;
        }
        try {
            toast.info("Generando copia de seguridad de Firestore...");
            const collectionsToBackup = {
                businesses: COLLECTIONS.BUSINESSES,
                machines: COLLECTIONS.MACHINES,
                staff: COLLECTIONS.STAFF_USERS,
                operating_rules: COLLECTIONS.OPERATING_RULES,
                game_versions: COLLECTIONS.GAME_VERSIONS,
                cabinet_models: COLLECTIONS.CABINET_MODELS,
                players: COLLECTIONS.PLAYERS,
                reservations: COLLECTIONS.RESERVATIONS
            };
            const backupData = {};
            for (const [key, collName] of Object.entries(collectionsToBackup)) {
                const snap = await getDocs(collection(db, collName));
                backupData[key] = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            }

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            const dateStr = new Date().toISOString().slice(0, 10);
            downloadAnchor.setAttribute("download", `magi_reservaciones_backup_${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            toast.success("Copia de seguridad descargada correctamente.");
        } catch (err) {
            toast.error("Error al generar la copia de seguridad: " + err.message);
        }
    });

    // Importar / Cargar Configuración
    const fileInput = container.querySelector('#input-import-file');
    container.querySelector('#btn-import-backup')?.addEventListener('click', () => {
        fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                
                // Validación básica de estructura
                if (!data.businesses && !data.machines && !data.staff) {
                    throw new Error("El archivo seleccionado no parece ser una copia de seguridad válida de Magi-reservaciones.");
                }

                if (!confirm("⚠️ ¿Estás seguro de cargar esta configuración?\nSe importarán locales, máquinas, configuraciones y usuarios a Firestore. Los documentos existentes con el mismo ID se sobrescribirán.")) {
                    fileInput.value = ''; // reset
                    return;
                }

                toast.info("Iniciando restauración de datos...");
                
                const collectionsMapping = {
                    businesses: COLLECTIONS.BUSINESSES,
                    machines: COLLECTIONS.MACHINES,
                    staff: COLLECTIONS.STAFF_USERS,
                    operating_rules: COLLECTIONS.OPERATING_RULES,
                    game_versions: COLLECTIONS.GAME_VERSIONS,
                    cabinet_models: COLLECTIONS.CABINET_MODELS,
                    players: COLLECTIONS.PLAYERS,
                    reservations: COLLECTIONS.RESERVATIONS
                };

                let importedCount = 0;
                for (const [key, collName] of Object.entries(collectionsMapping)) {
                    const docsList = data[key];
                    if (Array.isArray(docsList)) {
                        for (const d of docsList) {
                            const docId = d.id;
                            if (docId) {
                                const docData = { ...d };
                                delete docData.id;
                                await setDoc(doc(db, collName, docId), docData);
                                importedCount++;
                            }
                        }
                    }
                }
                
                toast.success(`¡Carga completada con éxito! Se restauraron ${importedCount} documentos.`);
                
                // Recargar toda la vista
                renderSuperadminView(container);
            } catch (err) {
                toast.error("Error al cargar la copia de seguridad: " + err.message);
            } finally {
                fileInput.value = ''; // reset
            }
        };
        reader.readAsText(file);
    });

    // Crear nuevo encargado
    container.querySelector('#btn-create-manager')?.addEventListener('click', () => {
        openStaffFormModal(null, container);
    });

    // Editar Encargado
    container.querySelectorAll('.btn-edit-staff').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const staff = authManager.getStaffUsers().find(u => u.id === id);
            if (staff) openStaffFormModal(staff, container);
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

    // ==========================================
    // Eventos de Jugadores / Clientes Globales
    // ==========================================
    container.querySelector('#btn-add-global-player')?.addEventListener('click', () => {
        openClientFormModal(null, null, () => renderSuperadminView(container));
    });

    container.querySelectorAll('.btn-edit-global-player').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const player = players.find(p => p.id === id);
            if (player) openClientFormModal(player, null, () => renderSuperadminView(container));
        });
    });

    container.querySelectorAll('.btn-delete-global-player').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Eliminar este jugador del directorio global?")) {
                await clientDirManager.deleteClient(id);
                toast.info("Jugador eliminado del catálogo.");
                renderSuperadminView(container);
            }
        });
    });

    // ==========================================
    // Eventos de Modelos de Gabinete (Global)
    // ==========================================
    container.querySelector('#btn-add-cabinet-model')?.addEventListener('click', () => {
        openCabinetModal(null, container);
    });

    container.querySelectorAll('.btn-edit-cabinet').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const cab = catalogsManager.getCabinetModels().find(c => c.id === id);
            if (cab) openCabinetModal(cab, container);
        });
    });

    container.querySelectorAll('.btn-delete-cabinet').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Eliminar este modelo de gabinete del catálogo global?")) {
                await catalogsManager.deleteCabinetModel(id);
                toast.info("Modelo de gabinete eliminado.");
                renderSuperadminView(container);
            }
        });
    });

    // ==========================================
    // Eventos de Versiones de Software (Global)
    // ==========================================
    // Eventos de Auditoría de Reservaciones Global
    // ==========================================
    container.querySelector('#super-search-res')?.addEventListener('input', (e) => {
        resSearchQuery = e.target.value.toLowerCase().trim();
        renderSuperadminView(container);
    });

    container.querySelector('#super-filter-biz')?.addEventListener('change', (e) => {
        resFilterBiz = e.target.value;
        renderSuperadminView(container);
    });

    container.querySelectorAll('.super-res-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            resFilterStatus = btn.dataset.status;
            renderSuperadminView(container);
        });
    });

    container.querySelectorAll('.btn-view-ticket-super').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const res = globalReservations.find(r => r.id === id);
            if (res) showReservationTicket(res);
        });
    });

    container.querySelectorAll('.btn-approve-res-super').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            try {
                await store.approveReservation(id);
                toast.success("Reservación aprobada.");
                renderSuperadminView(container);
            } catch (err) {
                toast.error(err.message);
            }
        });
    });

    container.querySelectorAll('.btn-edit-res-super').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const res = globalReservations.find(r => r.id === id);
            if (res) {
                openModifyModal(res, container);
            }
        });
    });

    container.querySelectorAll('.btn-del-res-super').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Estás seguro de cancelar / anular esta reservación?")) {
                try {
                    await store.deleteReservation(id, 'Cancelada por Super Administrador');
                    toast.info("Reservación cancelada.");
                    renderSuperadminView(container);
                } catch (err) {
                    toast.error(err.message);
                }
            }
        });
    });
}

function renderTabContent(tab, businesses, staffUsers, managers, cabinetModels, gameVersions, players, globalReservations = []) {
    if (tab === 'RESERVATIONS') {
        const confirmedCount = globalReservations.filter(r => r.status === 'CONFIRMED').length;
        const pendingCount = globalReservations.filter(r => r.status === 'PENDING').length;
        const cancelledCount = globalReservations.filter(r => r.status === 'CANCELLED').length;
        const rejectedCount = globalReservations.filter(r => r.status === 'REJECTED').length;

        let filtered = globalReservations;
        if (resFilterBiz) {
            filtered = filtered.filter(r => r.businessId === resFilterBiz);
        }
        if (resFilterStatus !== 'ALL') {
            filtered = filtered.filter(r => r.status === resFilterStatus);
        }
        if (resSearchQuery) {
            filtered = filtered.filter(r => 
                (r.clientName && r.clientName.toLowerCase().includes(resSearchQuery)) ||
                (r.clientUsername && r.clientUsername.toLowerCase().includes(resSearchQuery)) ||
                (r.clientPhone && r.clientPhone.includes(resSearchQuery)) ||
                (r.id && r.id.toLowerCase().includes(resSearchQuery)) ||
                (r.cancellationReason && r.cancellationReason.toLowerCase().includes(resSearchQuery)) ||
                (r.rejectionReason && r.rejectionReason.toLowerCase().includes(resSearchQuery))
            );
        }

        return `
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">📋</span>
                        <div>
                            <h3>Auditoría y Registro Global de Reservaciones</h3>
                            <small>Historial inmutable de reservaciones confirmadas, pendientes, canceladas y rechazadas de todos los locales</small>
                        </div>
                    </div>
                </div>

                <!-- Métricas de Estado Global -->
                <div style="display:flex; gap:10px; margin: 16px 0; flex-wrap:wrap;">
                    <button type="button" class="btn btn-outline btn-sm super-res-filter-btn ${resFilterStatus === 'ALL' ? 'active' : ''}" data-status="ALL" style="border-color:var(--border-color);">
                        📋 Todas (${globalReservations.length})
                    </button>
                    <button type="button" class="btn btn-outline btn-sm super-res-filter-btn ${resFilterStatus === 'CONFIRMED' ? 'active' : ''}" data-status="CONFIRMED" style="border-color:var(--color-neon-lime); color:var(--color-neon-lime);">
                        ✅ Confirmadas (${confirmedCount})
                    </button>
                    <button type="button" class="btn btn-outline btn-sm super-res-filter-btn ${resFilterStatus === 'PENDING' ? 'active' : ''}" data-status="PENDING" style="border-color:var(--color-neon-gold); color:var(--color-neon-gold);">
                        ⏳ Pendientes (${pendingCount})
                    </button>
                    <button type="button" class="btn btn-outline btn-sm super-res-filter-btn ${resFilterStatus === 'CANCELLED' ? 'active' : ''}" data-status="CANCELLED" style="border-color:var(--color-neon-red); color:var(--color-neon-red);">
                        🚫 Canceladas (${cancelledCount})
                    </button>
                    <button type="button" class="btn btn-outline btn-sm super-res-filter-btn ${resFilterStatus === 'REJECTED' ? 'active' : ''}" data-status="REJECTED" style="border-color:#ff4444; color:#ff8888;">
                        ❌ Rechazadas (${rejectedCount})
                    </button>
                </div>

                <!-- Filtros y Búsqueda -->
                <div style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap; align-items:center; background:var(--bg-dark-800); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                    <div style="flex:2; min-width:220px;">
                        <input type="text" id="super-search-res" class="cyber-input" placeholder="🔍 Buscar por cliente, GamerTag, teléfono, folio o motivo..." value="${escapeHTML(resSearchQuery)}" style="padding:8px 12px;">
                    </div>
                    <div style="flex:1; min-width:180px;">
                        <select id="super-filter-biz" class="cyber-select" style="padding:8px 12px;">
                            <option value="">🏢 Todos los Locales</option>
                            ${businesses.map(b => `<option value="${b.id}" ${b.id === resFilterBiz ? 'selected' : ''}>${escapeHTML(b.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div style="color:var(--text-muted); font-size:0.85rem;">
                        Mostrando: <strong style="color:var(--color-neon-lime);">${filtered.length}</strong> de <strong style="color:#ffffff;">${globalReservations.length}</strong>
                    </div>
                </div>

                <div class="catalogs-table-wrapper" style="overflow-x:auto;">
                    <table class="catalogs-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                        <thead>
                            <tr style="border-bottom:2px solid var(--border-color); background:rgba(0,0,0,0.4); color:var(--text-muted);">
                                <th style="padding:10px;">Folio / Estado</th>
                                <th style="padding:10px;">Local / Sucursal</th>
                                <th style="padding:10px;">Jugador / Cliente</th>
                                <th style="padding:10px;">Fecha / Horario</th>
                                <th style="padding:10px;">Monto</th>
                                <th style="padding:10px;">Detalles / Auditoría</th>
                                <th style="padding:10px; text-align:right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.length === 0 ? `
                                <tr>
                                    <td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted); font-style:italic;">
                                        No se encontraron reservaciones con los filtros seleccionados.
                                    </td>
                                </tr>
                            ` : filtered.map(r => {
                                const biz = businesses.find(b => b.id === r.businessId);
                                const isConfirmed = r.status === 'CONFIRMED';
                                const isPending = r.status === 'PENDING';
                                const isCancelled = r.status === 'CANCELLED';
                                const isRejected = r.status === 'REJECTED';

                                let badgeClass = 'badge-warning';
                                let badgeText = 'Pendiente';
                                if (isConfirmed) {
                                    badgeClass = 'badge-success';
                                    badgeText = 'Confirmada';
                                } else if (isCancelled) {
                                    badgeClass = 'badge-danger';
                                    badgeText = '🚫 Cancelada';
                                } else if (isRejected) {
                                    badgeClass = 'badge-danger';
                                    badgeText = '❌ Rechazada';
                                }

                                return `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                        <td style="padding:10px; white-space:nowrap;">
                                            <div style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">${r.id}</div>
                                            <span class="badge ${badgeClass}" style="font-size:0.7rem; padding:2px 6px;">${badgeText}</span>
                                        </td>
                                        <td style="padding:10px;">
                                            <strong style="color:var(--piu-cyan);">${biz ? escapeHTML(biz.name) : (r.businessId || 'N/A')}</strong>
                                        </td>
                                        <td style="padding:10px;">
                                            <strong style="color:#ffffff;">${escapeHTML(r.clientName || 'Sin Nombre')}</strong>
                                            ${r.clientUsername ? `<div style="font-size:0.75rem; color:var(--text-muted);">@${escapeHTML(r.clientUsername)}</div>` : ''}
                                            ${r.clientPhone ? `<div style="font-size:0.72rem; color:var(--color-neon-lime);">${escapeHTML(r.clientPhone)}</div>` : ''}
                                        </td>
                                        <td style="padding:10px; white-space:nowrap;">
                                            <div>${formatFriendlyDate(r.date)}</div>
                                            <div style="font-size:0.8rem; color:var(--piu-cyan); font-family:var(--font-mono);">${format12Hour(r.startTime)} - ${format12Hour(r.endTime)}</div>
                                        </td>
                                        <td style="padding:10px; font-weight:700; font-family:var(--font-mono); color:var(--color-chartreuse);">
                                            $${r.totalCost || 0}
                                        </td>
                                        <td style="padding:10px; font-size:0.78rem;">
                                            ${isCancelled ? `
                                                <div style="color:var(--color-neon-red);"><strong>Motivo:</strong> ${escapeHTML(r.cancellationReason || 'Cancelada')}</div>
                                                <div style="color:var(--text-muted); font-size:0.72rem;">Por: ${escapeHTML(r.cancelledBy || 'Encargado')} • ${r.cancelledAt ? new Date(r.cancelledAt).toLocaleString() : ''}</div>
                                            ` : ''}
                                            ${isRejected ? `
                                                <div style="color:#ff8888;"><strong>Motivo:</strong> ${escapeHTML(r.rejectionReason || 'Rechazada')}</div>
                                            ` : ''}
                                            ${r.adminNotes ? `<div style="color:var(--text-muted); font-style:italic;">Nota: ${escapeHTML(r.adminNotes)}</div>` : ''}
                                        </td>
                                        <td style="padding:10px; text-align:right; white-space:nowrap;">
                                            <div style="display:flex; gap:6px; justify-content:flex-end;">
                                                <button type="button" class="btn btn-outline btn-xs btn-view-ticket-super" data-id="${r.id}" title="Ver Comprobante">
                                                    🎟️ Ticket
                                                </button>
                                                ${isPending ? `
                                                    <button type="button" class="btn btn-success btn-xs btn-approve-res-super" data-id="${r.id}">
                                                        ✔️ Aprobar
                                                    </button>
                                                ` : ''}
                                                <button type="button" class="btn btn-outline btn-xs btn-edit-res-super" data-id="${r.id}" title="${(isCancelled || isRejected) ? '⚡ Revivir / Reprogramar Reservación' : '✏️ Modificar / Reprogramar'}">
                                                    ${(isCancelled || isRejected) ? '⚡ Revivir' : '✏️'}
                                                </button>
                                                <button type="button" class="btn btn-danger btn-xs btn-del-res-super" data-id="${r.id}" title="Anular o soft-cancel">
                                                    🗑️
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
        `;
    }
    if (tab === 'BUSINESSES') {
        return `
            <!-- Configuración Global (Solo Superadmin) -->
            <div class="settings-card" style="margin-bottom: 20px; border-left: 4px solid var(--color-neon-lime);">
                <div class="card-title-bar">
                    <div class="title-with-icon">
                        <span class="t-icon">⚙️</span>
                        <div>
                            <h3>Configuración Global del Sistema</h3>
                            <small>Afecta a todas las sucursales y la experiencia de los clientes</small>
                        </div>
                    </div>
                </div>

                <div class="settings-form-body" style="padding: 16px;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:700;">
                            <input type="checkbox" id="sys-disable-change-local-globally" style="width:18px; height:18px; accent-color:var(--color-neon-lime); cursor:pointer;" ${tenantManager.disableChangeLocalGlobally ? 'checked' : ''}>
                            <span>Desactivar el botón "Cambiar de Local" GLOBALMENTE (Bloquear navegación en todas las sucursales)</span>
                        </label>
                        <small style="display:block; margin-top:6px; color:var(--text-muted); font-size:0.78rem; line-height:1.4;">
                            💡 <em>Si se activa, el botón "Cambiar de Local" se ocultará en todas las sucursales para clientes, invitados y locatarios, forzándolos a permanecer en la sucursal activa. Los Superusuarios siempre podrán verlo para no perder acceso ni control.</em>
                        </small>
                    </div>
                </div>
            </div>

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
                                <th>Estado Operativo</th>
                                <th>Ubicación</th>
                                <th>Horarios</th>
                                <th>Encargado Asignado</th>
                                <th>Enlace Directo para Clientes</th>
                                <th>Acciones & Módulos</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${businesses.map(b => {
                                const assignedManager = managers.find(m => m.businessId === b.id);
                                const clientUrl = `${window.location.origin}/local/${b.id}`;
                                const isBizActive = b.isActive !== false && b.status !== 'INACTIVE';
                                const modules = tenantManager.normalizeModules(b.enabledModules);
                                const enabledCount = Object.values(modules).filter(Boolean).length;
                                const totalModulesCount = Object.keys(modules).length;

                                return `
                                    <tr style="${!isBizActive ? 'opacity:0.75; background:rgba(255,184,0,0.03);' : ''}">
                                        <td>
                                            <div style="display:flex; align-items:center; gap:8px;">
                                                <span style="font-size:1.4rem;">${b.logoIcon || '🕹️'}</span>
                                                <div>
                                                    <div style="display:flex; align-items:center; gap:6px;">
                                                        <strong style="color:#ffffff;">${b.name}</strong>
                                                        ${!isBizActive ? '<span class="badge badge-warning" style="font-size:0.65rem;">⏸️ PAUSADO</span>' : ''}
                                                    </div>
                                                    <div style="font-size:0.72rem; color:var(--text-muted);">${b.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <button type="button" class="btn btn-xs ${isBizActive ? 'btn-success' : 'btn-outline'} btn-toggle-biz-status" data-id="${b.id}" data-active="${isBizActive}" title="Haz clic para ${isBizActive ? 'pausar' : 'activar'} este local">
                                                ${isBizActive ? '🟢 Activo' : '⏸️ En Pausa'}
                                            </button>
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
                                                <input type="text" readonly value="${clientUrl}" class="cyber-input" style="font-size:0.75rem; padding:4px 8px; max-width:180px; background:var(--bg-dark-800);">
                                                <button class="btn btn-outline btn-xs btn-copy-link" data-url="${clientUrl}" title="Copiar enlace del cliente">
                                                    📋 Copiar
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                                                <button class="btn btn-outline btn-xs btn-biz-modules" data-id="${b.id}" style="border-color:var(--piu-cyan); color:var(--piu-cyan);" title="Configurar módulos y funciones habilitadas">
                                                    🎛️ Funciones (${enabledCount}/${totalModulesCount})
                                                </button>
                                                <button class="btn btn-primary btn-xs btn-enter-biz glow-red" data-id="${b.id}" title="Ingresar a la vista de esta sucursal">
                                                    ⚡ Entrar
                                                </button>
                                                ${businesses.length > 1 ? `
                                                    <button class="btn btn-danger btn-xs btn-delete-biz-cascade" data-id="${b.id}" title="Eliminar local y todos sus datos en cascada">
                                                        🗑️
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

    if (tab === 'PLAYERS') {
        const migratedCount = players.filter(p => p.authUid || p.isAuthMigrated).length;
        const legacyCount = players.length - migratedCount;

        return `
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">🕺</span>
                        <div>
                            <h3>Directorio Global de Clientes / Jugadores PIU</h3>
                            <small>Base de datos unificada de jugadores registrados en la plataforma</small>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-primary btn-sm glow-red" id="btn-add-global-player">
                            <span>➕ Registrar Nuevo Jugador</span>
                        </button>
                    </div>
                </div>

                <!-- Barra de Estado de Migración Progresiva -->
                <div style="background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px 16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
                        <span style="font-size:0.85rem; font-weight:700; color:#fff;">📊 Salud de Cuentas:</span>
                        <span class="badge" style="background:rgba(104,242,5,0.15); color:var(--color-neon-lime); border:1px solid rgba(104,242,5,0.3); font-size:0.8rem; padding:3px 10px;">
                            🟢 ${migratedCount} Con Auth Activa
                        </span>
                        <span class="badge" style="background:rgba(255,184,0,0.15); color:var(--color-neon-gold); border:1px solid rgba(255,184,0,0.3); font-size:0.8rem; padding:3px 10px;">
                            🟡 ${legacyCount} Perfil Tradicional / PIN
                        </span>
                    </div>
                    <small style="color:var(--text-muted); font-size:0.75rem;">
                        💡 Los jugadores se vinculan a Firebase Auth automáticamente al iniciar sesión o reservar.
                    </small>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Jugador / GamerTag</th>
                                <th>Estado Auth</th>
                                <th>Liga (Ligas Potosinas)</th>
                                <th>Teléfono / WhatsApp</th>
                                <th>Correo</th>
                                <th>Modo Preferido</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${players.map(p => {
                                const cleanPhone = (p.phone || '').replace(/\D/g, '');
                                const waLink = cleanPhone ? `https://wa.me/52${cleanPhone}` : '#';
                                const isMigrated = Boolean(p.authUid || p.isAuthMigrated);

                                return `
                                    <tr>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:8px;">
                                                <span style="font-size:1.3rem;">${p.avatar || '🕺'}</span>
                                                <div>
                                                    <strong style="color:#ffffff;">${escapeHTML(p.name)}</strong>
                                                    <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap; margin-top:2px;">
                                                        ${p.username ? `<span style="font-size:0.72rem; color:var(--text-muted);">@${escapeHTML(p.username)}</span>` : ''}
                                                        ${p.piuGameId ? `<span class="badge" style="font-size:0.65rem; padding:1px 4px; background:rgba(0,229,255,0.12); color:var(--piu-cyan); border:1px solid rgba(0,229,255,0.3);">🎮 ${escapeHTML(p.piuGameId)}</span>` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge" style="background:${isMigrated ? 'rgba(104,242,5,0.15)' : 'rgba(255,184,0,0.15)'}; color:${isMigrated ? 'var(--color-neon-lime)' : 'var(--color-neon-gold)'}; border:1px solid ${isMigrated ? 'rgba(104,242,5,0.3)' : 'rgba(255,184,0,0.3)'}; font-size:0.7rem; padding:2px 8px;">
                                                ${isMigrated ? '🟢 Auth Activa' : '🟡 Clásico'}
                                            </span>
                                        </td>
                                        <td><span class="badge badge-primary">${escapeHTML(p.skillLevel || 'Liga C')}</span></td>
                                        <td>
                                            <span>${escapeHTML(p.phone || 'N/A')}</span>
                                            ${cleanPhone ? `
                                                <a href="${waLink}" target="_blank" rel="noopener noreferrer" style="margin-left:6px; color:#25D366; font-size:0.8rem; font-weight:700;">
                                                    💬 WhatsApp
                                                </a>
                                            ` : ''}
                                        </td>
                                        <td><span style="font-size:0.82rem; color:var(--text-muted);">${escapeHTML(p.email || 'N/A')}</span></td>
                                        <td><span style="font-size:0.82rem; color:var(--piu-cyan);">${escapeHTML(p.preferredMode || 'Single / Double')}</span></td>
                                        <td>
                                            <div style="display:flex; gap:6px;">
                                                <button class="btn btn-outline btn-xs btn-edit-global-player" data-id="${p.id}">✏️ Editar</button>
                                                <button class="btn btn-danger btn-xs btn-delete-global-player" data-id="${p.id}" title="Eliminar jugador">🗑️</button>
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

    if (tab === 'CABINETS') {
        return `
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">🖥️</span>
                        <div>
                            <h3>Catálogo Global de Modelos de Gabinete Pump It Up</h3>
                            <small>Estándares oficiales de gabinetes (LX, TX, FX, CX, SD) disponibles para todos los locales</small>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm glow-red" id="btn-add-cabinet-model">
                        <span>➕ Agregar Modelo de Gabinete</span>
                    </button>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Nombre del Modelo</th>
                                <th>Tipo</th>
                                <th>Tamaño de Pantalla</th>
                                <th>Dimensiones</th>
                                <th>Descripción</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cabinetModels.map(c => `
                                <tr>
                                    <td><strong style="color:#ffffff;">${c.name}</strong></td>
                                    <td><span class="badge badge-primary">${c.type}</span></td>
                                    <td><code style="color:var(--piu-cyan);">${c.screenSize}</code></td>
                                    <td style="font-size:0.8rem; color:var(--text-muted);">${c.dimensions || 'N/A'}</td>
                                    <td style="font-size:0.82rem; color:var(--text-secondary); max-width:240px;">${c.description}</td>
                                    <td>
                                        <span class="badge ${c.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}">
                                            ${c.status === 'ACTIVE' ? 'ACTIVO' : 'INACTIVO'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="display:flex; gap:6px;">
                                            <button class="btn btn-outline btn-xs btn-edit-cabinet" data-id="${c.id}">✏️ Editar</button>
                                            <button class="btn btn-danger btn-xs btn-delete-cabinet" data-id="${c.id}" title="Eliminar modelo">🗑️</button>
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

    if (tab === 'VERSIONS') {
        return `
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">💿</span>
                        <div>
                            <h3>Catálogo Maestro Global de Versiones de Software PIU</h3>
                            <small>Versiones registradas a nivel sistema para asociar a las máquinas</small>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm glow-red" id="btn-add-global-version">
                        <span>➕ Agregar Versión Oficial</span>
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
                                <th>Gabinete Mínimo</th>
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
                                    <td><span class="badge badge-primary">${v.minCabinet || 'Todos'}</span></td>
                                    <td>
                                        <span class="badge ${v.status === 'CURRENT' ? 'badge-success' : 'badge-warning'}">
                                            ${v.status === 'CURRENT' ? 'OFICIAL / VIGENTE' : 'LEGACY'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="display:flex; gap:6px;">
                                            <button class="btn btn-outline btn-xs btn-edit-global-ver" data-id="${v.id}">✏️ Editar</button>
                                            <button class="btn btn-danger btn-xs btn-delete-global-ver" data-id="${v.id}" title="Eliminar versión">🗑️</button>
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
                            <small>Máquinas registradas en la sucursal activa</small>
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
                            <h3>Catálogo de Cuentas de Encargados y Credenciales</h3>
                            <small>Como Superadmin puedes editar usuarios, nombres, contraseñas/PINs y locales asignados</small>
                        </div>
                    </div>
                </div>

                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Usuario</th>
                                <th>PIN / Contraseña</th>
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
                                        <td><strong>${u.avatar || '👤'} ${escapeHTML(u.name)}</strong></td>
                                        <td><code>${escapeHTML(u.username)}</code></td>
                                        <td><code style="color:var(--piu-gold); font-weight:700;">${u.pin ? escapeHTML(u.pin) : '•••• (PIN Hasheado)'}</code></td>
                                        <td>
                                            <span class="badge ${isSuper ? 'badge-danger' : 'badge-warning'}">
                                                ${isSuper ? '👑 SUPERADMIN' : '🕹️ ENCARGADO'}
                                            </span>
                                        </td>
                                        <td>
                                            ${isSuper ? '<span class="highlight-cyan">Acceso Global</span>' : (biz ? escapeHTML(biz.name) : 'Sin asignar')}
                                        </td>
                                        <td>
                                            <div style="display:flex; gap:6px;">
                                                <button class="btn btn-outline btn-xs btn-edit-staff" data-id="${u.id}" title="Editar datos y contraseña">
                                                    ✏️ Editar
                                                </button>
                                                ${!isSuper ? `
                                                    <button class="btn btn-danger btn-xs btn-delete-staff" data-id="${u.id}" title="Eliminar encargado">
                                                        🗑️
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

    return '';
}

// ==========================================
// Modales de Gestión de Superadmin
// ==========================================
function openCabinetModal(cabinet = null, container) {
    const isEdit = !!cabinet;

    const contentHtml = `
        <form id="form-cabinet" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="cab-name"><span class="neon-arrow">◆</span> Nombre del Gabinete *</label>
                    <input type="text" id="cab-name" class="cyber-input" value="${cabinet ? cabinet.name : ''}" placeholder="Ej. LX 55\" LED Cabinet (Pro Stage)" required>
                </div>
                <div class="form-group">
                    <label for="cab-type"><span class="neon-arrow">◆</span> Tipo / Serie *</label>
                    <select id="cab-type" class="cyber-select">
                        <option value="LX" ${cabinet?.type === 'LX' ? 'selected' : ''}>Serie LX (55" LED)</option>
                        <option value="TX" ${cabinet?.type === 'TX' ? 'selected' : ''}>Serie TX (50" HD)</option>
                        <option value="FX" ${cabinet?.type === 'FX' ? 'selected' : ''}>Serie FX (42" HD)</option>
                        <option value="CX" ${cabinet?.type === 'CX' ? 'selected' : ''}>Serie CX (43" Wide)</option>
                        <option value="SD" ${cabinet?.type === 'SD' ? 'selected' : ''}>Serie SD (29" Retro CRT)</option>
                        <option value="CUSTOM" ${cabinet?.type === 'CUSTOM' ? 'selected' : ''}>Gabinete Custom / Especial</option>
                    </select>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="cab-screen"><span class="neon-arrow">◆</span> Pantalla / Resolución</label>
                    <input type="text" id="cab-screen" class="cyber-input" value="${cabinet ? cabinet.screenSize : '55\" 120Hz 4K/FHD'}" placeholder="Ej. 55\" 120Hz Full HD">
                </div>
                <div class="form-group">
                    <label for="cab-dims"><span class="neon-arrow">◆</span> Dimensiones Físicas</label>
                    <input type="text" id="cab-dims" class="cyber-input" value="${cabinet ? (cabinet.dimensions || '') : ''}" placeholder="Ej. 210cm x 175cm x 240cm">
                </div>
            </div>

            <div class="form-group">
                <label for="cab-desc"><span class="neon-arrow">◆</span> Descripción / Características Técnicas</label>
                <textarea id="cab-desc" class="cyber-textarea" rows="2" placeholder="Gabinete oficial de competición con barras pro y sonido 2.1...">${cabinet ? cabinet.description : ''}</textarea>
            </div>

            <div class="form-group">
                <label for="cab-status"><span class="neon-arrow">◆</span> Estado en Catálogo</label>
                <select id="cab-status" class="cyber-select">
                    <option value="ACTIVE" ${cabinet?.status === 'ACTIVE' ? 'selected' : ''}>Activo (Disponible para seleccionar en locales)</option>
                    <option value="INACTIVE" ${cabinet?.status === 'INACTIVE' ? 'selected' : ''}>Inactivo</option>
                </select>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-cab">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-cab">
            ${isEdit ? '💾 Guardar Cambios' : '➕ Guardar Modelo'}
        </button>
    `;

    const modalEl = modal.open({
        title: isEdit ? `Editar Gabinete: ${cabinet.name}` : 'Registrar Nuevo Modelo de Gabinete',
        icon: '🖥️',
        contentHtml,
        footerHtml,
        maxWidth: '540px'
    });

    modalEl.querySelector('#btn-cancel-cab').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-cab').onclick = async () => {
        const name = modalEl.querySelector('#cab-name').value.trim();
        const type = modalEl.querySelector('#cab-type').value;
        const screenSize = modalEl.querySelector('#cab-screen').value.trim();
        const dimensions = modalEl.querySelector('#cab-dims').value.trim();
        const description = modalEl.querySelector('#cab-desc').value.trim();
        const status = modalEl.querySelector('#cab-status').value;

        if (!name) {
            toast.error("Por favor ingresa el nombre del gabinete.");
            return;
        }

        try {
            if (isEdit) {
                await catalogsManager.updateCabinetModel(cabinet.id, {
                    name, type, screenSize, dimensions, description, status
                });
                toast.success("Modelo de gabinete actualizado.");
            } else {
                await catalogsManager.addCabinetModel({
                    name, type, screenSize, dimensions, description, status
                });
                toast.success("Nuevo modelo de gabinete agregado al catálogo global.");
            }
            modal.close();
            renderSuperadminView(container);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

function openGameVersionModal(version = null, container) {
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
                <label for="ver-min-cab"><span class="neon-arrow">◆</span> Gabinete Recomendado / Mínimo</label>
                <input type="text" id="ver-min-cab" class="cyber-input" value="${version ? (version.minCabinet || 'LX 55" / TX 50"') : 'LX 55" / TX 50"'}" placeholder="Ej. LX 55\" / TX 50\"">
            </div>

            <div class="form-group">
                <label for="ver-modes"><span class="neon-arrow">◆</span> Modos Soportados (separados por coma)</label>
                <input type="text" id="ver-modes" class="cyber-input" value="${version ? (version.supportedModes || []).join(', ') : 'Single, Double, Co-Op, UCS (Custom Steps), Premium Mode'}" placeholder="Single, Double, Co-Op">
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
        const minCabinet = modalEl.querySelector('#ver-min-cab').value.trim();
        const modesRaw = modalEl.querySelector('#ver-modes').value.trim();
        const supportedModes = modesRaw ? modesRaw.split(',').map(m => m.trim()).filter(Boolean) : ['Single', 'Double'];

        if (!name) {
            toast.error("Por favor ingresa el nombre de la versión.");
            return;
        }

        try {
            if (isEdit) {
                await catalogsManager.updateGameVersion(version.id, { name, releaseYear, latestPatch, status, minCabinet, supportedModes });
                toast.success("Versión de software actualizada.");
            } else {
                await catalogsManager.addGameVersion({ name, releaseYear, latestPatch, status, minCabinet, supportedModes });
                toast.success("Nueva versión de software registrada en el catálogo global.");
            }
            modal.close();
            renderSuperadminView(container);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

function openStaffFormModal(staff = null, container) {
    const isEdit = !!staff;
    const businesses = tenantManager.getAllBusinesses();
    const isSuper = staff?.role === 'SUPERADMIN';

    const bizOptions = businesses.map(b => `
        <option value="${b.id}" ${staff?.businessId === b.id ? 'selected' : ''}>
            ${b.name} (${b.city})
        </option>
    `).join('');

    const contentHtml = `
        <form id="form-staff-edit" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="stf-name"><span class="neon-arrow">◆</span> Nombre Completo *</label>
                    <input type="text" id="stf-name" class="cyber-input" value="${staff ? staff.name : ''}" placeholder="Ej. Roberto Martínez" required>
                </div>
                <div class="form-group">
                    <label for="stf-user"><span class="neon-arrow">◆</span> Nombre de Usuario *</label>
                    <input type="text" id="stf-user" class="cyber-input" value="${staff ? staff.username : ''}" placeholder="Ej. manager_norte" required>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="stf-pin"><span class="neon-arrow">◆</span> PIN / Contraseña de Acceso *</label>
                    <input type="text" id="stf-pin" class="cyber-input" value="${staff ? staff.pin : ''}" placeholder="Ej. 1234" maxlength="10" required>
                </div>
                <div class="form-group">
                    <label for="stf-email"><span class="neon-arrow">◆</span> Correo Electrónico</label>
                    <input type="email" id="stf-email" class="cyber-input" value="${staff ? (staff.email || '') : ''}" placeholder="staff@piuhub.com">
                </div>
            </div>

            ${!isSuper ? `
                <div class="form-group">
                    <label for="stf-biz"><span class="neon-arrow">◆</span> Local / Sucursal Asignada *</label>
                    <select id="stf-biz" class="cyber-select" required>
                        ${bizOptions}
                    </select>
                </div>
            ` : ''}
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-stf">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-stf">
            ${isEdit ? '💾 Guardar Cambios' : '👤 Crear Encargado'}
        </button>
    `;

    const modalEl = modal.open({
        title: isEdit ? `Editar Encargado: ${staff.name}` : 'Crear Nuevo Encargado',
        icon: '👤',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    modalEl.querySelector('#btn-cancel-stf').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-stf').onclick = async () => {
        const name = modalEl.querySelector('#stf-name').value.trim();
        const username = modalEl.querySelector('#stf-user').value.trim();
        const pin = modalEl.querySelector('#stf-pin').value.trim();
        const email = modalEl.querySelector('#stf-email').value.trim();
        const businessId = isSuper ? null : modalEl.querySelector('#stf-biz').value;

        if (!name || !username || !pin) {
            toast.error("Por favor completa los campos requeridos.");
            return;
        }

        try {
            if (isEdit) {
                await authManager.updateStaffManager(staff.id, { name, username, pin, email, businessId });
                toast.success(`Datos y contraseña de "${name}" actualizados.`);
            } else {
                await authManager.createStaffManager({ name, username, pin, email, businessId });
                toast.success(`Encargado "${name}" creado exitosamente.`);
            }
            modal.close();
            renderSuperadminView(container);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

function openCreateBusinessModal(container) {
    const STOCK_ARCADE = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80';
    const contentHtml = `
        <form id="form-create-biz-global" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="new-b-name"><span class="neon-arrow">◆</span> Nombre del Local *</label>
                    <input type="text" id="new-b-name" class="cyber-input" placeholder="Ej. PIU Arena Guadalajara" required>
                </div>
                <div class="form-group">
                    <label for="new-b-icon"><span class="neon-arrow">◆</span> Emoji Logo</label>
                    <input type="text" id="new-b-icon" class="cyber-input" value="⚡" style="max-width:80px; text-align:center; font-size:1.2rem;">
                </div>
            </div>

            <div class="form-group">
                <label for="new-b-img"><span class="neon-arrow">◆</span> URL Pública de Imagen / Banner</label>
                <input type="url" id="new-b-img" class="cyber-input" placeholder="https://scontent... o https://..." value="${STOCK_ARCADE}">
                <small style="color:var(--text-muted); font-size:0.75rem;">Admite enlaces directos públicos de Facebook, Instagram, Imgur, Cloudinary, etc.</small>
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
        maxWidth: '560px'
    });

    modalEl.querySelector('#btn-cancel-cb').onclick = () => modal.close();

    modalEl.querySelector('#btn-submit-cb').onclick = async () => {
        const name = modalEl.querySelector('#new-b-name').value.trim();
        const city = modalEl.querySelector('#new-b-city').value.trim();
        const logoIcon = modalEl.querySelector('#new-b-icon').value.trim() || '🕹️';
        const imageUrl = modalEl.querySelector('#new-b-img').value.trim() || STOCK_ARCADE;
        const whatsapp = modalEl.querySelector('#new-b-wa').value.trim();
        const openingTime = modalEl.querySelector('#new-b-open').value;
        const closingTime = modalEl.querySelector('#new-b-close').value;

        if (!name || !city) {
            toast.error("Por favor ingresa nombre y ciudad.");
            return;
        }

        try {
            await tenantManager.createBusiness({ name, city, logoIcon, imageUrl, whatsapp, openingTime, closingTime }, false);
            modal.close();
            toast.success(`¡Local "${name}" creado exitosamente!`);
            renderSuperadminView(container);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

/**
 * Modal de Control de Funciones y Módulos (Feature Toggles) por Sucursal
 */
function openBusinessModulesModal(business, container) {
    const modules = tenantManager.normalizeModules(business.enabledModules);
    const isBizActive = business.isActive !== false && business.status !== 'INACTIVE';

    const contentHtml = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            <!-- Encabezado de la Sucursal -->
            <div style="background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:14px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.8rem;">${business.logoIcon || '🕹️'}</span>
                    <div>
                        <strong style="color:#ffffff; font-size:1.1rem; display:block;">${escapeHTML(business.name)}</strong>
                        <small style="color:var(--text-muted); font-size:0.75rem;">ID: ${business.id} • ${escapeHTML(business.city)}</small>
                    </div>
                </div>
                <div>
                    <span class="badge ${isBizActive ? 'badge-success' : 'badge-warning'}" style="font-size:0.8rem; padding:4px 10px;">
                        ${isBizActive ? '🟢 SUCURSAL ACTIVA' : '⏸️ SUCURSAL PAUSADA'}
                    </span>
                </div>
            </div>

            <!-- Barra de Presets Rápidos -->
            <div style="background:var(--bg-dark-900); border:1px dashed var(--border-color); border-radius:var(--radius-md); padding:10px 14px;">
                <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px; letter-spacing:1px;">
                    ⚡ Perfiles Preconfigurados (Presets):
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-outline btn-xs" id="preset-all" style="border-color:var(--color-neon-lime); color:var(--color-neon-lime);">
                        ⚡ Modo Completo (Todo Activo)
                    </button>
                    <button type="button" class="btn btn-outline btn-xs" id="preset-basic" style="border-color:var(--piu-cyan); color:var(--piu-cyan);">
                        🕹️ Básico Arcade (Reservas + Ficha)
                    </button>
                    <button type="button" class="btn btn-outline btn-xs" id="preset-nofiad" style="border-color:var(--color-neon-gold); color:var(--color-neon-gold);">
                        🔒 Estricto (Sin Cuenta Fácil / Fiados)
                    </button>
                </div>
            </div>

            <form id="form-biz-modules" class="cyber-form" style="display:flex; flex-direction:column; gap:18px;">
                <!-- GRUPO 1: OPERACIÓN, CAJA Y MOSTRADOR -->
                <div>
                    <div style="font-size:0.82rem; font-weight:800; color:var(--piu-cyan); text-transform:uppercase; letter-spacing:1.5px; border-bottom:1px solid rgba(0,229,255,0.2); padding-bottom:4px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                        <span>💰</span> OPERACIÓN, CAJA Y MOSTRADOR
                    </div>
                    <div style="display:grid; grid-template-columns:1fr; gap:8px;">
                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-accounts" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.accounts ? 'checked' : ''}>
                            <div style="flex:1;">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <strong style="color:#ffffff; font-size:0.9rem;">💳 Cuenta Fácil & Caja Rápida (POS)</strong>
                                </div>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Terminal de cobro en mostrador, cuentas corrientes por cobrar (fiado), abonos y desglose de caja.
                                </small>
                            </div>
                        </label>

                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-catalogs" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.catalogs ? 'checked' : ''}>
                            <div style="flex:1;">
                                <strong style="color:#ffffff; font-size:0.9rem;">🛍️ Catálogos en Sala & Productos</strong>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Inventario de snacks, refrescos, fichas y accesorios a la venta para cobro rápido.
                                </small>
                            </div>
                        </label>

                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-requests" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.requests ? 'checked' : ''}>
                            <div style="flex:1;">
                                <strong style="color:#ffffff; font-size:0.9rem;">📥 Bandeja de Solicitudes</strong>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Bandeja de entrada para que el encargado apruebe, modifique o rechace reservaciones de clientes.
                                </small>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- GRUPO 2: COMUNIDAD, LEALTAD Y CLIENTES -->
                <div>
                    <div style="font-size:0.82rem; font-weight:800; color:var(--color-neon-lime); text-transform:uppercase; letter-spacing:1.5px; border-bottom:1px solid rgba(104,242,5,0.2); padding-bottom:4px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                        <span>👥</span> COMUNIDAD, LEALTAD Y CLIENTES
                    </div>
                    <div style="display:grid; grid-template-columns:1fr; gap:8px;">
                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-clients" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.clients ? 'checked' : ''}>
                            <div style="flex:1;">
                                <strong style="color:#ffffff; font-size:0.9rem;">👥 Directorio de Jugadores</strong>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Listado de jugadores registrados, búsqueda predictiva por PIU ID y escáner de credencial QR.
                                </small>
                            </div>
                        </label>

                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-loyalty" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.loyalty ? 'checked' : ''}>
                            <div style="flex:1;">
                                <strong style="color:#ffffff; font-size:0.9rem;">🎁 Programa de Lealtad y Recompensas</strong>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Tiers de lealtad (Bronce, Plata, Oro, Platino), acumulación de puntos por visita y canje de premios.
                                </small>
                            </div>
                        </label>

                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-myProfile" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.myProfile ? 'checked' : ''}>
                            <div style="flex:1;">
                                <strong style="color:#ffffff; font-size:0.9rem;">👤 Portal Mi Perfil (Gamer Pass)</strong>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Portal de autogestión para que los jugadores consulten su tarjeta QR, historial y saldo personal.
                                </small>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- GRUPO 3: VISTAS Y CALENDARIOS -->
                <div>
                    <div style="font-size:0.82rem; font-weight:800; color:var(--color-neon-gold); text-transform:uppercase; letter-spacing:1.5px; border-bottom:1px solid rgba(255,184,0,0.2); padding-bottom:4px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                        <span>📅</span> VISTAS DE CALENDARIO Y MÁQUINAS
                    </div>
                    <div style="display:grid; grid-template-columns:1fr; gap:8px;">
                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-calendarWeek" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.calendarWeek ? 'checked' : ''}>
                            <div style="flex:1;">
                                <strong style="color:#ffffff; font-size:0.9rem;">📊 Vista Semanal</strong>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Cuadrícula de ocupación para consultar la disponibilidad de los próximos 7 días.
                                </small>
                            </div>
                        </label>

                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-calendarMonth" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.calendarMonth ? 'checked' : ''}>
                            <div style="flex:1;">
                                <strong style="color:#ffffff; font-size:0.9rem;">🗓️ Vista Mensual</strong>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Calendario mensual con contador de turnos y eventos por fecha.
                                </small>
                            </div>
                        </label>

                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-machines" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.machines ? 'checked' : ''}>
                            <div style="flex:1;">
                                <strong style="color:#ffffff; font-size:0.9rem;">🕹️ Ficha Técnica de Máquinas</strong>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Catálogo público con las especificaciones de gabinetes, versiones y estado de sensores FSR.
                                </small>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- GRUPO 4: ADMINISTRACIÓN LOCAL & REPORTES -->
                <div>
                    <div style="font-size:0.82rem; font-weight:800; color:var(--color-neon-purple); text-transform:uppercase; letter-spacing:1.5px; border-bottom:1px solid rgba(157,78,221,0.2); padding-bottom:4px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                        <span>⚙️</span> ADMINISTRACIÓN LOCAL & REPORTES
                    </div>
                    <div style="display:grid; grid-template-columns:1fr; gap:8px;">
                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-analytics" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.analytics ? 'checked' : ''}>
                            <div style="flex:1;">
                                <strong style="color:#ffffff; font-size:0.9rem;">📈 Rendimiento & Métricas Financieras</strong>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Métricas de ingresos, horas jugadas, ocupación, gráficas Chart.js y comisiones a socios.
                                </small>
                            </div>
                        </label>

                        <label style="display:flex; align-items:flex-start; gap:12px; background:var(--bg-dark-800); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; cursor:pointer;">
                            <input type="checkbox" id="mod-business" style="width:18px; height:18px; accent-color:var(--color-neon-lime); margin-top:2px; cursor:pointer;" ${modules.business ? 'checked' : ''}>
                            <div style="flex:1;">
                                <strong style="color:#ffffff; font-size:0.9rem;">⚙️ Ajustes de Sucursal (Por Encargado)</strong>
                                <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">
                                    Permite al personal de mostrador editar horarios de apertura, porcentaje de anticipo y reglas locales.
                                </small>
                            </div>
                        </label>
                    </div>
                </div>
            </form>
        </div>
    `;

    const footerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-mod">Cancelar</button>
            <button type="button" class="btn btn-primary glow-red" id="btn-save-mod">
                💾 Guardar Configuración de Funciones
            </button>
        </div>
    `;

    const modalEl = modal.open({
        title: `Configurar Funciones: ${business.name}`,
        icon: '🎛️',
        contentHtml,
        footerHtml,
        maxWidth: '680px'
    });

    // Eventos de Presets
    const setAllCheckboxes = (valMap) => {
        for (const [key, isChecked] of Object.entries(valMap)) {
            const cb = modalEl.querySelector(`#mod-${key}`);
            if (cb) cb.checked = isChecked;
        }
    };

    modalEl.querySelector('#preset-all')?.addEventListener('click', () => {
        setAllCheckboxes({
            accounts: true, clients: true, loyalty: true, requests: true,
            analytics: true, business: true, catalogs: true, calendarWeek: true,
            calendarMonth: true, machines: true, myProfile: true
        });
        toast.info("Preset aplicado: Todas las funciones activadas.");
    });

    modalEl.querySelector('#preset-basic')?.addEventListener('click', () => {
        setAllCheckboxes({
            accounts: false, clients: true, loyalty: false, requests: true,
            analytics: false, business: false, catalogs: false, calendarWeek: true,
            calendarMonth: false, machines: true, myProfile: false
        });
        toast.info("Preset aplicado: Modo Básico Arcade.");
    });

    modalEl.querySelector('#preset-nofiad')?.addEventListener('click', () => {
        setAllCheckboxes({
            accounts: false, clients: true, loyalty: true, requests: true,
            analytics: true, business: true, catalogs: true, calendarWeek: true,
            calendarMonth: true, machines: true, myProfile: true
        });
        toast.info("Preset aplicado: Modo Estricto (Sin Cuenta Fácil).");
    });

    modalEl.querySelector('#btn-cancel-mod').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-mod').onclick = async () => {
        const updatedModules = {
            accounts: modalEl.querySelector('#mod-accounts')?.checked ?? true,
            catalogs: modalEl.querySelector('#mod-catalogs')?.checked ?? true,
            requests: modalEl.querySelector('#mod-requests')?.checked ?? true,
            clients: modalEl.querySelector('#mod-clients')?.checked ?? true,
            loyalty: modalEl.querySelector('#mod-loyalty')?.checked ?? true,
            myProfile: modalEl.querySelector('#mod-myProfile')?.checked ?? true,
            calendarWeek: modalEl.querySelector('#mod-calendarWeek')?.checked ?? true,
            calendarMonth: modalEl.querySelector('#mod-calendarMonth')?.checked ?? true,
            machines: modalEl.querySelector('#mod-machines')?.checked ?? true,
            analytics: modalEl.querySelector('#mod-analytics')?.checked ?? true,
            business: modalEl.querySelector('#mod-business')?.checked ?? true
        };

        try {
            await tenantManager.updateBusinessModules(business.id, updatedModules);
            toast.success(`Funciones de "${business.name}" actualizadas exitosamente.`);
            modal.close();
            renderSuperadminView(container);
        } catch (e) {
            toast.error(e.message || "Error al actualizar módulos.");
        }
    };
}
