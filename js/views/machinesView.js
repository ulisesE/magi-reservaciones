// js/views/machinesView.js
// Catálogo y administración de Máquinas Pump It Up (Encargado)
import { store } from '../core/store.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export function renderMachinesView(container) {
    const business = store.currentBusiness;
    const machines = store.getMachines();
    const isAdmin = store.userRole === 'ADMIN';

    container.innerHTML = `
        <div class="machines-view-wrapper animate-fade-in">
            <!-- Header de Catálogo de Máquinas -->
            <div class="view-header-bar">
                <div class="header-left">
                    <h2 class="friendly-date-title">🕹️ Catálogo de Máquinas PIU</h2>
                    <p class="subtitle-text">Administración de pistas, versiones de software y estado de pads en <strong>${business.name}</strong></p>
                </div>
                ${isAdmin ? `
                    <button class="btn btn-primary glow-red" id="btn-add-machine">
                        <span>➕ Registrar Nueva Máquina</span>
                    </button>
                ` : ''}
            </div>

            <!-- Listado de Tarjetas de Máquinas -->
            <div class="machines-grid">
                ${machines.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">🕹️</div>
                        <h3>No hay máquinas registradas</h3>
                        <p>Haz clic en "Registrar Nueva Máquina" para agregar una al catálogo.</p>
                    </div>
                ` : machines.map(m => {
                    const isAvail = m.status === 'AVAILABLE';
                    const isMaint = m.status === 'MAINTENANCE';
                    const statusBadge = isAvail 
                        ? '<span class="badge badge-success">● DISPONIBLE</span>' 
                        : isMaint 
                        ? '<span class="badge badge-warning">🔧 EN MANTENIMIENTO</span>' 
                        : '<span class="badge badge-danger">✖ FUERA DE SERVICIO</span>';

                    return `
                        <div class="machine-card ${!isAvail ? 'card-dimmed' : ''}" data-mach-id="${m.id}">
                            <div class="mach-card-image-wrap">
                                <img src="${m.imageUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80'}" 
                                     alt="${m.name}" class="mach-card-img" onerror="this.src='https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80'">
                                <div class="mach-rate-badge">${business.currencySymbol}${m.hourlyRate}/hr</div>
                                <div class="mach-status-badge">${statusBadge}</div>
                            </div>

                            <div class="mach-card-body">
                                <div class="mach-card-header">
                                    <h3 class="mach-title">${m.name}</h3>
                                    <span class="mach-version-pill">💿 ${m.version}</span>
                                </div>

                                <div class="mach-spec-row">
                                    <span class="spec-label">Gabinete:</span>
                                    <strong class="spec-value">${m.model}</strong>
                                </div>

                                <div class="mach-pads-box">
                                    <span class="pads-icon">🦶</span>
                                    <div class="pads-text">
                                        <strong>Estado de Sensores & Pads:</strong>
                                        <p>${m.padsCondition || 'Sin observaciones'}</p>
                                    </div>
                                </div>

                                <div class="mach-features-tags">
                                    ${(m.features || []).map(f => `<span class="feature-tag">⚡ ${f}</span>`).join('')}
                                </div>
                            </div>

                            ${isAdmin ? `
                                <div class="mach-card-actions">
                                    <button class="btn btn-outline btn-sm btn-edit-mach" data-id="${m.id}">✏️ Editar</button>
                                    <button class="btn ${isAvail ? 'btn-warning' : 'btn-success'} btn-sm btn-toggle-status" data-id="${m.id}" data-current="${m.status}">
                                        ${isAvail ? '🔧 Mantenimiento' : '✅ Habilitar'}
                                    </button>
                                    <button class="btn btn-danger btn-sm btn-del-mach" data-id="${m.id}" title="Eliminar">🗑️</button>
                                </div>
                            ` : `
                                <div class="mach-card-actions">
                                    <button class="btn btn-primary btn-sm btn-book-this-mach glow-red" data-id="${m.id}" ${!isAvail ? 'disabled' : ''}>
                                        📅 Reservar esta Pista
                                    </button>
                                </div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Eventos de Encargado
    if (isAdmin) {
        container.querySelector('#btn-add-machine')?.addEventListener('click', () => {
            openMachineFormModal();
        });

        container.querySelectorAll('.btn-edit-mach').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const mach = store.getMachineById(id);
                if (mach) openMachineFormModal(mach);
            });
        });

        container.querySelectorAll('.btn-toggle-status').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const current = btn.dataset.current;
                const nextStatus = current === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE';
                try {
                    await store.updateMachine(id, { status: nextStatus });
                    toast.success(`Estado de máquina actualizado a: ${nextStatus === 'AVAILABLE' ? 'Disponible' : 'Mantenimiento'}`);
                } catch (e) {
                    toast.error(e.message);
                }
            });
        });

        container.querySelectorAll('.btn-del-mach').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const mach = store.getMachineById(id);
                if (confirm(`¿Eliminar definitivamente la máquina "${mach.name}"?`)) {
                    await store.deleteMachine(id);
                    toast.info("Máquina eliminada del catálogo.");
                }
            });
        });
    } else {
        container.querySelectorAll('.btn-book-this-mach').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                import('./clientBookingModal.js').then(module => {
                    module.openBookingModal({ machineId: id });
                });
            });
        });
    }
}

/**
 * Modal de Creación / Edición de Máquinas PIU
 */
function openMachineFormModal(machine = null) {
    const isEdit = !!machine;
    const business = store.currentBusiness;

    const contentHtml = `
        <form id="form-machine" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mach-name"><span class="neon-arrow">◆</span> Nombre Identificador *</label>
                    <input type="text" id="mach-name" class="cyber-input" value="${machine ? machine.name : ''}" placeholder="Ej. PIU Phoenix LX #1" required>
                </div>
                <div class="form-group">
                    <label for="mach-model"><span class="neon-arrow">◆</span> Tipo de Gabinete *</label>
                    <select id="mach-model" class="cyber-select">
                        <option value="LX 55\" LED Cabinet" ${machine?.model?.includes('LX') ? 'selected' : ''}>LX 55" LED Cabinet (Pro)</option>
                        <option value="TX 50\" HD Cabinet" ${machine?.model?.includes('TX') ? 'selected' : ''}>TX 50" HD Cabinet</option>
                        <option value="FX 42\" Cabinet" ${machine?.model?.includes('FX') ? 'selected' : ''}>FX 42" Cabinet</option>
                        <option value="CX 43\" Cabinet" ${machine?.model?.includes('CX') ? 'selected' : ''}>CX 43" Cabinet</option>
                        <option value="SD 29\" CRT Cabinet" ${machine?.model?.includes('SD') ? 'selected' : ''}>SD 29" Retro Cabinet</option>
                    </select>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mach-version"><span class="neon-arrow">◆</span> Versión de Software *</label>
                    <input type="text" id="mach-version" class="cyber-input" value="${machine ? machine.version : 'Phoenix 2024'}" placeholder="Ej. Phoenix 2024 (v1.08)" required>
                </div>
                <div class="form-group">
                    <label for="mach-rate"><span class="neon-arrow">◆</span> Tarifa por Hora (${business.currencySymbol}) *</label>
                    <input type="number" id="mach-rate" class="cyber-input" value="${machine ? machine.hourlyRate : 100}" min="1" required>
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mach-status"><span class="neon-arrow">◆</span> Estado Operativo</label>
                    <select id="mach-status" class="cyber-select">
                        <option value="AVAILABLE" ${machine?.status === 'AVAILABLE' ? 'selected' : ''}>Disponible para reservas</option>
                        <option value="MAINTENANCE" ${machine?.status === 'MAINTENANCE' ? 'selected' : ''}>En Mantenimiento</option>
                        <option value="OUT_OF_ORDER" ${machine?.status === 'OUT_OF_ORDER' ? 'selected' : ''}>Fuera de Servicio</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="mach-img"><span class="neon-arrow">◆</span> URL de Imagen</label>
                    <input type="url" id="mach-img" class="cyber-input" value="${machine ? machine.imageUrl : ''}" placeholder="https://...">
                </div>
            </div>

            <div class="form-group">
                <label for="mach-pads"><span class="neon-arrow">◆</span> Calibración de Sensores y Pads</label>
                <textarea id="mach-pads" class="cyber-textarea" rows="2" placeholder="Ej. Sensores FSR nuevos, sensibilidad 4/5, barra reforzada...">${machine ? machine.padsCondition : ''}</textarea>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-mach">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-save-mach">
            ${isEdit ? '💾 Guardar Cambios' : '➕ Crear Máquina'}
        </button>
    `;

    const modalEl = modal.open({
        title: isEdit ? 'Editar Máquina PIU' : 'Registrar Nueva Máquina PIU',
        icon: '🕹️',
        contentHtml,
        footerHtml,
        maxWidth: '560px'
    });

    modalEl.querySelector('#btn-cancel-mach').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-mach').onclick = async () => {
        const name = modalEl.querySelector('#mach-name').value.trim();
        const model = modalEl.querySelector('#mach-model').value;
        const version = modalEl.querySelector('#mach-version').value.trim();
        const hourlyRate = parseFloat(modalEl.querySelector('#mach-rate').value) || 100;
        const status = modalEl.querySelector('#mach-status').value;
        const imageUrl = modalEl.querySelector('#mach-img').value.trim() || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80';
        const padsCondition = modalEl.querySelector('#mach-pads').value.trim();

        if (!name || !version) {
            toast.error("Por favor completa los campos obligatorios.");
            return;
        }

        try {
            if (isEdit) {
                await store.updateMachine(machine.id, {
                    name, model, version, hourlyRate, status, imageUrl, padsCondition
                });
                toast.success("Máquina actualizada correctamente.");
            } else {
                await store.addMachine({
                    name, model, version, hourlyRate, status, imageUrl, padsCondition
                });
                toast.success("Nueva máquina registrada en el catálogo.");
            }
            modal.close();
        } catch (e) {
            toast.error(e.message);
        }
    };
}
