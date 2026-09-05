// js/views/versusView.js
// Vista de Arena Versus, Matchmaking PVP, Bandeja de Retos, Mini-Calendario, Selección de Máquina y Horarios en 2 Secciones Responsivas (v1.9.9)
import { challengeManager, CHALLENGE_STATUS, CHALLENGE_MODES, LIGA_ORDER } from '../core/challengeManager.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { escapeHTML } from '../core/securityUtils.js';
import { formatDateKey, format12Hour, addMinutesToTime, formatDuration, getMonthDays, MONTH_NAMES, DAYS_OF_WEEK, timeToMinutes } from '../core/timeUtils.js';
import { openLoginModal } from '../components/header.js';

let activeTab = 'tab-history'; // Cargar primero el historial de encuentros
let leagueFilter = 'ALL';

export async function renderVersusView(container) {
    if (!container) return;

    const currentUser = authManager.getCurrentUser();
    const allBusinesses = tenantManager.getAllBusinesses();

    // Cargar retos asociados al usuario si está autenticado
    const userChallenges = currentUser ? await challengeManager.getChallengesForUser(currentUser.id) : [];
    const pendingCount = userChallenges.filter(c => 
        (c.status === CHALLENGE_STATUS.PENDING && c.turn === currentUser?.id) ||
        (c.status === CHALLENGE_STATUS.COUNTER_OFFERED && c.turn === currentUser?.id)
    ).length;

    // Cargar directorio global de jugadores
let allPlayers = [];

try {
    allPlayers = await authManager.loadClientUsers();
} catch (e) {
    console.warn('No se pudo cargar el directorio de jugadores:', e);
}

if (!allPlayers || allPlayers.length === 0) {
    try {
        allPlayers = JSON.parse(
            localStorage.getItem('piu_registered_players_cache') || '[]'
        );
    } catch (e) {
        allPlayers = [];
    }
}

    container.innerHTML = `
        <div class="versus-arena-wrapper animate-fade-in" style="max-width:1200px; margin:0 auto; padding:16px; display:flex; flex-direction:column; gap:20px;">
            
            <!-- Hero Banner Arcade Versus -->
            <div class="settings-card" style="padding:24px; background:linear-gradient(135deg, rgba(20, 25, 40, 0.95) 0%, rgba(35, 15, 30, 0.95) 100%); border:1px solid rgba(255, 0, 85, 0.35); border-left:5px solid var(--color-neon-pink); box-shadow:0 0 25px rgba(255, 0, 85, 0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <div style="font-size:3.2rem; width:75px; height:75px; display:flex; align-items:center; justify-content:center; background:var(--bg-dark-700); border-radius:var(--radius-md); border:2px solid var(--color-neon-pink); box-shadow:0 0 16px rgba(255, 0, 85, 0.4);">
                            ⚔️
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <h1 style="font-size:1.75rem; color:#ffffff; margin:0; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:1px;">
                                    ARENA VERSUS <span style="color:var(--color-neon-pink);">PVP</span>
                                </h1>
                            </div>
                            <p style="color:var(--text-muted); font-size:0.88rem; margin:4px 0 0 0;">
                                Duelos presenciales o remotos sincronizados con selección de máquina y horarios en tiempo real.
                            </p>
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                        ${currentUser ? `
                            <div style="display:flex; align-items:center; gap:12px; background:var(--bg-dark-700); padding:8px 16px; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.1);">
                                <span style="font-size:1.8rem;">${currentUser.avatar || '🕺'}</span>
                                <div>
                                    <strong style="color:#ffffff; font-size:0.9rem; display:block;">${escapeHTML(currentUser.name)}</strong>
                                    <div style="display:flex; gap:6px; margin-top:2px;">
                                        <span class="badge badge-primary" style="font-size:0.7rem;">⭐ ${escapeHTML(currentUser.skillLevel || 'Liga C')}</span>
                                        <span class="badge" style="background:rgba(104,242,5,0.15); color:var(--color-neon-lime); font-size:0.7rem; font-weight:700;">
                                            ${currentUser.versusStats?.wins || 0}V - ${currentUser.versusStats?.losses || 0}D
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button id="btn-hero-new-challenge" class="btn btn-primary glow-red" style="font-weight:bold; font-size:0.95rem; padding:10px 20px; box-shadow:0 0 16px rgba(255,0,85,0.5);">
                                <span>➕ ⚔️ Desafiar a un Rival</span>
                            </button>
                        ` : `
                            <button id="btn-arena-login" class="btn btn-primary btn-sm glow-red">
                                <span>🔐 Iniciar Sesión para Retar</span>
                            </button>
                        `}
                    </div>
                </div>
            </div>

            <!-- Navegación de Pestañas de la Arena -->
            <div style="display:flex; gap:10px; border-bottom:1px solid var(--border-color); padding-bottom:8px; flex-wrap:wrap;">
                <button class="btn btn-sm btn-versus-tab ${activeTab === 'tab-history' ? 'active btn-primary' : 'btn-outline'}" data-tab="tab-history" style="flex:1; min-width:200px;">
                    <span>📜 Historial de Encuentros</span>
                </button>
                <button class="btn btn-sm btn-versus-tab ${activeTab === 'tab-my-challenges' ? 'active btn-primary' : 'btn-outline'}" data-tab="tab-my-challenges" style="flex:1; min-width:200px; position:relative;">
                    <span>📥 Mis Retos Activos</span>
                    ${pendingCount > 0 ? `
                        <span style="background:var(--color-neon-pink); color:#fff; font-size:0.68rem; font-weight:bold; padding:2px 7px; border-radius:var(--radius-full); margin-left:6px; box-shadow:0 0 8px var(--color-neon-pink);">
                            ${pendingCount}
                        </span>
                    ` : ''}
                </button>
                <button class="btn btn-sm btn-versus-tab ${activeTab === 'tab-leaderboard' ? 'active btn-primary' : 'btn-outline'}" data-tab="tab-leaderboard" style="flex:1; min-width:200px;">
                    <span>🏆 Tabla de Clasificación</span>
                </button>
            </div>

            <!-- Contenedor Dinámico de Subpestañas -->
            <div id="versus-tab-content">
                <!-- Se renderiza según activeTab -->
            </div>

        </div>
    `;

    // Renderizar la subpestaña activa
    renderTabContent(container, allPlayers, userChallenges, currentUser, allBusinesses);

    // Eventos de navegación entre subpestañas
    container.querySelectorAll('.btn-versus-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTab = btn.dataset.tab;
            container.querySelectorAll('.btn-versus-tab').forEach(b => {
                b.classList.remove('active', 'btn-primary');
                b.classList.add('btn-outline');
            });
            btn.classList.add('active', 'btn-primary');
            btn.classList.remove('btn-outline');
            renderTabContent(container, allPlayers, userChallenges, currentUser, allBusinesses);
        });
    });

    // Botón para abrir el Modal de Desafiar a un Rival
    container.querySelector('#btn-hero-new-challenge')?.addEventListener('click', () => {
        openMatchmakingModal({
            allPlayers,
            currentUser,
            allBusinesses,
            userChallenges,
            onChallengeSent: async () => {
                const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
                activeTab = 'tab-my-challenges';
                container.querySelectorAll('.btn-versus-tab').forEach(b => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline');
                    if (b.dataset.tab === 'tab-my-challenges') {
                        b.classList.add('active', 'btn-primary');
                        b.classList.remove('btn-outline');
                    }
                });
                renderTabContent(container, allPlayers, refreshed, currentUser, allBusinesses);
            }
        });
    });

    container.querySelector('#btn-arena-login')?.addEventListener('click', () => {
        openLoginModal();
    });
}

function renderTabContent(container, allPlayers, userChallenges, currentUser, allBusinesses) {
    const contentEl = container.querySelector('#versus-tab-content');
    if (!contentEl) return;

    if (activeTab === 'tab-history') {
        renderHistoryTab(contentEl, userChallenges, currentUser, allPlayers, allBusinesses);
    } else if (activeTab === 'tab-my-challenges') {
        renderMyChallengesTab(contentEl, userChallenges, currentUser, allBusinesses);
    } else if (activeTab === 'tab-leaderboard') {
        renderLeaderboardTab(contentEl, allPlayers, currentUser, allBusinesses, userChallenges);
    }
}

// =========================================================================
// SUBPESTAÑA 1: HISTORIAL DE ENCUENTROS (DEFAULT)
// =========================================================================
async function renderHistoryTab(contentEl, userChallenges, currentUser, allPlayers, allBusinesses) {
    const allGlobalChallenges = await challengeManager.getGlobalChallenges(100);
    const completed = allGlobalChallenges.filter(c => c.status === CHALLENGE_STATUS.COMPLETED);

    contentEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="settings-card" style="padding:16px; background:var(--bg-dark-800); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div>
                    <h2 style="font-size:1.2rem; color:#fff; margin:0;">📜 HISTORIAL DE DUELOS Y RESULTADOS</h2>
                    <small style="color:var(--text-muted); font-size:0.8rem;">Registro cronológico de retas finalizadas en la comunidad</small>
                </div>
                ${currentUser ? `
                    <button class="btn btn-primary btn-sm glow-red btn-launch-matchmaking">
                        <span>⚔️ Lanzar Nuevo Reto</span>
                    </button>
                ` : ''}
            </div>

            ${completed.length === 0 ? `
                <div style="text-align:center; padding:50px 20px; background:var(--bg-dark-800); border-radius:var(--radius-md); border:1px dashed var(--border-color);">
                    <div style="font-size:3rem; margin-bottom:12px;">📜</div>
                    <strong style="font-size:1.15rem; color:#fff;">Aún no hay resultados de duelos registrados</strong>
                    <p style="color:var(--text-muted); font-size:0.88rem; margin:6px auto 16px auto; max-width:420px;">
                        ¡Sé el primero en retar a otro jugador, jugar la reta en sala y registrar el marcador oficial!
                    </p>
                    ${currentUser ? `
                        <button class="btn btn-primary btn-sm glow-red btn-launch-matchmaking">
                            <span>🚀 Desafiar a mi Primer Rival</span>
                        </button>
                    ` : ''}
                </div>
            ` : `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${completed.map(chal => {
                        const res = chal.matchResult || {};
                        const pA = chal.challenger;
                        const pB = chal.opponent;
                        const isWinnerA = res.winnerId === pA.id;
                        const isWinnerB = res.winnerId === pB.id;

                        return `
                            <div class="settings-card animate-fade-in" style="padding:16px; background:var(--bg-dark-800); border:1px solid rgba(255,255,255,0.08);">
                                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                                    <div style="display:flex; align-items:center; gap:16px; flex:1; min-width:280px;">
                                        <!-- Jugador A -->
                                        <div style="text-align:right; flex:1;">
                                            <strong style="color:${isWinnerA ? 'var(--color-neon-lime)' : '#fff'}; font-size:1.05rem; display:block;">
                                                ${isWinnerA ? '👑 ' : ''}${escapeHTML(pA.name)}
                                            </strong>
                                            <small style="color:var(--piu-cyan); font-family:var(--font-mono);">@${escapeHTML(pA.username || '')}</small>
                                        </div>

                                        <!-- Marcador Central -->
                                        <div style="background:var(--bg-dark-900); padding:6px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;">
                                            <span style="font-size:1.2rem; font-weight:900; color:${res.isDraw ? 'var(--color-neon-gold)' : 'var(--color-neon-pink)'}; font-family:var(--font-mono);">
                                                ${res.scoreA || 0} - ${res.scoreB || 0}
                                            </span>
                                            <small style="display:block; font-size:0.65rem; color:var(--text-muted);">${res.isDraw ? 'EMPATE' : 'FINAL'}</small>
                                        </div>

                                        <!-- Jugador B -->
                                        <div style="text-align:left; flex:1;">
                                            <strong style="color:${isWinnerB ? 'var(--color-neon-lime)' : '#fff'}; font-size:1.05rem; display:block;">
                                                ${isWinnerB ? '👑 ' : ''}${escapeHTML(pB.name)}
                                            </strong>
                                            <small style="color:var(--piu-cyan); font-family:var(--font-mono);">@${escapeHTML(pB.username || '')}</small>
                                        </div>
                                    </div>

                                    <div style="font-size:0.75rem; color:var(--text-muted); text-align:right;">
                                        <div>📅 ${chal.schedule.date}</div>
                                        <div>📍 ${escapeHTML(chal.location.businessName || chal.location.externalName || 'Local')}</div>
                                        ${chal.location.machineName ? `<div style="color:var(--piu-cyan);">🕹️ ${escapeHTML(chal.location.machineName)}</div>` : ''}
                                    </div>
                                </div>

                                ${res.songsPlayed ? `
                                    <div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.06); font-size:0.78rem; color:var(--text-muted);">
                                        🎵 <strong>Canciones:</strong> ${escapeHTML(res.songsPlayed)}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;

    contentEl.querySelectorAll('.btn-launch-matchmaking').forEach(btn => {
        btn.addEventListener('click', () => {
            openMatchmakingModal({
                allPlayers,
                currentUser,
                allBusinesses,
                userChallenges
            });
        });
    });
}

// =========================================================================
// SUBPESTAÑA 2: BANDEJA DE RETOS (MIS RETOS)
// =========================================================================
function renderMyChallengesTab(contentEl, userChallenges, currentUser, allBusinesses) {
    if (!currentUser) {
        contentEl.innerHTML = `
            <div style="text-align:center; padding:50px 20px; background:var(--bg-dark-800); border-radius:var(--radius-md); border:1px dashed var(--border-color);">
                <div style="font-size:3rem; margin-bottom:12px;">🔐</div>
                <h3 style="color:#ffffff; margin:0 0 8px 0;">Inicia Sesión para ver tus Retos</h3>
                <p style="color:var(--text-muted); font-size:0.88rem; max-width:400px; margin:0 auto 16px auto;">
                    Gestiona tus desafíos recibidos, envía contrapropuestas y confirma tus horarios agendados.
                </p>
                <button id="btn-inbox-login" class="btn btn-primary btn-sm glow-red">
                    <span>Iniciar Sesión / Registro</span>
                </button>
            </div>
        `;
        contentEl.querySelector('#btn-inbox-login')?.addEventListener('click', () => openLoginModal());
        return;
    }

    const activeChallenges = userChallenges.filter(c => 
        c.status === CHALLENGE_STATUS.PENDING || 
        c.status === CHALLENGE_STATUS.COUNTER_OFFERED || 
        c.status === CHALLENGE_STATUS.ACCEPTED
    );

    if (activeChallenges.length === 0) {
        contentEl.innerHTML = `
            <div style="text-align:center; padding:50px 20px; background:var(--bg-dark-800); border-radius:var(--radius-md); border:1px dashed var(--border-color);">
                <div style="font-size:3rem; margin-bottom:12px;">📥</div>
                <h3 style="color:#ffffff; margin:0 0 8px 0;">No tienes retos activos</h3>
                <p style="color:var(--text-muted); font-size:0.88rem; margin:0 0 16px 0;">
                    ¡Lanza un nuevo desafío a otro pumper para jugar en tu local favorito o en duelo remoto!
                </p>
                <button class="btn btn-primary btn-sm glow-red btn-launch-matchmaking">
                    <span>⚔️ Desafiar a un Rival</span>
                </button>
            </div>
        `;
        contentEl.querySelector('.btn-launch-matchmaking')?.addEventListener('click', () => {
            openMatchmakingModal({
                allPlayers: authManager.clientUsers || [],
                currentUser,
                allBusinesses,
                userChallenges
            });
        });
        return;
    }

    contentEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            ${activeChallenges.map(chal => {
                const isChallenger = chal.challenger.id === currentUser.id;
                const rival = isChallenger ? chal.opponent : chal.challenger;
                const isMyTurn = chal.turn === currentUser.id;
                const modeInfo = CHALLENGE_MODES[chal.mode] || CHALLENGE_MODES.SAME_LOCAL;

                let statusBadge = '';
                if (chal.staffRejectionReason) {
                    statusBadge = `<span class="badge badge-danger pulse-glow" style="font-size:0.75rem;">⚠️ Rechazada por Encargado</span>`;
                } else if (chal.status === CHALLENGE_STATUS.ACCEPTED) {
                    statusBadge = `<span class="badge badge-warning pulse-glow" style="font-size:0.75rem;">⏳ Reta Agendada • Pendiente de Aprobación</span>`;
                } else if (isMyTurn) {
                    statusBadge = `<span class="badge badge-warning pulse-glow" style="font-size:0.75rem;">⏳ ¡Es tu turno de responder!</span>`;
                } else {
                    statusBadge = `<span class="badge" style="background:rgba(255,255,255,0.1); color:var(--text-muted); font-size:0.75rem;">⌛ Esperando respuesta de ${escapeHTML(rival.name)}</span>`;
                }

                return `
                    <div class="settings-card animate-fade-in" style="padding:20px; background:var(--bg-dark-800); border:1px solid rgba(255,255,255,0.1); border-left:4px solid ${chal.staffRejectionReason ? '#FF5252' : (chal.status === CHALLENGE_STATUS.ACCEPTED ? 'var(--color-neon-gold)' : 'var(--color-neon-pink)')};">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
                            <div style="display:flex; gap:14px; align-items:center;">
                                <div style="font-size:2.2rem; width:52px; height:52px; display:flex; align-items:center; justify-content:center; background:var(--bg-dark-700); border-radius:var(--radius-md); border:1px solid var(--border-color);">
                                    ${rival.avatar || '🕺'}
                                </div>
                                <div>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <h3 style="color:#ffffff; margin:0; font-size:1.15rem;">
                                            ${isChallenger ? `Retaste a: ${escapeHTML(rival.name)}` : `Reto de: ${escapeHTML(rival.name)}`}
                                        </h3>
                                        <span class="badge badge-primary" style="font-size:0.7rem;">⭐ ${escapeHTML(rival.league || 'Liga C')}</span>
                                    </div>
                                    <div style="font-size:0.8rem; color:var(--piu-cyan); font-family:var(--font-mono); margin-top:2px;">
                                        @${escapeHTML(rival.username || 'gamertag')} • ${modeInfo.badge}
                                    </div>
                                </div>
                            </div>

                            <div>
                                ${statusBadge}
                            </div>
                        </div>

                        <!-- Detalle de Horario, Lugar y Máquina -->
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; background:rgba(0,0,0,0.3); padding:12px; border-radius:var(--radius-sm); margin:16px 0; border:1px solid rgba(255,255,255,0.05);">
                            <div>
                                <span style="font-size:0.72rem; color:var(--text-muted); display:block;">📅 FECHA PACTADA</span>
                                <strong style="color:#ffffff; font-size:0.9rem;">${chal.schedule.date}</strong>
                            </div>
                            <div>
                                <span style="font-size:0.72rem; color:var(--text-muted); display:block;">⏰ HORARIO</span>
                                <strong style="color:var(--color-neon-lime); font-size:0.9rem;">${format12Hour(chal.schedule.startTime)} - ${format12Hour(chal.schedule.endTime)}</strong>
                            </div>
                            <div>
                                <span style="font-size:0.72rem; color:var(--text-muted); display:block;">📍 SUCURSAL / GABINETE</span>
                                <strong style="color:var(--piu-cyan); font-size:0.9rem;">
                                    ${chal.mode === 'DIFFERENT_LOCALS' 
                                        ? `⚡ ${escapeHTML(chal.location.businessName || 'Local A')} vs ${escapeHTML(chal.location.businessNameB || 'Local B')}`
                                        : `👥 ${escapeHTML(chal.location.businessName || 'Local')}`
                                    }
                                </strong>
                                ${chal.location.machineName ? `
                                    <small style="display:block; color:var(--text-muted); font-size:0.75rem; margin-top:2px;">
                                        🕹️ ${escapeHTML(chal.location.machineName)}
                                    </small>
                                ` : ''}
                            </div>
                        </div>

                        ${chal.notes ? `
                            <div style="font-size:0.82rem; color:var(--text-secondary); background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:16px; border-left:2px solid var(--color-neon-gold);">
                                💬 <em>"${escapeHTML(chal.notes)}"</em>
                            </div>
                        ` : ''}

                        ${chal.staffRejectionReason ? `
                            <div style="font-size:0.85rem; color:#FF5252; background:rgba(255,82,82,0.12); padding:10px 14px; border-radius:var(--radius-sm); margin-bottom:14px; border-left:4px solid #FF5252;">
                                ⚠️ <strong>Aviso de Sucursal:</strong> La reservación fue cancelada/rechazada por el encargado: <em>"${escapeHTML(chal.staffRejectionReason)}"</em>.<br>
                                Por favor propón un nuevo horario o sucursal con el botón de abajo.
                            </div>
                        ` : ''}

                        <!-- Botones de Acción -->
                        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; align-items:center;">
                            ${chal.status === CHALLENGE_STATUS.ACCEPTED ? `
                                <button class="btn btn-outline btn-sm btn-counter-offer" data-challenge-id="${chal.id}" style="border-color:var(--color-neon-gold); color:var(--color-neon-gold);">
                                    <span>🔄 Cambiar Horario / Local</span>
                                </button>
                                <button class="btn btn-primary btn-sm btn-report-result glow-red" data-challenge-id="${chal.id}">
                                    <span>🏆 Capturar Resultado Final</span>
                                </button>
                            ` : ''}

                            ${(chal.status === CHALLENGE_STATUS.COUNTER_OFFERED && chal.staffRejectionReason) ? `
                                <button class="btn btn-primary btn-sm btn-counter-offer glow-red" data-challenge-id="${chal.id}">
                                    <span>🔄 Proponer Nuevo Horario / Local</span>
                                </button>
                            ` : ''}

                            ${(isMyTurn && (chal.status === CHALLENGE_STATUS.PENDING || chal.status === CHALLENGE_STATUS.COUNTER_OFFERED)) ? `
                                <button class="btn btn-danger btn-sm btn-reject-challenge" data-challenge-id="${chal.id}">
                                    <span>❌ Declinar</span>
                                </button>
                                <button class="btn btn-outline btn-sm btn-counter-offer" data-challenge-id="${chal.id}" style="border-color:var(--color-neon-gold); color:var(--color-neon-gold);">
                                    <span>🔄 Contraproponer Horario/Local</span>
                                </button>
                                <button class="btn btn-primary btn-sm btn-accept-challenge glow-red" data-challenge-id="${chal.id}">
                                    <span>✔️ Responder / Aceptar</span>
                                </button>
                            ` : ''}

                            ${(!isMyTurn && (chal.status === CHALLENGE_STATUS.PENDING || chal.status === CHALLENGE_STATUS.COUNTER_OFFERED)) ? `
                                <button class="btn btn-outline btn-sm btn-cancel-challenge" data-challenge-id="${chal.id}" style="border-color:#FF5252; color:#FF5252;">
                                    <span>🗑️ Cancelar Invitación</span>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    // Listeners
    contentEl.querySelectorAll('.btn-accept-challenge').forEach(btn => {
        btn.addEventListener('click', () => {
            const cid = btn.dataset.challengeId;
            const challenge = userChallenges.find(c => c.id === cid);
            if (challenge) {
                openAcceptChallengeModal(challenge, currentUser, allBusinesses, async () => {
                    const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
                    renderMyChallengesTab(contentEl, refreshed, currentUser, allBusinesses);
                }, () => {
                    openCounterOfferModal(challenge, currentUser, allBusinesses, contentEl);
                });
            }
        });
    });

    contentEl.querySelectorAll('.btn-reject-challenge').forEach(btn => {
        btn.addEventListener('click', async () => {
            const cid = btn.dataset.challengeId;
            if (!confirm("¿Deseas declinar este desafío?")) return;
            try {
                await challengeManager.rejectChallenge(cid, currentUser, 'DECLINED');
                toast.info("Reto declinado.");
                const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
                renderMyChallengesTab(contentEl, refreshed, currentUser, allBusinesses);
            } catch (err) {
                toast.error("Error: " + err.message);
            }
        });
    });

    contentEl.querySelectorAll('.btn-cancel-challenge').forEach(btn => {
        btn.addEventListener('click', async () => {
            const cid = btn.dataset.challengeId;
            if (!confirm("¿Deseas cancelar esta invitación enviada?")) return;
            try {
                await challengeManager.rejectChallenge(cid, currentUser, 'CANCELLED');
                toast.info("Invitación cancelada.");
                const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
                renderMyChallengesTab(contentEl, refreshed, currentUser, allBusinesses);
            } catch (err) {
                toast.error("Error: " + err.message);
            }
        });
    });

    contentEl.querySelectorAll('.btn-counter-offer').forEach(btn => {
        btn.addEventListener('click', () => {
            const cid = btn.dataset.challengeId;
            const challenge = userChallenges.find(c => c.id === cid);
            if (challenge) {
                openCounterOfferModal(challenge, currentUser, allBusinesses, contentEl);
            }
        });
    });

    contentEl.querySelectorAll('.btn-report-result').forEach(btn => {
        btn.addEventListener('click', () => {
            const cid = btn.dataset.challengeId;
            const challenge = userChallenges.find(c => c.id === cid);
            if (challenge) {
                openReportResultModal(challenge, currentUser, contentEl);
            }
        });
    });
}

// =========================================================================
// SUBPESTAÑA 3: TABLA DE CLASIFICACIÓN
// =========================================================================
async function renderLeaderboardTab(contentEl, allPlayers, currentUser, allBusinesses, userChallenges) {
    const sortedLeaderboard = await challengeManager.getLeaderboard({ filterLeague: leagueFilter, allPlayers });

    contentEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="settings-card" style="padding:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:var(--bg-dark-800);">
                <div>
                    <h2 style="font-size:1.2rem; color:#fff; margin:0;">🏆 TABLA OFICIAL DE CLASIFICACIÓN</h2>
                    <small style="color:var(--text-muted); font-size:0.8rem;">Ordenado por Nivel y Récord de Victorias PVP</small>
                </div>

                <div style="display:flex; gap:8px; align-items:center;">
                    <span style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">División:</span>
                    <select id="select-leaderboard-league" class="cyber-select" style="min-width:160px;">
                        <option value="ALL" ${leagueFilter === 'ALL' ? 'selected' : ''}>Todas las Divisiones</option>
                        <option value="Liga SSS" ${leagueFilter === 'Liga SSS' ? 'selected' : ''}>⭐ Liga SSS (Élite)</option>
                        <option value="Liga SS" ${leagueFilter === 'Liga SS' ? 'selected' : ''}>⭐ Liga SS (Pro)</option>
                        <option value="Liga S" ${leagueFilter === 'Liga S' ? 'selected' : ''}>⭐ Liga S</option>
                        <option value="Liga A" ${leagueFilter === 'Liga A' ? 'selected' : ''}>⭐ Liga A</option>
                        <option value="Liga B" ${leagueFilter === 'Liga B' ? 'selected' : ''}>⭐ Liga B</option>
                        <option value="Liga C" ${leagueFilter === 'Liga C' ? 'selected' : ''}>⭐ Liga C</option>
                        <option value="Liga D" ${leagueFilter === 'Liga D' ? 'selected' : ''}>⭐ Liga D</option>
                    </select>
                </div>
            </div>

            <div class="table-responsive" style="background:var(--bg-dark-800); border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.08); overflow:hidden;">
                <table class="cyber-table" style="width:100%; text-align:left; border-collapse:collapse;">
                    <thead>
                        <tr style="background:rgba(0,0,0,0.4); border-bottom:1px solid rgba(255,255,255,0.1);">
                            <th style="padding:12px 16px; width:70px; text-align:center;">#</th>
                            <th style="padding:12px 16px;">Jugador</th>
                            <th style="padding:12px 16px;">División</th>
                            <th style="padding:12px 16px; text-align:center;">Victorias</th>
                            <th style="padding:12px 16px; text-align:center;">Derrotas</th>
                            <th style="padding:12px 16px; text-align:center;">Efectividad</th>
                            <th style="padding:12px 16px; text-align:right;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedLeaderboard.map((p, idx) => {
                            const isMe = currentUser && currentUser.id === p.id;
                            const vs = p.versusStats || { wins: 0, losses: 0, totalMatches: 0, winRate: 0 };
                            let rankBadge = `${idx + 1}`;
                            if (idx === 0) rankBadge = '🥇';
                            else if (idx === 1) rankBadge = '🥈';
                            else if (idx === 2) rankBadge = '🥉';

                            return `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.04); background:${isMe ? 'rgba(0, 240, 255, 0.06)' : 'transparent'};">
                                    <td style="padding:12px 16px; text-align:center; font-weight:bold; font-size:1.1rem; color:${idx < 3 ? 'var(--color-neon-gold)' : 'var(--text-muted)'};">
                                        ${rankBadge}
                                    </td>
                                    <td style="padding:12px 16px;">
                                        <div style="display:flex; align-items:center; gap:10px;">
                                            <span style="font-size:1.4rem;">${p.avatar || '🕺'}</span>
                                            <div>
                                                <strong style="color:#ffffff; font-size:0.92rem; display:block;">
                                                    ${escapeHTML(p.name)} ${isMe ? '<small style="color:var(--piu-cyan); font-weight:bold;">(Tú)</small>' : ''}
                                                </strong>
                                                <small style="color:var(--piu-cyan); font-family:var(--font-mono);">@${escapeHTML(p.username || 'gamertag')}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td style="padding:12px 16px;">
                                        <span class="badge badge-primary" style="font-size:0.75rem;">⭐ ${escapeHTML(p.skillLevel || 'Liga C')}</span>
                                    </td>
                                    <td style="padding:12px 16px; text-align:center; color:var(--color-neon-lime); font-weight:bold; font-size:1rem;">
                                        ${vs.wins}
                                    </td>
                                    <td style="padding:12px 16px; text-align:center; color:#FF5252; font-weight:bold; font-size:1rem;">
                                        ${vs.losses}
                                    </td>
                                    <td style="padding:12px 16px; text-align:center;">
                                        <span class="badge" style="background:${vs.winRate >= 50 ? 'rgba(104,242,5,0.15)' : 'rgba(255,184,0,0.15)'}; color:${vs.winRate >= 50 ? 'var(--color-neon-lime)' : 'var(--color-neon-gold)'}; font-weight:bold; font-size:0.75rem;">
                                            ${vs.winRate}%
                                        </span>
                                    </td>
                                    <td style="padding:12px 16px; text-align:right;">
                                        ${!isMe ? `
                                            <button class="btn btn-outline btn-xs btn-challenge-player" data-player-id="${p.id}" style="border-color:var(--color-neon-pink); color:var(--color-neon-pink); font-weight:bold;">
                                                ⚔️ Retar
                                            </button>
                                        ` : `
                                            <span style="font-size:0.75rem; color:var(--text-muted);">-</span>
                                        `}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    contentEl.querySelector('#select-leaderboard-league')?.addEventListener('change', (e) => {
        leagueFilter = e.target.value;
        renderLeaderboardTab(contentEl, allPlayers, currentUser, allBusinesses, userChallenges);
    });

    contentEl.querySelectorAll('.btn-challenge-player').forEach(btn => {
        btn.addEventListener('click', () => {
            const pid = btn.dataset.playerId;
            const target = allPlayers.find(p => p.id === pid);
            if (target && currentUser) {
                openMatchmakingModal({
                    allPlayers,
                    currentUser,
                    allBusinesses,
                    userChallenges,
                    preselectedPlayer: target
                });
            } else if (!currentUser) {
                toast.info("Inicia sesión para retar a este jugador.");
                openLoginModal();
            }
        });
    });
}

// =========================================================================
// RENDERIZADOR VISUAL DE HORARIOS EN TIEMPO REAL (SLOT MATRIX CON FILTRO DE MÁQUINA)
// =========================================================================
async function renderLiveSlotGrid({
    containerEl,
    businessId,
    machineId = null,
    date,
    durationMinutes,
    selectedStartTime,
    onSelectSlot
}) {
    if (!containerEl) return;

    containerEl.innerHTML = `
        <div style="text-align:center; padding:18px; color:var(--text-muted); font-size:0.85rem; background:rgba(0,0,0,0.2); border-radius:var(--radius-sm); border:1px dashed rgba(255,255,255,0.1);">
            <div style="display:inline-block; width:20px; height:20px; border:2px solid var(--color-neon-pink); border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-bottom:6px;"></div>
            <div>Consultando máquinas libres en tiempo real...</div>
        </div>
    `;

    try {
        const res = await challengeManager.getAvailableSlotsForBusiness({
            businessId,
            date,
            durationMinutes,
            intervalMinutes: 30,
            machineId
        });

        if (!res.isOpen) {
            containerEl.innerHTML = `
                <div style="background:rgba(255,82,82,0.1); border:1px solid #FF5252; padding:12px; border-radius:var(--radius-sm); text-align:center; color:#FF5252; font-size:0.85rem;">
                    ⚠️ ${res.error || 'La sucursal se encuentra cerrada en esta fecha.'}
                </div>
            `;
            onSelectSlot(null, null);
            return;
        }

        const slots = res.slots || [];
        const availableSlots = slots.filter(s => s.isAvailable);

        if (slots.length === 0 || availableSlots.length === 0) {
            containerEl.innerHTML = `
                <div style="background:rgba(255,184,0,0.1); border:1px solid var(--color-neon-gold); padding:12px; border-radius:var(--radius-sm); text-align:center; color:var(--color-neon-gold); font-size:0.85rem;">
                    ⚠️ No hay gabinetes con disponibilidad continua de <strong>${formatDuration(durationMinutes)}</strong> para esta fecha${machineId ? ' en la máquina seleccionada' : ''}.<br>
                    <small style="color:var(--text-muted); display:block; margin-top:4px;">
                        Selecciona otro día en el calendario, elige "Cualquier Máquina" o reduce la duración.
                    </small>
                </div>
            `;
            onSelectSlot(null, null);
            return;
        }

        // Si selectedStartTime fue proporcionado y existe en los slots disponibles, mantenerlo seleccionado
        let activeStart = selectedStartTime;
        if (activeStart && availableSlots.some(s => s.startTime === activeStart)) {
            const foundSlot = availableSlots.find(s => s.startTime === activeStart);
            onSelectSlot(activeStart, foundSlot.endTime);
        } else if (!activeStart || !availableSlots.some(s => s.startTime === activeStart)) {
            if (availableSlots.length > 0) {
                activeStart = availableSlots[0].startTime;
                const activeEnd = availableSlots[0].endTime;
                onSelectSlot(activeStart, activeEnd);
            } else {
                onSelectSlot(null, null);
            }
        }

        containerEl.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); flex-wrap:wrap; gap:6px;">
                    <span>🟢 <strong>${availableSlots.length}</strong> horarios libres (${formatDuration(durationMinutes)})</span>
                    <span style="display:flex; align-items:center; gap:6px;">
                        <span style="display:inline-flex; align-items:center; gap:3px;"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--color-neon-lime);"></span> Libre</span>
                        <span style="display:inline-flex; align-items:center; gap:3px;"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.2);"></span> Ocupado</span>
                    </span>
                </div>

                <div class="slot-grid-interactive" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(125px, 1fr)); gap:8px; max-height:210px; overflow-y:auto; padding-right:4px;">
                    ${slots.map(s => {
                        const isSelected = s.startTime === activeStart && s.isAvailable;
                        if (s.isAvailable) {
                            return `
                                <button type="button" class="btn-slot-picker ${isSelected ? 'active-slot' : ''}" data-start="${s.startTime}" data-end="${s.endTime}" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px 6px; border-radius:var(--radius-sm); cursor:pointer; transition:all 0.15s ease; background:${isSelected ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(255, 0, 85, 0.3) 100%)' : 'var(--bg-dark-700)'}; border:${isSelected ? '2px solid var(--color-neon-pink)' : '1px solid rgba(0, 240, 255, 0.2)'}; box-shadow:${isSelected ? '0 0 10px rgba(255,0,85,0.45)' : 'none'};">
                                    <strong style="color:${isSelected ? 'var(--color-neon-pink)' : '#ffffff'}; font-size:0.92rem; font-family:var(--font-mono); font-weight:800;">
                                        ${s.label}
                                    </strong>
                                    <small style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">
                                        a ${s.endLabel}
                                    </small>
                                    <span class="badge" style="background:${isSelected ? 'var(--color-neon-pink)' : 'rgba(104,242,5,0.15)'}; color:${isSelected ? '#ffffff' : 'var(--color-neon-lime)'}; font-size:0.62rem; padding:2px 6px; margin-top:4px; font-weight:700;">
                                        ${isSelected ? '✓ ELEGIDO' : `${s.freeCount} disp.`}
                                    </span>
                                </button>
                            `;
                        } else {
                            return `
                                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px 6px; border-radius:var(--radius-sm); background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.05); opacity:0.35; cursor:not-allowed;">
                                    <span style="color:var(--text-muted); font-size:0.85rem; font-family:var(--font-mono); text-decoration:line-through;">
                                        ${s.label}
                                    </span>
                                    <small style="font-size:0.65rem; color:#FF5252; margin-top:2px;">Ocupado</small>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            </div>
        `;

        containerEl.querySelectorAll('.btn-slot-picker').forEach(btn => {
            btn.addEventListener('click', () => {
                const sStart = btn.dataset.start;
                const sEnd = btn.dataset.end;
                onSelectSlot(sStart, sEnd);
                renderLiveSlotGrid({
                    containerEl,
                    businessId,
                    machineId,
                    date,
                    durationMinutes,
                    selectedStartTime: sStart,
                    onSelectSlot
                });
            });
        });

    } catch (err) {
        containerEl.innerHTML = `
            <div style="color:#FF5252; font-size:0.85rem; text-align:center; padding:10px;">
                Error consultando horarios: ${err.message}
            </div>
        `;
    }
}

// =========================================================================
// COMPONENTE EMBEBIDO EN 2 SECCIONES VERTICALES (CON SELECTOR DE MÁQUINA)
// =========================================================================
async function renderEmbeddedSchedulePicker({
    containerEl,
    businessId,
    initialMachineId = null,
    initialDate,
    initialDurationMinutes = 60,
    initialStartTime = null,
    onScheduleChange
}) {
    let selectedDate = initialDate || formatDateKey(new Date());
    let selectedMachineId = initialMachineId || null;
    let selectedMachineName = '';
    let selectedDurationMinutes = initialDurationMinutes;
    let selectedStartTime = initialStartTime;
    let selectedEndTime = null;

    const [initY, initM] = selectedDate.split('-').map(Number);
    let viewYear = initY;
    let viewMonth = initM - 1; // 0-indexed

    // Cargar info de máquinas disponibles en la sucursal
    let activeMachines = [];
    try {
        const initSlotsRes = await challengeManager.getAvailableSlotsForBusiness({
            businessId,
            date: selectedDate,
            durationMinutes: selectedDurationMinutes,
            machineId: null
        });
        activeMachines = initSlotsRes.activeMachines || [];
    } catch (e) {
        activeMachines = [];
    }

    function update() {
        if (!containerEl) return;

        const todayKey = formatDateKey(new Date());
        const monthDays = getMonthDays(viewYear, viewMonth);

        containerEl.innerHTML = `
            <div class="embedded-scheduler-vertical-wrapper" style="display:flex; flex-direction:column; gap:16px;">
                
                <!-- SECCIÓN 1: MINI-CALENDARIO VISUAL DE FECHA -->
                <div class="scheduler-calendar-card" style="background:var(--bg-dark-900); padding:16px; border-radius:var(--radius-md); border:1px solid rgba(0,240,255,0.25);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                        <span style="font-size:0.82rem; color:var(--piu-cyan); font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                            📅 1. Selecciona el Día
                        </span>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button type="button" class="btn btn-icon btn-outline btn-xs" id="btn-mini-prev-month" style="padding:4px 10px; font-size:0.85rem;">◀</button>
                            <strong style="color:#ffffff; font-size:0.92rem; text-transform:uppercase; font-family:var(--font-heading); min-width:140px; text-align:center;">
                                ${MONTH_NAMES[viewMonth]} ${viewYear}
                            </strong>
                            <button type="button" class="btn btn-icon btn-outline btn-xs" id="btn-mini-next-month" style="padding:4px 10px; font-size:0.85rem;">▶</button>
                        </div>
                    </div>

                    <!-- Días de la semana -->
                    <div style="display:grid; grid-template-columns:repeat(7, 1fr); text-align:center; font-size:0.75rem; color:var(--text-muted); font-weight:bold; margin-bottom:6px;">
                        <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
                    </div>

                    <!-- Cuadrícula de días -->
                    <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; text-align:center;">
                        ${monthDays.map(day => {
                            const isPast = day.dateKey < todayKey;
                            const isSelected = day.dateKey === selectedDate;
                            const isCurrMonth = day.isCurrentMonth;

                            if (isPast || !isCurrMonth) {
                                return `
                                    <div style="padding:8px 4px; font-size:0.8rem; color:var(--text-muted); opacity:${isCurrMonth ? 0.3 : 0.12}; border-radius:4px; cursor:not-allowed;">
                                        ${day.dayNumber}
                                    </div>
                                `;
                            }

                            return `
                                <button type="button" class="btn-mini-day ${isSelected ? 'active-day' : ''}" data-date="${day.dateKey}" style="padding:8px 4px; font-size:0.85rem; border-radius:var(--radius-sm); border:none; cursor:pointer; font-weight:${isSelected ? '900' : '600'}; background:${isSelected ? 'var(--color-neon-pink)' : 'var(--bg-dark-700)'}; color:#ffffff; box-shadow:${isSelected ? '0 0 10px var(--color-neon-pink)' : 'none'}; transition:all 0.15s ease;">
                                    ${day.dayNumber}
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <!-- Accesos Rápidos de Fecha -->
                    <div style="display:flex; gap:8px; margin-top:12px; justify-content:center; flex-wrap:wrap;">
                        <button type="button" class="btn btn-outline btn-xs btn-mini-quick-date" data-offset="0">📅 Hoy</button>
                        <button type="button" class="btn btn-outline btn-xs btn-mini-quick-date" data-offset="1">📅 Mañana</button>
                        <button type="button" class="btn btn-outline btn-xs btn-mini-quick-date" data-offset="2">📅 Pasado Mañana</button>
                    </div>
                </div>

                <!-- SECCIÓN 2: GABINETE, DURACIÓN Y MATRIZ DE HORARIOS LIBRES -->
                <div class="scheduler-slots-card" style="background:var(--bg-dark-900); padding:16px; border-radius:var(--radius-md); border:1px solid rgba(255,0,85,0.25);">
                    
                    <!-- SELECTOR DE MÁQUINA / GABINETE -->
                    <div style="margin-bottom:14px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <span style="font-size:0.78rem; color:var(--text-muted); text-transform:uppercase; font-weight:bold;">
                                🕹️ 2. Máquina / Gabinete (Opcional):
                            </span>
                            <span style="font-size:0.7rem; color:var(--piu-cyan);">
                                ${selectedMachineId ? 'Filtro específico activado' : 'Cualquier gabinete libre'}
                            </span>
                        </div>
                        <select id="select-mini-machine" class="cyber-select" style="width:100%; font-size:0.85rem; padding:7px 10px;">
                            <option value="" ${!selectedMachineId ? 'selected' : ''}>✨ Cualquier Gabinete Libre (${activeMachines.length} en total)</option>
                            ${activeMachines.map(m => `
                                <option value="${m.id}" ${m.id === selectedMachineId ? 'selected' : ''}>
                                    🕹️ ${escapeHTML(m.name)} (${escapeHTML(m.model || 'PIU')})
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Selector de Duración -->
                    <div style="margin-bottom:14px;">
                        <span style="font-size:0.78rem; color:var(--text-muted); text-transform:uppercase; font-weight:bold; display:block; margin-bottom:6px;">
                            ⏱️ 3. Duración del Encuentro:
                        </span>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(90px, 1fr)); gap:6px;">
                            <button type="button" class="btn btn-sm btn-mini-duration ${selectedDurationMinutes === 30 ? 'active btn-primary' : 'btn-outline'}" data-mins="30">30 min</button>
                            <button type="button" class="btn btn-sm btn-mini-duration ${selectedDurationMinutes === 60 ? 'active btn-primary' : 'btn-outline'}" data-mins="60">1 hora ★</button>
                            <button type="button" class="btn btn-sm btn-mini-duration ${selectedDurationMinutes === 90 ? 'active btn-primary' : 'btn-outline'}" data-mins="90">1.5 horas</button>
                            <button type="button" class="btn btn-sm btn-mini-duration ${selectedDurationMinutes === 120 ? 'active btn-primary' : 'btn-outline'}" data-mins="120">2 horas</button>
                        </div>
                    </div>

                    <!-- Horarios con Gabinetes Libres -->
                    <div>
                        <span style="font-size:0.82rem; color:var(--color-neon-lime); font-weight:800; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:8px;">
                            🟢 4. Horarios Disponibles (${selectedDate})
                        </span>
                        <div id="mini-live-slots-host"></div>
                    </div>

                </div>

            </div>
        `;

        // Listeners del Mini Calendario
        containerEl.querySelector('#btn-mini-prev-month')?.addEventListener('click', () => {
            if (viewMonth === 0) { viewMonth = 11; viewYear--; }
            else { viewMonth--; }
            update();
        });

        containerEl.querySelector('#btn-mini-next-month')?.addEventListener('click', () => {
            if (viewMonth === 11) { viewMonth = 0; viewYear++; }
            else { viewMonth++; }
            update();
        });

        containerEl.querySelectorAll('.btn-mini-day').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedDate = btn.dataset.date;
                selectedStartTime = null;
                selectedEndTime = null;
                update();
            });
        });

        containerEl.querySelectorAll('.btn-mini-quick-date').forEach(btn => {
            btn.addEventListener('click', () => {
                const offset = parseInt(btn.dataset.offset, 10);
                const targetD = new Date();
                targetD.setDate(targetD.getDate() + offset);
                selectedDate = formatDateKey(targetD);
                const [y, m] = selectedDate.split('-').map(Number);
                viewYear = y;
                viewMonth = m - 1;
                selectedStartTime = null;
                selectedEndTime = null;
                update();
            });
        });

        containerEl.querySelector('#select-mini-machine')?.addEventListener('change', (e) => {
            selectedMachineId = e.target.value || null;
            const machObj = activeMachines.find(m => m.id === selectedMachineId);
            selectedMachineName = machObj ? machObj.name : '';
            selectedStartTime = null;
            selectedEndTime = null;
            update();
        });

        containerEl.querySelectorAll('.btn-mini-duration').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedDurationMinutes = parseInt(btn.dataset.mins, 10);
                selectedStartTime = null;
                selectedEndTime = null;
                update();
            });
        });

        // Renderizar slots en tiempo real con filtro de máquina
        const slotsHost = containerEl.querySelector('#mini-live-slots-host');
        renderLiveSlotGrid({
            containerEl: slotsHost,
            businessId,
            machineId: selectedMachineId,
            date: selectedDate,
            durationMinutes: selectedDurationMinutes,
            selectedStartTime,
            onSelectSlot: (start, end) => {
                selectedStartTime = start;
                selectedEndTime = end;
                if (onScheduleChange) {
                    onScheduleChange({
                        date: selectedDate,
                        durationMinutes: selectedDurationMinutes,
                        startTime: selectedStartTime,
                        endTime: selectedEndTime,
                        machineId: selectedMachineId,
                        machineName: selectedMachineName
                    });
                }
            }
        });

        if (onScheduleChange) {
            onScheduleChange({
                date: selectedDate,
                durationMinutes: selectedDurationMinutes,
                startTime: selectedStartTime,
                endTime: selectedEndTime,
                machineId: selectedMachineId,
                machineName: selectedMachineName
            });
        }
    }

    update();
}

// =========================================================================
// MODAL DE MATCHMAKING & DESAFÍO (BUSCADOR + RIVALES RECIENTES + CONFIGURACIÓN)
// =========================================================================

export function openMatchmakingModal({
    allPlayers = [],
    currentUser,
    allBusinesses = [],
    userChallenges = [],
    preselectedPlayer = null,
    onChallengeSent = null
}) {
    if (!currentUser) {
        toast.info("Debes iniciar sesión para lanzar un reto.");
        openLoginModal();
        return;
    }

    // Extraer rivales recientes del historial de retos
    const recentOpponentsMap = new Map();
    userChallenges.forEach(c => {
        const other = c.challenger.id === currentUser.id ? c.opponent : c.challenger;
        if (other && other.id && other.id !== currentUser.id && !recentOpponentsMap.has(other.id)) {
            const fullPlayer = allPlayers.find(p => p.id === other.id) || other;
            recentOpponentsMap.set(other.id, fullPlayer);
        }
    });
    const recentOpponents = Array.from(recentOpponentsMap.values()).slice(0, 4);

    let selectedPlayer = preselectedPlayer;
    let currentStep = selectedPlayer ? 'step-configure' : 'step-search';
    let filterModalLeague = 'ALL';
    let modalSearchQuery = '';

    // Estado de configuración del encuentro
    let matchMode = 'SAME_LOCAL'; // 'SAME_LOCAL' o 'DIFFERENT_LOCALS'
    const todayStr = formatDateKey(new Date());
    let selectedDate = todayStr;
    let selectedDurationMinutes = 60;
    let selectedStartTime = null;
    let selectedEndTime = null;
    let selectedBusinessIdA = allBusinesses[0]?.id || null;
    let selectedMachineIdA = null;
    let selectedMachineNameA = '';

    function renderModalBody(modalElement) {
        const bodyEl = modalElement.querySelector('.modal-body');
        if (!bodyEl) return;

        if (currentStep === 'step-search') {
            // Filtrar lista de jugadores
            let filteredPlayers = allPlayers.filter(p => p.id !== currentUser.id);
            if (filterModalLeague !== 'ALL') {
                filteredPlayers = filteredPlayers.filter(p => (p.skillLevel || 'Liga C') === filterModalLeague);
            }
            if (modalSearchQuery.trim()) {
                const q = modalSearchQuery.toLowerCase().trim();
                filteredPlayers = filteredPlayers.filter(p => 
                    (p.name && p.name.toLowerCase().includes(q)) ||
                    (p.username && p.username.toLowerCase().includes(q)) ||
                    (p.piuGameId && p.piuGameId.toLowerCase().includes(q))
                );
            }

            bodyEl.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:16px;">
                    
                    <!-- 1. RIVALES RECIENTES (HISTORIAL DIRECTO) -->
                    ${recentOpponents.length > 0 ? `
                        <div style="background:var(--bg-dark-900); padding:12px; border-radius:var(--radius-sm); border:1px solid rgba(255,0,85,0.25);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="font-size:0.75rem; color:var(--color-neon-pink); font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                                    ⚡ Rivales Recientes (Revancha Rápida)
                                </span>
                            </div>
                            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px;">
                                ${recentOpponents.map(p => `
                                    <button type="button" class="btn btn-outline btn-xs btn-pick-recent" data-pid="${p.id}" style="display:flex; flex-direction:column; align-items:center; padding:8px 6px; gap:3px; text-align:center; border-color:rgba(255,255,255,0.15);">
                                        <span style="font-size:1.4rem;">${p.avatar || '🕺'}</span>
                                        <strong style="color:#ffffff; font-size:0.78rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">
                                            ${escapeHTML(p.name)}
                                        </strong>
                                        <span style="font-size:0.65rem; color:var(--piu-cyan);">⭐ ${escapeHTML(p.skillLevel || 'Liga C')}</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- 2. BUSCADOR PREDICTIVO EN VIVO -->
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <div style="position:relative; flex:1; min-width:200px;">
                            <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); opacity:0.6;">🔍</span>
                            <input type="text" id="modal-search-input" class="cyber-input" value="${escapeHTML(modalSearchQuery)}" placeholder="Buscar por nombre, @gamertag o PIU ID..." style="padding-left:36px; width:100%;">
                        </div>

                        <select id="modal-league-filter" class="cyber-select" style="min-width:130px;">
                            <option value="ALL" ${filterModalLeague === 'ALL' ? 'selected' : ''}>Todas</option>
                            <option value="Liga SSS" ${filterModalLeague === 'Liga SSS' ? 'selected' : ''}>Liga SSS</option>
                            <option value="Liga SS" ${filterModalLeague === 'Liga SS' ? 'selected' : ''}>Liga SS</option>
                            <option value="Liga S" ${filterModalLeague === 'Liga S' ? 'selected' : ''}>Liga S</option>
                            <option value="Liga A" ${filterModalLeague === 'Liga A' ? 'selected' : ''}>Liga A</option>
                            <option value="Liga B" ${filterModalLeague === 'Liga B' ? 'selected' : ''}>Liga B</option>
                            <option value="Liga C" ${filterModalLeague === 'Liga C' ? 'selected' : ''}>Liga C</option>
                            <option value="Liga D" ${filterModalLeague === 'Liga D' ? 'selected' : ''}>Liga D</option>
                        </select>
                    </div>

                    <!-- 3. LISTA SCROLLEABLE DE JUGADORES -->
                    <div style="max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;">
                        ${filteredPlayers.length === 0 ? `
                            <div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.85rem;">
                                🕹️ No se encontraron jugadores que coincidan con la búsqueda.
                            </div>
                        ` : filteredPlayers.map(p => {
                            const vs = p.versusStats || { wins: 0, losses: 0 };
                            return `
                                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-dark-700); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid rgba(255,255,255,0.06);">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <span style="font-size:1.6rem;">${p.avatar || '🕺'}</span>
                                        <div>
                                            <strong style="color:#ffffff; font-size:0.88rem; display:block;">${escapeHTML(p.name)}</strong>
                                            <div style="display:flex; gap:6px; align-items:center; margin-top:2px;">
                                                <small style="color:var(--piu-cyan); font-family:var(--font-mono); font-size:0.75rem;">@${escapeHTML(p.username || 'pumper')}</small>
                                                <span class="badge badge-primary" style="font-size:0.65rem;">⭐ ${escapeHTML(p.skillLevel || 'Liga C')}</span>
                                                <small style="color:var(--text-muted); font-size:0.7rem;">(${vs.wins}V - ${vs.losses}D)</small>
                                            </div>
                                        </div>
                                    </div>

                                    <button class="btn btn-outline btn-xs btn-select-opponent" data-pid="${p.id}" style="border-color:var(--color-neon-pink); color:var(--color-neon-pink); font-weight:bold;">
                                        ⚔️ Seleccionar
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div style="display:flex; justify-content:flex-end; border-top:1px solid var(--border-color); padding-top:12px;">
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">Cerrar</button>
                    </div>
                </div>
            `;

            // Listeners Step 1
            const searchInput = bodyEl.querySelector('#modal-search-input');
            searchInput?.addEventListener('input', (e) => {
                modalSearchQuery = e.target.value;
                renderModalBody(modalElement);
                const newInput = modalElement.querySelector('#modal-search-input');
                if (newInput) {
                    newInput.focus();
                    newInput.setSelectionRange(newInput.value.length, newInput.value.length);
                }
            });

            bodyEl.querySelector('#modal-league-filter')?.addEventListener('change', (e) => {
                filterModalLeague = e.target.value;
                renderModalBody(modalElement);
            });

            bodyEl.querySelectorAll('.btn-pick-recent, .btn-select-opponent').forEach(btn => {
                btn.addEventListener('click', () => {
                    const pid = btn.dataset.pid;
                    selectedPlayer = allPlayers.find(p => p.id === pid) || recentOpponents.find(p => p.id === pid);
                    if (selectedPlayer) {
                        currentStep = 'step-configure';
                        renderModalBody(modalElement);
                    }
                });
            });

            bodyEl.querySelector('#btn-cancel-modal')?.addEventListener('click', () => modal.close());

        } else if (currentStep === 'step-configure') {
            // STEP 2: CONFIGURACIÓN LIMPIA DEL RETO
            bodyEl.innerHTML = `
                <form id="form-send-challenge-interactive" class="cyber-form" style="display:flex; flex-direction:column; gap:16px;">
                    
                    <!-- HUD Versus -->
                    <div style="display:flex; justify-content:space-around; align-items:center; background:var(--bg-dark-900); padding:12px; border-radius:var(--radius-md); border:1px solid rgba(255,0,85,0.35);">
                        <div style="text-align:center;">
                            <div style="font-size:2rem;">${currentUser.avatar || '🕺'}</div>
                            <strong style="color:#ffffff; font-size:0.85rem; display:block;">${escapeHTML(currentUser.name)}</strong>
                            <span class="badge badge-primary" style="font-size:0.65rem;">⭐ ${escapeHTML(currentUser.skillLevel || 'Liga C')}</span>
                        </div>

                        <div style="text-align:center;">
                            <div style="font-size:1.6rem; font-weight:900; color:var(--color-neon-pink); font-family:var(--font-heading);">
                                VS
                            </div>
                            <button type="button" id="btn-change-rival" class="btn btn-outline btn-xs" style="font-size:0.68rem; margin-top:2px; padding:2px 6px;">
                                🔄 Cambiar
                            </button>
                        </div>

                        <div style="text-align:center;">
                            <div style="font-size:2rem;">${selectedPlayer.avatar || '🕺'}</div>
                            <strong style="color:#ffffff; font-size:0.85rem; display:block;">${escapeHTML(selectedPlayer.name)}</strong>
                            <span class="badge badge-primary" style="font-size:0.65rem;">⭐ ${escapeHTML(selectedPlayer.skillLevel || 'Liga C')}</span>
                        </div>
                    </div>

                    <!-- 1. MODALIDAD DEL ENCUENTRO -->
                    <div class="form-group">
                        <label><span class="neon-arrow">◆</span> 1. Modalidad de Encuentro Propuesta</label>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px; margin-top:6px;">
                            <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; background:${matchMode === 'SAME_LOCAL' ? 'rgba(0,240,255,0.1)' : 'var(--bg-dark-700)'}; padding:10px; border-radius:var(--radius-sm); border:${matchMode === 'SAME_LOCAL' ? '1px solid var(--piu-cyan)' : '1px solid var(--border-color)'};">
                                <input type="radio" name="match-mode-radio" value="SAME_LOCAL" ${matchMode === 'SAME_LOCAL' ? 'checked' : ''} style="margin-top:3px;">
                                <div>
                                    <strong style="color:#ffffff; font-size:0.85rem; display:block;">👥 Mismo Local (Presencial 2P)</strong>
                                    <small style="color:var(--text-muted); font-size:0.72rem;">Proponer jugar juntos en la misma sucursal.</small>
                                </div>
                            </label>

                            <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; background:${matchMode === 'DIFFERENT_LOCALS' ? 'rgba(255,0,85,0.1)' : 'var(--bg-dark-700)'}; padding:10px; border-radius:var(--radius-sm); border:${matchMode === 'DIFFERENT_LOCALS' ? '1px solid var(--color-neon-pink)' : '1px solid var(--border-color)'};">
                                <input type="radio" name="match-mode-radio" value="DIFFERENT_LOCALS" ${matchMode === 'DIFFERENT_LOCALS' ? 'checked' : ''} style="margin-top:3px;">
                                <div>
                                    <strong style="color:#ffffff; font-size:0.85rem; display:block;">⚡ Duelo Remoto Sincronizado</strong>
                                    <small style="color:var(--text-muted); font-size:0.72rem;">Tú juegas en tu sucursal y el oponente elegirá la suya.</small>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- 2. SUCURSAL DEL RETADOR (TU SUCURSAL) -->
                    <div class="form-group">
                        <label for="chal-biz-a">
                            <span class="neon-arrow">◆</span> 2. Tu Sucursal (Donde tú vas a jugar)
                        </label>
                        <select id="chal-biz-a" class="cyber-select" required>
                            ${allBusinesses.map(b => `
                                <option value="${b.id}" ${b.id === selectedBusinessIdA ? 'selected' : ''}>
                                    ${escapeHTML(b.name)} (${escapeHTML(b.city)})
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- 3. MINI-CALENDARIO Y HORARIOS (2 SECCIONES VERTICALES SEPARADAS) -->
                    <div class="form-group">
                        <label style="color:var(--piu-cyan); font-weight:800; font-size:0.85rem; margin-bottom:8px; display:block;">
                            <span class="neon-arrow">◆</span> 3. Elige Fecha, Máquina y Horario de Juego
                        </label>
                        
                        <div id="interactive-scheduler-container">
                            <!-- Se monta el componente renderEmbeddedSchedulePicker -->
                        </div>
                    </div>

                    <!-- 🎯 RESUMEN DEL RETO EN TIEMPO REAL -->
                    <div id="chal-live-summary" style="background:linear-gradient(135deg, rgba(0, 240, 255, 0.1) 0%, rgba(255, 0, 85, 0.1) 100%); padding:12px 14px; border-radius:var(--radius-sm); border:1px solid var(--border-color); font-size:0.85rem;">
                        <span style="color:var(--text-muted); display:block; font-size:0.72rem; text-transform:uppercase; font-weight:bold;">🎯 Resumen del Desafío:</span>
                        <strong style="color:#ffffff;">
                            ${selectedStartTime ? `📅 ${selectedDate} • ⏰ ${format12Hour(selectedStartTime)} a ${format12Hour(selectedEndTime)} (${selectedDurationMinutes} min)` : 'Selecciona un día y horario disponible arriba.'}
                        </strong>
                    </div>

                    <!-- Notas Opcionales -->
                    <div class="form-group">
                        <label for="chal-notes"><span class="neon-arrow">◆</span> Mensaje / Notas del Desafío (Opcional)</label>
                        <textarea id="chal-notes" class="cyber-textarea" rows="2" placeholder="Ej. ¿Nos echamos un set a 3 de 5 canciones?"></textarea>
                    </div>

                    <!-- Acciones -->
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
                        <button type="button" class="btn btn-outline btn-sm" id="btn-cancel-configure">Cancelar</button>
                        <button type="submit" class="btn btn-primary btn-sm glow-red" id="btn-submit-send">
                            <span>🚀 Enviar Desafío Oficial</span>
                        </button>
                    </div>
                </form>
            `;

            // Step 2 Listeners
            const form = bodyEl.querySelector('#form-send-challenge-interactive');
            const schedulerContainer = bodyEl.querySelector('#interactive-scheduler-container');
            const submitBtn = bodyEl.querySelector('#btn-submit-send');

            async function mountScheduler() {
                await renderEmbeddedSchedulePicker({
                    containerEl: schedulerContainer,
                    businessId: selectedBusinessIdA,
                    initialMachineId: selectedMachineIdA,
                    initialDate: selectedDate,
                    initialDurationMinutes: selectedDurationMinutes,
                    initialStartTime: selectedStartTime,
                    onScheduleChange: (state) => {
                        selectedDate = state.date;
                        selectedDurationMinutes = state.durationMinutes;
                        selectedStartTime = state.startTime;
                        selectedEndTime = state.endTime;
                        selectedMachineIdA = state.machineId || null;
                        selectedMachineNameA = state.machineName || '';
                        updateLiveSummary();
                    }
                });
            }

            function updateLiveSummary() {
                const summaryEl = bodyEl.querySelector('#chal-live-summary strong');
                if (summaryEl) {
                    if (selectedStartTime && selectedEndTime) {
                        const bizNameA = allBusinesses.find(b => b.id === selectedBusinessIdA)?.name || 'Tu Sucursal';
                        const machText = selectedMachineNameA ? ` • 🕹️ ${selectedMachineNameA}` : '';
                        const modeText = matchMode === 'DIFFERENT_LOCALS' 
                            ? `⚡ Duelo Remoto • 📍 Tu local: ${bizNameA}${machText}` 
                            : `👥 Mismo Local • 📍 ${bizNameA}${machText}`;

                        summaryEl.textContent = `📅 ${selectedDate} • ⏰ ${format12Hour(selectedStartTime)} a ${format12Hour(selectedEndTime)} (${selectedDurationMinutes} min) • ${modeText}`;
                        if (submitBtn) submitBtn.disabled = false;
                    } else {
                        summaryEl.textContent = 'Selecciona un día y horario libre en el mini-calendario.';
                        if (submitBtn) submitBtn.disabled = true;
                    }
                }
            }

            bodyEl.querySelectorAll('input[name="match-mode-radio"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    matchMode = e.target.value;
                    updateLiveSummary();
                });
            });

            bodyEl.querySelector('#chal-biz-a')?.addEventListener('change', (e) => {
                selectedBusinessIdA = e.target.value;
                selectedStartTime = null;
                selectedEndTime = null;
                selectedMachineIdA = null;
                selectedMachineNameA = '';
                mountScheduler();
            });

            bodyEl.querySelector('#btn-change-rival')?.addEventListener('click', () => {
                currentStep = 'step-search';
                renderModalBody(modalElement);
            });

            bodyEl.querySelector('#btn-cancel-configure')?.addEventListener('click', () => modal.close());

            mountScheduler();

            // Envío del reto
            form?.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!selectedStartTime || !selectedEndTime) {
                    toast.error("Por favor selecciona un horario libre en el mini-calendario.");
                    return;
                }

                const businessNameA = allBusinesses.find(b => b.id === selectedBusinessIdA)?.name || '';
                const notes = bodyEl.querySelector('#chal-notes').value;

                submitBtn.disabled = true;
                submitBtn.textContent = "Validando y enviando reto...";

                try {
                    await challengeManager.createChallenge({
                        challengerId: currentUser.id,
                        challengerName: currentUser.name,
                        challengerUsername: currentUser.username,
                        challengerAvatar: currentUser.avatar || '🕺',
                        challengerLeague: currentUser.skillLevel || 'Liga C',
                        opponentId: selectedPlayer.id,
                        opponentName: selectedPlayer.name,
                        opponentUsername: selectedPlayer.username,
                        opponentAvatar: selectedPlayer.avatar || '🕺',
                        opponentLeague: selectedPlayer.skillLevel || 'Liga C',
                        mode: matchMode,
                        date: selectedDate,
                        startTime: selectedStartTime,
                        endTime: selectedEndTime,
                        businessId: selectedBusinessIdA,
                        businessName: businessNameA,
                        machineId: selectedMachineIdA,
                        machineName: selectedMachineNameA,
                        notes
                    });

                    toast.success(`⚔️ ¡Desafío enviado a ${selectedPlayer.name}!`);
                    modal.close();
                    if (onChallengeSent) onChallengeSent();
                } catch (err) {
                    toast.error("Error enviando reto: " + err.message);
                    submitBtn.disabled = false;
                    submitBtn.textContent = "🚀 Enviar Desafío Oficial";
                }
            });
        }
    }

    const modalEl = modal.open({
        title: "⚔️ ARENA VERSUS • MATCHMAKING",
        icon: '⚔️',
        contentHtml: `<div class="matchmaking-container">Cargando...</div>`,
        maxWidth: '740px'
    });

    renderModalBody(modalEl);
}

/**
 * Modal de Aceptación de Reto: Resumen de confirmación directo con los términos pactados.
 */
export function openAcceptChallengeModal(challenge, currentUser, allBusinesses, onAccepted, onNeedCounterOffer) {
    const isRemote = challenge.mode === 'DIFFERENT_LOCALS';
    const bizA = allBusinesses.find(b => b.id === challenge.location?.businessId);
    const bizNameA = challenge.location?.businessName || bizA?.name || 'Local A';

    let bizB = allBusinesses.find(b => b.id === challenge.location?.businessIdB);
    let selectedBizIdB = challenge.location?.businessIdB || allBusinesses[0]?.id;
    let bizNameB = challenge.location?.businessNameB || bizB?.name || '';

    // Solo si es remoto y aún no se había elegido la sucursal B
    const needsBizBChoice = isRemote && !challenge.location?.businessIdB;

    const contentHtml = `
        <form id="form-accept-venue" class="cyber-form" style="display:flex; flex-direction:column; gap:16px;">
            <div style="background:var(--bg-dark-900); padding:16px; border-radius:var(--radius-sm); border-left:4px solid var(--color-neon-lime);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                    <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:bold;">
                        ⚔️ Confirmación de Reto PVP
                    </span>
                    <span class="badge ${isRemote ? 'badge-warning' : 'badge-primary'}" style="font-size:0.72rem; font-weight:bold;">
                        ${isRemote ? '⚡ Modo: Remoto / Online (2 Locales)' : '👥 Modo: Presencial (Mismo Local 2P)'}
                    </span>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin:10px 0;">
                    <div>
                        <span style="font-size:0.72rem; color:var(--text-muted); display:block;">📅 FECHA</span>
                        <strong style="color:#ffffff; font-size:0.95rem;">${challenge.schedule.date}</strong>
                    </div>
                    <div>
                        <span style="font-size:0.72rem; color:var(--text-muted); display:block;">⏰ HORARIO</span>
                        <strong style="color:var(--color-neon-lime); font-size:0.95rem;">
                            ${format12Hour(challenge.schedule.startTime)} - ${format12Hour(challenge.schedule.endTime)}
                        </strong>
                    </div>
                </div>

                <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.08);">
                    <span style="font-size:0.72rem; color:var(--text-muted); display:block;">📍 SEDES ACORDADAS:</span>
                    ${isRemote ? `
                        <div style="font-size:0.88rem; color:#ffffff; margin-top:2px;">
                            👤 <strong>Retador (${escapeHTML(challenge.challenger.name)})</strong>: <span style="color:var(--piu-cyan);">${escapeHTML(bizNameA)}</span>
                            ${challenge.location?.machineName ? `<small style="color:var(--text-muted);"> (🕹️ ${escapeHTML(challenge.location.machineName)})</small>` : ''}
                        </div>
                        ${!needsBizBChoice ? `
                            <div style="font-size:0.88rem; color:#ffffff; margin-top:2px;">
                                👤 <strong>Rival (${escapeHTML(challenge.opponent.name)})</strong>: <span style="color:var(--color-neon-gold);">${escapeHTML(bizNameB)}</span>
                                ${challenge.location?.machineNameB ? `<small style="color:var(--text-muted);"> (🕹️ ${escapeHTML(challenge.location.machineNameB)})</small>` : ''}
                            </div>
                        ` : ''}
                    ` : `
                        <div style="font-size:0.88rem; color:#ffffff; margin-top:2px;">
                            👥 <strong>Ambos jugadores</strong> en: <span style="color:var(--color-neon-lime);">${escapeHTML(bizNameA)}</span>
                            ${challenge.location?.machineName ? `<small style="color:var(--text-muted);"> (🕹️ ${escapeHTML(challenge.location.machineName)})</small>` : ''}
                        </div>
                    `}
                </div>
            </div>

            ${needsBizBChoice ? `
                <!-- Selector de Sucursal B solo si no estaba definida -->
                <div class="form-group">
                    <label for="accept-biz-b"><span class="neon-arrow">◆</span> Selecciona TU Sucursal para este duelo:</label>
                    <select id="accept-biz-b" class="cyber-select">
                        ${allBusinesses.map(b => `<option value="${b.id}" ${b.id === selectedBizIdB ? 'selected' : ''}>${escapeHTML(b.name)} (${escapeHTML(b.city)})</option>`).join('')}
                    </select>
                    <div id="accept-remote-check-status" style="margin-top:6px; font-size:0.8rem;"></div>
                </div>
            ` : ''}

            <div style="font-size:0.8rem; color:var(--text-muted); background:rgba(255,255,255,0.03); padding:10px; border-radius:var(--radius-sm);">
                ℹ️ Al confirmar, el sistema validará los horarios en tiempo real y generará automáticamente ${isRemote ? 'las <strong>2 reservaciones sincronizadas</strong> en cada sucursal' : 'la <strong>reservación compartida (2P)</strong> en el gabinete'}.
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-switch-to-counter" style="border-color:var(--color-neon-gold); color:var(--color-neon-gold);">
                    <span>🔄 Deseo Cambiar Horario / Local</span>
                </button>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="btn btn-outline btn-sm" id="btn-cancel-accept">Cancelar</button>
                    <button type="submit" class="btn btn-primary btn-sm glow-red" id="btn-submit-accept">
                        <span>⚡ Confirmar y Aceptar Reto</span>
                    </button>
                </div>
            </div>
        </form>
    `;

    const m = modal.open({
        title: `✔️ RESPONDER RETO DE ${challenge.challenger.name.toUpperCase()}`,
        icon: '✔️',
        contentHtml,
        maxWidth: '600px'
    });

    const form = m.querySelector('#form-accept-venue');
    const selectBizB = m.querySelector('#accept-biz-b');
    const statusBox = m.querySelector('#accept-remote-check-status');
    const submitBtn = m.querySelector('#btn-submit-accept');

    async function checkRemoteAvailability() {
        if (!needsBizBChoice || !selectBizB) return;

        const bIdB = selectBizB.value;
        if (statusBox) statusBox.innerHTML = `<span style="color:var(--text-muted);">⏳ Validando cupo en tu sucursal...</span>`;
        submitBtn.disabled = true;

        const checkB = await challengeManager.checkLocationAvailability({
            businessId: bIdB,
            date: challenge.schedule.date,
            startTime: challenge.schedule.startTime,
            endTime: challenge.schedule.endTime
        });

        if (checkB.available) {
            if (statusBox) statusBox.innerHTML = `<span style="color:var(--color-neon-lime); font-weight:bold;">🟢 ¡Gabinete disponible en tu sucursal a esa hora!</span>`;
            submitBtn.disabled = false;
        } else {
            if (statusBox) {
                statusBox.innerHTML = `
                    <div style="color:#FF5252; background:rgba(255,82,82,0.1); border:1px solid #FF5252; padding:8px 10px; border-radius:var(--radius-sm); margin-top:4px;">
                        ⚠️ ${escapeHTML(checkB.reason || 'Tu sucursal no tiene gabinetes libres a esa hora.')}<br>
                        <button type="button" id="btn-inline-counter-offer" class="btn btn-outline btn-xs" style="margin-top:6px; border-color:var(--color-neon-gold); color:var(--color-neon-gold);">
                            🔄 Proponer otro horario para ambos
                        </button>
                    </div>
                `;
                m.querySelector('#btn-inline-counter-offer')?.addEventListener('click', () => {
                    modal.close();
                    if (onNeedCounterOffer) onNeedCounterOffer();
                });
            }
            submitBtn.disabled = true;
        }
    }

    selectBizB?.addEventListener('change', () => {
        checkRemoteAvailability();
    });

    m.querySelector('#btn-cancel-accept')?.addEventListener('click', () => modal.close());

    m.querySelector('#btn-switch-to-counter')?.addEventListener('click', () => {
        modal.close();
        if (onNeedCounterOffer) onNeedCounterOffer();
    });

    if (needsBizBChoice) {
        checkRemoteAvailability();
    }

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = "Validando y agendando reservaciones...";

        try {
            if (!isRemote) {
                await challengeManager.acceptChallenge(challenge.id, currentUser, {
                    mode: 'SAME_LOCAL'
                });
            } else {
                const businessIdB = selectBizB ? selectBizB.value : (challenge.location?.businessIdB || selectedBizIdB);
                const businessNameB = allBusinesses.find(b => b.id === businessIdB)?.name || challenge.location?.businessNameB || '';
                await challengeManager.acceptChallenge(challenge.id, currentUser, {
                    mode: 'DIFFERENT_LOCALS',
                    businessIdB,
                    businessNameB
                });
            }

            toast.success("🟢 ¡Reto aceptado y reservaciones creadas con éxito!");
            modal.close();
            if (onAccepted) onAccepted();
        } catch (err) {
            toast.error(err.message || "Error al aceptar reto.");
            submitBtn.disabled = false;
            submitBtn.textContent = "⚡ Confirmar y Aceptar Reto";
        }
    });
}

/**
 * Modal para Contraproponer Horario o Local con Mini-Calendario y Horarios en 2 Secciones
 */
function openCounterOfferModal(challenge, currentUser, allBusinesses, parentContentEl) {
    const isChallenger = challenge.challenger?.id === currentUser?.id;
    const rival = isChallenger ? challenge.opponent : challenge.challenger;
    const todayStr = formatDateKey(new Date());

    let coDate = challenge.schedule?.date || todayStr;
    let coMode = challenge.mode || 'SAME_LOCAL';

    // Determinar la sucursal y máquina inicial según quién está abriendo el modal
    let coBusinessId;
    let coMachineId;
    let coMachineName = '';

    if (!isChallenger && coMode === 'DIFFERENT_LOCALS') {
        // Para el rival en duelo remoto, su local inicial es businessIdB
        coBusinessId = challenge.location?.businessIdB || allBusinesses[0]?.id;
        coMachineId = challenge.location?.machineIdB || null;
        coMachineName = challenge.location?.machineNameB || '';
    } else {
        coBusinessId = challenge.location?.businessId || allBusinesses[0]?.id;
        coMachineId = challenge.location?.machineId || null;
        coMachineName = challenge.location?.machineName || '';
    }

    let coStartTime = challenge.schedule?.startTime || null;
    let coEndTime = challenge.schedule?.endTime || null;

    // Calcular la duración original del reto para mantenerla por defecto
    let coDurationMinutes = 60;
    if (coStartTime && coEndTime) {
        const sMins = timeToMinutes(coStartTime);
        const eMins = timeToMinutes(coEndTime);
        if (sMins !== null && eMins !== null) {
            let diff = eMins - sMins;
            if (diff < 0) diff += 1440;
            if (diff > 0) coDurationMinutes = diff;
        }
    }

    const businessLabelText = () => {
        if (coMode === 'DIFFERENT_LOCALS') {
            return isChallenger 
                ? `2. Sucursal de ${escapeHTML(currentUser.name)} (Tu local de juego)` 
                : `2. Sucursal de ${escapeHTML(currentUser.name)} (Tu local de juego - Local B)`;
        }
        return `2. Sucursal de Encuentro (Donde jugarán ambos 2P juntos)`;
    };

    const contentHtml = `
        <form id="form-counter-offer" class="cyber-form" style="display:flex; flex-direction:column; gap:16px;">
            <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">
                Elige la modalidad, fecha, máquina y horario en el mini-calendario para enviar tu propuesta a <strong>${escapeHTML(rival.name)}</strong>.
            </p>

            <!-- Resumen Visual Reactivo del Reto -->
            <div id="co-context-box" style="background:var(--bg-dark-900); padding:12px; border-radius:var(--radius-sm); border:1px solid rgba(0,240,255,0.2);">
                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:bold; text-transform:uppercase;">📍 Contexto de las Sedes:</div>
                <div id="co-context-text" style="font-size:0.85rem; color:#fff; margin-top:4px; display:flex; flex-direction:column; gap:2px;"></div>
            </div>

            <!-- Modalidad Propuesta -->
            <div class="form-group">
                <label><span class="neon-arrow">◆</span> 1. Modalidad Propuesta</label>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px; margin-top:4px;">
                    <label style="display:flex; align-items:center; gap:8px; background:var(--bg-dark-700); padding:8px 10px; border-radius:var(--radius-sm); cursor:pointer;">
                        <input type="radio" name="co-mode-radio" value="SAME_LOCAL" ${coMode === 'SAME_LOCAL' ? 'checked' : ''}>
                        <span style="font-size:0.82rem; color:#fff;">👥 Presencial (Mismo Local 2P)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; background:var(--bg-dark-700); padding:8px 10px; border-radius:var(--radius-sm); cursor:pointer;">
                        <input type="radio" name="co-mode-radio" value="DIFFERENT_LOCALS" ${coMode === 'DIFFERENT_LOCALS' ? 'checked' : ''}>
                        <span style="font-size:0.82rem; color:#fff;">⚡ Remoto / Online (2 Locales)</span>
                    </label>
                </div>
            </div>

            <div class="form-group">
                <label id="lbl-co-business" for="co-business"><span class="neon-arrow">◆</span> <span id="txt-co-business-label">${businessLabelText()}</span></label>
                <select id="co-business" class="cyber-select">
                    ${allBusinesses.map(b => `
                        <option value="${b.id}" ${b.id === coBusinessId ? 'selected' : ''}>
                            ${escapeHTML(b.name)} (${escapeHTML(b.city)})
                        </option>
                    `).join('')}
                </select>
            </div>

            <!-- MINI-CALENDARIO Y HORARIOS (2 SECCIONES VERTICALES) -->
            <div class="form-group">
                <label style="color:var(--piu-cyan); font-weight:800; font-size:0.85rem; margin-bottom:8px; display:block;">
                    <span class="neon-arrow">◆</span> 3. Elige Nueva Fecha, Máquina y Horario
                </label>
                <div id="co-scheduler-container"></div>
            </div>

            <div class="form-group">
                <label for="co-notes"><span class="neon-arrow">◆</span> Motivo / Comentarios de la Contrapropuesta</label>
                <textarea id="co-notes" class="cyber-textarea" rows="2" placeholder="Ej. A esa hora no puedo por trabajo, ¿qué tal en este nuevo horario o sede?"></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-cancel-co">Cancelar</button>
                <button type="submit" class="btn btn-primary btn-sm glow-red" id="btn-submit-co">
                    <span>🔄 Enviar Contrapropuesta</span>
                </button>
            </div>
        </form>
    `;

    const m = modal.open({
        title: "🔄 CONTRAPROPONER HORARIO / LOCAL",
        icon: '🔄',
        contentHtml: contentHtml,
        maxWidth: '740px'
    });

    const schedulerHost = m.querySelector('#co-scheduler-container');
    const submitBtn = m.querySelector('#btn-submit-co');

    function updateContextBox() {
        const contextTextEl = m.querySelector('#co-context-text');
        if (!contextTextEl) return;
        if (coMode === 'DIFFERENT_LOCALS') {
            const myBranchName = allBusinesses.find(b => b.id === coBusinessId)?.name || 'Tu local';
            if (isChallenger) {
                contextTextEl.innerHTML = `
                    <div>👤 <strong>Tú (${escapeHTML(currentUser.name)})</strong> jugarás en: <strong style="color:var(--piu-cyan);">${escapeHTML(myBranchName)}</strong></div>
                    <div>👤 <strong>${escapeHTML(rival.name)} (Rival)</strong> jugará en: <strong style="color:var(--color-neon-gold);">${escapeHTML(challenge.location?.businessNameB || 'Su sucursal')}</strong></div>
                `;
            } else {
                contextTextEl.innerHTML = `
                    <div>👤 <strong>${escapeHTML(challenge.challenger.name)} (Retador)</strong> jugará en: <strong style="color:var(--piu-cyan);">${escapeHTML(challenge.location?.businessName || 'Local A')}</strong></div>
                    <div>👤 <strong>Tú (${escapeHTML(currentUser.name)})</strong> jugarás en: <strong style="color:var(--color-neon-gold);">${escapeHTML(myBranchName)}</strong></div>
                `;
            }
        } else {
            const proposedBranchName = allBusinesses.find(b => b.id === coBusinessId)?.name || 'Local propuesto';
            contextTextEl.innerHTML = `
                <div>👥 <strong>Ambos jugadores</strong> se reunirán cara a cara en: <strong style="color:var(--color-neon-lime);">${escapeHTML(proposedBranchName)}</strong></div>
                <small style="color:var(--text-muted); font-size:0.75rem;">(Puedes cambiar la sucursal arriba si deseas proponer otro punto de encuentro)</small>
            `;
        }
    }

    async function mountCoScheduler() {
        updateContextBox();
        await renderEmbeddedSchedulePicker({
            containerEl: schedulerHost,
            businessId: coBusinessId,
            initialMachineId: coMachineId,
            initialDate: coDate,
            initialDurationMinutes: coDurationMinutes,
            initialStartTime: coStartTime,
            onScheduleChange: (state) => {
                coDate = state.date;
                coDurationMinutes = state.durationMinutes;
                coStartTime = state.startTime;
                coEndTime = state.endTime;
                coMachineId = state.machineId || null;
                coMachineName = state.machineName || '';
                if (submitBtn) submitBtn.disabled = !state.startTime;
            }
        });
    }

    m.querySelectorAll('input[name="co-mode-radio"]').forEach(r => {
        r.addEventListener('change', (e) => {
            coMode = e.target.value;
            const labelEl = m.querySelector('#txt-co-business-label');
            if (labelEl) labelEl.textContent = businessLabelText();

            const selectEl = m.querySelector('#co-business');
            if (coMode === 'DIFFERENT_LOCALS' && !isChallenger) {
                coBusinessId = challenge.location?.businessIdB || allBusinesses[0]?.id;
            } else {
                coBusinessId = challenge.location?.businessId || allBusinesses[0]?.id;
            }
            if (selectEl) selectEl.value = coBusinessId;
            coStartTime = null;
            coEndTime = null;
            coMachineId = null;
            coMachineName = '';
            mountCoScheduler();
        });
    });

    m.querySelector('#co-business')?.addEventListener('change', (e) => {
        coBusinessId = e.target.value;
        coStartTime = null;
        coEndTime = null;
        coMachineId = null;
        coMachineName = '';
        mountCoScheduler();
    });

    m.querySelector('#btn-cancel-co')?.addEventListener('click', () => modal.close());

    mountCoScheduler();

    m.querySelector('#form-counter-offer')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!coStartTime || !coEndTime) {
            toast.error("Por favor selecciona un horario disponible en el mini-calendario.");
            return;
        }

        const newBusinessName = allBusinesses.find(b => b.id === coBusinessId)?.name || '';
        const counterNotes = m.querySelector('#co-notes').value;

        submitBtn.disabled = true;
        submitBtn.textContent = "Enviando contrapropuesta...";

        try {
            const payload = {
                newDate: coDate,
                newStartTime: coStartTime,
                newEndTime: coEndTime,
                newMode: coMode,
                counterNotes: counterNotes || ''
            };

            if (coMode === 'DIFFERENT_LOCALS') {
                if (!isChallenger) {
                    // El rival está enviando su propia sucursal B
                    payload.newBusinessIdB = coBusinessId;
                    payload.newBusinessNameB = newBusinessName;
                    payload.newMachineIdB = coMachineId || null;
                    payload.newMachineNameB = coMachineName || '';
                } else {
                    // El retador está enviando su propia sucursal A
                    payload.newBusinessId = coBusinessId;
                    payload.newBusinessName = newBusinessName;
                    payload.newMachineId = coMachineId || null;
                    payload.newMachineName = coMachineName || '';
                }
            } else {
                // SAME_LOCAL (Presencial)
                payload.newBusinessId = coBusinessId;
                payload.newBusinessName = newBusinessName;
                payload.newMachineId = coMachineId || null;
                payload.newMachineName = coMachineName || '';
            }

            await challengeManager.counterOfferChallenge(challenge.id, currentUser, payload);

            toast.success("🔄 Contrapropuesta enviada al rival.");
            modal.close();
            const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
            renderMyChallengesTab(parentContentEl, refreshed, currentUser, allBusinesses);
        } catch (err) {
            toast.error("Error: " + err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = "🔄 Enviar Contrapropuesta";
        }
    });
}

/**
 * Modal para Registrar Resultado del Encuentro
 */
function openReportResultModal(challenge, currentUser, parentContentEl) {
    const pA = challenge.challenger;
    const pB = challenge.opponent;

    const contentHtml = `
        <form id="form-report-result" class="cyber-form" style="display:flex; flex-direction:column; gap:16px;">
            <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">
                Captura el ganador y marcador del encuentro para actualizar el ranking oficial.
            </p>

            <div class="form-group">
                <label for="res-winner"><span class="neon-arrow">◆</span> Ganador de la Reta</label>
                <select id="res-winner" class="cyber-select" required>
                    <option value="${pA.id}">👑 Ganó ${escapeHTML(pA.name)}</option>
                    <option value="${pB.id}">👑 Ganó ${escapeHTML(pB.name)}</option>
                    <option value="DRAW">🤝 Empate / Duelo Amistoso</option>
                </select>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="res-score-a"><span class="neon-arrow">◆</span> Sets / Puntos ${escapeHTML(pA.name)}</label>
                    <input type="number" id="res-score-a" class="cyber-input" value="2" min="0" max="99" required>
                </div>
                <div class="form-group">
                    <label for="res-score-b"><span class="neon-arrow">◆</span> Sets / Puntos ${escapeHTML(pB.name)}</label>
                    <input type="number" id="res-score-b" class="cyber-input" value="1" min="0" max="99" required>
                </div>
            </div>

            <div class="form-group">
                <label for="res-songs"><span class="neon-arrow">◆</span> Canciones Jugadas (Opcional)</label>
                <input type="text" id="res-songs" class="cyber-input" placeholder="Ej. Canon D20, Vacuum S19, Beethoven Virus S21">
            </div>

            <div class="form-group">
                <label for="res-notes"><span class="neon-arrow">◆</span> Comentarios / Notas de la Reta</label>
                <textarea id="res-notes" class="cyber-textarea" rows="2" placeholder="Ej. Partida cerrada, decidida en la última canción."></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-cancel-res">Cancelar</button>
                <button type="submit" class="btn btn-primary btn-sm glow-red" id="btn-submit-res">
                    <span>🏆 Guardar Resultado Oficial</span>
                </button>
            </div>
        </form>
    `;

    const m = modal.open({
        title: "🏆 REGISTRAR RESULTADO DE RETA",
        icon: '🏆',
        contentHtml: contentHtml,
        maxWidth: '560px'
    });

    m.querySelector('#btn-cancel-res')?.addEventListener('click', () => modal.close());

    m.querySelector('#form-report-result')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const winnerChoice = m.querySelector('#res-winner').value;
        const isDraw = winnerChoice === 'DRAW';
        const winnerId = isDraw ? null : winnerChoice;
        const scoreA = m.querySelector('#res-score-a').value;
        const scoreB = m.querySelector('#res-score-b').value;
        const songsPlayed = m.querySelector('#res-songs').value;
        const matchNotes = m.querySelector('#res-notes').value;

        const btnSubmit = m.querySelector('#btn-submit-res');
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Guardando...";

        try {
            await challengeManager.reportMatchResult(challenge.id, currentUser, {
                winnerId,
                isDraw,
                scoreA,
                scoreB,
                songsPlayed,
                matchNotes
            });

            toast.success("🏆 ¡Resultado oficial registrado y ranking actualizado!");
            modal.close();
            const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
            renderMyChallengesTab(parentContentEl, refreshed, currentUser, tenantManager.getAllBusinesses());
        } catch (err) {
            toast.error("Error guardando resultado: " + err.message);
            btnSubmit.disabled = false;
            btnSubmit.textContent = "🏆 Guardar Resultado Oficial";
        }
    });
}
