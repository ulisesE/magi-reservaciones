// js/views/clientsView.js
// Directorio Global de Clientes y Jugadores de la Plataforma
import { store } from '../core/store.js';
import { authManager } from '../core/authManager.js';
import { 
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    setDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    limit 
} from '../firebaseConfig.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { loyaltyManager } from '../core/loyaltyManager.js';

let currentClientsSearchQuery = '';

class ClientDirectoryManager {
    constructor() {
        this.clients = [];
    }

    async loadClients(searchQuery = '') {
        let loaded = [];
        const limitVal = 15;
        
        if (isFirebaseAvailable && db) {
            try {
                let q;
                if (searchQuery) {
                    const term = searchQuery.trim().toLowerCase();
                    const termPhone = term.replace(/\D/g, '');
                    if (termPhone) {
                        q = query(collection(db, COLLECTIONS.PLAYERS), where("phone", "==", termPhone), limit(limitVal));
                    } else {
                        q = query(collection(db, COLLECTIONS.PLAYERS), where("username", "==", term), limit(limitVal));
                    }
                    
                    let snap = await getDocs(q);
                    snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));

                    if (loaded.length === 0) {
                        // Prefijo de nombre
                        q = query(
                            collection(db, COLLECTIONS.PLAYERS), 
                            where("name", ">=", searchQuery), 
                            where("name", "<=", searchQuery + '\uf8ff'),
                            limit(limitVal)
                        );
                        snap = await getDocs(q);
                        snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
                    }
                } else {
                    q = query(collection(db, COLLECTIONS.PLAYERS), limit(limitVal));
                    const snap = await getDocs(q);
                    snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
                }
            } catch (e) {
                console.warn("Error cargando clientes de Firebase:", e);
            }
        }

        // Fallback local si Firebase no cargó nada
        if (loaded.length === 0) {
            const authPlayers = authManager.getClientUsers() || [];
            authPlayers.forEach(ap => {
                if (!loaded.some(l => l.id === ap.id || (l.username && l.username === ap.username))) {
                    loaded.push(ap);
                }
            });

            const local = localStorage.getItem('piu_registered_players_cache');
            if (local) {
                try {
                    const parsed = JSON.parse(local);
                    parsed.forEach(p => {
                        if (!loaded.some(l => l.id === p.id)) {
                            loaded.push(p);
                        }
                    });
                } catch (e) {}
            }
        }

        // Filtrar localmente si no hay Firebase
        if (searchQuery && (!isFirebaseAvailable || !db)) {
            const term = searchQuery.toLowerCase().trim();
            loaded = loaded.filter(c => 
                (c.name || '').toLowerCase().includes(term) ||
                (c.username || '').toLowerCase().includes(term) ||
                (c.phone || '').includes(term)
            );
        }

        this.clients = loaded;
        return this.clients;
    }

    saveLocally(clients) {
        localStorage.setItem('piu_registered_players_cache', JSON.stringify(clients));
    }

    async addClient(clientData) {
        const newClient = {
            id: 'usr_player_' + Date.now(),
            name: clientData.name.trim(),
            username: clientData.username?.trim() || 'player_' + Math.random().toString(36).substr(2, 5),
            pin: clientData.pin?.trim() || '1234',
            phone: clientData.phone?.trim() || '',
            email: clientData.email?.trim() || '',
            skillLevel: clientData.skillLevel || 'Liga C',
            preferredMode: clientData.preferredMode || 'Single / Double',
            notes: clientData.notes?.trim() || '',
            avatar: clientData.avatar || '🕺',
            role: 'CLIENT',
            loyaltyPoints: 0,
            loyaltyVisits: 0,
            loyaltyTier: 'Bronce',
            createdAt: new Date().toISOString()
        };

        this.clients.push(newClient);
        this.saveLocally(this.clients);

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.PLAYERS, newClient.id), newClient);
            } catch (e) {
                console.warn("Error guardando cliente en Firebase:", e);
            }
        }
        return newClient;
    }

    async updateClient(clientId, updatedFields) {
        const index = this.clients.findIndex(c => c.id === clientId);
        if (index === -1) return null;

        this.clients[index] = { ...this.clients[index], ...updatedFields };
        this.saveLocally(this.clients);

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.PLAYERS, clientId), updatedFields);
            } catch (e) {
                console.warn("Error actualizando cliente en Firebase:", e);
            }
        }
        return this.clients[index];
    }

    async deleteClient(clientId) {
        this.clients = this.clients.filter(c => c.id !== clientId);
        this.saveLocally(this.clients);

        if (isFirebaseAvailable && db) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.PLAYERS, clientId));
            } catch (e) {
                console.warn("Error borrando cliente en Firebase:", e);
            }
        }
        return true;
    }
}

export const clientDirManager = new ClientDirectoryManager();

export async function renderClientsView(container, queryVal = '') {
    currentClientsSearchQuery = queryVal;
    const business = store.currentBusiness;
    const clients = await clientDirManager.loadClients(currentClientsSearchQuery);
    const reservations = store.getReservations();
    const isSuperAdmin = authManager.isSuperAdmin();

    container.innerHTML = `
        <div class="clients-view-wrapper animate-fade-in">
            <!-- Header -->
            <div class="view-header-bar">
                <div class="header-left">
                    <h2 class="friendly-date-title">👥 Directorio Global de Jugadores PIU</h2>
                    <p class="subtitle-text">Comunidad de jugadores registrados, niveles de Ligas Potosinas y contacto directo</p>
                </div>
                ${isSuperAdmin ? `
                    <button class="btn btn-primary glow-red" id="btn-add-client">
                        <span>➕ Registrar Nuevo Jugador</span>
                    </button>
                ` : ''}
            </div>

            <!-- Buscador -->
            <div style="display:flex; gap:10px; margin-bottom:20px; max-width:600px;">
                <input type="text" id="input-search-clients" class="cyber-input" placeholder="🔍 Buscar por nombre, GamerTag o teléfono..." value="${currentClientsSearchQuery}" style="flex:1;">
                <button class="btn btn-secondary" id="btn-search-clients">Buscar</button>
                ${currentClientsSearchQuery ? `<button class="btn btn-outline" id="btn-clear-search">Limpiar</button>` : ''}
            </div>

            <!-- Grid de Clientes -->
            <div class="clients-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:18px;">
                ${clients.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <h3>No hay jugadores registrados en la plataforma</h3>
                        <p>Los jugadores pueden crear sus cuentas desde la pantalla principal o el Superadmin puede registrarlos.</p>
                    </div>
                ` : clients.map(c => {
                    const totalBookings = reservations.filter(r => (r.clientName || '').toLowerCase() === (c.name || '').toLowerCase()).length;
                    const cleanPhone = (c.phone || '').replace(/\D/g, '');
                    const waLink = cleanPhone ? `https://wa.me/52${cleanPhone}` : '#';
                    const tier = loyaltyManager.calculateTier(c.loyaltyPoints || 0);

                    return `
                        <div class="client-card settings-card" style="padding:18px; display:flex; flex-direction:column; gap:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div style="font-size:2rem; background:var(--bg-dark-700); width:46px; height:46px; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-sm);">
                                        ${c.avatar || '🕺'}
                                    </div>
                                    <div>
                                        <h3 style="font-size:1.15rem; margin:0; color:#ffffff;">${c.name}</h3>
                                        <div style="display:flex; gap:6px; align-items:center; margin-top:2px;">
                                            <span class="badge badge-primary" style="font-size:0.7rem;">${c.skillLevel || 'Liga C'}</span>
                                            ${c.username ? `<code style="font-size:0.68rem; color:var(--text-muted);">@${c.username}</code>` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div style="text-align:right;">
                                    <span class="badge badge-success" title="Total de reservaciones en esta sala">${totalBookings} Reservas</span>
                                </div>
                            </div>

                            <div style="background:var(--bg-dark-700); padding:10px 12px; border-radius:var(--radius-sm); font-size:0.85rem; display:flex; flex-direction:column; gap:6px;">
                                <div>
                                    <span style="color:var(--text-muted); font-weight:700;">📞 Teléfono:</span>
                                    <span style="color:#ffffff;">${c.phone || 'No registrado'}</span>
                                    ${cleanPhone ? `
                                        <a href="${waLink}" target="_blank" rel="noopener noreferrer" style="margin-left:6px; color:#25D366; font-weight:700;">
                                            💬 WhatsApp
                                        </a>
                                    ` : ''}
                                </div>
                                <div>
                                    <span style="color:var(--text-muted); font-weight:700;">✉️ Correo:</span>
                                    <span style="color:#ffffff;">${c.email || 'No registrado'}</span>
                                </div>
                                <div>
                                    <span style="color:var(--text-muted); font-weight:700;">🎮 Modo Preferido:</span>
                                    <span style="color:var(--piu-cyan);">${c.preferredMode || 'Single / Double'}</span>
                                </div>
                                ${business && business.loyaltyEnabled ? `
                                    <div style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:6px; margin-top:2px;">
                                        <span style="color:var(--text-muted); font-weight:700;">🎁 Lealtad:</span>
                                        <span class="badge ${tier.class}" style="font-size:0.72rem; padding: 2px 6px;">${tier.badge} ${tier.name}</span>
                                        <strong style="color:var(--color-neon-lime); margin-left:6px;">${c.loyaltyPoints || 0} Pts</strong>
                                        <span style="color:var(--text-secondary); margin-left:6px;">(${c.loyaltyVisits || 0} visitas)</span>
                                    </div>
                                ` : ''}
                            </div>

                            ${c.notes ? `
                                <div style="font-size:0.82rem; color:var(--text-muted); font-style:italic; background:rgba(0,229,255,0.05); padding:8px 10px; border-radius:4px; border-left:2px solid var(--piu-cyan);">
                                    "${c.notes}"
                                </div>
                            ` : ''}

                            <div style="display:flex; gap:8px; margin-top:auto; padding-top:8px; border-top:1px solid var(--border-color); flex-wrap:wrap;">
                                <button class="btn btn-outline btn-xs btn-edit-client" data-id="${c.id}" style="flex:1;">
                                    ✏️ Editar
                                </button>
                                ${business && business.loyaltyEnabled ? `
                                    <button class="btn btn-secondary btn-xs btn-adjust-loyalty" data-id="${c.id}" style="flex:1;">
                                        ⭐ Puntos
                                    </button>
                                    <button class="btn btn-outline btn-xs btn-view-redemptions" data-id="${c.id}" style="flex:1;" title="Validar premios canjeados de este jugador">
                                        🎁 Canjes
                                    </button>
                                ` : ''}
                                ${isSuperAdmin ? `
                                    <button class="btn btn-danger btn-xs btn-delete-client" data-id="${c.id}" title="Eliminar jugador">
                                        🗑️
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Eventos del buscador
    const searchInput = container.querySelector('#input-search-clients');
    const searchBtn = container.querySelector('#btn-search-clients');
    const clearBtn = container.querySelector('#btn-clear-search');

    const executeSearch = () => {
        renderClientsView(container, searchInput.value.trim());
    };

    searchBtn?.addEventListener('click', executeSearch);
    searchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });

    clearBtn?.addEventListener('click', () => {
        renderClientsView(container, '');
    });

    // Evento Registrar
    if (isSuperAdmin) {
        container.querySelector('#btn-add-client')?.addEventListener('click', () => {
            openClientFormModal(null, container);
        });

        container.querySelectorAll('.btn-delete-client').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (confirm("¿Estás seguro de eliminar este jugador del directorio global?")) {
                    await clientDirManager.deleteClient(id);
                    toast.info("Jugador eliminado del directorio.");
                    renderClientsView(container, currentClientsSearchQuery);
                }
            });
        });
    }

    // Eventos editar, ajustar y canjes
    container.querySelectorAll('.btn-edit-client').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const client = clients.find(c => c.id === id);
            if (client) openClientFormModal(client, container);
        });
    });

    container.querySelectorAll('.btn-adjust-loyalty').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const client = clients.find(c => c.id === id);
            if (client) openAdjustPointsModal(client, container);
        });
    });

    container.querySelectorAll('.btn-view-redemptions').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const client = clients.find(c => c.id === id);
            if (client) openClientRedemptionsModal(client, business.id, container);
        });
    });
}

export function openClientFormModal(client = null, mainContainer = null, onSavedCallback = null) {
    const isEdit = !!client;

    const contentHtml = `
        <form id="form-client-edit" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="cli-name"><span class="neon-arrow">◆</span> Nombre / GamerTag *</label>
                    <input type="text" id="cli-name" class="cyber-input" value="${client ? client.name : ''}" placeholder="Ej. Alex \"StepMaster\"" required>
                </div>
                <div class="form-group">
                    <label for="cli-phone"><span class="neon-arrow">◆</span> Teléfono / WhatsApp *</label>
                    <input type="tel" id="cli-phone" class="cyber-input" value="${client ? client.phone : ''}" placeholder="5512345678" required>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="cli-email"><span class="neon-arrow">◆</span> Correo Electrónico</label>
                    <input type="email" id="cli-email" class="cyber-input" value="${client ? (client.email || '') : ''}" placeholder="jugador@email.com">
                </div>
                <div class="form-group">
                    <label for="cli-level"><span class="neon-arrow">◆</span> Nivel / Liga (Ligas Potosinas)</label>
                    <select id="cli-level" class="cyber-select">
                        <option value="Liga D" ${client?.skillLevel === 'Liga D' ? 'selected' : ''}>Liga D</option>
                        <option value="Liga C" ${client?.skillLevel === 'Liga C' || !client?.skillLevel ? 'selected' : ''}>Liga C</option>
                        <option value="Liga B" ${client?.skillLevel === 'Liga B' ? 'selected' : ''}>Liga B</option>
                        <option value="Liga A" ${client?.skillLevel === 'Liga A' ? 'selected' : ''}>Liga A</option>
                        <option value="Liga S" ${client?.skillLevel === 'Liga S' ? 'selected' : ''}>Liga S</option>
                        <option value="Liga SS" ${client?.skillLevel === 'Liga SS' ? 'selected' : ''}>Liga SS</option>
                        <option value="Liga SSS" ${client?.skillLevel === 'Liga SSS' ? 'selected' : ''}>Liga SSS</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label for="cli-mode"><span class="neon-arrow">◆</span> Modo Preferido</label>
                <input type="text" id="cli-mode" class="cyber-input" value="${client ? (client.preferredMode || 'Single / Double') : 'Single / Double'}" placeholder="Ej. Single Speed, Doubles, Freestyle, Co-Op">
            </div>

            <div class="form-group">
                <label for="cli-notes"><span class="neon-arrow">◆</span> Notas de Calibración / Preferencias</label>
                <textarea id="cli-notes" class="cyber-textarea" rows="2" placeholder="Ej. Usa barra en canciones S20+, prefiere pantalla 120Hz...">${client ? (client.notes || '') : ''}</textarea>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-cli">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-cli">
            ${isEdit ? '💾 Guardar Cambios' : '➕ Registrar Jugador'}
        </button>
    `;

    const modalEl = modal.open({
        title: isEdit ? `Editar Perfil de Jugador: ${client.name}` : 'Registrar Nuevo Jugador',
        icon: '🕺',
        contentHtml,
        footerHtml,
        maxWidth: '540px'
    });

    modalEl.querySelector('#btn-cancel-cli').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-cli').onclick = async () => {
        const name = modalEl.querySelector('#cli-name').value.trim();
        const phone = modalEl.querySelector('#cli-phone').value.trim();
        const email = modalEl.querySelector('#cli-email').value.trim();
        const skillLevel = modalEl.querySelector('#cli-level').value;
        const preferredMode = modalEl.querySelector('#cli-mode').value.trim();
        const notes = modalEl.querySelector('#cli-notes').value.trim();

        if (!name || !phone) {
            toast.error("Por favor completa el nombre y teléfono del jugador.");
            return;
        }

        try {
            if (isEdit) {
                await clientDirManager.updateClient(client.id, {
                    name, phone, email, skillLevel, preferredMode, notes
                });
                toast.success(`Datos de "${name}" actualizados.`);
            } else {
                await clientDirManager.addClient({
                    name, phone, email, skillLevel, preferredMode, notes
                });
                toast.success(`Jugador "${name}" registrado en el catálogo global.`);
            }
            modal.close();
            if (onSavedCallback) onSavedCallback();
            if (mainContainer) renderClientsView(mainContainer, currentClientsSearchQuery);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

function openAdjustPointsModal(client, mainContainer) {
    const contentHtml = `
        <form id="form-adjust-loyalty" class="cyber-form">
            <p style="font-size:0.9rem; color:var(--text-secondary);">Ajustando puntos para <strong>${client.name}</strong> (@${client.username || 'gamertag'})</p>
            <div style="background:var(--bg-dark-700); padding:10px; border-radius:4px; margin-bottom:12px; font-size:0.85rem;">
                Puntos actuales: <strong style="color:var(--color-neon-lime);">${client.loyaltyPoints || 0} Pts</strong><br>
                Visitas actuales: <strong style="color:var(--piu-cyan);">${client.loyaltyVisits || 0}</strong>
            </div>
            
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="adj-points"><span class="neon-arrow">◆</span> Modificar Puntos (+/-)</label>
                    <input type="number" id="adj-points" class="cyber-input" value="0" placeholder="Ej. 20 o -10">
                </div>
                <div class="form-group">
                    <label for="adj-visits"><span class="neon-arrow">◆</span> Modificar Visitas (+/-)</label>
                    <input type="number" id="adj-visits" class="cyber-input" value="0" placeholder="Ej. 1 o -1">
                </div>
            </div>
            
            <div class="form-group">
                <label for="adj-reason"><span class="neon-arrow">◆</span> Motivo del Ajuste</label>
                <input type="text" id="adj-reason" class="cyber-input" placeholder="Ej. Participación en Torneo, Corrección, etc.">
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-adj">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-adj">💾 Guardar Ajuste</button>
    `;

    const modalEl = modal.open({
        title: 'Ajuste Manual de Puntos / Visitas',
        icon: '⭐',
        contentHtml,
        footerHtml,
        maxWidth: '460px'
    });

    modalEl.querySelector('#btn-cancel-adj').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-adj').onclick = async () => {
        const ptsChange = parseInt(modalEl.querySelector('#adj-points').value, 10) || 0;
        const vtsChange = parseInt(modalEl.querySelector('#adj-visits').value, 10) || 0;
        const reason = modalEl.querySelector('#adj-reason').value.trim();

        if (ptsChange === 0 && vtsChange === 0) {
            toast.warning("No ingresaste ningún cambio en los puntos ni visitas.");
            return;
        }

        try {
            await loyaltyManager.adjustPlayerPoints(client.id, ptsChange, vtsChange, reason);
            toast.success("Puntos/Visitas ajustados correctamente.");
            modal.close();
            renderClientsView(mainContainer, currentClientsSearchQuery);
        } catch (e) {
            toast.error(e.message);
        }
    };
}

async function openClientRedemptionsModal(client, businessId, mainContainer) {
    const redemptions = await loyaltyManager.getRedemptions(client.id);
    const bizRedemptions = redemptions.filter(r => r.businessId === businessId);

    const contentHtml = `
        <div class="client-redemptions-dialog" style="max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
            <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:10px;">Premios canjeados por <strong>${client.name}</strong> en este local:</p>
            
            ${bizRedemptions.length === 0 ? `
                <div class="empty-state" style="padding:20px; text-align:center;">
                    <p style="color:var(--text-muted); font-size:0.9rem;">El jugador no tiene premios solicitados o canjeados en este local.</p>
                </div>
            ` : bizRedemptions.map(r => {
                const isPending = r.status === 'PENDING';
                return `
                    <div style="background:var(--bg-dark-700); padding:12px; border-radius:4px; border:1px solid ${isPending ? 'var(--color-neon-lime)' : 'var(--border-color)'}; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <div style="text-align:left;">
                            <span style="font-size:1.3rem; margin-right:6px;">${r.rewardIcon || '🎁'}</span>
                            <strong style="color:#fff;">${r.rewardName}</strong>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                                Código: <code style="color:var(--piu-cyan); font-weight:bold; font-size:0.85rem;">${r.code}</code>
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">
                                Solicitado: ${new Date(r.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        <div>
                            ${isPending ? `
                                <button class="btn btn-success btn-xs btn-claim-voucher" data-red-id="${r.id}">
                                    ✔️ Entregar Premio
                                </button>
                            ` : `
                                <span class="badge badge-dark" style="color:var(--text-muted); font-size:0.75rem;">Entregado</span>
                            `}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-close-redemptions">Cerrar</button>
    `;

    const modalEl = modal.open({
        title: `Premios de ${client.name}`,
        icon: '🎁',
        contentHtml,
        footerHtml,
        maxWidth: '500px'
    });

    modalEl.querySelector('#btn-close-redemptions').onclick = () => modal.close();

    modalEl.querySelectorAll('.btn-claim-voucher').forEach(btn => {
        btn.onclick = async () => {
            const redId = btn.dataset.redId;
            try {
                await loyaltyManager.claimRedemption(redId, businessId);
                toast.success("¡Premio marcado como Entregado!");
                modal.close();
                openClientRedemptionsModal(client, businessId, mainContainer);
            } catch (e) {
                toast.error(e.message);
            }
        };
    });
}
