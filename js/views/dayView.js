// js/views/dayView.js
// Vista Día: Grid Interactivo de Horas x Máquinas con estado y nombre del cliente
import { store } from '../core/store.js';
import { authManager } from '../core/authManager.js';
import { 
    formatDateKey, 
    formatFriendlyDate, 
    format12Hour, 
    formatDuration,
    generateTimeSlots, 
    timeToMinutes, 
    isOverlapping,
    getBusinessHoursForDate,
    DAYS_OF_WEEK
} from '../core/timeUtils.js';
import { openBookingModal, showReservationTicket } from './clientBookingModal.js';
import { openModifyModal } from './requestsView.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export function renderDayView(container) {
    const business = store.currentBusiness;
    const machines = store.getMachines();
    const activeMachines = machines.filter(m => m.status !== 'OUT_OF_ORDER');
    const selectedDate = store.selectedDate || formatDateKey(new Date());
    const isStaff = authManager.isStaff();

    // Generar slots horarios según configuración del negocio
    const { openingTime, closingTime, closed } = getBusinessHoursForDate(business, selectedDate);
    const slots = closed ? [] : generateTimeSlots(
        openingTime,
        closingTime,
        business.slotDuration || 60
    );

    // Obtener todas las reservaciones del día
    const dayReservations = store.getReservations({ date: selectedDate, excludeRejectedCancelled: true });

    // Controles de fecha (Ayer, Hoy, Mañana, Date Picker)
    const prevDate = new Date(selectedDate + 'T00:00:00');
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateKey = formatDateKey(prevDate);

    const nextDate = new Date(selectedDate + 'T00:00:00');
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateKey = formatDateKey(nextDate);

    const isToday = selectedDate === formatDateKey(new Date());

    container.innerHTML = `
        <div class="day-view-wrapper animate-fade-in">
            <!-- Day View Header Controls -->
            <div class="view-header-bar">
                <div class="date-navigator">
                    <div class="date-step-controls" aria-label="Cambiar día">
                        <button class="btn btn-icon btn-secondary" id="btn-prev-day" title="Día anterior" aria-label="Día anterior">◀</button>
                        <button class="btn btn-icon btn-secondary" id="btn-next-day" title="Día siguiente" aria-label="Día siguiente">▶</button>
                    </div>
                    <div class="current-date-info">
                        <input type="date" id="input-day-picker" class="cyber-input-date" value="${selectedDate}">
                        <h2 class="friendly-date-title">${formatFriendlyDate(selectedDate)}</h2>
                        ${isToday ? '<span class="badge badge-primary">HOY</span>' : ''}
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-today-day">Ir a Hoy</button>
                </div>

                <div class="grid-legend">
                    <span class="legend-item"><span class="legend-dot dot-available"></span> Libre</span>
                    <span class="legend-item"><span class="legend-dot dot-pending"></span> Pendiente</span>
                    <span class="legend-item"><span class="legend-dot dot-confirmed"></span> Confirmada</span>
                    <span class="legend-item"><span class="legend-dot dot-maintenance"></span> Mantenimiento</span>
                </div>
            </div>

            <!-- Grid Horas x Máquinas -->
            <div class="grid-container-card">
                ${closed ? `
                    <div class="empty-state animate-fade-in" style="padding: 40px 20px; text-align: center;">
                        <div class="empty-icon" style="font-size: 3rem; margin-bottom: 12px;">⏰</div>
                        <h3 style="color: var(--color-neon-lime); font-family: var(--font-heading); letter-spacing: 1px;">Sucursal Cerrada este día</h3>
                        <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 8px;">
                            Esta sucursal está programada como cerrada los días <strong>${DAYS_OF_WEEK[new Date(selectedDate + 'T00:00:00').getDay()].name}</strong>.<br>
                            Por favor selecciona otra fecha en el calendario.
                        </p>
                    </div>
                ` : activeMachines.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">🕹️</div>
                        <h3>No hay máquinas registradas en esta sucursal</h3>
                        <p>Agrega máquinas desde la pestaña "Máquinas" para habilitar las reservaciones.</p>
                    </div>
                ` : `
                    <div class="matrix-table-responsive">
                        <table class="grid-matrix-table">
                            <thead>
                                <tr>
                                    <th class="col-time-header">
                                        <div class="time-header-content">
                                            <span>⏰ HORARIO</span>
                                        </div>
                                    </th>
                                    ${activeMachines.map(m => `
                                        <th class="col-machine-header">
                                            <div class="machine-header-card">
                                                <div class="mach-name">${m.name}</div>
                                                <div class="mach-badge-row">
                                                    <span class="badge badge-dark">${m.model}</span>
                                                    <span class="badge ${m.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}">
                                                        ${m.status === 'AVAILABLE' ? `${business.currencySymbol}${m.hourlyRate}/h` : 'Mantenimiento'}
                                                    </span>
                                                </div>
                                            </div>
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${slots.map(slot => {
                                    return `
                                        <tr class="grid-time-row">
                                            <!-- Columna de Hora -->
                                            <td class="cell-time-label">
                                                <div class="time-block-label">
                                                    <strong>${format12Hour(slot.start)}</strong>
                                                    <small>${format12Hour(slot.end)}</small>
                                                </div>
                                            </td>

                                            <!-- Columnas de Cada Máquina -->
                                            ${activeMachines.map(machine => {
                                                if (machine.status === 'MAINTENANCE') {
                                                    return `
                                                        <td class="cell-slot cell-maintenance">
                                                            <div class="slot-content slot-locked">
                                                                <span class="lock-icon">🔧</span>
                                                                <span class="lock-text">Mantenimiento</span>
                                                            </div>
                                                        </td>
                                                    `;
                                                }

                                                // Buscar si hay reserva que cruce este slot
                                                const reservation = dayReservations.find(r => 
                                                    r.machineId === machine.id && 
                                                    isOverlapping(slot.start, slot.end, r.startTime, r.endTime, openingTime, closingTime)
                                                );

                                                if (reservation) {
                                                    const isPending = reservation.status === 'PENDING';
                                                    const isConfirmed = reservation.status === 'CONFIRMED';
                                                    const statusClass = isPending ? 'slot-pending' : 'slot-confirmed';
                                                    const isFirstSlotOfBooking = reservation.startTime === slot.start;

                                                    return `
                                                        <td class="cell-slot ${statusClass}" data-res-id="${reservation.id}">
                                                            <div class="slot-content occupied-slot" title="Click para ver detalles o gestionar">
                                                                <div class="slot-occupant">
                                                                    <span class="status-indicator-dot"></span>
                                                                    <strong class="occupant-name">${reservation.clientName}</strong>
                                                                </div>
                                                                <div class="slot-meta">
                                                                    <span class="slot-hours">${reservation.startTime} - ${reservation.endTime}</span>
                                                                    <span class="slot-status-pill">${isPending ? 'Pendiente' : 'Reservado'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    `;
                                                }

                                                // Slot Disponible / Libre
                                                return `
                                                    <td class="cell-slot cell-available" 
                                                        data-machine-id="${machine.id}" 
                                                        data-slot-start="${slot.start}" 
                                                        data-date="${selectedDate}">
                                                        <button class="slot-book-btn" title="Click para reservar en este horario">
                                                            <span class="plus-icon">＋</span>
                                                            <span class="book-text">Disponible</span>
                                                        </button>
                                                    </td>
                                                `;
                                            }).join('')}
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        </div>
    `;

    // Eventos de Navegación de Fecha
    container.querySelector('#btn-prev-day')?.addEventListener('click', () => {
        store.setSelectedDate(prevDateKey);
    });

    container.querySelector('#btn-next-day')?.addEventListener('click', () => {
        store.setSelectedDate(nextDateKey);
    });

    container.querySelector('#btn-today-day')?.addEventListener('click', () => {
        store.setSelectedDate(formatDateKey(new Date()));
    });

    container.querySelector('#input-day-picker')?.addEventListener('change', (e) => {
        if (e.target.value) {
            store.setSelectedDate(e.target.value);
        }
    });

    // Evento Click en Slot Libre -> Abrir Modal de Reservación con máquina, fecha y hora precargadas
    const availableSlots = container.querySelectorAll('.cell-available');
    availableSlots.forEach(cell => {
        cell.addEventListener('click', () => {
            const machId = cell.dataset.machineId;
            const slotStart = cell.dataset.slotStart;
            const date = cell.dataset.date;
            openBookingModal({ machineId: machId, date, startTime: slotStart });
        });
    });

    // Evento Click en Slot Ocupado -> Abrir Detalles / Gestión de Reserva
    const occupiedSlots = container.querySelectorAll('.cell-slot[data-res-id]');
    occupiedSlots.forEach(cell => {
        cell.addEventListener('click', () => {
            const resId = cell.dataset.resId;
            const reservation = store.reservations.find(r => r.id === resId);
            if (reservation) {
                openReservationDetailModal(reservation);
            }
        });
    });
}

/**
 * Modal de detalle y acciones de una reservación ocupada
 */
function openReservationDetailModal(reservation) {
    const business = store.currentBusiness;
    const machine = store.getMachineById(reservation.machineId);
    const isStaff = authManager.isStaff();

    const contentHtml = `
        <div class="res-detail-dialog">
            <div class="detail-header-card">
                <div class="client-avatar">🕺</div>
                <div>
                    <h3 class="detail-client-name">${reservation.clientName}</h3>
                    <p class="detail-phone">📞 ${reservation.clientPhone || 'Sin teléfono'}</p>
                </div>
                <div class="detail-status">
                    <span class="badge ${reservation.status === 'CONFIRMED' ? 'badge-success' : 'badge-warning'}">
                        ${reservation.status === 'CONFIRMED' ? 'CONFIRMADA' : 'PENDIENTE DE APROBACIÓN'}
                    </span>
                </div>
            </div>

            <div class="detail-grid">
                <div class="detail-item">
                    <span class="d-label">MÁQUINA:</span>
                    <strong>${machine ? machine.name : 'PIU'} (${machine ? machine.model : ''})</strong>
                </div>
                <div class="detail-item">
                    <span class="d-label">MODO DE JUEGO:</span>
                    <strong>${reservation.playersMode === 2 ? '👥 2 Jugadores' : '👤 1 Jugador'}</strong>
                </div>
                <div class="detail-item">
                    <span class="d-label">FECHA:</span>
                    <strong>${formatFriendlyDate(reservation.date)}</strong>
                </div>
                <div class="detail-item">
                    <span class="d-label">HORARIO:</span>
                    <strong>${format12Hour(reservation.startTime)} a ${format12Hour(reservation.endTime)} (${formatDuration(reservation.durationMinutes)})</strong>
                </div>
                <div class="detail-item">
                    <span class="d-label">COSTO:</span>
                    <strong class="highlight-gold">${business.currencySymbol}${reservation.totalCost} ${business.currency}</strong>
                </div>
            </div>

            ${reservation.notes ? `
                <div class="detail-notes-box">
                    <span class="d-label">NOTAS DEL CLIENTE:</span>
                    <p>${reservation.notes}</p>
                </div>
            ` : ''}

            ${reservation.adminNotes ? `
                <div class="detail-notes-box admin-note">
                    <span class="d-label">NOTAS DEL ENCARGADO:</span>
                    <p>${reservation.adminNotes}</p>
                </div>
            ` : ''}
        </div>
    `;

    let footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-close-detail">Cerrar</button>
        <button type="button" class="btn btn-info" id="btn-view-ticket">🎟️ Ver Pase Digital</button>
    `;

    if (isStaff) {
        footerHtml = `
            <button type="button" class="btn btn-danger btn-sm" id="btn-delete-res">🗑️ Eliminar</button>
            <div class="flex-spacer"></div>
            <button type="button" class="btn btn-warning" id="btn-modify-res">✏️ Modificar</button>
            ${reservation.status === 'PENDING' ? `
                <button type="button" class="btn btn-danger" id="btn-reject-res">Rechazar</button>
                <button type="button" class="btn btn-success glow-green" id="btn-approve-res">Aprobar</button>
            ` : `
                <button type="button" class="btn btn-info" id="btn-view-ticket">🎟️ Ticket</button>
            `}
        `;
    }

    const modalEl = modal.open({
        title: 'Detalle de Reservación',
        icon: '📋',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    modalEl.querySelector('#btn-close-detail')?.addEventListener('click', () => modal.close());

    modalEl.querySelector('#btn-view-ticket')?.addEventListener('click', () => {
        modal.close();
        showReservationTicket(reservation);
    });

    modalEl.querySelector('#btn-modify-res')?.addEventListener('click', () => {
        modal.close();
        openModifyModal(reservation);
    });

    // Acciones de Encargado
    modalEl.querySelector('#btn-approve-res')?.addEventListener('click', async () => {
        try {
            await store.approveReservation(reservation.id);
            modal.close();
            toast.success(`Reservación de ${reservation.clientName} aprobada.`);
        } catch (e) {
            toast.error(e.message);
        }
    });

    modalEl.querySelector('#btn-reject-res')?.addEventListener('click', async () => {
        const reason = prompt("Motivo de rechazo o cancelación:", "Horario ocupado o mantenimiento.");
        if (reason !== null) {
            try {
                await store.rejectReservation(reservation.id, reason);
                modal.close();
                toast.warning(`Reservación de ${reservation.clientName} rechazada.`);
            } catch (e) {
                toast.error(e.message);
            }
        }
    });

    modalEl.querySelector('#btn-delete-res')?.addEventListener('click', async () => {
        if (confirm(`¿Estás seguro de eliminar la reservación de ${reservation.clientName}?`)) {
            await store.deleteReservation(reservation.id);
            modal.close();
            toast.info("Reservación eliminada.");
        }
    });
}
