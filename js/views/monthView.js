// js/views/monthView.js
// Vista Mes: Calendario mensual interactivo con número de reservaciones por día
import { store } from '../core/store.js';
import { 
    getMonthDays, 
    MONTH_NAMES, 
    DAYS_OF_WEEK, 
    formatDateKey 
} from '../core/timeUtils.js';

export function renderMonthView(container) {
    const selectedDate = store.selectedDate || formatDateKey(new Date());
    const [selYear, selMonth] = selectedDate.split('-').map(Number);
    
    // Año y mes actual del visor (0-indexed)
    const currentYear = selYear;
    const currentMonth = selMonth - 1;

    // Obtener días del mes con padding
    const monthDays = getMonthDays(currentYear, currentMonth);

    // Actualizar suscripción de reservas en el store para el rango mensual
    store.updateReservationsSubscription(monthDays[0].dateKey, monthDays[monthDays.length - 1].dateKey);

    // Obtener conteo de reservaciones por día en este mes
    const counts = store.getMonthReservationsCount(currentYear, currentMonth);

    // Reservaciones del mes
    const monthReservations = store.getReservations({ excludeRejectedCancelled: true });

    // Navegación de mes
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthKey = formatDateKey(prevMonthDate);

    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const nextMonthKey = formatDateKey(nextMonthDate);

    // Total de reservas del mes
    const totalMonthReservations = Object.values(counts).reduce((acc, c) => acc + c, 0);

    container.innerHTML = `
        <div class="month-view-wrapper animate-fade-in">
            <!-- Header de Navegación de Mes -->
            <div class="view-header-bar">
                <div class="date-navigator">
                    <button class="btn btn-icon btn-secondary" id="btn-prev-month" title="Mes anterior">◀</button>
                    <div class="current-date-info">
                        <h2 class="friendly-date-title">${MONTH_NAMES[currentMonth]} ${currentYear}</h2>
                        <span class="badge badge-primary">${totalMonthReservations} Reservaciones este mes</span>
                    </div>
                    <button class="btn btn-icon btn-secondary" id="btn-next-month" title="Mes siguiente">▶</button>
                    <button class="btn btn-secondary btn-sm" id="btn-current-month">Mes Actual</button>
                </div>

                <div class="month-legend">
                    <span class="legend-item"><span class="legend-badge-sample badge-has-res">1+</span> Con Reservas</span>
                    <span class="legend-item"><span class="legend-badge-sample badge-high-res">3+</span> Alta Ocupación</span>
                </div>
            </div>

            <!-- Calendario Mensual -->
            <div class="calendar-month-card">
                <!-- Días de la semana -->
                <div class="month-weekdays-header">
                    ${DAYS_OF_WEEK.map(d => `<div class="weekday-cell">${d.short}</div>`).join('')}
                </div>

                <!-- Grid de Días -->
                <div class="month-days-grid">
                    ${monthDays.map(day => {
                        const count = counts[day.dateKey] || 0;
                        const isSelected = day.dateKey === selectedDate;
                        const hasReservations = count > 0;
                        const isHighOccupancy = count >= 3;

                        // Obtener preview de las reservas de este día
                        const dayBookings = hasReservations 
                            ? monthReservations.filter(r => r.date === day.dateKey) 
                            : [];

                        return `
                            <div class="month-day-cell ${day.isCurrentMonth ? '' : 'other-month'} ${day.isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${hasReservations ? 'has-bookings' : ''}" 
                                data-date="${day.dateKey}">
                                <div class="cell-day-header">
                                    <span class="day-num">${day.dayNumber}</span>
                                    ${day.isToday ? '<span class="today-dot" title="Hoy"></span>' : ''}
                                </div>

                                <div class="cell-day-body">
                                    ${hasReservations ? `
                                        <div class="res-count-badge ${isHighOccupancy ? 'badge-high-res' : 'badge-has-res'}" title="${count} reservaciones">
                                            <span class="res-badge-icon">🕹️</span>
                                            <strong class="res-badge-val">${count}</strong>
                                            <span class="res-badge-text">${count === 1 ? 'reserva' : 'reservas'}</span>
                                        </div>

                                        <div class="mini-players-list">
                                            ${dayBookings.slice(0, 2).map(r => `
                                                <div class="mini-player-item ${r.status === 'PENDING' ? 'mini-pending' : ''}">
                                                    • ${r.clientName}
                                                </div>
                                            `).join('')}
                                            ${dayBookings.length > 2 ? `<div class="mini-more">+${dayBookings.length - 2} más</div>` : ''}
                                        </div>
                                    ` : `
                                        <div class="no-bookings-hint">Disponible</div>
                                    `}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    // Eventos de Navegación de Mes
    container.querySelector('#btn-prev-month')?.addEventListener('click', () => {
        store.setSelectedDate(prevMonthKey);
    });

    container.querySelector('#btn-next-month')?.addEventListener('click', () => {
        store.setSelectedDate(nextMonthKey);
    });

    container.querySelector('#btn-current-month')?.addEventListener('click', () => {
        store.setSelectedDate(formatDateKey(new Date()));
    });

    // Click en cualquier celda del calendario -> Abre el Grid de Día para esa fecha
    const dayCells = container.querySelectorAll('.month-day-cell');
    dayCells.forEach(cell => {
        cell.addEventListener('click', () => {
            const date = cell.dataset.date;
            store.setSelectedDate(date);
            store.setCurrentView('DAY');
        });
    });
}
