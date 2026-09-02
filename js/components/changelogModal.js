// js/components/changelogModal.js
// Modal público e interactivo para consultar el Registro de Cambios (Changelog) del sistema
import { modal } from './modal.js';

export const CHANGELOG_DATA = [
    {
        version: 'v1.7.0',
        date: '01 de Septiembre de 2026',
        badge: '🛡️ Versión Actual',
        isCurrent: true,
        highlights: [
            {
                title: '🔒 Blindaje y Confiabilidad Financiera (Los 11 Pilares)',
                icon: '🛡️',
                items: [
                    'Operaciones financieras y de auditoría atómicas mediante runTransaction() en Firestore.',
                    'Autoridad del precio en servidor: cálculo dinámico y validación de tarifas directamente en Firestore.',
                    'Idempotencia determinista sin Date.now() para prevenir dobles cobros y reservaciones duplicadas.',
                    'Acreditación y reversión atómica de puntos de lealtad ligada al estado confirmado del documento.',
                    'Cero borrado físico de transacciones financieras y reservaciones (anulación formal y soft-cancel).'
                ]
            },
            {
                title: '📜 Auditoría y Trazabilidad Inmutable (piu_audit_logs)',
                icon: '📋',
                items: [
                    'Bitácora inmutable de eventos financieros, cambios de personal, precios y configuraciones críticas.',
                    'Actor anclado criptográficamente al UID de Firebase Auth.',
                    'Nuevo panel visual de auditoría y trazabilidad en tiempo real dentro de la pestaña Rendimiento.'
                ]
            },
            {
                title: '👤 Soporte Seguro de Reservaciones para Invitados (Guests)',
                icon: '🎟️',
                items: [
                    'Creación pública de solicitudes sin cuenta con validación perimetral estricta de esquema y estado PENDING obligatorio.',
                    'Aislamiento estricto de calendarios: escritura restringida exclusivamente al personal del local.'
                ]
            }
        ]
    },
    {
        version: 'v1.6.0',
        date: '01 de Septiembre de 2026',
        badge: 'Estable',
        isCurrent: false,
        highlights: [
            {
                title: '💳 Módulo y Pantalla Dedicada: Cuenta Fácil & Caja',
                icon: '🛒',
                items: [
                    'Pantalla centralizada con KPIs Hero de caja: Por Cobrar General, Clientes Deudores y Total Venta Fiada.',
                    'Directorio de cuentas por cobrar con tarjetas de jugadores deudores y accesos rápidos de cobro y abono.',
                    'Terminal POS multi-producto con buscador interactivo, controles +/- de cantidad y botón de "Otro Concepto".',
                    'Historial de movimientos con detalle desglosado de productos y cantidades (ej. Boing Mango x2, Cerveza x1).',
                    'Filtro dinámico por cliente para auditar movimientos individuales en un clic, además de filtros por fecha y estado.',
                    'Registro con fecha y hora exacta, arrastre continuo de saldos adeudados entre días y aislamiento multi-tenant confidencial por local.'
                ]
            },
            {
                title: '🛍️ Catálogo de Productos y Precios en Sala',
                icon: '📦',
                items: [
                    'Nueva pestaña en Catálogos para dar de alta, editar y eliminar productos propios del local con precio e icono.',
                    'Sincronización en tiempo real y persistencia garantizada en Firestore (piu_products) con semillas predeterminadas.'
                ]
            }
        ]
    },
    {
        version: 'v1.5.0',
        date: '25 de Agosto de 2026',
        badge: 'Estable',
        isCurrent: false,
        highlights: [
            {
                title: '💳 Fase 2: Cuenta y Consumo del Jugador',
                icon: '🛒',
                items: [
                    'Registro express de consumos directos en mostrador sin requerir una reservación previa.',
                    'Catálogo de 7 tipos rápidos con precios preconfigurados: Juego ($20), Bebida ($25), Alimento ($20), Ficha ($10), Inscripción a Torneo ($50), Producto/AM.PASS ($150) y Otro.',
                    'Control en tiempo real de saldos corrientes (adeudos pendientes, saldo a favor o cuenta al corriente).',
                    'Modal de Estado de Cuenta e Historial cronológico con filtros (Todos, Pendientes, Pagados, Abonos).',
                    'Registro de Abonos y Liquidaciones en caja con actualización inmediata del saldo.',
                    'Nueva pestaña "Mi Cuenta y Consumos" en el perfil de jugador con desglose por categorías.'
                ]
            },
            {
                title: '🛡️ Seguridad Criptográfica y Protección de Datos',
                icon: '🔐',
                items: [
                    'Protección de contraseñas y PINs con algoritmo criptográfico unidireccional SHA-256 + Salt nativo.',
                    'Sanitización de sesiones: eliminación de claves en texto plano de LocalStorage y memoria del cliente.',
                    'Herramienta de restablecimiento seguro de PIN temporal desde el directorio en caso de olvido.',
                    'Reglas de seguridad en base de datos con inmutabilidad estricta para auditoría.'
                ]
            },
            {
                title: '🎨 Rediseño y Consolidación de UI / UX',
                icon: '✨',
                items: [
                    'Menú del Header agrupado en 2 clusters limpios (Público/Calendarios vs Operación Staff).',
                    'Cabecera móvil inteligente dividida en 2 renglones dedicados (Renglón 1: Marca/Local; Renglón 2: Usuario, Reserva y Menú ☰).',
                    'Tarjetas de Jugador rediseñadas estilo VIP Gamer Pass con HUD de 3 métricas y jerarquía clara de acciones.'
                ]
            },
            {
                title: '🤝 Esquema Confidencial de Máquinas en Comisión',
                icon: '💼',
                items: [
                    'Configuración de posesión por gabinete: Propia (100%) vs Comisionada con % y datos del socio operador.',
                    'Privacidad estricta: visible únicamente para personal autenticado.',
                    'Cálculo automático de Facturación Bruta, Pago a Socios y Ganancia Neta para el local en el panel de Rendimiento.',
                    'Exportación de reportes CSV con desglose detallado para liquidación de cuentas.'
                ]
            }
        ]
    },
    {
        version: 'v1.4.0',
        date: '24 de Agosto de 2026',
        badge: 'Estable',
        isCurrent: false,
        highlights: [
            {
                title: '📈 Panel de Rendimiento y Analítica para Locatarios',
                icon: '📊',
                items: [
                    'Dashboard con KPIs maestros de ingresos, horas jugadas, ocupación y ticket promedio.',
                    '4 Gráficas interactivas con Chart.js (evolución de ingresos, estados de reserva, rendimiento por gabinete y horas pico).',
                    'Filtros temporales rápidos (Hoy, Semana, Mes, 30 Días) y exportación a reportes CSV.'
                ]
            },
            {
                title: '🔗 Vinculación Inteligente de Reservas',
                icon: '🤝',
                items: [
                    'Detección y enlace automático de cuentas de jugador al agendar citas desde mostrador.',
                    'Historial unificado en la pestaña "Mi Perfil" para todos los jugadores registrados.'
                ]
            }
        ]
    },
    {
        version: 'v1.3.0',
        date: '20 de Agosto de 2026',
        badge: 'Estable',
        isCurrent: false,
        highlights: [
            {
                title: '🎁 Programa de Lealtad y Recompensas',
                icon: '⭐',
                items: [
                    'Modos de acumulación por puntos de consumo o visitas con tiers (Bronce, Plata, Oro, Platino).',
                    'Catálogo de premios canjeables en mostrador con puntos acumulados.'
                ]
            },
            {
                title: '💳 Tarjeta de Identificación Digital (Pass) con QR',
                icon: '📱',
                items: [
                    'Generación de Arcade Pass con código QR dinámico por jugador.',
                    'Lector y escáner de códigos QR con cámara para registro inmediato en mostrador.'
                ]
            }
        ]
    }
];

export function openChangelogModal() {
    const contentHtml = `
        <div class="changelog-modal-wrapper" style="max-height:75vh; overflow-y:auto; padding-right:6px;">
            <div style="text-align:center; margin-bottom:20px;">
                <span style="font-size:2.2rem; display:inline-block; margin-bottom:4px;">📜</span>
                <h3 style="margin:0; font-size:1.35rem; color:#ffffff;">Registro de Versiones y Novedades</h3>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">
                    Historial de actualizaciones, mejoras de rendimiento y nuevas funciones de la plataforma.
                </p>
            </div>

            <div class="changelog-timeline" style="display:flex; flex-direction:column; gap:20px;">
                ${CHANGELOG_DATA.map(v => `
                    <div class="changelog-release-card" style="background:linear-gradient(145deg, rgba(1, 24, 22, 0.9), rgba(1, 15, 14, 0.95)); border:1px solid ${v.isCurrent ? 'var(--color-neon-lime)' : 'rgba(255,255,255,0.1)'}; border-radius:var(--radius-md); padding:16px; position:relative; box-shadow:0 4px 16px rgba(0,0,0,0.3);">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <strong style="font-size:1.2rem; color:${v.isCurrent ? 'var(--color-neon-lime)' : '#ffffff'}; font-family:var(--font-mono);">${v.version}</strong>
                                <span class="badge ${v.isCurrent ? 'badge-success' : 'badge-primary'}" style="font-size:0.7rem;">${v.badge}</span>
                            </div>
                            <span style="color:var(--text-muted); font-size:0.8rem;">🗓️ ${v.date}</span>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:14px;">
                            ${v.highlights.map(h => `
                                <div>
                                    <h4 style="font-size:0.95rem; margin:0 0 6px 0; color:var(--piu-cyan); display:flex; align-items:center; gap:6px;">
                                        <span>${h.icon}</span> ${h.title}
                                    </h4>
                                    <ul style="margin:0; padding-left:18px; color:var(--text-secondary); font-size:0.84rem; line-height:1.45;">
                                        ${h.items.map(it => `<li style="margin-bottom:4px;">${it}</li>`).join('')}
                                    </ul>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    const footerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <small style="color:var(--text-muted); font-size:0.75rem;">Pump It Up Hub • v1.7.0</small>
            <button type="button" class="btn btn-primary" id="btn-close-changelog">
                <span>Entendido</span>
            </button>
        </div>
    `;

    const modalEl = modal.open({
        title: 'Novedades y Actualizaciones',
        icon: '🚀',
        contentHtml,
        footerHtml,
        maxWidth: '680px'
    });

    modalEl.querySelector('#btn-close-changelog')?.addEventListener('click', () => modal.close());
}
