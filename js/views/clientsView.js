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
import { escapeHTML } from '../core/securityUtils.js';

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

            <!-- Grid de Clientes -->
            <div class="clients-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:18px;">
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

                    return `
                        <div class="client-card settings-card" style="padding:18px; display:flex; flex-direction:column; gap:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div style="font-size:2rem; background:var(--bg-dark-700); width:46px; height:46px; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-sm);">
                                        ${c.avatar || '🕺'}
                                    </div>
                                    <div>
                                        <h3 style="font-size:1.15rem; margin:0; color:#ffffff;">${escapeHTML(c.name)}</h3>
                                        <div style="display:flex; gap:6px; align-items:center; margin-top:2px;">
                                            <span class="badge badge-primary" style="font-size:0.7rem;">${escapeHTML(c.skillLevel || 'Liga C')}</span>
                                            ${c.username ? `<code style="font-size:0.68rem; color:var(--text-muted);">@${escapeHTML(c.username)}</code>` : ''}
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
                                    <span style="color:#ffffff;">${escapeHTML(c.phone || 'No registrado')}</span>
                                    ${cleanPhone ? `
                                        <a href="${waLink}" target="_blank" rel="noopener noreferrer" style="margin-left:6px; color:#25D366; font-weight:700;">
                                            💬 WhatsApp
                                        </a>
                                    ` : ''}
                                </div>
                                <div>
                                    <span style="color:var(--text-muted); font-weight:700;">✉️ Correo:</span>
                                    <span style="color:#ffffff;">${escapeHTML(c.email || 'No registrado')}</span>
                                </div>
                                <div>
                                    <span style="color:var(--text-muted); font-weight:700;">🎮 Modo Preferido:</span>
                                    <span style="color:var(--piu-cyan);">${escapeHTML(c.preferredMode || 'Single / Double')}</span>
                                </div>
                                ${business && business.loyaltyEnabled ? `
                                     <div style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:6px; margin-top:2px;">
                                         <span style="color:var(--text-muted); font-weight:700;">🎁 Lealtad:</span>
                                         <span class="badge ${tier.class}" style="font-size:0.72rem; padding: 2px 6px;">${tier.badge} ${tier.name}</span>
                                         ${activeMode === 'VISITS' ? `
                                             <strong style="color:var(--color-neon-lime); margin-left:6px;">${bizLoyalty.visits || 0} Visitas</strong>
                                         ` : `
                                             <strong style="color:var(--color-neon-lime); margin-left:6px;">${bizLoyalty.points || 0} Pts</strong>
                                             <span style="color:var(--text-secondary); margin-left:6px;">(${bizLoyalty.visits || 0} visitas)</span>
                                         `}
                                     </div>
                                 ` : ''}
                            </div>

                            ${c.notes ? `
                                <div style="font-size:0.82rem; color:var(--text-muted); font-style:italic; background:rgba(0,229,255,0.05); padding:8px 10px; border-radius:4px; border-left:2px solid var(--piu-cyan);">
                                    "${c.notes}"
                                </div>
                            ` : ''}

                            <div style="display:flex; gap:8px; margin-top:auto; padding-top:8px; border-top:1px solid var(--border-color); flex-wrap:wrap;">
                                <button class="btn btn-outline btn-xs btn-edit-client" data-id="${c.id}" style="flex:1; min-width:60px;">
                                    ✏️ Editar
                                </button>
                                ${business && business.loyaltyEnabled ? `
                                    ${activeMode === 'VISITS' ? `
                                        <button class="btn btn-success btn-xs btn-quick-visit" data-id="${c.id}" style="flex:1.5; background:var(--color-neon-lime); color:#000; font-weight:bold; border:none; min-width:110px;" title="Registrar 1 visita al instante">
                                            ➕ Visita
                                        </button>
                                    ` : `
                                        <button class="btn btn-success btn-xs btn-quick-spend" data-id="${c.id}" style="flex:1.5; background:var(--color-neon-lime); color:#000; font-weight:bold; border:none; min-width:110px;" title="Registrar compra y acumular puntos">
                                            ➕ Consumo
                                        </button>
                                    `}
                                    <button class="btn btn-secondary btn-xs btn-adjust-loyalty" data-id="${c.id}" style="flex:1; min-width:60px;">
                                        ⭐ Ajustar
                                    </button>
                                    <button class="btn btn-outline btn-xs btn-view-redemptions" data-id="${c.id}" style="flex:1; min-width:60px;" title="Validar premios canjeados de este jugador">
                                        🎁 Canjes
                                    </button>
                                ` : ''}
                                ${isSuperAdmin ? `
                                    <button class="btn btn-danger btn-xs btn-delete-client" data-id="${c.id}" title="Eliminar jugador" style="flex:0.3; min-width:30px;">
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

    // Registrar Consumo Rápido (Calcula puntos según ratio)
    container.querySelectorAll('.btn-quick-spend').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const client = allClients.find(c => c.id === id);
            if (!client) return;

            const spentStr = prompt(`Registrar consumo para ${client.name}.\nIngresa el monto gastado en el local ($):`);
            if (spentStr === null) return; // Cancelado

            const spent = parseFloat(spentStr);
            if (isNaN(spent) || spent <= 0) {
                toast.error("Por favor ingresa un monto válido mayor a 0.");
                return;
            }

            const ratio = Number(business.pointsRatio) || 10;
            const ptsEarned = Math.floor(spent / ratio);

            if (confirm(`Registrando $${spent.toFixed(2)}. Esto equivale a +${ptsEarned} puntos de lealtad (Ratio: ${ratio}) y +1 visita. ¿Confirmar?`)) {
                try {
                    await loyaltyManager.adjustPlayerPoints(business.id, client.id, ptsEarned, 1, `Consumo registrado en local: $${spent}`);
                    toast.success(`¡Consumo registrado! +${ptsEarned} puntos acreditados a ${client.name}.`);
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
