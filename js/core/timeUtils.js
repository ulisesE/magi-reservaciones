// js/core/timeUtils.js
// Utilidades de fechas, horas y cálculo de slots para Pump It Up

export const DAYS_OF_WEEK = [
    { id: 0, name: 'Domingo', short: 'Dom' },
    { id: 1, name: 'Lunes', short: 'Lun' },
    { id: 2, name: 'Martes', short: 'Mar' },
    { id: 3, name: 'Miércoles', short: 'Mié' },
    { id: 4, name: 'Jueves', short: 'Jue' },
    { id: 5, name: 'Viernes', short: 'Vie' },
    { id: 6, name: 'Sábado', short: 'Sáb' }
];

export const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Convierte un objeto Date a formato ISO String 'YYYY-MM-DD'
 */
export function formatDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formatea una fecha a formato legible en español (ej. 'Miércoles, 12 de Agosto de 2026')
 */
export function formatFriendlyDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayName = DAYS_OF_WEEK[date.getDay()].name;
    const monthName = MONTH_NAMES[date.getMonth()];
    return `${dayName}, ${d} de ${monthName} de ${y}`;
}

/**
 * Formatea una fecha corta (ej. 'Mié 12 Ago')
 */
export function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayShort = DAYS_OF_WEEK[date.getDay()].short;
    const monthShort = MONTH_NAMES[date.getMonth()].slice(0, 3);
    return `${dayShort} ${d} ${monthShort}`;
}

/**
 * Formato de hora en 12 horas AM/PM (ej. '14:00' -> '02:00 PM')
 */
export function format12Hour(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Convierte 'HH:mm' a minutos desde la medianoche
 */
export function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + (m || 0);
}

/**
 * Convierte minutos desde la medianoche a 'HH:mm'
 */
export function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Suma minutos a una hora en formato 'HH:mm'
 */
export function addMinutesToTime(timeStr, mins) {
    const total = timeToMinutes(timeStr) + mins;
    return minutesToTime(total);
}

/**
 * Formatea una duración en minutos para interfaces de reserva.
 */
export function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) return `${remainingMinutes} min`;
    if (remainingMinutes === 0) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    return `${hours} ${hours === 1 ? 'hora' : 'horas'} ${remainingMinutes} min`;
}

/**
 * Devuelve duraciones válidas desde una hora de inicio hasta el cierre,
 * siempre como múltiplos del intervalo configurado por el local.
 */
export function getAvailableDurations(startTime, closingTime, intervalMins = 60) {
    const availableMinutes = timeToMinutes(closingTime) - timeToMinutes(startTime);
    const durations = [];
    for (let duration = intervalMins; duration <= availableMinutes; duration += intervalMins) {
        durations.push(duration);
    }
    return durations;
}

/**
 * Genera la lista de slots horarios entre start y end con intervalo dado
 * @param {string} startTime - ej. '10:00'
 * @param {string} endTime - ej. '22:00'
 * @param {number} intervalMins - ej. 60 o 30
 */
export function generateTimeSlots(startTime = '11:00', endTime = '22:00', intervalMins = 60) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    const slots = [];

    for (let current = start; current + intervalMins <= end; current += intervalMins) {
        slots.push({
            start: minutesToTime(current),
            end: minutesToTime(current + intervalMins),
            display: `${format12Hour(minutesToTime(current))} - ${format12Hour(minutesToTime(current + intervalMins))}`,
            startMinutes: current,
            endMinutes: current + intervalMins
        });
    }
    return slots;
}

/**
 * Verifica si dos intervalos de tiempo se traslapan
 */
export function isOverlapping(startA, endA, startB, endB) {
    const a1 = timeToMinutes(startA);
    const a2 = timeToMinutes(endA);
    const b1 = timeToMinutes(startB);
    const b2 = timeToMinutes(endB);
    return Math.max(a1, b1) < Math.min(a2, b2);
}

/**
 * Obtiene los días del mes para la vista mensual con padding de inicio y fin
 */
export function getMonthDays(year, month) {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const startDayIndex = firstDayOfMonth.getDay(); // 0: Dom
    const totalDays = lastDayOfMonth.getDate();
    
    const days = [];
    
    // Días del mes anterior para rellenar semana inicial
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
        const d = prevMonthLastDay - i;
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        days.push({
            dateKey: formatDateKey(new Date(prevYear, prevMonth, d)),
            dayNumber: d,
            isCurrentMonth: false,
            isToday: false
        });
    }
    
    // Días del mes actual
    const todayKey = formatDateKey(new Date());
    for (let d = 1; d <= totalDays; d++) {
        const dateKey = formatDateKey(new Date(year, month, d));
        days.push({
            dateKey,
            dayNumber: d,
            isCurrentMonth: true,
            isToday: dateKey === todayKey
        });
    }
    
    // Rellenar hasta completar semanas (múltiplo de 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        days.push({
            dateKey: formatDateKey(new Date(nextYear, nextMonth, d)),
            dayNumber: d,
            isCurrentMonth: false,
            isToday: false
        });
    }
    
    return days;
}

/**
 * Obtiene los 7 días de una semana a partir de una fecha de referencia
 */
export function getWeekDays(referenceDate = new Date()) {
    const d = new Date(referenceDate);
    const currentDay = d.getDay();
    const diffToSunday = d.getDate() - currentDay;
    
    const sunday = new Date(d.setDate(diffToSunday));
    const todayKey = formatDateKey(new Date());
    
    const week = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(sunday);
        day.setDate(sunday.getDate() + i);
        const dateKey = formatDateKey(day);
        week.push({
            dateKey,
            dayNumber: day.getDate(),
            dayName: DAYS_OF_WEEK[i].name,
            dayShort: DAYS_OF_WEEK[i].short,
            isToday: dateKey === todayKey,
            rawDate: day
        });
    }
    return week;
}
