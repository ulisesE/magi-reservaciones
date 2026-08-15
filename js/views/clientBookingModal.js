// js/views/clientBookingModal.js
// Modal de solicitud de reservación para cliente y asignación para encargado
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { authManager } from '../core/authManager.js';
import { addMinutesToTime, formatFriendlyDate, format12Hour, formatDuration, generateTimeSlots, getAvailableDurations, getBusinessHoursForDate, timeToMinutes, calculateBookingCost } from '../core/timeUtils.js';
import { clientDirManager } from './clientsView.js';
import { openLoginModal } from '../components/header.js';

/**
 * Abre el modal para solicitar o agendar una reservación
 */
export function openBookingModal({ machineId = null, date = null, startTime = null } = {}) {
    const business = store.currentBusiness;
    const machines = store.getActiveMachines();
    const isStaff = authManager.isStaff();
    const currentUser = authManager.getCurrentUser();
    const isClientUser = authManager.isClientUser();

    if (!currentUser) {
        toast.warning("Para poder reservar, necesitas iniciar sesión o crear una cuenta de jugador.");
        openLoginModal('login');
        return;
    }

    if (machines.length === 0) {
        toast.warning("No hay máquinas disponibles en este momento para reservar.");
        return;
    }

    // Cargar la lista de clientes si es encargado/superusuario para autocompletado
    let clients = [];
    if (isStaff) {
        clientDirManager.loadClients().then(list => {
            clients = list;
        }).catch(e => console.warn("Error cargando clientes para autocompletado:", e));
    }

    const defaultMachineId = machineId || machines[0].id;
    const defaultDate = date || store.selectedDate;

    // Obtener horarios para la fecha por defecto
    const { openingTime, closingTime, closed } = getBusinessHoursForDate(business, defaultDate);
    const defaultStartTime = startTime || openingTime || '12:00';

    // Cada local define la duración de su bloque (por ejemplo, 60 o 30 minutos).
    const slotDuration = business.slotDuration || 60;
    const slots = closed ? [] : generateTimeSlots(
        openingTime,
        closingTime,
        slotDuration
    );

    const machinesOptions = machines.map(m => `
        <option value="${m.id}" ${m.id === defaultMachineId ? 'selected' : ''}>
            ${m.name} (${m.model}) - ${business.currencySymbol}${m.hourlyRate}/hr
        </option>
    `).join('');

    const selectedSlot = slots.find(s => s.start === defaultStartTime) || slots[0];
    
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
    
    const durationOptions = selectedSlot 
        ? getAvailableDurations(selectedSlot.start, closingTime || '22:00', slotDuration)
        : [];

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

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="book-machine"><span class="neon-arrow">◆</span> Máquina Pump It Up</label>
                    <select id="book-machine" class="cyber-select" required>
                        ${machinesOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="book-players-mode"><span class="neon-arrow">◆</span> Modo / Cantidad de Jugadores</label>
                    <select id="book-players-mode" class="cyber-select" required>
                        <option value="1" selected>👤 1 Jugador</option>
                        <option value="2">👥 2 Jugadores</option>
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

            <div id="booking-deposit-info" style="margin-top: 10px; padding: 10px; background: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: var(--radius-sm); font-size: 0.8rem; margin-bottom: 12px;">
                <!-- Se actualiza dinámicamente -->
            </div>

            <div class="form-divider"></div>

            <div class="form-row grid-2">
                <div class="form-group" style="position: relative;">
                    <label for="book-name"><span class="neon-arrow">◆</span> Nombre / GamerTag *</label>
                    <input type="text" id="book-name" class="cyber-input" value="${clientNameVal}" placeholder="Ej. Alex Step / PIU_Pro99" required autocomplete="off">
                    <div id="book-name-suggestions" class="hidden" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; background: var(--bg-dark-800, #1a1f29); border: 1px solid var(--piu-cyan, #00e5ff); border-radius: var(--radius-sm); max-height: 180px; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.8);"></div>
                </div>
                <div class="form-group">
                    <label for="book-phone"><span class="neon-arrow">◆</span> Teléfono / WhatsApp (Opcional)</label>
                    <input type="tel" id="book-phone" class="cyber-input" value="${clientPhoneVal}" placeholder="Ej. 5512345678">
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
        const playersMode = parseInt(modalEl.querySelector('#book-players-mode')?.value, 10) || 1;
        const mach = store.getMachineById(selectedMachId);
        const total = calculateBookingCost(durationMinutes, playersMode, mach, business);
        const costPreview = modalEl.querySelector('#booking-cost-preview');
        if (costPreview) {
            costPreview.textContent = `${business.currencySymbol}${total} ${business.currency}`;
        }

        const depositInfo = modalEl.querySelector('#booking-deposit-info');
        if (depositInfo) {
            if (business.requiresDeposit) {
                const depositPct = business.depositPercentage || 50;
                const depositAmount = Math.round(total * (depositPct / 100));
                depositInfo.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; color:var(--color-neon-lime);">
                        <span>💰 Anticipo Requerido (${depositPct}%):</span>
                        <strong>${business.currencySymbol}${depositAmount} ${business.currency}</strong>
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px; border-top:1px dashed rgba(0,229,255,0.15); padding-top:4px;">
                        <em>Esta sucursal requiere pago previo de anticipo para confirmar el espacio.</em>
                    </div>
                `;
            } else {
                depositInfo.innerHTML = `
                    <span style="color:var(--piu-cyan);">✓ Pago total en mostrador (No se requiere depósito previo).</span>
                `;
            }
        }
    };

    const updateDurationOptions = () => {
        const durationSelect = modalEl.querySelector('#book-duration');
        const selectedDate = modalEl.querySelector('#book-date').value;
        const { closingTime } = getBusinessHoursForDate(business, selectedDate);
        const durations = getAvailableDurations(
            modalEl.querySelector('#book-time').value,
            closingTime || '22:00',
            slotDuration
        );
        durationSelect.innerHTML = durations.map(duration => `<option value="${duration}">${formatDuration(duration)}</option>`).join('');
        updateCost();
    };

    modalEl.querySelector('#book-machine').addEventListener('change', updateCost);
    modalEl.querySelector('#book-players-mode')?.addEventListener('change', updateCost);
    modalEl.querySelector('#book-time').addEventListener('change', updateDurationOptions);
    modalEl.querySelector('#book-duration').addEventListener('change', updateCost);

    // Dynamic date change slots updating
    modalEl.querySelector('#book-date').addEventListener('change', (e) => {
        const newDate = e.target.value;
        if (!newDate) return;
        
        const { openingTime: opt, closingTime: clt, closed: isCl } = getBusinessHoursForDate(business, newDate);
        const timeSelect = modalEl.querySelector('#book-time');
        const durationSelect = modalEl.querySelector('#book-duration');
        const errorMsg = modalEl.querySelector('#booking-error');
        const submitBtn = modalEl.querySelector('#btn-submit-book');
        
        if (isCl) {
            errorMsg.textContent = 'La sucursal está cerrada en la fecha seleccionada. Por favor, elige otro día.';
            errorMsg.classList.remove('hidden');
            timeSelect.innerHTML = '<option value="">Cerrado</option>';
            durationSelect.innerHTML = '<option value="">-</option>';
            timeSelect.disabled = true;
            durationSelect.disabled = true;
            submitBtn.disabled = true;
            return;
        }
        
        timeSelect.disabled = false;
        durationSelect.disabled = false;
        submitBtn.disabled = false;
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
        
        updateCost();
    });

    updateCost();

    // Autocompletado de Clientes para el Encargado/Superusuario
    if (isStaff) {
        const nameInput = modalEl.querySelector('#book-name');
        const phoneInput = modalEl.querySelector('#book-phone');
        const suggestionsDiv = modalEl.querySelector('#book-name-suggestions');

        nameInput.addEventListener('input', (e) => {
            const queryText = e.target.value.trim().toLowerCase();
            if (!queryText) {
                suggestionsDiv.innerHTML = '';
                suggestionsDiv.classList.add('hidden');
                return;
            }

            const matches = clients.filter(c => 
                (c.name && c.name.toLowerCase().includes(queryText)) || 
                (c.username && c.username.toLowerCase().includes(queryText)) ||
                (c.phone && c.phone.includes(queryText))
            ).slice(0, 5);

            if (matches.length === 0) {
                suggestionsDiv.innerHTML = '';
                suggestionsDiv.classList.add('hidden');
                return;
            }

            suggestionsDiv.innerHTML = matches.map(c => `
                <div class="suggestion-item" data-id="${c.id}" data-name="${c.name}" data-phone="${c.phone || ''}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; transition: background 0.2s; color:#ffffff;">
                    <div>
                        <span style="font-size:1.1rem; margin-right:6px;">${c.avatar || '🕺'}</span>
                        <strong style="color:#ffffff;">${c.name}</strong>
                        ${c.username ? `<span style="color:var(--piu-cyan); font-size:0.75rem; margin-left:6px;">@${c.username}</span>` : ''}
                    </div>
                    <span style="color:var(--text-muted); font-size:0.8rem;">${c.phone || ''}</span>
                </div>
            `).join('');

            suggestionsDiv.classList.remove('hidden');

            suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'rgba(0, 229, 255, 0.15)';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.background = 'transparent';
                });
                item.addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    nameInput.value = item.dataset.name;
                    phoneInput.value = item.dataset.phone;
                    suggestionsDiv.innerHTML = '';
                    suggestionsDiv.classList.add('hidden');
                });
            });
        });

        // Cerrar sugerencias al hacer click fuera
        document.addEventListener('click', (e) => {
            if (e.target !== nameInput && e.target !== suggestionsDiv) {
                suggestionsDiv.innerHTML = '';
                suggestionsDiv.classList.add('hidden');
            }
        });
    }

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

        if (!nameInput.value.trim() || !dateInput.value) {
            errorMsg.textContent = 'Por favor completa tu nombre y fecha.';
            errorMsg.classList.remove('hidden');
            return;
        }

        const startTimeVal = timeSelect.value;
        const durationMinutes = parseInt(durationSelect.value, 10);
        const endTimeVal = addMinutesToTime(startTimeVal, durationMinutes);

        try {
            const playersMode = parseInt(modalEl.querySelector('#book-players-mode')?.value, 10) || 1;
            const booking = await store.requestReservation({
                machineId: machineSelect.value,
                date: dateInput.value,
                startTime: startTimeVal,
                endTime: endTimeVal,
                durationMinutes,
                playersMode,
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

    // Generar línea de anticipo para el texto de WhatsApp
    const depositAmount = Math.round(reservation.totalCost * (business.depositPercentage / 100));
    const depositLine = business.requiresDeposit
        ? `💳 *Anticipo (${business.depositPercentage}%):* ${business.currencySymbol}${depositAmount} ${business.currency}\n`
        : `💳 *Pago:* Pago total al llegar al local\n`;

    // Generar texto para compartir en WhatsApp
    const playersLabel = reservation.playersMode === 2 ? '2 Jugadores' : '1 Jugador';
    const waText = encodeURIComponent(
        `🎮 *RESERVACIÓN PUMP IT UP - ${business.name}*\n` +
        `👤 *Jugador:* ${reservation.clientName}\n` +
        `👥 *Modo:* ${playersLabel}\n` +
        `🕹️ *Máquina:* ${machine ? machine.name : 'PIU'}\n` +
        `📅 *Fecha:* ${friendlyDate}\n` +
        `⏰ *Horario:* ${timeFormatted} (${formatDuration(reservation.durationMinutes)})\n` +
        `💰 *Total:* ${business.currencySymbol}${reservation.totalCost} ${business.currency}\n` +
        depositLine +
        `📍 *Ubicación:* ${business.address || business.city}\n` +
        `🔖 *Folio:* #${reservation.id.slice(-6).toUpperCase()}\n\n` +
        `¡Nos vemos en tu sesión de baile! 🕺💃`
    );

    const waLink = business.whatsapp 
        ? `https://wa.me/${business.whatsapp}?text=${waText}`
        : `https://api.whatsapp.com/send?text=${waText}`;

    // Generar bloque de depósito para el ticket visual
    const depositRequiredHtml = business.requiresDeposit
        ? `
            <div class="ticket-deposit-box" style="margin-top: 15px; padding: 12px; background: rgba(195, 217, 30, 0.05); border: 1px dashed rgba(195, 217, 30, 0.4); border-radius: 4px; font-size: 0.85rem; text-align: left;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px;">
                    <span style="color:var(--text-secondary); font-weight:700;">Anticipo Requerido (${business.depositPercentage}%):</span>
                    <strong style="color:var(--color-chartreuse); font-size: 1.05rem;">
                        ${business.currencySymbol}${depositAmount} ${business.currency}
                    </strong>
                </div>
                ${business.paymentInstructions ? `
                    <div style="font-size:0.78rem; color:var(--text-secondary); padding-top: 2px;">
                        <strong style="color:var(--color-neon-lime);">Instrucciones de Pago:</strong>
                        <p style="margin:4px 0 0 0; white-space:pre-line; line-height: 1.35; font-family:var(--font-mono);">${business.paymentInstructions}</p>
                    </div>
                ` : ''}
            </div>
        `
        : `
            <div class="ticket-deposit-box" style="margin-top: 15px; padding: 8px 12px; background: rgba(0, 229, 255, 0.04); border: 1px solid rgba(0, 229, 255, 0.15); border-radius: 4px; font-size: 0.82rem; color: var(--piu-cyan); text-align: left;">
                <span>✓ Pago total en mostrador (No se requiere depósito previo).</span>
            </div>
        `;

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
                        <span class="t-label">MODO DE JUEGO</span>
                        <strong class="t-value">${reservation.playersMode === 2 ? '👥 2 Jugadores' : '👤 1 Jugador'}</strong>
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
                        <strong class="t-value">${formatDuration(reservation.durationMinutes)}</strong>
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

                ${depositRequiredHtml}

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
