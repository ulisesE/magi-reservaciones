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
| **13** | `SUPERADMIN` | `SUPERADMIN` | Consola Global Superadmin | 👑 | Superadministrador | Exclusivo Superadmin | Todas las colecciones |

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

### 13. 👑 Consola Global Superadmin (`SUPERADMIN`)
* **Propósito**: Panel maestro omnisciente para dar de alta/baja sucursales en cascada, crear cuentas de encargados, respaldos JSON globales y mantenimiento de la red.
* **Archivos Involucrados**: [`js/views/superadminView.js`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/js/views/superadminView.js)
* **Restricción**: Módulo inviolable; solo accesible con rol `SUPERADMIN` (PIN maestro).

---

## 🔮 3. Propuesta de Arquitectura para la Siguiente Fase (Feature Toggles)

Para que en la siguiente fase el Superadministrador pueda encender o apagar módulos por sucursal desde la Consola Global, se propone el siguiente esquema:

### Estructura en Firestore (`piu_businesses/{businessId}`)
```json
{
  "name": "SKY GAMES",
  "enabledModules": {
    "accounts": true,
    "loyalty": true,
    "commission": true,
    "analytics": true,
    "products": true,
    "calendarWeek": true,
    "calendarMonth": true
  }
}
```

### Mecanismo de Control en UI:
1. **Guardia de Navegación (`App.js`)**: Si un usuario intenta acceder a una vista cuyo módulo está desactivado para ese local, se redirige automáticamente a `DAY` con una notificación de advertencia.
2. **Filtrado Dinámico en Header (`header.js`)**: Los módulos desactivados no se listan en los accesos directos de staff ni en los menús desplegables.
3. **Consola del Superadministrador**: Se agregará una matriz de interruptores (Toggles Neón) en la tarjeta de cada sucursal para activar/desactivar módulos en tiempo real.
