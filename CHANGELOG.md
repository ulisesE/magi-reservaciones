# 📜 Registro de Cambios (Changelog) — Pump It Up Hub

Todos los cambios notables, mejoras y correcciones de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
