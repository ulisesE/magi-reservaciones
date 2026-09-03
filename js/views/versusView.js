// js/views/versusView.js
// Vista de Arena Versus, Matchmaking PVP, Bandeja de Retos y Ranking de la Liga Potosina (v1.8.0)
import { challengeManager, CHALLENGE_STATUS, CHALLENGE_MODES, LIGA_ORDER } from '../core/challengeManager.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { escapeHTML } from '../core/securityUtils.js';
import { formatDateKey, format12Hour } from '../core/timeUtils.js';
import { openLoginModal } from '../components/header.js';

let activeTab = 'tab-challenge-player';
let leagueFilter = 'ALL';
let searchQuery = '';

export async function renderVersusView(container) {
    if (!container) return;

    const currentUser = authManager.getCurrentUser();
    const isClientUser = authManager.isClientUser();
    const isStaff = authManager.isStaff();
    const isSuperAdmin = authManager.isSuperAdmin();
    const activeBusiness = tenantManager.getActiveBusiness();
    const allBusinesses = tenantManager.getAllBusinesses();

    // Cargar retos asociados al usuario si está autenticado
    const userChallenges = currentUser ? await challengeManager.getChallengesForUser(currentUser.id) : [];
    const pendingCount = userChallenges.filter(c => 
        (c.status === CHALLENGE_STATUS.PENDING && c.turn === currentUser?.id) ||
        (c.status === CHALLENGE_STATUS.COUNTER_OFFERED && c.turn === currentUser?.id)
    ).length;

    // Cargar directorio de jugadores para el buscador y leaderboard
    let allPlayers = authManager.clientUsers || [];
    if (allPlayers.length === 0) {
        try {
            allPlayers = JSON.parse(localStorage.getItem('piu_registered_players_cache') || '[]');
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
                                <span class="badge" style="background:rgba(255,0,85,0.2); color:var(--color-neon-pink); border:1px solid var(--color-neon-pink); font-size:0.75rem; font-weight:800;">
                                    LIGA POTOSINA
                                </span>
                            </div>
                            <p style="color:var(--text-muted); font-size:0.88rem; margin:4px 0 0 0;">
                                Desafía a otros pumpers, pacta horarios en cualquier sucursal y escala en el ranking competitivo.
                            </p>
                        </div>
                    </div>

                    ${currentUser ? `
                        <div style="display:flex; align-items:center; gap:12px; background:var(--bg-dark-700); padding:8px 16px; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.1);">
                            <span style="font-size:1.8rem;">${currentUser.avatar || '🕺'}</span>
                            <div>
                                <strong style="color:#ffffff; font-size:0.9rem; display:block;">${currentUser.name}</strong>
                                <div style="display:flex; gap:6px; margin-top:2px;">
                                    <span class="badge badge-primary" style="font-size:0.7rem;">⭐ ${currentUser.skillLevel || 'Liga C'}</span>
                                    <span class="badge" style="background:rgba(104,242,5,0.15); color:var(--color-neon-lime); font-size:0.7rem; font-weight:700;">
                                        ${currentUser.versusStats?.wins || 0}V - ${currentUser.versusStats?.losses || 0}D
                                    </span>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <button id="btn-arena-login" class="btn btn-primary btn-sm glow-red">
                            <span>🔐 Iniciar Sesión para Retar</span>
                        </button>
                    `}
                </div>
            </div>

            <!-- Navegación de Pestañas de la Arena -->
            <div style="display:flex; gap:10px; border-bottom:1px solid var(--border-color); padding-bottom:8px; flex-wrap:wrap;">
                <button class="btn btn-sm btn-versus-tab ${activeTab === 'tab-challenge-player' ? 'active' : 'btn-outline'}" data-tab="tab-challenge-player" style="flex:1; min-width:200px;">
                    <span>⚔️ Desafiar Rival (Matchmaking)</span>
                </button>
                <button class="btn btn-sm btn-versus-tab ${activeTab === 'tab-my-challenges' ? 'active' : 'btn-outline'}" data-tab="tab-my-challenges" style="flex:1; min-width:200px; position:relative;">
                    <span>📥 Mis Retos Activos</span>
                    ${pendingCount > 0 ? `
                        <span style="background:var(--color-neon-pink); color:#fff; font-size:0.68rem; font-weight:bold; padding:2px 7px; border-radius:var(--radius-full); margin-left:6px; box-shadow:0 0 8px var(--color-neon-pink);">
                            ${pendingCount}
                        </span>
                    ` : ''}
                </button>
                <button class="btn btn-sm btn-versus-tab ${activeTab === 'tab-leaderboard' ? 'active' : 'btn-outline'}" data-tab="tab-leaderboard" style="flex:1; min-width:200px;">
                    <span>🏆 Ranking Liga Potosina</span>
                </button>
                <button class="btn btn-sm btn-versus-tab ${activeTab === 'tab-history' ? 'active' : 'btn-outline'}" data-tab="tab-history" style="flex:1; min-width:200px;">
                    <span>📜 Historial de Encuentros</span>
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
        btn.addEventListener('click', (e) => {
            activeTab = btn.dataset.tab;
            container.querySelectorAll('.btn-versus-tab').forEach(b => {
                b.classList.remove('active');
                b.classList.add('btn-outline');
            });
            btn.classList.add('active');
            btn.classList.remove('btn-outline');
            renderTabContent(container, allPlayers, userChallenges, currentUser, allBusinesses);
        });
    });

    container.querySelector('#btn-arena-login')?.addEventListener('click', () => {
        openLoginModal();
    });
}

function renderTabContent(container, allPlayers, userChallenges, currentUser, allBusinesses) {
    const contentEl = container.querySelector('#versus-tab-content');
    if (!contentEl) return;

    if (activeTab === 'tab-challenge-player') {
        renderMatchmakingTab(contentEl, allPlayers, currentUser, allBusinesses);
    } else if (activeTab === 'tab-my-challenges') {
        renderMyChallengesTab(contentEl, userChallenges, currentUser, allBusinesses);
    } else if (activeTab === 'tab-leaderboard') {
        renderLeaderboardTab(contentEl, allPlayers, currentUser, allBusinesses);
    } else if (activeTab === 'tab-history') {
        renderHistoryTab(contentEl, userChallenges, currentUser);
    }
}

// ==========================================
// SUBPESTAÑA 1: DESAFIAR RIVAL (MATCHMAKING)
// ==========================================
function renderMatchmakingTab(contentEl, allPlayers, currentUser, allBusinesses) {
    // Filtrar jugadores
    let filtered = [...allPlayers];
    if (currentUser) {
        // Excluir al propio usuario de la lista de rivales
        filtered = filtered.filter(p => p.id !== currentUser.id);
    }
    if (leagueFilter !== 'ALL') {
        filtered = filtered.filter(p => (p.skillLevel || 'Liga C') === leagueFilter);
    }
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(p => 
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.username && p.username.toLowerCase().includes(q)) ||
            (p.piuGameId && p.piuGameId.toLowerCase().includes(q))
        );
    }

    contentEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            <!-- Barra de Búsqueda y Filtros de Liga -->
            <div class="settings-card" style="padding:16px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between; background:var(--bg-dark-800);">
                <div style="display:flex; gap:10px; flex:1; min-width:280px;">
                    <div style="position:relative; flex:1;">
                        <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:1rem; opacity:0.6;">🔍</span>
                        <input type="text" id="input-versus-search" class="cyber-input" value="${escapeHTML(searchQuery)}" placeholder="Buscar rival por GamerTag, nombre o PIU ID (usuario#1234)..." style="padding-left:36px; width:100%;">
                    </div>
                </div>

                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <span style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">Filtrar Liga:</span>
                    <select id="select-league-filter" class="cyber-select" style="min-width:150px; font-size:0.85rem;">
                        <option value="ALL" ${leagueFilter === 'ALL' ? 'selected' : ''}>Todas las Ligas</option>
                        <option value="Liga SSS" ${leagueFilter === 'Liga SSS' ? 'selected' : ''}>⭐ Liga SSS (Élite)</option>
                        <option value="Liga SS" ${leagueFilter === 'Liga SS' ? 'selected' : ''}>⭐ Liga SS (Avanzado Pro)</option>
                        <option value="Liga S" ${leagueFilter === 'Liga S' ? 'selected' : ''}>⭐ Liga S (Avanzado)</option>
                        <option value="Liga A" ${leagueFilter === 'Liga A' ? 'selected' : ''}>⭐ Liga A (Intermedio Alto)</option>
                        <option value="Liga B" ${leagueFilter === 'Liga B' ? 'selected' : ''}>⭐ Liga B (Intermedio)</option>
                        <option value="Liga C" ${leagueFilter === 'Liga C' ? 'selected' : ''}>⭐ Liga C (Base)</option>
                        <option value="Liga D" ${leagueFilter === 'Liga D' ? 'selected' : ''}>⭐ Liga D (Novato)</option>
                    </select>
                </div>
            </div>

            <!-- Grid de Tarjetas Versus de Jugadores -->
            ${filtered.length === 0 ? `
                <div style="text-align:center; padding:40px; background:var(--bg-dark-800); border-radius:var(--radius-md); border:1px dashed var(--border-color);">
                    <div style="font-size:2.5rem; margin-bottom:8px;">🕹️</div>
                    <strong style="font-size:1.1rem; color:#fff;">No se encontraron oponentes</strong>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-top:4px;">Prueba ajustando el término de búsqueda o seleccionando "Todas las Ligas".</p>
                </div>
            ` : `
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
                    ${filtered.map(player => {
                        const vs = player.versusStats || { wins: 0, losses: 0, totalMatches: 0, winRate: 0 };
                        const league = player.skillLevel || 'Liga C';
                        return `
                            <div class="settings-card rival-card animate-fade-in" style="padding:16px; background:linear-gradient(135deg, var(--bg-dark-800) 0%, rgba(20,25,35,0.95) 100%); border:1px solid rgba(255,255,255,0.08); border-top:3px solid var(--piu-cyan); position:relative; overflow:hidden;">
                                <div style="display:flex; gap:14px; align-items:flex-start;">
                                    <div style="font-size:2.4rem; width:56px; height:56px; display:flex; align-items:center; justify-content:center; background:var(--bg-dark-700); border-radius:var(--radius-md); border:1px solid rgba(0, 240, 255, 0.3); flex-shrink:0;">
                                        ${player.avatar || '🕺'}
                                    </div>
                                    <div style="flex:1; min-width:0;">
                                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                                            <strong style="color:#ffffff; font-size:1.05rem; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                                ${escapeHTML(player.name)}
                                            </strong>
                                            <span class="badge badge-primary" style="font-size:0.7rem; flex-shrink:0;">
                                                ⭐ ${escapeHTML(league)}
                                            </span>
                                        </div>

                                        <div style="font-size:0.82rem; color:var(--piu-cyan); font-family:var(--font-mono); margin-top:1px;">
                                            @${escapeHTML(player.username || 'gamertag')}
                                        </div>

                                        ${player.piuGameId ? `
                                            <div style="margin-top:4px;">
                                                <span class="badge" style="background:rgba(104,242,5,0.12); color:var(--color-neon-lime); border:1px solid rgba(104,242,5,0.3); font-size:0.68rem; font-family:var(--font-mono);">
                                                    🎮 ${escapeHTML(player.piuGameId)}
                                                </span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>

                                <!-- Récord PVP del Jugador -->
                                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35); padding:8px 12px; border-radius:var(--radius-sm); margin:12px 0; border:1px solid rgba(255,255,255,0.05);">
                                    <div style="font-size:0.75rem; color:var(--text-muted);">
                                        Récord: <strong style="color:var(--color-neon-lime);">${vs.wins}V</strong> - <strong style="color:#FF5252;">${vs.losses}D</strong>
                                    </div>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">
                                        Efectividad: <strong style="color:${vs.winRate >= 50 ? 'var(--color-neon-lime)' : 'var(--color-neon-gold)'}; font-weight:bold;">${vs.winRate}%</strong>
                                    </div>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">
                                        Duelos: <strong style="color:#fff;">${vs.totalMatches}</strong>
                                    </div>
                                </div>

                                <!-- Botón de Retar -->
                                <button class="btn btn-primary btn-sm btn-challenge-player glow-red" data-player-id="${player.id}" style="width:100%; font-weight:800; border-radius:var(--radius-sm);">
                                    <span>⚔️ Desafiar a Reta Oficial</span>
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;

    // Eventos de búsqueda y filtro
    contentEl.querySelector('#input-versus-search')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderMatchmakingTab(contentEl, allPlayers, currentUser, allBusinesses);
    });

    contentEl.querySelector('#select-league-filter')?.addEventListener('change', (e) => {
        leagueFilter = e.target.value;
        renderMatchmakingTab(contentEl, allPlayers, currentUser, allBusinesses);
    });

    // Eventos de botones de reto
    contentEl.querySelectorAll('.btn-challenge-player').forEach(btn => {
        btn.addEventListener('click', () => {
            const pid = btn.dataset.playerId;
            const target = allPlayers.find(p => p.id === pid);
            if (!target) return;

            if (!currentUser) {
                toast.info("Inicia sesión como Jugador para enviar desafíos.");
                openLoginModal();
                return;
            }

            openSendChallengeModal(target, currentUser, allBusinesses);
        });
    });
}

// ==========================================
// SUBPESTAÑA 2: BANDEJA DE RETOS (MIS RETOS)
// ==========================================
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
                    ¡Ve a la pestaña de Matchmaking y reta a otros jugadores de tu liga!
                </p>
            </div>
        `;
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
                if (chal.status === CHALLENGE_STATUS.ACCEPTED) {
                    statusBadge = `<span class="badge badge-success" style="font-size:0.75rem;">🟢 Aceptado & Agendado</span>`;
                } else if (isMyTurn) {
                    statusBadge = `<span class="badge badge-warning pulse-glow" style="font-size:0.75rem;">⏳ ¡Es tu turno de responder!</span>`;
                } else {
                    statusBadge = `<span class="badge" style="background:rgba(255,255,255,0.1); color:var(--text-muted); font-size:0.75rem;">⌛ Esperando respuesta de ${escapeHTML(rival.name)}</span>`;
                }

                return `
                    <div class="settings-card animate-fade-in" style="padding:20px; background:var(--bg-dark-800); border:1px solid rgba(255,255,255,0.1); border-left:4px solid ${chal.status === CHALLENGE_STATUS.ACCEPTED ? 'var(--color-neon-lime)' : 'var(--color-neon-pink)'};">
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

                        <!-- Detalle de Horario y Lugar -->
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
                                <span style="font-size:0.72rem; color:var(--text-muted); display:block;">📍 SUCURSAL / LUGAR</span>
                                <strong style="color:var(--piu-cyan); font-size:0.9rem;">${escapeHTML(chal.location.businessName || chal.location.externalName || 'Local')}</strong>
                            </div>
                        </div>

                        ${chal.notes ? `
                            <div style="font-size:0.82rem; color:var(--text-secondary); background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:16px; border-left:2px solid var(--color-neon-gold);">
                                💬 <em>"${escapeHTML(chal.notes)}"</em>
                            </div>
                        ` : ''}

                        <!-- Botones de Acción -->
                        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; align-items:center;">
                            <!-- Botón WhatsApp -->
                            <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(`⚔️ ¡Reto de Pump It Up! Duelo ${chal.challenger.name} vs ${chal.opponent.name} para el ${chal.schedule.date} a las ${chal.schedule.startTime} en ${chal.location.businessName || chal.location.externalName}. ¡Acepta en la app!`)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="border-color:#25D366; color:#25D366;">
                                <span>📱 WhatsApp</span>
                            </a>

                            ${chal.status === CHALLENGE_STATUS.ACCEPTED ? `
                                <button class="btn btn-primary btn-sm btn-report-result glow-red" data-challenge-id="${chal.id}">
                                    <span>🏆 Capturar Resultado Final</span>
                                </button>
                            ` : ''}

                            ${(isMyTurn && (chal.status === CHALLENGE_STATUS.PENDING || chal.status === CHALLENGE_STATUS.COUNTER_OFFERED)) ? `
                                <button class="btn btn-danger btn-sm btn-reject-challenge" data-challenge-id="${chal.id}">
                                    <span>❌ Declinar</span>
                                </button>
                                <button class="btn btn-outline btn-sm btn-counter-offer" data-challenge-id="${chal.id}" style="border-color:var(--color-neon-gold); color:var(--color-neon-gold);">
                                    <span>🔄 Contraproponer Horario</span>
                                </button>
                                <button class="btn btn-primary btn-sm btn-accept-challenge glow-red" data-challenge-id="${chal.id}">
                                    <span>✔️ Aceptar Reto</span>
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

    // Asignar listeners
    contentEl.querySelectorAll('.btn-accept-challenge').forEach(btn => {
        btn.addEventListener('click', async () => {
            const cid = btn.dataset.challengeId;
            btn.disabled = true;
            btn.textContent = "Aceptando...";
            try {
                await challengeManager.acceptChallenge(cid, currentUser);
                toast.success("¡Reto aceptado con éxito! Reservación agendada en el sistema.");
                const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
                renderMyChallengesTab(contentEl, refreshed, currentUser, allBusinesses);
            } catch (err) {
                toast.error("Error al aceptar reto: " + err.message);
                btn.disabled = false;
                btn.textContent = "✔️ Aceptar Reto";
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

    contentEl.querySelectorAll('.btn-reject-challenge').forEach(btn => {
        btn.addEventListener('click', async () => {
            const cid = btn.dataset.challengeId;
            if (confirm("¿Estás seguro de declinar este reto?")) {
                try {
                    await challengeManager.rejectChallenge(cid, currentUser, "Declinado por el rival");
                    toast.info("Reto declinado.");
                    const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
                    renderMyChallengesTab(contentEl, refreshed, currentUser, allBusinesses);
                } catch (err) {
                    toast.error("Error al declinar: " + err.message);
                }
            }
        });
    });

    contentEl.querySelectorAll('.btn-cancel-challenge').forEach(btn => {
        btn.addEventListener('click', async () => {
            const cid = btn.dataset.challengeId;
            if (confirm("¿Deseas cancelar esta invitación enviada?")) {
                try {
                    await challengeManager.rejectChallenge(cid, currentUser, "Cancelado por el retador");
                    toast.info("Invitación cancelada.");
                    const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
                    renderMyChallengesTab(contentEl, refreshed, currentUser, allBusinesses);
                } catch (err) {
                    toast.error("Error: " + err.message);
                }
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

// ==========================================
// SUBPESTAÑA 3: RANKING & LEADERBOARD
// ==========================================
async function renderLeaderboardTab(contentEl, allPlayers, currentUser, allBusinesses) {
    const sortedLeaderboard = await challengeManager.getLeaderboard({ filterLeague: leagueFilter, allPlayers });

    contentEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="settings-card" style="padding:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:var(--bg-dark-800);">
                <div>
                    <h2 style="font-size:1.2rem; color:#fff; margin:0;">🏆 TABLA OFICIAL DE CLASIFICACIÓN</h2>
                    <small style="color:var(--text-muted); font-size:0.8rem;">Ordenado por Nivel de Liga Potosina y Récord de Victorias PVP</small>
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
                            <th style="padding:12px 16px;">Liga Potosina</th>
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
                                            <button class="btn btn-outline btn-xs btn-challenge-player" data-player-id="${p.id}" style="border-color:var(--color-neon-pink); color:var(--color-neon-pink);">
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
        renderLeaderboardTab(contentEl, allPlayers, currentUser, allBusinesses);
    });

    contentEl.querySelectorAll('.btn-challenge-player').forEach(btn => {
        btn.addEventListener('click', () => {
            const pid = btn.dataset.playerId;
            const target = allPlayers.find(p => p.id === pid);
            if (target && currentUser) {
                openSendChallengeModal(target, currentUser, allBusinesses);
            } else if (!currentUser) {
                toast.info("Inicia sesión para retar a este jugador.");
                openLoginModal();
            }
        });
    });
}

// ==========================================
// SUBPESTAÑA 4: HISTORIAL DE ENCUENTROS
// ==========================================
async function renderHistoryTab(contentEl, userChallenges, currentUser) {
    const allGlobalChallenges = await challengeManager.getGlobalChallenges(100);
    const completed = allGlobalChallenges.filter(c => c.status === CHALLENGE_STATUS.COMPLETED);

    contentEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="settings-card" style="padding:16px; background:var(--bg-dark-800);">
                <h2 style="font-size:1.2rem; color:#fff; margin:0;">📜 HISTORIAL DE DUELOS Y RESULTADOS</h2>
                <small style="color:var(--text-muted); font-size:0.8rem;">Registro cronológico de retas finalizadas en la comunidad</small>
            </div>

            ${completed.length === 0 ? `
                <div style="text-align:center; padding:40px; background:var(--bg-dark-800); border-radius:var(--radius-md); border:1px dashed var(--border-color);">
                    <div style="font-size:2.5rem; margin-bottom:8px;">📜</div>
                    <strong style="font-size:1.1rem; color:#fff;">Aún no hay resultados de duelos registrados</strong>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-top:4px;">Acepta un reto, juega la partida y captura el marcador para registrar la historia.</p>
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
}

// ==========================================
// MODALES INTERACTIVOS DE RETOS
// ==========================================

/**
 * Modal para Enviar un Nuevo Reto
 */
export function openSendChallengeModal(targetPlayer, currentUser, allBusinesses) {
    const todayStr = formatDateKey(new Date());

    const contentHtml = `
        <form id="form-send-challenge" class="cyber-form" style="display:flex; flex-direction:column; gap:16px;">
            <!-- Header del Duelo -->
            <div style="display:flex; justify-content:space-around; align-items:center; background:var(--bg-dark-900); padding:16px; border-radius:var(--radius-md); border:1px solid rgba(255,0,85,0.3);">
                <div style="text-align:center;">
                    <div style="font-size:2.2rem;">${currentUser.avatar || '🕺'}</div>
                    <strong style="color:#ffffff; font-size:0.9rem; display:block;">${escapeHTML(currentUser.name)}</strong>
                    <span class="badge badge-primary" style="font-size:0.68rem;">⭐ ${escapeHTML(currentUser.skillLevel || 'Liga C')}</span>
                </div>

                <div style="font-size:1.8rem; font-weight:900; color:var(--color-neon-pink); font-family:var(--font-heading);">
                    VS
                </div>

                <div style="text-align:center;">
                    <div style="font-size:2.2rem;">${targetPlayer.avatar || '🕺'}</div>
                    <strong style="color:#ffffff; font-size:0.9rem; display:block;">${escapeHTML(targetPlayer.name)}</strong>
                    <span class="badge badge-primary" style="font-size:0.68rem;">⭐ ${escapeHTML(targetPlayer.skillLevel || 'Liga C')}</span>
                </div>
            </div>

            <!-- Selección de Modalidad -->
            <div class="form-group">
                <label for="chal-mode"><span class="neon-arrow">◆</span> Modalidad del Encuentro</label>
                <select id="chal-mode" class="cyber-select" required>
                    <option value="SAME_LOCAL">👥 Versus Presencial (Mismo Local / Gabinete 2P)</option>
                    <option value="DIFFERENT_LOCALS">⚡ Duelo Remoto Sincronizado (Locales Distintos)</option>
                    <option value="EXTERNAL">📍 Local Externo / Libre (Pacto Amistoso)</option>
                </select>
            </div>

            <!-- Locales -->
            <div id="wrapper-single-local" class="form-group">
                <label for="chal-business"><span class="neon-arrow">◆</span> Sucursal para la Reta</label>
                <select id="chal-business" class="cyber-select">
                    ${allBusinesses.map(b => `<option value="${b.id}">${escapeHTML(b.name)} (${escapeHTML(b.city)})</option>`).join('')}
                </select>
            </div>

            <div id="wrapper-multi-local" class="form-row grid-2" style="display:none;">
                <div class="form-group">
                    <label for="chal-biz-a"><span class="neon-arrow">◆</span> Tu Sucursal</label>
                    <select id="chal-biz-a" class="cyber-select">
                        ${allBusinesses.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="chal-biz-b"><span class="neon-arrow">◆</span> Sucursal del Rival</label>
                    <select id="chal-biz-b" class="cyber-select">
                        ${allBusinesses.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div id="wrapper-external-local" class="form-group" style="display:none;">
                <label for="chal-external-name"><span class="neon-arrow">◆</span> Nombre del Local Externo / Plaza</label>
                <input type="text" id="chal-external-name" class="cyber-input" placeholder="Ej. Frikiplaza Centro, Plaza San Luis, Casa de Alex...">
            </div>

            <!-- Horarios -->
            <div class="form-row grid-3">
                <div class="form-group">
                    <label for="chal-date"><span class="neon-arrow">◆</span> Fecha</label>
                    <input type="date" id="chal-date" class="cyber-input" value="${todayStr}" min="${todayStr}" required>
                </div>
                <div class="form-group">
                    <label for="chal-start"><span class="neon-arrow">◆</span> Hora Inicio</label>
                    <input type="time" id="chal-start" class="cyber-input" value="18:00" required>
                </div>
                <div class="form-group">
                    <label for="chal-end"><span class="neon-arrow">◆</span> Hora Fin</label>
                    <input type="time" id="chal-end" class="cyber-input" value="19:00" required>
                </div>
            </div>

            <!-- Condiciones / Notas -->
            <div class="form-group">
                <label for="chal-notes"><span class="neon-arrow">◆</span> Condiciones / Notas del Reto (Opcional)</label>
                <textarea id="chal-notes" class="cyber-textarea" rows="2" placeholder="Ej. Retas en Phoenix D18-D22, el que pierda paga el refresco 🥤"></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-cancel-send">Cancelar</button>
                <button type="submit" class="btn btn-primary btn-sm glow-red" id="btn-submit-send">
                    <span>🚀 Enviar Desafío Oficial</span>
                </button>
            </div>
        </form>
    `;

    const m = modal.open({
        title: `⚔️ DESAFIAR A ${targetPlayer.name.toUpperCase()}`,
        content: contentHtml,
        size: 'medium'
    });

    const form = m.element.querySelector('#form-send-challenge');
    const modeSelect = m.element.querySelector('#chal-mode');
    const singleLocWrapper = m.element.querySelector('#wrapper-single-local');
    const multiLocWrapper = m.element.querySelector('#wrapper-multi-local');
    const extLocWrapper = m.element.querySelector('#wrapper-external-local');

    modeSelect?.addEventListener('change', () => {
        const mode = modeSelect.value;
        if (mode === 'SAME_LOCAL') {
            singleLocWrapper.style.display = 'block';
            multiLocWrapper.style.display = 'none';
            extLocWrapper.style.display = 'none';
        } else if (mode === 'DIFFERENT_LOCALS') {
            singleLocWrapper.style.display = 'none';
            multiLocWrapper.style.display = 'grid';
            extLocWrapper.style.display = 'none';
        } else {
            singleLocWrapper.style.display = 'none';
            multiLocWrapper.style.display = 'none';
            extLocWrapper.style.display = 'block';
        }
    });

    m.element.querySelector('#btn-cancel-send')?.addEventListener('click', () => m.close());

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mode = modeSelect.value;
        const date = m.element.querySelector('#chal-date').value;
        const startTime = m.element.querySelector('#chal-start').value;
        const endTime = m.element.querySelector('#chal-end').value;
        const notes = m.element.querySelector('#chal-notes').value;

        let businessId = null;
        let businessName = '';
        let businessIdB = null;
        let businessNameB = '';
        let isExternalLocation = mode === 'EXTERNAL';
        let externalLocationName = '';

        if (mode === 'SAME_LOCAL') {
            businessId = m.element.querySelector('#chal-business').value;
            businessName = allBusinesses.find(b => b.id === businessId)?.name || '';
        } else if (mode === 'DIFFERENT_LOCALS') {
            businessId = m.element.querySelector('#chal-biz-a').value;
            businessName = allBusinesses.find(b => b.id === businessId)?.name || '';
            businessIdB = m.element.querySelector('#chal-biz-b').value;
            businessNameB = allBusinesses.find(b => b.id === businessIdB)?.name || '';
        } else {
            externalLocationName = m.element.querySelector('#chal-external-name').value || 'Local Externo';
        }

        const submitBtn = m.element.querySelector('#btn-submit-send');
        submitBtn.disabled = true;
        submitBtn.textContent = "Enviando...";

        try {
            await challengeManager.createChallenge({
                challengerId: currentUser.id,
                challengerName: currentUser.name,
                challengerUsername: currentUser.username,
                challengerAvatar: currentUser.avatar || '🕺',
                challengerLeague: currentUser.skillLevel || 'Liga C',
                opponentId: targetPlayer.id,
                opponentName: targetPlayer.name,
                opponentUsername: targetPlayer.username,
                opponentAvatar: targetPlayer.avatar || '🕺',
                opponentLeague: targetPlayer.skillLevel || 'Liga C',
                mode,
                date,
                startTime,
                endTime,
                businessId,
                businessName,
                businessIdB,
                businessNameB,
                isExternalLocation,
                externalLocationName,
                notes
            });

            toast.success(`⚔️ ¡Desafío enviado a ${targetPlayer.name}!`);
            m.close();
        } catch (err) {
            toast.error("Error enviando reto: " + err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = "🚀 Enviar Desafío Oficial";
        }
    });
}

/**
 * Modal para Contraproponer Horario o Local
 */
function openCounterOfferModal(challenge, currentUser, allBusinesses, parentContentEl) {
    const todayStr = formatDateKey(new Date());

    const contentHtml = `
        <form id="form-counter-offer" class="cyber-form" style="display:flex; flex-direction:column; gap:16px;">
            <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">
                Modifica la fecha, horario o local para enviar tu contrapropuesta a <strong>${escapeHTML(challenge.challenger.name)}</strong>.
            </p>

            <div class="form-group">
                <label for="co-business"><span class="neon-arrow">◆</span> Sucursal Propuesta</label>
                <select id="co-business" class="cyber-select">
                    ${allBusinesses.map(b => `
                        <option value="${b.id}" ${challenge.location.businessId === b.id ? 'selected' : ''}>
                            ${escapeHTML(b.name)} (${escapeHTML(b.city)})
                        </option>
                    `).join('')}
                </select>
            </div>

            <div class="form-row grid-3">
                <div class="form-group">
                    <label for="co-date"><span class="neon-arrow">◆</span> Fecha</label>
                    <input type="date" id="co-date" class="cyber-input" value="${challenge.schedule.date}" min="${todayStr}" required>
                </div>
                <div class="form-group">
                    <label for="co-start"><span class="neon-arrow">◆</span> Hora Inicio</label>
                    <input type="time" id="co-start" class="cyber-input" value="${challenge.schedule.startTime}" required>
                </div>
                <div class="form-group">
                    <label for="co-end"><span class="neon-arrow">◆</span> Hora Fin</label>
                    <input type="time" id="co-end" class="cyber-input" value="${challenge.schedule.endTime}" required>
                </div>
            </div>

            <div class="form-group">
                <label for="co-notes"><span class="neon-arrow">◆</span> Motivo / Comentarios de la Contrapropuesta</label>
                <textarea id="co-notes" class="cyber-textarea" rows="2" placeholder="Ej. A esa hora no puedo por trabajo, ¿qué tal a las 7:30 PM?"></textarea>
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
        content: contentHtml,
        size: 'medium'
    });

    m.element.querySelector('#btn-cancel-co')?.addEventListener('click', () => m.close());

    m.element.querySelector('#form-counter-offer')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newDate = m.element.querySelector('#co-date').value;
        const newStartTime = m.element.querySelector('#co-start').value;
        const newEndTime = m.element.querySelector('#co-end').value;
        const newBusinessId = m.element.querySelector('#co-business').value;
        const newBusinessName = allBusinesses.find(b => b.id === newBusinessId)?.name || '';
        const counterNotes = m.element.querySelector('#co-notes').value;

        const btnSubmit = m.element.querySelector('#btn-submit-co');
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Enviando...";

        try {
            await challengeManager.counterOfferChallenge(challenge.id, currentUser, {
                newDate,
                newStartTime,
                newEndTime,
                newBusinessId,
                newBusinessName,
                counterNotes
            });

            toast.success("🔄 Contrapropuesta enviada al rival.");
            m.close();
            const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
            renderMyChallengesTab(parentContentEl, refreshed, currentUser, allBusinesses);
        } catch (err) {
            toast.error("Error: " + err.message);
            btnSubmit.disabled = false;
            btnSubmit.textContent = "🔄 Enviar Contrapropuesta";
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
        content: contentHtml,
        size: 'medium'
    });

    m.element.querySelector('#btn-cancel-res')?.addEventListener('click', () => m.close());

    m.element.querySelector('#form-report-result')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const winnerChoice = m.element.querySelector('#res-winner').value;
        const isDraw = winnerChoice === 'DRAW';
        const winnerId = isDraw ? null : winnerChoice;
        const scoreA = m.element.querySelector('#res-score-a').value;
        const scoreB = m.element.querySelector('#res-score-b').value;
        const songsPlayed = m.element.querySelector('#res-songs').value;
        const matchNotes = m.element.querySelector('#res-notes').value;

        const btnSubmit = m.element.querySelector('#btn-submit-res');
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
            m.close();
            const refreshed = await challengeManager.getChallengesForUser(currentUser.id);
            renderMyChallengesTab(parentContentEl, refreshed, currentUser, tenantManager.getAllBusinesses());
        } catch (err) {
            toast.error("Error guardando resultado: " + err.message);
            btnSubmit.disabled = false;
            btnSubmit.textContent = "🏆 Guardar Resultado Oficial";
        }
    });
}
