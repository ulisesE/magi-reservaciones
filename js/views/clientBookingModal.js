// js/views/clientBookingModal.js
// Modal de solicitud de reservación para cliente y asignación para encargado
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { authManager } from '../core/authManager.js';
import { addMinutesToTime, formatFriendlyDate, format12Hour, formatDuration, generateTimeSlots, getAvailableDurations } from '../core/timeUtils.js';

/**
 * Abre el modal para solicitar o agendar una reservación
 */
export function openBookingModal({ machineId = null, date = null, startTime = null } = {}) {
    const business = store.currentBusiness;
    const machines = store.getActiveMachines();
    const isStaff = authManager.isStaff();
    const currentUser = authManager.getCurrentUser();
    const isClientUser = authManager.isClientUser();

    if (machines.length === 0) {
        toast.warning("No hay máquinas disponibles en este momento para reservar.");
        return;
    }

    const defaultMachineId = machineId || machines[0].id;
    const defaultDate = date || store.selectedDate;
    const defaultStartTime = startTime || business.openingTime || '12:00';

    // Cada local define la duración de su bloque (por ejemplo, 60 o 30 minutos).
    const slotDuration = business.slotDuration || 60;
    const slots = generateTimeSlots(
        business.openingTime || '11:00',
        business.closingTime || '22:00',
        slotDuration
    );

    const machinesOptions = machines.map(m => `
        <option value="${m.id}" ${m.id === defaultMachineId ? 'selected' : ''}>
            ${m.name} (${m.model}) - ${business.currencySymbol}${m.hourlyRate}/hr
        </option>
    `).join('');

    const selectedSlot = slots.find(s => s.start === defaultStartTime) || slots[0];
    const timesOptions = slots.map(s => `
        <option value="${s.start}" ${s.start === selectedSlot?.start ? 'selected' : ''}>
            ${format12Hour(s.start)}
        </option>
    `).join('');
    const durationOptions = getAvailableDurations(selectedSlot.start, business.closingTime || '22:00', slotDuration);

    const modalTitle = isStaff ? 'Asignar Reservación Directa' : 'Solicitar Reservación de Máquina';
    const modalIcon = isStaff ? '👑' : '🕹️';

    const clientNameVal = isClientUser ? currentUser.name : (isStaff ? '' : '');
    const clientPhoneVal = isClientUser ? (currentUser.phone || '') : '';

    const contentHtml = `
        <form id="form-booking" class="cyber-form">
            ${isClientUser ? `
                <div style="background:rgba(104,242,5,0.08); border:1px solid rgba(104,242,5,0.3); border-radius:var(--radius-sm); padding:8px 12px; font-size:0.82rem; color:var(--color-neon-lime); display:flex; align-items:center; gap:8px;">
                    <span>${currentUser.avatar || '🕺'}</span>
                    <span>Reservando con tu perfil de jugador: <strong>${currentUser.name}</strong> (@${currentUser.username})</span>
                </div>
            ` : ''}

            <div class="form-row">
                <div class="form-group flex-1">
                    <label for="book-machine"><span class="neon-arrow">◆</span> Máquina Pump It Up</label>
                    <select id="book-machine" class="cyber-select" required>
                        ${machinesOptions}
                    </select>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="book-date"><span class="neon-arrow">◆</span> Fecha</label>
                    <input type="date" id="book-date" class="cyber-input" value="${defaultDate}" required>
                </div>
                <div class="form-group">
                    <label for="book-time"><span class="neon-arrow">◆</span> Hora de inicio</label>
                    <select id="book-time" class="cyber-select" required>
                        ${timesOptions}
                    </select>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="book-duration"><span class="neon-arrow">◆</span> Duración</label>
                    <select id="book-duration" class="cyber-select" required>
                        ${durationOptions.map(duration => `<option value="${duration}">${formatDuration(duration)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label><span class="neon-arrow">◆</span> Tarifa Estimada</label>
                    <div id="booking-cost-preview" class="cost-badge-preview">
                        ${business.currencySymbol}0 ${business.currency}
                    </div>
                </div>
            </div>

            <div class="form-divider"></div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="book-name"><span class="neon-arrow">◆</span> Nombre / GamerTag *</label>
                    <input type="text" id="book-name" class="cyber-input" value="${clientNameVal}" placeholder="Ej. Alex Step / PIU_Pro99" required>
                </div>
                <div class="form-group">
                    <label for="book-phone"><span class="neon-arrow">◆</span> Teléfono / WhatsApp *</label>
                    <input type="tel" id="book-phone" class="cyber-input" value="${clientPhoneVal}" placeholder="Ej. 5512345678" required>
                </div>
            </div>

            <div class="form-group">
                <label for="book-notes"><span class="neon-arrow">◆</span> Notas / Nivel / Modo (Opcional)</label>
                <textarea id="book-notes" class="cyber-textarea" rows="2" placeholder="Ej. Práctica Single S21, uso de barra, stream...">${isClientUser && currentUser.preferredMode ? `Modo: ${currentUser.preferredMode}` : ''}</textarea>
            </div>

            <div id="booking-error" class="form-error-msg hidden"></div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-book">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-submit-book">
            ${isStaff ? '⚡ Confirmar y Agendar' : '🚀 Enviar Solicitud'}
        </button>
    `;

    const modalEl = modal.open({
        title: modalTitle,
        icon: modalIcon,
        contentHtml,
        footerHtml,
        maxWidth: '560px'
    });

    // Actualizar costo estimado
    const updateCost = () => {
        const selectedMachId = modalEl.querySelector('#book-machine').value;
        const durationMinutes = parseInt(modalEl.querySelector('#book-duration').value, 10) || slotDuration;
        const mach = store.getMachineById(selectedMachId);
        const rate = mach ? mach.hourlyRate : 100;
        const total = Math.round((durationMinutes / 60) * rate);
        const costPreview = modalEl.querySelector('#booking-cost-preview');
        if (costPreview) {
            costPreview.textContent = `${business.currencySymbol}${total} ${business.currency}`;
        }
    };

    const updateDurationOptions = () => {
        const durationSelect = modalEl.querySelector('#book-duration');
        const durations = getAvailableDurations(
            modalEl.querySelector('#book-time').value,
            business.closingTime || '22:00',
            slotDuration
        );
        durationSelect.innerHTML = durations.map(duration => `<option value="${duration}">${formatDuration(duration)}</option>`).join('');
        updateCost();
    };

    modalEl.querySelector('#book-machine').addEventListener('change', updateCost);
    modalEl.querySelector('#book-time').addEventListener('change', updateDurationOptions);
    modalEl.querySelector('#book-duration').addEventListener('change', updateCost);
    updateCost();

    // Acciones de los botones
    modalEl.querySelector('#btn-cancel-book').onclick = () => modal.close();

    modalEl.querySelector('#btn-submit-book').onclick = async () => {
        const form = modalEl.querySelector('#form-booking');
        const nameInput = modalEl.querySelector('#book-name');
        const phoneInput = modalEl.querySelector('#book-phone');
        const dateInput = modalEl.querySelector('#book-date');
        const timeSelect = modalEl.querySelector('#book-time');
        const durationSelect = modalEl.querySelector('#book-duration');
        const machineSelect = modalEl.querySelector('#book-machine');
        const notesInput = modalEl.querySelector('#book-notes');
        const errorMsg = modalEl.querySelector('#booking-error');

        if (!nameInput.value.trim() || !phoneInput.value.trim() || !dateInput.value) {
            errorMsg.textContent = 'Por favor completa tu nombre, teléfono y fecha.';
            errorMsg.classList.remove('hidden');
            return;
        }

        const startTimeVal = timeSelect.value;
        const durationMinutes = parseInt(durationSelect.value, 10);
        const endTimeVal = addMinutesToTime(startTimeVal, durationMinutes);

        try {
            const booking = await store.requestReservation({
                machineId: machineSelect.value,
                date: dateInput.value,
                startTime: startTimeVal,
                endTime: endTimeVal,
                durationMinutes,
                clientName: nameInput.value.trim(),
                clientPhone: phoneInput.value.trim(),
                notes: notesInput.value.trim()
            });

            modal.close();

            if (isStaff) {
                toast.success(`Reservación asignada exitosamente para ${booking.clientName}`);
            } else {
                toast.success("¡Solicitud enviada! Mostrando comprobante digital...");
                showReservationTicket(booking);
            }
        } catch (err) {
            errorMsg.textContent = err.message || 'Error al procesar la reservación';
            errorMsg.classList.remove('hidden');
        }
    };
}

/**
 * Muestra el comprobante o pase digital de la reservación
 */
export function showReservationTicket(reservation) {
    const business = store.currentBusiness;
    const machine = store.getMachineById(reservation.machineId);
    const friendlyDate = formatFriendlyDate(reservation.date);
    const timeFormatted = `${format12Hour(reservation.startTime)} - ${format12Hour(reservation.endTime)}`;

    const statusBadge = reservation.status === 'CONFIRMED'
        ? '<span class="badge badge-success">Confirmada</span>'
        : reservation.status === 'PENDING'
        ? '<span class="badge badge-warning">En Revisión por Encargado</span>'
        : '<span class="badge badge-danger">Rechazada</span>';

    // Generar texto para compartir en WhatsApp
    const waText = encodeURIComponent(
        `🎮 *RESERVACIÓN PUMP IT UP - ${business.name}*\n` +
        `👤 *Jugador:* ${reservation.clientName}\n` +
        `🕹️ *Máquina:* ${machine ? machine.name : 'PIU'}\n` +
        `📅 *Fecha:* ${friendlyDate}\n` +
        `⏰ *Horario:* ${timeFormatted} (${reservation.durationMinutes} min)\n` +
        `💰 *Total:* ${business.currencySymbol}${reservation.totalCost} ${business.currency}\n` +
        `📍 *Ubicación:* ${business.address || business.city}\n` +
        `🔖 *Folio:* #${reservation.id.slice(-6).toUpperCase()}\n\n` +
        `¡Nos vemos en tu sesión de baile! 🕺💃`
    );

    const waLink = business.whatsapp 
        ? `https://wa.me/${business.whatsapp}?text=${waText}`
        : `https://api.whatsapp.com/send?text=${waText}`;

    const contentHtml = `
        <div class="ticket-wrapper">
            <div class="ticket-card animate-scale-up">
                <div class="ticket-header">
                    <div class="ticket-venue-logo">${business.logoIcon || '🕹️'}</div>
                    <div class="ticket-venue-title">
                        <h4>${business.name}</h4>
                        <span>${business.city}</span>
                    </div>
                </div>

                <div class="ticket-badge-row">
                    <span class="ticket-folio">FOLIO: #${reservation.id.slice(-6).toUpperCase()}</span>
                    ${statusBadge}
                </div>

                <div class="ticket-details-grid">
                    <div class="ticket-item">
                        <span class="t-label">JUGADOR / GAMERTAG</span>
                        <strong class="t-value highlight">${reservation.clientName}</strong>
                    </div>
                    <div class="ticket-item">
                        <span class="t-label">MÁQUINA</span>
                        <strong class="t-value">${machine ? machine.name : 'PIU Machine'}</strong>
                    </div>
                    <div class="ticket-item">
                        <span class="t-label">FECHA</span>
                        <strong class="t-value">${friendlyDate}</strong>
                    </div>
                    <div class="ticket-item">
                        <span class="t-label">HORARIO</span>
                        <strong class="t-value highlight-cyan">${timeFormatted}</strong>
                    </div>
                    <div class="ticket-item">
                        <span class="t-label">DURACIÓN</span>
                        <strong class="t-value">${reservation.durationMinutes} Minutos</strong>
                    </div>
                    <div class="ticket-item">
                        <span class="t-label">TOTAL ESTIMADO</span>
                        <strong class="t-value highlight-gold">${business.currencySymbol}${reservation.totalCost} ${business.currency}</strong>
                    </div>
                </div>

                ${reservation.notes ? `
                    <div class="ticket-notes">
                        <span class="t-label">NOTAS:</span>
                        <p>${reservation.notes}</p>
                    </div>
                ` : ''}

                <div class="ticket-arcade-arrows">
                    <span>↖</span> <span>↗</span> <span>★</span> <span>↙</span> <span>↘</span>
                </div>
            </div>
        </div>
    `;

    const footerHtml = `
        <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp glow-green">
            <span>💬 Confirmar / Notificar por WhatsApp</span>
        </a>
        <button type="button" class="btn btn-primary" id="btn-close-ticket">Aceptar</button>
    `;

    const modalEl = modal.open({
        title: 'Pase Digital de Reservación',
        icon: '🎟️',
        contentHtml,
        footerHtml,
        maxWidth: '500px'
    });

    modalEl.querySelector('#btn-close-ticket').onclick = () => modal.close();
}
