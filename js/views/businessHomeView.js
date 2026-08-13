// Página pública principal de la sucursal seleccionada.
import { store } from '../core/store.js';
import { format12Hour } from '../core/timeUtils.js';

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
                    <div>
                        <small>HORARIO</small>
                        <strong>${format12Hour(business.openingTime || '11:00')} – ${format12Hour(business.closingTime || '22:00')}</strong>
                        <span>Reservas ${slotLabel}</span>
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
