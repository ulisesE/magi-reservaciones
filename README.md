# 🕹️ Pump It Up Hub — Sistema Modular de Reservaciones de Maquinitas

Plataforma web profesional, modular y multi-negocio diseñada para la administración y reservación de máquinas de ritmo **Pump It Up (PIU)**.

---

## Funcionalidades recientes y optimizaciones (v1.6.0)

### 💳 Módulo "Cuenta Fácil" & Flujo de Caja
* **KPIs de Caja en Tiempo Real**: 💰 *Por Cobrar General* (deuda acumulada de la sala), 👥 *Clientes Deudores* (conteo de cuentas con adeudo) y 🛒 *Total Venta Fiada* (monto histórico de fiados).
* **Directorio de Cuentas por Cobrar**: Tarjetas para cada cliente con saldo pendiente con accesos de 1 clic: `➕ Cargar`, `💵 Liquidar` y `📜 Ver Cuenta`.
* **Terminal POS Multi-Producto / Cobro Rápido**:
  * Buscador predictivo inteligente con prioridad estricta (`@username` ➔ `Nombre` ➔ `Teléfono`) y tolerancia a errores tipográficos.
  * Fallback automático para registrar ventas mostrador a clientes no registrados con su nombre personalizado.
  * Selector interactivo de productos del catálogo con botones de incremento/decremento **`+` / `-`**.
  * Botón **"➕ Otro Concepto"** para ingresar conceptos libres con precios manuales.
  * Registro como *⏳ Cargar a la Cuenta (Fiado)* o *🟢 Pagado al Momento (Contado)*.
* **Panel de Últimos Movimientos**:
  * Registro cronológico con fecha y hora exacta (`HH:mm`), cliente, detalle desglosado con cantidades y emojis (ej. *Boing Mango x2 ($40), Cerveza Corona x1 ($35)*), total y badge de estado.
  * **Filtro Rápido por Cliente**: Desplegable para auditar las transacciones de un jugador específico en un solo clic.
  * Filtros por periodo (*Hoy*, *Esta semana*, *Este mes*, *Histórico*) y estado.
  * Botón de cobro express (`💵`) y botón de eliminación física permanente en Firestore (`🗑️`).

### 🛍️ Catálogo de Productos y Precios en Sala
* **Gestión de Artículos por Sucursal**: Pestaña dedicada en Catálogos para dar de alta, editar y eliminar bebidas, botanas, fichas, pases AM.PASS, tiempo libre e inscripciones.
* **Aislamiento Confidencial Multi-Tenant**: Cada local posee su propio catálogo, precios y movimientos totalmente aislados en Firestore (`piu_products`).
* **Arrastre Continuo de Deudas**: Los saldos por cobrar se arrastran automáticamente entre días con auditoría de fecha y hora fidedigna.

---

## Funcionalidades de Versiones Anteriores (v1.5.0)

### 💳 Fase 2: Cuenta y Consumo del Jugador
* **Registro de Consumos Express**: Permite al encargado registrar compras y consumos en mostrador sin requerir una reservación previa asociada.
* **7 Tipos Rápidos de Consumo**: `🕹️ Juego`, `🥤 Bebida`, `🍿 Alimento`, `🪙 Ficha`, `🏆 Inscripción`, `🛍️ Producto` y `📦 Otro`.
* **Cuentas Corrientes y Saldos Dinámicos**: Control en tiempo real de saldos (`Debe $XX`, `Saldo a favor +$XX` o `Al corriente`).
* **Modal de Cuenta y Movimientos**: Historial cronológico con filtros (*Todos*, *Pendientes*, *Pagados*, *Abonos*), registro de abonos en caja y anulación de movimientos con reversión de saldo.
* **Pestaña "Mi Cuenta y Consumos" en Perfil**: Visibilidad completa para el jugador con desglose por categorías.

### 🛡️ Seguridad Criptográfica y Protección de Datos
* **Hasheo de PINs y Claves con SHA-256**: Ninguna contraseña se almacena en texto plano en Firestore ni en LocalStorage.
* **Sanitización de Sesión**: Eliminación de credenciales sensibles de la memoria y caché del cliente.
* **Restablecimiento de PIN por Encargados**: Permite al encargado asignar un nuevo PIN temporal a los jugadores que olvidaron su clave.
* **Reglas de Seguridad de Firestore**: Políticas de control de acceso por colección y registros de auditoría inmutables.

### 🤝 Esquema Confidencial de Máquinas en Comisión y Reparto
* **Gestión de Propiedad por Gabinete**: Configuración exclusiva para personal de máquinas propias (100% ingresos) o comisionadas (% Socio, nombre de operador y teléfono).
* **Privacidad Total**: Oculto completamente a los clientes; solo el encargado o superadmin visualizan estos datos internos.
* **Reparto Financiero en Dashboard**: Cálculo automático de Facturación Bruta, Pago a Socios y Ganancia Neta para el Local.
* **Liquidación y Exportación**: Tabla de desglose por máquina y reportes CSV listos para entregar cuentas a socios operadores.

### 🎨 Rediseño Consolidado de UI / UX
* **Menú del Header Agrupado**: Navegación dividida en 2 clusters limpios (Público/Calendarios vs Operación Staff).
* **Cabecera Móvil en 2 Renglones**: Renglón 1 dedicado a la identidad y nombre del local; Renglón 2 para usuario, botón Reservar y menú hamburguesa `☰`.
* **Tarjetas VIP Gamer Pass en Directorio**: HUD consolidado de 3 columnas (Saldo, Lealtad, Reservas), 2 botones principales (`➕ Consumo`, `💳 Cuenta`) y barra de herramientas compacta.

---

## Funcionalidades de Versiones Anteriores (v1.4.0)

### 📈 Panel de Rendimiento y Analítica de Negocio para Locatarios
* **Dashboard Integral en Tiempo Real**: Nueva pestaña de **"Rendimiento"** para el staff y encargados con visión 360° del negocio.
* **Tarjetas KPI Maestras**:
  * 💰 **Ingresos Totales**: Facturación real en moneda configurada y proyección potencial (con pendientes).
  * 🎟️ **Total Reservaciones**: Conteo de reservas confirmadas, pendientes y tasa de éxito (%).
  * ⏳ **Horas de Juego**: Total de horas efectivas jugadas y promedio por reserva.
  * ⚡ **Utilización de Máquinas**: Porcentaje de ocupación del local contra la capacidad disponible con barras de progreso Neón.
  * 🏷️ **Ticket Promedio**: Gasto medio por reservación e ingreso generado por hora jugada.
  * ❌ **Tasa de Cancelación**: Porcentaje y conteo de solicitudes canceladas o rechazadas.
* **4 Gráficas Interactivas con Chart.js**:
  1. **Evolución Temporal**: Curva combinada de ingresos y reservas confirmadas.
  2. **Estados de Reserva**: Gráfica Doughnut con confirmadas, pendientes y canceladas.
  3. **Rendimiento por Máquina**: Facturación y horas acumuladas por gabinete.
  4. **Horas Pico**: Distribución horaria de demanda (10:00 a 23:00) para identificar horarios de máxima afluencia.
* **Filtros Temporales Rápidos**: Hoy, Esta Semana, Este Mes, Últimos 30 Días, Todo el Histórico y Rango Personalizado.
* **Auditoría y Exportación**: Ranking de los mejores clientes y botón para **descargar reportes en CSV**.

### 🔗 Vinculación Inteligente de Reservas
* **Asignación Automática de Jugador**: Cuando el encargado agenda para un cliente, el sistema detecta y vincula automáticamente la reservación a la cuenta del jugador (por ID, Gamertag, nombre o teléfono).
* **Historial Unificado en "Mi Perfil"**: Los jugadores visualizan en tiempo real todas las reservas asignadas a su nombre, incluso aquellas creadas directamente por el encargado en mostrador.

### 🎁 Programa de Lealtad Flexible (Puntos vs Visitas)
* **Modos de Acumulación**: Configurable por local desde la pestaña de administración:
  * **Modo Consumo (Puntos)**: Acumula puntos de forma proporcional al costo total de la reserva (ej. $10 gastados = 1 punto).
  * **Modo Visitas**: Otorga **1 Visita** (crédito) por cada reservación confirmada.
* **Estructura Dinámica de Tiers**:
  * 🟫 **Bronce**: 0-99 Pts / 0-9 Visitas (Sin descuento)
  * ⬜ **Plata**: 100-299 Pts / 10-29 Visitas (**5% de descuento** automático)
  * 🟨 **Oro**: 300-599 Pts / 30-59 Visitas (**10% de descuento** automático)
  * 🟦 **Platino**: 600+ Pts / 60+ Visitas (**15% de descuento** automático)
* **Catálogo de Premios por Sucursal**: Permite a los encargados registrar recompensas que los jugadores pueden canjear en mostrador utilizando sus puntos acumulados.

### 💳 Tarjeta de Identificación Digital (Pass) con QR
* **Pase de Jugador**: Disponible desde la pestaña "Mi Perfil" del cliente.
* **Código QR Interactivo**: Al hacer clic, abre un modal con un diseño futurista de **RFID Arcade Pass** personalizado con el color de su Tier de lealtad y el nombre dinámico del local activo.
* **Escaneo**: Permite al staff en recepción escanear el QR desde el teléfono del jugador para registrar sus asistencias de inmediato.

### ⚡ Rendimiento y Optimización de Base de Datos
* **Paginación en Directorios**: El listado de clientes en la consola de administración incluye botones de navegación interactivos y carga fluida de hasta 150 registros en memoria para evitar saturar las lecturas en la base de datos.
* **Suscripciones de Calendario por Rango**: Las consultas de reservas en Firestore se filtran dinámicamente según la vista activa (Día, Semana o Mes) en lugar de descargar todo el historial.
* **Metadata Dinámica OpenGraph**: El servidor PowerShell detecta el local compartido en la URL (`?local=<id>`) y responde inyectando etiquetas `<meta>` dinámicas (nombre del local, banner y descripción) en lugar del nombre genérico de la aplicación.

---

## 🌟 Módulos de Administración de Catálogos por Negocio

### 1. 🕹️ Catálogo de Máquinas por Negocio (CRUD y Reasignación)
- **Agregar / Registrar**: Alta de nuevos gabinetes PIU con modelo (LX 55", TX 50", FX 42", etc.), versión de software, tarifa por hora, fotos y calibración de sensores FSR.
- **Editar / Modificar**: Modifica en cualquier momento tarifas, estado operativo (*Disponible*, *En Mantenimiento*, *Fuera de Servicio*), y notas de pads.
- **🔀 Reasignar / Transferir**: Permite mover o reasignar una máquina de un local a otro con 1 clic.

### 2. 💿 Catálogo Maestro de Versiones de Software
- Módulo centralizado para registrar, editar y catalogar versiones oficiales del juego (*Phoenix 2024*, *XX*, *Prime 2*, *Fiesta*, etc.), especificando modos compatibles.

### 3. 👥 Catálogo de Encargados y Personal por Local
- El Superadmin puede crear y editar usuarios, contraseñas/PINs y reasignar encargados de sucursal.

### 4. 🕺 Directorio de Clientes / Jugadores con Privacidad de Datos
- Panel con paginación optimizada para gestionar Gamertags, teléfonos y liga. **Los datos sensibles de contacto como teléfono y correo electrónico están estrictamente ocultos para otros clientes**, visibles solo para el Encargado y el Superadmin.

---

## 👑 Arquitectura de 3 Niveles de Acceso

```
                  ┌───────────────────────────────┐
                  │    SUPERADMINISTRADOR (Tú)    │
                  │  • Administra todos los locales│
                  │  • Catálogos Maestros y Reglas │
                  │  • Reasignación de Máquinas    │
                  │  • Eliminación en Cascada      │
                  └──────────────┬────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
      ┌─────────────────────┐         ┌─────────────────────┐
      │   ENCARGADO LOCAL 1 │         │   ENCARGADO LOCAL 2 │
      │ (Máquinas, Reservas,│         │ (Máquinas, Reservas,│
      │  Clientes, Centro)  │         │  Clientes, Galaxy)  │
      └──────────┬──────────┘         └──────────┬──────────┘
                 │                               │
                 ▼                               ▼
      ┌─────────────────────┐         ┌─────────────────────┐
      │  CLIENTES LOCAL 1   │         │  CLIENTES LOCAL 2   │
      │ ?local=biz_centro   │         │ ?local=biz_galaxy   │
      └─────────────────────┘         └─────────────────────┘
```

---

## 🎨 Paleta Oficial de la Nueva Versión
- `#023859` — Deep Ocean Blue
- `#012623` — Deep Obsidian Teal
- `#088C4F` — Emerald Green
- `#68F205` — Neon Laser Lime
- `#C3D91E` — Electric Chartreuse

---

## 🔑 Credenciales Demo Preconfiguradas (Botón `🔐 Acceso Staff`):

| Rol | Usuario | PIN | Negocio Asignado |
|---|---|---|---|
| 👑 **Superadmin** | `superadmin` | `8888` | Control global de todos los locales |
| 🕹️ **Encargado Centro** | `encargado_centro` | `1234` | Solo *Pump Zone Centro* |
| ⚡ **Encargada Galaxy** | `encargado_galaxy` | `5678` | Solo *Arcade Galaxy Norte* |
| 👤 **Clientes** | *Sin login* | *N/A* | Acceso directo al local vía selector o URL |

---

## 📅 Vistas de Calendario Disponibles
1. **⚡ Vista Día**: Matriz de horas (filas) vs máquinas (columnas). Celdas disponibles para reservar con 1 clic.
2. **📊 Vista Semana**: Conteo de reservas diarias y atajos rápidos.
3. **🗓️ Vista Mes**: Calendario con badges numéricos de reservaciones.

---

## 🗄️ Estructura en Firebase Firestore (Prefijo `piu_`):
1. `piu_businesses`: Negocios y sucursales (incluye configuración de lealtad: `loyaltyEnabled`, `loyaltyMode`, `pointsRatio`).
2. `piu_staff_users`: Superadmin y Encargados.
3. `piu_machines`: Gabinetes PIU.
4. `piu_reservations`: Solicitudes y reservas.
5. `piu_operating_rules`: Horarios y reglas operativas.
6. `piu_game_versions`: Versiones del juego.
7. `piu_players`: Jugadores y Gamertags (incluye `loyaltyPoints` y `loyaltyVisits`).
8. `piu_rewards`: Catálogo de premios de lealtad por negocio.
9. `piu_redemptions`: Solicitudes de canjes validadas.
10. `piu_audit_logs`: Bitácora de auditoría para encargados.
