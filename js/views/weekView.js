// js/views/weekView.js
// Vista Semana: Muestra los días de la semana con el número de reservaciones y desglose
import { store } from '../core/store.js';
import { 
    getWeekDays, 
    formatDateKey, 
    formatFriendlyDate, 
    format12Hour 
} from '../core/timeUtils.js';
import { openBookingModal } from './clientBookingModal.js';

export function renderWeekView(container) {
    const business = store.currentBusiness;
    const machines = store.getActiveMachines();
    const selectedDate = store.selectedDate || formatDateKey(new Date());
    
    // Obtener los 7 días de la semana actual
    const weekDays = getWeekDays(new Date(selectedDate + 'T00:00:00'));
    
    // Navegación de semana (-7 días, +7 días)
    const currentFirstDay = new Date(weekDays[0].rawDate);
    const prevWeekDate = new Date(currentFirstDay);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const prevWeekKey = formatDateKey(prevWeekDate);

    const nextWeekDate = new Date(currentFirstDay);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekKey = formatDateKey(nextWeekDate);

    const weekReservations = store.getReservations({ excludeRejectedCancelled: true });

    // Métricas de la semana
    let totalWeekBookings = 0;
    let totalConfirmed = 0;
    let totalPending = 0;

    const daysData = weekDays.map(day => {
        const dayRes = weekReservations.filter(r => r.date === day.dateKey);
        const confirmed = dayRes.filter(r => r.status === 'CONFIRMED').length;
        const pending = dayRes.filter(r => r.status === 'PENDING').length;
        
        totalWeekBookings += dayRes.length;
        totalConfirmed += confirmed;
        totalPending += pending;

        return {
            ...day,
            reservations: dayRes,
            totalCount: dayRes.length,
            confirmedCount: confirmed,
            pendingCount: pending
        };
    });

    const weekTitle = `${weekDays[0].dayNumber} de ${formatFriendlyDate(weekDays[0].dateKey).split('de ')[1]} - ${weekDays[6].dayNumber} de ${formatFriendlyDate(weekDays[6].dateKey).split('de ')[1]}`;

    container.innerHTML = `
        <div class="week-view-wrapper animate-fade-in">
            <!-- Header de Navegación de Semana -->
            <div class="view-header-bar">
                <div class="date-navigator">
                    <button class="btn btn-icon btn-secondary" id="btn-prev-week" title="Semana anterior">◀</button>
                    <div class="current-date-info">
                        <h2 class="friendly-date-title">Semana: ${weekTitle}</h2>
                        <span class="badge badge-primary">${totalWeekBookings} Reservaciones en total</span>
                    </div>
                    <button class="btn btn-icon btn-secondary" id="btn-next-week" title="Semana siguiente">▶</button>
                    <button class="btn btn-secondary btn-sm" id="btn-current-week">Semana Actual</button>
                </div>

                <!-- Resumen rápido -->
                <div class="week-kpis">
                    <span class="kpi-pill"><strong class="highlight-green">${totalConfirmed}</strong> Confirmadas</span>
                    <span class="kpi-pill"><strong class="highlight-gold">${totalPending}</strong> Pendientes</span>
                </div>
            </div>

            <!-- Grid de 7 Tarjetas de la Semana -->
            <div class="week-cards-grid">
                ${daysData.map(d => {
                    const isSelected = d.dateKey === selectedDate;
                    return `
                        <div class="week-day-card ${d.isToday ? 'card-today' : ''} ${isSelected ? 'card-selected' : ''}" data-date="${d.dateKey}">
                            <div class="day-card-header">
                                <div class="day-card-name">${d.dayName}</div>
                                <div class="day-card-number ${d.isToday ? 'glow-red' : ''}">${d.dayNumber}</div>
                                ${d.isToday ? '<span class="badge-mini badge-today">HOY</span>' : ''}
                            </div>

                            <!-- Badge Contador de Reservaciones -->
                            <div class="day-booking-counter">
                                <div class="counter-number ${d.totalCount > 0 ? 'highlight-cyan' : 'dimmed'}">
                                    ${d.totalCount}
                                </div>
                                <div class="counter-label">
                                    ${d.totalCount === 1 ? 'Reservación' : 'Reservaciones'}
                                </div>
                            </div>

                            <!-- Indicadores de estado -->
                            <div class="day-status-breakdown">
                                <span class="breakdown-tag tag-conf">✓ ${d.confirmedCount} Conf.</span>
                                ${d.pendingCount > 0 ? `<span class="breakdown-tag tag-pend">⏳ ${d.pendingCount} Pend.</span>` : ''}
                            </div>

                            <!-- Mini Lista de Reservas del día -->
                            <div class="day-preview-list">
                                ${d.reservations.length === 0 ? `
                                    <div class="day-empty-hint">Máquinas disponibles</div>
                                ` : `
                                    ${d.reservations.slice(0, 3).map(r => {
                                        const mach = store.getMachineById(r.machineId);
                                        return `
                                            <div class="preview-res-item ${r.status === 'PENDING' ? 'item-pending' : ''}">
                                                <span class="res-time">${r.startTime}</span>
                                                <span class="res-client" title="${r.clientName}">${r.clientName}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                    ${d.reservations.length > 3 ? `<div class="res-more-tag">+${d.reservations.length - 3} más</div>` : ''}
                                `}
                            </div>

                            <!-- Botones de Acción -->
                            <div class="day-card-actions">
                                <button class="btn btn-outline btn-xs btn-open-day" data-date="${d.dateKey}">
                                    📅 Ver Grid de Día
                                </button>
                                <button class="btn btn-primary btn-xs btn-quick-book-day glow-red" data-date="${d.dateKey}">
                                    ➕ Reservar
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Eventos
    container.querySelector('#btn-prev-week')?.addEventListener('click', () => {
        store.setSelectedDate(prevWeekKey);
    });

    container.querySelector('#btn-next-week')?.addEventListener('click', () => {
        store.setSelectedDate(nextWeekKey);
    });

    container.querySelector('#btn-current-week')?.addEventListener('click', () => {
        store.setSelectedDate(formatDateKey(new Date()));
    });

    // Click en "Ver Grid de Día" -> Cambia fecha y pasa a Vista Día
    container.querySelectorAll('.btn-open-day').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const date = btn.dataset.date;
            store.setSelectedDate(date);
            store.setCurrentView('DAY');
        });
    });

    // Click en "Reservar" -> Abre modal de reserva con la fecha de ese día
    container.querySelectorAll('.btn-quick-book-day').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const date = btn.dataset.date;
            openBookingModal({ date });
        });
    });

    // Click en la tarjeta completa -> Selecciona y abre vista día
    container.querySelectorAll('.week-day-card').forEach(card => {
        card.addEventListener('click', () => {
            const date = card.dataset.date;
            store.setSelectedDate(date);
            store.setCurrentView('DAY');
        });
    });
}
