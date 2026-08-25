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
    limit 
} from '../firebaseConfig.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { loyaltyManager } from '../core/loyaltyManager.js';
import { accountManager, CONSUMPTION_TYPES } from '../core/accountManager.js';
import { escapeHTML, hashPin } from '../core/securityUtils.js';

let currentClientsSearchQuery = '';
let currentClientsPage = 1;
const clientsPageSize = 15;

class ClientDirectoryManager {
    constructor() {
        this.clients = [];
    }

    async loadClients(searchQuery = '') {
        let loaded = [];
        const limitVal = 150;
        
        if (isFirebaseAvailable && db) {
            try {
                let q;
                if (searchQuery) {
                    const term = searchQuery.trim().toLowerCase();
                    
                    // Si el término tiene el formato de un ID de jugador (p_...)
                    if (term.startsWith('p_') || term.length > 15) {
                        try {
                            const docRef = doc(db, COLLECTIONS.PLAYERS, searchQuery.trim());
                            const docSnap = await getDoc(docRef);
                            if (docSnap.exists()) {
                                loaded.push({ id: docSnap.id, ...docSnap.data() });
                            }
                        } catch (err) {
                            console.warn("Error buscando cliente por ID:", err);
                        }
                    }

                    if (loaded.length === 0) {
                        const termPhone = term.replace(/\D/g, '');
                        if (termPhone) {
                            q = query(collection(db, COLLECTIONS.PLAYERS), where("phone", "==", termPhone), limit(limitVal));
                        } else {
                            q = query(collection(db, COLLECTIONS.PLAYERS), where("username", "==", term), limit(limitVal));
                        }
                        
                        let snap = await getDocs(q);
                        snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
                    }

                    if (loaded.length === 0) {
                        // Prefijo de nombre
                        q = query(
                            collection(db, COLLECTIONS.PLAYERS), 
                            where("name", ">=", searchQuery), 
                            where("name", "<=", searchQuery + '\uf8ff'),
                            limit(limitVal)
                        );
                        let snap = await getDocs(q);
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
        const rawPin = clientData.pin?.trim() || '1234';
        const pinHash = await hashPin(rawPin);

        const newClient = {
            id: 'usr_player_' + Date.now(),
            name: clientData.name.trim(),
            username: clientData.username?.trim() || 'player_' + Math.random().toString(36).substr(2, 5),
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
                ${isSuperAdmin ? `
                    <button class="btn btn-primary glow-red" id="btn-add-client">
                        <span>➕ Registrar Nuevo Jugador</span>
                    </button>
                ` : ''}
            </div>

            <!-- Buscador -->
            <div style="display:flex; gap:10px; margin-bottom:20px; max-width:600px; flex-wrap:wrap;">
                <input type="text" id="input-search-clients" class="cyber-input" placeholder="🔍 Buscar por nombre, GamerTag o teléfono..." value="${currentClientsSearchQuery}" style="flex:1; min-width:200px;">
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
                                        ${c.username ? `<code style="font-size:0.7rem; color:var(--piu-cyan);">@${escapeHTML(c.username)}</code>` : ''}
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
                                    <span class="gamer-hud-value ${netDebt > 0 ? 'has-debt' : (credit > 0 ? 'has-credit' : '')}">
                                        ${netDebt > 0 ? `-$${netDebt.toFixed(2)}` : (credit > 0 ? `+$${credit.toFixed(2)}` : `$0.00`)}
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

                            <!-- Fila Principal de Acciones (Consumo + Cuenta) -->
                            <div class="gamer-action-row">
                                <button class="btn btn-primary btn-xs btn-open-quick-consumption" data-id="${c.id}" style="background:linear-gradient(135deg, #088C4F, #68F205); color:#000; font-weight:800; border:none; padding:7px 10px; font-size:0.8rem;" title="Registrar consumo con tipos rápidos">
                                    ➕ Consumo
                                </button>
                                <button class="btn btn-outline btn-xs btn-open-account" data-id="${c.id}" style="border-color:var(--piu-cyan); color:var(--piu-cyan); font-weight:700; padding:7px 10px; font-size:0.8rem;" title="Ver estado de cuenta, historial y abonos">
                                    💳 Cuenta
                                </button>
                            </div>

                            <!-- Barra de Herramientas de Gestión -->
                            <div class="gamer-toolbar-row">
                                <button class="btn btn-outline btn-xs btn-edit-client" data-id="${c.id}" title="Editar perfil y restablecer PIN" style="font-size:0.75rem; padding:3px 8px;">
                                    ✏️ Editar
                                </button>
                                ${business && business.loyaltyEnabled ? `
                                    ${activeMode === 'VISITS' ? `
                                        <button class="btn btn-success btn-xs btn-quick-visit" data-id="${c.id}" style="background:rgba(104,242,5,0.12); color:var(--color-neon-lime); border:1px solid var(--color-neon-lime); font-size:0.75rem; padding:3px 8px;" title="Registrar 1 visita al instante">
                                            ➕ Visita
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-secondary btn-xs btn-adjust-loyalty" data-id="${c.id}" title="Ajustar puntos de lealtad" style="font-size:0.75rem; padding:3px 8px;">
                                        ⭐ Puntos
                                    </button>
                                    <button class="btn btn-outline btn-xs btn-view-redemptions" data-id="${c.id}" title="Validar premios canjeados" style="font-size:0.75rem; padding:3px 8px;">
                                        🎁 Canjes
                                    </button>
                                ` : ''}
                                ${isSuperAdmin ? `
                                    <button class="btn btn-danger btn-xs btn-delete-client" data-id="${c.id}" title="Eliminar jugador del sistema" style="padding:3px 6px; font-size:0.75rem;">
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

    // Eventos de Consumos y Cuenta de Jugador (Fase 2)
    container.querySelectorAll('.btn-open-quick-consumption').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const client = allClients.find(c => c.id === id);
            if (client && business) {
                openQuickConsumptionModal(client, business, container, () => {
                    renderClientsView(container, currentClientsSearchQuery);
                });
            }
        });
    });

    container.querySelectorAll('.btn-open-account').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const client = allClients.find(c => c.id === id);
            if (client && business) {
                openPlayerAccountModal(client, business, container, () => {
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
                <input type="text" id="cli-mode" class="cyber-input" value="${client ? escapeHTML(client.preferredMode || 'Single / Double') : 'Single / Double'}" placeholder="Ej. Single Speed, Doubles, Freestyle, Co-Op">
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
                const updatePayload = {
                    name, phone, email, skillLevel, preferredMode, notes
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
                    name, phone, email, pin: newPin, skillLevel, preferredMode, notes
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
 * MODAL: REGISTRO DE CONSUMO RÁPIDO (FASE 2)
 * Tipos rápidos: juego, bebida, alimento, ficha, inscripción, producto y otro
 * ============================================================================
 */
export function openQuickConsumptionModal(client, business, mainContainer = null, onSavedCallback = null) {
    const quickTypes = accountManager.getQuickTypes();
    let selectedType = quickTypes[1]; // default Bebida

    const contentHtml = `
        <div style="padding:4px;">
            <!-- Header Jugador -->
            <div style="display:flex; align-items:center; gap:12px; background:var(--bg-dark-700); padding:12px 14px; border-radius:var(--radius-sm); margin-bottom:16px; border-left:3px solid var(--color-neon-lime);">
                <div style="font-size:2rem; width:44px; height:44px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); border-radius:4px;">
                    ${client.avatar || '🕺'}
                </div>
                <div style="flex:1;">
                    <div style="font-weight:bold; color:#fff; font-size:1.05rem;">${escapeHTML(client.name)}</div>
                    <div style="display:flex; gap:8px; align-items:center; margin-top:2px;">
                        <span class="badge badge-primary" style="font-size:0.68rem;">${escapeHTML(client.skillLevel || 'Liga C')}</span>
                        ${client.username ? `<code style="color:var(--text-muted); font-size:0.75rem;">@${escapeHTML(client.username)}</code>` : ''}
                    </div>
                </div>
            </div>

            <!-- Selector de Tipos Rápidos -->
            <div style="margin-bottom:14px;">
                <label style="font-size:0.82rem; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:8px;">
                    <span class="neon-arrow">◆</span> Tipo de Consumo Rápido:
                </label>
                <div class="consumption-types-grid" id="quick-types-container">
                    ${quickTypes.map(t => `
                        <div class="consumption-type-chip ${t.id === selectedType.id ? 'active' : ''}" data-type-id="${t.id}" id="chip-type-${t.id}">
                            <span class="chip-icon">${t.icon}</span>
                            <span class="chip-label">${t.label}</span>
                            <span class="chip-price">$${t.defaultPrice}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Formulario de Detalle -->
            <form id="form-quick-consumption" class="cyber-form">
                <div class="form-group" style="margin-bottom:12px;">
                    <label for="csm-concept"><span class="neon-arrow">◆</span> Concepto / Descripción *</label>
                    <input type="text" id="csm-concept" class="cyber-input" value="${escapeHTML(selectedType.defaultConcept)}" placeholder="Ej. Monster Energy / 1 hr Juego" required>
                </div>

                <div class="form-row grid-2" style="margin-bottom:12px;">
                    <div class="form-group">
                        <label for="csm-qty"><span class="neon-arrow">◆</span> Cantidad *</label>
                        <input type="number" id="csm-qty" class="cyber-input" value="1" min="1" max="999" required style="font-weight:bold; font-size:1.1rem; text-align:center;">
                    </div>
                    <div class="form-group">
                        <label for="csm-price"><span class="neon-arrow">◆</span> Precio Unitario ($) *</label>
                        <input type="number" id="csm-price" class="cyber-input" value="${selectedType.defaultPrice}" min="0" step="0.5" required style="font-weight:bold; font-size:1.1rem; text-align:center; color:var(--color-chartreuse);">
                    </div>
                </div>

                <!-- Banner Total Calculado -->
                <div style="background:rgba(2, 56, 89, 0.4); border:1px solid rgba(104,242,5,0.3); border-radius:var(--radius-sm); padding:10px 14px; display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <span style="font-size:0.85rem; color:var(--text-muted); font-weight:700;">TOTAL A REGISTRAR:</span>
                    <strong id="csm-total-display" style="font-size:1.4rem; color:var(--color-neon-lime); font-family:var(--font-heading);">$${selectedType.defaultPrice.toFixed(2)}</strong>
                </div>

                <div class="form-row grid-2" style="margin-bottom:12px;">
                    <div class="form-group">
                        <label for="csm-payment-status"><span class="neon-arrow">◆</span> Estado del Cobro *</label>
                        <select id="csm-payment-status" class="cyber-select" style="font-weight:bold;">
                            <option value="PAID" selected>🟢 Pagado al momento</option>
                            <option value="PENDING">⏳ A la cuenta (Pendiente de pago)</option>
                        </select>
                    </div>
                    <div class="form-group" id="csm-method-group">
                        <label for="csm-payment-method"><span class="neon-arrow">◆</span> Método de Pago</label>
                        <select id="csm-payment-method" class="cyber-select">
                            <option value="CASH" selected>💵 Efectivo</option>
                            <option value="CARD">💳 Tarjeta / Terminal</option>
                            <option value="TRANSFER">📱 Transferencia (SPEI)</option>
                            <option value="ACCOUNT_CREDIT">🪙 Saldo a favor</option>
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom:8px;">
                    <label for="csm-notes"><span class="neon-arrow">◆</span> Notas / Observaciones (opcional)</label>
                    <input type="text" id="csm-notes" class="cyber-input" placeholder="Ej. Entregado en mostrador / Sabor ponche">
                </div>
            </form>
        </div>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-csm">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-submit-csm" style="background:linear-gradient(135deg, #088C4F, #68F205); color:#000; font-weight:bold; border:none;">
            <span>⚡ Registrar Consumo</span>
        </button>
    `;

    const modalEl = modal.open({
        title: `Registrar Consumo — ${escapeHTML(client.name)}`,
        icon: '➕',
        contentHtml,
        footerHtml,
        maxWidth: '520px'
    });

    const form = modalEl.querySelector('#form-quick-consumption');
    const conceptInput = modalEl.querySelector('#csm-concept');
    const qtyInput = modalEl.querySelector('#csm-qty');
    const priceInput = modalEl.querySelector('#csm-price');
    const totalDisplay = modalEl.querySelector('#csm-total-display');
    const statusSelect = modalEl.querySelector('#csm-payment-status');
    const methodGroup = modalEl.querySelector('#csm-method-group');
    const methodSelect = modalEl.querySelector('#csm-payment-method');
    const notesInput = modalEl.querySelector('#csm-notes');

    const updateTotal = () => {
        const q = Math.max(1, Number(qtyInput.value) || 1);
        const p = Math.max(0, Number(priceInput.value) || 0);
        const total = q * p;
        totalDisplay.textContent = `$${total.toFixed(2)}`;
    };

    qtyInput.addEventListener('input', updateTotal);
    priceInput.addEventListener('input', updateTotal);

    statusSelect.addEventListener('change', () => {
        if (statusSelect.value === 'PENDING') {
            methodGroup.style.opacity = '0.5';
            methodSelect.disabled = true;
        } else {
            methodGroup.style.opacity = '1';
            methodSelect.disabled = false;
        }
    });

    // Eventos para los chips de tipo
    modalEl.querySelectorAll('.consumption-type-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            modalEl.querySelectorAll('.consumption-type-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const typeId = chip.dataset.typeId;
            selectedType = accountManager.getTypeById(typeId);
            conceptInput.value = selectedType.defaultConcept;
            priceInput.value = selectedType.defaultPrice;
            updateTotal();
        });
    });

    modalEl.querySelector('#btn-cancel-csm').onclick = () => modal.close();

    modalEl.querySelector('#btn-submit-csm').onclick = async () => {
        const concept = conceptInput.value.trim();
        if (!concept) {
            toast.error("Por favor ingresa un concepto para el consumo.");
            conceptInput.focus();
            return;
        }

        const quantity = Math.max(1, Number(qtyInput.value) || 1);
        const unitPrice = Math.max(0, Number(priceInput.value) || 0);
        const paymentStatus = statusSelect.value;
        const paymentMethod = paymentStatus === 'PENDING' ? 'ON_ACCOUNT' : methodSelect.value;
        const notes = notesInput.value.trim();

        try {
            const submitBtn = modalEl.querySelector('#btn-submit-csm');
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>⏳ Registrando...</span>`;

            await accountManager.recordConsumption({
                businessId: business.id,
                playerId: client.id,
                playerUsername: client.username || '',
                playerName: client.name || '',
                playerPhone: client.phone || '',
                itemType: selectedType.id,
                concept,
                quantity,
                unitPrice,
                notes,
                paymentStatus,
                paymentMethod
            });

            toast.success(`¡Consumo registrado exitosamente por $${(quantity * unitPrice).toFixed(2)}!`);
            modal.close();

            if (onSavedCallback) onSavedCallback();
        } catch (err) {
            toast.error(`Error: ${err.message}`);
            const submitBtn = modalEl.querySelector('#btn-submit-csm');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>⚡ Registrar Consumo</span>`;
            }
        }
    };
}

/**
 * ============================================================================
 * MODAL: ESTADO DE CUENTA E HISTORIAL CRONOLÓGICO DEL JUGADOR (FASE 2)
 * ============================================================================
 */
export async function openPlayerAccountModal(client, business, mainContainer = null, onSavedCallback = null) {
    const modalEl = modal.open({
        title: `Cuenta de Jugador — ${escapeHTML(client.name)}`,
        icon: '💳',
        contentHtml: `
            <div style="text-align:center; padding:30px;">
                <div style="font-size:2rem; animation:spin 1s infinite linear;">⚡</div>
                <p style="color:var(--text-muted); margin-top:10px;">Cargando estado de cuenta e historial...</p>
            </div>
        `,
        footerHtml: `<button type="button" class="btn btn-secondary" id="btn-close-account">Cerrar</button>`,
        maxWidth: '680px'
    });

    modalEl.querySelector('#btn-close-account').onclick = () => modal.close();

    // Cargar datos de la cuenta
    const account = await accountManager.getPlayerAccount(business.id, client.id);
    const transactions = account.transactions || [];

    const currencySymbol = business?.currencySymbol || '$';
    const hasDebt = account.netDebt > 0;
    const hasCredit = account.creditBalance > 0;

    const contentHtml = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            <!-- Tarjeta Hero de Balance -->
            <div class="account-balance-hero ${hasDebt ? 'has-debt' : (hasCredit ? 'has-credit' : '')}">
                <div>
                    <span style="font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; color:rgba(255,255,255,0.7); font-weight:800; display:block;">
                        ${hasDebt ? '⚠️ SALDO PENDIENTE DE PAGO' : (hasCredit ? '🟢 SALDO A FAVOR DISPONIBLE' : '✅ SALDO AL CORRIENTE')}
                    </span>
                    <div class="balance-amount-display ${hasDebt ? 'debt' : (hasCredit ? 'credit' : 'clean')}">
                        ${hasDebt ? `- ${currencySymbol}${account.netDebt.toFixed(2)}` : (hasCredit ? `+ ${currencySymbol}${account.creditBalance.toFixed(2)}` : `${currencySymbol}0.00`)}
                    </div>
                    <small style="font-size:0.75rem; color:rgba(255,255,255,0.6);">
                        Local: <strong>${escapeHTML(business?.name || 'Esta Sucursal')}</strong>
                    </small>
                </div>

                <!-- Métricas Rápidas -->
                <div style="display:flex; gap:16px; flex-wrap:wrap; text-align:right;">
                    <div>
                        <span style="font-size:0.75rem; color:rgba(255,255,255,0.6); display:block;">Total Consumido</span>
                        <strong style="font-size:1.1rem; color:#fff;">${currencySymbol}${account.totalConsumed.toFixed(2)}</strong>
                    </div>
                    <div>
                        <span style="font-size:0.75rem; color:rgba(255,255,255,0.6); display:block;">Total Abonado</span>
                        <strong style="font-size:1.1rem; color:var(--color-neon-lime);">${currencySymbol}${account.totalAbonos.toFixed(2)}</strong>
                    </div>
                </div>
            </div>

            <!-- Botonera de Acciones Inmediatas -->
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="btn btn-primary btn-sm" id="btn-acc-new-csm" style="flex:1; background:linear-gradient(135deg, #088C4F, #68F205); color:#000; font-weight:bold; border:none;">
                    <span>➕ Registrar Consumo</span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-acc-new-payment" style="flex:1;">
                    <span>💵 Registrar Abono / Pago</span>
                </button>
            </div>

            <!-- Filtros de Historial -->
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:8px; flex-wrap:wrap; gap:8px;">
                <h4 style="margin:0; font-size:1rem; color:#fff; display:flex; align-items:center; gap:6px;">
                    <span>📜 Historial de Movimientos</span>
                    <span class="badge badge-dark" style="font-size:0.75rem;">${transactions.length}</span>
                </h4>
                <div style="display:flex; gap:4px;" id="acc-filter-chips">
                    <button class="btn btn-xs btn-outline active btn-acc-filter" data-filter="ALL">Todos</button>
                    <button class="btn btn-xs btn-outline btn-acc-filter" data-filter="PENDING" style="color:#FF5252;">Pendientes</button>
                    <button class="btn btn-xs btn-outline btn-acc-filter" data-filter="PAID" style="color:var(--color-neon-lime);">Pagados</button>
                    <button class="btn btn-xs btn-outline btn-acc-filter" data-filter="ABONO">Abonos</button>
                </div>
            </div>

            <!-- Lista de Transacciones -->
            <div class="account-movements-container" id="acc-transactions-list" style="max-height:340px; overflow-y:auto; padding:8px;">
                ${transactions.length === 0 ? `
                    <div style="text-align:center; padding:28px 10px; color:var(--text-muted);">
                        <div style="font-size:2rem; margin-bottom:6px;">📦</div>
                        <p style="margin:0; font-size:0.9rem;">No hay consumos ni movimientos registrados para este jugador.</p>
                    </div>
                ` : transactions.map(t => {
                    const isAbono = t.type === 'ABONO' || t.type === 'PAGO';
                    const isPending = t.paymentStatus === 'PENDING';
                    const isCancelled = t.status === 'CANCELLED';
                    const typeMeta = accountManager.getTypeById(t.itemType);
                    const dateFormatted = new Date(t.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

                    let statusClass = 'is-paid';
                    if (isCancelled) statusClass = 'is-cancelled';
                    else if (isAbono) statusClass = 'is-abono';
                    else if (isPending) statusClass = 'is-pending';

                    return `
                        <div class="movement-item-card ${statusClass}" data-type="${t.type}" data-status="${t.paymentStatus}" data-cancelled="${isCancelled}">
                            <div style="display:flex; align-items:center; gap:10px; flex:1;">
                                <div style="font-size:1.6rem; min-width:32px; text-align:center;">
                                    ${isAbono ? '💵' : typeMeta.icon}
                                </div>
                                <div>
                                    <div style="font-weight:bold; color:#fff; font-size:0.92rem; display:flex; align-items:center; gap:6px;">
                                        <span>${escapeHTML(t.concept || 'Consumo')}</span>
                                        ${!isAbono ? `<span class="badge badge-dark" style="font-size:0.68rem;">x${t.quantity || 1}</span>` : ''}
                                    </div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                                        <span>${dateFormatted}</span>
                                        ${t.createdBy ? ` • <span style="color:var(--text-secondary);">Por: ${escapeHTML(t.createdBy)}</span>` : ''}
                                        ${t.notes ? ` • <em style="color:var(--piu-cyan);">"${escapeHTML(t.notes)}"</em>` : ''}
                                    </div>
                                </div>
                            </div>

                            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                                <strong style="font-size:1.05rem; font-family:var(--font-heading); color:${isCancelled ? 'var(--text-muted)' : (isAbono ? 'var(--color-neon-lime)' : (isPending ? '#FF5252' : '#fff'))};">
                                    ${isAbono ? `+${currencySymbol}${Number(t.totalAmount).toFixed(2)}` : `${currencySymbol}${Number(t.totalAmount).toFixed(2)}`}
                                </strong>
                                <div>
                                    ${isCancelled ? `
                                        <span class="badge badge-danger" style="font-size:0.65rem;">CANCELADO</span>
                                    ` : (isAbono ? `
                                        <span class="badge badge-success" style="font-size:0.65rem;">ABONO A CUENTA</span>
                                    ` : (isPending ? `
                                        <span class="badge badge-danger" style="font-size:0.65rem;">PENDIENTE</span>
                                    ` : `
                                        <span class="badge badge-dark" style="font-size:0.65rem; color:var(--color-chartreuse); border-color:var(--color-chartreuse);">PAGADO</span>
                                    `))}

                                    ${!isCancelled ? `
                                        <button type="button" class="btn btn-outline btn-xs btn-cancel-tx" data-tx-id="${t.id}" style="padding:1px 6px; font-size:0.65rem; margin-left:4px;" title="Anular este registro">
                                            ✕
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    const bodyEl = modalEl.querySelector('.modal-body') || modalEl;
    const contentTarget = bodyEl.querySelector('div') || bodyEl;
    contentTarget.innerHTML = contentHtml;

    // Filtros
    modalEl.querySelectorAll('.btn-acc-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            modalEl.querySelectorAll('.btn-acc-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            modalEl.querySelectorAll('.movement-item-card').forEach(card => {
                const type = card.dataset.type;
                const status = card.dataset.status;
                if (filter === 'ALL') {
                    card.style.display = 'flex';
                } else if (filter === 'PENDING') {
                    card.style.display = (status === 'PENDING' && card.dataset.cancelled === 'false') ? 'flex' : 'none';
                } else if (filter === 'PAID') {
                    card.style.display = (status === 'PAID' && type !== 'ABONO' && card.dataset.cancelled === 'false') ? 'flex' : 'none';
                } else if (filter === 'ABONO') {
                    card.style.display = (type === 'ABONO' && card.dataset.cancelled === 'false') ? 'flex' : 'none';
                }
            });
        });
    });

    // Nuevo Consumo desde la cuenta
    modalEl.querySelector('#btn-acc-new-csm')?.addEventListener('click', () => {
        modal.close();
        openQuickConsumptionModal(client, business, mainContainer, () => {
            openPlayerAccountModal(client, business, mainContainer, onSavedCallback);
            if (onSavedCallback) onSavedCallback();
        });
    });

    // Nuevo Abono desde la cuenta
    modalEl.querySelector('#btn-acc-new-payment')?.addEventListener('click', () => {
        modal.close();
        openPaymentModal(client, business, mainContainer, () => {
            openPlayerAccountModal(client, business, mainContainer, onSavedCallback);
            if (onSavedCallback) onSavedCallback();
        });
    });

    // Cancelar transacción
    modalEl.querySelectorAll('.btn-cancel-tx').forEach(btn => {
        btn.addEventListener('click', async () => {
            const txId = btn.dataset.txId;
            if (confirm("¿Estás seguro de anular este movimiento? El saldo del jugador se recalculará automáticamente.")) {
                try {
                    await accountManager.cancelTransaction(business.id, client.id, txId);
                    toast.info("Movimiento anulado.");
                    modal.close();
                    openPlayerAccountModal(client, business, mainContainer, onSavedCallback);
                    if (onSavedCallback) onSavedCallback();
                } catch (e) {
                    toast.error(e.message);
                }
            }
        });
    });
}

/**
 * ============================================================================
 * MODAL: REGISTRO DE ABONO / PAGO A CUENTA (FASE 2)
 * ============================================================================
 */
export function openPaymentModal(client, business, mainContainer = null, onSavedCallback = null) {
    const contentHtml = `
        <form id="form-account-payment" class="cyber-form" style="padding:4px;">
            <div style="background:var(--bg-dark-700); padding:12px; border-radius:var(--radius-sm); margin-bottom:14px; border-left:3px solid var(--color-neon-lime);">
                <div style="font-weight:bold; color:#fff; font-size:1.05rem;">${escapeHTML(client.name)}</div>
                <small style="color:var(--text-muted);">Registrar liquidación o abono a favor para la cuenta en ${escapeHTML(business.name)}</small>
            </div>

            <div class="form-group" style="margin-bottom:12px;">
                <label for="pay-amount"><span class="neon-arrow">◆</span> Monto a Abonar ($) *</label>
                <input type="number" id="pay-amount" class="cyber-input" placeholder="0.00" min="1" step="0.5" required style="font-size:1.4rem; font-weight:bold; color:var(--color-neon-lime); text-align:center;">
            </div>

            <div class="form-group" style="margin-bottom:12px;">
                <label for="pay-method"><span class="neon-arrow">◆</span> Método de Recepción *</label>
                <select id="pay-method" class="cyber-select">
                    <option value="CASH" selected>💵 Efectivo</option>
                    <option value="TRANSFER">📱 Transferencia (SPEI)</option>
                    <option value="CARD">💳 Tarjeta Bancaria</option>
                    <option value="OTHER">📦 Otro</option>
                </select>
            </div>

            <div class="form-group" style="margin-bottom:8px;">
                <label for="pay-notes"><span class="neon-arrow">◆</span> Notas / Folio de comprobante</label>
                <input type="text" id="pay-notes" class="cyber-input" placeholder="Ej. Pago en caja recepción / Folio #1234">
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-pay">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-submit-pay" style="background:linear-gradient(135deg, #088C4F, #68F205); color:#000; font-weight:bold; border:none;">
            <span>💵 Registrar Abono</span>
        </button>
    `;

    const modalEl = modal.open({
        title: `Registrar Abono / Pago — ${escapeHTML(client.name)}`,
        icon: '💵',
        contentHtml,
        footerHtml,
        maxWidth: '440px'
    });

    modalEl.querySelector('#btn-cancel-pay').onclick = () => modal.close();

    modalEl.querySelector('#btn-submit-pay').onclick = async () => {
        const amountInput = modalEl.querySelector('#pay-amount');
        const amount = parseFloat(amountInput.value);

        if (isNaN(amount) || amount <= 0) {
            toast.error("Por favor ingresa un monto válido mayor a 0.");
            amountInput.focus();
            return;
        }

        const method = modalEl.querySelector('#pay-method').value;
        const notes = modalEl.querySelector('#pay-notes').value.trim();

        try {
            const submitBtn = modalEl.querySelector('#btn-submit-pay');
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>⏳ Registrando...</span>`;

            await accountManager.recordPayment({
                businessId: business.id,
                playerId: client.id,
                playerUsername: client.username || '',
                playerName: client.name || '',
                amount,
                paymentMethod: method,
                notes
            });

            toast.success(`¡Abono de $${amount.toFixed(2)} registrado correctamente!`);
            modal.close();

            if (onSavedCallback) onSavedCallback();
        } catch (err) {
            toast.error(err.message);
            const submitBtn = modalEl.querySelector('#btn-submit-pay');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>💵 Registrar Abono</span>`;
            }
        }
    };
}
