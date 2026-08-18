// js/views/clientProfileView.js
// Vista para que los Clientes / Jugadores gestionen su propio perfil y sus reservaciones
import { authManager } from '../core/authManager.js';
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';
import { openLoginModal } from '../components/header.js';
import { openBookingModal, showReservationTicket } from './clientBookingModal.js';
import { formatFriendlyDate, format12Hour, formatDuration } from '../core/timeUtils.js';
import { 
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    query, 
    where 
} from '../firebaseConfig.js';
import { loyaltyManager, TIERS } from '../core/loyaltyManager.js';

const AVATAR_OPTIONS = ['🕺', '💃', '🕹️', '⚡', '🎧', '🔥', '🚀', '👑', '🎯', '🌟', '👾', '👟'];

export async function renderClientProfileView(container) {
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

    // Carga optimizada de reservaciones de este cliente directamente desde Firestore
    let myReservations = [];
    if (isFirebaseAvailable && db) {
        try {
            const q = query(
                collection(db, COLLECTIONS.RESERVATIONS), 
                where("clientId", "==", currentUser.id)
            );
            const snap = await getDocs(q);
            snap.forEach(d => myReservations.push({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn("Error cargando reservas desde Firestore:", e);
        }
    }

    // Fallback local
    if (myReservations.length === 0) {
        const allReservations = store.getReservations();
        myReservations = allReservations.filter(r => {
            const matchesId = r.clientId && r.clientId === currentUser.id;
            const matchesUser = r.clientUsername && r.clientUsername === currentUser.username;
            return matchesId || matchesUser;
        });
    }
    myReservations.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    // Carga de canjes del usuario
    let myRedemptions = [];
    if (business.loyaltyEnabled) {
        try {
            const rawRed = await loyaltyManager.getRedemptions(currentUser.id);
            myRedemptions = rawRed.filter(r => r.status !== 'CANCELLED');
        } catch (e) {
            console.warn("Error cargando canjes:", e);
        }
    }

    const totalBookings = myReservations.length;
    const confirmedBookings = myReservations.filter(r => r.status === 'CONFIRMED').length;
    const totalHours = myReservations
        .filter(r => r.status === 'CONFIRMED')
        .reduce((sum, r) => sum + ((r.durationMinutes || 60) / 60), 0);

    // Calcular estatus de lealtad según el modo activo y el local
    const activeMode = business.loyaltyMode || 'POINTS';
    const activeBusinessId = business ? business.id : '';
    const bizLoyalty = (currentUser.loyalty && activeBusinessId && currentUser.loyalty[activeBusinessId]) ? currentUser.loyalty[activeBusinessId] : { points: 0, visits: 0, tier: 'Bronce' };

    const valueForTier = activeMode === 'VISITS' ? (bizLoyalty.visits || 0) : (bizLoyalty.points || 0);
    const currentTier = loyaltyManager.calculateTier(valueForTier, activeMode);
    const { pointsNeeded, nextTierName, progressPercent } = loyaltyManager.getPointsNeededForNextTier(valueForTier, activeMode);
    const catalogRewards = business.loyaltyEnabled ? await loyaltyManager.getRewardsCatalog(business.id) : [];
    const discountPct = loyaltyManager.getDiscountForTier(currentTier.name);
    const discountText = discountPct > 0 ? `${discountPct * 100}%` : '';

    container.innerHTML = `
        <div class="client-profile-wrapper animate-fade-in" style="max-width:1000px; margin:0 auto; padding:16px; display:flex; flex-direction:column; gap:20px;">
            
            <!-- Hero Card del Jugador -->
            <div class="settings-card" style="padding:24px; border-left:4px solid ${currentTier.color}; background:linear-gradient(135deg, var(--bg-dark-800) 0%, rgba(20,25,35,0.9) 100%);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
                    <div style="display:flex; align-items:center; gap:18px;">
                        <div style="font-size:3rem; width:70px; height:70px; display:flex; align-items:center; justify-content:center; background:var(--bg-dark-700); border-radius:var(--radius-md); border:2px solid var(--border-color); box-shadow:0 0 16px ${currentTier.color}33;">
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
                                <span class="badge" style="background:${currentTier.color}22; color:${currentTier.color}; border:1px solid ${currentTier.color}55; font-size:0.75rem;">
                                    ${currentTier.badge} Nivel ${currentTier.name}
                                </span>
                                <span class="badge badge-primary" style="font-size:0.75rem;">⭐ ${currentUser.skillLevel || 'Liga C'}</span>
                                <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.75rem; color:var(--text-secondary);">🎮 ${currentUser.preferredMode || 'Single'}</span>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
                        <!-- Código QR de Jugador -->
                        <div id="player-qr-container" style="display:flex; align-items:center; gap:12px; background:var(--bg-dark-700); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-color); box-shadow:0 0 10px rgba(0,0,0,0.3); cursor:pointer;" title="Haz clic para ampliar QR">
                            <div style="text-align:left;">
                                <span style="font-size:0.75rem; color:var(--text-muted); display:block; font-weight:700;">PASS JUGADOR</span>
                                <small style="font-size:0.65rem; color:var(--piu-cyan); display:block; margin-top:2px;">Escanea en recepción</small>
                                <code style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:4px; font-family:var(--font-mono);">${currentUser.id.slice(-6).toUpperCase()}</code>
                            </div>
                            <div style="background:#ffffff; padding:4px; border-radius:4px; display:flex; align-items:center; justify-content:center;">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${currentUser.id}" alt="QR ID Jugador" style="width:48px; height:48px; display:block;">
                            </div>
                        </div>

                        <!-- Estadísticas Rápidas -->
                        <div style="display:flex; gap:16px; flex-wrap:wrap;">
                            ${business.loyaltyEnabled ? `
                                <div style="background:var(--bg-dark-700); padding:10px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;">
                                    <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Puntos Lealtad</span>
                                    <strong style="font-size:1.3rem; color:var(--color-neon-lime);">${bizLoyalty.points || 0} Pts</strong>
                                </div>
                            ` : ''}
                            <div style="background:var(--bg-dark-700); padding:10px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;">
                                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Visitas</span>
                                <strong style="font-size:1.3rem; color:var(--piu-cyan);">${bizLoyalty.visits || 0}</strong>
                            </div>
                            <div style="background:var(--bg-dark-700); padding:10px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;">
                                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Horas Jugadas</span>
                                <strong style="font-size:1.3rem; color:#ffffff;">${totalHours}h</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Navegación de Pestañas del Perfil -->
            <div style="display:flex; gap:10px; border-bottom:1px solid var(--border-color); padding-bottom:8px; flex-wrap:wrap;">
                <button class="btn btn-sm btn-profile-tab active" data-tab="tab-my-bookings" style="flex:1; max-width:240px;">
                    <span>🎟️ Mis Reservaciones (${myReservations.length})</span>
                </button>
                ${business.loyaltyEnabled ? `
                    <button class="btn btn-sm btn-outline btn-profile-tab" data-tab="tab-loyalty-rewards" style="flex:1; max-width:240px; color:var(--color-neon-lime);">
                        <span>🎁 Lealtad y Premios</span>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-outline btn-profile-tab" data-tab="tab-edit-profile" style="flex:1; max-width:240px;">
                    <span>⚙️ Administrar Perfil</span>
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
                            Selecciona una máquina y tu horario preferido para apartarla.
                        </p>
                        <button class="btn btn-primary glow-red btn-sm" id="btn-empty-book">
                            <span>🚀 Agendar mi Primera Reserva</span>
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
                            if (r.status === 'CANCELLED') statusBadge = '<span class="badge badge-danger">Cancelada</span>';
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
                                        <div>⏰ Horario: <strong style="color:var(--piu-cyan);">${timeFormatted}</strong> (${formatDuration(r.durationMinutes)})</div>
                                        <div>👥 Modo: <strong>${r.playersMode === 2 ? '👥 2 Jugadores' : '👤 1 Jugador'}</strong></div>
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

            <!-- Contenido Pestaña 2: Lealtad y Premios -->
            ${business.loyaltyEnabled ? `
                <div id="tab-loyalty-rewards" class="profile-tab-section animate-fade-in hidden">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; flex-wrap:wrap;">
                        <!-- Columna Izquierda: Estatus y Tiers -->
                        <div class="settings-card" style="padding:20px; display:flex; flex-direction:column; gap:14px; text-align:left;">
                            <h3 style="margin:0; color:#fff; font-size:1.15rem; font-family:var(--font-heading);">ESTATUS DE LEALTAD</h3>
                            
                            <div style="background:var(--bg-dark-700); padding:15px; border-radius:var(--radius-sm); border-left:4px solid ${currentTier.color};">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                    <span style="font-size:1.1rem; font-weight:bold; color:#fff;">
                                        Nivel: <span class="badge" style="background:${currentTier.color}22; color:${currentTier.color}; border:1px solid ${currentTier.color}55; font-size:0.75rem; padding: 2px 8px; margin-left:6px;">
                                            ${currentTier.badge} ${currentTier.name}
                                        </span>
                                    </span>
                                    <span style="font-size:0.82rem; color:var(--text-muted);">${bizLoyalty.visits || 0} Visitas</span>
                                </div>
                                <div style="font-size:1.7rem; font-weight:bold; color:var(--color-neon-lime);">
                                    ${activeMode === 'VISITS' 
                                        ? `${bizLoyalty.visits || 0} <span style="font-size:0.85rem; color:var(--text-secondary); font-weight:normal;">Visitas acumuladas</span>`
                                        : `${bizLoyalty.points || 0} <span style="font-size:0.85rem; color:var(--text-secondary); font-weight:normal;">Puntos acumulados</span>`
                                    }
                                </div>
                                ${discountText ? `<div style="font-size:0.82rem; color:var(--piu-cyan); font-weight:bold; margin-top:6px;">⚡ ¡Tienes ${discountText} de descuento directo en tus reservas!</div>` : ''}
                            </div>

                            <!-- Progreso -->
                            ${nextTierName ? `
                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-secondary); margin-bottom:6px;">
                                        <span>Progreso a <strong>Nivel ${nextTierName}</strong></span>
                                        <span>Faltan <strong>${pointsNeeded}</strong> ${activeMode === 'VISITS' ? 'Visitas' : 'Pts'}</span>
                                    </div>
                                    <div style="background:rgba(255,255,255,0.06); height:12px; border-radius:10px; overflow:hidden;">
                                        <div style="width:${progressPercent}%; background:linear-gradient(90deg, ${currentTier.color} 0%, var(--color-neon-lime) 100%); height:100%; transition: width 0.4s ease;"></div>
                                    </div>
                                    <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:6px; text-align:right;">${progressPercent}% completado</small>
                                </div>
                            ` : `
                                <div style="text-align:center; padding:10px; background:rgba(104,242,5,0.08); border-radius:4px; color:var(--color-neon-lime); font-weight:bold; font-size:0.88rem;">
                                    🏆 ¡Máximo Nivel Alcanzado! (Platino)
                                </div>
                            `}

                            <div style="font-size:0.8rem; color:var(--text-muted); border-top:1px dashed rgba(255,255,255,0.1); padding-top:10px; margin-top:6px;">
                                <h4 style="margin:0 0 6px 0; color:#fff; font-size:0.85rem;">Estructura de Niveles y Beneficios:</h4>
                                <ul style="margin:0; padding-left:16px; display:flex; flex-direction:column; gap:4px; list-style-type:square;">
                                    ${activeMode === 'VISITS' ? `
                                        <li>🟫 <strong>Bronce</strong> (0-9 visitas): Sin descuento.</li>
                                        <li>⬜ <strong>Plata</strong> (10-29 visitas): <strong>5% de descuento</strong> automático en reservas.</li>
                                        <li>🟨 <strong>Oro</strong> (30-59 visitas): <strong>10% de descuento</strong> automático en reservas.</li>
                                        <li>🟦 <strong>Platino</strong> (60+ visitas): <strong>15% de descuento</strong> automático en reservas.</li>
                                    ` : `
                                        <li>🟫 <strong>Bronce</strong> (0-99 pts): Sin descuento.</li>
                                        <li>⬜ <strong>Plata</strong> (100-299 pts): <strong>5% de descuento</strong> automático en reservas.</li>
                                        <li>🟨 <strong>Oro</strong> (300-599 pts): <strong>10% de descuento</strong> automático en reservas.</li>
                                        <li>🟦 <strong>Platino</strong> (600+ pts): <strong>15% de descuento</strong> automático en reservas.</li>
                                    `}
                                </ul>
                            </div>
                        </div>

                        <!-- Columna Derecha: Canjes -->
                        <div class="settings-card" style="padding:20px; display:flex; flex-direction:column; gap:14px; text-align:left;">
                            <h3 style="margin:0; color:#fff; font-size:1.15rem; font-family:var(--font-heading);">🎁 CANJEAR RECOMPENSAS</h3>
                            
                            <div class="rewards-profile-list" style="display:flex; flex-direction:column; gap:10px; max-height:350px; overflow-y:auto;">
                                ${catalogRewards.length === 0 ? `
                                    <p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:20px;">No hay premios disponibles en el catálogo en este momento.</p>
                                ` : catalogRewards.map(r => {
                                    const canRedeem = (bizLoyalty.points || 0) >= r.costPoints;
                                    return `
                                        <div style="background:var(--bg-dark-700); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:10px;">
                                            <div style="text-align:left;">
                                                <span style="font-size:1.3rem; margin-right:6px;">${r.icon || '🎁'}</span>
                                                <strong style="color:#fff; font-size:0.95rem;">${r.name}</strong>
                                                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${r.description || ''}</div>
                                                <div style="margin-top:4px;"><span class="badge badge-success" style="font-weight:bold;">${r.costPoints} ${activeMode === 'VISITS' ? 'Visitas' : 'Puntos'}</span></div>
                                            </div>
                                            <div>
                                                <button class="btn btn-primary btn-xs btn-redeem-reward glow-red" data-rew-id="${r.id}" ${canRedeem ? '' : 'disabled'} style="font-size:0.75rem;">
                                                    Canjear
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Cupones del Jugador -->
                    <div class="settings-card" style="margin-top:20px; padding:20px; text-align:left;">
                        <h3 style="margin:0 0 12px 0; color:#fff; font-size:1.15rem; font-family:var(--font-heading);">🎟️ MIS CUPONES Y RECOMPENSAS CANJEADAS</h3>
                        
                        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px;">
                            ${myRedemptions.length === 0 ? `
                                <div style="grid-column:1/-1; padding:24px; text-align:center; color:var(--text-muted); font-size:0.9rem;">
                                    Aún no has canjeado ningún premio. ¡Suma puntos jugando y canjéalos en sala!
                                </div>
                            ` : myRedemptions.map(red => {
                                const isPending = red.status === 'PENDING';
                                return `
                                    <div style="background:var(--bg-dark-700); padding:14px; border-radius:4px; border:1px solid ${isPending ? 'rgba(104,242,5,0.3)' : 'var(--border-color)'}; display:flex; flex-direction:column; gap:8px;">
                                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                            <div>
                                                <span style="font-size:1.2rem; margin-right:4px;">${red.rewardIcon || '🎁'}</span>
                                                <strong style="color:#ffffff; font-size:0.95rem;">${red.rewardName}</strong>
                                            </div>
                                            <span class="badge ${isPending ? 'badge-warning' : 'badge-dark'}" style="font-size:0.7rem;">
                                                ${isPending ? 'Listo en Sala' : 'Entregado'}
                                            </span>
                                        </div>
                                        
                                        <div style="background:var(--bg-dark-800); padding:8px; border-radius:4px; text-align:center; border:1px dashed var(--border-color); margin-top:4px;">
                                            <small style="color:var(--text-muted); display:block; font-size:0.7rem; margin-bottom:2px; font-weight:700;">CÓDIGO DE CUPÓN</small>
                                            <code style="color:var(--color-neon-lime); font-size:1.05rem; font-weight:bold; letter-spacing:1px;">${red.code}</code>
                                        </div>
                                        
                                        <div style="font-size:0.75rem; color:var(--text-muted); text-align:right;">
                                            Canjeado: ${new Date(red.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Contenido Pestaña 3: Administrar Mi Perfil -->
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

    // Código QR expandible al hacer clic
    container.querySelector('#player-qr-container')?.addEventListener('click', () => {
        const qrLargeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${currentUser.id}`;
        modal.open({
            title: 'Tarjeta de Identificación de Jugador',
            icon: '💳',
            contentHtml: `
                <div style="padding: 8px;">
                    <div class="cyber-pass-card" style="background: linear-gradient(135deg, #0d111a 0%, #151d30 100%); border: 2px solid ${currentTier.color}; box-shadow: 0 0 25px ${currentTier.color}44; border-radius: 12px; padding: 24px; text-align: center; position: relative; overflow: hidden;">
                        <!-- Marca de Agua Decorativa -->
                        <div style="position: absolute; top: -40px; right: -40px; width: 100px; height: 100px; background: ${currentTier.color}0b; border-radius: 50%; border: 1px solid ${currentTier.color}15;"></div>
                        
                        <div style="font-family: var(--font-heading); font-size: 1rem; color: #fff; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight:700;">
                            🎮 ${business ? business.name : 'PIU PHOENIX'} PASS
                        </div>
                        
                        <div style="background: #ffffff; padding: 12px; border-radius: 8px; display: inline-block; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                            <img src="${qrLargeUrl}" alt="QR Pass" style="width: 180px; height: 180px; display: block;">
                        </div>
                        
                        <div style="text-align: left; background: rgba(0,0,0,0.4); padding: 12px; border-radius: 6px; border-left: 3px solid ${currentTier.color}; border: 1px solid var(--border-color); border-left: 3px solid ${currentTier.color};">
                            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight:700; letter-spacing:1px;">GamerTag</div>
                            <strong style="font-size: 1.15rem; color: #ffffff;">@${currentUser.username || 'gamertag'}</strong>
                            
                            <div style="display: flex; justify-content: space-between; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
                                <div>
                                    <span style="font-size: 0.65rem; color: var(--text-muted); display: block; text-transform: uppercase; font-weight:700;">ID Jugador</span>
                                    <code style="font-size: 0.78rem; color: var(--piu-cyan); font-family: var(--font-mono); font-weight:700;">${currentUser.id.toUpperCase()}</code>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 0.65rem; color: var(--text-muted); display: block; text-transform: uppercase; font-weight:700;">Nivel Lealtad</span>
                                    <span style="font-size: 0.78rem; color: ${currentTier.color}; font-weight: bold;">${currentTier.badge} ${currentTier.name}</span>
                                </div>
                            </div>
                        </div>
                        
                        <small style="color: var(--text-secondary); font-size: 0.72rem; display: block; margin-top: 14px; line-height: 1.3;">Presenta esta tarjeta digital en recepción para registrar tus visitas y validar premios.</small>
                    </div>
                </div>
            `,
            footerHtml: `<button class="btn btn-secondary" id="btn-close-qr-modal">Cerrar</button>`,
            maxWidth: '400px'
        });
        
        document.getElementById('btn-close-qr-modal').onclick = () => modal.close();
    });

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
            if (confirm("¿Estás seguro de cancelar tu reservación? Esta acción liberará la máquina para otros jugadores.")) {
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

    // Canjear recompensa
    container.querySelectorAll('.btn-redeem-reward').forEach(btn => {
        btn.addEventListener('click', async () => {
            const rewId = btn.dataset.rewId;
            const reward = catalogRewards.find(r => r.id === rewId);
            if (!reward) return;

            if (confirm(`¿Estás seguro de canjear "${reward.name}" por ${reward.costPoints} puntos?\nSe descontará de tu balance de inmediato.`)) {
                try {
                    await loyaltyManager.redeemReward(
                        currentUser.id,
                        currentUser.username,
                        currentUser.name,
                        business.id,
                        reward
                    );
                    toast.success("¡Premio canjeado con éxito! Muestra tu código de cupón al encargado para reclamar tu premio.");
                    
                    // Recargar perfil
                    await authManager.init();
                    renderClientProfileView(container);
                } catch (e) {
                    toast.error(e.message);
                }
            }
        });
    });
}
