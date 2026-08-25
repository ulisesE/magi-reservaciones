// js/views/businessView.js
// Panel de Configuración Integral del Local / Sucursal (Admin de Local)
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { COLLECTIONS } from '../firebaseConfig.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { DAYS_OF_WEEK } from '../core/timeUtils.js';
import { THEMES } from '../core/themeManager.js';

// URL de ejemplo sugerida por el usuario
const FB_EXAMPLE_URL = 'https://scontent-qro1-2.xx.fbcdn.net/v/t39.30808-6/724053305_1025229003358348_5523282942833772562_n.jpg?stp=dst-jpg_tt6&cstp=mx500x500&ctp=s500x500&_nc_cat=107&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=LS1w0JkJS_MQ7kNvwHzxI4I&_nc_oc=Adr79gKV4Ryuma3nOMkafJ9MkywnUbjl7y_Rf9gDNR51ciURCvb0XNyj7ZYvzL6AvlE&_nc_zt=23&_nc_ht=scontent-qro1-2.xx&_nc_gid=6FLHME4iNh4boah72s7Jyw&_nc_ss=702a8&oh=00_AQHr29y8OUsGs4pG3sKdxE6APo5P5xnv_HMJZfpkpiBLeg&oe=6A82B2A6';
const STOCK_ARCADE_URL = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80';

const EMOJI_PRESETS = ['🕹️', '🎮', '⚡', '🔥', '🕺', '💃', '👑', '🎯', '🚀', '💎', '🏆', '👾', '🌟', '🎪', '🏢', '🎧'];

export function renderBusinessView(container) {
    const business = store.currentBusiness || tenantManager.getActiveBusiness();
    const allBusinesses = tenantManager.getAllBusinesses();
    const isSuperAdmin = authManager.isSuperAdmin();
    const clientDirectUrl = `${window.location.origin}${window.location.pathname}?local=${business.id}`;

    let localCustomRates = [...(business.customRates || [])];

    const currentImgUrl = business.imageUrl || STOCK_ARCADE_URL;
    const currentThemeId = business.themeId || 'phoenix';
    const currentEmoji = business.logoIcon || '🕹️';

    container.innerHTML = `
        <div class="business-view-wrapper animate-fade-in">
            <!-- Header de Vista -->
            <div class="view-header-bar">
                <div class="header-left">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:1.9rem;">⚙️</span>
                        <div>
                            <h2 class="friendly-date-title">Administración y Configuración del Local</h2>
                            <p class="subtitle-text">Ajustes integrales de marca, imagen, horarios, tarifas, políticas y enlaces para: <strong>${business.name}</strong></p>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-primary" id="btn-go-to-clients-acct" style="background:linear-gradient(135deg, #088C4F, #68F205); color:#000; font-weight:bold; border:none;" title="Abrir directorio, cuentas y consumos de jugadores">
                        <span>👥 Directorio y Cuentas</span>
                    </button>
                    <a href="${clientDirectUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" title="Abrir la vista que ven los clientes en una nueva pestaña">
                        <span>👁️ Ver Vista Cliente</span>
                    </a>
                    ${isSuperAdmin ? `
                        <button class="btn btn-primary glow-red" id="btn-create-biz">
                            <span>➕ Registrar Nueva Sucursal</span>
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Formulario Maestro de Configuración -->
            <form id="form-edit-active-biz" class="cyber-form">
                <div class="settings-grid">

                    <!-- SECCIÓN 1: IDENTIDAD VISUAL, IMAGEN Y BRANDING -->
                    <div class="settings-card">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">🖼️</span>
                                <div>
                                    <h3>1. Identidad Visual, Imagen y Banner del Local</h3>
                                    <small>Configura la foto de portada del local (admite URLs públicas de Facebook, Instagram, Imgur, Cloudinary o cualquier sitio web)</small>
                                </div>
                            </div>
                        </div>

                        <div class="settings-form-body">
                            <!-- Banner & Vista Previa en Vivo -->
                            <div class="biz-preview-banner-card" style="margin-bottom:20px;">
                                <div class="biz-banner-image-container">
                                    <img id="biz-preview-img" 
                                         src="${currentImgUrl}" 
                                         alt="${business.name}" 
                                         referrerpolicy="no-referrer"
                                         class="biz-banner-img"
                                         onerror="this.src='${STOCK_ARCADE_URL}'; document.getElementById('img-status-badge').innerHTML='⚠️ Falló URL - Usando respaldo'; document.getElementById('img-status-badge').className='badge badge-warning';">
                                    
                                    <div class="biz-banner-overlay">
                                        <div class="biz-banner-badge-box">
                                            <span id="biz-preview-icon" class="biz-preview-icon-badge">${currentEmoji}</span>
                                            <div class="biz-banner-text-info">
                                                <h3 id="biz-preview-name" style="color:#ffffff; margin:0; font-size:1.4rem; font-family:var(--font-heading); text-shadow:0 2px 10px rgba(0,0,0,0.8);">${business.name}</h3>
                                                <p id="biz-preview-tagline" style="color:rgba(255,255,255,0.85); margin:2px 0 0 0; font-size:0.85rem;">${business.tagline || 'Centro de Juego y Baile'}</p>
                                            </div>
                                        </div>

                                        <div class="biz-banner-top-right">
                                            <span id="img-status-badge" class="badge badge-success">● Vista Previa Activa</span>
                                            <span id="biz-preview-city-badge" class="badge badge-dark">${business.city}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Campo de URL de Imagen Externa -->
                            <div class="form-group">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:8px;">
                                    <label for="biz-image-url" style="font-weight:700;">
                                        <span class="neon-arrow">◆</span> URL Pública de la Imagen / Banner del Local
                                    </label>
                                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                        <button type="button" class="btn btn-outline btn-xs" id="btn-paste-fb-example" title="Pegar URL de ejemplo directo de Facebook CDN">
                                            ⚡ Pegar Ejemplo Facebook CDN
                                        </button>
                                        <button type="button" class="btn btn-outline btn-xs" id="btn-restore-stock-img" title="Restaurar imagen arcade estándar">
                                            🔄 Imagen Arcade
                                        </button>
                                        <button type="button" class="btn btn-secondary btn-xs" id="btn-clear-img" title="Limpiar campo">
                                            🧹 Limpiar
                                        </button>
                                    </div>
                                </div>

                                <div style="position:relative;">
                                    <input type="url" 
                                           id="biz-image-url" 
                                           class="cyber-input" 
                                           value="${business.imageUrl || ''}" 
                                           placeholder="https://scontent-... o https://images.unsplash.com/... o https://i.imgur.com/..." 
                                           style="padding-right:35px;">
                                    <span style="position:absolute; right:12px; top:50%; transform:translateY(-50%); font-size:1.1rem;">🔗</span>
                                </div>
                                <small style="display:block; margin-top:6px; color:var(--text-muted); font-size:0.78rem; line-height:1.4;">
                                    💡 <em>Puedes pegar cualquier enlace público directo a una imagen JPG, PNG o WebP alojada en Facebook, Instagram, Google Drive público, Cloudinary, Imgur, servidores propios, etc.</em>
                                </small>
                            </div>

                            <!-- Icono Emoji y Color Neón -->
                            <div class="form-row grid-2" style="margin-top:16px;">
                                <div class="form-group">
                                    <label for="biz-logo-icon"><span class="neon-arrow">◆</span> Emoji / Icono Distintivo</label>
                                    <div style="display:flex; gap:10px; align-items:center;">
                                        <input type="text" id="biz-logo-icon" class="cyber-input" value="${currentEmoji}" style="max-width:80px; text-align:center; font-size:1.3rem;">
                                        <div class="emoji-presets-wrap" style="display:flex; gap:4px; flex-wrap:wrap;">
                                            ${EMOJI_PRESETS.map(em => `
                                                <button type="button" class="btn-emoji-preset ${em === currentEmoji ? 'active' : ''}" data-emoji="${em}" title="Elegir ${em}">
                                                    ${em}
                                                </button>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label for="biz-theme-id"><span class="neon-arrow">◆</span> Tema Visual de la Sucursal</label>
                                    <div style="display:flex; flex-direction:column; gap:8px;">
                                        <select id="biz-theme-id" class="cyber-select">
                                            ${Object.values(THEMES).map(t => `
                                                <option value="${t.id}" ${t.id === currentThemeId ? 'selected' : ''}>${t.name}</option>
                                            `).join('')}
                                        </select>
                                        <div id="theme-preview-bars" style="display:flex; height:12px; border-radius:4px; overflow:hidden; border: 1px solid var(--border-color);">
                                            <!-- Se actualiza por JS -->
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="form-row grid-2" style="margin-top:10px;">
                                <div class="form-group">
                                    <label for="biz-name"><span class="neon-arrow">◆</span> Nombre del Negocio / Sucursal *</label>
                                    <input type="text" id="biz-name" class="cyber-input" value="${business.name}" required placeholder="Ej. Pump Zone Centro">
                                </div>
                                <div class="form-group">
                                    <label for="biz-tagline"><span class="neon-arrow">◆</span> Eslogan / Subtítulo Comercial</label>
                                    <input type="text" id="biz-tagline" class="cyber-input" value="${business.tagline || ''}" placeholder="Ej. El Templo del Step - Arcade & Rhythm Lounge">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN 2: UBICACIÓN FÍSICA, CONTACTO Y REDES -->
                    <div class="settings-card">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">📍</span>
                                <div>
                                    <h3>2. Ubicación Física, Contacto y Redes Sociales</h3>
                                    <small>Dirección, teléfono, WhatsApp para confirmaciones y enlace de Google Maps</small>
                                </div>
                            </div>
                        </div>

                        <div class="settings-form-body">
                            <div class="form-row grid-2">
                                <div class="form-group">
                                    <label for="biz-city"><span class="neon-arrow">◆</span> Ciudad / Zona / Estado *</label>
                                    <input type="text" id="biz-city" class="cyber-input" value="${business.city || ''}" required placeholder="Ej. Ciudad de México, Centro">
                                </div>
                                <div class="form-group">
                                    <label for="biz-address"><span class="neon-arrow">◆</span> Dirección Completa (Calle, Número, Plaza, Piso)</label>
                                    <input type="text" id="biz-address" class="cyber-input" value="${business.address || ''}" placeholder="Ej. Av. Juárez #142, Piso 2 (Zona Rosa)">
                                </div>
                            </div>

                            <div class="form-row grid-3" style="margin-top:10px;">
                                <div class="form-group">
                                    <label for="biz-phone"><span class="neon-arrow">◆</span> Teléfono de Atención</label>
                                    <input type="text" id="biz-phone" class="cyber-input" value="${business.phone || ''}" placeholder="Ej. +52 55 1234 5678">
                                </div>
                                <div class="form-group">
                                    <label for="biz-whatsapp"><span class="neon-arrow">◆</span> WhatsApp de Reservaciones (10 dígitos)</label>
                                    <div style="display:flex; gap:6px;">
                                        <input type="text" id="biz-whatsapp" class="cyber-input" value="${business.whatsapp || ''}" placeholder="Ej. 5512345678">
                                        <button type="button" class="btn btn-outline btn-sm" id="btn-test-wa" title="Probar apertura de WhatsApp" style="white-space:nowrap;">
                                            💬 Probar
                                        </button>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="biz-maps"><span class="neon-arrow">◆</span> Enlace Google Maps / Waze</label>
                                    <div style="display:flex; gap:6px;">
                                        <input type="url" id="biz-maps" class="cyber-input" value="${business.mapsUrl || ''}" placeholder="https://maps.google.com/...">
                                        <button type="button" class="btn btn-outline btn-sm" id="btn-test-maps" title="Abrir enlace de mapas" style="white-space:nowrap;">
                                            🗺️ Probar
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="form-row grid-2" style="margin-top:10px;">
                                <div class="form-group">
                                    <label for="biz-fb"><span class="neon-arrow">◆</span> Página de Facebook</label>
                                    <input type="url" id="biz-fb" class="cyber-input" value="${business.facebookUrl || ''}" placeholder="https://facebook.com/tupagina">
                                </div>
                                <div class="form-group">
                                    <label for="biz-ig"><span class="neon-arrow">◆</span> Perfil de Instagram</label>
                                    <input type="url" id="biz-ig" class="cyber-input" value="${business.instagramUrl || ''}" placeholder="https://instagram.com/tuperfil">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN 3: HORARIOS DE OPERACIÓN Y MOTOR DE RESERVAS -->
                    <div class="settings-card">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">⏰</span>
                                <div>
                                    <h3>3. Horarios de Operación y Reglas de Reserva</h3>
                                    <small>Ventana de tiempo de atención, duración de turnos y límites de anticipación</small>
                                </div>
                            </div>
                        </div>

                        <div class="settings-form-body">
                            <div class="form-row">
                                <div class="form-group flex-1">
                                    <label style="font-weight: 700; color: var(--color-neon-lime); margin-bottom: 8px; display: block;">
                                        <span class="neon-arrow">◆</span> Horarios de Atención por Día de la Semana
                                    </label>
                                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;">
                                        Define el horario para cada día. Si el local permanece cerrado, desmarca el switch de "Abierto".
                                        Para locales con horarios nocturnos que cierran de madrugada (ej. de 5 PM a 3 AM del día siguiente), 
                                        introduce la hora de cierre menor a la de apertura (ej. apertura 17:00, cierre 03:00).
                                    </p>
                                    <div class="catalogs-table-wrapper" style="margin-bottom: 20px;">
                                        <table class="catalogs-table" style="width:100%;">
                                            <thead>
                                                <tr>
                                                    <th>Día</th>
                                                    <th style="text-align:center; width:120px;">Estado</th>
                                                    <th>Apertura</th>
                                                    <th>Cierre</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${DAYS_OF_WEEK.map(day => {
                                                    const dayConfig = business.operatingHours?.[day.id] || business.operatingHours?.[String(day.id)] || {
                                                        open: business.openingTime || '11:00',
                                                        close: business.closingTime || '22:00',
                                                        closed: false
                                                    };
                                                    const isOpen = !dayConfig.closed;
                                                    return `
                                                        <tr>
                                                            <td style="font-weight:700; vertical-align:middle; color:#ffffff;">${day.name}</td>
                                                            <td style="text-align:center; vertical-align:middle;">
                                                                <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;">
                                                                    <input type="checkbox" class="day-closed-checkbox" data-day-id="${day.id}" style="width:18px; height:18px; accent-color:var(--color-neon-lime);" ${isOpen ? 'checked' : ''}>
                                                                    <span class="status-label" style="font-size:0.85rem; color:${isOpen ? 'var(--color-neon-lime)' : 'var(--text-muted)'};">${isOpen ? 'Abierto' : 'Cerrado'}</span>
                                                                </label>
                                                            </td>
                                                            <td>
                                                                <input type="time" class="cyber-input day-open-time" data-day-id="${day.id}" value="${dayConfig.open || '11:00'}" ${isOpen ? '' : 'disabled'} style="max-width:130px; padding:6px; font-size:0.88rem;">
                                                            </td>
                                                            <td>
                                                                <input type="time" class="cyber-input day-close-time" data-day-id="${day.id}" value="${dayConfig.close || '22:00'}" ${isOpen ? '' : 'disabled'} style="max-width:130px; padding:6px; font-size:0.88rem;">
                                                            </td>
                                                        </tr>
                                                    `;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div class="form-row grid-3">
                                <div class="form-group">
                                    <label for="biz-slot-dur"><span class="neon-arrow">◆</span> Duración de Slot Estándar</label>
                                    <select id="biz-slot-dur" class="cyber-select">
                                        <option value="30" ${business.slotDuration === 30 ? 'selected' : ''}>30 Minutos</option>
                                        <option value="45" ${business.slotDuration === 45 ? 'selected' : ''}>45 Minutos</option>
                                        <option value="60" ${(business.slotDuration === 60 || !business.slotDuration) ? 'selected' : ''}>60 Minutos (1 Hora - Estándar)</option>
                                        <option value="90" ${business.slotDuration === 90 ? 'selected' : ''}>90 Minutos (1.5 Horas)</option>
                                        <option value="120" ${business.slotDuration === 120 ? 'selected' : ''}>120 Minutos (2 Horas)</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-row grid-3" style="margin-top:10px;">
                                <div class="form-group">
                                    <label for="biz-max-advance"><span class="neon-arrow">◆</span> Días Máximos de Anticipación</label>
                                    <select id="biz-max-advance" class="cyber-select">
                                        <option value="3" ${business.maxAdvanceDays === 3 ? 'selected' : ''}>3 Días</option>
                                        <option value="7" ${business.maxAdvanceDays === 7 ? 'selected' : ''}>7 Días (1 Semana)</option>
                                        <option value="14" ${(business.maxAdvanceDays === 14 || !business.maxAdvanceDays) ? 'selected' : ''}>14 Días (2 Semanas)</option>
                                        <option value="30" ${business.maxAdvanceDays === 30 ? 'selected' : ''}>30 Días (1 Mes)</option>
                                        <option value="60" ${business.maxAdvanceDays === 60 ? 'selected' : ''}>60 Días</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="biz-min-cancel"><span class="neon-arrow">◆</span> Aviso Mínimo de Cancelación</label>
                                    <select id="biz-min-cancel" class="cyber-select">
                                        <option value="1" ${business.minCancelNoticeHours === 1 ? 'selected' : ''}>1 Hora antes</option>
                                        <option value="2" ${(business.minCancelNoticeHours === 2 || !business.minCancelNoticeHours) ? 'selected' : ''}>2 Horas antes</option>
                                        <option value="4" ${business.minCancelNoticeHours === 4 ? 'selected' : ''}>4 Horas antes</option>
                                        <option value="12" ${business.minCancelNoticeHours === 12 ? 'selected' : ''}>12 Horas antes</option>
                                        <option value="24" ${business.minCancelNoticeHours === 24 ? 'selected' : ''}>24 Horas antes (1 Día)</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="biz-max-active-bookings"><span class="neon-arrow">◆</span> Reservas Activas por Jugador</label>
                                    <select id="biz-max-active-bookings" class="cyber-select">
                                        <option value="1" ${business.maxActiveBookingsPerUser === 1 ? 'selected' : ''}>1 Reserva a la vez</option>
                                        <option value="2" ${business.maxActiveBookingsPerUser === 2 ? 'selected' : ''}>2 Reservas simultáneas</option>
                                        <option value="3" ${(business.maxActiveBookingsPerUser === 3 || !business.maxActiveBookingsPerUser) ? 'selected' : ''}>3 Reservas simultáneas</option>
                                        <option value="5" ${business.maxActiveBookingsPerUser === 5 ? 'selected' : ''}>5 Reservas simultáneas</option>
                                        <option value="10" ${business.maxActiveBookingsPerUser === 10 ? 'selected' : ''}>10 Reservas (Libre)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN 4: MONEDA, TARIFAS Y POLÍTICAS DE PAGO / ANTICIPO -->
                    <div class="settings-card">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">💳</span>
                                <div>
                                    <h3>4. Moneda, Políticas de Anticipo y Datos Bancarios</h3>
                                    <small>Estándar monetario, anticipos requeridos para confirmar e instrucciones de transferencia</small>
                                </div>
                            </div>
                        </div>

                        <div class="settings-form-body">
                            <div class="form-row grid-3">
                                <div class="form-group">
                                    <label for="biz-symbol"><span class="neon-arrow">◆</span> Símbolo y Código de Moneda</label>
                                    <div class="input-duo">
                                        <input type="text" id="biz-symbol" class="cyber-input" value="${business.currencySymbol || '$'}" style="max-width: 65px; text-align:center; font-weight:bold;" placeholder="$">
                                        <input type="text" id="biz-curr" class="cyber-input" value="${business.currency || 'MXN'}" placeholder="MXN">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="biz-req-deposit"><span class="neon-arrow">◆</span> ¿Requiere Anticipo / Depósito?</label>
                                    <select id="biz-req-deposit" class="cyber-select">
                                        <option value="true" ${business.requiresDeposit ? 'selected' : ''}>✅ SÍ - Requiere Anticipo para Confirmar</option>
                                        <option value="false" ${!business.requiresDeposit ? 'selected' : ''}>❌ NO - Pago Total en Mostrador</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="biz-dep-pct"><span class="neon-arrow">◆</span> Porcentaje de Anticipo (%)</label>
                                    <select id="biz-dep-pct" class="cyber-select">
                                        <option value="25" ${business.depositPercentage === 25 ? 'selected' : ''}>25% del total</option>
                                        <option value="50" ${(business.depositPercentage === 50 || !business.depositPercentage) ? 'selected' : ''}>50% del total (Estándar)</option>
                                        <option value="75" ${business.depositPercentage === 75 ? 'selected' : ''}>75% del total</option>
                                        <option value="100" ${business.depositPercentage === 100 ? 'selected' : ''}>100% (Pago Completo Anticipado)</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-group" style="margin-top:10px;">
                                <label for="biz-pay-instructions"><span class="neon-arrow">◆</span> Datos Bancarios & Instrucciones de Pago para Clientes</label>
                                <textarea id="biz-pay-instructions" class="cyber-textarea" rows="3" placeholder="Ej. Transferencia BBVA | CLABE: 012180001234567890 | Beneficiario: Pump Zone S.A. | Enviar comprobante por WhatsApp...">${business.paymentInstructions || ''}</textarea>
                                <small style="color:var(--text-muted); font-size:0.78rem;">Estas instrucciones se muestran al cliente al momento de agendar su reservación.</small>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN 5: REGLAS DEL LOCAL Y SERVICIOS -->
                    <div class="settings-card">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">📜</span>
                                <div>
                                    <h3>5. Reglamento de Máquinas y Servicios Adicionales</h3>
                                    <small>Políticas de uso de las máquinas PIU y datos de cortesía (WiFi)</small>
                                </div>
                            </div>
                        </div>

                        <div class="settings-form-body">
                            <div class="form-group">
                                <label for="biz-rules"><span class="neon-arrow">◆</span> Reglamento Interno de Máquinas</label>
                                <textarea id="biz-rules" class="cyber-textarea" rows="3" placeholder="Ej. 1. Calzado deportivo limpio obligatorio.&#10;2. Prohibido pisar las barras.&#10;3. Tolerancia de espera: 10 minutos.">${business.rules || ''}</textarea>
                            </div>

                            <div class="form-row grid-2" style="margin-top:10px;">
                                <div class="form-group">
                                    <label for="biz-wifi-net"><span class="neon-arrow">◆</span> Red WiFi de Clientes (SSID)</label>
                                    <input type="text" id="biz-wifi-net" class="cyber-input" value="${business.wifiNetwork || ''}" placeholder="Ej. PumpZone_FreeWiFi">
                                </div>
                                <div class="form-group">
                                    <label for="biz-wifi-pass"><span class="neon-arrow">◆</span> Contraseña de WiFi</label>
                                    <input type="text" id="biz-wifi-pass" class="cyber-input" value="${business.wifiPassword || ''}" placeholder="Ej. Phoenix2024">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN 6: ENLACE DIRECTO PARA COMPARTIR -->
                    <div class="settings-card">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">🔗</span>
                                <div>
                                    <h3>6. Enlace Directo de esta Sucursal</h3>
                                    <small>Comparte este enlace en redes sociales o WhatsApp para que tus clientes entren directo a tu local</small>
                                </div>
                            </div>
                        </div>

                        <div class="settings-form-body">
                            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                                <input type="text" readonly value="${clientDirectUrl}" class="cyber-input flex-1" style="background:var(--bg-dark-900); font-family:var(--font-mono); font-size:0.85rem;" id="input-client-direct-link">
                                <button type="button" class="btn btn-outline" id="btn-copy-direct-url">
                                    📋 Copiar Enlace
                                </button>
                                <a href="${clientDirectUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
                                    🌐 Abrir Enlace
                                </a>
                            </div>
                            
                            <div class="form-divider" style="margin: 16px 0;"></div>
                            
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:700;">
                                    <input type="checkbox" id="biz-disable-change-local" style="width:18px; height:18px; accent-color:var(--color-neon-lime); cursor:pointer;" ${business.disableChangeLocal ? 'checked' : ''}>
                                    <span>Bloquear Navegación a esta Sucursal (Ocultar botón "Cambiar de Local" a clientes e invitados)</span>
                                </label>
                                <small style="display:block; margin-top:6px; color:var(--text-muted); font-size:0.78rem; line-height:1.4;">
                                    💡 <em>Al activar esta opción, los usuarios que ingresen a esta sucursal no verán el botón para regresar a la pantalla de selección de locales. El Superadmin siempre podrá verlo para no perder acceso.</em>
                                </small>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN 7: PROGRAMA DE LEALTAD DE LA SUCURSAL -->
                    <div class="settings-card">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">🎁</span>
                                <div>
                                    <h3>7. Programa de Lealtad y Premios en Sucursal</h3>
                                    <small>Configura la activación del programa de visitas/puntos y la tasa de acumulación de puntos para tus clientes</small>
                                </div>
                            </div>
                        </div>

                        <div class="settings-form-body">
                            <div class="form-row grid-3">
                                <div class="form-group">
                                    <label for="biz-loyalty-enabled"><span class="neon-arrow">◆</span> Programa de Lealtad</label>
                                    <select id="biz-loyalty-enabled" class="cyber-select">
                                        <option value="true" ${business.loyaltyEnabled ? 'selected' : ''}>✅ ACTIVO - Configuración Habilitada</option>
                                        <option value="false" ${!business.loyaltyEnabled ? 'selected' : ''}>❌ INACTIVO - Programa deshabilitado</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="biz-loyalty-mode"><span class="neon-arrow">◆</span> Modo del Programa</label>
                                    <select id="biz-loyalty-mode" class="cyber-select">
                                        <option value="POINTS" ${business.loyaltyMode !== 'VISITS' ? 'selected' : ''}>💰 Por Consumo (Puntos)</option>
                                        <option value="VISITS" ${business.loyaltyMode === 'VISITS' ? 'selected' : ''}>📅 Por Cantidad de Visitas</option>
                                    </select>
                                </div>
                                <div class="form-group" id="group-points-ratio" style="${business.loyaltyMode === 'VISITS' ? 'display:none;' : ''}">
                                    <label for="biz-points-ratio"><span class="neon-arrow">◆</span> Tasa de Acumulación (Puntos)</label>
                                    <input type="number" id="biz-points-ratio" class="cyber-input" value="${business.pointsRatio || 10}" min="1" placeholder="Ej. 10 ($10 gastados = 1 punto)">
                                    <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:4px;">1 punto otorgado por cada X unidades de tu moneda consumidas.</small>
                                </div>
                            </div>
                            <div class="form-row grid-3" style="margin-top: 14px;">
                                <div class="form-group">
                                    <label for="biz-loyalty-discount-type"><span class="neon-arrow">◆</span> Tipo de Descuento de Tiers</label>
                                    <select id="biz-loyalty-discount-type" class="cyber-select">
                                        <option value="PERMANENT" ${business.loyaltyDiscountType === 'PERMANENT' || !business.loyaltyDiscountType ? 'selected' : ''}>🌟 Permanente (Siempre activo)</option>
                                        <option value="ONCE" ${business.loyaltyDiscountType === 'ONCE' ? 'selected' : ''}>🎟️ Una Sola Vez (Al alcanzar el rango)</option>
                                        <option value="NONE" ${business.loyaltyDiscountType === 'NONE' ? 'selected' : ''}>🎖️ Solo Distintivo (Sin descuento)</option>
                                    </select>
                                    <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:4px;">Define cómo se aplican los descuentos de rango en reservaciones.</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN 4: TABLA DE TARIFAS ESPECIALES POR DURACIÓN -->
                    <div class="settings-card" style="margin-top: 20px;">
                        <div class="card-title-bar">
                            <div class="title-with-icon">
                                <span class="t-icon">🏷️</span>
                                <div>
                                    <h3>4. Tabla de Tarifas Especiales por Duración</h3>
                                    <small>Configura precios fijos específicos para ciertas duraciones y modos de juego. Si un cliente reserva otra duración, se aplicará el cálculo proporcional de la máquina.</small>
                                </div>
                            </div>
                        </div>

                        <div class="settings-form-body">
                            <div class="catalogs-table-wrapper">
                                <table class="catalogs-table" id="table-custom-rates">
                                    <thead>
                                        <tr>
                                            <th>Modo de Juego</th>
                                            <th>Duración (Minutos)</th>
                                            <th>Precio Fijo (${business.currencySymbol})</th>
                                            <th>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody id="custom-rates-tbody">
                                        <!-- Se llena dinámicamente con JS -->
                                    </tbody>
                                </table>
                            </div>

                            <div style="margin-top: 15px; display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; background: rgba(0,0,0,0.2); padding: 12px; border-radius: var(--radius-sm); border: 1px dashed var(--border-color);">
                                <div class="form-group" style="margin: 0; flex: 1; min-width: 120px;">
                                    <label for="new-rate-players" style="font-size: 0.75rem;">Modo</label>
                                    <select id="new-rate-players" class="cyber-select" style="padding: 6px;">
                                        <option value="1">👤 1 Jugador</option>
                                        <option value="2">👥 2 Jugadores</option>
                                    </select>
                                </div>
                                <div class="form-group" style="margin: 0; flex: 1; min-width: 120px;">
                                    <label for="new-rate-duration" style="font-size: 0.75rem;">Duración (Minutos)</label>
                                    <input type="number" id="new-rate-duration" class="cyber-input" placeholder="Ej. 15, 30, 105" min="1" style="padding: 6px;">
                                </div>
                                <div class="form-group" style="margin: 0; flex: 1; min-width: 120px;">
                                    <label for="new-rate-price" style="font-size: 0.75rem;">Precio Fijo (${business.currencySymbol})</label>
                                    <input type="number" id="new-rate-price" class="cyber-input" placeholder="Ej. 20, 40, 230" min="1" style="padding: 6px;">
                                </div>
                                <button type="button" class="btn btn-success btn-sm" id="btn-add-custom-rate" style="padding: 8px 16px;">
                                    ➕ Agregar Tarifa
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- BOTÓN GUARDAR CAMBIOS -->
                    <div class="settings-actions-sticky" style="display:flex; justify-content:flex-end; gap:12px; padding:16px 0;">
                        <button type="submit" class="btn btn-primary glow-red" style="font-size:1.05rem; padding:12px 28px;">
                            💾 Guardar Todas las Configuraciones del Local
                        </button>
                    </div>

                    ${isSuperAdmin ? `
                        <!-- Tarjeta de Catálogos del Sistema Aislados (Solo Superadmin) -->
                        <div class="settings-card" style="margin-top:10px;">
                            <div class="card-title-bar">
                                <div class="title-with-icon">
                                    <span class="t-icon">🗄️</span>
                                    <div>
                                        <h3>Catálogos del Sistema Aislados (Namespace PIU)</h3>
                                        <small>Colecciones de Firestore protegidas contra colisiones</small>
                                    </div>
                                </div>
                            </div>

                            <div class="catalogs-table-wrapper">
                                <table class="catalogs-table">
                                    <thead>
                                        <tr>
                                            <th>Colección en Firebase</th>
                                            <th>Propósito / Contenido</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><code>${COLLECTIONS.BUSINESSES}</code></td>
                                            <td>Catálogo de Negocios y Sucursales independientes</td>
                                            <td><span class="badge badge-success">Activo (${allBusinesses.length})</span></td>
                                        </tr>
                                        <tr>
                                            <td><code>${COLLECTIONS.MACHINES}</code></td>
                                            <td>Catálogo de Gabinetes PIU (LX, TX, FX, sensores, tarifas)</td>
                                            <td><span class="badge badge-success">Activo (${store.machines.length})</span></td>
                                        </tr>
                                        <tr>
                                            <td><code>${COLLECTIONS.RESERVATIONS}</code></td>
                                            <td>Catálogo de Reservaciones y Solicitudes de Máquinas</td>
                                            <td><span class="badge badge-success">Activo (${store.reservations.length})</span></td>
                                        </tr>
                                        <tr>
                                            <td><code>${COLLECTIONS.OPERATING_RULES}</code></td>
                                            <td>Horarios y Reglas Operativas por Día</td>
                                            <td><span class="badge badge-primary">Configurado</span></td>
                                        </tr>
                                        <tr>
                                            <td><code>${COLLECTIONS.GAME_VERSIONS}</code></td>
                                            <td>Catálogo de Versiones (Phoenix 2024, XX, Prime 2)</td>
                                            <td><span class="badge badge-primary">Estándar</span></td>
                                        </tr>
                                        <tr>
                                            <td><code>${COLLECTIONS.PLAYERS}</code></td>
                                            <td>Directorio de Jugadores y Gamertags</td>
                                            <td><span class="badge badge-primary">Dinámico</span></td>
                                        </tr>
                                        <tr>
                                            <td><code>${COLLECTIONS.AUDIT_LOGS}</code></td>
                                            <td>Bitácora de Aprobaciones y Acciones de Encargados</td>
                                            <td><span class="badge badge-primary">Automático</span></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Tarjeta de Gestión de Todas las Sucursales (Solo Superadmin) -->
                        <div class="settings-card">
                            <div class="card-title-bar">
                                <div class="title-with-icon">
                                    <span class="t-icon">🌐</span>
                                    <div>
                                        <h3>Todas las Sucursales Registradas (${allBusinesses.length})</h3>
                                        <small>Alterna o administra las sucursales existentes en la plataforma</small>
                                    </div>
                                </div>
                            </div>

                            <div class="biz-list-grid">
                                ${allBusinesses.map(b => {
                                    const isCurrent = b.id === business.id;
                                    return `
                                        <div class="biz-item-card ${isCurrent ? 'biz-active-highlight' : ''}">
                                            <div class="biz-item-logo">${b.logoIcon || '🕹️'}</div>
                                            <div class="biz-item-info">
                                                <h4>${b.name}</h4>
                                                <p>${b.city} • ${b.openingTime} - ${b.closingTime}</p>
                                            </div>
                                            <div class="biz-item-actions">
                                                ${isCurrent 
                                                    ? '<span class="badge badge-success">Activa Ahora</span>' 
                                                    : `<button type="button" class="btn btn-outline btn-xs btn-switch-biz" data-id="${b.id}">Cambiar</button>`
                                                }
                                                ${allBusinesses.length > 1 ? `
                                                    <button type="button" class="btn btn-danger btn-xs btn-del-biz" data-id="${b.id}" title="Eliminar Sucursal">🗑️</button>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- Respaldo y Restauración de Base de Datos -->
                        <div class="settings-card">
                            <div class="card-title-bar">
                                <div class="title-with-icon">
                                    <span class="t-icon">💾</span>
                                    <div>
                                        <h3>Respaldo y Mantenimiento de Datos</h3>
                                        <small>Exporta o restaura la base de datos completa en formato JSON</small>
                                    </div>
                                </div>
                            </div>

                            <div class="backup-actions-row">
                                <button type="button" class="btn btn-outline" id="btn-export-backup">
                                    📥 Exportar Respaldo JSON
                                </button>
                                <label class="btn btn-outline" for="input-import-backup">
                                    📤 Importar Respaldo JSON
                                    <input type="file" id="input-import-backup" accept=".json" class="hidden">
                                </label>
                                <button type="button" class="btn btn-danger btn-outline" id="btn-reset-demo">
                                    🔄 Restaurar Datos Demo
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </form>
        </div>
    `;

    // =========================================================================
    // CONTROLADORES INTERACTIVOS Y VISTA PREVIA EN VIVO
    // =========================================================================
    const imgInput = container.querySelector('#biz-image-url');
    const previewImg = container.querySelector('#biz-preview-img');
    const statusBadge = container.querySelector('#img-status-badge');
    const previewIcon = container.querySelector('#biz-preview-icon');
    const previewName = container.querySelector('#biz-preview-name');
    const previewTagline = container.querySelector('#biz-preview-tagline');
    const previewCityBadge = container.querySelector('#biz-preview-city-badge');
    const nameInput = container.querySelector('#biz-name');
    const taglineInput = container.querySelector('#biz-tagline');
    const cityInput = container.querySelector('#biz-city');
    const logoInput = container.querySelector('#biz-logo-icon');
    const colorInput = container.querySelector('#biz-theme-color');

    // Función auxiliar para actualizar imagen de vista previa
    const updatePreviewImage = (url) => {
        const cleanUrl = (url || '').trim();
        if (!cleanUrl) {
            previewImg.src = STOCK_ARCADE_URL;
            if (statusBadge) {
                statusBadge.textContent = "● Imagen Arcade por Defecto";
                statusBadge.className = "badge badge-primary";
            }
            return;
        }

        if (statusBadge) {
            statusBadge.textContent = "⌛ Cargando Imagen...";
            statusBadge.className = "badge badge-primary";
        }

        const testImage = new Image();
        testImage.referrerPolicy = "no-referrer";
        testImage.onload = () => {
            previewImg.src = cleanUrl;
            if (statusBadge) {
                statusBadge.textContent = "✅ Imagen Cargada Exitosamente";
                statusBadge.className = "badge badge-success";
            }
        };
        testImage.onerror = () => {
            previewImg.src = STOCK_ARCADE_URL;
            if (statusBadge) {
                statusBadge.textContent = "⚠️ Error al cargar URL externa";
                statusBadge.className = "badge badge-warning";
            }
        };
        testImage.src = cleanUrl;
    };

    // Live update al escribir/pegar URL
    imgInput?.addEventListener('input', (e) => {
        updatePreviewImage(e.target.value);
    });

    imgInput?.addEventListener('change', (e) => {
        updatePreviewImage(e.target.value);
    });

    // Botón ir a Directorio y Cuentas de Jugadores
    container.querySelector('#btn-go-to-clients-acct')?.addEventListener('click', () => {
        store.setCurrentView('CLIENTS');
    });

    // Botón para pegar URL de Facebook proporcionada en el requerimiento
    container.querySelector('#btn-paste-fb-example')?.addEventListener('click', () => {
        if (imgInput) {
            imgInput.value = FB_EXAMPLE_URL;
            updatePreviewImage(FB_EXAMPLE_URL);
            toast.info("URL de Facebook pegada en el campo.");
        }
    });

    // Botón restaurar imagen stock arcade
    container.querySelector('#btn-restore-stock-img')?.addEventListener('click', () => {
        if (imgInput) {
            imgInput.value = STOCK_ARCADE_URL;
            updatePreviewImage(STOCK_ARCADE_URL);
            toast.info("Imagen Arcade estándar seleccionada.");
        }
    });

    // Botón limpiar imagen
    container.querySelector('#btn-clear-img')?.addEventListener('click', () => {
        if (imgInput) {
            imgInput.value = '';
            updatePreviewImage('');
            toast.info("Campo de imagen limpiado.");
        }
    });

    // Live update de textos
    nameInput?.addEventListener('input', (e) => {
        if (previewName) previewName.textContent = e.target.value.trim() || 'Nombre de la Sucursal';
    });
    taglineInput?.addEventListener('input', (e) => {
        if (previewTagline) previewTagline.textContent = e.target.value.trim() || 'Centro de Juego y Baile';
    });
    cityInput?.addEventListener('input', (e) => {
        if (previewCityBadge) previewCityBadge.textContent = e.target.value.trim() || 'Ciudad';
    });
    logoInput?.addEventListener('input', (e) => {
        if (previewIcon) previewIcon.textContent = e.target.value.trim() || '🕹️';
    });

    // Preset Emojis
    container.querySelectorAll('.btn-emoji-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.dataset.emoji;
            if (logoInput) logoInput.value = emoji;
            if (previewIcon) previewIcon.textContent = emoji;
            container.querySelectorAll('.btn-emoji-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    const themeSelect = container.querySelector('#biz-theme-id');
    const themePreviewBars = container.querySelector('#theme-preview-bars');

    const updateThemePreview = (tId) => {
        const theme = THEMES[tId] || THEMES['phoenix'];
        if (previewIcon) previewIcon.style.borderColor = theme.primary;
        if (themePreviewBars) {
            themePreviewBars.innerHTML = `
                <div style="flex:1; background:${theme.bgDark}" title="Fondo Oscuro"></div>
                <div style="flex:1; background:${theme.bgMedium}" title="Fondo Medio"></div>
                <div style="flex:1; background:${theme.bgLight}" title="Fondo Claro"></div>
                <div style="flex:1; background:${theme.primary}" title="Acento Primario"></div>
                <div style="flex:1; background:${theme.secondary}" title="Acento Secundario"></div>
                <div style="flex:1; background:${theme.accent}" title="Acento Terciario"></div>
            `;
        }
    };

    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            updateThemePreview(e.target.value);
        });
        updateThemePreview(themeSelect.value); // Render inicial
    }

    // Probar WhatsApp
    container.querySelector('#btn-test-wa')?.addEventListener('click', () => {
        const rawWa = container.querySelector('#biz-whatsapp')?.value.trim().replace(/\D/g, '');
        if (!rawWa) {
            toast.warning("Ingresa primero un número de WhatsApp.");
            return;
        }
        window.open(`https://wa.me/52${rawWa}?text=${encodeURIComponent('Hola, me comunico de ' + (business.name || 'PIU'))}`, '_blank');
    });

    // Probar Google Maps
    container.querySelector('#btn-test-maps')?.addEventListener('click', () => {
        const mapsUrl = container.querySelector('#biz-maps')?.value.trim();
        if (!mapsUrl) {
            toast.warning("Ingresa primero la URL de Google Maps.");
            return;
        }
        window.open(mapsUrl, '_blank');
    });

    // Copiar enlace directo
    container.querySelector('#btn-copy-direct-url')?.addEventListener('click', () => {
        const inputEl = container.querySelector('#input-client-direct-link');
        if (inputEl) {
            inputEl.select();
            navigator.clipboard.writeText(inputEl.value).then(() => {
                toast.success("¡Enlace directo del local copiado al portapapeles!");
            }).catch(() => {
                prompt("Copia este enlace directo:", inputEl.value);
            });
        }
    });

    // Habilitar/Deshabilitar inputs de tiempo de la tabla de horarios
    container.querySelectorAll('.day-closed-checkbox').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const dayId = chk.dataset.dayId;
            const isOpen = e.target.checked;
            const label = chk.parentElement.querySelector('.status-label');
            if (label) {
                label.textContent = isOpen ? 'Abierto' : 'Cerrado';
                label.style.color = isOpen ? 'var(--color-neon-lime)' : 'var(--text-muted)';
            }
            
            const openInput = container.querySelector(`.day-open-time[data-day-id="${dayId}"]`);
            const closeInput = container.querySelector(`.day-close-time[data-day-id="${dayId}"]`);
            if (openInput) openInput.disabled = !isOpen;
            if (closeInput) closeInput.disabled = !isOpen;
        });
    });

    // Alternar visibilidad de ratio de puntos según modo de lealtad
    const loyaltyModeSelect = container.querySelector('#biz-loyalty-mode');
    const pointsRatioGroup = container.querySelector('#group-points-ratio');
    if (loyaltyModeSelect && pointsRatioGroup) {
        loyaltyModeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'VISITS') {
                pointsRatioGroup.style.display = 'none';
            } else {
                pointsRatioGroup.style.display = 'block';
            }
        });
    }

    // =========================================================================
    // GUARDAR TODAS LAS CONFIGURACIONES DEL LOCAL
    // =========================================================================
    container.querySelector('#form-edit-active-biz')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const operatingHours = {};
        DAYS_OF_WEEK.forEach(day => {
            const chk = container.querySelector(`.day-closed-checkbox[data-day-id="${day.id}"]`);
            const openInput = container.querySelector(`.day-open-time[data-day-id="${day.id}"]`);
            const closeInput = container.querySelector(`.day-close-time[data-day-id="${day.id}"]`);
            operatingHours[day.id] = {
                closed: !chk.checked,
                open: openInput.value,
                close: closeInput.value
            };
        });

        // Fallback para campos heredados (usando Lunes o Domingo como representativos)
        const representativeDay = operatingHours[1] || operatingHours[0];
        const openingTime = representativeDay ? representativeDay.open : '11:00';
        const closingTime = representativeDay ? representativeDay.close : '22:00';

        const updated = {
            name: container.querySelector('#biz-name').value.trim(),
            tagline: container.querySelector('#biz-tagline').value.trim(),
            imageUrl: container.querySelector('#biz-image-url').value.trim() || STOCK_ARCADE_URL,
            logoIcon: container.querySelector('#biz-logo-icon').value.trim() || '🕹️',
            themeId: container.querySelector('#biz-theme-id').value,
            city: container.querySelector('#biz-city').value.trim(),
            address: container.querySelector('#biz-address').value.trim(),
            phone: container.querySelector('#biz-phone').value.trim(),
            whatsapp: container.querySelector('#biz-whatsapp').value.trim().replace(/\D/g, ''),
            mapsUrl: container.querySelector('#biz-maps').value.trim(),
            facebookUrl: container.querySelector('#biz-fb').value.trim(),
            instagramUrl: container.querySelector('#biz-ig').value.trim(),
            openingTime,
            closingTime,
            operatingHours,
            customRates: localCustomRates,
            hasSeededOvernightSchedule: business ? (business.hasSeededOvernightSchedule ?? true) : true,
            slotDuration: parseInt(container.querySelector('#biz-slot-dur').value, 10) || 60,
            maxAdvanceDays: parseInt(container.querySelector('#biz-max-advance').value, 10) || 14,
            minCancelNoticeHours: parseInt(container.querySelector('#biz-min-cancel').value, 10) || 2,
            maxActiveBookingsPerUser: parseInt(container.querySelector('#biz-max-active-bookings').value, 10) || 3,
            currencySymbol: container.querySelector('#biz-symbol').value.trim() || '$',
            currency: container.querySelector('#biz-curr').value.trim() || 'MXN',
            requiresDeposit: container.querySelector('#biz-req-deposit').value === 'true',
            depositPercentage: parseInt(container.querySelector('#biz-dep-pct').value, 10) || 50,
            paymentInstructions: container.querySelector('#biz-pay-instructions').value.trim(),
            rules: container.querySelector('#biz-rules').value.trim(),
            wifiNetwork: container.querySelector('#biz-wifi-net').value.trim(),
            wifiPassword: container.querySelector('#biz-wifi-pass').value.trim(),
            disableChangeLocal: container.querySelector('#biz-disable-change-local').checked,
            loyaltyEnabled: container.querySelector('#biz-loyalty-enabled').value === 'true',
            loyaltyMode: container.querySelector('#biz-loyalty-mode').value,
            pointsRatio: parseInt(container.querySelector('#biz-points-ratio').value, 10) || 10,
            loyaltyDiscountType: container.querySelector('#biz-loyalty-discount-type').value
        };

        if (!updated.name || !updated.city) {
            toast.error("Por favor ingresa nombre y ciudad de la sucursal.");
            return;
        }

        try {
            await tenantManager.updateBusiness(business.id, updated, business.version ?? 0);
            toast.success(`Configuraciones de "${updated.name}" guardadas exitosamente.`);
            // Refrescar vista
            renderBusinessView(container);
        } catch (err) {
            toast.error(err.message);
        }
    });

    // =========================================================================
    // EVENTOS DE SUPERADMINISTRADOR
    // =========================================================================
    if (isSuperAdmin) {
        // Registrar nuevo negocio
        container.querySelector('#btn-create-biz')?.addEventListener('click', () => {
            openCreateBusinessModal(container);
        });

        // Cambiar de sucursal
        container.querySelectorAll('.btn-switch-biz').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                await tenantManager.setActiveBusiness(id);
                toast.info(`Sucursal cambiada.`);
                renderBusinessView(container);
            });
        });

        // Eliminar sucursal en cascada
        container.querySelectorAll('.btn-del-biz').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const bToDelete = tenantManager.getBusinessById(id);
                if (confirm(`¿Estás seguro de eliminar permanentemente la sucursal "${bToDelete?.name || id}"?\n\nSe eliminarán todas sus máquinas, reservaciones y configuraciones asociadas.`)) {
                    try {
                        await tenantManager.deleteBusiness(id);
                        toast.warning("Sucursal eliminada.");
                        renderBusinessView(container);
                    } catch (e) {
                        toast.error(e.message);
                    }
                }
            });
        });

        // Exportar JSON
        container.querySelector('#btn-export-backup')?.addEventListener('click', () => {
            const backupData = {
                version: '1.2',
                exportedAt: new Date().toISOString(),
                businesses: tenantManager.getAllBusinesses(),
                activeTenantId: tenantManager.getActiveBusiness().id,
                machines: store.machines,
                reservations: store.reservations
            };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `piu_backup_completo_${new Date().toISOString().slice(0,10)}.json`);
            dlAnchorElem.click();
            toast.success("Archivo de respaldo JSON exportado con éxito.");
        });

        // Importar JSON
        container.querySelector('#input-import-backup')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = JSON.parse(evt.target.result);
                    if (data.businesses) tenantManager.saveLocally(data.businesses);
                    if (data.machines) store.saveLocalMachines(tenantManager.getActiveBusiness().id, data.machines);
                    if (data.reservations) store.saveLocalReservations(tenantManager.getActiveBusiness().id, data.reservations);
                    toast.success("Datos restaurados correctamente. Recargando...");
                    setTimeout(() => window.location.reload(), 800);
                } catch (err) {
                    toast.error("Error al procesar el archivo JSON: " + err.message);
                }
            };
            reader.readAsText(file);
        });

        // Resetear a datos demo
        container.querySelector('#btn-reset-demo')?.addEventListener('click', () => {
            if (confirm("¿Restaurar todos los datos demo de prueba? Se reiniciarán las configuraciones, máquinas y reservas.")) {
                localStorage.clear();
                toast.info("Reiniciando base de datos a valores de prueba...");
                setTimeout(() => window.location.reload(), 500);
            }
        });

        // Lógica de tabla de tarifas especiales
        const renderCustomRatesTable = () => {
            const tbody = container.querySelector('#custom-rates-tbody');
            if (!tbody) return;

            if (localCustomRates.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 16px;">
                            No hay tarifas especiales configuradas. Se aplicará cobro proporcional por hora.
                        </td>
                    </tr>
                `;
                return;
            }

            localCustomRates.sort((a,b) => a.players - b.players || a.duration - b.duration);

            tbody.innerHTML = localCustomRates.map((r, index) => `
                <tr>
                    <td><strong>${r.players === 2 ? '👥 2 Jugadores' : '👤 1 Jugador'}</strong></td>
                    <td><code>${r.duration} minutos</code> (${Math.round(r.duration / 60 * 100) / 100} hrs)</td>
                    <td><strong class="highlight-gold">${business.currencySymbol}${r.price}</strong></td>
                    <td>
                        <button type="button" class="btn btn-danger btn-xs btn-remove-custom-rate" data-index="${index}" style="border-color: rgba(255, 0, 85, 0.4); color: var(--color-neon-rose);">
                            🗑️ Borrar
                        </button>
                    </td>
                </tr>
            `).join('');

            tbody.querySelectorAll('.btn-remove-custom-rate').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.index, 10);
                    localCustomRates.splice(idx, 1);
                    renderCustomRatesTable();
                });
            });
        };

        // Renderizar tabla inicialmente
        renderCustomRatesTable();

        // Agregar Tarifa Especial
        container.querySelector('#btn-add-custom-rate')?.addEventListener('click', () => {
            const playersVal = parseInt(container.querySelector('#new-rate-players').value, 10);
            const durationVal = parseInt(container.querySelector('#new-rate-duration').value, 10);
            const priceVal = parseFloat(container.querySelector('#new-rate-price').value);

            if (isNaN(durationVal) || isNaN(priceVal) || durationVal <= 0 || priceVal <= 0) {
                toast.error("Por favor ingresa una duración y un precio válidos.");
                return;
            }

            const exists = localCustomRates.some(r => r.players === playersVal && r.duration === durationVal);
            if (exists) {
                toast.error("Ya existe una tarifa configurada para esa duración y modo.");
                return;
            }

            localCustomRates.push({ players: playersVal, duration: durationVal, price: priceVal });
            
            container.querySelector('#new-rate-duration').value = '';
            container.querySelector('#new-rate-price').value = '';

            renderCustomRatesTable();
            toast.success("Tarifa especial agregada.");
        });
    }
}

/**
 * Modal para registrar una nueva sucursal o local con todos sus datos
 */
function openCreateBusinessModal(mainContainer) {
    const contentHtml = `
        <form id="form-create-biz" class="cyber-form">
            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="new-biz-name"><span class="neon-arrow">◆</span> Nombre del Local / Sucursal *</label>
                    <input type="text" id="new-biz-name" class="cyber-input" placeholder="Ej. PIU Arena Guadalajara" required>
                </div>
                <div class="form-group">
                    <label for="new-biz-icon"><span class="neon-arrow">◆</span> Icono Emoji</label>
                    <input type="text" id="new-biz-icon" class="cyber-input" value="⚡" style="max-width: 80px; text-align:center; font-size:1.2rem;">
                </div>
            </div>

            <div class="form-group">
                <label for="new-biz-img"><span class="neon-arrow">◆</span> URL Pública de Imagen / Banner</label>
                <input type="url" id="new-biz-img" class="cyber-input" placeholder="https://..." value="${STOCK_ARCADE_URL}">
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="new-biz-city"><span class="neon-arrow">◆</span> Ciudad / Zona *</label>
                    <input type="text" id="new-biz-city" class="cyber-input" placeholder="Ej. Guadalajara, Jal." required>
                </div>
                <div class="form-group">
                    <label for="new-biz-wa"><span class="neon-arrow">◆</span> WhatsApp de Atención</label>
                    <input type="text" id="new-biz-wa" class="cyber-input" placeholder="Ej. 3312345678">
                </div>
            </div>

            <div class="form-row grid-2">
                <div class="form-group">
                    <label for="new-biz-open"><span class="neon-arrow">◆</span> Apertura</label>
                    <input type="time" id="new-biz-open" class="cyber-input" value="11:00">
                </div>
                <div class="form-group">
                    <label for="new-biz-close"><span class="neon-arrow">◆</span> Cierre</label>
                    <input type="time" id="new-biz-close" class="cyber-input" value="22:00">
                </div>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" id="btn-cancel-create-biz">Cancelar</button>
        <button type="button" class="btn btn-primary glow-red" id="btn-submit-create-biz">🏢 Registrar Sucursal</button>
    `;

    const modalEl = modal.open({
        title: 'Registrar Nueva Sucursal / Negocio',
        icon: '🏢',
        contentHtml,
        footerHtml,
        maxWidth: '560px'
    });

    modalEl.querySelector('#btn-cancel-create-biz').onclick = () => modal.close();

    modalEl.querySelector('#btn-submit-create-biz').onclick = async () => {
        const name = modalEl.querySelector('#new-biz-name').value.trim();
        const city = modalEl.querySelector('#new-biz-city').value.trim();
        const logoIcon = modalEl.querySelector('#new-biz-icon').value.trim() || '🕹️';
        const imageUrl = modalEl.querySelector('#new-biz-img').value.trim() || STOCK_ARCADE_URL;
        const whatsapp = modalEl.querySelector('#new-biz-wa').value.trim();
        const openingTime = modalEl.querySelector('#new-biz-open').value;
        const closingTime = modalEl.querySelector('#new-biz-close').value;

        if (!name || !city) {
            toast.error("Por favor ingresa el nombre y la ciudad de la sucursal.");
            return;
        }

        try {
            const newBiz = await tenantManager.createBusiness({
                name, city, logoIcon, imageUrl, whatsapp, openingTime, closingTime
            });
            modal.close();
            toast.success(`¡Sucursal "${newBiz.name}" creada y activada con éxito!`);
            if (mainContainer) renderBusinessView(mainContainer);
        } catch (e) {
            toast.error(e.message);
        }
    };
}
