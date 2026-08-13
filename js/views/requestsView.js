// js/views/requestsView.js
// Bandeja de solicitudes de reservación para el Encargado (Aprobar, Rechazar, Modificar)
import { store } from '../core/store.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { addMinutesToTime, formatFriendlyDate, format12Hour, formatDuration, generateTimeSlots, getAvailableDurations } from '../core/timeUtils.js';
import { showReservationTicket } from './clientBookingModal.js';

let activeFilter = 'PENDING'; // 'PENDING', 'CONFIRMED', 'REJECTED', 'ALL'

export function renderRequestsView(container) {
    const business = store.currentBusiness;
    const allReservations = store.getReservations().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const pendingCount = allReservations.filter(r => r.status === 'PENDING').length;
    const confirmedCount = allReservations.filter(r => r.status === 'CONFIRMED').length;
    const rejectedCount = allReservations.filter(r => r.status === 'REJECTED').length;

    let filtered = allReservations;
    if (activeFilter === 'PENDING') filtered = allReservations.filter(r => r.status === 'PENDING');
    else if (activeFilter === 'CONFIRMED') filtered = allReservations.filter(r => r.status === 'CONFIRMED');
    else if (activeFilter === 'REJECTED') filtered = allReservations.filter(r => r.status === 'REJECTED');

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

            <!-- Lista de Solicitudes -->
            <div class="requests-list">
                ${filtered.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <h3>No hay solicitudes en esta sección</h3>
                        <p>Las nuevas solicitudes de clientes aparecerán aquí en tiempo real.</p>
                    </div>
                ` : filtered.map(r => {
                    const machine = store.getMachineById(r.machineId);
                    const isPending = r.status === 'PENDING';
                    const isConfirmed = r.status === 'CONFIRMED';
                    const isRejected = r.status === 'REJECTED';

                    const statusBadge = isPending 
                        ? '<span class="badge badge-warning">⏳ PENDIENTE DE REVISIÓN</span>'
                        : isConfirmed 
                        ? '<span class="badge badge-success">✓ CONFIRMADA</span>'
                        : '<span class="badge badge-danger">✖ RECHAZADA</span>';

                    // Link directo a WhatsApp del cliente
                    const cleanPhone = (r.clientPhone || '').replace(/\D/g, '');
                    const waLink = cleanPhone ? `https://wa.me/52${cleanPhone}` : '#';

                    return `
                        <div class="request-card ${isPending ? 'border-warning pulse-border' : ''}" data-id="${r.id}">
                            <div class="req-main-row">
                                <div class="req-client-info">
                                    <div class="req-avatar">🕺</div>
                                    <div>
                                        <div class="req-client-name-row">
                                            <h3 class="req-client-name">${r.clientName}</h3>
                                            ${statusBadge}
                                        </div>
                                        <div class="req-contact-info">
                                            <span>📞 ${r.clientPhone || 'N/A'}</span>
                                            ${cleanPhone ? `
                                                <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn-contact-wa" title="Enviar WhatsApp">
                                                    💬 WhatsApp
                                                </a>
                                            ` : ''}
                                            <span class="req-created-time">Solicitado: ${new Date(r.createdAt).toLocaleDateString()} ${new Date(r.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="req-total-cost">
                                    <span class="cost-lbl">Total:</span>
                                    <span class="cost-num highlight-gold">${business.currencySymbol}${r.totalCost} ${business.currency}</span>
                                </div>
                            </div>

                            <div class="req-details-grid">
                                <div class="req-detail-item">
                                    <span class="rd-label">🕹️ Máquina</span>
                                    <strong>${machine ? machine.name : 'PIU Machine'}</strong>
                                </div>
                                <div class="req-detail-item">
                                    <span class="rd-label">📅 Fecha</span>
                                    <strong>${formatFriendlyDate(r.date)}</strong>
                                </div>
                                <div class="req-detail-item">
                                    <span class="rd-label">⏰ Horario</span>
                                    <strong class="highlight-cyan">${format12Hour(r.startTime)} - ${format12Hour(r.endTime)} (${r.durationMinutes} min)</strong>
                                </div>
                            </div>

                            ${r.notes ? `
                                <div class="req-notes-box">
                                    <span class="notes-icon">💬</span>
                                    <em>"${r.notes}"</em>
                                </div>
                            ` : ''}

                            ${r.rejectionReason ? `
                                <div class="req-notes-box req-reject-reason">
                                    <span class="notes-icon">❌</span>
                                    <strong>Motivo de rechazo:</strong> ${r.rejectionReason}
                                </div>
                            ` : ''}

                            <!-- Botones de Acción del Encargado -->
                            <div class="req-actions-bar">
                                <button class="btn btn-outline btn-xs btn-ticket-res" data-id="${r.id}">
                                    🎟️ Ver Ticket
                                </button>
                                
                                <div class="flex-spacer"></div>

                                ${isPending ? `
                                    <button class="btn btn-warning btn-sm btn-modify-res" data-id="${r.id}">
                                        ✏️ Modificar
                                    </button>
                                    <button class="btn btn-danger btn-sm btn-reject-res" data-id="${r.id}">
                                        ✖ Rechazar
                                    </button>
                                    <button class="btn btn-success btn-sm btn-approve-res glow-green" data-id="${r.id}">
                                        ✓ Aprobar Solicitud
                                    </button>
                                ` : `
                                    <button class="btn btn-outline btn-xs btn-modify-res" data-id="${r.id}">
                                        ✏️ Reasignar / Modificar
                                    </button>
                                    <button class="btn btn-danger btn-xs btn-del-res" data-id="${r.id}">
                                        🗑️ Eliminar
                                    </button>
                                `}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Filtros de pestaña
    container.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            activeFilter = tab.dataset.filter;
            renderRequestsView(container);
        });
    });

    // Acción: Ver Ticket
    container.querySelectorAll('.btn-ticket-res').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const res = store.reservations.find(r => r.id === id);
            if (res) showReservationTicket(res);
        });
    });

    // Acción: Aprobar
    container.querySelectorAll('.btn-approve-res').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const res = store.reservations.find(r => r.id === id);
            try {
                await store.approveReservation(id);
                toast.success(`¡Solicitud de ${res.clientName} aprobada exitosamente!`);
            } catch (e) {
                toast.error(e.message);
            }
        });
    });

    // Acción: Rechazar
    container.querySelectorAll('.btn-reject-res').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const res = store.reservations.find(r => r.id === id);
            openRejectModal(res);
        });
    });

    // Acción: Modificar
    container.querySelectorAll('.btn-modify-res').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const res = store.reservations.find(r => r.id === id);
            openModifyModal(res);
        });
    });

    // Acción: Eliminar
    container.querySelectorAll('.btn-del-res').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Estás seguro de eliminar el registro de esta reservación?")) {
                await store.deleteReservation(id);
                toast.info("Registro eliminado.");
            }
        });
    });
}

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
function openModifyModal(reservation) {
    const business = store.currentBusiness;
    const machines = store.getActiveMachines();
    const slotDuration = business.slotDuration || 60;
    const slots = generateTimeSlots(
        business.openingTime || '11:00',
        business.closingTime || '22:00',
        slotDuration
    );

    const machinesOptions = machines.map(m => `
        <option value="${m.id}" ${m.id === reservation.machineId ? 'selected' : ''}>
            ${m.name} (${m.model})
        </option>
    `).join('');

    const selectedSlot = slots.find(s => s.start === reservation.startTime) || slots[0];
    const timesOptions = slots.map(s => `
        <option value="${s.start}" ${s.start === selectedSlot?.start ? 'selected' : ''}>
            ${format12Hour(s.start)}
        </option>
    `).join('');
    const initialDurations = getAvailableDurations(selectedSlot.start, business.closingTime || '22:00', slotDuration);
    const selectedDuration = initialDurations.includes(reservation.durationMinutes) ? reservation.durationMinutes : initialDurations[0];

    const contentHtml = `
        <form id="form-modify-res" class="cyber-form">
            <p>Reasigna la máquina, fecha o bloque horario para <strong>${reservation.clientName}</strong>:</p>

            <div class="form-group">
                <label for="mod-machine"><span class="neon-arrow">◆</span> Máquina PIU</label>
                <select id="mod-machine" class="cyber-select" required>
                    ${machinesOptions}
                </select>
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

    modalEl.querySelector('#mod-time').addEventListener('change', () => {
        const durationSelect = modalEl.querySelector('#mod-duration');
        const durations = getAvailableDurations(
            modalEl.querySelector('#mod-time').value,
            business.closingTime || '22:00',
            slotDuration
        );
        durationSelect.innerHTML = durations.map(duration => `<option value="${duration}">${formatDuration(duration)}</option>`).join('');
    });

    modalEl.querySelector('#btn-save-mod').onclick = async () => {
        const machineId = modalEl.querySelector('#mod-machine').value;
        const date = modalEl.querySelector('#mod-date').value;
        const startTime = modalEl.querySelector('#mod-time').value;
        const durationMinutes = parseInt(modalEl.querySelector('#mod-duration').value, 10);
        const endTime = addMinutesToTime(startTime, durationMinutes);
        const adminNotes = modalEl.querySelector('#mod-notes').value.trim();
        const errorDiv = modalEl.querySelector('#mod-error');

        const mach = store.getMachineById(machineId);
        const totalCost = Math.round((durationMinutes / 60) * (mach ? mach.hourlyRate : 100));

        try {
            await store.modifyReservation(reservation.id, {
                machineId,
                date,
                startTime,
                endTime,
                durationMinutes,
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
