// js/views/clientsView.js
// Directorio Global de Clientes y Jugadores de la Plataforma
import { store } from '../core/store.js';
import { authManager } from '../core/authManager.js';
import { 
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDoc,
    getDocs,
    setDoc,
    doc,
    updateDoc,
    deleteDoc,
    query, 
    where, 
    limit,
    canMakeFirestoreRead,
    markQuotaExhausted 
} from '../firebaseConfig.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { loyaltyManager } from '../core/loyaltyManager.js';
import { accountManager } from '../core/accountManager.js';
import { openStatementModal, openQuickSaleModal, openPaymentModal as openAccountsPaymentModal } from './accountsView.js';
import { tenantManager } from '../core/tenantManager.js';
import { escapeHTML, hashPin } from '../core/securityUtils.js';

let currentClientsSearchQuery = '';
let currentClientsPage = 1;
const clientsPageSize = 15;

class ClientDirectoryManager {
    constructor() {
        this.clients = [];
        this.allClients = [];
        this._inFlightPromise = null;
    }

    async loadClients(searchQuery = '', forceRefresh = false) {
        if (!forceRefresh && this._inFlightPromise) {
            await this._inFlightPromise;
            return this.filterClients(searchQuery);
        }

        if (!forceRefresh && (this.allClients.length > 0 || (authManager.clientUsers && authManager.clientUsers.length > 0))) {
            if (this.allClients.length === 0 && authManager.clientUsers) {
                this.allClients = [...authManager.clientUsers];
            }
            return this.filterClients(searchQuery);
        }

        const fetchOperation = async () => {
            let loaded = [];

            // 1. PRIMERO: Si ya están en memoria en authManager o en this.allClients, usarlos (Zero-Read)
            if (!forceRefresh && authManager.clientUsers && authManager.clientUsers.length > 0) {
                loaded = [...authManager.clientUsers];
            } else if (!forceRefresh && this.allClients && this.allClients.length > 0) {
                loaded = [...this.allClients];
            } else {
                const local = localStorage.getItem('piu_registered_players_cache');
                if (local) {
                    try {
                        const parsed = JSON.parse(local);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            loaded = parsed;
                        }
                    } catch (e) {}
                }
            }
            
            // 2. SEGUNDO: Solo si no hay datos en memoria/local Y la cuota lo permite, consultar Firestore
            if (loaded.length === 0 && canMakeFirestoreRead()) {
                try {
                    const snap = await getDocs(collection(db, COLLECTIONS.PLAYERS));
                    for (const d of snap.docs) {
                        const data = d.data();
                        loaded.push({
                            id: d.id,
                            name: data.name || data.displayName || data.clientName || data.username || 'Jugador',
                            username: data.username || data.gamerTag || (data.name ? data.name.toLowerCase().replace(/\s+/g, '_') : ''),
                            piuGameId: data.piuGameId || data.piuId || '',
                            phone: data.phone || data.clientPhone || data.tel || '',
                            email: data.email || data.clientEmail || '',
                            authUid: data.authUid || (d.id.length > 20 && !d.id.startsWith('usr_') && !d.id.startsWith('p_') ? d.id : null),
                            pinHash: data.pinHash || null,
                            avatar: data.avatar || '🕺',
                            skillLevel: data.skillLevel || data.level || 'Liga C',
                            preferredMode: data.preferredMode || 'Single / Double',
                            notes: data.notes || '',
                            loyalty: data.loyalty || {},
                            accounts: data.accounts || {},
                            role: data.role || 'CLIENT',
                            ...data
                        });
                    }
                } catch (e) {
                    if (e?.code === 'resource-exhausted') markQuotaExhausted();
                    console.warn("Error cargando clientes de Firestore:", e);
                }
            }

            // Sincronizar memoria de authManager con los datos autoritativos
            if (authManager) {
                authManager.clientUsers = [...loaded];
            }

            // Guardar la lista autoritativa en caché y memoria
            this.allClients = [...loaded];
            this.saveLocally(this.allClients);
        };

        this._inFlightPromise = fetchOperation().finally(() => {
            this._inFlightPromise = null;
        });

        await this._inFlightPromise;
        return this.filterClients(searchQuery);
    }

    filterClients(searchQuery = '') {
        let result = [...this.allClients];
        if (searchQuery && searchQuery.trim()) {
            const term = searchQuery.toLowerCase().trim();
            const termClean = term.startsWith('@') ? term.substring(1) : term;
            const termPhone = term.replace(/\D/g, '');
            result = result.filter(c => {
                const name = (c.name || '').toLowerCase();
                const username = (c.username || '').toLowerCase();
                const piuGameId = (c.piuGameId || '').toLowerCase();
                const phone = (c.phone || '').replace(/\D/g, '');
                const email = (c.email || '').toLowerCase();
                const id = (c.id || '').toLowerCase();
                const authUid = (c.authUid || '').toLowerCase();
                const notes = (c.notes || '').toLowerCase();

                return name.includes(term) ||
                    username.includes(term) ||
                    username.includes(termClean) ||
                    piuGameId.includes(term) ||
                    piuGameId.replace(/#/g, '').includes(term.replace(/#/g, '')) ||
                    (termPhone && phone.includes(termPhone)) ||
                    email.includes(term) ||
                    id.includes(term) ||
                    authUid.includes(term) ||
                    notes.includes(term);
            });
        }

        this.clients = result;
        return this.clients;
    }

    saveLocally(clients) {
        localStorage.setItem('piu_registered_players_cache', JSON.stringify(clients));
    }

    async addClient(clientData) {
        const rawPin = clientData.pin?.trim() || '1234';
        const pinHash = await hashPin(rawPin);

        const newClient = {
            id: 'usr_player_' + Date.now(),
            name: clientData.name.trim(),
            username: clientData.username?.trim() || (clientData.name ? clientData.name.toLowerCase().replace(/\s+/g, '_') : 'player_' + Math.random().toString(36).substr(2, 5)),
            piuGameId: clientData.piuGameId?.trim() || '',
            pinHash,
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

        this.allClients = this.allClients ? [newClient, ...this.allClients] : [newClient];
        this.clients = [newClient, ...this.clients];
        this.saveLocally(this.allClients);

        if (authManager.clientUsers && !authManager.clientUsers.some(c => c.id === newClient.id)) {
            authManager.clientUsers.push(newClient);
        }

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
        if (index !== -1) {
            this.clients[index] = { ...this.clients[index], ...updatedFields };
        }
        const allIdx = this.allClients ? this.allClients.findIndex(c => c.id === clientId) : -1;
        if (allIdx !== -1) {
            this.allClients[allIdx] = { ...this.allClients[allIdx], ...updatedFields };
        }
        this.saveLocally(this.allClients || this.clients);

        if (authManager.clientUsers) {
            const authIdx = authManager.clientUsers.findIndex(c => c.id === clientId);
            if (authIdx !== -1) {
                authManager.clientUsers[authIdx] = { ...authManager.clientUsers[authIdx], ...updatedFields };
            }
        }

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.PLAYERS, clientId), updatedFields);
            } catch (e) {
                console.warn("Error actualizando cliente en Firebase:", e);
            }
        }
        return index !== -1 ? this.clients[index] : (allIdx !== -1 ? this.allClients[allIdx] : null);
    }

    async deleteClient(clientId) {
        this.clients = this.clients.filter(c => c.id !== clientId);
        this.allClients = this.allClients.filter(c => c.id !== clientId);
        this.saveLocally(this.allClients);

        if (authManager.clientUsers) {
            authManager.clientUsers = authManager.clientUsers.filter(c => c.id !== clientId);
        }

        if (isFirebaseAvailable && db) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.PLAYERS, clientId));
            } catch (e) {
                console.warn("Error borrando cliente en Firebase:", e);
            }
        }
        return true;
    }

    async purgeCorruptedClients() {
        let deletedCount = 0;
        const isMalicious = (str) => {
            if (!str) return false;
            const s = String(str).toLowerCase();
            return s.includes('<img') || s.includes('<script') || s.includes('onerror') || s.includes('javascript:') || s.includes('eval(') || s.includes('xsstest');
        };

        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDocs(collection(db, COLLECTIONS.PLAYERS));
                for (const d of snap.docs) {
                    const data = d.data();
                    if (isMalicious(d.id) || isMalicious(data.name) || isMalicious(data.username) || isMalicious(data.avatar) || isMalicious(data.notes)) {
                        await deleteDoc(doc(db, COLLECTIONS.PLAYERS, d.id));
                        deletedCount++;
                    }
                }
            } catch (e) {
                console.warn("Error purgando registros corruptos de Firebase:", e);
            }
        }

        this.allClients = (this.allClients || []).filter(c => !isMalicious(c.id) && !isMalicious(c.name) && !isMalicious(c.username) && !isMalicious(c.avatar));
        this.clients = (this.clients || []).filter(c => !isMalicious(c.id) && !isMalicious(c.name) && !isMalicious(c.username) && !isMalicious(c.avatar));
        this.saveLocally(this.allClients);
        if (authManager.clientUsers) {
            authManager.clientUsers = authManager.clientUsers.filter(c => !isMalicious(c.id) && !isMalicious(c.name) && !isMalicious(c.username) && !isMalicious(c.avatar));
        }

        return deletedCount;
    }
}

export const clientDirManager = new ClientDirectoryManager();

export async function renderClientsView(container, queryVal = '') {
    // Si la búsqueda cambia, reiniciar a página 1
    if (queryVal !== currentClientsSearchQuery) {
        currentClientsSearchQuery = queryVal;
        currentClientsPage = 1;
    }
    
    const business = store.currentBusiness;
    const allClients = await clientDirManager.loadClients(currentClientsSearchQuery);
    const reservations = store.getReservations();
    const isSuperAdmin = authManager.isSuperAdmin();

    const totalCount = allClients.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / clientsPageSize));
    if (currentClientsPage > totalPages) currentClientsPage = totalPages;

    const startIdx = (currentClientsPage - 1) * clientsPageSize;
    const pageClients = allClients.slice(startIdx, startIdx + clientsPageSize);

    container.innerHTML = `
        <div class="clients-view-wrapper animate-fade-in">
            <!-- Header -->
            <div class="view-header-bar">
                <div class="header-left">
                    <h2 class="friendly-date-title">👥 Directorio Global de Jugadores PIU</h2>
                    <p class="subtitle-text">Comunidad de jugadores registrados, niveles de Ligas Potosinas y contacto directo</p>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    ${isSuperAdmin ? `
                        <button class="btn btn-outline btn-sm" id="btn-purge-xss" style="border-color:var(--color-neon-gold); color:var(--color-neon-gold); font-size:0.8rem;" title="Eliminar registros residuales con inyecciones o etiquetas HTML">
                            <span>🧹 Purgar XSS</span>
                        </button>
                        <button class="btn btn-primary glow-red" id="btn-add-client">
                            <span>➕ Registrar Nuevo Jugador</span>
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Buscador -->
            <div style="display:flex; gap:10px; margin-bottom:20px; max-width:600px; flex-wrap:wrap;">
                <input type="text" id="input-search-clients" class="cyber-input" placeholder="🔍 Buscar por nombre, GamerTag o teléfono..." value="${escapeHTML(currentClientsSearchQuery)}" style="flex:1; min-width:200px;">
                <button class="btn btn-secondary" id="btn-search-clients">Buscar</button>
                <button class="btn btn-primary" id="btn-scan-client-qr" style="display:flex; align-items:center; gap:6px; background:var(--color-neon-lime); color:#000; font-weight:bold; border:none; box-shadow: 0 0 10px rgba(104,242,5,0.3);">
                    <span>📸 Escanear QR</span>
                </button>
                ${currentClientsSearchQuery ? `<button class="btn btn-outline" id="btn-clear-search">Limpiar</button>` : ''}
            </div>

            <!-- Grid de Clientes Consolidado -->
            <div class="clients-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(330px, 1fr)); gap:16px;">
                ${pageClients.length === 0 ? `
                    <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 48px;">
                        <div class="empty-icon" style="font-size:3rem; margin-bottom:12px;">👥</div>
                        <h3>No hay jugadores registrados en la plataforma</h3>
                        <p style="color:var(--text-secondary);">Los jugadores pueden crear sus cuentas desde la pantalla principal o el encargado/superadmin puede registrarlos.</p>
                    </div>
                ` : pageClients.map(c => {
                    const totalBookings = reservations.filter(r => (r.clientName || '').toLowerCase() === (c.name || '').toLowerCase()).length;
                    const cleanPhone = (c.phone || '').replace(/\D/g, '');
                    const waLink = cleanPhone ? `https://wa.me/52${cleanPhone}` : '#';
                    const activeMode = business ? business.loyaltyMode : 'POINTS';
                    const activeBusinessId = business ? business.id : '';
                    const bizLoyalty = (c.loyalty && activeBusinessId && c.loyalty[activeBusinessId]) ? c.loyalty[activeBusinessId] : { points: 0, visits: 0, tier: 'Bronce' };
                    const valueForTier = activeMode === 'VISITS' ? (bizLoyalty.visits || 0) : (bizLoyalty.points || 0);
                    const tier = loyaltyManager.calculateTier(valueForTier, activeMode);

                    const acct = (c.accounts && activeBusinessId && c.accounts[activeBusinessId]) ? c.accounts[activeBusinessId] : null;
                    const netDebt = acct ? (acct.netDebt || 0) : 0;
                    const credit = acct ? (acct.creditBalance || 0) : 0;
                    const isBlockedInBiz = tenantManager.isClientBlocked(business, c);

                    return `
                        <div class="gamer-pass-card">
                            <!-- Header de Identidad -->
                            <div class="gamer-card-header">
                                <div class="gamer-avatar-box">
                                    ${c.avatar || '🕺'}
                                </div>
                                <div class="gamer-identity">
                                    <h3 class="gamer-name-title" title="${escapeHTML(c.name)}">${escapeHTML(c.name)}</h3>
                                    <div class="gamer-meta-row">
                                        <span class="badge badge-primary" style="font-size:0.68rem; padding:1px 6px;">${escapeHTML(c.skillLevel || 'Liga C')}</span>
                                        ${(c.authUid || c.isAuthMigrated) ? `
                                            <span class="badge" style="background:rgba(104,242,5,0.15); color:var(--color-neon-lime); border:1px solid rgba(104,242,5,0.3); font-size:0.65rem; padding:1px 6px;" title="Cuenta canónica vinculada a Firebase Auth">🟢 Auth</span>
                                        ` : `
                                            <span class="badge" style="background:rgba(255,184,0,0.15); color:var(--color-neon-gold); border:1px solid rgba(255,184,0,0.3); font-size:0.65rem; padding:1px 6px;" title="Perfil clásico / PIN local">🟡 Clásico</span>
                                        `}
                                        ${isBlockedInBiz ? `
                                            <span class="badge badge-danger" style="background:rgba(255,0,85,0.2); color:var(--color-neon-red); border:1px solid var(--color-neon-red); font-size:0.65rem; padding:1px 6px;" title="Bloqueado para reservaciones en este local">🚫 Bloqueado en este local</span>
                                        ` : ''}
                                        ${c.username ? `<code style="font-size:0.7rem; color:var(--piu-cyan);">@${escapeHTML(c.username)}</code>` : ''}
                                        ${c.piuGameId ? `<span class="badge" style="background:rgba(0,229,255,0.12); color:var(--piu-cyan); border:1px solid rgba(0,229,255,0.3); font-size:0.65rem; padding:1px 6px;" title="PIU ID Oficial en piugame.com">🎮 ${escapeHTML(c.piuGameId)}</span>` : ''}
                                    </div>
                                </div>
                                ${cleanPhone ? `
                                    <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-outline" style="border-color:#25D366; color:#25D366; padding:4px 8px; font-size:0.75rem;" title="Enviar WhatsApp a ${escapeHTML(c.name)}">
                                        💬 WA
                                    </a>
                                ` : ''}
                            </div>

                            <!-- HUD de Métricas Clave (3 Columnas) -->
                            <div class="gamer-hud-grid">
                                <div class="gamer-hud-cell">
                                    <span class="gamer-hud-label">💳 Saldo</span>
                                    <span class="gamer-hud-value ${netDebt > 0 && credit > 0 ? '' : (netDebt > 0 ? 'has-debt' : (credit > 0 ? 'has-credit' : ''))}" style="${netDebt > 0 && credit > 0 ? 'color:var(--color-neon-gold); font-size:0.75rem;' : ''}" title="${netDebt > 0 && credit > 0 ? `Deuda fiada: $${netDebt.toFixed(2)} | Saldo a favor: $${credit.toFixed(2)}` : ''}">
                                        ${netDebt > 0 && credit > 0 ? `-$${netDebt.toFixed(2)} / +$${credit.toFixed(2)}` : (netDebt > 0 ? `-$${netDebt.toFixed(2)}` : (credit > 0 ? `+$${credit.toFixed(2)}` : `$0.00`))}
                                    </span>
                                </div>
                                <div class="gamer-hud-cell">
                                    <span class="gamer-hud-label">🎁 Lealtad</span>
                                    <span class="gamer-hud-value" style="color:var(--color-neon-lime);">
                                        ${activeMode === 'VISITS' ? `${bizLoyalty.visits || 0} Visitas` : `${bizLoyalty.points || 0} Pts`}
                                    </span>
                                </div>
                                <div class="gamer-hud-cell">
                                    <span class="gamer-hud-label">🕹️ Reservas</span>
                                    <span class="gamer-hud-value" style="color:var(--piu-cyan);">
                                        ${totalBookings}
                                    </span>
                                </div>
                            </div>

                            <!-- Tira de Información Rápida -->
                            <div class="gamer-info-strip">
                                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="Teléfono">
                                    📞 ${escapeHTML(c.phone || 'Sin teléfono')}
                                </span>
                                <span style="color:var(--text-muted); font-size:0.72rem;">
                                    🎮 ${escapeHTML(c.preferredMode || 'Single/Double')}
                                </span>
                            </div>

                            ${c.notes ? `
                                <div style="font-size:0.78rem; color:var(--text-muted); font-style:italic; background:rgba(0,229,255,0.04); padding:4px 8px; border-radius:4px; border-left:2px solid var(--piu-cyan); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHTML(c.notes)}">
                                    "${escapeHTML(c.notes)}"
                                </div>
                            ` : ''}

                            <!-- Fila Principal de Acciones (Cuenta del Jugador) -->
                            <div class="gamer-action-row">
                                <button class="btn btn-outline btn-xs btn-open-account" data-id="${escapeHTML(c.id)}" style="border-color:var(--piu-cyan); color:var(--piu-cyan); font-weight:700; padding:8px 12px; font-size:0.82rem; width:100%; display:flex; align-items:center; justify-content:center; gap:6px;" title="Ver estado de cuenta, historial y abonos">
                                    <span>💳 Estado de Cuenta</span>
                                </button>
                            </div>

                            <!-- Barra de Herramientas de Gestión -->
                            <div class="gamer-toolbar-row">
                                <button class="btn btn-outline btn-xs btn-edit-client" data-id="${escapeHTML(c.id)}" title="Editar perfil y restablecer PIN" style="font-size:0.75rem; padding:3px 8px;">
                                    ✏️ Editar
                                </button>
                                ${business ? `
                                    ${isBlockedInBiz ? `
                                        <button class="btn btn-xs btn-cyber-unblock btn-unblock-client" data-id="${escapeHTML(c.id)}" data-name="${escapeHTML(c.name)}" style="font-size:0.75rem; padding:3px 9px;" title="Desbloquear jugador para permitirle volver a reservar en esta sucursal">
                                            <span>🔓 Desbloquear</span>
                                        </button>
                                    ` : `
                                        <button class="btn btn-xs btn-cyber-block btn-block-client" data-id="${escapeHTML(c.id)}" data-name="${escapeHTML(c.name)}" data-username="${escapeHTML(c.username || '')}" data-phone="${escapeHTML(c.phone || '')}" style="font-size:0.75rem; padding:3px 9px;" title="Bloquear usuario para que no pueda reservar en esta sucursal">
                                            <span>🚫 Bloquear</span>
                                        </button>
                                    `}
                                ` : ''}
                                ${business && business.loyaltyEnabled ? `
                                    ${activeMode === 'VISITS' ? `
                                        <button class="btn btn-success btn-xs btn-quick-visit" data-id="${escapeHTML(c.id)}" style="background:rgba(104,242,5,0.12); color:var(--color-neon-lime); border:1px solid var(--color-neon-lime); font-size:0.75rem; padding:3px 8px;" title="Registrar 1 visita al instante">
                                            ➕ Visita
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-secondary btn-xs btn-adjust-loyalty" data-id="${escapeHTML(c.id)}" title="Ajustar puntos de lealtad" style="font-size:0.75rem; padding:3px 8px;">
                                        ⭐ Puntos
                                    </button>
                                    <button class="btn btn-outline btn-xs btn-view-redemptions" data-id="${escapeHTML(c.id)}" title="Validar premios canjeados" style="font-size:0.75rem; padding:3px 8px;">
                                        🎁 Canjes
                                    </button>
                                ` : ''}
                                ${isSuperAdmin ? `
                                    <button class="btn btn-danger btn-xs btn-delete-client" data-id="${escapeHTML(c.id)}" title="Eliminar jugador del sistema" style="padding:3px 6px; font-size:0.75rem;">
                                        🗑️
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Controles de Paginación -->
            <div class="clients-pagination" style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding:12px 0; border-top:1px solid var(--border-color);">
                <div style="font-size:0.85rem; color:var(--text-muted);">
                    Jugadores <strong style="color:#ffffff;">${totalCount > 0 ? startIdx + 1 : 0}</strong> - <strong style="color:#ffffff;">${Math.min(startIdx + pageClients.length, totalCount)}</strong> de <strong style="color:#ffffff;">${totalCount}</strong>
                </div>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="btn btn-outline btn-sm" id="btn-prev-clients-page" style="padding:6px 16px; font-size:0.8rem;" ${currentClientsPage === 1 ? 'disabled' : ''}>◀ Anterior</button>
                    <button type="button" class="btn btn-outline btn-sm" id="btn-next-clients-page" style="padding:6px 16px; font-size:0.8rem;" ${currentClientsPage === totalPages ? 'disabled' : ''}>Siguiente ▶</button>
                </div>
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

    // Escáner de QR por cámara
    container.querySelector('#btn-scan-client-qr')?.addEventListener('click', () => {
        const scannerId = "qr-reader-element";
        modal.open({
            title: 'Escanear Código QR de Jugador',
            icon: '📷',
            contentHtml: `
                <div style="text-align:center; padding:10px;">
                    <p style="margin-bottom:16px; font-size:0.9rem; color:var(--text-secondary);">Apunta la cámara de tu dispositivo hacia el QR del pase del jugador:</p>
                    <div id="${scannerId}" style="width: 100%; max-width: 320px; margin: 0 auto; border: 2px dashed var(--color-neon-lime); border-radius: 8px; overflow: hidden; background:#000; box-shadow:0 0 15px rgba(104,242,5,0.15);"></div>
                    <div id="qr-scan-feedback" style="margin-top:14px; font-size:0.85rem; color:var(--text-muted);">Iniciando cámara...</div>
                </div>
            `,
            footerHtml: `<button class="btn btn-secondary" id="btn-close-scanner">Cancelar</button>`,
            maxWidth: '360px'
        });

        const feedbackEl = document.getElementById('qr-scan-feedback');
        let html5QrCodeScanner = null;

        try {
            if (typeof Html5Qrcode === 'undefined') {
                feedbackEl.textContent = "Error: Librería de QR no cargada. Inténtalo de nuevo.";
                feedbackEl.style.color = "var(--color-neon-lime)";
                return;
            }

            html5QrCodeScanner = new Html5Qrcode(scannerId);
            
            const onScanSuccess = (decodedText) => {
                feedbackEl.textContent = `¡QR Detectado! Procesando...`;
                feedbackEl.style.color = "var(--color-neon-lime)";
                
                // Detener la cámara de manera segura y sincronizada
                if (html5QrCodeScanner && html5QrCodeScanner.isScanning) {
                    html5QrCodeScanner.stop().then(() => {
                        modal.close();
                        toast.success("¡Jugador escaneado exitosamente!");
                        renderClientsView(container, decodedText.trim());
                    }).catch(err => {
                        console.warn("Falla al detener cámara en éxito:", err);
                        modal.close();
                        renderClientsView(container, decodedText.trim());
                    });
                } else {
                    modal.close();
                    renderClientsView(container, decodedText.trim());
                }
            };

            const onScanFailure = () => {
                // Silencioso durante la búsqueda de fotogramas
            };

            // Listar cámaras para soportar laptops, PCs y móviles por igual
            Html5Qrcode.getCameras().then(devices => {
                if (devices && devices.length > 0) {
                    // Buscar cámara trasera en móviles, si no usar la primera disponible
                    const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trasera') || d.label.toLowerCase().includes('environment'));
                    const cameraId = backCam ? backCam.id : devices[0].id;
                    
                    html5QrCodeScanner.start(
                        cameraId,
                        {
                            fps: 10,
                            qrbox: { width: 220, height: 220 }
                        },
                        onScanSuccess,
                        onScanFailure
                    ).then(() => {
                        feedbackEl.textContent = "Buscando código QR...";
                        feedbackEl.style.color = "var(--piu-cyan)";
                    }).catch(err => {
                        console.error(err);
                        feedbackEl.textContent = "Error al iniciar la cámara seleccionada. Concede permisos.";
                        feedbackEl.style.color = "red";
                    });
                } else {
                    // Si getCameras falla o viene vacío, intentar por facingMode como fallback directo
                    html5QrCodeScanner.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 220, height: 220 }
                        },
                        onScanSuccess,
                        onScanFailure
                    ).then(() => {
                        feedbackEl.textContent = "Buscando código QR...";
                        feedbackEl.style.color = "var(--piu-cyan)";
                    }).catch(err => {
                        console.error(err);
                        feedbackEl.textContent = "No se encontraron cámaras compatibles.";
                        feedbackEl.style.color = "red";
                    });
                }
            }).catch(err => {
                console.warn("No se pudieron listar cámaras, usando fallback...", err);
                // Fallback directo
                html5QrCodeScanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 220, height: 220 }
                    },
                    onScanSuccess,
                    onScanFailure
                ).then(() => {
                    feedbackEl.textContent = "Buscando código QR...";
                    feedbackEl.style.color = "var(--piu-cyan)";
                }).catch(e => {
                    feedbackEl.textContent = "Error al acceder a la cámara.";
                    feedbackEl.style.color = "red";
                });
            });

        } catch (e) {
            console.error(e);
            feedbackEl.textContent = "Error inesperado al arrancar el escáner.";
        }

        document.getElementById('btn-close-scanner').onclick = () => {
            if (html5QrCodeScanner && html5QrCodeScanner.isScanning) {
                html5QrCodeScanner.stop().then(() => {
                    modal.close();
                }).catch(err => {
                    console.warn("Falla al detener cámara al cerrar:", err);
                    modal.close();
                });
            } else {
                modal.close();
            }
        };
    });

    // Paginación click
    const prevPageBtn = container.querySelector('#btn-prev-clients-page');
    const nextPageBtn = container.querySelector('#btn-next-clients-page');

    prevPageBtn?.addEventListener('click', () => {
        if (currentClientsPage > 1) {
            currentClientsPage--;
            renderClientsView(container, currentClientsSearchQuery);
        }
    });

    nextPageBtn?.addEventListener('click', () => {
        if (currentClientsPage < totalPages) {
            currentClientsPage++;
            renderClientsView(container, currentClientsSearchQuery);
        }
    });

    // Evento Registrar y Purgar
    if (isSuperAdmin) {
        container.querySelector('#btn-purge-xss')?.addEventListener('click', async () => {
            if (confirm("¿Purgar y eliminar permanentemente cualquier registro de prueba que contenga etiquetas HTML / XSS de Firebase?")) {
                toast.info("Purgando registros corruptos de Firebase...");
                const count = await clientDirManager.purgeCorruptedClients();
                toast.success(`Se purgaron ${count} registros de prueba con éxito.`);
                renderClientsView(container, '');
            }
        });

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
            const client = allClients.find(c => c.id === id);
            if (client) openClientFormModal(client, container);
        });
    });

    container.querySelectorAll('.btn-adjust-loyalty').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const client = allClients.find(c => c.id === id);
            if (client) openAdjustPointsModal(client, container);
        });
    });

    container.querySelectorAll('.btn-view-redemptions').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const client = allClients.find(c => c.id === id);
            if (client) openClientRedemptionsModal(client, business.id, container);
        });
    });

    // Evento de Cuenta de Jugador (Integrado con Cuenta Fácil)
    container.querySelectorAll('.btn-open-account').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const client = allClients.find(c => c.id === id);
            if (client && business) {
                openStatementModal(business, client.id, container, () => {
                    renderClientsView(container, currentClientsSearchQuery);
                });
            }
        });
    });

    // Registrar Visita Rápida (1 visita/punto al instante)
    container.querySelectorAll('.btn-quick-visit').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const client = allClients.find(c => c.id === id);
            if (!client) return;

            if (confirm(`¿Registrar visita para ${client.name}? Esto le sumará 1 visita y 1 punto/crédito de lealtad.`)) {
                try {
                    await loyaltyManager.adjustPlayerPoints(business.id, client.id, 1, 1, 'Registro rápido de visita en recepción');
                    toast.success(`¡Visita registrada para ${client.name}!`);
                    renderClientsView(container, currentClientsSearchQuery);
                } catch (e) {
                    toast.error(e.message);
                }
            }
        });
    });

    // Eventos Bloquear / Desbloquear jugador en la sucursal activa
    container.querySelectorAll('.btn-block-client').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!business) {
                toast.error("No hay sucursal activa seleccionada.");
                return;
            }
            const id = btn.dataset.id;
            const name = btn.dataset.name || 'este jugador';
            const username = btn.dataset.username || '';
            const phone = btn.dataset.phone || '';

            const reason = prompt(`¿Estás seguro de bloquear a "${name}" para que NO pueda reservar en "${business.name}"?\nIngresa el motivo del bloqueo (opcional):`, "Incumplimiento de reservas o política interna");
            if (reason !== null) {
                try {
                    await tenantManager.blockClientInBusiness(business.id, { id, name, username, phone }, reason);
                    toast.warning(`Jugador "${name}" bloqueado para reservaciones en este local.`);
                    renderClientsView(container, currentClientsSearchQuery);
                } catch (e) {
                    toast.error(e.message);
                }
            }
        });
    });

    container.querySelectorAll('.btn-unblock-client').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!business) return;
            const id = btn.dataset.id;
            const name = btn.dataset.name || 'este jugador';

            if (confirm(`¿Deseas desbloquear a "${name}" para permitirle volver a reservar en "${business.name}"?`)) {
                try {
                    await tenantManager.unblockClientInBusiness(business.id, id);
                    toast.success(`Jugador "${name}" desbloqueado exitosamente.`);
                    renderClientsView(container, currentClientsSearchQuery);
                } catch (e) {
                    toast.error(e.message);
                }
            }
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
                    <input type="text" id="cli-name" class="cyber-input" value="${client ? escapeHTML(client.name) : ''}" placeholder="Ej. Alex \"StepMaster\"" required>
                </div>
                <div class="form-group">
                    <label for="cli-phone"><span class="neon-arrow">◆</span> Teléfono / WhatsApp *</label>
                    <input type="tel" id="cli-phone" class="cyber-input" value="${client ? escapeHTML(client.phone) : ''}" placeholder="5512345678" required>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="cli-email"><span class="neon-arrow">◆</span> Correo Electrónico</label>
                    <input type="email" id="cli-email" class="cyber-input" value="${client ? escapeHTML(client.email) : ''}" placeholder="jugador@email.com">
                </div>
                <div class="form-group">
                    <label for="cli-piu-id"><span class="neon-arrow">◆</span> PIU ID Oficial (piugame.com)</label>
                    <input type="text" id="cli-piu-id" class="cyber-input" value="${client ? escapeHTML(client.piuGameId || '') : ''}" placeholder="Ej. megajefelink#1234">
                </div>
            </div>

            <div class="form-row grid-2">
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
                <div class="form-group">
                    <label for="cli-mode"><span class="neon-arrow">◆</span> Modo Preferido</label>
                    <input type="text" id="cli-mode" class="cyber-input" value="${client ? escapeHTML(client.preferredMode || 'Single / Double') : 'Single / Double'}" placeholder="Ej. Single Speed, Doubles, Freestyle, Co-Op">
                </div>
            </div>

            <div class="form-group">
                <label for="cli-notes"><span class="neon-arrow">◆</span> Notas de Calibración / Preferencias</label>
                <textarea id="cli-notes" class="cyber-textarea" rows="2" placeholder="Ej. Usa barra en canciones S20+, prefiere pantalla 120Hz...">${client ? escapeHTML(client.notes || '') : ''}</textarea>
            </div>

            <!-- Campo de PIN o Restablecimiento -->
            <div style="background:var(--bg-dark-700); padding:12px; border-radius:var(--radius-sm); border:1px solid rgba(104,242,5,0.2); margin-top:8px;">
                ${isEdit ? `
                    <label for="cli-reset-pin" style="font-weight:700; color:#fff; display:block; margin-bottom:4px;">
                        <span class="neon-arrow">◆</span> 🔑 Restablecer Nuevo PIN de Acceso (Opcional)
                    </label>
                    <input type="text" id="cli-reset-pin" class="cyber-input" placeholder="Dejar vacío para conservar el actual" maxlength="6" style="font-family:var(--font-mono); letter-spacing:2px; font-weight:bold; color:var(--color-neon-lime);">
                    <small style="display:block; margin-top:4px; color:var(--text-muted); font-size:0.75rem; line-height:1.3;">
                        💡 <em>Si el jugador olvidó su PIN, escribe aquí uno nuevo temporal (4 a 6 dígitos) y compárteselo para que pueda iniciar sesión.</em>
                    </small>

                    <!-- Herramienta de Migración a Firebase Auth -->
                    <div style="margin-top:12px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <div>
                            <span style="font-size:0.8rem; font-weight:700; color:${(client?.authUid || client?.isAuthMigrated) ? 'var(--color-neon-lime)' : 'var(--color-neon-gold)'};">
                                ${(client?.authUid || client?.isAuthMigrated) ? '🟢 Cuenta Firebase Auth Activa' : '🟡 Perfil Tradicional / PIN'}
                            </span>
                            <small style="display:block; color:var(--text-muted); font-size:0.72rem;">
                                ${(client?.authUid || client?.isAuthMigrated) ? `UID: ${escapeHTML(client.authUid || '')}` : 'Puede vincularse a Firebase Auth sin perder sus datos'}
                            </small>
                        </div>
                        ${!(client?.authUid || client?.isAuthMigrated) ? `
                            <button type="button" class="btn btn-outline btn-xs" id="btn-migrate-single-auth" style="border-color:var(--piu-cyan); color:var(--piu-cyan); padding:4px 8px; font-size:0.75rem;">
                                ⚡ Vincular a Auth
                            </button>
                        ` : ''}
                    </div>
                ` : `
                    <label for="cli-new-pin" style="font-weight:700; color:#fff; display:block; margin-bottom:4px;">
                        <span class="neon-arrow">◆</span> 🔑 PIN Inicial de Seguridad *
                    </label>
                    <input type="text" id="cli-new-pin" class="cyber-input" value="1234" maxlength="6" style="font-family:var(--font-mono); letter-spacing:2px; font-weight:bold; color:var(--color-neon-lime);" required>
                    <small style="display:block; margin-top:4px; color:var(--text-muted); font-size:0.75rem;">
                        PIN con el que el jugador ingresará al sistema (por defecto 1234).
                    </small>
                `}
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
        title: isEdit ? `Editar Perfil de Jugador: ${escapeHTML(client.name)}` : 'Registrar Nuevo Jugador',
        icon: '🕺',
        contentHtml,
        footerHtml,
        maxWidth: '540px'
    });

    modalEl.querySelector('#btn-cancel-cli').onclick = () => modal.close();

    const migrateBtn = modalEl.querySelector('#btn-migrate-single-auth');
    if (migrateBtn && isEdit) {
        migrateBtn.onclick = async () => {
            const resetPin = modalEl.querySelector('#cli-reset-pin')?.value.trim() || '1234';
            const email = modalEl.querySelector('#cli-email')?.value.trim() || client.email;
            try {
                toast.info("Vinculando cliente con Firebase Auth...");
                const res = await authManager.linkClientToFirebaseAuth(client.id, email, resetPin);
                toast.success(`¡Cliente vinculado exitosamente a Firebase Auth!`);
                client.authUid = res.authUid;
                client.isAuthMigrated = true;
                modal.close();
                if (mainContainer) renderClientsView(mainContainer, currentClientsSearchQuery);
            } catch (err) {
                toast.error(err.message);
            }
        };
    }

    modalEl.querySelector('#btn-save-cli').onclick = async () => {
        const name = modalEl.querySelector('#cli-name').value.trim();
        const phone = modalEl.querySelector('#cli-phone').value.trim();
        const email = modalEl.querySelector('#cli-email').value.trim();
        const piuGameId = modalEl.querySelector('#cli-piu-id').value.trim();
        const skillLevel = modalEl.querySelector('#cli-level').value;
        const preferredMode = modalEl.querySelector('#cli-mode').value.trim();
        const notes = modalEl.querySelector('#cli-notes').value.trim();

        if (!name || !phone) {
            toast.error("Por favor completa el nombre y teléfono del jugador.");
            return;
        }

        try {
            if (isEdit) {
                const updatePayload = {
                    name, phone, email, piuGameId, skillLevel, preferredMode, notes
                };

                const resetPin = modalEl.querySelector('#cli-reset-pin')?.value.trim();
                if (resetPin) {
                    if (resetPin.length < 4) {
                        toast.error("El nuevo PIN debe tener al menos 4 caracteres o dígitos.");
                        return;
                    }
                    const secureHash = await hashPin(resetPin);
                    updatePayload.pinHash = secureHash;
                    delete updatePayload.pin;
                }

                await clientDirManager.updateClient(client.id, updatePayload);
                toast.success(`Datos de "${name}" actualizados${resetPin ? ' y nuevo PIN asignado correctamente' : ''}.`);
            } else {
                const newPin = modalEl.querySelector('#cli-new-pin')?.value.trim() || '1234';
                if (newPin.length < 4) {
                    toast.error("El PIN debe tener al menos 4 caracteres o dígitos.");
                    return;
                }

                await clientDirManager.addClient({
                    name, phone, email, piuGameId, pin: newPin, skillLevel, preferredMode, notes
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
    const activeBusinessId = store.currentBusiness?.id || '';
    const bizLoyalty = (client.loyalty && activeBusinessId && client.loyalty[activeBusinessId]) ? client.loyalty[activeBusinessId] : { points: 0, visits: 0, tier: 'Bronce' };

    const contentHtml = `
        <form id="form-adjust-loyalty" class="cyber-form">
            <p style="font-size:0.9rem; color:var(--text-secondary);">Ajustando puntos para <strong>${escapeHTML(client.name)}</strong> (@${escapeHTML(client.username || 'gamertag')})</p>
            <div style="background:var(--bg-dark-700); padding:10px; border-radius:4px; margin-bottom:12px; font-size:0.85rem;">
                Puntos actuales: <strong style="color:var(--color-neon-lime);">${bizLoyalty.points || 0} Pts</strong><br>
                Visitas actuales: <strong style="color:var(--piu-cyan);">${bizLoyalty.visits || 0}</strong>
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
            await loyaltyManager.adjustPlayerPoints(store.currentBusiness?.id, client.id, ptsChange, vtsChange, reason);
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
    const bizRedemptions = redemptions.filter(r => r.businessId === businessId && r.status !== 'CANCELLED');

    const contentHtml = `
        <div class="client-redemptions-dialog" style="max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
            <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:10px;">Premios canjeados por <strong>${escapeHTML(client.name)}</strong> en este local:</p>
            
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
                            <strong style="color:#fff;">${escapeHTML(r.rewardName)}</strong>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                                Código: <code style="color:var(--piu-cyan); font-weight:bold; font-size:0.85rem;">${escapeHTML(r.code)}</code>
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">
                                Solicitado: ${new Date(r.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        <div>
                            ${isPending ? `
                                <div style="display:flex; flex-direction:column; gap:4px; align-items:stretch;">
                                    <button class="btn btn-success btn-xs btn-claim-voucher" data-red-id="${r.id}" style="width:100%;">
                                        ✔️ Entregar
                                    </button>
                                    <button class="btn btn-outline btn-xs btn-cancel-voucher" data-red-id="${r.id}" style="width:100%; border-color:var(--color-neon-lime); color:var(--color-neon-lime);" title="Cancelar canje sin devolver puntos">
                                        ❌ Cancelar
                                    </button>
                                    <button class="btn btn-danger btn-xs btn-refund-voucher" data-red-id="${r.id}" style="width:100%;" title="Cancelar y reembolsar puntos">
                                        🔄 Devolver
                                    </button>
                                </div>
                            ` : `
                                <span class="badge ${r.status === 'CANCELLED' ? 'badge-danger' : 'badge-dark'}" style="font-size:0.75rem;">
                                    ${r.status === 'CANCELLED' ? 'Cancelado' : 'Entregado'}
                                </span>
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
        title: `Premios de ${escapeHTML(client.name)}`,
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

    modalEl.querySelectorAll('.btn-cancel-voucher').forEach(btn => {
        btn.onclick = async () => {
            const redId = btn.dataset.redId;
            if (confirm("¿Estás seguro de cancelar este canje? Los puntos/visitas NO se le devolverán al jugador.")) {
                try {
                    await loyaltyManager.cancelRedemption(redId, businessId, false);
                    toast.success("¡Canje cancelado!");
                    modal.close();
                    openClientRedemptionsModal(client, businessId, mainContainer);
                } catch (e) {
                    toast.error(e.message);
                }
            }
        };
    });

    modalEl.querySelectorAll('.btn-refund-voucher').forEach(btn => {
        btn.onclick = async () => {
            const redId = btn.dataset.redId;
            if (confirm("¿Estás seguro de cancelar este canje y devolver los puntos/visitas al saldo del jugador?")) {
                try {
                    await loyaltyManager.cancelRedemption(redId, businessId, true);
                    toast.success("¡Canje cancelado y puntos devueltos!");
                    modal.close();
                    openClientRedemptionsModal(client, businessId, mainContainer);
                } catch (e) {
                    toast.error(e.message);
                }
            }
        };
    });
}

/**
 * ============================================================================
 * PUENTE DE CUENTA FÁCIL: DELEGACIÓN DIRECTA Y UNIFICADA (FASE 3)
 * Toda la gestión de POS, ventas, fiados, cobros y estados de cuenta está
 * centralizada en accountsView.js para garantizar transacciones atómicas
 * ============================================================================
 */
export async function openPlayerAccountModal(client, business, mainContainer = null, onSavedCallback = null) {
    const playerId = client?.id || client;
    return openStatementModal(business, playerId, mainContainer, onSavedCallback);
}

export async function openQuickConsumptionModal(client, business, mainContainer = null, onSavedCallback = null) {
    const playerId = client?.id || client;
    return openQuickSaleModal(business, playerId, mainContainer, onSavedCallback);
}

export async function openPaymentModal(client, business, mainContainer = null, onSavedCallback = null) {
    const playerId = client?.id || client;
    return openAccountsPaymentModal(business, playerId, mainContainer, onSavedCallback);
}
