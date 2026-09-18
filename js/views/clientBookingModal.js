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
import { escapeHTML } from '../core/securityUtils.js';

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

    // Comprobar si el cliente actual está bloqueado en esta sucursal
    if (isClientUser && tenantManager.isClientBlocked(business, currentUser)) {
        modal.open({
            title: 'Acceso Restringido en Sucursal',
            icon: '🚫',
            contentHtml: `
                <div style="padding: 16px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 12px;">🚫</div>
                    <h3 style="color: var(--color-neon-red); margin-bottom: 12px;">Reservaciones Restringidas</h3>
                    <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5; margin-bottom: 16px;">
                        Tu cuenta tiene restringidas las reservaciones en <strong>${escapeHTML(business?.name || 'esta sucursal')}</strong> por disposición de la administración.
                    </p>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">
                        Si consideras que se trata de un error o deseas aclarar tu situación, por favor ponte en contacto directamente con el encargado del local.
                    </p>
                </div>
            `,
            footerHtml: `<button type="button" class="btn btn-secondary" id="btn-close-blocked-modal">Cerrar</button>`,
            maxWidth: '440px'
        });
        document.getElementById('btn-close-blocked-modal')?.addEventListener('click', () => modal.close());
        return;
    }

    if (machines.length === 0) {
        toast.warning("No hay máquinas disponibles en este momento para reservar.");
        return;
    }

    // Cargar la lista fresca de clientes si es encargado/superusuario para autocompletado
    let clients = [];
    const getFreshClients = () => {
        let list = (clientDirManager.allClients && clientDirManager.allClients.length > 0)
            ? clientDirManager.allClients
            : ((clientDirManager.clients && clientDirManager.clients.length > 0)
                ? clientDirManager.clients
                : (authManager.getClientUsers() || []));
        if (list.length === 0) {
            try {
                const local = localStorage.getItem('piu_registered_players_cache');
                if (local) list = JSON.parse(local);
            } catch(e) {}
        }
        return list;
    };

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

    // 🛡️ CANDADO FRONTEND: Obtener reservaciones activas del día para esta máquina
    const dayReservations = store.getReservations({ date: defaultDate, machineId: defaultMachineId, excludeRejectedCancelled: true });

    const getSafeAvailableDurations = (slotStart) => {
        const startMins = timeToMinutes(slotStart);
        let closeMins = timeToMinutes(closingTime);
        if (closeMins < startMins) closeMins += 24 * 60; // Overnight

        // 1. ¿El slotStart ya cae DENTRO de una reservación activa?
        const directConflict = dayReservations.find(r => 
            isOverlapping(slotStart, addMinutesToTime(slotStart, 1), r.startTime, r.endTime, openingTime, closingTime)
        );
        if (directConflict) {
            return { durations: [], conflict: directConflict, maxAllowedMins: 0 };
        }

        // 2. Buscar la siguiente reservación que inicie DESPUÉS de slotStart
        let maxAllowedMins = closeMins - startMins;
        let nextConflict = null;

        for (const r of dayReservations) {
            let rStart = timeToMinutes(r.startTime);
            if (closeMins > 24 * 60 && rStart < openMinutes) {
                rStart += 24 * 60;
            }
            if (rStart > startMins) {
                const diff = rStart - startMins;
                if (diff < maxAllowedMins) {
                    maxAllowedMins = diff;
                    nextConflict = r;
                }
            }
        }

        const durations = [];
        for (let dur = slotDuration; dur <= maxAllowedMins; dur += slotDuration) {
            durations.push(dur);
        }

        return { durations, nextConflict, maxAllowedMins };
    };

    const timesOptions = slots.map(s => {
        const occupant = dayReservations.find(r => 
            isOverlapping(s.start, s.end, r.startTime, r.endTime, openingTime, closingTime)
        );
        if (occupant) {
            return `<option value="${s.start}" disabled style="color:var(--text-muted); background:#1a0005;">❌ ${getSlotLabel(s.start)} (Ocupado por ${escapeHTML(occupant.clientName)})</option>`;
        }
        return `<option value="${s.start}" ${s.start === selectedSlot?.start ? 'selected' : ''}>${getSlotLabel(s.start)}</option>`;
    }).join('');
    
    const initialSafe = getSafeAvailableDurations(selectedSlot?.start || defaultStartTime);
    const durationOptions = initialSafe.durations.length > 0 ? initialSafe.durations : [slotDuration];
    const selectedDuration = durationOptions.includes(60) ? 60 : (durationOptions[0] || slotDuration);
    const selectedMachine = machines.find(m => m.id === defaultMachineId) || machines[0];

    const modalTitle = isStaff ? 'Asignar Reservación Directa' : 'Solicitar Reservación';
    const modalIcon = isStaff ? '👑' : '🕹️';

    const clientNameVal = isClientUser ? currentUser.name : (isStaff ? '' : '');
    const clientPhoneVal = isClientUser ? (currentUser.phone || '') : '';

    const contentHtml = `
        <form id="form-booking" class="cyber-form" style="display:flex; flex-direction:column; gap:14px;">
            <!-- 1. HUD INMUTABLE: MÁQUINA Y FECHA SELECCIONADAS EN EL CALENDARIO -->
            <div style="background:var(--bg-dark-700); border:1px solid rgba(0,240,255,0.25); border-radius:var(--radius-sm); padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <span style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; display:block;">🕹️ Máquina</span>
                    <strong style="font-size:1.05rem; color:#ffffff;">${escapeHTML(selectedMachine?.name || 'Gabinete PIU')}</strong>
                    ${selectedMachine?.model ? `<span class="badge badge-dark" style="font-size:0.68rem; margin-left:4px;">${escapeHTML(selectedMachine.model)}</span>` : ''}
                </div>
                <div style="text-align:right;">
                    <span style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; display:block;">📅 Fecha</span>
                    <strong style="font-size:0.95rem; color:var(--piu-cyan); font-family:var(--font-heading);">${formatFriendlyDate(defaultDate)}</strong>
                </div>
            </div>
            <!-- Valores inmutables fijados del grid -->
            <input type="hidden" id="book-machine" value="${defaultMachineId}">
            <input type="hidden" id="book-date" value="${defaultDate}">

            <!-- 2. HORA DE INICIO Y MODO DE JUEGO (1P / 2P) -->
            <div class="form-row grid-2" style="margin:0;">
                <div class="form-group" style="margin:0;">
                    <label for="book-time" style="font-size:0.82rem;"><span class="neon-arrow">◆</span> Hora de Inicio</label>
                    <select id="book-time" class="cyber-select" required style="font-weight:bold; font-family:var(--font-mono); color:var(--piu-cyan); font-size:0.95rem;">
                        ${timesOptions}
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.82rem;"><span class="neon-arrow">◆</span> Modo de Juego</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                        <button type="button" class="btn btn-sm btn-mode-pill active-pill" data-mode="1" style="padding:6px 4px; font-weight:bold; font-size:0.82rem; border:2px solid var(--piu-cyan); background:rgba(0,240,255,0.2); color:#ffffff;">
                            👤 1 Jugador
                        </button>
                        <button type="button" class="btn btn-sm btn-mode-pill" data-mode="2" style="padding:6px 4px; font-weight:bold; font-size:0.82rem; border:1px solid rgba(255,255,255,0.15); background:var(--bg-dark-700); color:var(--text-secondary);">
                            👥 2 Jugadores
                        </button>
                    </div>
                    <select id="book-players-mode" style="display:none;" required>
                        <option value="1" selected>1</option>
                        <option value="2">2</option>
                    </select>
                </div>
            </div>

            <!-- 3. DURACIÓN INTUITIVA CON CHIPS VISUALES DE 1 CLIC -->
            <div class="form-group" style="margin:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <label style="font-size:0.82rem; font-weight:700; color:#ffffff; margin:0;">
                        <span class="neon-arrow">◆</span> ¿Cuánto tiempo deseas jugar?
                    </label>
                    <span id="label-selected-duration" style="font-size:0.82rem; color:var(--color-neon-lime); font-weight:bold; font-family:var(--font-mono);">${formatDuration(selectedDuration)}</span>
                </div>
                <div id="duration-chips-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(80px, 1fr)); gap:6px;">
                    <!-- Se llena con renderDurationChips -->
                </div>
                <select id="book-duration" style="display:none;" required>
                    ${durationOptions.map(d => `<option value="${d}" ${d === selectedDuration ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
            </div>

            <!-- 4. TARIFA ESTIMADA Y ANTICIPO -->
            <div style="background:rgba(2, 56, 89, 0.35); border:1px solid rgba(0, 229, 255, 0.25); border-radius:var(--radius-sm); padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                    <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; display:block;">Tarifa Estimada:</span>
                    <strong id="booking-cost-preview" style="font-size:1.35rem; color:var(--color-neon-lime); font-family:var(--font-heading);">
                        ${business.currencySymbol}0 ${business.currency}
                    </strong>
                </div>
                <div id="booking-deposit-info" style="font-size:0.8rem; text-align:right;"></div>
            </div>

            <!-- 5. IDENTIFICACIÓN DEL JUGADOR -->
            ${isClientUser ? `
                <div style="background:var(--bg-dark-700); border:1px solid rgba(104,242,5,0.25); border-radius:var(--radius-sm); padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.5rem;">${currentUser.avatar || '🕺'}</span>
                        <div>
                            <strong style="color:#ffffff; font-size:0.88rem; display:block;">${escapeHTML(currentUser.name)}</strong>
                            <small style="color:var(--piu-cyan); font-family:var(--font-mono); font-size:0.72rem;">@${escapeHTML(currentUser.username || 'jugador')}</small>
                            ${currentUser.phone ? `<small style="color:var(--text-muted); font-size:0.72rem; margin-left:6px;">📱 ${escapeHTML(currentUser.phone)}</small>` : ''}
                        </div>
                    </div>
                    <span class="badge badge-success" style="font-size:0.68rem;">✓ Identificado</span>
                </div>
                <input type="hidden" id="book-name" value="${escapeHTML(clientNameVal)}">
                <input type="hidden" id="book-phone" value="${escapeHTML(clientPhoneVal)}">

                <!-- Notas colapsables opcionales -->
                <div>
                    <button type="button" id="btn-toggle-notes" style="background:none; border:none; color:var(--text-muted); font-size:0.75rem; cursor:pointer; padding:0;">
                        📝 Agregar notas opcionales ▼
                    </button>
                    <div id="notes-collapsible" style="display:none; margin-top:6px;">
                        <textarea id="book-notes" class="cyber-textarea" rows="2" placeholder="Ej. Práctica Single S21, uso de barra...">${currentUser.preferredMode ? `Modo: ${currentUser.preferredMode}` : ''}</textarea>
                    </div>
                </div>
            ` : `
                <!-- Para el encargado / staff: búsqueda de clientes -->
                <div class="form-row grid-2" style="margin:0;">
                    <div class="form-group" style="position: relative; margin:0;">
                        <label for="book-name" style="font-size:0.8rem;"><span class="neon-arrow">◆</span> Jugador / GamerTag *</label>
                        <input type="text" id="book-name" class="cyber-input" value="${escapeHTML(clientNameVal)}" placeholder="Buscar cliente..." required autocomplete="off" style="font-size:0.85rem;">
                        <div id="book-name-suggestions" class="hidden" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; background: var(--bg-dark-800); border: 1px solid var(--piu-cyan); border-radius: var(--radius-sm); max-height: 160px; overflow-y: auto;"></div>
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label for="book-phone" style="font-size:0.8rem;"><span class="neon-arrow">◆</span> Teléfono</label>
                        <input type="tel" id="book-phone" class="cyber-input" value="${escapeHTML(clientPhoneVal)}" placeholder="5512345678" style="font-size:0.85rem;">
                    </div>
                </div>
                <div class="form-group" style="margin:0;">
                    <label for="book-notes" style="font-size:0.8rem;"><span class="neon-arrow">◆</span> Notas (Opcional)</label>
                    <input type="text" id="book-notes" class="cyber-input" placeholder="Ej. Reserva en mostrador" style="font-size:0.85rem;">
                </div>
            `}

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
        maxWidth: '520px'
    });

    // Actualizar costo estimado
    const updateCost = () => {
        const selectedMachId = modalEl.querySelector('#book-machine')?.value || defaultMachineId;
        const durationMinutes = parseInt(modalEl.querySelector('#book-duration')?.value, 10) || slotDuration;
        const playersMode = parseInt(modalEl.querySelector('#book-players-mode')?.value, 10) || 1;
        const mach = store.getMachineById(selectedMachId) || selectedMachine;
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
                    <div style="color:var(--color-neon-lime);">
                        <span>Anticipo (${depositPct}%):</span>
                        <strong>${business.currencySymbol}${depositAmount} ${business.currency}</strong>
                    </div>
                `;
            } else {
                depositInfo.innerHTML = `
                    <span style="color:var(--piu-cyan); font-size:0.75rem;">✓ Pago total en mostrador</span>
                `;
            }
        }
    };

    // Renderizado reactivo de chips de duración con candado inteligente de horarios
    const renderDurationChips = (currentTime, currentDuration) => {
        const chipsContainer = modalEl.querySelector('#duration-chips-container');
        const labelSelected = modalEl.querySelector('#label-selected-duration');
        const durationSelect = modalEl.querySelector('#book-duration');
        const submitBtn = modalEl.querySelector('#btn-submit-book');
        const errorMsg = modalEl.querySelector('#booking-error');
        if (!chipsContainer) return;

        const { durations, conflict, nextConflict, maxAllowedMins } = getSafeAvailableDurations(currentTime);

        if (durations.length === 0) {
            chipsContainer.innerHTML = `
                <div style="grid-column: 1/-1; background:rgba(255, 0, 85, 0.15); border:1px solid var(--color-neon-red); border-radius:var(--radius-sm); padding:10px 14px; color:#ffffff; font-size:0.85rem;">
                    <div style="color:var(--color-neon-red); font-weight:700; margin-bottom:4px;">⚠️ Horario Ocupado</div>
                    <span>Este horario ya se encuentra apartado por <strong>${escapeHTML(conflict?.clientName || 'otro usuario')}</strong> (${conflict?.startTime || ''} - ${conflict?.endTime || ''}). Por favor selecciona otra hora libre en el calendario.</span>
                </div>
            `;
            if (durationSelect) durationSelect.innerHTML = '';
            if (labelSelected) labelSelected.textContent = '❌ Sin disponibilidad';
            if (submitBtn) submitBtn.disabled = true;
            return;
        }

        if (submitBtn) submitBtn.disabled = false;
        if (errorMsg) errorMsg.classList.add('hidden');

        let activeDur = currentDuration;
        if (!durations.includes(activeDur)) {
            activeDur = durations.includes(60) ? 60 : (durations[0] || slotDuration);
        }

        if (durationSelect) {
            durationSelect.innerHTML = durations.map(d => `<option value="${d}" ${d === activeDur ? 'selected' : ''}>${d}</option>`).join('');
            durationSelect.value = String(activeDur);
        }

        if (labelSelected) {
            labelSelected.textContent = formatDuration(activeDur) + (nextConflict ? ` (Máx. hasta ${format12Hour(nextConflict.startTime)})` : '');
        }

        // Mostrar chips ordenados y accesibles (máx 6)
        chipsContainer.innerHTML = durations.slice(0, 6).map(dur => {
            const isSelected = dur === activeDur;
            return `
                <button type="button" class="btn-duration-chip ${isSelected ? 'active-duration' : ''}" data-duration="${dur}" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:9px 4px; border-radius:var(--radius-sm); cursor:pointer; background:${isSelected ? 'rgba(0, 240, 255, 0.22)' : 'var(--bg-dark-700)'}; border:${isSelected ? '2px solid var(--piu-cyan)' : '1px solid rgba(255,255,255,0.12)'}; color:${isSelected ? '#ffffff' : 'var(--text-secondary)'}; font-weight:700; transition:all 0.15s ease; box-shadow:${isSelected ? '0 0 10px rgba(0,240,255,0.35)' : 'none'};">
                    <span style="font-size:0.9rem; font-family:var(--font-mono);">${formatDuration(dur)}</span>
                </button>
            `;
        }).join('');

        chipsContainer.querySelectorAll('.btn-duration-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const chosen = parseInt(chip.dataset.duration, 10);
                renderDurationChips(currentTime, chosen);
                updateCost();
            });
        });
    };

    // Modo de juego (1P / 2P)
    modalEl.querySelectorAll('.btn-mode-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            modalEl.querySelectorAll('.btn-mode-pill').forEach(p => {
                p.style.background = 'var(--bg-dark-700)';
                p.style.border = '1px solid rgba(255,255,255,0.15)';
                p.style.color = 'var(--text-secondary)';
            });
            pill.style.background = 'rgba(0, 240, 255, 0.2)';
            pill.style.border = '2px solid var(--piu-cyan)';
            pill.style.color = '#ffffff';
            const hiddenMode = modalEl.querySelector('#book-players-mode');
            if (hiddenMode) hiddenMode.value = pill.dataset.mode;
            updateCost();
        });
    });

    // Toggle de notas colapsables
    const btnToggleNotes = modalEl.querySelector('#btn-toggle-notes');
    const notesCollapsible = modalEl.querySelector('#notes-collapsible');
    if (btnToggleNotes && notesCollapsible) {
        btnToggleNotes.addEventListener('click', () => {
            const isHidden = notesCollapsible.style.display === 'none';
            notesCollapsible.style.display = isHidden ? 'block' : 'none';
            btnToggleNotes.innerHTML = isHidden 
                ? '<span>📝 Ocultar notas opcionales ▲</span>' 
                : '<span>📝 Agregar notas opcionales ▼</span>';
        });
    }

    const updateDurationOptions = () => {
        const timeVal = modalEl.querySelector('#book-time').value;
        const currentDur = parseInt(modalEl.querySelector('#book-duration')?.value, 10) || selectedDuration;
        renderDurationChips(timeVal, currentDur);
        updateCost();
    };

    modalEl.querySelector('#book-time').addEventListener('change', updateDurationOptions);

    renderDurationChips(selectedSlot?.start || defaultStartTime, selectedDuration);
    updateCost();

    // Autocompletado de Clientes para el Encargado/Superusuario
    let selectedClientRef = null;

    if (isStaff) {
        const nameInput = modalEl.querySelector('#book-name');
        const phoneInput = modalEl.querySelector('#book-phone');
        const suggestionsDiv = modalEl.querySelector('#book-name-suggestions');

        nameInput.addEventListener('input', (e) => {
            const queryText = e.target.value.trim().toLowerCase();
            const queryClean = queryText.startsWith('@') ? queryText.substring(1) : queryText;
            const queryPhone = queryText.replace(/\D/g, '');
            selectedClientRef = null;
            if (!queryText) {
                suggestionsDiv.innerHTML = '';
                suggestionsDiv.classList.add('hidden');
                return;
            }

            const freshList = getFreshClients();
            const matches = freshList.filter(c => {
                const cName = (c.name || '').toLowerCase();
                const cUsername = (c.username || '').toLowerCase();
                const cPiuId = (c.piuGameId || '').toLowerCase();
                const cPhone = (c.phone || '').replace(/\D/g, '');
                const cId = (c.id || '').toLowerCase();

                return cName.includes(queryText) ||
                    cUsername.includes(queryText) ||
                    cUsername.includes(queryClean) ||
                    cPiuId.includes(queryText) ||
                    cPiuId.replace(/#/g, '').includes(queryClean.replace(/#/g, '')) ||
                    (queryPhone && cPhone.includes(queryPhone)) ||
                    cId.includes(queryText);
            }).slice(0, 5);

            if (matches.length === 0) {
                suggestionsDiv.innerHTML = '';
                suggestionsDiv.classList.add('hidden');
                return;
            }

            suggestionsDiv.innerHTML = matches.map(c => `
                <div class="suggestion-item" data-id="${c.id}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; transition: background 0.2s; color:#ffffff;">
                    <div>
                        <span style="font-size:1.1rem; margin-right:6px;">${c.avatar || '🕺'}</span>
                        <strong style="color:#ffffff;">${escapeHTML(c.name)}</strong>
                        ${c.username ? `<span style="color:var(--piu-cyan); font-size:0.75rem; margin-left:6px;">@${escapeHTML(c.username)}</span>` : ''}
                        ${c.piuGameId ? `<span class="badge" style="background:rgba(0,229,255,0.12); color:var(--piu-cyan); border:1px solid rgba(0,229,255,0.3); font-size:0.65rem; margin-left:4px; padding:1px 4px;">🎮 ${escapeHTML(c.piuGameId)}</span>` : ''}
                    </div>
                    <span style="color:var(--text-muted); font-size:0.8rem;">${escapeHTML(c.phone || '')}</span>
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
                    const targetId = item.dataset.id;
                    const clientObj = freshList.find(c => c.id === targetId);
                    if (clientObj) {
                        nameInput.value = clientObj.name;
                        phoneInput.value = clientObj.phone || '';
                        selectedClientRef = {
                            id: clientObj.id,
                            username: clientObj.username,
                            name: clientObj.name,
                            phone: clientObj.phone
                        };
                    }
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
            const enteredName = nameInput.value.trim();
            const enteredPhone = phoneInput.value.trim();

            let targetClientId = selectedClientRef?.id || (isClientUser && currentUser ? currentUser.id : null);
            let targetClientUsername = selectedClientRef?.username || (isClientUser && currentUser ? currentUser.username : null);

            if (!targetClientId && isStaff) {
                const freshList = getFreshClients();
                const cleanPhone = enteredPhone.replace(/\D/g, '');
                const found = freshList.find(c => 
                    (c.username && c.username.toLowerCase() === enteredName.toLowerCase()) ||
                    (c.name && c.name.toLowerCase() === enteredName.toLowerCase()) ||
                    (cleanPhone && c.phone && c.phone.replace(/\D/g, '') === cleanPhone)
                );
                if (found) {
                    targetClientId = found.id;
                    targetClientUsername = found.username;
                }
            }

            // Validar bloqueo en la sucursal
            if (tenantManager.isClientBlocked(business, {
                id: targetClientId,
                username: targetClientUsername,
                phone: enteredPhone,
                name: enteredName
            })) {
                errorMsg.textContent = 'Este usuario o número de teléfono tiene restringidas las reservaciones en esta sucursal.';
                errorMsg.classList.remove('hidden');
                return;
            }

            // 🛡️ CANDADO FRONTEND PREVIO A SUBMIT
            const availability = await store.checkAvailabilityAsync(
                machineSelect.value,
                dateInput.value,
                startTimeVal,
                endTimeVal
            );
            if (!availability.available) {
                errorMsg.textContent = availability.reason;
                errorMsg.classList.remove('hidden');
                return;
            }

            const booking = await store.requestReservation({
                machineId: machineSelect.value,
                date: dateInput.value,
                startTime: startTimeVal,
                endTime: endTimeVal,
                durationMinutes,
                playersMode,
                clientId: targetClientId,
                clientUsername: targetClientUsername,
                clientName: enteredName,
                clientPhone: enteredPhone,
                notes: notesInput.value.trim()
            });

            modal.close();

            if (booking && booking.date) {
                store.setSelectedDate(booking.date);
            }

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
    const business = (reservation.businessId && tenantManager.getBusinessById)
        ? (tenantManager.getBusinessById(reservation.businessId) || store.currentBusiness)
        : store.currentBusiness;

    let machine = store.getMachineById(reservation.machineId);
    if (!machine && reservation.businessId) {
        const cached = JSON.parse(localStorage.getItem(`piu_machines_${reservation.businessId}`) || '[]');
        machine = cached.find(m => m.id === reservation.machineId);
    }
    if (!machine && business?.machines) {
        machine = business.machines.find(m => m.id === reservation.machineId);
    }
    if (!machine && reservation.machineName) {
        machine = { name: reservation.machineName, model: '' };
    }

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
                        <h4>${escapeHTML(business.name)}</h4>
                        <span>${escapeHTML(business.city)}</span>
                    </div>
                </div>

                <div class="ticket-badge-row">
                    <span class="ticket-folio">FOLIO: #${reservation.id.slice(-6).toUpperCase()}</span>
                    ${statusBadge}
                </div>

                <div class="ticket-details-grid">
                    <div class="ticket-item">
                        <span class="t-label">JUGADOR / GAMERTAG</span>
                        <strong class="t-value highlight">${escapeHTML(reservation.clientName)}</strong>
                    </div>
                    <div class="ticket-item">
                        <span class="t-label">MÁQUINA</span>
                        <strong class="t-value">${machine ? escapeHTML(machine.name) : 'PIU Machine'}</strong>
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
