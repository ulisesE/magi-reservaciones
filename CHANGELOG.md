# 📜 Registro de Cambios (Changelog) — Pump It Up Hub

Todos los cambios notables, mejoras y correcciones de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.9.0] - 2026-09-29

### 🛡️ Optimización de Rendimiento y Arquitectura
- **Arquitectura Zero-Read (Cero Lecturas Previas)**:
  - Carga diferida de colecciones: La aplicación opera 100% en memoria y LocalStorage hasta que el usuario inicia sesión.
  - Eliminación del bug de doble fetch (`getDocs` previo a `onSnapshot`).
  - Carga única en memoria para catálogos estáticos (máquinas, modelos de gabinetes, versiones de juego).

- **Escudo Inteligente Anti-Cuota de Firestore (Anti-429 Shield)**:
  - Detección inmediata de errores `429` / `resource-exhausted`.
  - Desconexión preventiva de la red Firestore (`disableNetwork`) para erradicar las cascadas de reintentos y spam en consola.
  - Activación fluida del modo local sin interrupción de la experiencia del usuario.

- **Aislamiento Multi-App en Despliegue CI/CD**:
  - Configuración del flujo de GitHub Actions para desplegar exclusivamente `--only hosting:magi-suite`, protegiendo la coexistencia de múltiples aplicaciones en el proyecto Firebase `test-89a00`.
  - Enrutamiento directo y ultraligero de sucursales (`/local/:id`) en cliente sin requerir Cloud Functions.

- **Corrección Crítica de Instalación PWA (Descargar App)**:
  - Eliminada la asignación de URLs `blob:` en `<link rel="manifest">` que provocaba el rechazo del manifest en Chromium y Android (`Unsupported URL scheme`).
  - Corrección de falso positivo en `isAppInstalled()`: erradicado el bloqueo por `LocalStorage` para que los botones de instalación no queden inhabilitados en navegadores estándar.
  - Nuevos modales interactivos ilustrados de instalación para Android (con detección de navegador interno de WhatsApp/Instagram) y Computadoras de escritorio (Chrome/Edge).

---

## [1.7.5] - 2026-09-28

### 🚀 Nuevas Características
- **Reordenamiento Personalizado de Máquinas en la Vista de Día**:
  - Exclusivo para locatarios y staff: reordena las columnas de máquinas para que se muestren exactamente en la secuencia deseada en la Vista de Día (`js/views/dayView.js`).
  - Nuevo modal interactivo `openReorderMachinesModal` con vista previa en tiempo real de las columnas del calendario, botones de subir `▲` y bajar `▼`, e insignias numéricas `#1`, `#2`, etc.
  - Botón de acceso rápido `⇅ Reordenar en Vista Día` integrado tanto en la cabecera de la Vista Día como en el catálogo de máquinas (`js/views/machinesView.js`).
  - Métodos `store.reorderMachines()` y `store.moveMachine()` con sincronización atómica en Firestore, LocalStorage y registro de auditoría.

- **Página y Módulo de Descarga PWA Exclusiva por Sucursal**:
  - Nueva vista dedicada `js/views/downloadAppView.js` accesible vía menú, footer y URL directa (`?view=DOWNLOAD&local={id}`).
  - Botón de instalación nativa en 1 clic que dispara el prompt nativo PWA o modal educativo ilustrado en iOS Safari.
  - Generador de código QR descargable e imprimible en alta resolución (PNG) con logotipo y nombre de la sala para colocar en mostradores.
  - Botón para compartir instantáneamente por WhatsApp con mensaje arcade personalizado preconfigurado.
  - Guías ilustradas paso a paso para Android, iPhone/iPad (Safari) y Computadoras de escritorio.

- **Ocultamiento Inteligente de Botones de Descarga al Estar Instalada**:
  - Detección exhaustiva de modo Standalone / PWA en todas las plataformas (`display-mode: standalone`, `navigator.standalone`, flags y LocalStorage).
  - Al detectar que la app ya fue descargada/instalada en el dispositivo, se ocultan automáticamente los botones y banners de descarga en la barra superior (`header.js`), la pantalla de inicio del local (`businessHomeView.js`) y las tarjetas de la pantalla de bienvenida (`landingView.js`).
  - En la vista de descarga se actualiza el estado a `✅ APP YA INSTALADA EN ESTE DISPOSITIVO`, manteniendo disponibles las herramientas de difusión y descarga del código QR.

- **Seguridad y Ocultamiento de Locales Deshabilitados**:
  - Los locales deshabilitados (`active === false` o `status === 'disabled'`) se filtran y ocultan automáticamente en la pantalla de bienvenida (`js/views/landingView.js`) para usuarios generales y clientes.
  - Guardias de seguridad en `tenantManager` y en el enrutador principal (`app.js`) que impiden el acceso forzado mediante parámetros URL `?local={id}` a negocios inactivos a cualquier usuario que no posea rol de Super Admin.
  - El Super Administrador conserva visibilidad total con distintivo de estado `⏸️ DESHABILITADO`.

---

## [1.7.4] - 2026-09-23

### 🚀 Nuevas Características
- **Experiencia PWA Móvil Completa e Instalable (Progressive Web App)**:
  - Archivo `manifest.json` integrado con tema arcade `#080a0f`, orientación portrait y accesos directos rápidos a *Calendario de Día*, *Mi Perfil*, *Retas Versus* y *Cuenta Fácil*.
  - Colección de iconos arcade de alta fidelidad: `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable.png`, `icons/apple-touch-icon.png` e `icons/icon.svg` con la icónica cruceta de 5 paneles de Pump It Up.
  - Soporte nativo para pantallas de inicio de iOS Safari (`apple-mobile-web-app-capable`) y Android Chrome.
  - Service Worker (`sw.js`) optimizado con estrategia de caché inteligente para navegación offline y precaching de assets esenciales.
  - Nuevo gestor `js/core/pwaManager.js` que escucha `beforeinstallprompt`, detecta ejecución en modo Standalone y despliega un botón arcade `📲 Instalar App` en la barra superior y menú de usuario.
  - Modal arcade interactivo con guía paso a paso para añadir a inicio en dispositivos iPhone/iPad.

- **Sistema de Actualización Forzada y Detección Automática de Nuevas Versiones**:
  - Archivo `version.json` como manifiesto de despliegue con control semántico de versiones, build timestamp y bandera `forceUpdate`.
  - Configuración de encabezados HTTP en `firebase.json` (`Cache-Control: no-cache, no-store, must-revalidate`) para `/sw.js`, `/version.json`, `/manifest.json` e `/index.html`, evitando bloqueos por cachés de CDN o navegador.
  - Nuevo gestor `js/core/updateManager.js` que monitorea el ciclo de vida del Service Worker y realiza chequeos automáticos en segundo plano, al volver a la app (`visibilitychange`), al reconectar a internet y periódicamente cada 15 minutos.
  - Soporte de mensajes `SKIP_WAITING` y `SW_ACTIVATED` en `sw.js` para activar inmediatamente el nuevo worker y purgar cachés obsoletas.
  - Banner arcade Cyberpunk flotante (`.app-update-banner`) con cuenta regresiva interactiva, opción de pausar temporalmente y botón de acción directa `⚡ Actualizar Ahora`.
  - Botón interactivo `🔄 Buscar Actualizaciones` integrado en el menú de usuario y en el modal del Changelog para comprobaciones manuales en 1 clic.
  - Utilidad administrativa y de diagnóstico `window.piuForceUpdate()` para emergencias y limpiezas totales de caché.

### 🛠️ Correcciones y Mejoras
- **Desacoplamiento y Unificación de Caja en Cuenta Fácil**:
  - Eliminación del modal legacy y código duplicado de registro de consumo en el Directorio de Clientes (`js/views/clientsView.js`), reduciendo más de 500 líneas redundantes.
  - El botón `💳 Estado de Cuenta` en las tarjetas de jugador ahora abre el modal unificado y autoritativo de Cuenta Fácil (`js/views/accountsView.js`).
  - Desde el estado de cuenta ahora es posible registrar consumos mediante el POS multi-producto con catálogo oficial (`openQuickSaleModal`), registrar abonos/pagos con opción de amortizar con saldo a favor (`openPaymentModal`), liquidar tickets fiados individuales (`openSettleTicketModal`) y anular movimientos de forma atómica.
  - Puentes delegadores retrocompatibles para prevenir errores en cualquier componente que invoque APIs anteriores.

---

## [1.7.3] - 2026-09-18

### 🚀 Nuevas Características
- **Control y Política de Cancelación de Reservas por Sucursal**:
  - Nueva opción en la configuración del local (`js/views/businessView.js`): `allowClientCancellation` para permitir o denegar cancelaciones autónomas por parte de clientes.
  - Al desactivarse, el botón de cancelar en el perfil del jugador (`js/views/clientProfileView.js`) se bloquea y se presenta una notificación con acceso directo a WhatsApp del encargado para acordar cancelaciones directamente con la administración del local.
- **Bloqueo y Desbloqueo de Jugadores por Sucursal**:
  - Capacidad para que los locatarios restrinjan a usuarios específicos e impidan que reserven turnos en su sucursal (`tenantManager.blockClientInBusiness` y `unblockClientInBusiness`).
  - Validación en tiempo real en el modal de reservas (`js/views/clientBookingModal.js`): bloqueo inmediato si el jugador intenta agendar en un local donde está sancionado.
  - Tabla de administración de jugadores bloqueados en la configuración de la sucursal (`js/views/businessView.js`) con motivos y fechas de bloqueo.
  - Botones de acción rápida `🚫 Bloquear` y `🔓 Desbloquear` integrados directamente en las tarjetas de jugador en el Directorio (`js/views/clientsView.js`).
- **Diseño Arcade Cyberpunk de Botones de Gestión**:
  - Nuevas clases estilizadas `.btn-cyber-block` y `.btn-cyber-unblock` en `css/styles.css`, sustituyendo fondos blancos por defecto del navegador por estilos translúcidos neón (carmesí arcade y verde láser) con resplandores y animaciones hover fluidas.

### 🛠️ Correcciones y Mejoras
- **Eliminación Permanente de Reservaciones (Hard Delete)**:
  - Corrección de la eliminación de reservaciones en `js/core/store.js`, `js/views/dayView.js` y `js/views/requestsView.js`.
  - Ahora se realiza un borrado definitivo mediante `deleteDoc` en Firestore tanto de las colecciones activas como históricas, garantizando que no reaparezcan en reportes de caja, auditoría ni calendarios.
- **Navegación del Botón Superior "Reservar"**:
  - Al presionar `➕ Reservar` en la cabecera (`js/components/header.js`), la aplicación navega directamente a la **Vista Día (Calendario de Día)** con desplazamiento suave, optimizando la experiencia del usuario para consultar horarios antes de agendar.
- **Optimización Integral de la Cabecera Móvil (Resolución 394 × 853 px)**:
  - **Menú de usuario flotante**: `.nav-dropdown-menu` en la barra superior ahora cuenta con posicionamiento absoluto flotante (`z-index: 99999`) y `backdrop-filter`, evitando que empuje los elementos hacia abajo o incremente la altura del header.
  - **Ajuste de bordes de pantalla**: La cabecera móvil no desborda bordes laterales gracias a la compactación del botón de locales (`← Locales`), indicador de red minimalista (`🟢`/`🟡`) y truncado seguro de nombres largos.
- **Alineación de Cabecera en Pantallas de Escritorio (Desktop)**:
  - Regla base `.header-actions` con `display: flex; align-items: center; gap: 12px;` en `css/components.css`, garantizando que toda la barra superior se mantenga en una sola línea horizontal sin quiebres de renglón.
- **Ajuste Responsivo del Calendario Mensual (Vista Mes)**:
  - Corrección del desbordamiento en columnas del calendario mensual aplicando `grid-template-columns: repeat(7, minmax(0, 1fr))` en encabezados y matriz.
  - En móviles se ocultó el texto redundante y listas de nombres, dejando celdas simétricas e insignias neón centradas donde los 7 días de la semana encajan al 100% en 394px de ancho sin cortes.
- **Corrección de ReferenceErrors de JavaScript**:
  - Importación faltante de `tenantManager` en `js/views/clientsView.js`.
  - Importación faltante de `escapeHTML` en `js/views/businessView.js`.

---

## [1.7.2] - 2026-09-03

### 🚀 Nuevas Características
- **Módulo de Control de Funciones por Sucursal (Feature Toggles)**:
  - Consola central para que el **Superadministrador** pueda activar o desactivar módulos específicos de forma granular para cada sucursal desde la Consola Global (`js/views/superadminView.js`).
  - Módulos configurables de forma independiente:
    - 💳 **Cuenta Fácil (POS & Fiados)** (`ACCOUNTS`)
    - 👥 **Directorio de Jugadores** (`CLIENTS`)
    - 🎁 **Programa de Lealtad & Recompensas** (`LOYALTY`)
    - 📥 **Bandeja de Solicitudes** (`REQUESTS`)
    - 📈 **Rendimiento & Analítica** (`ANALYTICS`)
    - ⚙️ **Ajustes de Sucursal por Encargado** (`BUSINESS`)
    - 🛍️ **Catálogos en Sala & Productos** (`CATALOGS`)
    - 📊 **Vista Semanal de Calendario** (`WEEK`)
    - 🗓️ **Vista Mensual de Calendario** (`MONTH`)
    - 🕹️ **Ficha Técnica de Máquinas** (`MACHINES`)
    - 👤 **Portal Mi Perfil de Jugador** (`MY_PROFILE`)
  - **Perfiles Rápidos (Presets)**:
    - ⚡ *Modo Completo* (Todas las funciones encendidas).
    - 🕹️ *Básico Arcade* (Solo reservaciones, catálogo de máquinas y directorio).
    - 🔒 *Modo Estricto* (Sin cuenta fácil/fiados).
- **Control de Estado Operativo de Sucursal (Activo / En Pausa)**:
  - Botón de alternancia de estado (🟢 Activo / ⏸️ En Pausa) por sucursal en la Consola Global.
  - **Pantalla Arcade Protectora (`js/app.js`)**: Si una sucursal está en pausa, los clientes y visitantes visualizan una pantalla amigable de mantenimiento/pausa, bloqueando nuevas reservaciones y compras.
  - **Bypass Superadmin**: Los administradores globales conservan acceso permanente para entrar y reactivar cualquier sucursal.
- **Router Guards & Adaptación Dinámica de UI**:
  - El enrutador (`js/app.js`) y la barra superior (`js/components/header.js`) filtran y redirigen automáticamente si un usuario no autorizado intenta acceder a un módulo desactivado.
  - La personalización de accesos directos de staff (`js/core/navShortcutsManager.js`) solo ofrece módulos activos en la sucursal.
- **100% Retrocompatible (Safe Defaults)**:
  - Las sucursales existentes sin campos de configuración previos mantienen todas sus funciones activas de forma transparente sin interrupción de servicio.

---

## [1.6.0] - 2026-09-01

### 🚀 Nuevas Características
- **Pantalla y Módulo "Cuenta Fácil" (`js/views/accountsView.js`)**:
  - **KPIs Hero de Caja en Tiempo Real**:
    - 💰 **Por Cobrar General**: Deuda total acumulada y arrastrada en la sala.
    - 👥 **Clientes Deudores**: Conteo de cuentas activas con saldo pendiente.
    - 🛒 **Total Venta Fiada**: Monto total acumulado de consumos registrados a crédito en el local.
  - **Directorio de Cuentas por Cobrar**:
    - Tarjetas HUD para cada cliente deudor con su nombre, GamerTag (`@username`), teléfono, saldo adeudado y botones de acción rápida (`➕ Cargar`, `💵 Liquidar`, `📜 Ver Cuenta`).
  - **Terminal POS Multi-Producto / Cobro Rápido**:
    - **Buscador Predictivo con Prioridad Estricta**: Jerarquía de búsqueda optimizada (1° `@username` / GamerTag, 2° Nombre completo, 3° Teléfono) con tolerancia a errores tipográficos, acentos y mayúsculas.
    - **Fallback Dinámico a Venta Mostrador**: Permite escribir cualquier nombre libre (ej. *"Don Pepe"*) para registrar ventas al público general sin estar registrado en el catálogo.
    - Buscador reactivo de productos del catálogo.
    - Carrito de compra con controles de cantidad **`+` y `-`** y subtotal dinámico.
    - Botón **"➕ Otro Concepto"** para ingresar cualquier concepto personalizado no listado en catálogo con su precio libre.
    - Registro como *⏳ Cargar a la Cuenta (Fiado / Pendiente)* o *🟢 Pagado al Momento (Contado)*.
  - **Panel de Últimos Movimientos**:
    - Tabla cronológica completa con fecha y hora exacta (`HH:mm`), cliente, **detalle de productos y cantidades** (ej. *Boing Mango x2, Cerveza x1*), total y estado.
    - **Filtro interactivo por cliente**: Desplegable para auditar las transacciones de un jugador específico en 1 clic.
    - Filtros por periodo (*Hoy*, *Esta semana*, *Este mes*, *Histórico*) y estado (*Pagados*, *Fiados*, *Abonos*, *Anulados*).
    - Acciones de liquidación de adeudos con 1 clic (`💵`) y botón de **eliminación permanente de la base de datos** (`🗑️` con `deleteDoc` y recálculo automático de saldo).

- **Catálogo de Productos y Precios (`js/views/catalogsManagementView.js`)**:
  - Nueva pestaña **"🛍️ Productos y Precios"** en el módulo de Catálogos de la sucursal.
  - CRUD completo para registrar artículos de venta (Boing, Coca-Cola, Cerveza, Fichas, Snacks, etc.) con categoría, icono emoji, precio unitario y estado.
  - Almacenado en tiempo real en Firestore (`piu_products`).

- **Aislamiento Multi-Tenant y Confidencialidad por Sucursal**:
  - Todos los productos, consumos, deudas, abonos y movimientos están estrictamente aislados por `businessId`. Ningún local puede ver los precios, cuentas ni transacciones de otra sucursal.
  - Arrastre continuo de deudas a través de los días con fecha y hora fidedignas en cada registro.

---

## [1.5.0] - 2026-08-25

### 🚀 Nuevas Características
- **Fase 2 — Cuenta y Consumo del Jugador (`js/core/accountManager.js`)**:
  - Registro de consumos directos en mostrador/caja sin requerir una reservación previa.
  - Catálogo de 7 tipos rápidos con icono, concepto y precio base:
    - 🕹️ **Juego** ($20 - Retas / Tiempo libre)
    - 🥤 **Bebida** ($25 - Hidratación)
    - 🍿 **Alimento** ($20 - Snacks)
    - 🪙 **Ficha** ($10 - Tokens PIU)
    - 🏆 **Inscripción** ($50 - Torneos)
    - 🛍️ **Producto** ($150 - AM.PASS / Accesorios)
    - 📦 **Otro** (Concepto y precio personalizado)
  - Soporte para cobro inmediato (`🟢 Pagado`) o con cargo a cuenta (`⏳ Pendiente / A la cuenta`).
  - Cálculo dinámico de balance: adeudo pendiente (`netDebt`), saldo a favor (`creditBalance`), total consumido y total abonado.
  - Modal interactivo de **Estado de Cuenta** con tarjetas hero, filtros por estado (*Todos*, *Pendientes*, *Pagados*, *Abonos*), historial cronológico y opción de anulación de movimientos.
  - Modal de **Abonos y Liquidaciones** para recargar saldo a favor o pagar deudas en recepción.
  - Nueva pestaña en el perfil del cliente: **"💳 Mi Cuenta y Consumos"** con desglose por categorías y auditoría de compras.

- **Blindaje Criptográfico y Seguridad (`js/core/securityUtils.js` y `firestore.rules`)**:
  - Hasheo unidireccional de contraseñas y PINs con algoritmo SHA-256 y salt nativo (`crypto.subtle`).
  - Auto-migración transparente de PINs legados a formato seguro hasheado al iniciar sesión.
  - Sanitización de sesiones activas: eliminación de credenciales en texto plano de `LocalStorage` y de la memoria en tiempo de ejecución.
  - Restablecimiento seguro de PIN temporal para jugadores directamente desde el formulario de edición del encargado.
  - Reglas de seguridad de Firestore con inmutabilidad para registros de auditoría (`piu_audit_logs`).

- **Esquema Confidencial de Máquinas en Comisión y Reparto de Ingresos (`js/views/tenantAnalyticsView.js` y `js/views/machinesView.js`)**:
  - Configuración de propiedad por máquina exclusiva para staff: `🏢 Propia (100%)` o `🤝 Comisionada / Consignación` (% Socio, nombre de operador y datos de liquidación).
  - Privacidad total: Los clientes y jugadores no tienen acceso ni visibilidad sobre qué máquinas son comisionadas o los porcentajes de reparto.
  - Métricas financieras en el Dashboard de Rendimiento:
    - 💰 **Facturación Bruta**: Total recaudado en el local.
    - 🤝 **Pago a Socios Operadores**: Monto total a transferir por concepto de comisiones.
    - 🏢 **Ingreso Neto del Local**: Ganancia neta libre para la sala.
  - Tabla desglosada por máquina con columnas de ocupación, facturación bruta, comisión a socio y neto local.
  - Exportación en **CSV** con desglose completo de comisiones para entregar cuentas a socios.

- **Rediseño del Menú del Header y Tarjetas de Jugador**:
  - Reorganización de la barra de navegación en 2 clusters limpios (Público/Calendarios vs Operación Staff) reduciendo la dispersión de botones.
  - Cabecera móvil en 2 renglones dedicados (Renglón 1: Marca/Local; Renglón 2: Usuario, botón Reservar y menú ☰) evitando elementos encimados.
  - Tarjetas de Jugador rediseñadas como **VIP Gamer Pass** con HUD de 3 métricas (Saldo/Deuda, Lealtad, Reservas), 2 botones primarios (`➕ Consumo`, `💳 Cuenta`) y barra de herramientas inferior.

### 🛠️ Correcciones y Mejoras
- **Control Universal del Botón "Cambiar de Local" (`js/components/header.js`)**:
  - Corrección de la visibilidad del botón para que al activar el bloqueo (global o por sucursal), se oculte para **todos** los usuarios (clientes, invitados y encargados/locatarios), manteniéndose accesible **exclusivamente para Superusuarios (Superadmin)**.
- **Sincronización Reactiva en Tiempo Real (`js/core/tenantManager.js`)**:
  - Suscripción con `onSnapshot` sobre la configuración global en Firestore (`piu_system_settings/global_config`), actualizando la interfaz al instante en todos los dispositivos conectados sin necesidad de recargar la página.
- **Firestore como Mandante Único y Blindaje del Superusuario (`js/core/authManager.js`)**:
  - Carga fidedigna y obligatoria de `piu_staff_users` desde Firestore en el inicio de la aplicación (`init`).
  - Listener en tiempo real (`onSnapshot`) para la colección de personal y superadministrador.
  - Protección de credenciales personalizadas del Superusuario (`megajefelink` y su PIN/hash) contra sobreescrituras accidentales por semillas por defecto (`DEFAULT_STAFF_USERS`).
  - Escritura garantizada en Firestore mediante `setDoc` con opción `merge: true`.

---

## [1.4.0] - 2026-08-24

### 🚀 Nuevas Características
- **Dashboard de Rendimiento del Locatario (`📈 Rendimiento`)**:
  - Nueva pestaña exclusiva para Encargados de Local y Superadministradores con análisis integral del negocio.
  - **Tarjetas KPI Maestras**:
    - 💰 **Ingresos Totales**: Facturación real en moneda configurada y proyección potencial con reservaciones pendientes.
    - 🎟️ **Total Reservaciones**: Conteo de reservas confirmadas vs recibidas y tasa de efectividad (%).
    - ⏳ **Horas de Juego**: Total de horas efectivas reservadas y promedio de horas por reserva.
    - ⚡ **Utilización de Máquinas**: Porcentaje de ocupación del local contra la capacidad operativa total con barras de progreso Neón.
    - 🏷️ **Ticket Promedio**: Gasto medio por reserva e ingreso promedio por hora jugada.
    - ❌ **Tasa de Cancelación**: Porcentaje y conteo de canceladas o rechazadas.
  - **4 Gráficas Interactivas con Chart.js**:
    1. **Evolución Temporal de Ingresos y Reservas**: Gráfica dual (Barras de ingresos + Línea con brillo Neón de reservas confirmadas).
    2. **Distribución por Estado de Reserva**: Gráfica tipo Doughnut con porcentajes de confirmadas, pendientes y canceladas.
    3. **Rendimiento por Máquina / Gabinete**: Comparativa de ingresos y horas acumuladas por modelo de máquina.
    4. **Horas Pico de Afluencia**: Histograma de distribución horaria de juego de 10:00 a 23:00 para detectar franjas de mayor demanda.
  - **Filtros Temporales Rápidos y Personalizados**:
    - Selectores de un clic para: *Hoy*, *Esta Semana*, *Este Mes*, *Últimos 30 Días* y *Todo el Histórico*.
    - Selector de rango de fechas personalizado con entradas *Desde* y *Hasta*.
  - **Tablas de Auditoría y Exportación**:
    - Ranking de clientes más frecuentes con podio (🥇, 🥈, 🥉), horas jugadas e inversión total.
    - Desglose detallado de utilización y horas por gabinete.
    - Tabla completa de auditoría de reservaciones del periodo.
    - Botón **📥 Exportar CSV** para descargar reportes listos para Excel o Google Sheets.

### 🛠️ Correcciones y Mejoras
- **Vinculación Automática de Reservas para Jugadores**:
  - Al agendar directamente desde el rol de Encargado o Staff, el sistema detecta y enlaza automáticamente el `clientId` y `clientUsername` del jugador cuando se selecciona del autocompletado o se ingresa su Gamertag/nombre/teléfono.
- **Búsqueda Exhaustiva en el Perfil de Jugador**:
  - En la pestaña **Mi Perfil y Reservas**, el historial ahora unifica todas las reservaciones asociadas al cliente mediante su ID único, su nombre de usuario (`@username`), su nombre registrado o su número telefónico.
- **Protección de Métricas y Fallback Offline**:
  - Las consultas de Firestore se ejecutan de forma optimizada por sucursal y rango, manteniendo compatibilidad total con almacenamiento local si no hay conexión a la nube.

---

## [1.3.0] - 2026-08-20

### 🚀 Nuevas Características
- **Programa de Lealtad Flexible (Puntos vs Visitas)**:
  - Soporte para dos modos de fidelización configurables por local:
    - **Modo Consumo (Puntos)**: Genera puntos por cada peso invertido en reservas.
    - **Modo Visitas**: Genera 1 crédito/visita por cada reserva confirmada.
  - Niveles dinámicos con recompensas:
    - 🟫 **Bronce**
    - ⬜ **Plata** (5% descuento)
    - 🟨 **Oro** (10% descuento)
    - 🟦 **Platino** (15% descuento con animación de pulso neón)
  - **Catálogo de Premios por Sucursal**: Canje de artículos y productos de arcade en mostrador.
- **Tarjeta de Identificación Digital (Arcade Pass) con QR**:
  - Pase de jugador futurista accesible desde el perfil con QR dinámico.
  - Escáner integrado con soporte para cámara web/móvil y lectores de código de barras USB/Bluetooth.
- **Paginación y Optimización de Base de Datos**:
  - Listado de clientes paginado para alta velocidad de renderizado.
  - Sincronización inteligente de calendario por intervalos de fecha.
  - Etiquetas OpenGraph dinámicas en el servidor local para enlaces compartidos en redes sociales.

---

## [1.2.0] - 2026-08-15

### 🚀 Nuevas Características
- **Soporte Multi-Negocio (Tenancy Aislado)**:
  - Aislamiento completo de máquinas, tarifas, horarios, políticas de anticipo e imágenes entre diferentes locales arcade.
- **Gestión de Catálogos Maestros**:
  - Catálogo de Gabinetes (LX, TX, FX, GX, CX, SX, DX), Versiones de Software (Phoenix, XX, Prime 2, etc.) y Reglas de Apertura.
- **Consola Global de Superadministrador**:
  - Operaciones de importación y exportación de respaldos JSON.
  - Eliminación en cascada de locales y reasignación de gabinetes entre sucursales.

---

## [1.0.0] - 2026-08-01

### 🚀 Lanzamiento Inicial
- Sistema base de reservaciones para cabinas arcade de baile Pump It Up.
- Vistas de calendario en Grid (Día), Resumen Semanal y Vista Mensual.
- Roles de usuario: Superadministrador, Encargado de Sucursal, Jugador Registrado e Invitado.
- Sistema de diseño Neo-Arcade / Cyberpunk inspirado en PIU Phoenix.
