// js/views/clientProfileView.js
// Vista para que los Clientes / Jugadores gestionen su propio perfil y sus reservaciones
import { authManager } from '../core/authManager.js';
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { toast } from '../components/toast.js';
import { openLoginModal } from '../components/header.js';
import { openBookingModal, showReservationTicket } from './clientBookingModal.js';
import { formatFriendlyDate, format12Hour } from '../core/timeUtils.js';

const AVATAR_OPTIONS = ['🕺', '💃', '🕹️', '⚡', '🎧', '🔥', '🚀', '👑', '🎯', '🌟', '👾', '👟'];

export function renderClientProfileView(container) {
    const currentUser = authManager.getCurrentUser();
    const isClientUser = authManager.isClientUser();
    const business = store.currentBusiness || tenantManager.getActiveBusiness();

    // Si el usuario no ha iniciado sesión o no es cliente
    if (!isClientUser) {
        container.innerHTML = `
            <div class="client-profile-wrapper animate-fade-in" style="max-width:800px; margin:0 auto; padding:24px 16px;">
                <div class="empty-state settings-card" style="padding:48px 24px; text-align:center;">
                    <div class="empty-icon pulse-glow" style="font-size:3.5rem; margin-bottom:16px;">🕺</div>
                    <h2 style="font-size:1.6rem; color:#ffffff; margin-bottom:8px;">Mi Perfil de Jugador Pump It Up</h2>
                    <p style="color:var(--text-secondary); max-width:480px; margin:0 auto 24px auto;">
                        Crea tu perfil o inicia sesión para consultar tu historial de reservaciones, gestionar tus horarios y personalizar tu GamerTag.
                    </p>
                    <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                        <button id="btn-login-prompt" class="btn btn-primary glow-red">
                            <span>🔐 Iniciar Sesión / Registrarme</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.querySelector('#btn-login-prompt')?.addEventListener('click', () => {
            openLoginModal();
        });
        return;
    }

    // Obtener las reservaciones exclusivas de este cliente
    const allReservations = store.getReservations();
    const myReservations = allReservations.filter(r => {
        const matchesId = r.clientId && r.clientId === currentUser.id;
        const matchesUser = r.clientUsername && r.clientUsername === currentUser.username;
        const matchesName = r.clientName && r.clientName.toLowerCase() === currentUser.name.toLowerCase();
        const matchesPhone = r.clientPhone && currentUser.phone && r.clientPhone.replace(/\D/g, '') === currentUser.phone.replace(/\D/g, '');
        return matchesId || matchesUser || matchesName || matchesPhone;
    }).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    const totalBookings = myReservations.length;
    const confirmedBookings = myReservations.filter(r => r.status === 'CONFIRMED').length;
    const totalHours = myReservations
        .filter(r => r.status === 'CONFIRMED')
        .reduce((sum, r) => sum + ((r.durationMinutes || 60) / 60), 0);

    container.innerHTML = `
        <div class="client-profile-wrapper animate-fade-in" style="max-width:1000px; margin:0 auto; padding:16px; display:flex; flex-direction:column; gap:20px;">
            
            <!-- Hero Card del Jugador -->
            <div class="settings-card" style="padding:24px; border-left:4px solid var(--color-neon-lime); background:linear-gradient(135deg, var(--bg-dark-800) 0%, rgba(20,25,35,0.9) 100%);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
                    <div style="display:flex; align-items:center; gap:18px;">
                        <div style="font-size:3rem; width:70px; height:70px; display:flex; align-items:center; justify-content:center; background:var(--bg-dark-700); border-radius:var(--radius-md); border:2px solid var(--border-color); box-shadow:0 0 16px rgba(104,242,5,0.2);">
                            ${currentUser.avatar || '🕺'}
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <h1 style="font-size:1.6rem; color:#ffffff; margin:0;">${currentUser.name}</h1>
                                <span class="badge badge-success" style="font-size:0.75rem;">JUGADOR ACTIVO</span>
                            </div>
                            <div style="font-size:0.85rem; color:var(--piu-cyan); font-weight:700; margin-top:2px;">
                                @${currentUser.username || 'gamertag'}
                            </div>
                            <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                                <span class="badge badge-primary" style="font-size:0.75rem;">⭐ ${currentUser.skillLevel || 'Liga C'}</span>
                                <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.75rem; color:var(--text-secondary);">🎮 ${currentUser.preferredMode || 'Single'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Estadísticas Rápidas -->
                    <div style="display:flex; gap:16px; flex-wrap:wrap;">
                        <div style="background:var(--bg-dark-700); padding:10px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;">
                            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Total Reservas</span>
                            <strong style="font-size:1.3rem; color:var(--color-neon-lime);">${totalBookings}</strong>
                        </div>
                        <div style="background:var(--bg-dark-700); padding:10px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;">
                            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Confirmadas</span>
                            <strong style="font-size:1.3rem; color:#00ff88;">${confirmedBookings}</strong>
                        </div>
                        <div style="background:var(--bg-dark-700); padding:10px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;">
                            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Horas en Pista</span>
                            <strong style="font-size:1.3rem; color:var(--piu-cyan);">${totalHours}h</strong>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Navegación de Pestañas del Perfil -->
            <div style="display:flex; gap:10px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
                <button class="btn btn-sm btn-profile-tab active" data-tab="tab-my-bookings" style="flex:1; max-width:240px;">
                    <span>🎟️ Mis Reservaciones (${myReservations.length})</span>
                </button>
                <button class="btn btn-sm btn-outline btn-profile-tab" data-tab="tab-edit-profile" style="flex:1; max-width:240px;">
                    <span>⚙️ Administrar Mi Perfil</span>
                </button>
            </div>

            <!-- Contenido Pestaña 1: Mis Reservaciones -->
            <div id="tab-my-bookings" class="profile-tab-section animate-fade-in">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
                    <h3 style="font-size:1.2rem; margin:0; color:#ffffff;">Mis Horarios y Reservaciones en ${business?.name || 'la Sala'}</h3>
                    <button id="btn-profile-new-booking" class="btn btn-primary btn-sm glow-red">
                        <span>➕ Solicitar Nueva Reserva</span>
                    </button>
                </div>

                ${myReservations.length === 0 ? `
                    <div class="empty-state settings-card" style="padding:36px; text-align:center;">
                        <div class="empty-icon" style="font-size:2.5rem; margin-bottom:10px;">🕹️</div>
                        <h4 style="color:#ffffff;">No tienes reservaciones registradas aún</h4>
                        <p style="color:var(--text-secondary); max-width:400px; margin:0 auto 16px auto; font-size:0.9rem;">
                            Selecciona una máquina y tu horario preferido para apartar tu pista de baile.
                        </p>
                        <button class="btn btn-primary glow-red btn-sm" id="btn-empty-book">
                            <span>🚀 Agendar mi Primera Pista</span>
                        </button>
                    </div>
                ` : `
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
                        ${myReservations.map(r => {
                            const machine = store.getMachineById(r.machineId);
                            const friendlyDate = formatFriendlyDate(r.date);
                            const timeFormatted = `${format12Hour(r.startTime)} - ${format12Hour(r.endTime)}`;
                            
                            let statusBadge = '<span class="badge badge-warning">En Revisión</span>';
                            if (r.status === 'CONFIRMED') statusBadge = '<span class="badge badge-success">Confirmada</span>';
                            if (r.status === 'CANCELLED') statusBadge = '<span class="badge badge-danger">Cancelada por ti</span>';
                            if (r.status === 'REJECTED') statusBadge = '<span class="badge badge-danger">Rechazada</span>';

                            const isCancellable = r.status === 'PENDING' || r.status === 'CONFIRMED';

                            return `
                                <div class="settings-card" style="padding:16px; display:flex; flex-direction:column; gap:10px; border:1px solid ${r.status === 'CONFIRMED' ? 'rgba(0,255,136,0.3)' : 'var(--border-color)'};">
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                                        <div>
                                            <strong style="font-size:1.05rem; color:#ffffff; display:block;">${machine ? machine.name : 'Máquina PIU'}</strong>
                                            <small style="color:var(--text-muted); font-size:0.78rem;">${friendlyDate}</small>
                                        </div>
                                        <div>${statusBadge}</div>
                                    </div>

                                    <div style="background:var(--bg-dark-700); padding:10px; border-radius:var(--radius-sm); font-size:0.85rem; display:flex; flex-direction:column; gap:4px;">
                                        <div>⏰ Horario: <strong style="color:var(--piu-cyan);">${timeFormatted}</strong> (${r.durationMinutes} min)</div>
                                        <div>💰 Tarifa: <strong style="color:var(--color-chartreuse);">${business?.currencySymbol || '$'}${r.totalCost} ${business?.currency || 'MXN'}</strong></div>
                                        ${r.notes ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">📝 Notas: "${r.notes}"</div>` : ''}
                                    </div>

                                    <div style="display:flex; gap:8px; margin-top:auto; padding-top:8px; border-top:1px solid var(--border-color);">
                                        <button class="btn btn-outline btn-xs btn-view-ticket" data-res-id="${r.id}" style="flex:1;">
                                            🎟️ Ver Comprobante
                                        </button>
                                        ${isCancellable ? `
                                            <button class="btn btn-danger btn-xs btn-cancel-res" data-res-id="${r.id}" title="Cancelar esta reservación">
                                                ❌ Cancelar
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <!-- Contenido Pestaña 2: Administrar Mi Perfil -->
            <div id="tab-edit-profile" class="profile-tab-section animate-fade-in hidden">
                <div class="settings-card" style="padding:24px; max-width:650px; margin:0 auto;">
                    <h3 style="font-size:1.2rem; margin:0 0 16px 0; color:#ffffff;">Editar Mis Datos de Jugador</h3>
                    
                    <form id="form-edit-client-profile" class="cyber-form">
                        <!-- Selector de Avatar -->
                        <div class="form-group">
                            <label><span class="neon-arrow">◆</span> Elige tu Avatar</label>
                            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                                ${AVATAR_OPTIONS.map(a => `
                                    <button type="button" class="btn btn-outline btn-sm avatar-opt ${a === (currentUser.avatar || '🕺') ? 'active glow-red' : ''}" data-avatar="${a}" style="font-size:1.3rem; padding:6px 12px;">
                                        ${a}
                                    </button>
                                `).join('')}
                            </div>
                            <input type="hidden" id="edit-avatar" value="${currentUser.avatar || '🕺'}">
                        </div>

                        <div class="form-row grid-2">
                            <div class="form-group">
                                <label for="edit-name"><span class="neon-arrow">◆</span> Nombre / GamerTag *</label>
                                <input type="text" id="edit-name" class="cyber-input" value="${currentUser.name}" required>
                            </div>
                            <div class="form-group">
                                <label for="edit-phone"><span class="neon-arrow">◆</span> Teléfono / WhatsApp *</label>
                                <input type="tel" id="edit-phone" class="cyber-input" value="${currentUser.phone || ''}" placeholder="Ej. 5512345678" required>
                            </div>
                        </div>

                        <div class="form-row grid-2">
                            <div class="form-group">
                                <label for="edit-email"><span class="neon-arrow">◆</span> Correo Electrónico</label>
                                <input type="email" id="edit-email" class="cyber-input" value="${currentUser.email || ''}" placeholder="jugador@correo.com">
                            </div>
                            <div class="form-group">
                                <label for="edit-pin"><span class="neon-arrow">◆</span> Cambiar PIN de Acceso</label>
                                <input type="password" id="edit-pin" class="cyber-input" value="${currentUser.pin}" maxlength="6" placeholder="Mínimo 4 dígitos" required>
                            </div>
                        </div>

                        <div class="form-row grid-2">
                            <div class="form-group">
                                <label for="edit-level"><span class="neon-arrow">◆</span> Nivel / Liga (Ligas Potosinas)</label>
                                <select id="edit-level" class="cyber-select">
                                    <option value="Liga D" ${currentUser.skillLevel === 'Liga D' ? 'selected' : ''}>Liga D</option>
                                    <option value="Liga C" ${currentUser.skillLevel === 'Liga C' || !currentUser.skillLevel ? 'selected' : ''}>Liga C</option>
                                    <option value="Liga B" ${currentUser.skillLevel === 'Liga B' ? 'selected' : ''}>Liga B</option>
                                    <option value="Liga A" ${currentUser.skillLevel === 'Liga A' ? 'selected' : ''}>Liga A</option>
                                    <option value="Liga S" ${currentUser.skillLevel === 'Liga S' ? 'selected' : ''}>Liga S</option>
                                    <option value="Liga SS" ${currentUser.skillLevel === 'Liga SS' ? 'selected' : ''}>Liga SS</option>
                                    <option value="Liga SSS" ${currentUser.skillLevel === 'Liga SSS' ? 'selected' : ''}>Liga SSS</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="edit-mode"><span class="neon-arrow">◆</span> Modo Preferido</label>
                                <input type="text" id="edit-mode" class="cyber-input" value="${currentUser.preferredMode || 'Single'}" placeholder="Ej. Single Speed, Doubles, Freestyle">
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="edit-notes"><span class="neon-arrow">◆</span> Notas / Calibración Preferida</label>
                            <textarea id="edit-notes" class="cyber-textarea" rows="2" placeholder="Ej. Juego con barra, me gusta practicar streams, etc.">${currentUser.notes || ''}</textarea>
                        </div>

                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
                            <button type="submit" class="btn btn-primary glow-red" id="btn-save-profile">
                                <span>💾 Guardar Cambios en Mi Perfil</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

        </div>
    `;

    // Eventos de Pestañas
    const tabs = container.querySelectorAll('.btn-profile-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active', 'btn-primary');
                t.classList.add('btn-outline');
            });
            tab.classList.add('active', 'btn-primary');
            tab.classList.remove('btn-outline');

            const targetTab = tab.dataset.tab;
            container.querySelectorAll('.profile-tab-section').forEach(sec => sec.classList.add('hidden'));
            const activeSection = container.querySelector(`#${targetTab}`);
            if (activeSection) activeSection.classList.remove('hidden');
        });
    });

    // Selector de avatar
    container.querySelectorAll('.avatar-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('active', 'glow-red'));
            btn.classList.add('active', 'glow-red');
            container.querySelector('#edit-avatar').value = btn.dataset.avatar;
        });
    });

    // Guardar cambios del perfil
    const profileForm = container.querySelector('#form-edit-client-profile');
    profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = container.querySelector('#edit-name').value.trim();
        const phone = container.querySelector('#edit-phone').value.trim();
        const email = container.querySelector('#edit-email').value.trim();
        const pin = container.querySelector('#edit-pin').value.trim();
        const skillLevel = container.querySelector('#edit-level').value;
        const preferredMode = container.querySelector('#edit-mode').value.trim();
        const notes = container.querySelector('#edit-notes').value.trim();
        const avatar = container.querySelector('#edit-avatar').value;

        if (!name || !phone || !pin) {
            toast.error("Por favor completa los campos obligatorios.");
            return;
        }

        if (pin.length < 4) {
            toast.error("El PIN debe tener al menos 4 caracteres.");
            return;
        }

        try {
            await authManager.updateClientProfile(currentUser.id, {
                name, phone, email, pin, skillLevel, preferredMode, notes, avatar
            });
            toast.success("¡Tu perfil ha sido actualizado exitosamente!");
            renderClientProfileView(container);
        } catch (err) {
            toast.error(err.message || "Error al actualizar el perfil.");
        }
    });

    // Botones de Reservar
    container.querySelector('#btn-profile-new-booking')?.addEventListener('click', () => {
        openBookingModal();
    });
    container.querySelector('#btn-empty-book')?.addEventListener('click', () => {
        openBookingModal();
    });

    // Ver comprobante
    container.querySelectorAll('.btn-view-ticket').forEach(btn => {
        btn.addEventListener('click', () => {
            const resId = btn.dataset.resId;
            const res = myReservations.find(r => r.id === resId);
            if (res) showReservationTicket(res);
        });
    });

    // Cancelar reservación
    container.querySelectorAll('.btn-cancel-res').forEach(btn => {
        btn.addEventListener('click', async () => {
            const resId = btn.dataset.resId;
            if (confirm("¿Estás seguro de cancelar tu reservación? Esta acción liberará la pista para otros jugadores.")) {
                try {
                    await store.cancelReservationByClient(resId);
                    toast.info("Tu reservación ha sido cancelada.");
                    renderClientProfileView(container);
                } catch (err) {
                    toast.error(err.message || "No se pudo cancelar la reservación.");
                }
            }
        });
    });
}
