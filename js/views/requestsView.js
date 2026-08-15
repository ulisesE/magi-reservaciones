// js/views/requestsView.js
// Bandeja de solicitudes de reservación para el Encargado (Aprobar, Rechazar, Modificar)
import { store } from '../core/store.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { addMinutesToTime, formatFriendlyDate, format12Hour, formatDuration, generateTimeSlots, getAvailableDurations, getBusinessHoursForDate, timeToMinutes, calculateBookingCost } from '../core/timeUtils.js';
import { showReservationTicket } from './clientBookingModal.js';

let activeFilter = 'PENDING'; // 'PENDING', 'CONFIRMED', 'REJECTED', 'ALL'
let currentPage = 1;
let searchQuery = '';
let selectedMachine = '';
const pageSize = 15;

export function renderRequestsView(container) {
    const business = store.currentBusiness;
    const allReservations = store.getReservations().sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    const machines = store.getMachines();
    
    const pendingCount = allReservations.filter(r => r.status === 'PENDING').length;
    const confirmedCount = allReservations.filter(r => r.status === 'CONFIRMED').length;
    const rejectedCount = allReservations.filter(r => r.status === 'REJECTED').length;

    container.innerHTML = `
        <div class="requests-view-wrapper animate-fade-in">
            <!-- Header de Bandeja -->
            <div class="view-header-bar">
                <div class="header-left">
                    <h2 class="friendly-date-title">📥 Bandeja de Solicitudes y Reservaciones</h2>
                    <p class="subtitle-text">Gestiona, aprueba, rechaza o reprograma las solicitudes de tus clientes.</p>
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
        // 1. Filtrar por estado (pestaña activa)
        let filtered = allReservations;
        if (activeFilter === 'PENDING') filtered = allReservations.filter(r => r.status === 'PENDING');
        else if (activeFilter === 'CONFIRMED') filtered = allReservations.filter(r => r.status === 'CONFIRMED');
        else if (activeFilter === 'REJECTED') filtered = allReservations.filter(r => r.status === 'REJECTED');

        // 2. Filtrar por búsqueda de texto
        if (searchQuery) {
            filtered = filtered.filter(r => 
                (r.clientName && r.clientName.toLowerCase().includes(searchQuery)) ||
                (r.clientUsername && r.clientUsername.toLowerCase().includes(searchQuery)) ||
                (r.clientPhone && r.clientPhone.includes(searchQuery)) ||
                (r.id && r.id.toLowerCase().includes(searchQuery))
            );
        }

        // 3. Filtrar por máquina
        if (selectedMachine) {
            filtered = filtered.filter(r => r.machineId === selectedMachine);
        }

        // 4. Calcular paginación
        const totalCount = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;

        const startIdx = (currentPage - 1) * pageSize;
        const pageReservations = filtered.slice(startIdx, startIdx + pageSize);

        // 5. Renderizar contadores
        const visibleCountEl = container.querySelector('#visible-count');
        const totalCountEl = container.querySelector('#total-count');
        const curPageEl = container.querySelector('#current-page-num');
        const totPagesEl = container.querySelector('#total-pages-num');

        if (visibleCountEl) visibleCountEl.textContent = pageReservations.length;
        if (totalCountEl) totalCountEl.textContent = totalCount;
        if (curPageEl) curPageEl.textContent = currentPage;
        if (totPagesEl) totPagesEl.textContent = totalPages;

        // 6. Activar/Desactivar botones de paginación
        const prevBtn = container.querySelector('#btn-prev-page');
        const nextBtn = container.querySelector('#btn-next-page');
        if (prevBtn) prevBtn.disabled = currentPage === 1;
        if (nextBtn) nextBtn.disabled = currentPage === totalPages;

        // 7. Renderizar filas
        const tbody = container.querySelector('#requests-table-body');
        if (!tbody) return;

        if (pageReservations.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 24px;">
                        No se encontraron reservaciones con los criterios seleccionados.
                    </td>
                </tr>
            `;
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

            const cleanPhone = (r.clientPhone || '').replace(/\D/g, '');
            const waLink = cleanPhone ? `https://wa.me/52${cleanPhone}` : '#';

            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                    <td style="padding:12px; white-space:nowrap;">
                        <div style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">#${r.id.slice(-6).toUpperCase()}</div>
                        <span class="badge ${badgeClass}" style="font-size:0.7rem; padding:2px 6px;">${badgeText}</span>
                    </td>
                    <td style="padding:12px;">
                        <div style="font-weight:700; color:#ffffff;">${r.clientName}</div>
                        <div style="font-size:0.75rem; color:var(--piu-cyan);">
                            ${r.clientUsername ? `@${r.clientUsername}` : 'Invitado'}
                            ${cleanPhone ? `• <a href="${waLink}" target="_blank" style="color:var(--color-neon-lime); text-decoration:none;">💬 WA</a>` : ''}
                        </div>
                    </td>
                    <td style="padding:12px; color:#ffffff;">
                        <strong>${machine ? machine.name.split(' (')[0] : 'PIU Machine'}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${r.playersMode === 2 ? '👥 2 Jugadores' : '👤 1 Jugador'}</div>
                    </td>
                    <td style="padding:12px; white-space:nowrap;">
                        <div>📅 ${formatFriendlyDate(r.date)}</div>
                        <div style="font-size:0.8rem; color:var(--piu-cyan);">⏰ ${format12Hour(r.startTime)} - ${format12Hour(r.endTime)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">⏳ ${formatDuration(r.durationMinutes)}</div>
                    </td>
                    <td style="padding:12px;">
                        <strong class="highlight-gold" style="font-size:0.95rem;">${business.currencySymbol}${r.totalCost}</strong>
                    </td>
                    <td style="padding:12px; text-align:right; white-space:nowrap;">
                        <div style="display:flex; justify-content:flex-end; gap:6px;">
                            <button type="button" class="btn btn-outline btn-xs btn-ticket-res" data-id="${r.id}" style="padding:4px 8px;">
                                🎟️ Pase
                            </button>
                            ${isPending ? `
                                <button type="button" class="btn btn-primary btn-xs btn-approve-res glow-green" data-id="${r.id}" style="background:var(--color-neon-lime); color:#000000; border-color:var(--color-neon-lime); padding:4px 8px;">
                                    Aprobar
                                </button>
                                <button type="button" class="btn btn-warning btn-xs btn-modify-res" data-id="${r.id}" style="padding:4px 8px;">
                                    ✏️ Modif.
                                </button>
                                <button type="button" class="btn btn-danger btn-xs btn-reject-res" data-id="${r.id}" style="padding:4px 8px;">
                                    ✖
                                </button>
                            ` : ''}
                            ${isConfirmed ? `
                                <button type="button" class="btn btn-warning btn-xs btn-modify-res" data-id="${r.id}" style="padding:4px 8px;">
                                    ✏️ Reasignar
                                </button>
                            ` : ''}
                            ${!isPending ? `
                                <button type="button" class="btn btn-danger btn-xs btn-del-res" data-id="${r.id}" style="padding:4px 8px;">
                                    🗑️
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Wire click handlers for dynamic buttons
        tbody.querySelectorAll('.btn-ticket-res').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const res = store.reservations.find(r => r.id === id);
                if (res) showReservationTicket(res);
            });
        });

        tbody.querySelectorAll('.btn-approve-res').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const res = store.reservations.find(r => r.id === id);
                if (!res) return;
                if (confirm(`¿Aprobar reservación de ${res.clientName}?`)) {
                    try {
                        await store.approveReservation(id);
                        toast.success(`Reservación aprobada.`);
                        renderRequestsView(container);
                    } catch (e) {
                        toast.error(e.message);
                    }
                }
            });
        });

        tbody.querySelectorAll('.btn-reject-res').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const res = store.reservations.find(r => r.id === id);
                if (res) openRejectModal(res);
            });
        });

        tbody.querySelectorAll('.btn-modify-res').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const res = store.reservations.find(r => r.id === id);
                if (res) openModifyModal(res);
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
};

/**
 * Modal para Rechazar una Solicitud con motivo
 */
function openRejectModal(reservation) {
    const contentHtml = `
        <div class="cyber-form">
            <p>Indica el motivo por el cual rechazas la solicitud de <strong>${reservation.clientName}</strong>:</p>
            
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
        maxWidth: '500px'
    });

    const selectPre = modalEl.querySelector('#reject-predefined');
    const txtReason = modalEl.querySelector('#reject-reason-custom');

    selectPre.addEventListener('change', () => {
        if (selectPre.value !== 'Otro') {
            txtReason.value = selectPre.value;
        } else {
            txtReason.value = '';
            txtReason.focus();
        }
    });

    modalEl.querySelector('#btn-cancel-rej').onclick = () => modal.close();

    modalEl.querySelector('#btn-confirm-rej').onclick = async () => {
        const reason = txtReason.value.trim() || 'Horario no disponible.';
        try {
            await store.rejectReservation(reservation.id, reason);
            modal.close();
            toast.warning(`Solicitud rechazada.`);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

/**
 * Modal para Modificar máquina, fecha u horario de una reservación
 */
export function openModifyModal(reservation) {
    const business = store.currentBusiness;
    const machines = store.getActiveMachines();
    const slotDuration = business.slotDuration || 60;
    
    // Obtener horarios específicos para la fecha de la reservación
    const { openingTime, closingTime, closed } = getBusinessHoursForDate(business, reservation.date);
    const slots = closed ? [] : generateTimeSlots(
        openingTime,
        closingTime,
        slotDuration
    );

    const machinesOptions = machines.map(m => `
        <option value="${m.id}" ${m.id === reservation.machineId ? 'selected' : ''}>
            ${m.name} (${m.model})
        </option>
    `).join('');

    const selectedSlot = slots.find(s => s.start === reservation.startTime) || slots[0];
    
    const openMinutes = timeToMinutes(openingTime);
    const closeMinutes = timeToMinutes(closingTime);
    const isOvernight = closeMinutes < openMinutes;

    const getSlotLabel = (slotStart) => {
        const slotStartMins = timeToMinutes(slotStart);
        if (isOvernight && slotStartMins < openMinutes) {
            return `${format12Hour(slotStart)} (Siguiente día)`;
        }
        return format12Hour(slotStart);
    };

    const timesOptions = slots.map(s => `
        <option value="${s.start}" ${s.start === selectedSlot?.start ? 'selected' : ''}>
            ${getSlotLabel(s.start)}
        </option>
    `).join('');
    const initialDurations = selectedSlot ? getAvailableDurations(selectedSlot.start, closingTime || '22:00', slotDuration) : [];
    const selectedDuration = initialDurations.includes(reservation.durationMinutes) ? reservation.durationMinutes : (initialDurations[0] || slotDuration);

    const contentHtml = `
        <form id="form-modify-res" class="cyber-form">
            <p>Reasigna la máquina, fecha o bloque horario para <strong>${reservation.clientName}</strong>:</p>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mod-machine"><span class="neon-arrow">◆</span> Máquina PIU</label>
                    <select id="mod-machine" class="cyber-select" required>
                        ${machinesOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="mod-players-mode"><span class="neon-arrow">◆</span> Modo / Jugadores</label>
                    <select id="mod-players-mode" class="cyber-select" required>
                        <option value="1" ${reservation.playersMode === 1 || !reservation.playersMode ? 'selected' : ''}>👤 1 Jugador</option>
                        <option value="2" ${reservation.playersMode === 2 ? 'selected' : ''}>👥 2 Jugadores</option>
                    </select>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mod-date"><span class="neon-arrow">◆</span> Fecha</label>
                    <input type="date" id="mod-date" class="cyber-input" value="${reservation.date}" required>
                </div>
                <div class="form-group">
                    <label for="mod-time"><span class="neon-arrow">◆</span> Hora de inicio</label>
                    <select id="mod-time" class="cyber-select" required>
                        ${timesOptions}
                    </select>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mod-duration"><span class="neon-arrow">◆</span> Duración</label>
                    <select id="mod-duration" class="cyber-select" required>
                        ${initialDurations.map(duration => `<option value="${duration}" ${duration === selectedDuration ? 'selected' : ''}>${formatDuration(duration)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="mod-notes"><span class="neon-arrow">◆</span> Nota de Modificación</label>
                    <input type="text" id="mod-notes" class="cyber-input" placeholder="Ej. Reasignada a cabina LX por petición del jugador">
                </div>
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

    // Listener para cambio de fecha en modificación
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
        } catch (err) {
            errorDiv.textContent = err.message || 'Error al modificar reservación';
            errorDiv.classList.remove('hidden');
        }
    };
}
