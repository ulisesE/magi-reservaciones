// js/views/downloadAppView.js
// Vista dedicada para descargar e instalar la aplicación PWA (Progressive Web App)
// Personalizada y configurada exclusivamente para el local/sucursal seleccionada
import { store } from '../core/store.js';
import { tenantManager } from '../core/tenantManager.js';
import { authManager } from '../core/authManager.js';
import { pwaManager } from '../core/pwaManager.js';
import { toast } from '../components/toast.js';
import { escapeHTML } from '../core/securityUtils.js';

export function renderDownloadAppView(container) {
    const business = store.currentBusiness || tenantManager.getActiveBusiness();
    const isStaff = authManager.isStaff();
    const isLocalSelected = tenantManager.isLocalSelected;

    const isSuperAdmin = authManager.isSuperAdmin();
    const isLocalActive = business && tenantManager.isBusinessActive(business);

    // Si no hay local seleccionado o el seleccionado está deshabilitado para no-superadmin
    if (!business || !isLocalSelected || (!isLocalActive && !isSuperAdmin)) {
        const selectableBusinesses = isSuperAdmin 
            ? tenantManager.getAllBusinesses() 
            : tenantManager.getActiveBusinesses();

        container.innerHTML = `
            <div class="download-app-wrapper animate-fade-in" style="max-width:800px; margin:30px auto; padding:20px;">
                <div class="glass-card" style="text-align:center; padding:36px 20px;">
                    <div style="font-size:3.5rem; margin-bottom:12px;">🕹️</div>
                    <h2 style="font-family:var(--font-heading); color:#ffffff; font-size:1.8rem; margin:0 0 10px 0;">SELECCIONA TU SUCURSAL PARA DESCARGAR LA APP</h2>
                    <p style="color:var(--text-secondary); font-size:0.95rem; max-width:500px; margin:0 auto 24px auto;">
                        Cada sucursal cuenta con su enlace e instalador exclusivo de la App PWA. Por favor elige tu sala de juego habilitada:
                    </p>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
                        ${selectableBusinesses.map(b => `
                            <button type="button" class="btn btn-outline btn-select-biz-for-download" data-id="${b.id}" style="padding:14px; display:flex; align-items:center; gap:10px; justify-content:flex-start; text-align:left;">
                                <span style="font-size:1.5rem;">${b.logoIcon || '🎮'}</span>
                                <div>
                                    <strong style="color:#ffffff; display:block;">${escapeHTML(b.name)}</strong>
                                    <small style="color:var(--color-neon-lime);">${escapeHTML(b.city)}</small>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        container.querySelectorAll('.btn-select-biz-for-download').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                await tenantManager.selectLocal(id);
                renderDownloadAppView(container);
            });
        });
        return;
    }

    // Asegurar que el manifest esté actualizado para esta sucursal
    pwaManager.updateDynamicManifest(business);

    // URLs específicas para esta sucursal
    const baseUrl = window.location.origin + window.location.pathname;
    const directLocalUrl = `${baseUrl}?local=${business.id}`;
    const downloadPageUrl = `${baseUrl}?local=${business.id}&view=DOWNLOAD`;
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=10&data=${encodeURIComponent(directLocalUrl)}`;
    const isStandalone = pwaManager.isStandaloneMode();

    container.innerHTML = `
        <div class="download-app-view-container animate-fade-in">
            <!-- Hero Header de Descarga -->
            <div class="download-hero-card">
                <div class="download-hero-badge">
                    <span class="neon-arrow">◆</span> APLICACIÓN OFICIAL PWA • ${escapeHTML(business.city || 'ARCADE')}
                </div>
                
                <h1 class="download-hero-title">
                    DESCARGA LA APP DE <span class="piu-highlight">${escapeHTML(business.name)}</span>
                </h1>
                
                <p class="download-hero-subtitle">
                    Instala la App oficial directamente en tu dispositivo sin descargas pesadas de tiendas. Configurada y vinculada exclusivamente a <strong>${escapeHTML(business.name)}</strong>.
                </p>

                <!-- Tarjeta Principal de Instalación Inmediata -->
                <div class="download-cta-box">
                    <div id="pwa-status-badge-wrap" style="margin-bottom:12px;">
                        ${isStandalone ? `
                            <span class="badge badge-success" style="font-size:0.85rem; padding:6px 14px;">
                                ✅ EJECUTÁNDOSE EN MODO APP (STANDALONE)
                            </span>
                        ` : `
                            <span class="badge badge-primary" style="font-size:0.82rem; padding:5px 12px; background:rgba(0, 229, 255, 0.15); border-color:var(--color-neon-cyan); color:var(--color-neon-cyan);">
                                ⚡ LISTA PARA INSTALACIÓN INMEDIATA (PWA)
                            </span>
                        `}
                    </div>

                    <div class="download-cta-actions">
                        <button type="button" class="btn btn-primary glow-red btn-install-direct-action" id="btn-install-direct" style="padding:12px 28px; font-size:1.05rem; font-weight:800; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:8px;">
                            <span>${isStandalone ? '🕹️ App Ya Instalada (Ver Opciones)' : '📲 Instalar App en este Dispositivo'}</span>
                        </button>
                        
                        <button type="button" class="btn btn-outline btn-share-wa" id="btn-share-whatsapp" style="border-radius:var(--radius-full); padding:12px 20px; font-size:0.92rem; border-color:#25D366; color:#25D366; font-weight:700; display:inline-flex; align-items:center; gap:6px;">
                            <span>💬 Compartir por WhatsApp</span>
                        </button>
                    </div>

                    <p style="color:var(--text-muted); font-size:0.78rem; margin-top:10px;">
                        💡 No ocupa espacio de 100MB • No requiere Play Store ni App Store • Se actualiza automáticamente
                    </p>
                </div>
            </div>

            <!-- Grid de Enlace Directo & Código QR para Clientes / Locatario -->
            <div class="download-grid-two-col">
                <!-- Columna Izquierda: Enlace de Descarga Compartible -->
                <div class="glass-card download-share-card">
                    <div class="card-header-styled">
                        <span class="header-icon">🔗</span>
                        <div>
                            <h3 style="margin:0; font-size:1.1rem; color:#ffffff; font-family:var(--font-heading);">ENLACE DE DESCARGA EXCLUSIVO</h3>
                            <small style="color:var(--color-neon-lime);">Enlace para compartir con clientes o jugadores de ${escapeHTML(business.name)}</small>
                        </div>
                    </div>

                    <div style="margin:16px 0;">
                        <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:6px;">
                            URL Directa de la Sucursal:
                        </label>
                        <div class="copy-url-group">
                            <input type="text" id="input-download-url" class="cyber-input" value="${escapeHTML(directLocalUrl)}" readonly style="font-family:var(--font-mono); font-size:0.85rem; background:var(--bg-dark-900); color:var(--color-neon-cyan);">
                            <button type="button" class="btn btn-secondary" id="btn-copy-url" title="Copiar enlace al portapapeles">
                                <span id="copy-btn-text">📋 Copiar</span>
                            </button>
                        </div>
                    </div>

                    <div style="background:var(--bg-dark-800); border:1px dashed rgba(255,255,255,0.12); border-radius:var(--radius-sm); padding:12px; font-size:0.82rem; color:var(--text-secondary); line-height:1.5;">
                        <strong style="color:#ffffff; display:block; margin-bottom:4px;">🎯 ¿Cómo funciona este enlace?</strong>
                        Cuando una persona abra este link en su celular, entrará automáticamente a <strong>${escapeHTML(business.name)}</strong> con el botón de instalación ya listo para añadir el acceso directo de esta sucursal a su pantalla de inicio.
                    </div>

                    ${isStaff ? `
                        <div style="margin-top:14px; padding:10px; background:rgba(104,242,5,0.06); border:1px solid rgba(104,242,5,0.25); border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:space-between; gap:10px;">
                            <span style="font-size:0.78rem; color:var(--color-neon-lime);">
                                👑 <strong>Consejo para el Locatario:</strong> Coloca este enlace en el estado de WhatsApp o bio de Instagram de tu sala.
                            </span>
                        </div>
                    ` : ''}
                </div>

                <!-- Columna Derecha: Código QR para Mostrar en Mostrador / Sala -->
                <div class="glass-card download-qr-card" style="text-align:center;">
                    <div class="card-header-styled" style="justify-content:center; text-align:center;">
                        <div>
                            <h3 style="margin:0; font-size:1.1rem; color:#ffffff; font-family:var(--font-heading);">📱 CÓDIGO QR PARA ESCANEAR</h3>
                            <small style="color:var(--text-muted);">Apunta con la cámara de tu celular para descargar al instante</small>
                        </div>
                    </div>

                    <div class="qr-image-wrapper" style="margin:16px auto; display:inline-block; padding:12px; background:#ffffff; border-radius:var(--radius-md); box-shadow: 0 0 25px rgba(0, 229, 255, 0.25); border: 2px solid var(--color-neon-cyan);">
                        <img src="${qrCodeApiUrl}" 
                             alt="QR Descarga App ${escapeHTML(business.name)}" 
                             id="img-download-qr"
                             style="width:190px; height:190px; display:block;"
                             loading="lazy">
                    </div>

                    <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-outline btn-sm" id="btn-download-qr-img" style="border-radius:var(--radius-full); font-size:0.8rem; border-color:var(--color-neon-lime); color:var(--color-neon-lime);">
                            <span>⬇️ Descargar QR (Para Imprimir en Mostrador)</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Guía Paso a Paso Interactiva por Sistema Operativo -->
            <div class="download-guide-section glass-card" style="margin-top:24px;">
                <div class="card-header-styled">
                    <span class="header-icon">📖</span>
                    <div>
                        <h3 style="margin:0; font-size:1.2rem; color:#ffffff; font-family:var(--font-heading);">GUÍA DE INSTALACIÓN PASO A PASO</h3>
                        <small style="color:var(--text-muted);">Selecciona tu tipo de dispositivo para ver las instrucciones ilustradas</small>
                    </div>
                </div>

                <!-- Pestañas de Plataforma -->
                <div class="platform-tabs-nav" style="display:flex; gap:8px; margin:16px 0; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; flex-wrap:wrap;">
                    <button type="button" class="platform-tab-btn ${!isIos ? 'active' : ''}" data-platform="android">
                        <span>🤖 Android (Chrome / Edge)</span>
                    </button>
                    <button type="button" class="platform-tab-btn ${isIos ? 'active' : ''}" data-platform="ios">
                        <span>🍏 iPhone / iPad (Safari)</span>
                    </button>
                    <button type="button" class="platform-tab-btn" data-platform="desktop">
                        <span>💻 Computadora (PC / Mac)</span>
                    </button>
                </div>

                <!-- Contenido Pestaña Android -->
                <div class="platform-tab-content ${!isIos ? 'active' : ''}" id="tab-content-android">
                    <div class="steps-grid">
                        <div class="step-card">
                            <div class="step-number">1</div>
                            <div class="step-icon">🌐</div>
                            <h4>Abre el enlace en Chrome</h4>
                            <p>Ingresa al enlace desde el navegador Google Chrome o Samsung Internet en tu celular Android.</p>
                        </div>
                        <div class="step-card">
                            <div class="step-number">2</div>
                            <div class="step-icon">📲</div>
                            <h4>Toca en "Instalar App"</h4>
                            <p>Presiona el botón rojo superior <strong>"Instalar App"</strong> o abre el menú ⋮ de Chrome y selecciona <strong>"Instalar aplicación"</strong>.</p>
                        </div>
                        <div class="step-card">
                            <div class="step-number">3</div>
                            <div class="step-icon">🎮</div>
                            <h4>¡Listo para Jugar!</h4>
                            <p>El icono de <strong>${escapeHTML(business.name)}</strong> aparecerá en tu menú de aplicaciones como app nativa.</p>
                        </div>
                    </div>
                </div>

                <!-- Contenido Pestaña iOS -->
                <div class="platform-tab-content ${isIos ? 'active' : ''}" id="tab-content-ios">
                    <div class="steps-grid">
                        <div class="step-card">
                            <div class="step-number">1</div>
                            <div class="step-icon">🧭</div>
                            <h4>Abre en Safari</h4>
                            <p>Asegúrate de abrir el enlace directamente en el navegador <strong>Safari</strong> de Apple.</p>
                        </div>
                        <div class="step-card">
                            <div class="step-number">2</div>
                            <div class="step-icon">⎋</div>
                            <h4>Toca "Compartir"</h4>
                            <p>Toca el icono de compartir <strong style="color:var(--color-neon-cyan);">⎋</strong> (cuadrado con flecha hacia arriba) en la barra inferior de Safari.</p>
                        </div>
                        <div class="step-card">
                            <div class="step-number">3</div>
                            <div class="step-icon">➕</div>
                            <h4>"Agregar a inicio"</h4>
                            <p>Desplázate hacia abajo en las opciones y selecciona <strong style="color:var(--color-neon-lime);">"Agregar a la pantalla de inicio"</strong>.</p>
                        </div>
                        <div class="step-card">
                            <div class="step-number">4</div>
                            <div class="step-icon">✨</div>
                            <h4>Confirma en "Agregar"</h4>
                            <p>Toca "Agregar" arriba a la derecha. ¡La app abrirá en pantalla completa sin barra de navegación!</p>
                        </div>
                    </div>
                </div>

                <!-- Contenido Pestaña Desktop -->
                <div class="platform-tab-content" id="tab-content-desktop">
                    <div class="steps-grid">
                        <div class="step-card">
                            <div class="step-number">1</div>
                            <div class="step-icon">🖥️</div>
                            <h4>Abre en Chrome o Edge</h4>
                            <p>Navega a esta página desde Google Chrome, Microsoft Edge o Brave en tu PC o Mac.</p>
                        </div>
                        <div class="step-card">
                            <div class="step-number">2</div>
                            <div class="step-icon">➕</div>
                            <h4>Clic en icono de Instalar</h4>
                            <p>En el extremo derecho de la barra de direcciones URL, haz clic en el icono <strong>🖥️ Instalar</strong> o en menú ⋮ -> <strong>Instalar Pump It Up Hub</strong>.</p>
                        </div>
                        <div class="step-card">
                            <div class="step-number">3</div>
                            <div class="step-icon">⚡</div>
                            <h4>Acceso de Escritorio</h4>
                            <p>Se creará un acceso directo en tu escritorio e inicio para abrir el sistema de inmediato con teclado y pantalla completa.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Ventajas y Beneficios de la App PWA -->
            <div class="download-benefits-section" style="margin-top:24px;">
                <h3 style="font-family:var(--font-heading); color:#ffffff; font-size:1.3rem; margin-bottom:16px; text-align:center;">
                    ⚡ ¿POR QUÉ INSTALAR LA APP DE ${escapeHTML(business.name.toUpperCase())}?
                </h3>

                <div class="benefits-grid">
                    <div class="benefit-item">
                        <span class="benefit-icon">🚀</span>
                        <div class="benefit-text">
                            <strong>100% Ultraligera y Rápida</strong>
                            <p>No ocupa memoria en tu teléfono y carga instantáneamente gracias al almacenamiento en caché.</p>
                        </div>
                    </div>

                    <div class="benefit-item">
                        <span class="benefit-icon">🕹️</span>
                        <div class="benefit-text">
                            <strong>Directo a tu Sucursal</strong>
                            <p>Abre directamente el calendario de máquinas, tarifas y horarios de ${escapeHTML(business.name)}.</p>
                        </div>
                    </div>

                    <div class="benefit-item">
                        <span class="benefit-icon">🔔</span>
                        <div class="benefit-text">
                            <strong>Notificaciones de Retas & Turnos</strong>
                            <p>Recibe avisos inmediatos cuando confirmen tu reserva o cuando alguien te lance un reto en la Arena Versus.</p>
                        </div>
                    </div>

                    <div class="benefit-item">
                        <span class="benefit-icon">🎟️</span>
                        <div class="benefit-text">
                            <strong>Pase Digital y Modo Offline</strong>
                            <p>Muestra tu código QR de jugador y tus boletos reservados incluso si te quedas sin datos móviles.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Eventos
    // 1. Botón de Instalación Inmediata
    const installBtn = container.querySelector('#btn-install-direct');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (pwaManager.isStandaloneMode()) {
                pwaManager.showAlreadyInstalledModal(business);
                return;
            }
            await pwaManager.promptInstall();
        });
    }

    // 2. Botón de Compartir en WhatsApp
    const shareWaBtn = container.querySelector('#btn-share-whatsapp');
    if (shareWaBtn) {
        shareWaBtn.addEventListener('click', () => {
            const message = `¡Hola! Te comparto el enlace para descargar e instalar la App oficial de reservaciones y retas de *${business.name}*:\n\n👉 ${directLocalUrl}`;
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
            window.open(waUrl, '_blank');
        });
    }

    // 3. Botón de Copiar Enlace
    const copyBtn = container.querySelector('#btn-copy-url');
    const urlInput = container.querySelector('#input-download-url');
    if (copyBtn && urlInput) {
        copyBtn.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(urlInput.value);
                } else {
                    urlInput.select();
                    document.execCommand('copy');
                }
                const btnText = container.querySelector('#copy-btn-text');
                if (btnText) btnText.textContent = '✅ ¡Copiado!';
                toast.success("¡Enlace copiado al portapapeles! Listo para compartir.");
                setTimeout(() => {
                    if (btnText) btnText.textContent = '📋 Copiar';
                }, 2500);
            } catch (err) {
                urlInput.select();
                toast.info("Selecciona y copia el enlace manualmente.");
            }
        });
    }

    // 4. Botón Descargar Imagen del QR para Imprimir
    const downloadQrBtn = container.querySelector('#btn-download-qr-img');
    if (downloadQrBtn) {
        downloadQrBtn.addEventListener('click', async () => {
            try {
                toast.info("Descargando imagen de Código QR...");
                const response = await fetch(qrCodeApiUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `QR_Descarga_App_${business.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                toast.success("¡Código QR descargado exitosamente!");
            } catch (e) {
                // Fallback directo abriendo en nueva pestaña
                window.open(qrCodeApiUrl, '_blank');
            }
        });
    }

    // 5. Cambio de pestañas de plataforma
    container.querySelectorAll('.platform-tab-btn').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            const platform = tabBtn.dataset.platform;
            container.querySelectorAll('.platform-tab-btn').forEach(b => b.classList.remove('active'));
            container.querySelectorAll('.platform-tab-content').forEach(c => c.classList.remove('active'));
            
            tabBtn.classList.add('active');
            const targetContent = container.querySelector(`#tab-content-${platform}`);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    // Suscribirse a cambios en el estado de PWA
    pwaManager.subscribe((canInstall, isInstalled) => {
        const statusBadge = container.querySelector('#pwa-status-badge-wrap');
        const installBtnLabel = container.querySelector('#btn-install-direct span');
        if (statusBadge && isInstalled) {
            statusBadge.innerHTML = `
                <span class="badge badge-success" style="font-size:0.85rem; padding:6px 14px;">
                    ✅ EJECUTÁNDOSE EN MODO APP (STANDALONE)
                </span>
            `;
            if (installBtnLabel) installBtnLabel.textContent = '🕹️ App Ya Instalada (Ver Opciones)';
        }
    });
}
