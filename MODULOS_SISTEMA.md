# 📦 Reporte y Catálogo de Módulos del Sistema — Pump It Up Hub
### Especificación Técnica de Arquitectura Modular y Preparación para Feature Toggles

Este documento describe el inventario exhaustivo de todos los módulos que integran la plataforma **Pump It Up Hub (v1.7.1)**, especificando su rol, alcance, dependencias de datos y el impacto operativo en caso de que sean activados o desactivados por el **Superadministrador** en la siguiente fase de desarrollo.

---

## 📊 1. Matriz General de Módulos del Sistema

| # | Clave del Módulo (`id`) | Vista (`viewId`) | Nombre Comercial | Icono | Rol Mínimo | Estado por Defecto | Colección Principal Firestore |
| :-: | :--- | :--- | :--- | :-: | :---: | :---: | :--- |
| **1** | `HOME` | `HOME` | Portada / Inicio del Local | 🏠 | Público / Invitado | Activo (Core) | `piu_businesses` |
| **2** | `CALENDAR_DAY` | `DAY` | Calendario / Vista Día | 📅 | Público / Invitado | Activo (Core) | `piu_bookings`, `piu_machines` |
| **3** | `CALENDAR_WEEK` | `WEEK` | Vista Semanal | 📊 | Público / Invitado | Activo | `piu_bookings` |
| **4** | `CALENDAR_MONTH` | `MONTH` | Vista Mensual | 🗓️ | Público / Invitado | Activo | `piu_bookings` |
| **5** | `MACHINES` | `MACHINES` | Inventario de Máquinas | 🕹️ | Público / Invitado | Activo | `piu_machines`, `piu_cabinet_models` |
| **6** | `MY_PROFILE` | `MY_PROFILE` | Mi Perfil & Pase Digital | 👤 | Cliente Registrado | Activo | `piu_players`, `piu_consumptions` |
| **7** | `ACCOUNTS` | `ACCOUNTS` | Cuenta Fácil & Caja Rápida | 💳 | Encargado (Staff) | Activo | `piu_consumptions`, `piu_products` |
| **8** | `CLIENTS` | `CLIENTS` | Jugadores & Lealtad | 👥 | Encargado (Staff) | Activo | `piu_players` |
| **9** | `REQUESTS` | `REQUESTS` | Bandeja de Solicitudes | 📥 | Encargado (Staff) | Activo | `piu_bookings` |
| **10** | `ANALYTICS` | `ANALYTICS` | Rendimiento & Comisiones | 📈 | Encargado (Staff) | Activo | `piu_bookings`, `piu_machines` |
| **11** | `BUSINESS` | `BUSINESS` | Ajustes de Sucursal | ⚙️ | Encargado (Staff) | Activo | `piu_businesses` |
| **12** | `CATALOGS` | `CATALOGS` | Catálogos & Productos | 🛍️ | Encargado (Staff) | Activo | `piu_products`, `piu_cabinet_models` |
| **13** | `VERSUS` | `VERSUS` | Arena Versus & Retas PVP | ⚔️ | Todos (Público / Jugadores) | Activo | `piu_challenges` |
| **14** | `SUPERADMIN` | `SUPERADMIN` | Consola Global Superadmin | 👑 | Superadministrador | Exclusivo Superadmin | Todas las colecciones |

---

## 🛠️ 2. Especificación Detallada por Módulo

### 1. 🏠 Portada del Local (`HOME`)
* **Propósito**: Presentación comercial del local con banner dinámico, información de contacto, enlaces a redes sociales y reglas del establecimiento.
* **Archivos Involucrados**: [`js/views/businessHomeView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/businessHomeView.js)
* **Impacto si se Desactiva**: La aplicación iniciaría directamente en la vista de calendario diario (`DAY`).

### 2. 📅 Calendario Diario / Reservaciones (`DAY`) — Core del Sistema
* **Propósito**: Matriz interactiva de horas vs máquinas con slots disponibles, reservados, en revisión o bloqueados por mantenimiento.
* **Archivos Involucrados**: [`js/views/dayView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/dayView.js), [`js/views/clientBookingModal.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/clientBookingModal.js)
* **Impacto si se Desactiva**: Módulo crítico; no se recomienda desactivar salvo cierre temporal de operaciones.

### 3. 📊 Vista Semanal (`WEEK`)
* **Propósito**: Resumen de ocupación y slots de los siguientes 7 días para que los jugadores identifiquen días de alta demanda.
* **Archivos Involucrados**: [`js/views/weekView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/weekView.js)
* **Impacto si se Desactiva**: Se oculta del submenú de Calendario sin afectar el flujo de reservación diaria.

### 4. 🗓️ Vista Mensual (`MONTH`)
* **Propósito**: Calendario global mensual con conteo de turnos agendados por día.
* **Archivos Involucrados**: [`js/views/monthView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/monthView.js)
* **Impacto si se Desactiva**: Se oculta del menú sin afectar reservaciones.

### 5. 🕹️ Catálogo de Máquinas (`MACHINES`)
* **Propósito**: Muestra las especificaciones técnicas de los gabinetes (modelo, software, sensores FSR, condición de pads y tarifas por hora).
* **Archivos Involucrados**: [`js/views/machinesView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/machinesView.js)
* **Impacto si se Desactiva**: Se oculta la vista pública de máquinas. El encargado sigue administrándolas internamente.

### 6. 👤 Mi Perfil & Pase Digital (`MY_PROFILE`)
* **Propósito**: Portal de autogestión para jugadores registrados con tarjeta virtual QR, historial de reservaciones, canje de recompensas y consulta de consumos/deudas personales.
* **Archivos Involucrados**: [`js/views/clientProfileView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/clientProfileView.js)
* **Impacto si se Desactiva**: Los jugadores no podrían autogestionar su perfil; las reservas operarían en modalidad invitada/mostrador.

### 7. 💳 Cuenta Fácil & Caja Rápida (`ACCOUNTS`)
* **Propósito**: Terminal de punto de venta (POS) multi-producto, control de cuentas corrientes por cobrar (fiado), registro de abonos y panel de últimos movimientos con desglose y borrado físico permanente.
* **Archivos Involucrados**: [`js/views/accountsView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/accountsView.js), [`js/core/accountManager.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/core/accountManager.js)
* **Colecciones**: `piu_consumptions`, `piu_products`
* **Impacto si se Desactiva**: Se deshabilita el módulo de fiados y cobro de mostrador para el local; la sucursal solo operaría para reservaciones de tiempo de máquina.

### 8. 👥 Directorio de Jugadores & Lealtad (`CLIENTS`)
* **Propósito**: Base de datos de jugadores locales, escaneo de pases QR por cámara o pistola, asignación de puntos/visitas y restablecimiento de PIN de seguridad.
* **Archivos Involucrados**: [`js/views/clientsView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/clientsView.js)
* **Colecciones**: `piu_players`
* **Impacto si se Desactiva**: Se bloquea la gestión de clientes y lealtad desde el mostrador.

### 9. 📥 Bandeja de Solicitudes (`REQUESTS`)
* **Propósito**: Flujo de aprobación, reprogramación o rechazo con motivo para reservaciones entrantes.
* **Archivos Involucrados**: [`js/views/requestsView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/requestsView.js)
* **Impacto si se Desactiva**: Si un local opera con "Aprobación Automática", las reservas pueden confirmarse de forma instantánea sin pasar por bandeja.

### 10. 📈 Rendimiento & Analítica (`ANALYTICS`)
* **Propósito**: Dashboard con 6 tarjetas KPI maestras, 4 gráficas interactivas con Chart.js, auditoría de comisiones a socios operadores de máquinas y exportación a CSV.
* **Archivos Involucrados**: [`js/views/tenantAnalyticsView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/tenantAnalyticsView.js)
* **Impacto si se Desactiva**: Oculta reportes financieros al locatario (útil para planes básicos o sucursales que no requieran analítica).

### 11. ⚙️ Ajustes de Sucursal (`BUSINESS`)
* **Propósito**: Configuración de marca (banner, colores, eslogan), reglas de anticipo, políticas de cancelación, horarios y catálogo de premios de lealtad.
* **Archivos Involucrados**: [`js/views/businessView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/businessView.js)
* **Impacto si se Desactiva**: Los ajustes de la sucursal quedarían bloqueados para el encargado y solo el Superadmin podría modificarlos.

### 12. 🛍️ Catálogos & Productos (`CATALOGS`)
* **Propósito**: Gestión del inventario de artículos en venta (bebidas, botanas, fichas, pases) y consulta de catálogos maestros de gabinetes y software.
* **Archivos Involucrados**: [`js/views/catalogsManagementView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/catalogsManagementView.js)
* **Colecciones**: `piu_products`, `piu_cabinet_models`, `piu_software_versions`
* **Impacto si se Desactiva**: Oculta la edición de productos; la terminal POS solo usaría conceptos manuales.

### 13. ⚔️ Arena Versus, Matchmaking & Retas PVP (`VERSUS`)
* **Propósito**: Matchmaking entre jugadores, búsqueda de rivales por **Liga Potosina** (Liga SSS a D), negociación de horarios/locales (mismo local 2P, duelo remoto o libre), bandeja de retos entrantes/salientes, captura de resultados y tabla clasificatoria (Leaderboard).
* **Archivos Involucrados**: [`js/core/challengeManager.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/core/challengeManager.js), [`js/views/versusView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/versusView.js)
* **Colecciones**: `piu_challenges`, `piu_players`, `piu_reservations`
* **Impacto si se Desactiva**: Se oculta la pestaña de Retas para los clientes y la sucursal opera en modo arcade tradicional.

### 14. 👑 Consola Global Superadmin (`SUPERADMIN`)
* **Propósito**: Panel maestro omnisciente para dar de alta/baja sucursales en cascada, crear cuentas de encargados, respaldos JSON globales y mantenimiento de la red.
* **Archivos Involucrados**: [`js/views/superadminView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/superadminView.js)
* **Restricción**: Módulo inviolable; solo accesible con rol `SUPERADMIN` (PIN maestro).

---

---

## 🎛️ 3. Arquitectura Implementada de Feature Toggles & Control de Estado (v1.7.2)

A partir de la versión **v1.7.2**, el **Superadministrador** cuenta con control total en tiempo real para activar o desactivar módulos por sucursal y pausar o reactivar locales completos desde la Consola Global.

### Estructura en Firestore (`piu_businesses/{businessId}`)
```json
{
  "name": "Pump Zone Centro",
  "isActive": true,
  "status": "ACTIVE",
  "enabledModules": {
    "accounts": true,
    "clients": true,
    "loyalty": true,
    "requests": true,
    "analytics": true,
    "business": true,
    "catalogs": true,
    "calendarWeek": true,
    "calendarMonth": true,
    "machines": true,
    "myProfile": true,
    "versus": true
  }
}
```

### Mecanismo de Control y Guardias:
1. **Guardia de Estado Operativo de Sucursal (`js/app.js`)**: Si un local está pausado (`isActive: false`), los clientes y visitantes visualizan una pantalla arcade informativa indicando que la sucursal está en mantenimiento o en pausa, impidiendo nuevas reservas o pedidos.
2. **Guardia de Navegación por Módulo (`js/app.js`)**: Si un usuario regular intenta navegar a una vista deshabilitada para esa sucursal, el enrutador lo redirige fluidamente a la vista principal disponible (`HOME` o `DAY`).
3. **Filtrado Reactivo en Barra de Navegación (`js/components/header.js`)**: Los menús desplegables y las pestañas principales se adaptan dinámicamente según los módulos encendidos en el local.
4. **Filtrado en Barra de Staff (`js/core/navShortcutsManager.js`)**: Los accesos directos configurables para el personal solo ofrecen módulos habilitados para esa sucursal.
5. **Consola del Superadministrador (`js/views/superadminView.js`)**:
   - Botón directo para alternar estado 🟢 Activo / ⏸️ En Pausa por local.
   - Modal de configuración `🎛️ Funciones` con interruptores categorizados y perfiles rápidos (Presets: *Modo Completo*, *Básico Arcade* y *Modo Estricto*).
6. **100% Retrocompatible (Safe Defaults)**: Si una sucursal existente no posee `enabledModules` o `isActive`, los métodos `tenantManager.isModuleEnabled()` y `tenantManager.isBusinessActive()` retornan `true` de manera automática y segura.

