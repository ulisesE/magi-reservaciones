// js/core/timeUtils.js
// Utilidades de fechas, horas y cálculo de slots para Pump It Up
import { authManager } from './authManager.js';

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
 * Convierte minutos desde la medianoche a 'HH:mm' (con soporte de envoltura de medianoche)
 */
export function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60) % 24;
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
 * siempre como múltiplos del intervalo configurado por el local (con soporte nocturno).
 */
export function getAvailableDurations(startTime, closingTime, intervalMins = 60) {
    const startMins = timeToMinutes(startTime);
    let closeMins = timeToMinutes(closingTime);
    if (closeMins < startMins) {
        closeMins += 24 * 60; // Overnight wrap
    }
    const availableMinutes = closeMins - startMins;
    const durations = [];
    for (let duration = intervalMins; duration <= availableMinutes; duration += intervalMins) {
        durations.push(duration);
    }
    return durations;
}

/**
 * Genera la lista de slots horarios entre start y end con intervalo dado (con soporte nocturno)
 * @param {string} startTime - ej. '10:00'
 * @param {string} endTime - ej. '22:00'
 * @param {number} intervalMins - ej. 60 o 30
 */
export function generateTimeSlots(startTime = '11:00', endTime = '22:00', intervalMins = 60) {
    const start = timeToMinutes(startTime);
    let end = timeToMinutes(endTime);
    if (end < start) {
        end += 24 * 60; // Overnight wrap
    }
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
 * Normaliza cualquier hora (HH:mm) a minutos transcurridos desde la medianoche de operación.
 * Si es un horario nocturno y la hora cae después de medianoche, le suma 24 horas.
 */
export function getMinutesSinceOperationalMidnight(timeStr, openingTime, closingTime) {
    const mins = timeToMinutes(timeStr);
    if (!openingTime || !closingTime) return mins;
    
    const openMins = timeToMinutes(openingTime);
    const closeMins = timeToMinutes(closingTime);
    
    // Only wrap if it's an overnight schedule AND the time is less than openingTime
    if (closeMins < openMins && mins < openMins) {
        return mins + 24 * 60;
    }
    return mins;
}

/**
 * Obtiene la configuración de horarios para una fecha específica del negocio.
 */
export function getBusinessHoursForDate(business, dateStr) {
    if (!business) return { openingTime: '11:00', closingTime: '22:00', closed: false, isOpen: true };
    
    // Fallback standard fields if operatingHours is not set
    if (!business.operatingHours) {
        return { 
            openingTime: business.openingTime || '11:00', 
            closingTime: business.closingTime || '22:00', 
            closed: false,
            isOpen: true
        };
    }
    
    // Parse date to get day of week (0 = Sunday, 1 = Monday, etc.)
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    
    const dayConfig = business.operatingHours[dayOfWeek] || business.operatingHours[String(dayOfWeek)];
    if (dayConfig) {
        const isClosed = !!dayConfig.closed;
        return {
            openingTime: dayConfig.open || '11:00',
            closingTime: dayConfig.close || '22:00',
            closed: isClosed,
            isOpen: !isClosed
        };
    }
    
    // Final fallback
    return {
        openingTime: business.openingTime || '11:00',
        closingTime: business.closingTime || '22:00',
        closed: false,
        isOpen: true
    };
}

/**
 * Verifica si dos intervalos de tiempo se traslapan (con soporte de rango nocturno operativo)
 */
export function isOverlapping(startA, endA, startB, endB, openingTime = null, closingTime = null) {
    const a1 = getMinutesSinceOperationalMidnight(startA, openingTime, closingTime);
    const a2 = getMinutesSinceOperationalMidnight(endA, openingTime, closingTime);
    const b1 = getMinutesSinceOperationalMidnight(startB, openingTime, closingTime);
    const b2 = getMinutesSinceOperationalMidnight(endB, openingTime, closingTime);
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

/**
 * Calcula el costo de una reservación según la duración, modo de juego (jugadores) y local.
 * Busca primero coincidencias en las tarifas especiales del local y, si no existen, realiza
 * un cálculo proporcional según la tarifa horaria de la máquina.
 */
export function calculateBookingCost(durationMinutes, numPlayers, machine, business) {
    const playersCount = parseInt(numPlayers, 10) || 1;
    const duration = parseInt(durationMinutes, 10) || 30;

    let price = 0;

    // 1. Intentar buscar una tarifa especial en el local
    if (business && Array.isArray(business.customRates)) {
        const specialRate = business.customRates.find(r => 
            parseInt(r.players, 10) === playersCount && 
            parseInt(r.duration, 10) === duration
        );
        if (specialRate) {
            price = parseFloat(specialRate.price);
        }
    }

    if (price === 0) {
        // 2. Fallback: Calcular de forma proporcional a la tarifa de la máquina
        const rate1P = machine ? (parseFloat(machine.hourlyRate) || 80) : 80;
        const rate2P = machine ? (parseFloat(machine.hourlyRate2P) || 130) : 130;
        const activeRate = playersCount === 2 ? rate2P : rate1P;
        price = Math.round(duration * (activeRate / 60));
    }

    // 3. Aplicar descuento de lealtad si está activo en la sucursal
    if (business && business.loyaltyEnabled) {
        const discount = authManager && authManager.getCurrentUserDiscount ? authManager.getCurrentUserDiscount(business) : 0;
        if (discount > 0) {
            price = Math.round(price * (1 - discount));
        }
    }

    return price;
}
