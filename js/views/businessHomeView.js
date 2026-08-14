// Página pública principal de la sucursal seleccionada.
import { store } from '../core/store.js';
import { format12Hour, getBusinessHoursForDate, DAYS_OF_WEEK } from '../core/timeUtils.js';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80';

function mapsLink(business) {
    if (business.mapsUrl) return business.mapsUrl;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address || business.city || business.name)}`;
}

export function renderBusinessHomeView(container) {
    const business = store.currentBusiness;
    if (!business) return;

    const slotDuration = business.slotDuration || 60;
    const slotLabel = slotDuration === 60 ? 'cada hora' : `cada ${slotDuration} minutos`;
    const whatsapp = (business.whatsapp || '').replace(/\D/g, '');
    const mapsUrl = mapsLink(business);

    // Horarios de hoy y semanal
    const todayNum = new Date().getDay();
    const todayHours = getBusinessHoursForDate(business, new Date().toISOString().slice(0, 10));
    const todayHoursStr = todayHours.closed 
        ? 'Cerrado hoy' 
        : `Hoy: ${format12Hour(todayHours.openingTime)} – ${format12Hour(todayHours.closingTime)}`;

    container.innerHTML = `
        <section class="business-home animate-fade-in">
            <div class="business-home-hero">
                <img class="business-home-image" src="${business.imageUrl || FALLBACK_IMAGE}" alt="${business.name}" referrerpolicy="no-referrer" onerror="this.src='${FALLBACK_IMAGE}'">
                <div class="business-home-overlay"></div>
                <div class="business-home-content">
                    <span class="business-home-badge">${business.logoIcon || '🎮'} ${business.city || 'Sucursal'}</span>
                    <h1>${business.name}</h1>
                    <p>${business.tagline || 'Tu espacio para jugar, reservar y disfrutar.'}</p>
                    <div class="business-home-actions">
                        <button id="btn-home-book" class="btn btn-primary glow-red">Ver horarios y reservar</button>
                        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Ver ubicación</a>
                    </div>
                </div>
            </div>

            <div class="business-home-info-grid">
                <article class="business-info-card">
                    <span class="business-info-icon">📍</span>
                    <div>
                        <small>UBICACIÓN</small>
                        <strong>${business.address || business.city || 'Dirección por confirmar'}</strong>
                        ${business.city ? `<span>${business.city}</span>` : ''}
                    </div>
                </article>
                <article class="business-info-card">
                    <span class="business-info-icon">🕒</span>
                    <div style="width: 100%;">
                        <small>HORARIO</small>
                        <strong>${todayHoursStr}</strong>
                        <details style="margin-top: 5px; cursor: pointer; font-size: 0.82rem; color: var(--text-muted);">
                            <summary style="outline: none; color: var(--piu-cyan);">Ver horarios semanales</summary>
                            <div style="margin-top: 6px; display: grid; gap: 4px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 6px;">
                                ${DAYS_OF_WEEK.map(day => {
                                    const dayConfig = business.operatingHours?.[day.id] || business.operatingHours?.[String(day.id)] || {
                                        open: business.openingTime || '11:00',
                                        close: business.closingTime || '22:00',
                                        closed: false
                                    };
                                    const isCurrentDay = day.id === todayNum;
                                    const boldStyle = isCurrentDay ? 'color: var(--color-neon-lime); font-weight: bold;' : '';
                                    const hoursText = dayConfig.closed ? 'Cerrado' : `${format12Hour(dayConfig.open)} - ${format12Hour(dayConfig.close)}`;
                                    return `
                                        <div style="display: flex; justify-content: space-between; ${boldStyle}">
                                            <span>${day.name}:</span>
                                            <span>${hoursText}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </details>
                        <span style="display: block; margin-top: 4px;">Reservas ${slotLabel}</span>
                    </div>
                </article>
                <article class="business-info-card">
                    <span class="business-info-icon">📱</span>
                    <div>
                        <small>CONTACTO</small>
                        <strong>${business.phone || (whatsapp ? `WhatsApp ${whatsapp}` : 'Contacto por confirmar')}</strong>
                        ${whatsapp ? `<a href="https://wa.me/52${whatsapp}" target="_blank" rel="noopener noreferrer">Enviar WhatsApp</a>` : ''}
                    </div>
                </article>
            </div>
            
            ${business.rules ? `
                <section class="business-home-rules" style="margin: 40px auto 0 auto; padding: 24px; background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.15); border-radius: var(--radius-md); text-align: left; max-width: 1200px;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                        <span style="font-size: 1.5rem;">📜</span>
                        <h3 style="margin:0; font-family:var(--font-heading); color:#ffffff; font-size: 1.2rem; letter-spacing: 1.5px;">REGLAMENTO INTERNO DE LA SALA</h3>
                    </div>
                    <div style="color:var(--text-secondary); font-size:0.92rem; line-height: 1.6; white-space: pre-line; padding: 4px 8px;">${business.rules}</div>
                </section>
            ` : ''}

            <section class="business-home-details">
                <div>
                    <span class="section-kicker">INFORMACIÓN DEL LOCAL</span>
                    <h2>Todo listo para tu próxima sesión</h2>
                    <p>Consulta la disponibilidad de las máquinas y elige un intervalo de reserva configurado para esta sucursal.</p>
                </div>
                <div class="business-home-detail-actions">
                    <button id="btn-home-availability" class="btn btn-secondary">Ir a la vista de reservas</button>
                    ${business.instagramUrl ? `<a href="${business.instagramUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Instagram</a>` : ''}
                    ${business.facebookUrl ? `<a href="${business.facebookUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Facebook</a>` : ''}
                </div>
            </section>
        </section>
    `;

    container.querySelector('#btn-home-book')?.addEventListener('click', () => store.setCurrentView('DAY'));
    container.querySelector('#btn-home-availability')?.addEventListener('click', () => store.setCurrentView('DAY'));
}
