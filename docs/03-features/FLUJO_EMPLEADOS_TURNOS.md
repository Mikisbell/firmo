# 👥 FLUJO_EMPLEADOS_TURNOS — Gestión de Personal

> Control de horarios, asistencia y horas extras para ~20 empleados por local

---

## 📋 Resumen Ejecutivo

| Aspecto | Detalle |
|---------|---------|
| **Problema** | Horarios en papel, no se sabe quién trabajó cuánto |
| **Solución** | Programación digital + marcación + cálculo automático |
| **Complejidad** | Media |
| **Prioridad** | 🟡 Media - Necesario para nómina |

---

## 🎯 Escenarios de Uso

### Escenario 1: Programar Semana
```
DADO que el admin programa la semana
CUANDO asigna turnos:
  - Carlos: Lun-Vie 12:00-22:00
  - María: Mar-Sab 16:00-00:00
  - Pedro: Lun-Dom 18:00-23:00 (medio tiempo)
ENTONCES cada empleado ve su horario en la app
Y recibe notificación de su turno
```

### Escenario 2: Marcar Entrada
```
DADO que Carlos llega al trabajo
CUANDO marca entrada con su PIN (1234)
ENTONCES se registra hora: 11:55
Y aparece como "presente" en el dashboard
Y si llega tarde (>15 min) se marca tardanza
```

### Escenario 3: Marcar Salida
```
DADO que Carlos termina su turno
CUANDO marca salida
ENTONCES se registra hora: 22:15
Y se calcula: 10h 20min trabajadas
Y 20 min son horas extra (turno era hasta 22:00)
```

### Escenario 4: Solicitar Permiso
```
DADO que María necesita salir temprano el viernes
CUANDO solicita permiso desde la app
ENTONCES el admin recibe notificación
Y puede aprobar/rechazar
Y si aprueba → se ajusta el horario
```

### Escenario 5: Cambio de Turno
```
DADO que Pedro no puede trabajar el sábado
Y Ana puede cubrirlo
CUANDO Pedro solicita cambio con Ana
ENTONCES ambos confirman
Y el admin aprueba
Y los horarios se intercambian
```

### Escenario 6: Reporte de Nómina
```
DADO que es fin de quincena
CUANDO el admin genera reporte
ENTONCES ve por empleado:
  - Horas normales trabajadas
  - Horas extra (25% adicional)
  - Tardanzas
  - Faltas
  - Propinas (si aplica)
Y puede exportar para contabilidad
```

---

## 📊 Modelo de Datos

### Tabla: Employee
```typescript
interface Employee {
  id: string;
  tenant_id: string;
  location_id: string;           // Puede trabajar en varios
  
  // Datos personales
  first_name: string;
  last_name: string;
  dni: string;
  phone: string;
  email?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  
  // Laboral
  role: EmployeeRole;
  hire_date: Date;
  termination_date?: Date;
  
  // Salario (centavos)
  base_salary: number;           // Mensual
  hourly_rate?: number;          // Si es por hora
  
  // Acceso
  pin: string;                   // Para marcar asistencia
  user_id?: string;              // Si tiene acceso al sistema
  
  // Configuración
  max_hours_week: number;        // Límite horas semanales
  can_work_overtime: boolean;
  
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

type EmployeeRole = 
  | 'ADMIN'
  | 'MANAGER'
  | 'CASHIER'
  | 'WAITER'
  | 'KITCHEN'
  | 'BAR'
  | 'DELIVERY'
  | 'CLEANING'
  | 'SECURITY';
```

### Tabla: Schedule (Horario Programado)
```typescript
interface Schedule {
  id: string;
  tenant_id: string;
  location_id: string;
  employee_id: string;
  
  date: Date;                    // Fecha específica
  
  shift_start: string;           // "12:00"
  shift_end: string;             // "22:00"
  break_minutes: number;         // Tiempo de descanso
  
  zone_id?: string;              // Zona asignada (meseros)
  
  status: ScheduleStatus;
  
  // Si es cambio/cobertura
  original_employee_id?: string;
  swap_approved_by?: string;
  
  notes?: string;
  
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

type ScheduleStatus = 
  | 'SCHEDULED'          // Programado normal
  | 'SWAP_PENDING'       // Cambio pendiente aprobación
  | 'SWAP_APPROVED'      // Cambio aprobado
  | 'CANCELLED'          // Cancelado
  | 'COMPLETED';         // Turno completado
```

### Tabla: Attendance (Asistencia Real)
```typescript
interface Attendance {
  id: string;
  tenant_id: string;
  location_id: string;
  employee_id: string;
  schedule_id?: string;          // Referencia al turno programado
  
  date: Date;
  
  // Marcaciones
  clock_in: Date;
  clock_out?: Date;
  
  // Descansos
  breaks: Array<{
    start: Date;
    end?: Date;
    type: 'LUNCH' | 'REST' | 'OTHER';
  }>;
  
  // Cálculos
  scheduled_minutes: number;     // Lo que debía trabajar
  worked_minutes: number;        // Lo que trabajó
  overtime_minutes: number;      // Horas extra
  late_minutes: number;          // Tardanza
  early_leave_minutes: number;   // Salió antes
  
  // Estado
  status: AttendanceStatus;
  
  // Notas
  notes?: string;
  
  created_at: Date;
  updated_at: Date;
}

type AttendanceStatus = 
  | 'PRESENT'            // Trabajando
  | 'ON_BREAK'           // En descanso
  | 'COMPLETED'          // Turno terminado
  | 'ABSENT'             // Falta
  | 'LATE'               // Llegó tarde
  | 'EXCUSED';           // Falta justificada
```

### Tabla: Time_Off_Request (Permisos)
```typescript
interface TimeOffRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  
  type: TimeOffType;
  
  start_date: Date;
  end_date: Date;
  
  reason: string;
  
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string;
  reviewed_at?: Date;
  review_notes?: string;
  
  created_at: Date;
}

type TimeOffType = 
  | 'VACATION'           // Vacaciones
  | 'SICK'               // Enfermedad
  | 'PERSONAL'           // Personal
  | 'BEREAVEMENT'        // Duelo
  | 'MATERNITY'          // Maternidad
  | 'OTHER';
```

---

## 📡 Eventos de Dominio

```typescript
interface EmployeeClockInEvent {
  type: 'EMPLOYEE_CLOCK_IN';
  payload: {
    employee_id: string;
    attendance_id: string;
    clock_in_time: string;
    is_late: boolean;
    late_minutes?: number;
  };
}

interface EmployeeClockOutEvent {
  type: 'EMPLOYEE_CLOCK_OUT';
  payload: {
    employee_id: string;
    attendance_id: string;
    clock_out_time: string;
    worked_minutes: number;
    overtime_minutes: number;
  };
}

interface ScheduleCreatedEvent {
  type: 'SCHEDULE_CREATED';
  payload: {
    schedule_id: string;
    employee_id: string;
    date: string;
    shift_start: string;
    shift_end: string;
  };
}

interface ShiftSwapRequestedEvent {
  type: 'SHIFT_SWAP_REQUESTED';
  payload: {
    schedule_id: string;
    from_employee_id: string;
    to_employee_id: string;
    date: string;
  };
}

interface TimeOffApprovedEvent {
  type: 'TIME_OFF_APPROVED';
  payload: {
    request_id: string;
    employee_id: string;
    type: TimeOffType;
    start_date: string;
    end_date: string;
  };
}
```

---

## 🖥️ UI Mockups

### Calendario de Turnos (Admin)
```
┌─────────────────────────────────────────────────────────────┐
│  👥 TURNOS - Semana 1 Enero 2026              [+ Programar] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ◀ [Semana Anterior]  Lun 5 - Dom 11  [Semana Siguiente] ▶ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Empleado  │ Lun │ Mar │ Mie │ Jue │ Vie │ Sab │ Dom    ││
│  ├───────────┼─────┼─────┼─────┼─────┼─────┼─────┼────────┤│
│  │ Carlos M. │12-22│12-22│12-22│12-22│12-22│ --- │ ---    ││
│  │ María L.  │ --- │16-00│16-00│16-00│16-00│16-00│ ---    ││
│  │ Pedro S.  │18-23│18-23│18-23│18-23│18-23│18-23│18-23   ││
│  │ Ana R.    │12-22│12-22│ --- │ --- │12-22│12-22│12-22   ││
│  │ Luis G.   │ --- │ --- │16-00│16-00│16-00│16-00│16-00   ││
│  │ Rosa T.   │08-16│08-16│08-16│08-16│08-16│ --- │ ---    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Leyenda: 12-22 = 12:00 a 22:00 │ --- = Libre │ 🔴 = Falta │
│                                                             │
│  [📋 Copiar Semana] [📤 Exportar] [📱 Notificar a Todos]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Marcación de Asistencia
```
┌─────────────────────────────────────────────────────────────┐
│  ⏰ MARCAR ASISTENCIA                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    🕐 14:32:45                              │
│                    Lunes 5 Enero                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │              Ingresa tu PIN:                            ││
│  │                                                         ││
│  │              [  ●  ●  ●  ●  ]                          ││
│  │                                                         ││
│  │              ┌───┬───┬───┐                              ││
│  │              │ 1 │ 2 │ 3 │                              ││
│  │              ├───┼───┼───┤                              ││
│  │              │ 4 │ 5 │ 6 │                              ││
│  │              ├───┼───┼───┤                              ││
│  │              │ 7 │ 8 │ 9 │                              ││
│  │              ├───┼───┼───┤                              ││
│  │              │ ⌫ │ 0 │ ✓ │                              ││
│  │              └───┴───┴───┘                              ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Presentes hoy: 8/12                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Confirmación de Marcación
```
┌─────────────────────────────────────────────────────────────┐
│  ✓ ENTRADA REGISTRADA                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    👤 Carlos Mendoza                        │
│                                                             │
│                    ✓ Entrada: 11:55                         │
│                                                             │
│                    Turno: 12:00 - 22:00                     │
│                    Zona: A - Principal                      │
│                                                             │
│                    ¡Llegaste 5 min temprano! 👍             │
│                                                             │
│                    [OK]                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Dashboard de Asistencia (Admin)
```
┌─────────────────────────────────────────────────────────────┐
│  👥 ASISTENCIA HOY - Lunes 5 Enero              [📊 Reporte]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 🟢 8    │  │ 🔴 2    │  │ 🟡 1    │  │ ⏳ 1    │        │
│  │Presentes│  │ Faltas  │  │ Tarde   │  │Por llegar│        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Empleado    │ Turno   │ Entrada │ Estado   │ Horas     ││
│  ├─────────────┼─────────┼─────────┼──────────┼───────────┤│
│  │ Carlos M.   │ 12-22   │ 11:55   │ 🟢 Pres. │ 2h 37m    ││
│  │ María L.    │ 16-00   │ ---     │ ⏳ Pend. │ ---       ││
│  │ Pedro S.    │ 18-23   │ ---     │ ⏳ Pend. │ ---       ││
│  │ Ana R.      │ 12-22   │ 12:18   │ 🟡 Tarde │ 2h 14m    ││
│  │ Luis G.     │ Libre   │ ---     │ ---      │ ---       ││
│  │ Rosa T.     │ 08-16   │ 08:02   │ 🟢 Pres. │ 6h 30m    ││
│  │ Juan P.     │ 12-22   │ ---     │ 🔴 Falta │ ---       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [📞 Llamar Ausentes]  [📝 Registrar Justificación]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Reporte de Nómina
```
┌─────────────────────────────────────────────────────────────┐
│  📊 REPORTE QUINCENAL - 1-15 Enero 2026         [📤 Export]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Empleado    │ H.Norm │ H.Extra │ Tardanzas │ Faltas    ││
│  ├─────────────┼────────┼─────────┼───────────┼───────────┤│
│  │ Carlos M.   │  80h   │   5h    │    0      │    0      ││
│  │ María L.    │  72h   │   3h    │    1      │    0      ││
│  │ Pedro S.    │  45h   │   0h    │    0      │    0      ││
│  │ Ana R.      │  76h   │   8h    │    2      │    1      ││
│  │ Luis G.     │  64h   │   2h    │    0      │    0      ││
│  │ Rosa T.     │  80h   │   0h    │    0      │    0      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Resumen:                                                   │
│  • Total horas normales: 417h                               │
│  • Total horas extra: 18h (+25% = 22.5h equivalentes)      │
│  • Tardanzas: 3 (descuento: S/45)                          │
│  • Faltas injustificadas: 1 (descuento: S/80)              │
│                                                             │
│  [Ver Detalle por Empleado]  [Exportar a Excel]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Fases de Implementación

| Fase | Alcance | Duración |
|------|---------|----------|
| **1** | Modelo de datos empleados | 1 día |
| **2** | Programación de turnos | 2 días |
| **3** | Marcación entrada/salida | 2 días |
| **4** | Cálculo horas/extras | 1 día |
| **5** | Permisos y cambios | 2 días |
| **6** | Reportes nómina | 2 días |

**Total estimado: 10 días de desarrollo**

---

*Última actualización: Enero 2026*
