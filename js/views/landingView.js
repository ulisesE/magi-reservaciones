// js/views/landingView.js
// Pantalla de Bienvenida / Index: Selección obligatoria de local antes de entrar al sistema
import { tenantManager } from '../core/tenantManager.js';
import { store } from '../core/store.js';
import { authManager } from '../core/authManager.js';
import { openLoginModal } from '../components/header.js';

export function renderLandingView(container) {
    const businesses = tenantManager.getAllBusinesses();

    container.innerHTML = `
        <div class="landing-hero-wrapper animate-fade-in">
            <!-- Hero Header -->
            <div class="landing-header-banner">
                <div class="landing-badge-pill">
                    <span class="neon-arrow">◆</span> SISTEMA MULTI-NEGOCIO PUMP IT UP
                </div>
                <h1 class="landing-hero-title">
                    ¿A QUÉ <span class="piu-highlight">LOCAL / SUCURSAL</span> DESEAS INGRESAR?
                </h1>
                <p class="landing-hero-subtitle">
                    Selecciona tu sala de maquinitas para consultar la disponibilidad de pistas, horarios y solicitar tu reservación.
                </p>
            </div>

            <!-- Grid de Selección de Locales -->
            <div class="landing-venues-grid">
                ${businesses.map(b => {
                    return `
                        <div class="venue-landing-card" data-biz-id="${b.id}">
                            <div class="venue-card-img-wrap">
                                <img src="${b.imageUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80'}" 
                                     alt="${b.name}" class="venue-card-img" onerror="this.src='https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80'">
                                <div class="venue-icon-badge">${b.logoIcon || '🕹️'}</div>
                                <div class="venue-city-pill">${b.city}</div>
                            </div>

                            <div class="venue-card-body">
                                <h3 class="venue-name">${b.name}</h3>
                                <p class="venue-tagline">${b.tagline || 'Centro de Juego y Baile'}</p>
                                
                                <div class="venue-info-list">
                                    <div class="v-info-item">
                                        <span class="v-icon">📍</span>
                                        <span>${b.address || b.city}</span>
                                    </div>
                                    <div class="v-info-item">
                                        <span class="v-icon">⏰</span>
                                        <span>Horario: <strong>${b.openingTime} a ${b.closingTime}</strong></span>
                                    </div>
                                    <div class="v-info-item">
                                        <span class="v-icon">💰</span>
                                        <span>Moneda: <strong>${b.currencySymbol} (${b.currency})</strong></span>
                                    </div>
                                </div>

                                <div class="venue-card-footer">
                                    <button class="btn btn-primary btn-select-venue glow-red" data-id="${b.id}">
                                        <span>🕹️ Entrar a este Local</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Acceso para Personal / Superadmin -->
            <div class="landing-staff-banner">
                <div class="staff-banner-text">
                    <strong>¿Eres Encargado de sucursal o Super Administrador?</strong>
                    <p>Inicia sesión con tu cuenta para gestionar tus máquinas, reservaciones o la plataforma global.</p>
                </div>
                <button id="btn-landing-staff-login" class="btn btn-outline">
                    <span>🔐 Iniciar Sesión de Staff</span>
                </button>
            </div>
        </div>
    `;

    // Eventos de selección de local
    container.querySelectorAll('.btn-select-venue').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            await tenantManager.selectLocal(id);
            store.setCurrentView('DAY');
        });
    });

    container.querySelectorAll('.venue-landing-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.bizId;
            tenantManager.selectLocal(id).then(() => {
                store.setCurrentView('DAY');
            });
        });
    });

    // Botón de Login para Staff
    container.querySelector('#btn-landing-staff-login')?.addEventListener('click', () => {
        openLoginModal();
    });
}
