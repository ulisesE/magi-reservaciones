// js/views/requestsView.js
// Bandeja de solicitudes de reservación para el Encargado (Aprobar, Rechazar, Modificar)
import { store } from '../core/store.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { addMinutesToTime, formatFriendlyDate, format12Hour, formatDuration, generateTimeSlots, getAvailableDurations, getBusinessHoursForDate, timeToMinutes, calculateBookingCost } from '../core/timeUtils.js';
import { showReservationTicket } from './clientBookingModal.js';
import { escapeHTML } from '../core/securityUtils.js';

let activeFilter = 'PENDING'; // 'PENDING', 'CONFIRMED', 'REJECTED', 'ALL'
let currentPage = 1;
let searchQuery = '';
let selectedMachine = '';
const pageSize = 15;

export function renderRequestsView(container) {
    const business = store.currentBusiness;
    const machines = store.getMachines();
    
    // 1. Mostrar loader de inmediato
    container.innerHTML = `
        <div class="requests-view-wrapper animate-fade-in" style="padding: 48px 24px; text-align: center; background:var(--bg-dark-800); border-radius:var(--radius-md); border:1px solid var(--border-color); max-width:600px; margin:40px auto;">
            <div class="empty-icon pulse-glow" style="font-size:3rem; margin-bottom:16px;">📥</div>
            <h3>Cargando solicitudes de reservas...</h3>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-top:8px;">Consultando base de datos Firestore de forma optimizada...</p>
        </div>
    `;

    // 2. Cargar asíncronamente
    store.loadReservationsForTray().then(allReservations => {
        const pendingCount = allReservations.filter(r => r.status === 'PENDING').length;
        const confirmedCount = allReservations.filter(r => r.status === 'CONFIRMED').length;
        const rejectedCount = allReservations.filter(r => r.status === 'REJECTED').length;
        const cancelledCount = allReservations.filter(r => r.status === 'CANCELLED').length;

        container.innerHTML = `
            <div class="requests-view-wrapper animate-fade-in">
                <!-- Header de Bandeja -->
                <div class="view-header-bar">
                    <div class="header-left">
                        <h2 class="friendly-date-title">📥 Bandeja de Solicitudes y Reservaciones</h2>
                        <p class="subtitle-text">Gestiona, aprueba, rechaza, cancela o reprograma las solicitudes de tus clientes.</p>
                    </div>
                </div>

                <!-- Filtros de Estado -->
                <div class="requests-filter-bar">
                    <button class="filter-tab ${activeFilter === 'PENDING' ? 'active' : ''}" data-filter="PENDING">
                        <span>⏳ Pendientes</span>
                        <span class="filter-pill pill-warning">${pendingCount}</span>
                    </button>
                    <button class="filter-tab ${activeFilter === 'CONFIRMED' ? 'active' : ''}" data-filter="CONFIRMED">
                        <span>✅ Confirmadas</span>
                        <span class="filter-pill pill-success">${confirmedCount}</span>
                    </button>
                    <button class="filter-tab ${activeFilter === 'CANCELLED' ? 'active' : ''}" data-filter="CANCELLED">
                        <span>🚫 Canceladas</span>
                        <span class="filter-pill pill-secondary">${cancelledCount}</span>
                    </button>
                    <button class="filter-tab ${activeFilter === 'REJECTED' ? 'active' : ''}" data-filter="REJECTED">
                        <span>❌ Rechazadas</span>
                        <span class="filter-pill pill-danger">${rejectedCount}</span>
                    </button>
                    <button class="filter-tab ${activeFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">
                        <span>📋 Todas (${allReservations.length})</span>
                    </button>
                </div>

                <!-- Barra de Búsqueda y Control de Filtros -->
                <div class="requests-search-bar" style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap; align-items:center; background:var(--bg-dark-800); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                    <div class="form-group" style="margin:0; flex:2; min-width:200px;">
                        <input type="text" id="search-req" class="cyber-input" placeholder="🔍 Buscar por nombre, GamerTag o teléfono..." value="${searchQuery}" style="padding:8px 12px;">
                    </div>
                    <div class="form-group" style="margin:0; flex:1; min-width:150px;">
                        <select id="filter-mach" class="cyber-select" style="padding:8px 12px;">
                            <option value="">Todas las Máquinas</option>
                            ${machines.map(m => `<option value="${m.id}" ${m.id === selectedMachine ? 'selected' : ''}>${m.name.split(' (')[0]}</option>`).join('')}
                        </select>
                    </div>
                    <div style="color:var(--text-muted); font-size:0.85rem; display:flex; gap:6px; align-items:center;">
                        <span>Mostrando:</span>
                        <strong id="visible-count" style="color:var(--color-neon-lime);">0</strong>
                        <span>de</span>
                        <strong id="total-count" style="color:#ffffff;">0</strong>
                    </div>
                </div>

                <!-- Listado en Formato Tabla para Alto Volumen -->
                <div class="table-responsive animate-fade-in" style="overflow-x:auto; background:var(--bg-dark-800); border-radius:var(--radius-sm); border:1px solid var(--border-color); box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                    <table class="catalogs-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                        <thead>
                            <tr style="border-bottom:2px solid var(--border-color); background:rgba(0,0,0,0.4); color:var(--text-muted);">
                                <th style="padding:12px; font-weight:600;">Folio / Estado</th>
                                <th style="padding:12px; font-weight:600;">Jugador / Cliente</th>
                                <th style="padding:12px; font-weight:600;">Máquina / Modo</th>
                                <th style="padding:12px; font-weight:600;">Fecha / Horario</th>
                                <th style="padding:12px; font-weight:600;">Total</th>
                                <th style="padding:12px; font-weight:600; text-align:right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="requests-table-body">
                            <!-- Carga dinámica por JS -->
                        </tbody>
                    </table>
                </div>

                <!-- Controles de Paginación -->
                <div class="requests-pagination" style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding:12px 0;">
                    <div style="font-size:0.85rem; color:var(--text-muted);">
                        Página <strong id="current-page-num" style="color:#ffffff;">1</strong> de <strong id="total-pages-num">1</strong>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="btn btn-outline btn-sm" id="btn-prev-page" style="padding:6px 16px; font-size:0.8rem;">◀ Anterior</button>
                        <button type="button" class="btn btn-outline btn-sm" id="btn-next-page" style="padding:6px 16px; font-size:0.8rem;">Siguiente ▶</button>
                    </div>
                </div>
            </div>
        `;

        // Filtros de pestaña
        container.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                activeFilter = tab.dataset.filter;
                currentPage = 1;
                renderRequestsView(container);
            });
        });

        const applyFiltersAndRender = () => {
            let filtered = allReservations;
            if (activeFilter === 'PENDING') filtered = allReservations.filter(r => r.status === 'PENDING');
            else if (activeFilter === 'CONFIRMED') filtered = allReservations.filter(r => r.status === 'CONFIRMED');
            else if (activeFilter === 'CANCELLED') filtered = allReservations.filter(r => r.status === 'CANCELLED');
            else if (activeFilter === 'REJECTED') filtered = allReservations.filter(r => r.status === 'REJECTED');

            if (searchQuery) {
                filtered = filtered.filter(r => 
                    (r.clientName && r.clientName.toLowerCase().includes(searchQuery)) ||
                    (r.clientUsername && r.clientUsername.toLowerCase().includes(searchQuery)) ||
                    (r.clientPhone && r.clientPhone.includes(searchQuery)) ||
                    (r.id && r.id.toLowerCase().includes(searchQuery))
                );
            }

            if (selectedMachine) {
                filtered = filtered.filter(r => r.machineId === selectedMachine);
            }

            const totalCount = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
            if (currentPage > totalPages) currentPage = totalPages;

            const startIdx = (currentPage - 1) * pageSize;
            const pageReservations = filtered.slice(startIdx, startIdx + pageSize);

            const visibleCountEl = container.querySelector('#visible-count');
            const totalCountEl = container.querySelector('#total-count');
            const curPageEl = container.querySelector('#current-page-num');
            const totPagesEl = container.querySelector('#total-pages-num');

            if (visibleCountEl) visibleCountEl.textContent = pageReservations.length;
            if (totalCountEl) totalCountEl.textContent = totalCount;
            if (curPageEl) curPageEl.textContent = currentPage;
            if (totPagesEl) totPagesEl.textContent = totalPages;

            const prevBtn = container.querySelector('#btn-prev-page');
            const nextBtn = container.querySelector('#btn-next-page');
            if (prevBtn) prevBtn.disabled = currentPage === 1;
            if (nextBtn) nextBtn.disabled = currentPage === totalPages;

            const tbody = container.querySelector('#requests-table-body');
            if (!tbody) return;

            if (pageReservations.length === 0) {
                let emptyMessage = 'No se encontraron reservaciones con los criterios seleccionados.';
                if (activeFilter === 'PENDING' && confirmedCount > 0) {
                    emptyMessage = `No hay solicitudes pendientes por autorizar. Hay <strong style="color:var(--color-neon-lime);">${confirmedCount} reservación(es) confirmada(s)</strong> agendadas.`;
                }
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px 16px;">
                            <div style="font-size: 1.5rem; margin-bottom: 8px;">📭</div>
                            <div>${emptyMessage}</div>
                            ${activeFilter === 'PENDING' && confirmedCount > 0 ? `
                                <button type="button" class="btn btn-outline btn-sm btn-switch-to-all" style="margin-top:12px; font-size:0.8rem;">
                                    📋 Ver todas las reservaciones (${allReservations.length})
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `;
                tbody.querySelector('.btn-switch-to-all')?.addEventListener('click', () => {
                    activeFilter = 'ALL';
                    currentPage = 1;
                    renderRequestsView(container);
                });
                return;
            }

            tbody.innerHTML = pageReservations.map(r => {
                const machine = store.getMachineById(r.machineId);
                const isPending = r.status === 'PENDING';
                const isConfirmed = r.status === 'CONFIRMED';
                
                let badgeClass = 'badge-warning';
                let badgeText = 'Pendiente';
                if (isConfirmed) {
                    badgeClass = 'badge-success';
                    badgeText = 'Confirmada';
                } else if (r.status === 'REJECTED') {
                    badgeClass = 'badge-danger';
                    badgeText = 'Rechazada';
                } else if (r.status === 'CANCELLED') {
                    badgeClass = 'badge-secondary';
                    badgeText = 'Cancelada';
                }

                return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                        <td style="padding:12px; white-space:nowrap;">
                            <div style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">#${r.id.slice(-6).toUpperCase()}</div>
                            <span class="badge ${badgeClass}" style="font-size:0.7rem; padding:2px 6px;">${badgeText}</span>
                        </td>
                        <td style="padding:12px;">
                            <strong style="color:#ffffff;">${escapeHTML(r.clientName)}</strong>
                            ${r.clientUsername ? `<div style="font-size:0.78rem; color:var(--piu-cyan);">@${escapeHTML(r.clientUsername)}</div>` : ''}
                        </td>
                        <td style="padding:12px;">
                            <div>${machine ? machine.name.split(' (')[0] : 'Máquina PIU'}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${r.playersMode === 2 ? '👥 Double / 2P' : '👤 Single / 1P'}</div>
                        </td>
                        <td style="padding:12px; white-space:nowrap;">
                            <div>${formatFriendlyDate(r.date)}</div>
                            <div style="font-size:0.8rem; color:var(--piu-cyan); font-family:var(--font-mono); font-weight:700;">${format12Hour(r.startTime)} - ${format12Hour(r.endTime)}</div>
                        </td>
                        <td style="padding:12px; font-weight:700; font-family:var(--font-mono); color:var(--color-chartreuse);">${business.currencySymbol}${r.totalCost}</td>
                        <td style="padding:12px; text-align:right; white-space:nowrap;">
                            <div style="display:flex; gap:6px; justify-content:flex-end;">
                                <button class="btn btn-outline btn-xs btn-view-ticket" data-id="${r.id}" title="Ver Comprobante">🎟️ Ticket</button>
                                ${isPending ? `
                                    <button class="btn btn-success btn-xs btn-approve-res" data-id="${r.id}">✔️ Aprobar</button>
                                    <button class="btn btn-danger btn-xs btn-reject-res" data-id="${r.id}">❌ Rechazar</button>
                                ` : ''}
                                <button class="btn btn-outline btn-xs btn-edit-res" data-id="${r.id}" title="Reprogramar/Modificar">✏️</button>
                                <button class="btn btn-danger btn-xs btn-del-res" data-id="${r.id}" title="Eliminar de historial">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Eventos de tabla
            tbody.querySelectorAll('.btn-view-ticket').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const res = allReservations.find(r => r.id === id);
                    if (res) showReservationTicket(res);
                });
            });

            tbody.querySelectorAll('.btn-approve-res').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    try {
                        await store.approveReservation(id);
                        toast.success("Reservación aprobada.");
                        renderRequestsView(container);
                    } catch (err) {
                        toast.error(err.message);
                    }
                });
            });

            tbody.querySelectorAll('.btn-reject-res').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const res = allReservations.find(r => r.id === id);
                    if (res) openRejectModal(res);
                });
            });

            tbody.querySelectorAll('.btn-edit-res').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const res = allReservations.find(r => r.id === id);
                    if (res) openModifyModal(res, container);
                });
            });

            tbody.querySelectorAll('.btn-del-res').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    if (confirm("¿Estás seguro de eliminar el registro de esta reservación?")) {
                        await store.deleteReservation(id);
                        toast.info("Registro eliminado.");
                        renderRequestsView(container);
                    }
                });
            });
        };

        // Listeners para búsqueda y filtros
        const searchInput = container.querySelector('#search-req');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase().trim();
                currentPage = 1;
                applyFiltersAndRender();
            });
        }

        const machSelect = container.querySelector('#filter-mach');
        if (machSelect) {
            machSelect.addEventListener('change', (e) => {
                selectedMachine = e.target.value;
                currentPage = 1;
                applyFiltersAndRender();
            });
        }

        // Controles de paginación
        const prevBtn = container.querySelector('#btn-prev-page');
        const nextBtn = container.querySelector('#btn-next-page');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    applyFiltersAndRender();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentPage++;
                applyFiltersAndRender();
            });
        }

        // Carga inicial
        applyFiltersAndRender();
    });
}

/**
 * Modal para Rechazar una Solicitud con motivo
 */
function openRejectModal(reservation) {
    const contentHtml = `
        <div class="cyber-form">
            <p>Indica el motivo por el cual rechazas la solicitud de <strong>${escapeHTML(reservation.clientName)}</strong>:</p>
            
            <div class="form-group">
                <label for="reject-predefined"><span class="neon-arrow">◆</span> Motivo común</label>
                <select id="reject-predefined" class="cyber-select">
                    <option value="Horario ocupado por evento / torneo">Horario ocupado por evento / torneo</option>
                    <option value="La máquina seleccionada entrará a mantenimiento">Máquina entrará a mantenimiento</option>
                    <option value="Fuera del horario de servicio del local">Fuera del horario de servicio</option>
                    <option value="Otro">Otro motivo personalizado...</option>
                </select>
            </div>

            <div class="form-group">
                <label for="reject-reason-custom"><span class="neon-arrow">◆</span> Mensaje para el cliente</label>
                <textarea id="reject-reason-custom" class="cyber-textarea" rows="3">Horario ocupado por evento / torneo</textarea>
            </div>
        </div>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-rej">Cancelar</button>
        <button type="button" class="btn btn-danger" id="btn-confirm-rej">Confirmar Rechazo</button>
    `;

    const modalEl = modal.open({
        title: 'Rechazar Solicitud de Reservación',
        icon: '❌',
        contentHtml,
        footerHtml,
        maxWidth: '460px'
    });

    modalEl.querySelector('#btn-cancel-rej').onclick = () => modal.close();

    modalEl.querySelector('#reject-predefined').addEventListener('change', (e) => {
        const val = e.target.value;
        const textarea = modalEl.querySelector('#reject-reason-custom');
        if (val !== 'Otro') {
            textarea.value = val;
        } else {
            textarea.value = '';
            textarea.focus();
        }
    });

    modalEl.querySelector('#btn-confirm-rej').onclick = async () => {
        const reason = modalEl.querySelector('#reject-reason-custom').value.trim();
        if (!reason) {
            toast.error("Por favor indica una razón para rechazar la solicitud.");
            return;
        }

        try {
            await store.rejectReservation(reservation.id, reason);
            modal.close();
            toast.warning(`Solicitud rechazada. Se envió la notificación.`);
            // Refrescar vista llamando al contenedor activo
            const activeViewContainer = document.getElementById('main-content');
            if (activeViewContainer) renderRequestsView(activeViewContainer);
        } catch (err) {
            toast.error(err.message || "Error al rechazar solicitud");
        }
    };
}

/**
 * Modal para Editar/Reasignar una Reservación
 */
export function openModifyModal(reservation, mainContainer = null) {
    const business = store.currentBusiness;
    const slotDuration = business.slotDuration || 60;
    const machines = store.getActiveMachines();

    const contentHtml = `
        <form id="form-modify-res" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mod-machine"><span class="neon-arrow">◆</span> Máquina</label>
                    <select id="mod-machine" class="cyber-select">
                        ${machines.map(m => `<option value="${m.id}" ${m.id === reservation.machineId ? 'selected' : ''}>${escapeHTML(m.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="mod-players-mode"><span class="neon-arrow">◆</span> Modo de Juego</label>
                    <select id="mod-players-mode" class="cyber-select">
                        <option value="1" ${reservation.playersMode === 1 ? 'selected' : ''}>👤 Single / 1 Jugador</option>
                        <option value="2" ${reservation.playersMode === 2 ? 'selected' : ''}>👥 Double / 2 Jugadores</option>
                    </select>
                </div>
            </div>

            <div class="form-row grid-3">
                <div class="form-group">
                    <label for="mod-date"><span class="neon-arrow">◆</span> Fecha</label>
                    <input type="date" id="mod-date" class="cyber-input" value="${reservation.date}" required>
                </div>
                <div class="form-group">
                    <label for="mod-time"><span class="neon-arrow">◆</span> Hora de Inicio</label>
                    <select id="mod-time" class="cyber-select">
                        <!-- slots de tiempo se renderizan al detectar fecha -->
                        <option value="${reservation.startTime}">${format12Hour(reservation.startTime)}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="mod-duration"><span class="neon-arrow">◆</span> Duración</label>
                    <select id="mod-duration" class="cyber-select">
                        <option value="${reservation.durationMinutes}">${formatDuration(reservation.durationMinutes)}</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label for="mod-notes"><span class="neon-arrow">◆</span> Notas Administrativas</label>
                <input type="text" id="mod-notes" class="cyber-input" value="${escapeHTML(reservation.adminNotes || '')}" placeholder="Ej. Reasignada a cabina LX por petición del jugador">
            </div>

            <div id="mod-error" class="form-error-msg hidden"></div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-mod">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-mod">💾 Guardar y Confirmar</button>
    `;

    const modalEl = modal.open({
        title: 'Modificar y Reasignar Reservación',
        icon: '✏️',
        contentHtml,
        footerHtml,
        maxWidth: '540px'
    });

    modalEl.querySelector('#btn-cancel-mod').onclick = () => modal.close();

    const updateModDurations = () => {
        const durationSelect = modalEl.querySelector('#mod-duration');
        const selectedDate = modalEl.querySelector('#mod-date').value;
        const { closingTime } = getBusinessHoursForDate(business, selectedDate);
        const durations = getAvailableDurations(
            modalEl.querySelector('#mod-time').value,
            closingTime || '22:00',
            slotDuration
        );
        durationSelect.innerHTML = durations.map(duration => `<option value="${duration}">${formatDuration(duration)}</option>`).join('');
    };

    modalEl.querySelector('#mod-time').addEventListener('change', updateModDurations);

    modalEl.querySelector('#mod-date').addEventListener('change', (e) => {
        const newDate = e.target.value;
        if (!newDate) return;
        
        const { openingTime: opt, closingTime: clt, closed: isCl } = getBusinessHoursForDate(business, newDate);
        const timeSelect = modalEl.querySelector('#mod-time');
        const durationSelect = modalEl.querySelector('#mod-duration');
        const errorMsg = modalEl.querySelector('#mod-error');
        const saveBtn = modalEl.querySelector('#btn-save-mod');
        
        if (isCl) {
            errorMsg.textContent = 'La sucursal está cerrada en la fecha seleccionada. Por favor, elige otra.';
            errorMsg.classList.remove('hidden');
            timeSelect.innerHTML = '<option value="">Cerrado</option>';
            durationSelect.innerHTML = '<option value="">-</option>';
            timeSelect.disabled = true;
            durationSelect.disabled = true;
            saveBtn.disabled = true;
            return;
        }
        
        timeSelect.disabled = false;
        durationSelect.disabled = false;
        saveBtn.disabled = false;
        errorMsg.classList.add('hidden');
        
        const newSlots = generateTimeSlots(opt, clt, slotDuration);
        if (newSlots.length === 0) {
            timeSelect.innerHTML = '<option value="">No hay slots disponibles</option>';
            durationSelect.innerHTML = '<option value="">-</option>';
            return;
        }
        
        const openMinutes = timeToMinutes(opt);
        const closeMinutes = timeToMinutes(clt);
        const isOvernight = closeMinutes < openMinutes;
        
        timeSelect.innerHTML = newSlots.map(s => {
            const label = (isOvernight && timeToMinutes(s.start) < openMinutes) 
                ? `${format12Hour(s.start)} (Siguiente día)` 
                : format12Hour(s.start);
            return `<option value="${s.start}">${label}</option>`;
        }).join('');
        
        const durations = getAvailableDurations(newSlots[0].start, clt, slotDuration);
        durationSelect.innerHTML = durations.map(d => `<option value="${d}">${formatDuration(d)}</option>`).join('');
    });

    modalEl.querySelector('#btn-save-mod').onclick = async () => {
        const machineId = modalEl.querySelector('#mod-machine').value;
        const date = modalEl.querySelector('#mod-date').value;
        const startTime = modalEl.querySelector('#mod-time').value;
        const durationMinutes = parseInt(modalEl.querySelector('#mod-duration').value, 10);
        const endTime = addMinutesToTime(startTime, durationMinutes);
        const adminNotes = modalEl.querySelector('#mod-notes').value.trim();
        const errorDiv = modalEl.querySelector('#mod-error');

        const playersMode = parseInt(modalEl.querySelector('#mod-players-mode')?.value, 10) || 1;
        const mach = store.getMachineById(machineId);
        const totalCost = calculateBookingCost(durationMinutes, playersMode, mach, business);

        try {
            await store.modifyReservation(reservation.id, {
                machineId,
                date,
                startTime,
                endTime,
                durationMinutes,
                playersMode,
                totalCost,
                adminNotes: adminNotes || 'Horario modificado por encargado.'
            });

            modal.close();
            toast.success(`Reservación modificada y confirmada.`);
            if (mainContainer) renderRequestsView(mainContainer);
        } catch (err) {
            errorDiv.textContent = err.message || 'Error al modificar reservación';
            errorDiv.classList.remove('hidden');
        }
    };
}
