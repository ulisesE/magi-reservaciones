# 🕹️ Pump It Up Hub — Sistema Modular de Reservaciones de Maquinitas

Plataforma web profesional, modular y multi-negocio diseñada para la administración y reservación de máquinas de ritmo **Pump It Up (PIU)**.

---

## 🌟 Novedades: Módulos de Administración de Catálogos por Negocio

### 1. 🕹️ Catálogo de Máquinas por Negocio (CRUD y Reasignación)
- **Agregar / Registrar**: Alta de nuevos gabinetes PIU con modelo (LX 55", TX 50", FX 42", etc.), versión de software, tarifa por hora, fotos y calibración de sensores FSR.
- **Editar / Modificar**: Modifica en cualquier momento tarifas, estado operativo (*Disponible*, *En Mantenimiento*, *Fuera de Servicio*), y notas técnicas de los pads.
- **Eliminar**: Baja definitiva de máquinas del inventario local.
- **🔀 Reasignar / Transferir**: Permite mover o reasignar una máquina de un local a otro con 1 clic (ej. transferir un gabinete LX de *Pump Zone Centro* a *Arcade Galaxy Norte*).

### 2. 💿 Catálogo Maestro de Versiones de Software
- Módulo centralizado para registrar, editar y catalogar versiones oficiales del juego (*Phoenix 2024*, *XX 20th Anniversary*, *Prime 2*, *Fiesta*, etc.).
- Soporte para especificar año de lanzamiento, último parche (*v1.08.0*) y modos de juego compatibles (*Single, Double, Co-Op, Premium*).

### 3. 👥 Catálogo de Encargados y Personal por Local
- El Superadmin puede crear, editar usuarios, contraseñas/PINs y reasignar encargados de sucursal.

### 4. 🕺 Directorio de Clientes / Jugadores por Negocio
- Los encargados administran a sus clientes habituales (Gamertags, teléfonos, WhatsApp directo, correo, nivel de juego y notas de calibración).

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
      │ (Pistas, Reservas,  │         │ (Pistas, Reservas,  │
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
