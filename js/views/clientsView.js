// js/views/clientsView.js
// Directorio y Administración de Clientes / Jugadores para el Encargado del Local
import { store } from '../core/store.js';
import { authManager } from '../core/authManager.js';
import { db, isFirebaseAvailable, COLLECTIONS, collection, getDocs, setDoc, doc, updateDoc, deleteDoc, query, where } from '../firebaseConfig.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

class ClientDirectoryManager {
    constructor() {
        this.clients = [];
    }

    async loadClients(businessId) {
        let loaded = [];
        if (isFirebaseAvailable && db) {
            try {
                const snap = await getDocs(collection(db, COLLECTIONS.PLAYERS));
                snap.forEach(d => {
                    const data = d.data();
                    if (!data.businessId || data.businessId === businessId) {
                        loaded.push({ id: d.id, ...data });
                    }
                });
            } catch (e) {
                console.warn("Error cargando clientes de Firebase:", e);
            }
        }

        // Combinar con jugadores de authManager
        const authPlayers = authManager.getClientUsers() || [];
        authPlayers.forEach(ap => {
            if (!loaded.some(l => l.id === ap.id || l.username === ap.username)) {
                loaded.push(ap);
            }
        });

        if (loaded.length === 0) {
            const local = localStorage.getItem(`piu_clients_${businessId}`);
            if (local) {
                try { loaded = JSON.parse(local); } catch (e) { loaded = []; }
            }
        }

        // Si está vacío, generar clientes iniciales basados en las reservaciones del local
        if (loaded.length === 0) {
            const resList = store.getReservations();
            const clientMap = new Map();

            resList.forEach(r => {
                if (r.clientName && !clientMap.has(r.clientName)) {
                    clientMap.set(r.clientName, {
                        id: 'cli_' + Math.random().toString(36).substr(2, 9),
                        businessId: businessId,
                        name: r.clientName,
                        phone: r.clientPhone || '',
                        email: r.clientEmail || '',
                        skillLevel: 'Liga B',
                        preferredMode: 'Single / Double',
                        notes: r.notes || 'Jugador habitual del local.',
                        createdAt: new Date().toISOString()
                    });
                }
            });

            loaded = Array.from(clientMap.values());
            if (loaded.length === 0) {
                loaded = [
                    {
                        id: 'cli_01',
                        businessId: businessId,
                        name: 'Alex "StepMaster"',
                        phone: '5511223344',
                        email: 'alex.piu@gmail.com',
                        skillLevel: 'Liga SSS',
                        preferredMode: 'Single Speed & Stream',
                        notes: 'Jugador competitivo nacional. Usa barra.',
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'cli_02',
                        businessId: businessId,
                        name: 'Valeria G.',
                        phone: '5599887766',
                        email: 'valeria.dance@outlook.com',
                        skillLevel: 'Liga A',
                        preferredMode: 'Co-Op & K-Pop Songs',
                        notes: 'Viene los fines de semana en grupo.',
                        createdAt: new Date().toISOString()
                    }
                ];
            }
            this.saveLocally(businessId, loaded);
        }

        this.clients = loaded;
        return this.clients;
    }

    saveLocally(businessId, clients) {
        localStorage.setItem(`piu_clients_${businessId}`, JSON.stringify(clients));
    }

    async addClient(businessId, clientData) {
        const newClient = {
            id: 'cli_' + Date.now(),
            businessId: businessId,
            name: clientData.name.trim(),
            phone: clientData.phone?.trim() || '',
            email: clientData.email?.trim() || '',
            skillLevel: clientData.skillLevel || 'Liga C',
            preferredMode: clientData.preferredMode || 'Single',
            notes: clientData.notes?.trim() || '',
            createdAt: new Date().toISOString()
        };

        this.clients.push(newClient);
        this.saveLocally(businessId, this.clients);

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.PLAYERS, newClient.id), newClient);
            } catch (e) {
                console.warn("Error guardando cliente en Firebase:", e);
            }
        }
        return newClient;
    }

    async updateClient(businessId, clientId, updatedFields) {
        const index = this.clients.findIndex(c => c.id === clientId);
        if (index === -1) return null;

        this.clients[index] = { ...this.clients[index], ...updatedFields };
        this.saveLocally(businessId, this.clients);

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.PLAYERS, clientId), updatedFields);
            } catch (e) {
                console.warn("Error actualizando cliente en Firebase:", e);
            }
        }
        return this.clients[index];
    }

    async deleteClient(businessId, clientId) {
        this.clients = this.clients.filter(c => c.id !== clientId);
        this.saveLocally(businessId, this.clients);

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

const clientDirManager = new ClientDirectoryManager();

export async function renderClientsView(container) {
    const business = store.currentBusiness;
    const clients = await clientDirManager.loadClients(business.id);
    const reservations = store.getReservations();

    container.innerHTML = `
        <div class="clients-view-wrapper animate-fade-in">
            <!-- Header -->
            <div class="view-header-bar">
                <div class="header-left">
                    <h2 class="friendly-date-title">👥 Directorio de Clientes y Jugadores</h2>
                    <p class="subtitle-text">Administración de clientes habituales, datos de contacto y nivel de juego de <strong>${business.name}</strong></p>
                </div>
                <button class="btn btn-primary glow-red" id="btn-add-client">
                    <span>➕ Registrar Nuevo Cliente</span>
                </button>
            </div>

            <!-- Grid de Clientes -->
            <div class="clients-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:18px;">
                ${clients.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <h3>No hay clientes registrados en este local</h3>
                        <p>Haz clic en "Registrar Nuevo Cliente" para añadir un jugador a tu base de datos.</p>
                    </div>
                ` : clients.map(c => {
                    const totalBookings = reservations.filter(r => r.clientName.toLowerCase() === c.name.toLowerCase()).length;
                    const cleanPhone = (c.phone || '').replace(/\D/g, '');
                    const waLink = cleanPhone ? `https://wa.me/52${cleanPhone}` : '#';

                    return `
                        <div class="client-card settings-card" style="padding:18px; display:flex; flex-direction:column; gap:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div style="font-size:2rem; background:var(--bg-dark-700); width:46px; height:46px; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-sm);">
                                        🕺
                                    </div>
                                    <div>
                                        <h3 style="font-size:1.15rem; margin:0; color:#ffffff;">${c.name}</h3>
                                        <span class="badge badge-primary" style="font-size:0.7rem; margin-top:2px;">${c.skillLevel}</span>
                                    </div>
                                </div>
                                <div style="text-align:right;">
                                    <span class="badge badge-success" title="Total de reservaciones realizadas">${totalBookings} Reservas</span>
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
                                    <span style="color:var(--piu-cyan);">${c.preferredMode}</span>
                                </div>
                            </div>

                            ${c.notes ? `
                                <div style="font-size:0.82rem; color:var(--text-muted); font-style:italic; background:rgba(0,229,255,0.05); padding:8px 10px; border-radius:4px; border-left:2px solid var(--piu-cyan);">
                                    "${c.notes}"
                                </div>
                            ` : ''}

                            <div style="display:flex; gap:8px; margin-top:auto; padding-top:8px; border-top:1px solid var(--border-color);">
                                <button class="btn btn-outline btn-sm btn-edit-client" data-id="${c.id}" style="flex:1;">
                                    ✏️ Editar Datos
                                </button>
                                <button class="btn btn-danger btn-sm btn-delete-client" data-id="${c.id}" title="Eliminar cliente">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Eventos
    container.querySelector('#btn-add-client')?.addEventListener('click', () => {
        openClientFormModal(business.id, null, container);
    });

    container.querySelectorAll('.btn-edit-client').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const client = clientDirManager.clients.find(c => c.id === id);
            if (client) openClientFormModal(business.id, client, container);
        });
    });

    container.querySelectorAll('.btn-delete-client').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Estás seguro de eliminar este cliente del directorio?")) {
                await clientDirManager.deleteClient(business.id, id);
                toast.info("Cliente eliminado del directorio.");
                renderClientsView(container);
            }
        });
    });
}

function openClientFormModal(businessId, client = null, mainContainer) {
    const isEdit = !!client;

    const contentHtml = `
        <form id="form-client-dir" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="cli-name"><span class="neon-arrow">◆</span> Nombre / GamerTag *</label>
                    <input type="text" id="cli-name" class="cyber-input" value="${client ? client.name : ''}" placeholder="Ej. Alex Step / PIU_Gamer" required>
                </div>
                <div class="form-group">
                    <label for="cli-phone"><span class="neon-arrow">◆</span> Teléfono / WhatsApp *</label>
                    <input type="tel" id="cli-phone" class="cyber-input" value="${client ? client.phone : ''}" placeholder="Ej. 5512345678" required>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="cli-email"><span class="neon-arrow">◆</span> Correo Electrónico</label>
                    <input type="email" id="cli-email" class="cyber-input" value="${client ? client.email : ''}" placeholder="jugador@email.com">
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
                <input type="text" id="cli-mode" class="cyber-input" value="${client ? client.preferredMode : 'Single / Double'}" placeholder="Ej. Single Speed, Doubles, Freestyle, Co-Op">
            </div>

            <div class="form-group">
                <label for="cli-notes"><span class="neon-arrow">◆</span> Notas del Jugador</label>
                <textarea id="cli-notes" class="cyber-textarea" rows="2" placeholder="Ej. Calibración preferida, barra, horarios frecuentes...">${client ? client.notes : ''}</textarea>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-cli">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-cli">
            ${isEdit ? '💾 Guardar Cambios' : '➕ Guardar Cliente'}
        </button>
    `;

    const modalEl = modal.open({
        title: isEdit ? 'Editar Cliente / Jugador' : 'Registrar Nuevo Cliente',
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
            toast.error("Por favor completa nombre y teléfono del cliente.");
            return;
        }

        try {
            if (isEdit) {
                await clientDirManager.updateClient(businessId, client.id, {
                    name, phone, email, skillLevel, preferredMode, notes
                });
                toast.success("Datos del cliente actualizados.");
            } else {
                await clientDirManager.addClient(businessId, {
                    name, phone, email, skillLevel, preferredMode, notes
                });
                toast.success("Cliente agregado al directorio.");
            }
            modal.close();
            renderClientsView(mainContainer);
        } catch (e) {
            toast.error(e.message);
        }
    };
}
