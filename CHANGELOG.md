# 📜 Registro de Cambios (Changelog) — Pump It Up Hub

Todos los cambios notables, mejoras y correcciones de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
