// js/views/machinesView.js
// Catálogo y administración de Máquinas Pump It Up (Agregar, Editar, Eliminar y Reasignar por Negocio)
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { catalogsManager } from '../core/catalogsManager.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export function renderMachinesView(container) {
    const business = store.currentBusiness;
    const machines = store.getMachines();
    const isStaff = authManager.isSuperAdmin() || authManager.isManager();
    const isSuperAdmin = authManager.isSuperAdmin();
    const allBusinesses = tenantManager.getAllBusinesses();

    container.innerHTML = `
        <div class="machines-view-wrapper animate-fade-in">
            <!-- Header de Catálogo de Máquinas -->
            <div class="view-header-bar">
                <div class="header-left">
                    <h2 class="friendly-date-title">🕹️ Catálogo de Máquinas PIU</h2>
                    <p class="subtitle-text">Máquinas registradas en <strong>${business.name}</strong> • ${machines.length} máquinas en total</p>
                </div>
                ${isStaff ? `
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
                        <h3>No hay máquinas registradas en este local</h3>
                        <p>Haz clic en "Registrar Nueva Máquina" para agregar una o transferir una de otra sucursal.</p>
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
                                     alt="${m.name}" 
                                     referrerpolicy="no-referrer"
                                     class="mach-card-img" 
                                     onerror="this.src='https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80'">
                                 <div class="mach-rate-badge" style="font-size:0.75rem; padding:4px 8px; font-family:var(--font-mono);">👤 1P: ${business.currencySymbol}${m.hourlyRate} | 👥 2P: ${business.currencySymbol}${m.hourlyRate2P || 130}/hr</div>
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

                                ${isStaff ? `
                                    <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">
                                        ${m.ownershipType === 'COMMISSION' ? `
                                            <div style="background:rgba(255,193,7,0.08); border:1px solid rgba(255,193,7,0.3); border-radius:4px; padding:4px 8px; font-size:0.75rem; color:#FFC107; display:flex; justify-content:space-between; align-items:center;">
                                                <span>🤝 <strong>Comisión:</strong> ${m.partnerPercentage || 50}% (${m.partnerName || 'Socio'})</span>
                                                <span style="color:var(--color-neon-lime); font-weight:700;">Local: ${100 - (m.partnerPercentage || 50)}%</span>
                                            </div>
                                        ` : `
                                            <div style="background:rgba(104,242,5,0.06); border:1px solid rgba(104,242,5,0.2); border-radius:4px; padding:3px 8px; font-size:0.72rem; color:var(--color-neon-lime);">
                                                🏢 <strong>Propiedad:</strong> 100% Local (Propia)
                                            </div>
                                        `}
                                    </div>
                                ` : ''}
                            </div>

                            ${isStaff ? `
                                <div class="mach-card-actions" style="display:flex; flex-wrap:wrap; gap:6px;">
                                    <button class="btn btn-outline btn-xs btn-edit-mach" data-id="${m.id}">✏️ Editar</button>
                                    <button class="btn ${isAvail ? 'btn-warning' : 'btn-success'} btn-xs btn-toggle-status" data-id="${m.id}" data-current="${m.status}">
                                        ${isAvail ? '🔧 Mant.' : '✅ Activar'}
                                    </button>
                                    ${allBusinesses.length > 1 ? `
                                        <button class="btn btn-secondary btn-xs btn-reassign-mach" data-id="${m.id}" title="Reasignar o transferir máquina a otra sucursal">
                                            🔀 Reasignar Local
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-danger btn-xs btn-del-mach" data-id="${m.id}" title="Eliminar máquina">🗑️</button>
                                </div>
                            ` : `
                                <div class="mach-card-actions">
                                    <button class="btn btn-primary btn-sm btn-book-this-mach glow-red" data-id="${m.id}" ${!isAvail ? 'disabled' : ''}>
                                        📅 Reservar esta Máquina
                                    </button>
                                </div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Eventos
    if (isStaff) {
        container.querySelector('#btn-add-machine')?.addEventListener('click', async () => {
            await openMachineFormModal();
        });

        container.querySelectorAll('.btn-edit-mach').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const mach = store.getMachineById(id);
                if (mach) await openMachineFormModal(mach);
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

        // Reasignar máquina a otra sucursal
        container.querySelectorAll('.btn-reassign-mach').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const mach = store.getMachineById(id);
                if (mach) openReassignMachineModal(mach, container);
            });
        });

        container.querySelectorAll('.btn-del-mach').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const mach = store.getMachineById(id);
                if (confirm(`¿Eliminar definitivamente la máquina "${mach.name}" de este local?`)) {
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
 * Modal de Creación / Edición de Máquinas PIU con Catálogos Dinámicos
 */
async function openMachineFormModal(machine = null) {
    const isEdit = !!machine;
    const business = store.currentBusiness;
    const cabinetModels = catalogsManager.getCabinetModels();
    const gameVersions = catalogsManager.getGameVersions();
    const features = await catalogsManager.getFeaturesByBusiness(business.id);

    const modelOptions = cabinetModels.map(c => `
        <option value="${c.name}" ${machine?.model === c.name || (machine?.model?.includes(c.shortName)) ? 'selected' : ''}>
            ${c.name} (${c.screenSize})
        </option>
    `).join('');

    const versionOptions = gameVersions.map(v => `
        <option value="${v.name}" ${machine?.version === v.name ? 'selected' : ''}>
            ${v.name} (${v.latestPatch})
        </option>
    `).join('');

    const currentFeatures = machine?.features || [];
    const activeFeatures = features.filter(f => f.status === 'ACTIVE');

    const featureCheckboxesHtml = activeFeatures.length === 0 ? `
        <p style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">
            No hay accesorios configurados en el catálogo local. Puedes agregarlos desde la pestaña "Catálogos".
        </p>
    ` : `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:8px; max-height:180px; overflow-y:auto; padding:4px; background:var(--bg-dark-900); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
            ${activeFeatures.map(f => {
                const isChecked = currentFeatures.includes(f.name) || currentFeatures.some(cf => cf.toLowerCase() === f.name.toLowerCase());
                return `
                    <label style="display:flex; align-items:center; gap:8px; background:var(--bg-dark-700); padding:6px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-color); cursor:pointer; font-size:0.82rem;">
                        <input type="checkbox" class="mach-feat-checkbox" value="${f.name}" ${isChecked ? 'checked' : ''} style="accent-color:var(--color-neon-lime); width:16px; height:16px; cursor:pointer;">
                        <span>${f.icon || '⚡'} <strong>${f.name}</strong></span>
                    </label>
                `;
            }).join('')}
        </div>
    `;

    const contentHtml = `
        <form id="form-machine" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="mach-name"><span class="neon-arrow">◆</span> Nombre Identificador *</label>
                    <input type="text" id="mach-name" class="cyber-input" value="${machine ? machine.name : ''}" placeholder="Ej. PIU Phoenix LX #1" required>
                </div>
                <div class="form-group">
                    <label for="mach-model"><span class="neon-arrow">◆</span> Modelo de Gabinete (Catálogo Global) *</label>
                    <select id="mach-model" class="cyber-select">
                        ${modelOptions}
                        <option value="Gabinete Personalizado" ${!modelOptions.includes(machine?.model) ? 'selected' : ''}>Gabinete Personalizado...</option>
                    </select>
                </div>
            </div>

            <div class="form-row grid-3" style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:16px;">
                <div class="form-group">
                    <label for="mach-version"><span class="neon-arrow">◆</span> Versión de Software (Catálogo Global) *</label>
                    <select id="mach-version" class="cyber-select">
                        ${versionOptions}
                        <option value="Otra Versión" ${!versionOptions.includes(machine?.version) ? 'selected' : ''}>Otra Versión...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="mach-rate"><span class="neon-arrow">◆</span> Tarifa 1P/hr (${business.currencySymbol}) *</label>
                    <input type="number" id="mach-rate" class="cyber-input" value="${machine ? machine.hourlyRate : 80}" min="1" required>
                </div>
                <div class="form-group">
                    <label for="mach-rate2p"><span class="neon-arrow">◆</span> Tarifa 2P/hr (${business.currencySymbol}) *</label>
                    <input type="number" id="mach-rate2p" class="cyber-input" value="${machine ? (machine.hourlyRate2P || 130) : 130}" min="1" required>
                </div>
            </div>

            <!-- Accesorios y Componentes de Hardware -->
            <div class="form-group">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <label><span class="neon-arrow">◆</span> Accesorios y Periféricos Instalados (Catálogo Local)</label>
                    <small style="color:var(--color-neon-lime); font-size:0.75rem;">(Selecciona los componentes presentes)</small>
                </div>
                ${featureCheckboxesHtml}
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
                <textarea id="mach-pads" class="cyber-textarea" rows="2" placeholder="Ej. Sensores FSR nuevos, sensibilidad 4.5/5, barra reforzada...">${machine ? machine.padsCondition : ''}</textarea>
            </div>

            <!-- Esquema de Propiedad y Comisión (Confidencial / Staff) -->
            <div style="background:rgba(20, 24, 35, 0.85); border:1px solid rgba(255, 193, 7, 0.3); border-radius:var(--radius-sm); padding:14px; margin-top:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label style="font-weight:700; color:#FFC107; margin:0; display:flex; align-items:center; gap:6px;">
                        <span>🤝</span> Esquema de Propiedad y Comisión (Confidencial Locatario)
                    </label>
                    <small style="color:var(--text-muted); font-size:0.72rem;">Solo visible para el personal</small>
                </div>

                <div class="form-row grid-2">
                    <div class="form-group">
                        <label for="mach-ownership"><span class="neon-arrow">◆</span> Tipo de Posesión</label>
                        <select id="mach-ownership" class="cyber-select">
                            <option value="OWNED" ${(!machine || machine.ownershipType === 'OWNED') ? 'selected' : ''}>🏢 Propia (100% Ingresos para el Local)</option>
                            <option value="COMMISSION" ${machine?.ownershipType === 'COMMISSION' ? 'selected' : ''}>🤝 Comisionada / Consignación (Reparto con Socio)</option>
                        </select>
                    </div>
                    <div class="form-group" id="wrap-partner-pct" style="${machine?.ownershipType === 'COMMISSION' ? '' : 'display:none;'}">
                        <label for="mach-partner-pct"><span class="neon-arrow">◆</span> % Comisión del Socio Dueño</label>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <input type="number" id="mach-partner-pct" class="cyber-input" value="${machine ? (machine.partnerPercentage ?? 50) : 50}" min="1" max="99" style="width:85px; font-weight:bold; color:#FFC107;">
                            <span style="font-weight:bold; color:#FFC107;">% Socio</span>
                            <span id="label-local-pct" style="color:var(--color-neon-lime); margin-left:auto; font-weight:700; font-size:0.78rem;">Local: ${100 - (machine ? (machine.partnerPercentage ?? 50) : 50)}%</span>
                        </div>
                    </div>
                </div>

                <div class="form-row grid-2" id="wrap-partner-info" style="${machine?.ownershipType === 'COMMISSION' ? '' : 'display:none;'}">
                    <div class="form-group">
                        <label for="mach-partner-name"><span class="neon-arrow">◆</span> Nombre del Socio / Operador</label>
                        <input type="text" id="mach-partner-name" class="cyber-input" value="${machine?.partnerName || ''}" placeholder="Ej. Pedro Gómez / Arcade Mex">
                    </div>
                    <div class="form-group">
                        <label for="mach-partner-phone"><span class="neon-arrow">◆</span> Teléfono / Contacto de Liquidación</label>
                        <input type="text" id="mach-partner-phone" class="cyber-input" value="${machine?.partnerPhone || ''}" placeholder="Ej. 5512345678 / Cuenta Bancaria">
                    </div>
                </div>
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
        maxWidth: '600px'
    });

    // Toggle dinámico de campos de comisión
    const ownershipSelect = modalEl.querySelector('#mach-ownership');
    const wrapPartnerPct = modalEl.querySelector('#wrap-partner-pct');
    const wrapPartnerInfo = modalEl.querySelector('#wrap-partner-info');
    const partnerPctInput = modalEl.querySelector('#mach-partner-pct');
    const localPctLabel = modalEl.querySelector('#label-local-pct');

    ownershipSelect?.addEventListener('change', (e) => {
        const isComm = e.target.value === 'COMMISSION';
        wrapPartnerPct.style.display = isComm ? '' : 'none';
        wrapPartnerInfo.style.display = isComm ? '' : 'none';
    });

    partnerPctInput?.addEventListener('input', (e) => {
        let val = parseInt(e.target.value) || 0;
        if (val < 0) val = 0;
        if (val > 100) val = 100;
        if (localPctLabel) localPctLabel.textContent = `Local: ${100 - val}%`;
    });

    modalEl.querySelector('#btn-cancel-mach').onclick = () => modal.close();

    modalEl.querySelector('#btn-save-mach').onclick = async () => {
        const name = modalEl.querySelector('#mach-name').value.trim();
        const model = modalEl.querySelector('#mach-model').value;
        const version = modalEl.querySelector('#mach-version').value;
        const hourlyRate = parseFloat(modalEl.querySelector('#mach-rate').value) || 80;
        const hourlyRate2P = parseFloat(modalEl.querySelector('#mach-rate2p').value) || 130;
        const status = modalEl.querySelector('#mach-status').value;
        const imageUrl = modalEl.querySelector('#mach-img').value.trim() || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80';
        const padsCondition = modalEl.querySelector('#mach-pads').value.trim();

        // Datos de propiedad y comisiones
        const ownershipType = modalEl.querySelector('#mach-ownership')?.value || 'OWNED';
        const partnerPercentage = ownershipType === 'COMMISSION' ? (parseFloat(modalEl.querySelector('#mach-partner-pct')?.value) || 50) : 0;
        const partnerName = ownershipType === 'COMMISSION' ? modalEl.querySelector('#mach-partner-name')?.value.trim() : '';
        const partnerPhone = ownershipType === 'COMMISSION' ? modalEl.querySelector('#mach-partner-phone')?.value.trim() : '';

        // Obtener accesorios marcados
        const selectedFeatures = [];
        modalEl.querySelectorAll('.mach-feat-checkbox:checked').forEach(cb => {
            selectedFeatures.push(cb.value);
        });

        if (!name) {
            toast.error("Por favor ingresa el nombre de la máquina.");
            return;
        }

        try {
            const machineData = {
                name, model, version, hourlyRate, hourlyRate2P, status, imageUrl, padsCondition, features: selectedFeatures,
                ownershipType, partnerPercentage, partnerName, partnerPhone
            };

            if (isEdit) {
                await store.updateMachine(machine.id, machineData);
                toast.success("Máquina actualizada correctamente.");
            } else {
                await store.addMachine(machineData);
                toast.success("Nueva máquina registrada en el catálogo.");
            }
            modal.close();
        } catch (e) {
            toast.error(e.message);
        }
    };
}

/**
 * Modal para Reasignar / Transferir Máquina a otra sucursal
 */
function openReassignMachineModal(machine, mainContainer) {
    const currentBiz = store.currentBusiness;
    const allBusinesses = tenantManager.getAllBusinesses().filter(b => b.id !== currentBiz.id);

    const bizOptions = allBusinesses.map(b => `
        <option value="${b.id}">${b.name} (${b.city})</option>
    `).join('');

    const contentHtml = `
        <div class="cyber-form">
            <p>Selecciona la sucursal de destino a la cual deseas transferir la máquina <strong>${machine.name}</strong>:</p>

            <div style="background:var(--bg-dark-700); padding:12px; border-radius:var(--radius-sm); font-size:0.85rem; margin-bottom:12px;">
                <div><span style="color:var(--text-muted);">Sucursal Actual:</span> <strong>${currentBiz.name}</strong></div>
                <div><span style="color:var(--text-muted);">Gabinete / Versión:</span> ${machine.model} • ${machine.version}</div>
            </div>

            <div class="form-group">
                <label for="reassign-target-biz"><span class="neon-arrow">◆</span> Nueva Sucursal de Destino *</label>
                <select id="reassign-target-biz" class="cyber-select" required>
                    ${bizOptions}
                </select>
            </div>

            <p style="font-size:0.78rem; color:var(--color-chartreuse);">
                ℹ️ La máquina desaparecerá de este local y estará disponible para reservas en la nueva sucursal.
            </p>
        </div>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-reas">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-confirm-reas">🔀 Transferir Máquina</button>
    `;

    const modalEl = modal.open({
        title: 'Reasignar Máquina a otra Sucursal',
        icon: '🔀',
        contentHtml,
        footerHtml,
        maxWidth: '500px'
    });

    modalEl.querySelector('#btn-cancel-reas').onclick = () => modal.close();

    modalEl.querySelector('#btn-confirm-reas').onclick = async () => {
        const targetBizId = modalEl.querySelector('#reassign-target-biz').value;
        const targetBiz = tenantManager.getBusinessById(targetBizId);

        try {
            await catalogsManager.reassignMachine(machine.id, currentBiz.id, targetBizId);
            modal.close();
            toast.success(`Máquina "${machine.name}" transferida exitosamente a "${targetBiz.name}".`);
            renderMachinesView(mainContainer);
        } catch (e) {
            toast.error(e.message);
        }
    };
}
