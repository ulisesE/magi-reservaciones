// js/views/accountsView.js
// Pantalla "Cuenta Fácil" — Módulo de Caja, Cuentas por Cobrar y Movimientos (v1.6.0)
// Principio Rector: FIRESTORE ES EL MANDANTE con Aislamiento Estricto por Sucursal
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { accountManager, CONSUMPTION_TYPES } from '../core/accountManager.js';
import { clientDirManager } from './clientsView.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { escapeHTML } from '../core/securityUtils.js';

let selectedFilterPlayerId = '';
let selectedDateFilter = 'ALL'; // 'ALL', 'TODAY', 'WEEK', 'MONTH'
let selectedStatusFilter = 'ALL'; // 'ALL', 'PENDING', 'PAID', 'ABONO', 'CANCELLED'

/**
 * Obtiene la lista unificada de todos los clientes y usuarios seleccionables (Jugadores + Staff)
 */
async function getAllAvailableClients() {
    const list = [];
    const seen = new Set();

    // 1. Cargar desde el directorio principal de clientes
    try {
        const dirClients = await clientDirManager.loadClients('');
        dirClients.forEach(c => {
            if (c && c.id && !seen.has(c.id)) {
                seen.add(c.id);
                list.push({
                    id: c.id,
                    name: c.name || 'Sin Nombre',
                    username: c.username || '',
                    piuGameId: c.piuGameId || '',
                    phone: c.phone || '',
                    avatar: c.avatar || '🕺',
                    role: c.role || 'CLIENT'
                });
            }
        });
    } catch (e) {
        console.warn("Error cargando clientDirManager:", e);
    }

    // 2. Cargar desde authManager client users
    try {
        const authClients = authManager.getClientUsers() || [];
        authClients.forEach(c => {
            if (c && c.id && !seen.has(c.id)) {
                seen.add(c.id);
                list.push({
                    id: c.id,
                    name: c.name || 'Sin Nombre',
                    username: c.username || '',
                    piuGameId: c.piuGameId || '',
                    phone: c.phone || '',
                    avatar: c.avatar || '🕺',
                    role: c.role || 'CLIENT'
                });
            }
        });
    } catch (e) {}

    // 3. Cargar staff (Superadmin y Encargados) para que también puedan consumir
    try {
        const staff = authManager.getStaffUsers() || [];
        staff.forEach(s => {
            if (s && s.id && !seen.has(s.id)) {
                seen.add(s.id);
                list.push({
                    id: s.id,
                    name: s.name || s.username,
                    username: s.username || '',
                    phone: s.phone || '',
                    avatar: s.avatar || (s.role === 'SUPERADMIN' ? '👑' : '🕹️'),
                    role: s.role || 'STAFF'
                });
            }
        });
    } catch (e) {}

    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Calcula la relevancia de un cliente según el término de búsqueda con PRIORIDAD ESTRICTA:
 * 1. Username / GamerTag (@username) -> Puntos 600 - 1000
 * 2. Nombre del cliente / Alias -> Puntos 250 - 500
 * 3. Teléfono / Aproximado -> Puntos 80 - 200
 */
function getClientSearchScore(c, queryTerm) {
    if (!c) return 0;
    if (!queryTerm) return 1;

    const raw = String(queryTerm).trim();
    if (!raw) return 1;

    const clean = (str) => String(str || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

    const term = clean(raw);
    if (!term) return 1;

    const user = clean(c.username);
    const piuId = clean(c.piuGameId);
    const name = clean(c.name);
    const phone = String(c.phone || '').replace(/\D/g, '');
    const termDigits = raw.replace(/\D/g, '');

    // Subsecuencia rápida
    const matchSubseq = (target, pattern) => {
        let tIdx = 0, pIdx = 0;
        while (tIdx < target.length && pIdx < pattern.length) {
            if (target[tIdx] === pattern[pIdx]) pIdx++;
            tIdx++;
        }
        return pIdx === pattern.length;
    };

    // --- PRIORIDAD 1: PIU ID OFICIAL / USERNAME / GAMERTAG ---
    if (piuId && (piuId === term || piuId.includes(term))) return 1000;
    if (user === term) return 1000;
    if (piuId && piuId.startsWith(term)) return 900;
    if (user.startsWith(term)) return 850;
    if (user.includes(term)) return 700;
    if (piuId && matchSubseq(piuId, term)) return 650;
    if (matchSubseq(user, term)) return 600;

    // --- PRIORIDAD 2: NOMBRE DEL CLIENTE ---
    if (name === term) return 500;
    if (name.startsWith(term)) return 450;
    
    // Palabras individuales del nombre (ej. segundo nombre o apellido)
    const nameWords = String(c.name || '').toLowerCase().split(/\s+/).map(clean);
    if (nameWords.some(w => w.startsWith(term))) return 400;
    if (name.includes(term)) return 300;
    if (matchSubseq(name, term)) return 250;

    // --- PRIORIDAD 3: TELÉFONO ---
    if (termDigits.length >= 3 && phone.includes(termDigits)) return 200;

    // --- PRIORIDAD 4: TOLERANCIA TIPOGRÁFICA (>= 4 letras) ---
    if (term.length >= 4) {
        let commonInUser = 0;
        for (const ch of term) {
            if (user.includes(ch)) commonInUser++;
        }
        if (commonInUser >= term.length - 1 && Math.abs(user.length - term.length) <= 3) return 150;

        let commonInName = 0;
        for (const ch of term) {
            if (name.includes(ch)) commonInName++;
        }
        if (commonInName >= term.length - 1 && Math.abs(name.length - term.length) <= 3) return 80;
    }

    return 0;
}

export async function renderAccountsView(container) {
    const business = store.currentBusiness || tenantManager.getActiveBusiness();
    const currency = business.currencySymbol || '$';

    // Cargar datos fidedignos de Firestore para este local
    const debtorsSummary = await accountManager.getDebtorsSummary(business.id);
    const clients = await getAllAvailableClients();
    const products = await accountManager.getProducts(business.id);
    const transactions = await accountManager.getBusinessTransactions(business.id, {
        playerId: selectedFilterPlayerId || null,
        dateFilter: selectedDateFilter,
        status: selectedStatusFilter
    });

    // Calcular totales de la vista
    const totalReceivable = debtorsSummary.totalReceivableDebt || 0;
    const debtorsCount = debtorsSummary.totalDebtorsCount || 0;
    const totalCredit = debtorsSummary.totalCreditSales || 0;

    container.innerHTML = `
        <div class="accounts-view-wrapper animate-fade-in">
            <!-- Header Bar -->
            <div class="view-header-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:24px;">
                <div class="header-left">
                    <h2 class="friendly-date-title" style="display:flex; align-items:center; gap:10px; margin:0;">
                        <span>💳</span> Cuenta Fácil & Caja
                    </h2>
                    <p class="subtitle-text" style="margin:4px 0 0 0;">
                        Control ágil de cuentas por cobrar, ventas fiadas y flujo de caja en <strong>${business.name}</strong>
                    </p>
                </div>
                <div class="header-actions" style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn btn-secondary" id="btn-open-catalogs-shortcut" title="Administrar productos y precios">
                        <span>🛍️ Catálogo Productos</span>
                    </button>
                    <button class="btn btn-primary glow-red" id="btn-open-quick-sale" style="font-weight:700;">
                        <span>➕ Cargar a Cuenta / Venta</span>
                    </button>
                </div>
            </div>

            <!-- 1. KPIs HERO DE CUENTA FÁCIL -->
            <div class="kpi-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:28px;">
                <!-- KPI 1: Por Cobrar General -->
                <div class="stat-card ${totalReceivable > 0 ? 'border-glow-red' : ''}" style="background:var(--bg-dark-800); border:1px solid ${totalReceivable > 0 ? 'rgba(255,46,126,0.4)' : 'rgba(255,255,255,0.08)'}; padding:20px; border-radius:8px; position:relative; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:${totalReceivable > 0 ? 'var(--color-neon-pink)' : 'var(--text-muted)'};">
                                💰 Por Cobrar General
                            </span>
                            <div style="font-size:2.2rem; font-weight:900; font-family:var(--font-mono); color:#ffffff; margin:8px 0 4px 0;">
                                ${currency}${totalReceivable.toFixed(2)}
                            </div>
                            <small style="color:var(--text-muted); font-size:0.78rem;">Deuda total acumulada en sala</small>
                        </div>
                        <span style="font-size:2rem; opacity:0.8;">🚨</span>
                    </div>
                </div>

                <!-- KPI 2: Clientes con Cuenta Pendiente -->
                <div class="stat-card" style="background:var(--bg-dark-800); border:1px solid rgba(255,255,255,0.08); padding:20px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--color-neon-gold);">
                                👥 Clientes Deudores
                            </span>
                            <div style="font-size:2.2rem; font-weight:900; font-family:var(--font-mono); color:#ffffff; margin:8px 0 4px 0;">
                                ${debtorsCount} <span style="font-size:1rem; font-weight:500; color:var(--text-muted);">${debtorsCount === 1 ? 'cuenta' : 'cuentas'}</span>
                            </div>
                            <small style="color:var(--text-muted); font-size:0.78rem;">Jugadores con saldo pendiente</small>
                        </div>
                        <span style="font-size:2rem; opacity:0.8;">⏳</span>
                    </div>
                </div>

                <!-- KPI 3: Total Venta Fiada Histórica -->
                <div class="stat-card" style="background:var(--bg-dark-800); border:1px solid rgba(255,255,255,0.08); padding:20px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--color-neon-blue);">
                                🛒 Total Venta Fiada
                            </span>
                            <div style="font-size:2.2rem; font-weight:900; font-family:var(--font-mono); color:#ffffff; margin:8px 0 4px 0;">
                                ${currency}${totalCredit.toFixed(2)}
                            </div>
                            <small style="color:var(--text-muted); font-size:0.78rem;">Consumos cargados a la cuenta</small>
                        </div>
                        <span style="font-size:2rem; opacity:0.8;">📦</span>
                    </div>
                </div>
            </div>

            <!-- 2. LISTA DE CLIENTES CON CUENTA POR COBRAR (DEUDORES) -->
            <div class="settings-card" style="margin-bottom:32px;">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div class="title-with-icon">
                        <span class="t-icon">👥</span>
                        <div>
                            <h3>Clientes con Cuenta por Cobrar (${debtorsSummary.debtorsList.length})</h3>
                            <small>Saldos adeudados arrastrados a la fecha en ${business.name}</small>
                        </div>
                    </div>
                </div>

                <div class="debtors-container" style="padding:16px;">
                    ${debtorsSummary.debtorsList.length === 0 ? `
                        <div style="text-align:center; padding:32px 16px; color:var(--color-neon-lime); background:rgba(104,242,5,0.04); border:1px dashed rgba(104,242,5,0.3); border-radius:6px;">
                            <span style="font-size:2.5rem; display:block; margin-bottom:8px;">✨</span>
                            <strong style="font-size:1.1rem; color:#ffffff;">¡No hay cuentas pendientes por cobrar en esta sucursal!</strong>
                            <p style="margin:6px 0 0 0; color:var(--text-muted); font-size:0.85rem;">Todos los clientes están al corriente con sus consumos.</p>
                        </div>
                    ` : `
                        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:14px;">
                            ${debtorsSummary.debtorsList.map(debtor => {
                                const clientObj = clients.find(c => c.id === debtor.playerId);
                                const avatar = clientObj?.avatar || '🕺';
                                const phone = debtor.playerPhone || clientObj?.phone || '';
                                return `
                                    <div class="debtor-card" style="background:var(--bg-dark-700); border:1px solid rgba(255,46,126,0.3); border-left:4px solid var(--color-neon-pink); border-radius:6px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
                                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                                            <div style="display:flex; align-items:center; gap:10px;">
                                                <div style="font-size:1.8rem; background:var(--bg-dark-900); width:44px; height:44px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid rgba(255,255,255,0.1);">
                                                    ${avatar}
                                                </div>
                                                <div>
                                                    <strong style="font-size:1.05rem; color:#ffffff; display:block;">${escapeHTML(debtor.playerName)}</strong>
                                                    ${debtor.playerUsername ? `<span style="font-size:0.8rem; color:var(--color-neon-cyan); font-family:var(--font-mono);">@${escapeHTML(debtor.playerUsername)}</span>` : ''}
                                                    ${phone ? `<small style="display:block; color:var(--text-muted); font-size:0.75rem;">📱 ${escapeHTML(phone)}</small>` : ''}
                                                </div>
                                            </div>
                                            <div style="text-align:right;">
                                                <small style="font-size:0.7rem; color:var(--color-neon-pink); text-transform:uppercase; font-weight:700; display:block;">Debe</small>
                                                <span style="font-size:1.4rem; font-weight:900; font-family:var(--font-mono); color:var(--color-neon-pink);">
                                                    ${currency}${debtor.netDebt.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        <div style="display:flex; gap:6px; border-top:1px solid rgba(255,255,255,0.06); padding-top:10px;">
                                            <button class="btn btn-primary btn-xs glow-red btn-charge-player" data-player-id="${debtor.playerId}" style="flex:1;">
                                                <span>➕ Cargar</span>
                                            </button>
                                            <button class="btn btn-success btn-xs btn-pay-player" data-player-id="${debtor.playerId}" style="flex:1;">
                                                <span>💵 Liquidar</span>
                                            </button>
                                            <button class="btn btn-outline btn-xs btn-statement-player" data-player-id="${debtor.playerId}" title="Ver historial de cuenta">
                                                <span>📜</span>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>

            <!-- 3. PANEL DE ÚLTIMOS MOVIMIENTOS CON FILTRO POR CLIENTE -->
            <div class="settings-card">
                <div class="card-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div class="title-with-icon">
                        <span class="t-icon">📋</span>
                        <div>
                            <h3>Últimos Movimientos de la Sala</h3>
                            <small>Detalle de productos despachados, consumos fiados y abonos registrados</small>
                        </div>
                    </div>
                </div>

                <!-- Barra de Filtros Interactivos -->
                <div class="movements-filter-toolbar" style="padding:14px 16px; background:var(--bg-dark-900); border-bottom:1px solid rgba(255,255,255,0.06); display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">
                    <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
                        <!-- Filtro de Cliente -->
                        <div style="display:flex; align-items:center; gap:6px;">
                            <label style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">👤 Cliente:</label>
                            <select id="filter-player-select" class="cyber-select" style="min-width:180px; padding:6px 10px; font-size:0.85rem;">
                                <option value="" ${!selectedFilterPlayerId ? 'selected' : ''}>Todos los clientes</option>
                                ${clients.map(c => `
                                    <option value="${c.id}" ${selectedFilterPlayerId === c.id ? 'selected' : ''}>
                                        ${escapeHTML(c.name)} (@${escapeHTML(c.username || 'sin_tag')})
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <!-- Filtro de Fecha -->
                        <div style="display:flex; align-items:center; gap:6px;">
                            <label style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">📅 Fecha:</label>
                            <select id="filter-date-select" class="cyber-select" style="padding:6px 10px; font-size:0.85rem;">
                                <option value="ALL" ${selectedDateFilter === 'ALL' ? 'selected' : ''}>Todo el histórico</option>
                                <option value="TODAY" ${selectedDateFilter === 'TODAY' ? 'selected' : ''}>Hoy</option>
                                <option value="WEEK" ${selectedDateFilter === 'WEEK' ? 'selected' : ''}>Esta semana</option>
                                <option value="MONTH" ${selectedDateFilter === 'MONTH' ? 'selected' : ''}>Este mes</option>
                            </select>
                        </div>

                        <!-- Filtro de Estado -->
                        <div style="display:flex; align-items:center; gap:6px;">
                            <label style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">🏷️ Estado:</label>
                            <select id="filter-status-select" class="cyber-select" style="padding:6px 10px; font-size:0.85rem;">
                                <option value="ALL" ${selectedStatusFilter === 'ALL' ? 'selected' : ''}>Todos los tipos</option>
                                <option value="PENDING" ${selectedStatusFilter === 'PENDING' ? 'selected' : ''}>⏳ Fiados / Pendientes</option>
                                <option value="PAID" ${selectedStatusFilter === 'PAID' ? 'selected' : ''}>🟢 Pagados</option>
                                <option value="ABONO" ${selectedStatusFilter === 'ABONO' ? 'selected' : ''}>💵 Abonos</option>
                                <option value="CANCELLED" ${selectedStatusFilter === 'CANCELLED' ? 'selected' : ''}>⚪ Anulados</option>
                            </select>
                        </div>
                    </div>

                    ${selectedFilterPlayerId || selectedDateFilter !== 'ALL' || selectedStatusFilter !== 'ALL' ? `
                        <button class="btn btn-outline btn-xs" id="btn-clear-filters" style="color:var(--color-neon-pink); border-color:var(--color-neon-pink);">
                            ✖ Limpiar Filtros
                        </button>
                    ` : ''}
                </div>

                <!-- Tabla de Movimientos -->
                <div class="catalogs-table-wrapper">
                    <table class="catalogs-table">
                        <thead>
                            <tr>
                                <th style="width:140px;">Fecha / Hora</th>
                                <th style="width:160px;">Cliente</th>
                                <th>Detalle de Productos y Cantidades</th>
                                <th style="width:110px; text-align:right;">Total</th>
                                <th style="width:130px; text-align:center;">Estado</th>
                                <th style="width:110px; text-align:center;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.length === 0 ? `
                                <tr>
                                    <td colspan="6" style="text-align:center; padding:32px 16px; color:var(--text-muted);">
                                        No se encontraron movimientos registrados con los filtros seleccionados.
                                    </td>
                                </tr>
                            ` : transactions.map(tx => {
                                const dateObj = tx.createdAt ? new Date(tx.createdAt) : new Date();
                                const formattedDate = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
                                const formattedTime = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

                                const isCancelled = tx.status === 'CANCELLED' || tx.status === 'VOIDED';
                                const isAbono = tx.type === 'ABONO' || tx.type === 'PAGO';
                                const isPending = tx.type === 'CONSUMO' && tx.paymentStatus === 'PENDING';

                                return `
                                    <tr style="${isCancelled ? 'opacity:0.45; text-decoration:line-through; background:rgba(255,46,126,0.03);' : ''}">
                                        <td style="font-size:0.82rem; font-family:var(--font-mono);">
                                            <strong style="color:#ffffff;">${formattedDate}</strong>
                                            <small style="display:block; color:var(--text-muted);">${formattedTime}</small>
                                        </td>
                                        <td>
                                            <strong style="color:#ffffff; font-size:0.9rem;">${escapeHTML(tx.playerName || 'Venta Mostrador')}</strong>
                                            ${tx.playerUsername ? `<small style="display:block; color:var(--color-neon-cyan); font-size:0.75rem; font-family:var(--font-mono);">@${escapeHTML(tx.playerUsername)}</small>` : ''}
                                        </td>
                                        <td>
                                            <div style="font-size:0.88rem; color:#ffffff;">
                                                ${isAbono ? `
                                                    <span style="color:var(--color-neon-lime); font-weight:700;">💵 Abono / Pago a cuenta</span>
                                                ` : `
                                                    <span>${escapeHTML(tx.concept || 'Consumo en sala')}</span>
                                                `}
                                            </div>
                                            ${tx.voidReason ? `<small style="color:var(--color-neon-pink); font-size:0.75rem; display:block;">Motivo anulación: ${escapeHTML(tx.voidReason)} (por ${escapeHTML(tx.voidedBy || 'Encargado')})</small>` : ''}
                                            ${tx.notes && !tx.voidReason ? `<small style="color:var(--text-muted); font-size:0.75rem;">Nota: ${escapeHTML(tx.notes)}</small>` : ''}
                                        </td>
                                        <td style="text-align:right; font-family:var(--font-mono); font-weight:900; font-size:1rem; color:${isAbono ? 'var(--color-neon-lime)' : isPending ? 'var(--color-neon-pink)' : '#ffffff'};">
                                            ${isAbono ? '+' : ''}${currency}${Number(tx.totalAmount).toFixed(2)}
                                        </td>
                                        <td style="text-align:center;">
                                            ${isCancelled ? `
                                                <span class="badge badge-danger" title="Motivo: ${tx.voidReason || 'Anulada'}">🚫 ANULADA</span>
                                            ` : isAbono ? `
                                                <span class="badge badge-success">ABONO</span>
                                            ` : isPending ? `
                                                <span class="badge" style="background:rgba(255,46,126,0.2); color:var(--color-neon-pink); border:1px solid var(--color-neon-pink);">
                                                    ⏳ FIADO
                                                </span>
                                            ` : `
                                                <span class="badge badge-primary">🟢 PAGADO</span>
                                            `}
                                        </td>
                                        <td style="text-align:center;">
                                            <div style="display:flex; justify-content:center; gap:4px;">
                                                ${!isCancelled && isPending && tx.playerId && tx.playerId !== 'guest_walkin' ? `
                                                    <button class="btn btn-success btn-xs btn-settle-single" data-tx-id="${tx.id}" data-player-id="${tx.playerId}" title="Cobrar / Liquidar adeudo">
                                                        <span>💵</span>
                                                    </button>
                                                ` : ''}
                                                ${!isCancelled ? `
                                                    <button class="btn btn-danger btn-xs btn-void-tx" data-tx-id="${tx.id}" data-player-id="${tx.playerId || ''}" title="Anular transacción (inmutable en auditoría)">
                                                        <span>🚫 Anular</span>
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // =========================================================================
    // EVENT LISTENERS DE LA VISTA
    // =========================================================================

    // 1. Botón superior Cargar a Cuenta / Venta
    container.querySelector('#btn-open-quick-sale')?.addEventListener('click', () => {
        openQuickSaleModal(business, null, container);
    });

    // 2. Acceso directo a Catálogo de Productos
    container.querySelector('#btn-open-catalogs-shortcut')?.addEventListener('click', () => {
        store.setCurrentView('CATALOGS');
    });

    // 3. Botones en tarjetas de deudores
    container.querySelectorAll('.btn-charge-player').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = btn.dataset.playerId;
            openQuickSaleModal(business, playerId, container);
        });
    });

    container.querySelectorAll('.btn-pay-player').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = btn.dataset.playerId;
            openPaymentModal(business, playerId, container);
        });
    });

    container.querySelectorAll('.btn-statement-player').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = btn.dataset.playerId;
            openStatementModal(business, playerId);
        });
    });

    // 4. Filtros de la tabla de movimientos
    container.querySelector('#filter-player-select')?.addEventListener('change', (e) => {
        selectedFilterPlayerId = e.target.value;
        renderAccountsView(container);
    });

    container.querySelector('#filter-date-select')?.addEventListener('change', (e) => {
        selectedDateFilter = e.target.value;
        renderAccountsView(container);
    });

    container.querySelector('#filter-status-select')?.addEventListener('change', (e) => {
        selectedStatusFilter = e.target.value;
        renderAccountsView(container);
    });

    container.querySelector('#btn-clear-filters')?.addEventListener('click', () => {
        selectedFilterPlayerId = '';
        selectedDateFilter = 'ALL';
        selectedStatusFilter = 'ALL';
        renderAccountsView(container);
    });

    // 5. Acciones de tabla
    container.querySelectorAll('.btn-settle-single').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = btn.dataset.playerId;
            openPaymentModal(business, playerId, container);
        });
    });

    container.querySelectorAll('.btn-void-tx').forEach(btn => {
        btn.addEventListener('click', async () => {
            const txId = btn.dataset.txId;
            const playerId = btn.dataset.playerId;
            const reason = prompt("⚠️ Ingresa el motivo obligatorio para anular esta transacción (se registrará en la auditoría inmutable):");
            if (reason === null) return;
            if (!reason.trim()) {
                toast.error("Se requiere un motivo para anular la transacción.");
                return;
            }

            try {
                btn.disabled = true;
                btn.innerHTML = "<span>⏳ Anulando...</span>";
                await accountManager.voidTransaction(business.id, playerId, txId, { reason: reason.trim() });
                toast.success("Transacción anulada correctamente y saldo recalculado.");
                renderAccountsView(container);
            } catch (e) {
                toast.error(e.message);
                btn.disabled = false;
                btn.innerHTML = "<span>🚫 Anular</span>";
            }
        });
    });
}

// =============================================================================
// MODAL DE CARGA A CUENTA / VENTA RÁPIDA (TERMINAL POS MULTI-PRODUCTO)
// =============================================================================
async function openQuickSaleModal(business, preselectedPlayerId = null, mainContainer) {
    const currency = business.currencySymbol || '$';
    const sortedClients = await getAllAvailableClients();
    const products = await accountManager.getProducts(business.id);

    // Estado del cliente seleccionado
    const preselectedClient = preselectedPlayerId && preselectedPlayerId !== 'guest_walkin' 
        ? sortedClients.find(c => c.id === preselectedPlayerId) 
        : null;

    let currentSelectedPlayerId = preselectedClient ? preselectedClient.id : (preselectedPlayerId === 'guest_walkin' ? 'guest_walkin' : '');
    let currentSelectedPlayerName = preselectedClient ? preselectedClient.name : 'Venta Mostrador';
    let currentSelectedPlayerUsername = preselectedClient ? (preselectedClient.username || '') : '';
    let currentSelectedPlayerPhone = preselectedClient ? (preselectedClient.phone || '') : '';

    // Estado del carrito de la venta en curso
    const cart = new Map(); // productId -> { id, name, category, icon, unitPrice, quantity, subtotal }
    let customConcept = '';
    let customPrice = 0;

    const contentHtml = `
        <div class="quick-pos-modal" style="display:flex; flex-direction:column; gap:16px;">
            <!-- Selector y Buscador Inteligente de Cliente -->
            <div class="form-group" style="margin:0; position:relative;">
                <label style="font-weight:700; font-size:0.9rem; color:#ffffff;"><span class="neon-arrow">◆</span> 1. Seleccionar Cliente / GamerTag *</label>
                <div style="position:relative; display:flex; gap:6px;">
                    <input 
                        type="text" 
                        id="pos-client-search-input" 
                        class="cyber-input" 
                        placeholder="🔍 Escribe para buscar cliente o registrar nombre público..." 
                        autocomplete="off"
                        value="${preselectedClient ? `${preselectedClient.name} (@${preselectedClient.username || 'sin_tag'})` : (preselectedPlayerId === 'guest_walkin' ? 'Venta Mostrador' : '')}"
                        style="width:100%; font-size:0.95rem;"
                    >
                    <button type="button" class="btn btn-outline btn-xs" id="btn-clear-pos-client" title="Limpiar y poner venta mostrador" style="padding:0 10px; font-size:0.85rem;">
                        ✖
                    </button>
                </div>

                <!-- Dropdown flotante con resultados predictivos -->
                <div id="pos-client-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; max-height:220px; overflow-y:auto; background:var(--bg-dark-900); border:1px solid var(--color-neon-cyan); border-radius:6px; z-index:1050; box-shadow:0 8px 24px rgba(0,0,0,0.8); margin-top:4px;">
                </div>

                <div id="pos-player-debt-badge" style="margin-top:6px; font-size:0.82rem;"></div>
            </div>

            <!-- Catálogo y Buscador de Productos -->
            <div class="pos-catalog-section" style="border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:14px; background:rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <label style="font-weight:700; font-size:0.88rem; color:var(--color-neon-cyan); margin:0;">
                        <span class="neon-arrow">◆</span> 2. Elegir Productos del Catálogo
                    </label>
                    <input type="text" id="pos-product-search" class="cyber-input" placeholder="🔍 Buscar producto..." style="width:170px; padding:4px 8px; font-size:0.8rem;">
                </div>

                <div id="pos-products-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap:8px; max-height:160px; overflow-y:auto; padding-right:4px;">
                    ${products.filter(p => p.status === 'ACTIVE').map(p => `
                        <button type="button" class="btn btn-outline btn-sm btn-add-pos-item" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-icon="${p.icon || '🛍️'}" data-category="${p.category}" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px 4px; text-align:center; height:70px; border-color:rgba(255,255,255,0.15);">
                            <span style="font-size:1.3rem;">${p.icon || '🛍️'}</span>
                            <strong style="font-size:0.75rem; color:#ffffff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${p.name}</strong>
                            <span style="font-size:0.8rem; font-family:var(--font-mono); color:var(--color-neon-gold); font-weight:700;">${currency}${Number(p.price).toFixed(2)}</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Carrito de Productos Seleccionados -->
            <div class="pos-cart-section" style="border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:12px; background:var(--bg-dark-900);">
                <div style="font-weight:700; font-size:0.88rem; color:#ffffff; margin-bottom:8px; display:flex; justify-content:space-between;">
                    <span>🛒 Artículos a Cargar</span>
                    <button type="button" class="btn btn-outline btn-xs" id="btn-toggle-custom-item" style="font-size:0.75rem;">
                        ➕ Otro Concepto
                    </button>
                </div>

                <!-- Campo dinámico de Concepto Libre -->
                <div id="custom-item-row" style="display:none; background:rgba(255,255,255,0.03); border:1px dashed rgba(255,255,255,0.2); padding:10px; border-radius:4px; margin-bottom:10px;">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <input type="text" id="custom-concept-input" class="cyber-input" placeholder="Concepto personalizado (ej. Refresco especial)" style="flex:2; font-size:0.85rem;">
                        <input type="number" id="custom-price-input" class="cyber-input" placeholder="Precio $" min="0" step="0.5" style="flex:1; font-size:0.85rem;">
                    </div>
                </div>

                <!-- Lista de items en el carrito -->
                <div id="pos-cart-items" style="display:flex; flex-direction:column; gap:6px; max-height:140px; overflow-y:auto;">
                    <div style="text-align:center; padding:14px; color:var(--text-muted); font-size:0.82rem;" id="pos-empty-cart-msg">
                        Haz clic en los productos de arriba para agregarlos a la cuenta.
                    </div>
                </div>
            </div>

            <!-- Método de Pago / Destino de la Venta -->
            <div class="form-row grid-2" style="margin:0;">
                <div class="form-group" style="margin:0;">
                    <label style="font-weight:700; font-size:0.85rem;"><span class="neon-arrow">◆</span> Tipo de Registro</label>
                    <select id="pos-payment-status" class="cyber-select" style="font-size:0.9rem;">
                        <option value="PENDING" ${currentSelectedPlayerId && currentSelectedPlayerId !== 'guest_walkin' ? 'selected' : ''}>⏳ Cargar a la Cuenta (Fiado / Pendiente)</option>
                        <option value="PAID" ${!currentSelectedPlayerId || currentSelectedPlayerId === 'guest_walkin' ? 'selected' : ''}>🟢 Pagado al Momento (Contado)</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-weight:700; font-size:0.85rem;"><span class="neon-arrow">◆</span> Método de Pago</label>
                    <select id="pos-payment-method" class="cyber-select" style="font-size:0.9rem;">
                        <option value="CASH" selected>💵 Efectivo</option>
                        <option value="CARD">💳 Tarjeta Débito/Crédito</option>
                        <option value="TRANSFER">📱 Transferencia SPEI</option>
                    </select>
                </div>
            </div>

            <!-- Total Banner -->
            <div style="background:var(--bg-dark-700); border:1px solid var(--color-neon-pink); border-radius:6px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.95rem; font-weight:700; color:#ffffff; text-transform:uppercase;">Total a Cargar:</span>
                <span id="pos-total-display" style="font-size:1.6rem; font-weight:900; font-family:var(--font-mono); color:var(--color-neon-pink);">
                    ${currency}0.00
                </span>
            </div>
        </div>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-pos">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-submit-pos">💾 Registrar Venta / Consumo</button>
    `;

    const modalEl = modal.open({
        title: 'Cargar a Cuenta / Punto de Venta',
        icon: '🛒',
        contentHtml,
        footerHtml,
        maxWidth: '560px'
    });

    const clientSearchInput = modalEl.querySelector('#pos-client-search-input');
    const clientDropdown = modalEl.querySelector('#pos-client-dropdown');
    const debtBadgeEl = modalEl.querySelector('#pos-player-debt-badge');
    const paymentStatusEl = modalEl.querySelector('#pos-payment-status');

    // Actualizar badge de deuda del cliente
    const updateDebtBadge = async () => {
        if (!currentSelectedPlayerId || currentSelectedPlayerId === 'guest_walkin') {
            const displayName = currentSelectedPlayerName || 'Público General';
            debtBadgeEl.innerHTML = `<span style="color:var(--text-muted);">👤 Venta Mostrador / General a nombre de: <strong>${escapeHTML(displayName)}</strong> (Sin cuenta fiada).</span>`;
        } else {
            const acc = await accountManager.getPlayerAccount(business.id, currentSelectedPlayerId);
            const safeName = escapeHTML(currentSelectedPlayerName);
            if (acc.netDebt > 0) {
                debtBadgeEl.innerHTML = `<span style="color:var(--color-neon-pink); font-weight:700;">⚠️ ${safeName} tiene una deuda pendiente de ${currency}${acc.netDebt.toFixed(2)}.</span>`;
            } else if (acc.creditBalance > 0) {
                debtBadgeEl.innerHTML = `<span style="color:var(--color-neon-lime); font-weight:700;">✅ ${safeName} tiene saldo a favor de ${currency}${acc.creditBalance.toFixed(2)}.</span>`;
            } else {
                debtBadgeEl.innerHTML = `<span style="color:var(--color-neon-lime);">✅ Cuenta de ${safeName} al corriente (Sin adeudos).</span>`;
            }
        }
    };

    // Renderizar resultados del dropdown predictivo
    const renderClientDropdown = (queryTerm = '') => {
        const rawTerm = (queryTerm || '').trim();
        let matches = [];

        if (rawTerm) {
            matches = sortedClients
                .map(c => ({ client: c, score: getClientSearchScore(c, rawTerm) }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(item => item.client);
        } else {
            matches = sortedClients;
        }

        let html = '';

        // Opción 1: Venta Mostrador General
        html += `
            <div class="pos-dropdown-item btn-select-walkin" style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.08); cursor:pointer; display:flex; align-items:center; gap:10px; transition:background 0.15s ease;">
                <span style="font-size:1.3rem;">👤</span>
                <div>
                    <strong style="color:var(--color-neon-cyan); font-size:0.88rem; display:block;">Venta General / Mostrador (Público)</strong>
                    <small style="color:var(--text-muted); font-size:0.75rem;">Sin asociar a cuenta registrada</small>
                </div>
            </div>
        `;

        // Si el usuario escribió un término, ofrecer registrar bajo ese nombre público
        if (rawTerm) {
            html += `
                <div class="pos-dropdown-item btn-select-custom-name" data-custom-name="${escapeHTML(rawTerm)}" style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(255,184,0,0.05); cursor:pointer; display:flex; align-items:center; gap:10px; transition:background 0.15s ease;">
                    <span style="font-size:1.3rem;">📝</span>
                    <div>
                        <strong style="color:var(--color-neon-gold); font-size:0.88rem; display:block;">Venta General a nombre de: "${escapeHTML(rawTerm)}"</strong>
                        <small style="color:var(--text-muted); font-size:0.75rem;">Registrar como cliente no registrado en catálogo</small>
                    </div>
                </div>
            `;
        }

        // Clientes coincidentes
        if (matches.length > 0) {
            matches.forEach(c => {
                html += `
                    <div class="pos-dropdown-item btn-select-matched-client" data-id="${c.id}" style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:10px; transition:background 0.15s ease;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.3rem;">${c.avatar || '🕺'}</span>
                            <div>
                                <strong style="color:#ffffff; font-size:0.9rem; display:block;">${escapeHTML(c.name)}</strong>
                                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:2px;">
                                    <span style="color:var(--color-neon-cyan); font-size:0.75rem; font-family:var(--font-mono);">@${escapeHTML(c.username || 'sin_tag')}</span>
                                    ${c.piuGameId ? `<span class="badge" style="font-size:0.65rem; padding:1px 5px; background:rgba(0,229,255,0.12); color:var(--piu-cyan); border:1px solid rgba(0,229,255,0.3);">🎮 ${escapeHTML(c.piuGameId)}</span>` : ''}
                                    ${c.phone ? `<small style="color:var(--text-muted); font-size:0.75rem;">📱 ${escapeHTML(c.phone)}</small>` : ''}
                                </div>
                            </div>
                        </div>
                        <span class="badge badge-outline" style="font-size:0.7rem;">Seleccionar</span>
                    </div>
                `;
            });
        } else if (rawTerm) {
            html += `
                <div style="padding:10px 14px; font-size:0.8rem; color:var(--text-muted);">
                    No se encontró coincidencia exacta con "${escapeHTML(rawTerm)}". Puedes usar la opción de venta general arriba o seleccionar de los clientes registrados:
                </div>
            `;
            sortedClients.slice(0, 5).forEach(c => {
                html += `
                    <div class="pos-dropdown-item btn-select-matched-client" data-id="${c.id}" style="padding:8px 14px; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:10px; opacity:0.85;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.1rem;">${c.avatar || '🕺'}</span>
                            <div>
                                <strong style="color:#ffffff; font-size:0.85rem; display:block;">${escapeHTML(c.name)}</strong>
                                <span style="color:var(--color-neon-cyan); font-size:0.7rem; font-family:var(--font-mono);">@${escapeHTML(c.username || 'sin_tag')}</span>
                            </div>
                        </div>
                        <span class="badge badge-outline" style="font-size:0.65rem;">Seleccionar</span>
                    </div>
                `;
            });
        }

        clientDropdown.innerHTML = html;
        clientDropdown.style.display = 'block';

        // Listeners en items del dropdown
        clientDropdown.querySelector('.btn-select-walkin')?.addEventListener('click', () => {
            currentSelectedPlayerId = 'guest_walkin';
            currentSelectedPlayerName = 'Venta Mostrador';
            currentSelectedPlayerUsername = '';
            currentSelectedPlayerPhone = '';
            clientSearchInput.value = 'Venta Mostrador';
            paymentStatusEl.value = 'PAID';
            clientDropdown.style.display = 'none';
            updateDebtBadge();
        });

        clientDropdown.querySelector('.btn-select-custom-name')?.addEventListener('click', () => {
            currentSelectedPlayerId = 'guest_walkin';
            currentSelectedPlayerName = rawTerm;
            currentSelectedPlayerUsername = '';
            currentSelectedPlayerPhone = '';
            clientSearchInput.value = rawTerm;
            paymentStatusEl.value = 'PAID';
            clientDropdown.style.display = 'none';
            updateDebtBadge();
        });

        clientDropdown.querySelectorAll('.btn-select-matched-client').forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.dataset.id;
                const found = sortedClients.find(c => c.id === targetId);
                if (found) {
                    currentSelectedPlayerId = found.id;
                    currentSelectedPlayerName = found.name;
                    currentSelectedPlayerUsername = found.username || '';
                    currentSelectedPlayerPhone = found.phone || '';
                    clientSearchInput.value = `${found.name} (@${found.username || 'sin_tag'})`;
                }
                paymentStatusEl.value = 'PENDING';
                clientDropdown.style.display = 'none';
                updateDebtBadge();
            });
        });
    };

    // Eventos del input buscador
    clientSearchInput.addEventListener('focus', () => {
        renderClientDropdown(clientSearchInput.value);
    });

    clientSearchInput.addEventListener('click', () => {
        renderClientDropdown(clientSearchInput.value);
    });

    clientSearchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        renderClientDropdown(val);

        // Si escribe algo libremente, asumir nombre de venta general temporalmente
        if (val.trim()) {
            currentSelectedPlayerId = 'guest_walkin';
            currentSelectedPlayerName = val.trim();
            currentSelectedPlayerUsername = '';
            currentSelectedPlayerPhone = '';
        }
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!modalEl.contains(e.target)) return;
        if (!clientSearchInput.contains(e.target) && !clientDropdown.contains(e.target)) {
            clientDropdown.style.display = 'none';
            updateDebtBadge();
        }
    });

    modalEl.querySelector('#btn-clear-pos-client').onclick = () => {
        currentSelectedPlayerId = 'guest_walkin';
        currentSelectedPlayerName = 'Venta Mostrador';
        currentSelectedPlayerUsername = '';
        currentSelectedPlayerPhone = '';
        clientSearchInput.value = '';
        paymentStatusEl.value = 'PAID';
        clientDropdown.style.display = 'none';
        updateDebtBadge();
    };

    updateDebtBadge();

    // Función auxiliar para recalcular y renderizar el carrito
    const updateCartUI = () => {
        const cartContainer = modalEl.querySelector('#pos-cart-items');
        const totalDisplay = modalEl.querySelector('#pos-total-display');

        let total = 0;
        cart.forEach(item => {
            total += item.subtotal;
        });

        // Sumar concepto custom si existe
        const cPrice = parseFloat(modalEl.querySelector('#custom-price-input')?.value) || 0;
        total += cPrice;

        totalDisplay.innerText = `${currency}${total.toFixed(2)}`;

        if (cart.size === 0 && cPrice === 0) {
            cartContainer.innerHTML = `
                <div style="text-align:center; padding:14px; color:var(--text-muted); font-size:0.82rem;" id="pos-empty-cart-msg">
                    Haz clic en los productos de arriba para agregarlos a la cuenta.
                </div>
            `;
            return;
        }

        cartContainer.innerHTML = Array.from(cart.values()).map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:6px 10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; align-items:center; gap:8px; flex:2;">
                    <span style="font-size:1.1rem;">${item.icon}</span>
                    <div>
                        <strong style="color:#ffffff; font-size:0.85rem; display:block;">${item.name}</strong>
                        <small style="color:var(--text-muted); font-size:0.75rem;">${currency}${item.unitPrice.toFixed(2)} c/u</small>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:6px;">
                    <button type="button" class="btn btn-outline btn-xs btn-qty-minus" data-id="${item.id}" style="width:26px; height:26px; padding:0; font-weight:900;">-</button>
                    <span style="font-family:var(--font-mono); font-weight:700; min-width:20px; text-align:center; color:#ffffff;">${item.quantity}</span>
                    <button type="button" class="btn btn-outline btn-xs btn-qty-plus" data-id="${item.id}" style="width:26px; height:26px; padding:0; font-weight:900;">+</button>
                </div>

                <div style="font-family:var(--font-mono); font-weight:900; color:var(--color-neon-gold); font-size:0.95rem; min-width:65px; text-align:right;">
                    ${currency}${item.subtotal.toFixed(2)}
                </div>

                <button type="button" class="btn btn-danger btn-xs btn-remove-item" data-id="${item.id}" style="margin-left:8px; padding:2px 6px;">✕</button>
            </div>
        `).join('');

        // Listeners en botones de cantidad + / -
        cartContainer.querySelectorAll('.btn-qty-plus').forEach(b => {
            b.onclick = () => {
                const id = b.dataset.id;
                const it = cart.get(id);
                if (it) {
                    it.quantity += 1;
                    it.subtotal = it.quantity * it.unitPrice;
                    updateCartUI();
                }
            };
        });

        cartContainer.querySelectorAll('.btn-qty-minus').forEach(b => {
            b.onclick = () => {
                const id = b.dataset.id;
                const it = cart.get(id);
                if (it) {
                    it.quantity -= 1;
                    if (it.quantity <= 0) {
                        cart.delete(id);
                    } else {
                        it.subtotal = it.quantity * it.unitPrice;
                    }
                    updateCartUI();
                }
            };
        });

        cartContainer.querySelectorAll('.btn-remove-item').forEach(b => {
            b.onclick = () => {
                const id = b.dataset.id;
                cart.delete(id);
                updateCartUI();
            };
        });
    };

    // Eventos de click en productos del grid
    modalEl.querySelectorAll('.btn-add-pos-item').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            const price = parseFloat(btn.dataset.price) || 0;
            const icon = btn.dataset.icon || '🛍️';
            const category = btn.dataset.category || 'otro';

            if (cart.has(id)) {
                const existing = cart.get(id);
                existing.quantity += 1;
                existing.subtotal = existing.quantity * existing.unitPrice;
            } else {
                cart.set(id, {
                    id,
                    name,
                    category,
                    icon,
                    unitPrice: price,
                    quantity: 1,
                    subtotal: price
                });
            }
            updateCartUI();
        };
    });

    // Buscador rápido de productos
    modalEl.querySelector('#pos-product-search').oninput = (e) => {
        const term = e.target.value.toLowerCase().trim();
        modalEl.querySelectorAll('.btn-add-pos-item').forEach(btn => {
            const name = btn.dataset.name.toLowerCase();
            btn.style.display = name.includes(term) ? 'flex' : 'none';
        });
    };

    // Botón Otro Concepto
    modalEl.querySelector('#btn-toggle-custom-item').onclick = () => {
        const row = modalEl.querySelector('#custom-item-row');
        row.style.display = row.style.display === 'none' ? 'block' : 'none';
    };
    modalEl.querySelector('#custom-price-input').oninput = updateCartUI;

    modalEl.querySelector('#btn-cancel-pos').onclick = () => modal.close();

    // Enviar venta con protección contra doble clic e idempotencia
    const submitBtn = modalEl.querySelector('#btn-submit-pos');
    const modalIdempotencyKey = `pos_${business.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    submitBtn.onclick = async () => {
        const paymentStatus = modalEl.querySelector('#pos-payment-status').value;
        const paymentMethod = modalEl.querySelector('#pos-payment-method').value;
        const customC = modalEl.querySelector('#custom-concept-input')?.value.trim();
        const customP = parseFloat(modalEl.querySelector('#custom-price-input')?.value) || 0;

        if (cart.size === 0 && (!customC || customP <= 0)) {
            toast.error("Selecciona al menos un producto o ingresa un concepto con precio.");
            return;
        }

        // Validar nombre final
        let finalPlayerId = currentSelectedPlayerId || 'guest_walkin';
        let finalPlayerName = currentSelectedPlayerName || clientSearchInput.value.trim() || 'Venta Mostrador';
        let finalPlayerUsername = currentSelectedPlayerUsername || '';
        let finalPlayerPhone = currentSelectedPlayerPhone || '';

        // Si escribió algo en el buscador pero no seleccionó dropdown
        if (clientSearchInput.value.trim() && finalPlayerId === 'guest_walkin') {
            finalPlayerName = clientSearchInput.value.trim();
        }

        // Bloqueo reactivo de interfaz contra dobles envíos
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>⏳ Procesando venta atómica...</span>';

        try {
            await accountManager.recordSale({
                businessId: business.id,
                playerId: finalPlayerId,
                playerUsername: finalPlayerUsername,
                playerName: finalPlayerName,
                playerPhone: finalPlayerPhone,
                items: Array.from(cart.values()),
                customConcept: customC,
                customPrice: customP,
                paymentStatus,
                paymentMethod,
                idempotencyKey: modalIdempotencyKey
            });

            toast.success(`Venta / Consumo registrado a nombre de "${finalPlayerName}".`);
            modal.close();
            renderAccountsView(mainContainer);
        } catch (e) {
            toast.error(e.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    };
}

// =============================================================================
// MODAL DE PAGO / ABONO / LIQUIDACIÓN DIRECTA
// =============================================================================
async function openPaymentModal(business, playerId, mainContainer) {
    const currency = business.currencySymbol || '$';
    const clients = await getAllAvailableClients();
    const client = clients.find(c => c.id === playerId) || { name: 'Jugador', username: '' };
    const account = await accountManager.getPlayerAccount(business.id, playerId);

    const defaultAmount = account.netDebt > 0 ? account.netDebt : 50;

    const contentHtml = `
        <form id="form-quick-payment" class="cyber-form">
            <div style="background:var(--bg-dark-700); border-left:4px solid var(--color-neon-lime); padding:12px; border-radius:4px; margin-bottom:14px;">
                <strong style="font-size:1.05rem; color:#ffffff; display:block;">${escapeHTML(client.name)}</strong>
                ${client.username ? `<span style="color:var(--color-neon-cyan); font-size:0.8rem; font-family:var(--font-mono);">@${escapeHTML(client.username)}</span>` : ''}
                <div style="margin-top:6px; font-size:0.85rem;">
                    Saldo Pendiente Actual: <strong style="color:var(--color-neon-pink); font-family:var(--font-mono);">${currency}${account.netDebt.toFixed(2)}</strong>
                </div>
            </div>

            <div class="form-group">
                <label for="pay-amount"><span class="neon-arrow">◆</span> Monto a Recibir / Abonar ($) *</label>
                <input type="number" id="pay-amount" class="cyber-input" value="${defaultAmount}" min="1" step="0.5" style="font-size:1.2rem; font-weight:700; font-family:var(--font-mono);" required>
            </div>

            <div class="form-group">
                <label for="pay-method"><span class="neon-arrow">◆</span> Forma de Pago *</label>
                <select id="pay-method" class="cyber-select">
                    <option value="CASH" selected>💵 Efectivo en Caja</option>
                    <option value="CARD">💳 Tarjeta Débito / Crédito</option>
                    <option value="TRANSFER">📱 Transferencia SPEI</option>
                </select>
            </div>

            <div class="form-group">
                <label for="pay-notes"><span class="neon-arrow">◆</span> Notas / Observaciones (Opcional)</label>
                <input type="text" id="pay-notes" class="cyber-input" placeholder="Ej. Liquidación de cuenta o anticipo">
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-pay">Cancelar</button>
        <button type="button" class="btn btn-success" id="btn-save-pay">💾 Registrar Cobro / Abono</button>
    `;

    const modalEl = modal.open({
        title: 'Registrar Cobro / Abono a Cuenta',
        icon: '💵',
        contentHtml,
        footerHtml,
        maxWidth: '460px'
    });

    modalEl.querySelector('#btn-cancel-pay').onclick = () => modal.close();

    const savePayBtn = modalEl.querySelector('#btn-save-pay');
    const payIdempotencyKey = `pay_${business.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    savePayBtn.onclick = async () => {
        const amount = parseFloat(modalEl.querySelector('#pay-amount').value) || 0;
        const paymentMethod = modalEl.querySelector('#pay-method').value;
        const notes = modalEl.querySelector('#pay-notes').value.trim();

        if (amount <= 0) {
            toast.error("El monto debe ser mayor a 0.");
            return;
        }

        savePayBtn.disabled = true;
        const origPayText = savePayBtn.innerHTML;
        savePayBtn.innerHTML = '<span>⏳ Registrando abono...</span>';

        try {
            await accountManager.recordPayment({
                businessId: business.id,
                playerId: playerId,
                playerName: client.name,
                playerUsername: client.username,
                amount,
                paymentMethod,
                notes: notes || 'Abono / Liquidación de saldo',
                idempotencyKey: payIdempotencyKey
            });

            toast.success(`Abono de ${currency}${amount.toFixed(2)} registrado exitosamente.`);
            modal.close();
            renderAccountsView(mainContainer);
        } catch (e) {
            toast.error(e.message);
            savePayBtn.disabled = false;
            savePayBtn.innerHTML = origPayText;
        }
    };
}

// =============================================================================
// MODAL DE ESTADO DE CUENTA DETALLADO DEL CLIENTE
// =============================================================================
async function openStatementModal(business, playerId) {
    const currency = business.currencySymbol || '$';
    const clients = await getAllAvailableClients();
    const client = clients.find(c => c.id === playerId) || { name: 'Jugador', username: '' };
    const account = await accountManager.getPlayerAccount(business.id, playerId);

    const contentHtml = `
        <div style="display:flex; flex-direction:column; gap:14px;">
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; text-align:center;">
                <div style="background:var(--bg-dark-900); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                    <small style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">Total Consumido</small>
                    <strong style="display:block; font-size:1.1rem; color:#ffffff; font-family:var(--font-mono);">${currency}${account.totalConsumed.toFixed(2)}</strong>
                </div>
                <div style="background:var(--bg-dark-900); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                    <small style="color:var(--color-neon-lime); font-size:0.75rem; text-transform:uppercase;">Total Abonado</small>
                    <strong style="display:block; font-size:1.1rem; color:var(--color-neon-lime); font-family:var(--font-mono);">${currency}${account.totalAbonos.toFixed(2)}</strong>
                </div>
                <div style="background:var(--bg-dark-900); padding:10px; border-radius:4px; border:1px solid ${account.netDebt > 0 ? 'var(--color-neon-pink)' : 'rgba(255,255,255,0.08)'};">
                    <small style="color:var(--color-neon-pink); font-size:0.75rem; text-transform:uppercase;">Saldo Pendiente</small>
                    <strong style="display:block; font-size:1.1rem; color:var(--color-neon-pink); font-family:var(--font-mono);">${currency}${account.netDebt.toFixed(2)}</strong>
                </div>
            </div>

            <div style="max-height:260px; overflow-y:auto; border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                <table class="catalogs-table" style="margin:0; font-size:0.85rem;">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Concepto</th>
                            <th style="text-align:right;">Monto</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${account.transactions.length === 0 ? `
                            <tr><td colspan="4" style="text-align:center; padding:16px; color:var(--text-muted);">Sin movimientos registrados.</td></tr>
                        ` : account.transactions.map(t => `
                            <tr style="${t.status === 'CANCELLED' ? 'opacity:0.4; text-decoration:line-through;' : ''}">
                                <td style="font-family:var(--font-mono); font-size:0.78rem;">${(t.createdAt || '').slice(0, 10)}</td>
                                <td>${t.type === 'ABONO' ? '💵 Abono a cuenta' : escapeHTML(t.concept || 'Consumo')}</td>
                                <td style="text-align:right; font-family:var(--font-mono); font-weight:700; color:${t.type === 'ABONO' ? 'var(--color-neon-lime)' : '#ffffff'};">
                                    ${t.type === 'ABONO' ? '+' : ''}${currency}${Number(t.totalAmount).toFixed(2)}
                                </td>
                                <td>
                                    <span class="badge ${t.status === 'CANCELLED' ? 'badge-danger' : t.type === 'ABONO' ? 'badge-success' : t.paymentStatus === 'PAID' ? 'badge-primary' : 'badge-warning'}">
                                        ${t.status === 'CANCELLED' ? 'ANULADO' : t.type === 'ABONO' ? 'ABONO' : t.paymentStatus === 'PAID' ? 'PAGADO' : 'FIADO'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    modal.open({
        title: `Estado de Cuenta: ${escapeHTML(client.name)}`,
        icon: '📜',
        contentHtml,
        footerHtml: `<button type="button" class="btn btn-primary" onclick="window.__closeCurrentModal()">Cerrar</button>`,
        maxWidth: '540px'
    });
}
