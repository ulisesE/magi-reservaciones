// js/components/changelogModal.js
// Modal público e interactivo para consultar el Registro de Cambios (Changelog) del sistema
import { modal } from './modal.js';
import { updateManager } from '../core/updateManager.js';

export const CHANGELOG_DATA = [
    {
        version: 'v1.9.4',
        date: '5 de Octubre de 2026',
        badge: '🚀 Versión Actual (Estabilidad en Reservas & PWA)',
        isCurrent: true,
        highlights: [
            {
                title: '🎟️ Estabilidad del Modal de Reservaciones',
                icon: '🛠️',
                items: [
                    'Eliminada declaración duplicada de identificador getSlotLabel en el módulo de reservas para evitar SyntaxError.',
                    'Garantizada la apertura inmediata del modal de agendado desde cualquier celda horaria del calendario diario.',
                    'Actualización y purga de caché del Service Worker v1.9.4 para refresco automático sin bloqueos.'
                ]
            }
        ]
    },
    {
        version: 'v1.9.3',
        date: '3 de Octubre de 2026',
        badge: 'Rendimiento & Generación de Reportes',
        isCurrent: false,
        highlights: [
            {
                title: '📊 Generación y Exportación de Reportes Financieros',
                icon: '📥',
                items: [
                    'Corrección de funciones canMakeFirestoreRead y limit en la vista de analítica de negocio (tenantAnalyticsView).',
                    'Generación de reportes CSV optimizada mediante Blob y codificación UTF-8 BOM para apertura nativa y sin errores en Excel.',
                    'Respaldo automático con datos locales en caso de desconexión para garantizar la exportación ininterrumpida.'
                ]
            }
        ]
    },
    {
        version: 'v1.9.2',
        date: '2 de Octubre de 2026',
        badge: 'Visitas Permanentes & Saldo Canjeable',
        isCurrent: false,
        highlights: [
            {
                title: '🎟️ Visitas Permanentes vs Saldo Canjeable',
                icon: '📅',
                items: [
                    'En programa de lealtad por visita, las visitas acumuladas permanecen fijas e históricas (mantienen el nivel/tier del jugador).',
                    'Al canjear recompensas, únicamente se descuentan los puntos/créditos canjeables restantes sin reducir las visitas históricas.',
                    'Separación clara en perfil entre puntos disponibles para canjear y total de visitas acumuladas.'
                ]
            },
            {
                title: '🕹️ Botones KPI Interactivos en Perfil de Jugador',
                icon: '⚡',
                items: [
                    'Tarjetas de estadísticas rápidas convertidas en botones táctiles con navegación directa a pestañas correspondientes.',
                    'PASS JUGADOR con acceso directo al código QR ampliado.',
                    'Estatus de Lealtad con desglose transparente de saldo canjeable y nivel actual.'
                ]
            }
        ]
    },
    {
        version: 'v1.9.1',
        date: '2 de Octubre de 2026',
        badge: 'Escudo Anti-Bucle PWA & Lealtad Reactiva',
        isCurrent: false,
        highlights: [
            {
                title: '🛡️ Escudo Anti-Bucle y Activación Inmediata de Service Worker',
                icon: '⚡',
                items: [
                    'Eliminación del bucle infinito de actualización: sincronización estricta de versiones aplicadas en sesión para evitar repetición de recargas.',
                    'Integración de listener SKIP_WAITING en el Service Worker: activación instantánea y purga atómica de caché al pulsar Actualizar.',
                    'Detección inteligente de versiones: compatibilidad total entre caché local y servidor sin bloqueos cíclicos.'
                ]
            },
            {
                title: '🎁 Lealtad Reactiva y Ajustes Manuales Instantáneos',
                icon: '⭐',
                items: [
                    'Sincronización en tiempo real de puntos y visitas modificados por encargados en el directorio de clientes.',
                    'Previsualización en vivo del saldo resultante (+/-) al registrar ajustes manuales o visitas rápidas.',
                    'Supresión de letreros de descuento cuando la sucursal opera bajo la modalidad de niveles distintivos.'
                ]
            }
        ]
    },
    {
        version: 'v1.9.0',
        date: '29 de Septiembre de 2026',
        badge: 'Zero-Read, Escudo Anti-Cuota & Despliegue Aislado',
        isCurrent: false,
        highlights: [
            {
                title: '🛡️ Arquitectura Zero-Read y Escudo Anti-Cuota',
                icon: '⚡',
                items: [
                    'Eliminación de lecturas previas al inicio de sesión: el sistema opera 100% en memoria y caché local hasta autenticar al usuario.',
                    'Escudo inteligente contra cuota diaria de Firestore agotada (429): desconexión preventiva para evitar spam en consola y garantizar modo offline fluido.',
                    'Optimización de consultas a Firestore: eliminación de listeners redundantes y duplicación de peticiones.'
                ]
            },
            {
                title: '🌐 Despliegue Multi-App Aislado',
                icon: '🚀',
                items: [
                    'Aislamiento completo en CI/CD para coexistir pacíficamente con múltiples aplicaciones en el mismo proyecto Firebase (test-89a00).',
                    'Enrutamiento directo y ultraligero de sucursales sin depender de Cloud Functions.'
                ]
            }
        ]
    },
    {
        version: 'v1.7.5',
        date: '28 de Septiembre de 2026',
        badge: '⇅ Reordenar Máquinas, Descarga PWA & Privacidad',
        isCurrent: false,
        highlights: [
            {
                title: '⇅ Reordenamiento de Máquinas en Vista de Día',
                icon: '🕹️',
                items: [
                    'Exclusivo para locatarios y staff: reordena las columnas de máquinas para que se muestren en el orden personalizado en la Vista de Día.',
                    'Modal interactivo con vista previa en tiempo real de las columnas del calendario y controles de subir / bajar.',
                    'Botones directos de reordenamiento en el catálogo de máquinas y acceso directo desde el encabezado de Vista de Día.',
                    'Persistencia atómica en Firestore, caché local y auditoría de cambios.'
                ]
            },
            {
                title: '📲 Página y Módulo de Descarga PWA Exclusiva por Local',
                icon: '🚀',
                items: [
                    'Nueva vista dedicada (/download o ?view=DOWNLOAD) vinculada y personalizada para cada sucursal.',
                    'Instalación nativa directa en 1 clic para celulares y computadoras.',
                    'Generador y descarga de código QR imprimible de alta resolución para colocar en la sala.',
                    'Enlace directo para compartir por WhatsApp con mensaje arcade preconfigurado.',
                    'Guías visuales paso a paso para Android (Chrome), iPhone / iPad (Safari) y PC.'
                ]
            },
            {
                title: '👁️ Ocultamiento Inteligente de Botones de Descarga',
                icon: '✨',
                items: [
                    'Detección automática de la App instalada (Modo Standalone / PWA).',
                    'Si el usuario ya tiene la App descargada, los botones de descarga en cabecera, inicio y bienvenida se ocultan para mantener una interfaz limpia y libre de saturación.',
                    'Los encargados y jugadores pueden seguir accediendo a las herramientas de compartir y código QR desde la vista de descarga.'
                ]
            },
            {
                title: '🔒 Seguridad y Filtrado de Locales Deshabilitados',
                icon: '🛡️',
                items: [
                    'Los locales deshabilitados se ocultan automáticamente en la pantalla de bienvenida para clientes.',
                    'Bloqueo estricto de acceso por URL a locales inactivos para cualquier usuario que no sea Super Admin.',
                    'El Super Admin mantiene visualización completa con la insignia ⏸️ DESHABILITADO.'
                ]
            }
        ]
    },
    {
        version: 'v1.7.4',
        date: '23 de Septiembre de 2026',
        badge: 'PWA Móvil & Caja Unificada',
        isCurrent: false,
        highlights: [
            {
                title: '📲 Experiencia PWA Móvil Completa e Instalable',
                icon: '📱',
                items: [
                    'Web App Manifest (manifest.json) con colores arcade (#080a0f), orientación vertical y accesos directos rápidos.',
                    'Conjunto de iconos vectoriales y de alta resolución (192px, 512px, maskable, apple-touch-icon y SVG).',
                    'Soporte nativo para pantalla completa en iPhone/iPad (iOS Safari) y Android (Chrome).',
                    'Service Worker (sw.js) con estrategia de caché inteligente para navegación rápida y offline.',
                    'Gestor de instalación PWA con botón arcade "📲 Instalar App" en cabecera y guía visual para iOS.'
                ]
            },
            {
                title: '💳 Desacoplamiento y Unificación de Caja en Cuenta Fácil',
                icon: '🛒',
                items: [
                    'Eliminación del flujo legacy y más de 500 líneas redundantes en el Directorio de Jugadores.',
                    'El botón "Estado de Cuenta" en las tarjetas de jugador abre directamente el modal autoritativo de Cuenta Fácil.',
                    'Integración completa desde el estado de cuenta con el POS de productos del catálogo oficial, abonos con saldo a favor y liquidación de tickets fiados.',
                    'Arquitectura centralizada para garantizar consistencia transaccional atómica en Firestore.'
                ]
            },
            {
                title: '🔄 Sistema de Actualización Forzada y Detección Automática',
                icon: '⚡',
                items: [
                    'Manifiesto de despliegue version.json con control de versión semántica y directiva forceUpdate.',
                    'Encabezados HTTP anti-caché en firebase.json para sw.js, version.json y manifest.json.',
                    'updateManager con monitoreo activo del ciclo de vida del Service Worker y chequeos automáticos.',
                    'Banner arcade Cyberpunk flotante con cuenta regresiva interactiva y botón "Actualizar Ahora".',
                    'Botón "Buscar Actualizaciones" integrado en el menú de usuario y modal de novedades para control en 1 clic.'
                ]
            }
        ]
    },
    {
        version: 'v1.7.3',
        date: '18 de Septiembre de 2026',
        badge: 'Políticas, Bloqueos & Mobile',
        isCurrent: false,
        highlights: [
            {
                title: '🚫 Control de Cancelaciones y Bloqueo de Jugadores',
                icon: '🛡️',
                items: [
                    'Política de cancelación configurable por local: opción para desactivar cancelaciones autónomas de clientes y canalizarlas por WhatsApp.',
                    'Bloqueo granular de jugadores sancionados por sucursal con validación en tiempo real al agendar.',
                    'Directorio de bloqueados con motivo y fecha en el panel de configuración del negocio.',
                    'Botones arcade cyberpunk de Bloquear y Desbloquear con estilo neón y gradientes interactivos.'
                ]
            },
            {
                title: '🗑️ Eliminación Permanente de Reservaciones',
                icon: '⚡',
                items: [
                    'Borrado definitivo mediante deleteDoc en Firestore en Vista Día y Solicitudes.',
                    'Limpieza fidedigna del historial para que las reservas eliminadas no reaparezcan en balances ni reportes.'
                ]
            },
            {
                title: '📱 Experiencia Móvil Optimizada (394 × 853 px)',
                icon: '📱',
                items: [
                    'Menú de usuario flotante con z-index alto que no altera la altura de la cabecera al abrirse.',
                    'Calendario de mes 100% responsivo con las 7 columnas completas de lunes a domingo sin desbordamiento.',
                    'Botón superior "Reservar" navega de forma directa y fluida a la Vista Día.',
                    'Alineación horizontal perfecta de la cabecera restaurada para pantallas de escritorio.'
                ]
            }
        ]
    },
    {
        version: 'v1.7.2',
        date: '03 de Septiembre de 2026',
        badge: 'Estable (Feature Toggles)',
        isCurrent: false,
        highlights: [
            {
                title: '🎛️ Control de Funciones por Sucursal (Feature Toggles)',
                icon: '🎛️',
                items: [
                    'Módulo maestro para Superadministradores para activar/desactivar funciones por sucursal con 1 clic.',
                    'Control independiente de Cuenta Fácil (POS), Directorio de Jugadores, Lealtad, Catálogos en Sala, Solicitudes, Analítica, Calendarios, Máquinas y Portal Mi Perfil.',
                    'Perfiles preconfigurados (Presets): Modo Completo, Básico Arcade y Modo Estricto (sin fiados).',
                    'Navegación dinámica y Router Guards reactivos que adaptan la interfaz de clientes y staff en tiempo real.'
                ]
            },
            {
                title: '⏸️ Pausa y Activación Operativa de Locales',
                icon: '🏢',
                items: [
                    'Interruptor de estado operativo (🟢 Activo / ⏸️ En Pausa) en el panel de administración central.',
                    'Pantalla arcade protectora que informa a los clientes si la sucursal está en mantenimiento, impidiendo nuevas reservas.',
                    'Bypass administrativo total: los Superadministradores siempre pueden acceder y reconfigurar cualquier sucursal.'
                ]
            },
            {
                title: '🛡️ 100% Retrocompatible y Safe Defaults',
                icon: '🔒',
                items: [
                    'Resolución segura de valores por defecto: sucursales existentes conservan todas sus funciones activas sin romper configuraciones.',
                    'Suite de pruebas financieras (E1 - E7) blindada y validada al 100%.'
                ]
            }
        ]
    },
    {
        version: 'v1.7.1',
        date: '02 de Septiembre de 2026',
        badge: 'Estable (Hotfixes)',
        isCurrent: false,
        highlights: [
            {
                title: '🎮 Soporte Oficial de PIU ID (piugame.com)',
                icon: '🎮',
                items: [
                    'Nuevo campo de PIU ID oficial con soporte para formatos con discriminador (ej. megajefelink#1234).',
                    'Búsqueda predictiva con puntuación de máxima relevancia en Cuenta Fácil (POS), Directorio y Reservaciones.',
                    'Insignias visuales de PIU ID en tarjetas Gamer Pass, membresía digital QR Pass y panel de Superadmin.',
                    'Inicio de sesión flexible mediante GamerTag, PIU ID oficial o teléfono registrado.'
                ]
            },
            {
                title: '🧹 Aislamiento Estricto, Protección XSS & Purga de Seguridad',
                icon: '🛡️',
                items: [
                    'Aislamiento 100% verificado en colecciones dedicadas piu_players y piu_staff_users.',
                    'Sanitización integral con escapeHTML en todos los atributos data-id, nombres y tablas para neutralizar inyecciones de código.',
                    'Auto-purga reactiva y botón manual 🧹 Purgar XSS para eliminar permanentemente registros residuales maliciosos.',
                    'Sincronización atómica de caché local sin riesgo de resurrección de perfiles eliminados.'
                ]
            },
            {
                title: '⚡ Fix en Creación Atómica de Reservaciones',
                icon: '⚙️',
                items: [
                    'Corrección de importación de Firebase Auth en store.js para garantizar auditoría inmutable sin excepciones.'
                ]
            }
        ]
    },
    {
        version: 'v1.7.0',
        date: '01 de Septiembre de 2026',
        badge: 'Estable',
        isCurrent: false,
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
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <small style="color:var(--text-muted); font-size:0.75rem;">Pump It Up Hub • v1.9.0</small>
                <button type="button" class="btn btn-outline btn-sm" id="btn-check-updates-changelog" style="font-size:0.75rem; padding:3px 8px;">
                    🔄 Buscar Actualizaciones
                </button>
            </div>
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
    modalEl.querySelector('#btn-check-updates-changelog')?.addEventListener('click', () => {
        updateManager.checkForUpdates(true);
    });
}
