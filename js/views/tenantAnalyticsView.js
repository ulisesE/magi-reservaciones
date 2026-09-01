// js/views/tenantAnalyticsView.js
// Panel de Rendimiento y Analítica de Negocio para Locatarios / Encargados
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { 
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    query, 
    where 
} from '../firebaseConfig.js';
import { formatDateKey } from '../core/timeUtils.js';
import { toast } from '../components/toast.js';

// Estado local de la vista
let currentPreset = 'THIS_MONTH'; // 'TODAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_30_DAYS', 'ALL', 'CUSTOM'
let filterStartDate = '';
let filterEndDate = '';
let cachedReservations = [];
let chartInstances = {};

export async function renderTenantAnalyticsView(container) {
    const business = store.currentBusiness || tenantManager.getActiveBusiness();
    const currency = business?.currencySymbol || '$';
    const currencyCode = business?.currency || 'MXN';

    // Inicializar fechas según el preset activo si no están definidas
    if (!filterStartDate || !filterEndDate) {
        setDatesByPreset(currentPreset);
    }

    container.innerHTML = `
        <div class="analytics-view-wrapper animate-fade-in">
            <!-- Header de la Vista -->
            <div class="view-header-bar">
                <div class="header-left">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:1.9rem;">📈</span>
                        <div>
                            <h2 class="friendly-date-title">Rendimiento y Analítica del Negocio</h2>
                            <p class="subtitle-text">Métricas en tiempo real, ingresos, ocupación de máquinas y análisis de clientes para: <strong>${business?.name || 'Local'}</strong></p>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                    <button class="btn btn-outline" id="btn-export-analytics-csv" title="Descargar reporte detallado en archivo CSV">
                        <span>📥 Exportar CSV</span>
                    </button>
                    <button class="btn btn-primary glow-red" id="btn-refresh-analytics" title="Recargar datos desde Firestore">
                        <span>🔄 Actualizar Métricas</span>
                    </button>
                </div>
            </div>

            <!-- Barra de Filtros por Periodo -->
            <div class="analytics-filter-container">
                <div class="analytics-presets-bar">
                    <button type="button" class="analytics-preset-btn ${currentPreset === 'TODAY' ? 'active' : ''}" data-preset="TODAY">
                        <span>📅 Hoy</span>
                    </button>
                    <button type="button" class="analytics-preset-btn ${currentPreset === 'THIS_WEEK' ? 'active' : ''}" data-preset="THIS_WEEK">
                        <span>📊 Esta Semana</span>
                    </button>
                    <button type="button" class="analytics-preset-btn ${currentPreset === 'THIS_MONTH' ? 'active' : ''}" data-preset="THIS_MONTH">
                        <span>🗓️ Este Mes</span>
                    </button>
                    <button type="button" class="analytics-preset-btn ${currentPreset === 'LAST_30_DAYS' ? 'active' : ''}" data-preset="LAST_30_DAYS">
                        <span>⏳ Últimos 30 Días</span>
                    </button>
                    <button type="button" class="analytics-preset-btn ${currentPreset === 'ALL' ? 'active' : ''}" data-preset="ALL">
                        <span>🌐 Todo el Histórico</span>
                    </button>
                </div>

                <div class="analytics-date-custom-group">
                    <span style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">Rango:</span>
                    <input type="date" id="analytics-date-from" class="analytics-date-input" value="${filterStartDate}" ${currentPreset === 'ALL' ? 'disabled' : ''}>
                    <span style="color:var(--text-dimmed);">al</span>
                    <input type="date" id="analytics-date-to" class="analytics-date-input" value="${filterEndDate}" ${currentPreset === 'ALL' ? 'disabled' : ''}>
                    <button type="button" id="btn-apply-custom-dates" class="btn btn-secondary btn-xs" ${currentPreset === 'ALL' ? 'disabled' : ''}>
                        Aplicar
                    </button>
                </div>
            </div>

            <!-- Contenedor Dinámico de KPIs y Gráficas -->
            <div id="analytics-dynamic-content">
                <div style="text-align:center; padding:50px 20px;">
                    <div style="font-size:2.5rem; margin-bottom:12px; animation:spin 1.5s infinite linear;">⚡</div>
                    <p style="color:var(--text-muted); font-family:var(--font-mono); letter-spacing:1px;">PROCESANDO MÉTRICAS DE FIRESTORE...</p>
                </div>
            </div>
        </div>
    `;

    // Cargar y procesar datos
    await loadAndRenderAnalyticsData(container, business);

    // Configurar listeners de eventos
    setupEventListeners(container, business);
}

function setDatesByPreset(preset) {
    const today = new Date();
    currentPreset = preset;

    if (preset === 'TODAY') {
        const todayStr = formatDateKey(today);
        filterStartDate = todayStr;
        filterEndDate = todayStr;
    } else if (preset === 'THIS_WEEK') {
        const d = new Date(today);
        const dayOfWeek = d.getDay(); // 0 = Domingo
        const diffToMonday = (dayOfWeek + 6) % 7;
        d.setDate(d.getDate() - diffToMonday);
        filterStartDate = formatDateKey(d);

        const endD = new Date(d);
        endD.setDate(endD.getDate() + 6);
        filterEndDate = formatDateKey(endD);
    } else if (preset === 'THIS_MONTH') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        filterStartDate = formatDateKey(firstDay);
        filterEndDate = formatDateKey(lastDay);
    } else if (preset === 'LAST_30_DAYS') {
        const past30 = new Date(today);
        past30.setDate(past30.getDate() - 29);
        filterStartDate = formatDateKey(past30);
        filterEndDate = formatDateKey(today);
    } else if (preset === 'ALL') {
        filterStartDate = '2020-01-01';
        filterEndDate = '2030-12-31';
    }
}

async function loadAndRenderAnalyticsData(container, business) {
    const dynamicContent = container.querySelector('#analytics-dynamic-content');
    if (!dynamicContent) return;

    try {
        const bizId = business?.id;
        let allReservations = [];

        // Consultar reservas de Firestore
        if (isFirebaseAvailable && db && bizId) {
            try {
                const q = query(
                    collection(db, COLLECTIONS.RESERVATIONS),
                    where("businessId", "==", bizId)
                );
                const snap = await getDocs(q);
                snap.forEach(d => {
                    allReservations.push({ id: d.id, ...d.data() });
                });
            } catch (err) {
                console.warn("Fallo lectura directa Firestore en Analytics, usando store local:", err);
            }
        }

        // Fallback a reservas locales si Firestore no devolvió datos
        if (allReservations.length === 0) {
            allReservations = [...store.reservations, ...store.pendingReservations];
            const localData = localStorage.getItem(`piu_reservations_${bizId}`);
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    parsed.forEach(p => {
                        if (!allReservations.some(item => item.id === p.id)) {
                            allReservations.push(p);
                        }
                    });
                } catch(e) {}
            }
        }

        cachedReservations = allReservations;

        // Filtrar por rango de fechas
        const filteredReservations = allReservations.filter(r => {
            if (currentPreset === 'ALL') return true;
            if (!r.date) return false;
            return r.date >= filterStartDate && r.date <= filterEndDate;
        });

        // Obtener catálogo de máquinas del local
        const machines = store.machines.length > 0 ? store.machines : (business?.machines || []);

        // Calcular Estadísticas y Métricas
        const stats = calculateAnalyticsMetrics(filteredReservations, machines, business, filterStartDate, filterEndDate);

        // Renderizar el contenido completo
        renderAnalyticsDashboard(dynamicContent, stats, business, filteredReservations);

    } catch (error) {
        console.error("Error cargando analítica:", error);
        dynamicContent.innerHTML = `
            <div class="empty-state-container">
                <span class="empty-icon">⚠️</span>
                <h3>Ocurrió un error al calcular las métricas</h3>
                <p>${error.message || 'Error de conexión'}</p>
                <button class="btn btn-outline" id="btn-retry-analytics" style="margin-top:10px;">Reintentar</button>
            </div>
        `;
        dynamicContent.querySelector('#btn-retry-analytics')?.addEventListener('click', () => {
            renderTenantAnalyticsView(container);
        });
    }
}

function calculateAnalyticsMetrics(reservations, machines, business, startStr, endStr) {
    const confirmedRes = reservations.filter(r => r.status === 'CONFIRMED' || r.status === 'COMPLETED');
    const pendingRes = reservations.filter(r => r.status === 'PENDING');
    const cancelledRes = reservations.filter(r => r.status === 'CANCELLED' || r.status === 'REJECTED');
    const totalCount = reservations.length;

    // Ingresos
    const totalRevenue = confirmedRes.reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);
    const potentialRevenue = reservations.reduce((sum, r) => {
        if (r.status !== 'CANCELLED' && r.status !== 'REJECTED') {
            return sum + (Number(r.totalCost) || 0);
        }
        return sum;
    }, 0);

    // Horas reservadas
    let totalMinutes = 0;
    confirmedRes.forEach(r => {
        if (r.durationMinutes) {
            totalMinutes += Number(r.durationMinutes);
        } else if (r.startTime && r.endTime) {
            const [sh, sm] = r.startTime.split(':').map(Number);
            const [eh, em] = r.endTime.split(':').map(Number);
            const diff = (eh * 60 + em) - (sh * 60 + sm);
            totalMinutes += diff > 0 ? diff : 60;
        } else {
            totalMinutes += 60;
        }
    });
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    // Ticket promedio y costo por hora
    const ticketAverage = confirmedRes.length > 0 ? Math.round(totalRevenue / confirmedRes.length) : 0;
    const revenuePerHour = totalHours > 0 ? Math.round(totalRevenue / totalHours) : 0;

    // Tasas
    const confirmationRate = totalCount > 0 ? Math.round((confirmedRes.length / totalCount) * 100) : 0;
    const cancellationRate = totalCount > 0 ? Math.round((cancelledRes.length / totalCount) * 100) : 0;

    // Estimación de Capacidad y Utilización de Máquinas
    let daysCount = 1;
    if (currentPreset !== 'ALL' && startStr && endStr) {
        const s = new Date(startStr);
        const e = new Date(endStr);
        const diffTime = Math.abs(e - s);
        daysCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    } else {
        // Para histórico total estimamos días con base en las reservas
        const uniqueDates = new Set(reservations.map(r => r.date).filter(Boolean));
        daysCount = Math.max(1, uniqueDates.size);
    }

    const machCount = Math.max(1, machines.length);
    // Horas operativas estimadas por día (promedio 12 horas: 10:00 a 22:00)
    const dailyOperatingHours = 12;
    const totalAvailableHours = daysCount * machCount * dailyOperatingHours;
    const overallUtilization = Math.min(100, Math.round((totalHours / (totalAvailableHours || 1)) * 100));

    // Desglose por Máquina y Comisiones
    let totalCommissionsPayout = 0;
    let totalLocalNetRevenue = 0;
    let commissionMachinesCount = 0;

    const machineStats = machines.map(m => {
        const mConfirmed = confirmedRes.filter(r => r.machineId === m.id);
        const mRevenue = mConfirmed.reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);
        let mMins = 0;
        mConfirmed.forEach(r => {
            mMins += Number(r.durationMinutes) || 60;
        });
        const mHours = Math.round((mMins / 60) * 10) / 10;
        const mCapacityHours = daysCount * dailyOperatingHours;
        const mUtil = Math.min(100, Math.round((mHours / (mCapacityHours || 1)) * 100));

        // Esquema de Comisión
        const isCommission = m.ownershipType === 'COMMISSION';
        if (isCommission) commissionMachinesCount++;
        const partnerPct = isCommission ? (Number(m.partnerPercentage) || 50) : 0;
        const localPct = 100 - partnerPct;
        const partnerPayout = isCommission ? Math.round((mRevenue * (partnerPct / 100)) * 100) / 100 : 0;
        const localNet = isCommission ? Math.round((mRevenue - partnerPayout) * 100) / 100 : mRevenue;

        totalCommissionsPayout += partnerPayout;
        totalLocalNetRevenue += localNet;

        return {
            id: m.id,
            name: m.name,
            model: m.model || 'Pump It Up',
            version: m.version || 'Phoenix',
            ownershipType: m.ownershipType || 'OWNED',
            partnerName: m.partnerName || '',
            partnerPercentage: partnerPct,
            localPercentage: localPct,
            bookingsCount: mConfirmed.length,
            hours: mHours,
            revenue: mRevenue,
            partnerPayout,
            localNet,
            utilization: mUtil
        };
    });

    // Desglose por Día para Gráfica Temporal
    const dateGroups = {};
    reservations.forEach(r => {
        const d = r.date || 'Sin fecha';
        if (!dateGroups[d]) {
            dateGroups[d] = { date: d, revenue: 0, confirmed: 0, pending: 0, cancelled: 0, hours: 0 };
        }
        if (r.status === 'CONFIRMED' || r.status === 'COMPLETED') {
            dateGroups[d].revenue += (Number(r.totalCost) || 0);
            dateGroups[d].confirmed += 1;
            dateGroups[d].hours += ((Number(r.durationMinutes) || 60) / 60);
        } else if (r.status === 'PENDING') {
            dateGroups[d].pending += 1;
        } else if (r.status === 'CANCELLED' || r.status === 'REJECTED') {
            dateGroups[d].cancelled += 1;
        }
    });

    const sortedDates = Object.keys(dateGroups).sort();
    const trendData = sortedDates.map(d => dateGroups[d]);

    // Desglose por Hora del Día (Horas Pico)
    const hoursDist = Array.from({ length: 14 }, (_, i) => ({ hour: i + 10, label: `${i + 10}:00`, count: 0, revenue: 0 }));
    confirmedRes.forEach(r => {
        if (r.startTime) {
            const h = parseInt(r.startTime.split(':')[0], 10);
            if (h >= 10 && h <= 23) {
                const idx = h - 10;
                if (hoursDist[idx]) {
                    hoursDist[idx].count += 1;
                    hoursDist[idx].revenue += (Number(r.totalCost) || 0);
                }
            }
        }
    });

    // Ranking de Clientes Frecuentes
    const clientMap = {};
    confirmedRes.forEach(r => {
        const key = r.clientPhone || r.clientName || 'Anónimo';
        if (!clientMap[key]) {
            clientMap[key] = {
                name: r.clientName || 'Cliente',
                phone: r.clientPhone || '',
                bookings: 0,
                hours: 0,
                spent: 0
            };
        }
        clientMap[key].bookings += 1;
        clientMap[key].hours += ((Number(r.durationMinutes) || 60) / 60);
        clientMap[key].spent += (Number(r.totalCost) || 0);
    });

    const topClients = Object.values(clientMap)
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 5);

    return {
        confirmedCount: confirmedRes.length,
        pendingCount: pendingRes.length,
        cancelledCount: cancelledRes.length,
        totalCount,
        totalRevenue,
        potentialRevenue,
        totalHours,
        ticketAverage,
        revenuePerHour,
        confirmationRate,
        cancellationRate,
        overallUtilization,
        totalCommissionsPayout,
        totalLocalNetRevenue,
        commissionMachinesCount,
        machineStats,
        trendData,
        hoursDist,
        topClients
    };
}

function renderAnalyticsDashboard(container, stats, business, filteredReservations) {
    const currency = business?.currencySymbol || '$';
    const currencyCode = business?.currency || 'MXN';

    container.innerHTML = `
        <!-- FILA DE TARJETAS KPI MAESTRAS -->
        <div class="analytics-kpi-grid">
            <!-- KPI 1: Ingresos Derivados -->
            <div class="analytics-kpi-card" style="--card-accent-color: #68F205;">
                <div>
                    <div class="kpi-header">
                        <span class="kpi-label">Ingresos Totales</span>
                        <div class="kpi-icon-pill" style="color:#68F205;">💰</div>
                    </div>
                    <div class="kpi-value" style="color:var(--color-neon-lime);">
                        ${currency}${stats.totalRevenue.toLocaleString()} <span style="font-size:0.9rem; font-weight:600; color:var(--text-muted);">${currencyCode}</span>
                    </div>
                </div>
                <div class="kpi-subtext">
                    <span>⚡ Potencial con pendientes: <strong>${currency}${stats.potentialRevenue.toLocaleString()}</strong></span>
                </div>
            </div>

            <!-- KPI 2: Total Reservaciones -->
            <div class="analytics-kpi-card" style="--card-accent-color: #00e5ff;">
                <div>
                    <div class="kpi-header">
                        <span class="kpi-label">Reservas Confirmadas</span>
                        <div class="kpi-icon-pill" style="color:#00e5ff;">🎟️</div>
                    </div>
                    <div class="kpi-value" style="color:#00e5ff;">
                        ${stats.confirmedCount} <span style="font-size:0.9rem; font-weight:600; color:var(--text-muted);">/ ${stats.totalCount} tot</span>
                    </div>
                </div>
                <div class="kpi-subtext">
                    <span>✅ Tasa de éxito: <strong>${stats.confirmationRate}%</strong> (${stats.pendingCount} pendientes)</span>
                </div>
            </div>

            <!-- KPI 3: Horas Reservadas -->
            <div class="analytics-kpi-card" style="--card-accent-color: #C3D91E;">
                <div>
                    <div class="kpi-header">
                        <span class="kpi-label">Horas de Juego</span>
                        <div class="kpi-icon-pill" style="color:#C3D91E;">⏳</div>
                    </div>
                    <div class="kpi-value" style="color:var(--color-chartreuse);">
                        ${stats.totalHours} <span style="font-size:0.9rem; font-weight:600; color:var(--text-muted);">hrs</span>
                    </div>
                </div>
                <div class="kpi-subtext">
                    <span>🕹️ Promedio: <strong>${stats.confirmedCount > 0 ? (stats.totalHours / stats.confirmedCount).toFixed(1) : 0} hrs</strong> / reserva</span>
                </div>
            </div>

            <!-- KPI 4: Utilización de Máquinas -->
            <div class="analytics-kpi-card" style="--card-accent-color: #ff9900;">
                <div>
                    <div class="kpi-header">
                        <span class="kpi-label">Utilización de Máquinas</span>
                        <div class="kpi-icon-pill" style="color:#ff9900;">⚡</div>
                    </div>
                    <div class="kpi-value" style="color:#ffb703;">
                        ${stats.overallUtilization}%
                    </div>
                </div>
                <div class="kpi-subtext">
                    <div class="machine-util-bar-track" style="margin-top:2px;">
                        <div class="machine-util-bar-fill" style="width:${Math.min(100, stats.overallUtilization)}%;"></div>
                    </div>
                </div>
            </div>

            <!-- KPI 5: Ticket Promedio -->
            <div class="analytics-kpi-card" style="--card-accent-color: #b388ff;">
                <div>
                    <div class="kpi-header">
                        <span class="kpi-label">Ticket Promedio</span>
                        <div class="kpi-icon-pill" style="color:#b388ff;">🏷️</div>
                    </div>
                    <div class="kpi-value" style="color:#b388ff;">
                        ${currency}${stats.ticketAverage}
                    </div>
                </div>
                <div class="kpi-subtext">
                    <span>💵 <strong>${currency}${stats.revenuePerHour}</strong> promedio por hora jugada</span>
                </div>
            </div>

            <!-- KPI 6: Cancelaciones y Rechazos -->
            <div class="analytics-kpi-card" style="--card-accent-color: #ff4466;">
                <div>
                    <div class="kpi-header">
                        <span class="kpi-label">Tasa Cancelación</span>
                        <div class="kpi-icon-pill" style="color:#ff4466;">❌</div>
                    </div>
                    <div class="kpi-value" style="color:#ff4466;">
                        ${stats.cancellationRate}%
                    </div>
                </div>
                <div class="kpi-subtext">
                    <span>⚠️ <strong>${stats.cancelledCount}</strong> reservaciones canceladas</span>
                </div>
            </div>

            <!-- FILA DE REPARTO DE COMISIONES (CONFIDENCIAL LOCATARIO) -->
            <div style="grid-column: 1 / -1; background:linear-gradient(135deg, rgba(20,24,35,0.98), rgba(12,15,22,0.98)); border:1px solid rgba(255, 193, 7, 0.4); border-radius:var(--radius-sm); padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; box-shadow:0 4px 20px rgba(0,0,0,0.4);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.6rem; background:rgba(255,193,7,0.1); padding:6px; border-radius:var(--radius-sm);">🤝</span>
                    <div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <strong style="color:#fff; font-size:0.95rem;">Reparto Financiero por Máquinas Comisionadas</strong>
                            <span class="badge ${stats.commissionMachinesCount > 0 ? 'badge-warning' : 'badge-dark'}" style="font-size:0.7rem;">
                                ${stats.commissionMachinesCount > 0 ? `${stats.commissionMachinesCount} comisionada(s)` : '100% máquinas propias'}
                            </span>
                        </div>
                        <p style="color:var(--text-muted); font-size:0.76rem; margin:2px 0 0 0;">Cálculo confidencial según porcentaje pactado con socios operadores de cada gabinete.</p>
                    </div>
                </div>
                <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
                    <div style="text-align:right; background:rgba(255,255,255,0.03); padding:6px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                        <small style="color:var(--text-muted); font-size:0.72rem; display:block;">Facturación Bruta</small>
                        <strong style="color:#fff; font-family:var(--font-mono); font-size:1.05rem;">${currency}${stats.totalRevenue.toLocaleString()}</strong>
                    </div>
                    <div style="text-align:right; background:rgba(255,193,7,0.06); padding:6px 12px; border-radius:var(--radius-sm); border:1px solid rgba(255,193,7,0.3);">
                        <small style="color:#FFC107; font-size:0.72rem; display:block; font-weight:700;">- Pago a Socios (${stats.commissionMachinesCount})</small>
                        <strong style="color:#FFC107; font-family:var(--font-mono); font-size:1.05rem;">-${currency}${stats.totalCommissionsPayout.toLocaleString()}</strong>
                    </div>
                    <div style="text-align:right; background:rgba(104,242,5,0.1); border:1px solid rgba(104,242,5,0.4); padding:6px 14px; border-radius:var(--radius-sm);">
                        <small style="color:var(--color-neon-lime); font-size:0.72rem; display:block; font-weight:700;">= Ingreso Neto Local</small>
                        <strong style="color:var(--color-neon-lime); font-family:var(--font-mono); font-size:1.25rem;">${currency}${stats.totalLocalNetRevenue.toLocaleString()}</strong>
                    </div>
                </div>
            </div>
        </div>

        <!-- SECCIÓN DE GRÁFICAS INTERACTIVAS (CHART.JS) -->
        <div class="analytics-charts-grid" style="margin-top:20px;">
            
            <!-- Gráfica 1: Evolución Temporal de Ingresos y Reservas -->
            <div class="analytics-chart-card chart-card-col-8">
                <div class="chart-header">
                    <h3 class="chart-title">
                        <span>📈 Evolución de Ingresos y Reservas en el Periodo</span>
                    </h3>
                    <span class="badge badge-success">● En Vivo</span>
                </div>
                <div class="chart-canvas-container">
                    <canvas id="chart-revenue-trend"></canvas>
                </div>
            </div>

            <!-- Gráfica 2: Distribución por Estado de Reserva -->
            <div class="analytics-chart-card chart-card-col-4">
                <div class="chart-header">
                    <h3 class="chart-title">
                        <span>🍩 Estados de Reserva</span>
                    </h3>
                </div>
                <div class="chart-canvas-container" style="display:flex; align-items:center; justify-content:center;">
                    <canvas id="chart-status-doughnut"></canvas>
                </div>
            </div>

            <!-- Gráfica 3: Rendimiento y Horas por Máquina -->
            <div class="analytics-chart-card chart-card-col-6">
                <div class="chart-header">
                    <h3 class="chart-title">
                        <span>🕹️ Ingresos y Horas por Máquina / Gabinete</span>
                    </h3>
                </div>
                <div class="chart-canvas-container">
                    <canvas id="chart-machine-performance"></canvas>
                </div>
            </div>

            <!-- Gráfica 4: Horas Pico y Demanda Horaria -->
            <div class="analytics-chart-card chart-card-col-6">
                <div class="chart-header">
                    <h3 class="chart-title">
                        <span>⏰ Horas Pico de Afluencia (Demanda Horaria)</span>
                    </h3>
                </div>
                <div class="chart-canvas-container">
                    <canvas id="chart-peak-hours"></canvas>
                </div>
            </div>
        </div>

        <!-- TABLAS DETALLADAS Y AUDITORÍA -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:20px; margin-top:20px;">
            
            <!-- Tabla 1: Desglose y Reparto por Máquina -->
            <div class="analytics-table-card">
                <div class="chart-header">
                    <h3 class="chart-title">
                        <span>🕹️ Detalle de Ocupación y Reparto por Máquina</span>
                    </h3>
                    <small style="color:var(--text-muted); font-size:0.75rem;">Confidencial Staff</small>
                </div>
                <div style="overflow-x:auto;">
                    <table class="cyber-analytics-table">
                        <thead>
                            <tr>
                                <th>Máquina</th>
                                <th>Esquema</th>
                                <th>Horas</th>
                                <th>Bruto</th>
                                <th style="color:#FFC107;">Pago Socio</th>
                                <th style="color:var(--color-neon-lime);">Neto Local</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stats.machineStats.map(m => `
                                <tr>
                                    <td>
                                        <strong style="color:#fff;">${m.name}</strong><br>
                                        <small style="color:var(--text-dimmed); font-size:0.72rem;">${m.model} • ${m.version}</small>
                                    </td>
                                    <td>
                                        ${m.ownershipType === 'COMMISSION' ? `
                                            <span class="badge badge-warning" style="font-size:0.7rem; display:inline-block;" title="Socio: ${m.partnerName || 'Sin asignar'}">
                                                🤝 ${m.partnerPercentage}% Socio
                                            </span><br>
                                            <small style="color:var(--text-muted); font-size:0.68rem;">${m.partnerName || 'Socio'}</small>
                                        ` : `
                                            <span class="badge badge-success" style="font-size:0.7rem;">
                                                🏢 100% Propia
                                            </span>
                                        `}
                                    </td>
                                    <td><strong>${m.hours} hrs</strong> (${m.bookingsCount} res)</td>
                                    <td><strong style="color:#fff; font-family:var(--font-mono);">${currency}${m.revenue.toLocaleString()}</strong></td>
                                    <td>
                                        ${m.partnerPayout > 0 ? `
                                            <strong style="color:#FFC107; font-family:var(--font-mono);">-${currency}${m.partnerPayout.toLocaleString()}</strong>
                                        ` : `
                                            <span style="color:var(--text-muted); font-size:0.8rem;">$0</span>
                                        `}
                                    </td>
                                    <td>
                                        <strong style="color:var(--color-neon-lime); font-family:var(--font-mono); font-size:0.95rem;">${currency}${m.localNet.toLocaleString()}</strong>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Tabla 2: Clientes Más Frecuentes del Periodo -->
            <div class="analytics-table-card">
                <div class="chart-header">
                    <h3 class="chart-title">
                        <span>👑 Top Clientes / Jugadores Frecuentes</span>
                    </h3>
                </div>
                <div style="overflow-x:auto;">
                    <table class="cyber-analytics-table">
                        <thead>
                            <tr>
                                <th>Jugador</th>
                                <th>Reservas</th>
                                <th>Horas</th>
                                <th>Inversión Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stats.topClients.length > 0 ? stats.topClients.map((c, i) => `
                                <tr>
                                    <td>
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <span style="font-size:1.1rem;">${i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '🎮'))}</span>
                                            <div>
                                                <strong style="color:#fff;">${c.name}</strong><br>
                                                <small style="color:var(--text-dimmed); font-size:0.75rem;">${c.phone || 'Sin tel'}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span class="badge badge-dark">${c.bookings}</span></td>
                                    <td><strong>${c.hours.toFixed(1)} hrs</strong></td>
                                    <td><strong style="color:var(--color-chartreuse); font-family:var(--font-mono);">${currency}${c.spent.toLocaleString()}</strong></td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">
                                        No hay suficientes datos de jugadores en este rango.
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- TABLA COMPLETA DE RESERVAS DEL PERIODO -->
        <div class="analytics-table-card" style="margin-top:20px;">
            <div class="chart-header">
                <h3 class="chart-title">
                    <span>📋 Auditoría de Reservaciones del Periodo (${filteredReservations.length})</span>
                </h3>
            </div>
            <div style="overflow-x:auto; max-height:400px; overflow-y:auto;">
                <table class="cyber-analytics-table">
                    <thead>
                        <tr>
                            <th>Fecha y Horario</th>
                            <th>Cliente</th>
                            <th>Máquina</th>
                            <th>Estado</th>
                            <th>Costo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredReservations.length > 0 ? filteredReservations.map(r => {
                            const mach = stats.machineStats.find(m => m.id === r.machineId);
                            const statusBadge = r.status === 'CONFIRMED' || r.status === 'COMPLETED'
                                ? `<span class="badge badge-success">Confirmada</span>`
                                : (r.status === 'PENDING' ? `<span class="badge badge-warning">Pendiente</span>` : `<span class="badge badge-danger">Cancelada</span>`);

                            return `
                                <tr>
                                    <td>
                                        <strong style="color:#fff;">${r.date || 'N/A'}</strong><br>
                                        <small style="color:var(--text-muted); font-family:var(--font-mono);">${r.startTime} - ${r.endTime}</small>
                                    </td>
                                    <td>
                                        <strong style="color:#fff;">${r.clientName || 'Cliente'}</strong><br>
                                        <small style="color:var(--text-dimmed);">${r.clientPhone || ''}</small>
                                    </td>
                                    <td>${mach?.name || r.machineId || 'Máquina'}</td>
                                    <td>${statusBadge}</td>
                                    <td><strong style="color:var(--color-neon-lime); font-family:var(--font-mono);">${currency}${r.totalCost || 0}</strong></td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">
                                    No se encontraron reservaciones en el periodo seleccionado.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Renderizar Gráficas con Chart.js
    renderCharts(stats, currency);
}

function renderCharts(stats, currency) {
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js no está cargado.");
        return;
    }

    // Destruir instancias previas para evitar memory leaks y parpadeos
    Object.values(chartInstances).forEach(chart => chart?.destroy?.());
    chartInstances = {};

    // Paleta de Colores Cyberpunk Oficial
    const COLOR_LIME = '#68F205';
    const COLOR_CHARTREUSE = '#C3D91E';
    const COLOR_EMERALD = '#088C4F';
    const COLOR_CYAN = '#00e5ff';
    const COLOR_RED = '#ff4466';

    // 1. Gráfica de Tendencia de Ingresos y Reservaciones
    const ctxTrend = document.getElementById('chart-revenue-trend')?.getContext('2d');
    if (ctxTrend) {
        const labels = stats.trendData.map(d => d.date);
        const revenues = stats.trendData.map(d => d.revenue);
        const bookings = stats.trendData.map(d => d.confirmed);

        chartInstances.trend = new Chart(ctxTrend, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['Sin datos'],
                datasets: [
                    {
                        type: 'line',
                        label: 'Reservas Confirmadas',
                        data: bookings.length > 0 ? bookings : [0],
                        borderColor: COLOR_CYAN,
                        backgroundColor: 'rgba(0, 229, 255, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y1',
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: COLOR_CYAN
                    },
                    {
                        type: 'bar',
                        label: `Ingresos (${currency})`,
                        data: revenues.length > 0 ? revenues : [0],
                        backgroundColor: 'rgba(104, 242, 5, 0.55)',
                        borderColor: COLOR_LIME,
                        borderWidth: 1,
                        yAxisID: 'y',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#9bb7ad', font: { family: 'Rajdhani', size: 11 } }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: COLOR_LIME,
                            callback: value => `${currency}${value}`
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: COLOR_CYAN, stepSize: 1 }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#f0fdf4', font: { family: 'Outfit', size: 12 } }
                    }
                }
            }
        });
    }

    // 2. Gráfica de Estados de Reserva (Doughnut)
    const ctxDoughnut = document.getElementById('chart-status-doughnut')?.getContext('2d');
    if (ctxDoughnut) {
        chartInstances.doughnut = new Chart(ctxDoughnut, {
            type: 'doughnut',
            data: {
                labels: ['Confirmadas', 'Pendientes', 'Canceladas'],
                datasets: [{
                    data: [stats.confirmedCount, stats.pendingCount, stats.cancelledCount],
                    backgroundColor: [
                        'rgba(104, 242, 5, 0.8)',
                        'rgba(195, 217, 30, 0.8)',
                        'rgba(255, 68, 102, 0.8)'
                    ],
                    borderColor: ['#68F205', '#C3D91E', '#ff4466'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#f0fdf4', font: { family: 'Outfit', size: 12 } }
                    }
                },
                cutout: '68%'
            }
        });
    }

    // 3. Gráfica de Rendimiento por Máquina
    const ctxMachine = document.getElementById('chart-machine-performance')?.getContext('2d');
    if (ctxMachine) {
        const machLabels = stats.machineStats.map(m => m.name);
        const machRevenues = stats.machineStats.map(m => m.revenue);
        const machHours = stats.machineStats.map(m => m.hours);

        chartInstances.machine = new Chart(ctxMachine, {
            type: 'bar',
            data: {
                labels: machLabels.length > 0 ? machLabels : ['Sin máquinas'],
                datasets: [
                    {
                        label: `Ingresos (${currency})`,
                        data: machRevenues,
                        backgroundColor: 'rgba(8, 140, 79, 0.7)',
                        borderColor: COLOR_EMERALD,
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Horas Jugadas',
                        data: machHours,
                        backgroundColor: 'rgba(195, 217, 30, 0.7)',
                        borderColor: COLOR_CHARTREUSE,
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#9bb7ad', font: { family: 'Outfit', size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#f0fdf4' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#f0fdf4', font: { family: 'Outfit', size: 12 } } }
                }
            }
        });
    }

    // 4. Gráfica de Horas Pico
    const ctxPeak = document.getElementById('chart-peak-hours')?.getContext('2d');
    if (ctxPeak) {
        chartInstances.peak = new Chart(ctxPeak, {
            type: 'bar',
            data: {
                labels: stats.hoursDist.map(h => h.label),
                datasets: [{
                    label: 'Reservas por Horario',
                    data: stats.hoursDist.map(h => h.count),
                    backgroundColor: 'rgba(0, 229, 255, 0.65)',
                    borderColor: COLOR_CYAN,
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#9bb7ad', font: { family: 'Rajdhani', size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#f0fdf4', stepSize: 1 }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#f0fdf4', font: { family: 'Outfit', size: 12 } } }
                }
            }
        });
    }
}

function setupEventListeners(container, business) {
    // Botones de presets de periodo
    container.querySelectorAll('.analytics-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            setDatesByPreset(preset);
            renderTenantAnalyticsView(container);
        });
    });

    // Botón de aplicar fechas personalizadas
    container.querySelector('#btn-apply-custom-dates')?.addEventListener('click', () => {
        const fromVal = container.querySelector('#analytics-date-from')?.value;
        const toVal = container.querySelector('#analytics-date-to')?.value;
        if (!fromVal || !toVal) {
            toast.warning("Selecciona ambas fechas para el rango.");
            return;
        }
        if (fromVal > toVal) {
            toast.warning("La fecha de inicio debe ser anterior a la de fin.");
            return;
        }
        currentPreset = 'CUSTOM';
        filterStartDate = fromVal;
        filterEndDate = toVal;
        renderTenantAnalyticsView(container);
    });

    // Botón de refresco manual
    container.querySelector('#btn-refresh-analytics')?.addEventListener('click', async () => {
        toast.info("Actualizando datos desde Firestore...");
        await renderTenantAnalyticsView(container);
        toast.success("Métricas actualizadas.");
    });

    // Botón de exportación a CSV
    container.querySelector('#btn-export-analytics-csv')?.addEventListener('click', () => {
        exportAnalyticsToCSV(cachedReservations, business);
    });
}

function exportAnalyticsToCSV(reservations, business) {
    if (!reservations || reservations.length === 0) {
        toast.warning("No hay reservaciones para exportar en este periodo.");
        return;
    }

    const filtered = reservations.filter(r => {
        if (currentPreset === 'ALL') return true;
        if (!r.date) return false;
        return r.date >= filterStartDate && r.date <= filterEndDate;
    });

    if (filtered.length === 0) {
        toast.warning("No hay reservaciones en el rango de fechas seleccionado.");
        return;
    }

    const machinesMap = {};
    (store.machines || []).forEach(m => {
        machinesMap[m.id] = m;
    });

    const headers = ["ID", "Fecha", "Inicio", "Fin", "Duracion_Min", "Cliente", "Telefono", "Maquina_ID", "Maquina_Nombre", "Esquema_Posesion", "Socio_Operador", "Pct_Socio", "Costo_Total", "Pago_Comision_Socio", "Neto_Local", "Estado", "Creado_El"];
    const rows = filtered.map(r => {
        const mach = machinesMap[r.machineId] || {};
        const cost = Number(r.totalCost) || 0;
        const isComm = mach.ownershipType === 'COMMISSION';
        const partnerPct = isComm ? (Number(mach.partnerPercentage) || 50) : 0;
        const partnerPayout = isComm && (r.status === 'CONFIRMED' || r.status === 'COMPLETED') ? Math.round((cost * (partnerPct / 100)) * 100) / 100 : 0;
        const localNet = (r.status === 'CONFIRMED' || r.status === 'COMPLETED') ? Math.round((cost - partnerPayout) * 100) / 100 : 0;

        return [
            `"${r.id || ''}"`,
            `"${r.date || ''}"`,
            `"${r.startTime || ''}"`,
            `"${r.endTime || ''}"`,
            r.durationMinutes || 60,
            `"${(r.clientName || '').replace(/"/g, '""')}"`,
            `"${(r.clientPhone || '').replace(/"/g, '""')}"`,
            `"${(r.machineId || '').replace(/"/g, '""')}"`,
            `"${(mach.name || r.machineName || '').replace(/"/g, '""')}"`,
            `"${isComm ? 'COMISIONADA' : 'PROPIA'}"`,
            `"${(mach.partnerName || '').replace(/"/g, '""')}"`,
            isComm ? `${partnerPct}%` : '0%',
            cost,
            partnerPayout,
            localNet,
            `"${r.status || 'CONFIRMED'}"`,
            `"${r.createdAt || ''}"`
        ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Rendimiento_y_Comisiones_${business?.id || 'Local'}_${filterStartDate}_al_${filterEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Archivo CSV generado con desglose de comisiones.");
}
