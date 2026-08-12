# 🕹️ Pump It Up Hub — Sistema Modular de Reservaciones de Maquinitas

Plataforma web profesional, modular y multi-negocio diseñada para la administración y reservación de máquinas de ritmo **Pump It Up (PIU)**.

---

## 🌟 Novedades y Flujo de Selección de Local

### 1. 🏢 Pantalla de Bienvenida / Index Obligatoria
- Al entrar a `index.html` (sin un parámetro de local previo), el sistema **NO entra solo a ningún local**.
- Muestra una pantalla de bienvenida donde el usuario debe **elegir explícitamente a qué sala o sucursal desea ingresar** (*Pump Zone Centro*, *Arcade Galaxy Norte*, etc.).
- **Bloqueo de Local**: Una vez que el usuario selecciona su local, el sistema queda bloqueado a ese local específico para evitar confusiones o mezclas de reservas.
- Para cambiar de sucursal, el usuario solo debe hacer clic en el botón superior **`← Cambiar de Local`**, el cual lo regresa al Index inicial.

### 2. 🗑️ Eliminación en Cascada por Negocio (Superadmin)
- Cuando el Superadministrador elimina un local desde el panel global, el sistema ejecuta una **eliminación en cascada completa**:
  - Se eliminan todas las máquinas registradas de ese local (`piu_machines`).
  - Se eliminan todas las reservaciones e historial de ese local (`piu_reservations`).
  - Se eliminan todas las cuentas de encargados asignadas a ese local (`piu_staff_users`).
  - Se limpia el almacenamiento en la nube en Firebase Firestore y la memoria local.

### 3. 👑 Consola de Superadmin y Catálogos Globales
- **Catálogo de Locales / Sucursales**: Alta, edición, eliminación en cascada y generación de enlaces directos para clientes.
- **Catálogo de Máquinas por Negocio**: Control centralizado de gabinetes LX, TX, FX y estado de pads.
- **Catálogo de Encargados / Staff**: Creación y asignación de cuentas de encargados con PIN de seguridad por local.
- **Catálogo de Horarios y Reglas**: Configuración de horas de apertura y cierre por sucursal.

---

## 👑 Arquitectura de 3 Niveles de Acceso

```
                  ┌───────────────────────────────┐
                  │    SUPERADMINISTRADOR (Tú)    │
                  │  • Administra todos los locales│
                  │  • Asigna encargados y enlaces │
                  │  • Eliminación en Cascada      │
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

---

## 🔑 Credenciales Demo Preconfiguradas (Botón `🔐 Acceso Staff`):

| Rol | Usuario | PIN | Negocio Asignado |
|---|---|---|---|
| 👑 **Superadmin** | `superadmin` | `8888` | Control global de todos los locales |
| 🕹️ **Encargado Centro** | `encargado_centro` | `1234` | Solo *Pump Zone Centro* |
| ⚡ **Encargada Galaxy** | `encargado_galaxy` | `5678` | Solo *Arcade Galaxy Norte* |
| 👤 **Clientes** | *Sin login* | *N/A* | Acceso al local vía selector o enlace directo |

---

## 📅 Vistas de Calendario Disponibles

1. **⚡ Vista Día (Grid de Horas × Máquinas)**: Matriz interactiva de horas (filas) vs máquinas (columnas). Celdas disponibles para reservar con 1 clic; celdas ocupadas con nombre del jugador y horario.
2. **📊 Vista Semana**: Tarjetas de los 7 días con conteo de reservas, desglose de estados y atajo para reservar.
3. **🗓️ Vista Mes**: Calendario mensual con badges numéricos de reservaciones por fecha.

---

## 🗄️ Catálogos Aislados en Firebase Firestore (Prefijo `piu_`):
1. `piu_businesses`: Negocios y sucursales.
2. `piu_staff_users`: Usuarios de Superadmin y Encargados asignados por negocio.
3. `piu_machines`: Gabinetes PIU (LX 55", TX 50", FX, sensores FSR).
4. `piu_reservations`: Solicitudes y reservaciones.
5. `piu_operating_rules`: Horarios de apertura y reglas operativas por día.
6. `piu_game_versions`: Versiones del juego (*Phoenix 2024*, *XX*, *Prime 2*).
7. `piu_players`: Directorio de jugadores y Gamertags.
8. `piu_audit_logs`: Bitácora de auditoría para encargados.
