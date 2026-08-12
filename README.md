# 🕹️ Pump It Up Hub — Sistema Modular de Reservaciones de Maquinitas

Plataforma web profesional, modular y multi-negocio diseñada para la administración y reservación de máquinas de ritmo **Pump It Up (PIU)**.

---

## 👑 Arquitectura de 3 Niveles de Acceso y Roles

El sistema cuenta con una estructura jerárquica clara para Superadministrador, Encargados por Local y Clientes:

```
                  ┌───────────────────────────────┐
                  │    SUPERADMINISTRADOR (Tú)    │
                  │  • Administra todos los locales│
                  │  • Asigna encargados y enlaces │
                  └──────────────┬────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
      ┌─────────────────────┐         ┌─────────────────────┐
      │   ENCARGADO LOCAL 1 │         │   ENCARGADO LOCAL 2 │
      │ (Pistas, Reservas,  │         │ (Pistas, Reservas,  │
      │  Horarios Centro)   │         │  Horarios Galaxy)   │
      └──────────┬──────────┘         └──────────┬──────────┘
                 │                               │
                 ▼                               ▼
      ┌─────────────────────┐         ┌─────────────────────┐
      │  CLIENTES LOCAL 1   │         │  CLIENTES LOCAL 2   │
      │ ?local=biz_centro   │         │ ?local=biz_galaxy   │
      └─────────────────────┘         └─────────────────────┘
```

### 1. 👑 Superadmin (Tú)
- **Panel Global**: Visualiza métricas de todos los locales de la plataforma.
- **Gestión de Negocios**: Crea nuevos negocios, edita datos comerciales y tarifas generales.
- **Gestión de Encargados**: Crea usuarios y asigna a cada encargado su local correspondiente con PIN de seguridad.
- **Generador de Enlaces Directos**: Copia con 1 clic los enlaces directos para los clientes de cada sucursal (ej. `index.html?local=biz_piu_centro`).

### 2. 🕹️ Encargados (Por Negocio / Local)
- Inician sesión con su usuario y PIN (`🔐 Acceso Staff`).
- El sistema entra **automáticamente con su local asignado cargado** con sus máquinas, horarios y reservaciones.
- **Bandeja de Solicitudes**: Aprueba, rechaza (con motivo) o modifica horarios y pistas.
- **Asignación Directa**: Agenda a jugadores presenciales o por llamada en el Grid del día.
- **Catálogo de Pistas**: Cambia el estado de los gabinetes a *Mantenimiento* y registra nuevas máquinas.

### 3. 👤 Clientes (Por Negocio / Local)
- Acceden mediante el enlace personalizado de su local (ej. `?local=biz_piu_centro` o `?business=biz_arcade_galaxy`).
- Visualizan únicamente la disponibilidad, máquinas y horarios de ese local.
- Solicitan reservaciones ingresando su Gamertag y WhatsApp.
- Obtienen su **Pase Digital / Ticket de Reservación** con botón para notificar y confirmar por WhatsApp.

---

## 🔑 Credenciales Demo Preconfiguradas (Para Pruebas Inmediatas)

| Perfil / Rol | Usuario | PIN | Negocio / Alcance |
|---|---|---|---|
| 👑 **Superadmin** | `superadmin` | `8888` | Control global de todos los locales |
| 🕹️ **Encargado Centro** | `encargado_centro` | `1234` | Solo local *Pump Zone Centro* |
| ⚡ **Encargada Galaxy** | `encargado_galaxy` | `5678` | Solo local *Arcade Galaxy Norte* |
| 👤 **Clientes** | *Sin login* | *N/A* | Acceso directo al portal del local |

---

## 📅 Vistas de Calendario Disponibles

1. **⚡ Vista Día (Grid de Horas × Máquinas)**:
   - Columnas: Gabinetes PIU disponibles en el local.
   - Filas: Bloques horarios operativos.
   - Celdas: Disponibles para reservar con 1 clic; Ocupadas mostrando nombre del cliente, horario y estado.
2. **📊 Vista Semana**:
   - Tarjetas de los 7 días con contador de reservaciones, desglose de estados (*Confirmadas* vs *Pendientes*) y acceso rápido.
3. **🗓️ Vista Mes**:
   - Calendario mensual con badges interactivos que indican el número de reservaciones por fecha y nivel de ocupación.

---

## 🗄️ Catálogos Aislados en Firebase Firestore (Namespace `piu_`)

Para garantizar que **no se toquen ni se mezclen datos con las colecciones existentes** (`booking`, `settings`, `users`), toda la aplicación reside en un espacio de nombres seguro:

- `piu_businesses`: Negocios y sucursales.
- `piu_staff_users`: Cuentas de Superadmin y Encargados asignados por local.
- `piu_machines`: Catálogo de gabinetes (LX 55", TX 50", FX, sensores FSR).
- `piu_reservations`: Solicitudes y reservaciones.
- `piu_operating_rules`: Horarios de apertura y reglas por día.
- `piu_game_versions`: Versiones oficiales (*Phoenix 2024*, *XX*, *Prime 2*).
- `piu_players`: Registro dinámico de jugadores y Gamertags.
- `piu_audit_logs`: Bitácora de auditoría de encargados.

---

## 🚀 Cómo Ejecutar la Aplicación

Simplemente abre el archivo [`index.html`](file:///c:/Proyectos/Magi-Swit/Magi-reservaciones/index.html) en tu navegador preferido (Chrome, Edge, Firefox, Safari).

- Para probar como **Cliente de Centro**: Abre `index.html?local=biz_piu_centro`
- Para probar como **Cliente de Galaxy**: Abre `index.html?local=biz_arcade_galaxy`
- Para probar como **Staff / Superadmin**: Haz clic en el botón `🔐 Acceso Staff` en la esquina superior derecha y selecciona uno de los accesos rápidos de 1-clic.
