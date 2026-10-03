// js/views/landingView.js
// Pantalla de Bienvenida / Index: Selección obligatoria de local antes de entrar al sistema
import { tenantManager } from '../core/tenantManager.js';
import { store } from '../core/store.js';
import { authManager } from '../core/authManager.js';
import { pwaManager } from '../core/pwaManager.js';
import { openLoginModal } from '../components/header.js';
import { format12Hour, getBusinessHoursForDate } from '../core/timeUtils.js';

export function renderLandingView(container) {
    const isSuperAdmin = authManager.isSuperAdmin();
    const isAppInstalled = pwaManager.isAppInstalled();
    const allBusinesses = tenantManager.getAllBusinesses();
    // Solo mostrar locales habilitados en el inicio, salvo que el usuario sea Super Admin
    const businesses = isSuperAdmin 
        ? allBusinesses 
        : allBusinesses.filter(b => tenantManager.isBusinessActive(b));

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
                    Selecciona tu sala de maquinitas para consultar la disponibilidad de máquinas, horarios y solicitar tu reservación.
                </p>
            </div>

            <!-- Grid de Selección de Locales -->
            <div class="landing-venues-grid">
                ${businesses.length === 0 ? `
                    <div class="empty-state" style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; background: var(--bg-dark-800); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                        <div style="font-size: 3rem; margin-bottom: 12px;">⏸️</div>
                        <h3 style="color: #ffffff; font-family: var(--font-heading);">No hay sucursales activas en este momento</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 8px;">
                            Las salas se encuentran temporalmente en mantenimiento. Por favor vuelve a consultar más tarde.
                        </p>
                    </div>
                ` : businesses.map(b => {
                    const isBizActive = tenantManager.isBusinessActive(b);
                    const todayDateStr = new Date().toISOString().slice(0, 10);
                    const todayHours = getBusinessHoursForDate(b, todayDateStr);
                    const horarioLabel = todayHours.closed 
                        ? 'Cerrado hoy' 
                        : `Hoy: ${format12Hour(todayHours.openingTime)} a ${format12Hour(todayHours.closingTime)}`;
                    return `
                        <div class="venue-landing-card ${!isBizActive ? 'card-dimmed' : ''}" data-biz-id="${b.id}" style="${!isBizActive ? 'border: 1px dashed var(--color-neon-yellow); opacity: 0.85;' : ''}">
                            <div class="venue-card-img-wrap">
                                <img src="${b.imageUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80'}" 
                                     alt="${b.name}" 
                                     referrerpolicy="no-referrer"
                                     class="venue-card-img" 
                                     onerror="this.src='https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80'">
                                <div class="venue-icon-badge">${b.logoIcon || '🕹️'}</div>
                                <div class="venue-city-pill">${b.city}</div>
                            </div>

                            <div class="venue-card-body">
                                ${!isBizActive ? `
                                    <div style="margin-bottom: 8px;">
                                        <span class="badge badge-warning" style="font-size:0.72rem; padding:3px 8px;">⏸️ DESHABILITADO (Visible solo Superadmin)</span>
                                    </div>
                                ` : ''}
                                <h3 class="venue-name">${b.name}</h3>
                                <p class="venue-tagline">${b.tagline || 'Centro de Juego y Baile'}</p>
                                
                                <div class="venue-info-list">
                                    <div class="v-info-item">
                                        <span class="v-icon">📍</span>
                                        <span>${b.address || b.city}</span>
                                    </div>
                                    <div class="v-info-item">
                                        <span class="v-icon">⏰</span>
                                        <span>Horario: <strong>${horarioLabel}</strong></span>
                                    </div>
                                    <div class="v-info-item">
                                        <span class="v-icon">💰</span>
                                        <span>Moneda: <strong>${b.currencySymbol} (${b.currency})</strong></span>
                                    </div>
                                </div>

                                <div class="venue-card-footer" style="display:flex; gap:8px; align-items:center;">
                                    <button class="btn btn-primary btn-select-venue glow-red" data-id="${b.id}" style="flex:1;">
                                        <span>🕹️ Entrar a este Local</span>
                                    </button>
                                    ${!isAppInstalled ? `
                                        <button class="btn btn-outline btn-landing-download" data-id="${b.id}" title="Descargar e instalar la App de ${b.name}" style="border-color:var(--color-neon-cyan); color:var(--color-neon-cyan); padding:8px 12px;">
                                            <span>📲 App</span>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Acceso para Jugadores y Personal -->
            <div class="landing-staff-banner" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                <div class="staff-banner-text">
                    <strong>¿Eres Jugador o Personal del Local?</strong>
                    <p>Crea tu perfil de jugador para agendar más rápido y gestionar tus horarios, o inicia sesión con tu cuenta.</p>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button id="btn-landing-player-register" class="btn btn-primary glow-red">
                        <span>✨ Crear Perfil de Jugador</span>
                    </button>
                    <button id="btn-landing-staff-login" class="btn btn-outline">
                        <span>🔐 Iniciar Sesión</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Eventos de selección de local
    container.querySelectorAll('.btn-select-venue').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            await tenantManager.selectLocal(id);
            store.setCurrentView('HOME');
        });
    });

    // Evento para ir directo a la descarga de la App del local
    container.querySelectorAll('.btn-landing-download').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            await tenantManager.selectLocal(id);
            store.setCurrentView('DOWNLOAD');
        });
    });

    container.querySelectorAll('.venue-landing-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.bizId;
            tenantManager.selectLocal(id).then(() => {
                store.setCurrentView('HOME');
            });
        });
    });

    // Botón de Crear Perfil
    container.querySelector('#btn-landing-player-register')?.addEventListener('click', () => {
        openLoginModal('register');
    });

    // Botón de Login
    container.querySelector('#btn-landing-staff-login')?.addEventListener('click', () => {
        openLoginModal('login');
    });
}
