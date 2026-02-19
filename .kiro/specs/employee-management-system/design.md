# Documento de Diseño - Sistema de Gestión de Recursos Humanos

## Overview

El Sistema de Gestión de Recursos Humanos (RRHH) es un módulo completo que gestiona todo el ciclo de vida de los empleados en PARK POS, desde la contratación hasta la gestión de planillas, asistencia, vacaciones y evaluación de desempeño. El sistema se integra perfectamente con la arquitectura event-sourcing existente, soporta operación offline-first con IndexedDB, y cumple con la legislación laboral peruana.

### Objetivos del Diseño

1. **Gestión Completa de Empleados**: Perfiles completos con información personal, laboral, documentos y contactos de emergencia
2. **Control de Asistencia**: Registro de entrada/salida con PIN, cálculo automático de horas trabajadas y detección de tardanzas
3. **Gestión de Horarios**: Turnos rotativos, solicitudes de cambio, calendario visual y notificaciones
4. **Cálculo de Planilla**: Salarios, comisiones, propinas, adelantos, descuentos, horas extras y aportes legales
5. **Vacaciones y Permisos**: Solicitudes digitales, aprobaciones, cálculo de días acumulados
6. **Evaluación de Desempeño**: Métricas automáticas, objetivos, feedback y reportes
7. **Capacitaciones**: Registro de cursos, certificados, asignación automática y recordatorios
8. **Cumplimiento Legal**: CTS, gratificaciones, PLAME, salario mínimo, aportes EsSalud/ONP/AFP
9. **Self-Service**: Panel para empleados con acceso a su información, horarios, boletas y solicitudes
10. **Reportes y Analytics**: Reportes de asistencia, planilla, vacaciones, desempeño, rotación y costos

### Principios de Diseño

- **Event Sourcing**: Todas las operaciones emiten eventos inmutables
- **Offline-First**: Funciona sin conexión, sincroniza cuando hay internet
- **Multi-Tenant**: Aislamiento completo por tenant_id
- **Money Safety**: Todos los montos en centavos (integer), nunca float
- **Audit Trail**: Historial completo de cambios con actor_id y timestamp
- **Type Safety**: Uso de branded types (Centavos, EmployeeId, etc.)
- **Legislación Peruana**: Cumplimiento con leyes laborales peruanas


## Architecture

### Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  Admin Panel RRHH          │  Employee Self-Service Panel       │
│  - Dashboard con métricas  │  - Mi perfil                       │
│  - Gestión de empleados    │  - Mis horarios                    │
│  - Horarios y turnos       │  - Mi asistencia                   │
│  - Asistencia              │  - Mis boletas                     │
│  - Planilla                │  - Solicitar vacaciones            │
│  - Vacaciones              │  - Ver propinas                    │
│  - Evaluaciones            │                                    │
│  - Capacitaciones          │                                    │
│  - Reportes                │                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer (Next.js)                      │
├─────────────────────────────────────────────────────────────────┤
│  /api/hr/employees         │  /api/hr/attendance                │
│  /api/hr/schedules         │  /api/hr/payroll                   │
│  /api/hr/leave-requests    │  /api/hr/advances                  │
│  /api/hr/evaluations       │  /api/hr/training                  │
│  /api/hr/reports           │  /api/hr/notifications             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  EmployeeService           │  AttendanceService                 │
│  ScheduleService           │  PayrollService                    │
│  LeaveRequestService       │  AdvanceService                    │
│  EvaluationService         │  TrainingService                   │
│  ReportService             │  NotificationService               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Event Sourcing Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  Event Publisher           │  Event Reducer                     │
│  - EMPLOYEE_CREATED        │  - employee.reducer.ts             │
│  - EMPLOYEE_UPDATED        │  - attendance.reducer.ts           │
│  - ATTENDANCE_CLOCKED_IN   │  - schedule.reducer.ts             │
│  - ATTENDANCE_CLOCKED_OUT  │  - payroll.reducer.ts              │
│  - LEAVE_REQUEST_CREATED   │  - leave-request.reducer.ts        │
│  - LEAVE_REQUEST_APPROVED  │                                    │
│  - PAYROLL_CALCULATED      │                                    │
│  - ADVANCE_REQUESTED       │                                    │
│  - EVALUATION_CREATED      │                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Prisma)       │  IndexedDB (Dexie)                 │
│  - employees (extendido)   │  - hr_events (offline)             │
│  - attendance              │  - employees_cache                 │
│  - schedules               │  - schedules_cache                 │
│  - leave_requests          │  - attendance_cache                │
│  - advances                │                                    │
│  - evaluations             │                                    │
│  - training_records        │                                    │
│  - payroll_records         │                                    │
│  - events (event sourcing) │                                    │
│                            │                                    │
│  Supabase Storage          │                                    │
│  - profile_photos          │                                    │
│  - documents               │                                    │
│  - certificates            │                                    │
│  - payslips                │                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

#### 1. Creación de Empleado (Admin)
```
Admin → POST /api/hr/employees → EmployeeService.create()
  → Validar datos
  → Generar PIN hash
  → Emitir EMPLOYEE_CREATED event
  → Almacenar en PostgreSQL
  → Sincronizar a IndexedDB
  → Retornar empleado creado
```

#### 2. Marcación de Asistencia (Empleado)
```
Empleado → POST /api/hr/attendance/clock-in → AttendanceService.clockIn()
  → Validar PIN
  → Obtener horario programado
  → Calcular tardanza (si aplica)
  → Emitir ATTENDANCE_CLOCKED_IN event
  → Almacenar en PostgreSQL
  → Si offline: Almacenar en IndexedDB
  → Retornar registro de asistencia
```

#### 3. Cálculo de Planilla (Admin)
```
Admin → POST /api/hr/payroll/calculate → PayrollService.calculate()
  → Obtener asistencia del mes
  → Calcular salario base
  → Sumar comisiones (desde orders)
  → Sumar propinas (desde tips)
  → Restar adelantos
  → Restar descuentos por faltas
  → Calcular horas extras
  → Calcular aportes legales
  → Emitir PAYROLL_CALCULATED event
  → Generar boleta PDF
  → Almacenar en PostgreSQL
  → Enviar notificación
  → Retornar planilla
```

#### 4. Solicitud de Vacaciones (Empleado)
```
Empleado → POST /api/hr/leave-requests → LeaveRequestService.create()
  → Validar saldo de vacaciones
  → Validar fechas
  → Emitir LEAVE_REQUEST_CREATED event
  → Almacenar en PostgreSQL
  → Notificar a supervisor
  → Retornar solicitud
```


## Components and Interfaces

### Core Services

#### 1. EmployeeService

```typescript
interface EmployeeService {
  // CRUD Operations
  create(data: CreateEmployeeInput): Promise<Employee>;
  update(id: EmployeeId, data: UpdateEmployeeInput): Promise<Employee>;
  deactivate(id: EmployeeId, reason: string): Promise<void>;
  getById(id: EmployeeId): Promise<Employee | null>;
  list(filters: EmployeeFilters): Promise<Employee[]>;
  search(query: string): Promise<Employee[]>;
  
  // Profile Management
  uploadProfilePhoto(id: EmployeeId, file: File): Promise<string>;
  addEmergencyContact(id: EmployeeId, contact: EmergencyContact): Promise<void>;
  uploadDocument(id: EmployeeId, doc: EmployeeDocument): Promise<void>;
  
  // Bulk Operations
  bulkActivate(ids: EmployeeId[]): Promise<void>;
  bulkDeactivate(ids: EmployeeId[]): Promise<void>;
  bulkChangeRole(ids: EmployeeId[], role: EmployeeRole): Promise<void>;
  exportToExcel(filters: EmployeeFilters): Promise<Blob>;
}
```

#### 2. AttendanceService

```typescript
interface AttendanceService {
  // Clock In/Out
  clockIn(employeeId: EmployeeId, pin: string): Promise<AttendanceRecord>;
  clockOut(employeeId: EmployeeId, pin: string): Promise<AttendanceRecord>;
  
  // Attendance Management
  getByEmployee(employeeId: EmployeeId, dateRange: DateRange): Promise<AttendanceRecord[]>;
  justifyAbsence(recordId: string, justification: Justification): Promise<void>;
  correctAttendance(recordId: string, correction: AttendanceCorrection): Promise<void>;
  
  // Calculations
  calculateHoursWorked(recordId: string): Promise<number>;
  calculateOvertime(recordId: string): Promise<number>;
  calculateLateness(recordId: string): Promise<number>;
  
  // Automatic Detection
  detectAbsences(date: BusinessDate): Promise<void>;
  
  // Reports
  getMonthlyReport(employeeId: EmployeeId, month: string): Promise<AttendanceReport>;
}
```

#### 3. ScheduleService

```typescript
interface ScheduleService {
  // Schedule Management
  create(data: CreateScheduleInput): Promise<Schedule>;
  update(id: string, data: UpdateScheduleInput): Promise<Schedule>;
  delete(id: string): Promise<void>;
  assignToEmployee(scheduleId: string, employeeId: EmployeeId): Promise<void>;
  
  // Shift Changes
  requestShiftChange(request: ShiftChangeRequest): Promise<ShiftChangeRequest>;
  approveShiftChange(requestId: string, approverId: EmployeeId): Promise<void>;
  rejectShiftChange(requestId: string, approverId: EmployeeId, reason: string): Promise<void>;
  
  // Calendar
  getWeeklyCalendar(weekStart: Date): Promise<ScheduleCalendar>;
  getMonthlyCalendar(month: string): Promise<ScheduleCalendar>;
  
  // Rotations
  createRotatingSchedule(pattern: RotationPattern): Promise<void>;
  applyRotation(employeeIds: EmployeeId[], weeks: number): Promise<void>;
  
  // Notifications
  sendShiftReminders(): Promise<void>;
}
```

#### 4. PayrollService

```typescript
interface PayrollService {
  // Payroll Calculation
  calculateMonthly(month: string): Promise<PayrollRecord[]>;
  calculateForEmployee(employeeId: EmployeeId, month: string): Promise<PayrollRecord>;
  
  // Components
  calculateBaseSalary(employeeId: EmployeeId, daysWorked: number): Promise<Centavos>;
  calculateCommissions(employeeId: EmployeeId, month: string): Promise<Centavos>;
  calculateTips(employeeId: EmployeeId, month: string): Promise<Centavos>;
  calculateOvertime(employeeId: EmployeeId, month: string): Promise<Centavos>;
  calculateDeductions(employeeId: EmployeeId, month: string): Promise<Centavos>;
  
  // Legal Calculations
  calculateCTS(employeeId: EmployeeId): Promise<Centavos>;
  calculateGratification(employeeId: EmployeeId, period: 'JULY' | 'DECEMBER'): Promise<Centavos>;
  calculateEsSalud(grossSalary: Centavos): Promise<Centavos>;
  calculateONP(grossSalary: Centavos): Promise<Centavos>;
  
  // Payslips
  generatePayslip(recordId: string): Promise<Blob>;
  sendPayslipNotification(employeeId: EmployeeId, recordId: string): Promise<void>;
  
  // Export
  exportToExcel(month: string): Promise<Blob>;
  generatePLAME(month: string): Promise<Blob>;
}
```

#### 5. LeaveRequestService

```typescript
interface LeaveRequestService {
  // Request Management
  create(data: CreateLeaveRequestInput): Promise<LeaveRequest>;
  approve(requestId: string, approverId: EmployeeId): Promise<void>;
  reject(requestId: string, approverId: EmployeeId, reason: string): Promise<void>;
  cancel(requestId: string, employeeId: EmployeeId): Promise<void>;
  
  // Vacation Balance
  getVacationBalance(employeeId: EmployeeId): Promise<number>;
  calculateAccruedDays(employeeId: EmployeeId): Promise<number>;
  
  // Calendar
  getTeamAbsences(teamIds: EmployeeId[], dateRange: DateRange): Promise<LeaveRequest[]>;
  
  // Attachments
  uploadMedicalCertificate(requestId: string, file: File): Promise<void>;
}
```

#### 6. AdvanceService

```typescript
interface AdvanceService {
  // Advance Management
  request(employeeId: EmployeeId, amount: Centavos): Promise<Advance>;
  approve(advanceId: string, approverId: EmployeeId): Promise<void>;
  reject(advanceId: string, approverId: EmployeeId, reason: string): Promise<void>;
  
  // Calculations
  calculateAvailableAmount(employeeId: EmployeeId): Promise<Centavos>;
  getPendingAdvances(employeeId: EmployeeId): Promise<Advance[]>;
  
  // History
  getHistory(employeeId: EmployeeId): Promise<Advance[]>;
}
```

#### 7. EvaluationService

```typescript
interface EvaluationService {
  // Evaluation Management
  create(data: CreateEvaluationInput): Promise<Evaluation>;
  update(id: string, data: UpdateEvaluationInput): Promise<Evaluation>;
  complete(id: string): Promise<void>;
  
  // Metrics
  calculateAutomaticMetrics(employeeId: EmployeeId, period: DateRange): Promise<EmployeeMetrics>;
  
  // Goals
  setGoal(employeeId: EmployeeId, goal: Goal): Promise<void>;
  trackGoalProgress(goalId: string): Promise<GoalProgress>;
  
  // Reports
  generatePerformanceReport(employeeId: EmployeeId): Promise<PerformanceReport>;
  
  // Feedback
  addEmployeeComment(evaluationId: string, employeeId: EmployeeId, comment: string): Promise<void>;
}
```

#### 8. TrainingService

```typescript
interface TrainingService {
  // Training Management
  recordCompletion(data: TrainingCompletionInput): Promise<TrainingRecord>;
  createMandatoryTraining(data: MandatoryTrainingInput): Promise<void>;
  assignToEmployees(trainingId: string, employeeIds: EmployeeId[]): Promise<void>;
  
  // Certificates
  uploadCertificate(recordId: string, file: File): Promise<void>;
  
  // Reminders
  sendPendingReminders(): Promise<void>;
  
  // Reports
  getCompletionReport(filters: TrainingFilters): Promise<TrainingReport>;
}
```

#### 9. ReportService

```typescript
interface ReportService {
  // Attendance Reports
  generateAttendanceReport(filters: AttendanceReportFilters): Promise<AttendanceReport>;
  generateHoursWorkedReport(filters: HoursReportFilters): Promise<HoursReport>;
  
  // Payroll Reports
  generatePayrollReport(month: string): Promise<PayrollReport>;
  generateLaborCostReport(filters: CostReportFilters): Promise<CostReport>;
  
  // Leave Reports
  generateVacationReport(filters: VacationReportFilters): Promise<VacationReport>;
  
  // Performance Reports
  generatePerformanceReport(filters: PerformanceReportFilters): Promise<PerformanceReport>;
  
  // Turnover Reports
  generateTurnoverReport(dateRange: DateRange): Promise<TurnoverReport>;
  
  // Export
  exportToExcel(report: Report): Promise<Blob>;
  exportToPDF(report: Report): Promise<Blob>;
  
  // Charts
  generateTrendCharts(metric: string, dateRange: DateRange): Promise<ChartData>;
}
```

#### 10. NotificationService

```typescript
interface NotificationService {
  // Push Notifications
  sendPushNotification(employeeId: EmployeeId, notification: Notification): Promise<void>;
  
  // Scheduled Notifications
  scheduleShiftReminder(employeeId: EmployeeId, shiftStart: Date): Promise<void>;
  scheduleBirthdayNotification(employeeId: EmployeeId, birthday: Date): Promise<void>;
  
  // Preferences
  updatePreferences(employeeId: EmployeeId, preferences: NotificationPreferences): Promise<void>;
  
  // Bulk Notifications
  notifyTeam(teamIds: EmployeeId[], notification: Notification): Promise<void>;
}
```


## Data Models

### Prisma Schema Extensions

```prisma
// Extensión del modelo employees existente
model employees {
  id                    String   @id @db.Uuid
  tenant_id             String   @db.Uuid
  name                  String
  role                  String   // CASHIER, WAITER, COOK, SUPERVISOR, ADMIN
  pin_hash              String?
  is_active             Boolean  @default(true)
  created_at            DateTime @default(now()) @db.Timestamptz(6)
  
  // NUEVOS CAMPOS - Información Personal
  dni                   String?  @unique
  email                 String?
  phone                 String?
  address               String?
  birth_date            DateTime? @db.Date
  profile_photo_url     String?
  
  // NUEVOS CAMPOS - Información Laboral
  hire_date             DateTime @db.Date
  position              String   // Puesto específico (ej: "Mesero Senior")
  base_salary_cents     Int      // Salario base mensual en centavos
  contract_type         String   // INDEFINIDO, PLAZO_FIJO, PART_TIME
  work_schedule_type    String   // FULL_TIME, PART_TIME, ROTATING
  location_id           String?  @db.Uuid
  
  // NUEVOS CAMPOS - Configuración
  commission_rate       Decimal? @db.Decimal(5, 2) // % de comisión sobre ventas
  pension_system        String?  // ONP, AFP_INTEGRA, AFP_PRIMA, etc.
  has_health_insurance  Boolean  @default(false)
  
  // Relaciones existentes
  orders                orders[]
  shifts_opened         shifts[] @relation("shifts_opened_byToemployees")
  shifts_closed         shifts[] @relation("shifts_closed_byToemployees")
  tips                  tips[]
  
  // NUEVAS RELACIONES
  emergency_contacts    emergency_contacts[]
  employee_documents    employee_documents[]
  attendance_records    attendance[]
  schedules             employee_schedules[]
  leave_requests        leave_requests[]
  advances              advances[]
  evaluations           evaluations[]
  training_records      training_records[]
  payroll_records       payroll_records[]
  
  @@index([tenant_id, is_active])
  @@index([tenant_id, dni])
  @@index([tenant_id, location_id])
}

// NUEVA TABLA - Contactos de Emergencia
model emergency_contacts {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  employee_id String   @db.Uuid
  name        String
  relationship String  // SPOUSE, PARENT, SIBLING, FRIEND, etc.
  phone       String
  address     String?
  is_primary  Boolean  @default(false)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  
  employee    employees @relation(fields: [employee_id], references: [id])
  
  @@index([tenant_id, employee_id])
}

// NUEVA TABLA - Documentos de Empleado
model employee_documents {
  id              String    @id @db.Uuid
  tenant_id       String    @db.Uuid
  employee_id     String    @db.Uuid
  document_type   String    // CONTRACT, CERTIFICATE, BACKGROUND_CHECK, ID_COPY, etc.
  file_url        String    // URL en Supabase Storage
  file_name       String
  file_size       Int       // bytes
  issue_date      DateTime? @db.Date
  expiry_date     DateTime? @db.Date
  uploaded_by     String    @db.Uuid
  uploaded_at     DateTime  @default(now()) @db.Timestamptz(6)
  
  employee        employees @relation(fields: [employee_id], references: [id])
  
  @@index([tenant_id, employee_id])
  @@index([tenant_id, document_type])
}

// EXTENSIÓN DE TABLA EXISTENTE - attendance
// (Ya existe en el schema, solo documentamos los campos)
model attendance {
  id                  String    @id @db.Uuid
  tenant_id           String    @db.Uuid
  location_id         String    @db.Uuid
  employee_id         String    @db.Uuid
  schedule_id         String?   @db.Uuid
  date                DateTime  @db.Date
  clock_in            DateTime  @db.Timestamptz(6)
  clock_out           DateTime? @db.Timestamptz(6)
  breaks              Json      @default("[]") // [{start, end, duration_mins}]
  scheduled_minutes   Int       @default(0)
  worked_minutes      Int       @default(0)
  overtime_minutes    Int       @default(0)
  late_minutes        Int       @default(0)
  early_leave_minutes Int       @default(0)
  status              String    @default("PRESENT") // PRESENT, ABSENT, LATE, JUSTIFIED
  notes               String?
  created_at          DateTime  @default(now()) @db.Timestamptz(6)
  updated_at          DateTime  @default(now()) @db.Timestamptz(6)
  
  employee            employees @relation(fields: [employee_id], references: [id])
  schedule            schedules? @relation(fields: [schedule_id], references: [id])
  
  @@index([tenant_id, employee_id, date])
  @@index([tenant_id, location_id, date])
}

// NUEVA TABLA - Horarios
model schedules {
  id              String   @id @db.Uuid
  tenant_id       String   @db.Uuid
  location_id     String   @db.Uuid
  name            String   // "Turno Mañana", "Turno Tarde", etc.
  schedule_type   String   // FIXED, ROTATING
  days_of_week    Int[]    // [1,2,3,4,5] = Lunes a Viernes
  start_time      String   // "08:00"
  end_time        String   // "17:00"
  break_minutes   Int      @default(60)
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)
  
  employee_schedules employee_schedules[]
  attendance_records attendance[]
  
  @@index([tenant_id, location_id, is_active])
}

// NUEVA TABLA - Asignación de Horarios a Empleados
model employee_schedules {
  id          String    @id @db.Uuid
  tenant_id   String    @db.Uuid
  employee_id String    @db.Uuid
  schedule_id String    @db.Uuid
  start_date  DateTime  @db.Date
  end_date    DateTime? @db.Date
  is_active   Boolean   @default(true)
  created_at  DateTime  @default(now()) @db.Timestamptz(6)
  
  employee    employees @relation(fields: [employee_id], references: [id])
  schedule    schedules @relation(fields: [schedule_id], references: [id])
  
  @@index([tenant_id, employee_id, is_active])
  @@index([tenant_id, schedule_id])
}

// NUEVA TABLA - Solicitudes de Cambio de Turno
model shift_change_requests {
  id                String    @id @db.Uuid
  tenant_id         String    @db.Uuid
  requester_id      String    @db.Uuid
  target_employee_id String?  @db.Uuid // Empleado con quien quiere cambiar
  original_date     DateTime  @db.Date
  new_date          DateTime? @db.Date
  reason            String
  status            String    @default("PENDING") // PENDING, APPROVED, REJECTED
  approved_by       String?   @db.Uuid
  approved_at       DateTime? @db.Timestamptz(6)
  rejection_reason  String?
  created_at        DateTime  @default(now()) @db.Timestamptz(6)
  
  @@index([tenant_id, requester_id, status])
  @@index([tenant_id, status, created_at(sort: Desc)])
}

// NUEVA TABLA - Solicitudes de Vacaciones/Permisos
model leave_requests {
  id              String    @id @db.Uuid
  tenant_id       String    @db.Uuid
  employee_id     String    @db.Uuid
  leave_type      String    // VACATION, SICK_LEAVE, PERSONAL_LEAVE, MATERNITY, PATERNITY
  start_date      DateTime  @db.Date
  end_date        DateTime  @db.Date
  days_requested  Int
  reason          String?
  with_pay        Boolean   @default(true)
  status          String    @default("PENDING") // PENDING, APPROVED, REJECTED, CANCELLED
  approved_by     String?   @db.Uuid
  approved_at     DateTime? @db.Timestamptz(6)
  rejection_reason String?
  certificate_url String?   // URL del certificado médico (si aplica)
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  updated_at      DateTime  @default(now()) @db.Timestamptz(6)
  
  employee        employees @relation(fields: [employee_id], references: [id])
  
  @@index([tenant_id, employee_id, status])
  @@index([tenant_id, status, start_date])
}

// NUEVA TABLA - Adelantos de Sueldo
model advances {
  id              String    @id @db.Uuid
  tenant_id       String    @db.Uuid
  employee_id     String    @db.Uuid
  amount_cents    Int       // Monto solicitado en centavos
  reason          String
  status          String    @default("PENDING") // PENDING, APPROVED, REJECTED, PAID
  approved_by     String?   @db.Uuid
  approved_at     DateTime? @db.Timestamptz(6)
  paid_at         DateTime? @db.Timestamptz(6)
  deducted_from_payroll String? @db.Uuid // ID del payroll_record donde se descontó
  rejection_reason String?
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  
  employee        employees @relation(fields: [employee_id], references: [id])
  
  @@index([tenant_id, employee_id, status])
  @@index([tenant_id, status, created_at(sort: Desc)])
}

// NUEVA TABLA - Evaluaciones de Desempeño
model evaluations {
  id              String    @id @db.Uuid
  tenant_id       String    @db.Uuid
  employee_id     String    @db.Uuid
  evaluator_id    String    @db.Uuid
  period_start    DateTime  @db.Date
  period_end      DateTime  @db.Date
  scores          Json      // {punctuality: 4, quality: 5, attitude: 4, sales: 5}
  automatic_metrics Json    // {total_sales: 50000, avg_tips: 1500, attendance_rate: 0.95}
  comments        String?
  employee_comments String?
  goals           Json?     // [{goal: "Aumentar ventas 10%", progress: 0.8}]
  status          String    @default("DRAFT") // DRAFT, COMPLETED, REVIEWED
  completed_at    DateTime? @db.Timestamptz(6)
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  
  employee        employees @relation(fields: [employee_id], references: [id])
  
  @@index([tenant_id, employee_id, period_end(sort: Desc)])
  @@index([tenant_id, status])
}

// NUEVA TABLA - Capacitaciones
model training_records {
  id              String    @id @db.Uuid
  tenant_id       String    @db.Uuid
  employee_id     String    @db.Uuid
  training_name   String
  training_type   String    // MANDATORY, OPTIONAL, CERTIFICATION
  provider        String?
  duration_hours  Int?
  completion_date DateTime  @db.Date
  certificate_url String?
  score           Int?      // Calificación (0-100)
  notes           String?
  assigned_by     String?   @db.Uuid
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  
  employee        employees @relation(fields: [employee_id], references: [id])
  
  @@index([tenant_id, employee_id, completion_date(sort: Desc)])
  @@index([tenant_id, training_type])
}

// NUEVA TABLA - Registros de Planilla
model payroll_records {
  id                      String   @id @db.Uuid
  tenant_id               String   @db.Uuid
  employee_id             String   @db.Uuid
  period_month            String   // "2026-01"
  business_date_start     DateTime @db.Date
  business_date_end       DateTime @db.Date
  
  // Componentes del salario
  base_salary_cents       Int
  commission_cents        Int      @default(0)
  tips_cents              Int      @default(0)
  overtime_cents          Int      @default(0)
  bonuses_cents           Int      @default(0)
  
  // Deducciones
  advances_cents          Int      @default(0)
  absences_cents          Int      @default(0)
  other_deductions_cents  Int      @default(0)
  
  // Aportes legales
  essalud_cents           Int      // 9% del bruto
  pension_cents           Int      // ONP 13% o AFP ~13%
  
  // Totales
  gross_salary_cents      Int      // Bruto antes de descuentos
  net_salary_cents        Int      // Neto a pagar
  
  // Metadata
  days_worked             Int
  hours_worked            Int
  overtime_hours          Int
  absences_count          Int
  
  // Archivos
  payslip_url             String?  // URL del PDF de boleta
  
  // Auditoría
  calculated_by           String   @db.Uuid
  calculated_at           DateTime @default(now()) @db.Timestamptz(6)
  paid_at                 DateTime? @db.Timestamptz(6)
  
  employee                employees @relation(fields: [employee_id], references: [id])
  
  @@unique([tenant_id, employee_id, period_month])
  @@index([tenant_id, period_month])
  @@index([tenant_id, employee_id, period_month(sort: Desc)])
}
```


### Event Schemas

```typescript
// Nuevos eventos para RRHH
export const HREventSchema = z.discriminatedUnion("event_type", [
  // EMPLOYEE events
  BaseEnvelopeSchema.extend({
    event_type: z.literal("EMPLOYEE_CREATED"),
    aggregate_type: z.literal("EMPLOYEE"),
    payload: z.object({
      employee_id: uuidSchema,
      name: z.string(),
      dni: z.string().optional(),
      role: z.enum(["CASHIER", "WAITER", "COOK", "SUPERVISOR", "ADMIN"]),
      hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      base_salary_cents: positiveCentsSchema,
      contract_type: z.string(),
      location_id: uuidSchema.optional(),
    }),
  }),
  
  BaseEnvelopeSchema.extend({
    event_type: z.literal("EMPLOYEE_PROFILE_UPDATED"),
    aggregate_type: z.literal("EMPLOYEE"),
    payload: z.object({
      employee_id: uuidSchema,
      changes: z.record(z.unknown()),
      updated_by: uuidSchema,
    }),
  }),
  
  BaseEnvelopeSchema.extend({
    event_type: z.literal("EMPLOYEE_DEACTIVATED"),
    aggregate_type: z.literal("EMPLOYEE"),
    payload: z.object({
      employee_id: uuidSchema,
      reason: z.string(),
      deactivated_by: uuidSchema,
    }),
  }),
  
  // ATTENDANCE events
  BaseEnvelopeSchema.extend({
    event_type: z.literal("ATTENDANCE_CLOCKED_IN"),
    aggregate_type: z.literal("ATTENDANCE"),
    payload: z.object({
      attendance_id: uuidSchema,
      employee_id: uuidSchema,
      clock_in: isoDateSchema,
      scheduled_start: isoDateSchema.optional(),
      late_minutes: z.number().int().nonnegative(),
    }),
  }),
  
  BaseEnvelopeSchema.extend({
    event_type: z.literal("ATTENDANCE_CLOCKED_OUT"),
    aggregate_type: z.literal("ATTENDANCE"),
    payload: z.object({
      attendance_id: uuidSchema,
      employee_id: uuidSchema,
      clock_out: isoDateSchema,
      worked_minutes: z.number().int().nonnegative(),
      overtime_minutes: z.number().int().nonnegative(),
    }),
  }),
  
  BaseEnvelopeSchema.extend({
    event_type: z.literal("ATTENDANCE_ABSENCE_DETECTED"),
    aggregate_type: z.literal("ATTENDANCE"),
    payload: z.object({
      attendance_id: uuidSchema,
      employee_id: uuidSchema,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      scheduled_start: isoDateSchema,
    }),
  }),
  
  BaseEnvelopeSchema.extend({
    event_type: z.literal("ATTENDANCE_JUSTIFIED"),
    aggregate_type: z.literal("ATTENDANCE"),
    payload: z.object({
      attendance_id: uuidSchema,
      employee_id: uuidSchema,
      justification: z.string(),
      certificate_url: z.string().optional(),
    }),
  }),
  
  // LEAVE REQUEST events
  BaseEnvelopeSchema.extend({
    event_type: z.literal("LEAVE_REQUEST_CREATED"),
    aggregate_type: z.literal("LEAVE_REQUEST"),
    payload: z.object({
      request_id: uuidSchema,
      employee_id: uuidSchema,
      leave_type: z.string(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      days_requested: z.number().int().positive(),
    }),
  }),
  
  BaseEnvelopeSchema.extend({
    event_type: z.literal("LEAVE_REQUEST_APPROVED"),
    aggregate_type: z.literal("LEAVE_REQUEST"),
    payload: z.object({
      request_id: uuidSchema,
      employee_id: uuidSchema,
      approved_by: uuidSchema,
      days_deducted: z.number().int().positive(),
    }),
  }),
  
  BaseEnvelopeSchema.extend({
    event_type: z.literal("LEAVE_REQUEST_REJECTED"),
    aggregate_type: z.literal("LEAVE_REQUEST"),
    payload: z.object({
      request_id: uuidSchema,
      employee_id: uuidSchema,
      rejected_by: uuidSchema,
      reason: z.string(),
    }),
  }),
  
  // ADVANCE events
  BaseEnvelopeSchema.extend({
    event_type: z.literal("ADVANCE_REQUESTED"),
    aggregate_type: z.literal("ADVANCE"),
    payload: z.object({
      advance_id: uuidSchema,
      employee_id: uuidSchema,
      amount_cents: positiveCentsSchema,
      reason: z.string(),
    }),
  }),
  
  BaseEnvelopeSchema.extend({
    event_type: z.literal("ADVANCE_APPROVED"),
    aggregate_type: z.literal("ADVANCE"),
    payload: z.object({
      advance_id: uuidSchema,
      employee_id: uuidSchema,
      approved_by: uuidSchema,
      amount_cents: positiveCentsSchema,
    }),
  }),
  
  // PAYROLL events
  BaseEnvelopeSchema.extend({
    event_type: z.literal("PAYROLL_CALCULATED"),
    aggregate_type: z.literal("PAYROLL"),
    payload: z.object({
      payroll_id: uuidSchema,
      employee_id: uuidSchema,
      period_month: z.string(),
      gross_salary_cents: positiveCentsSchema,
      net_salary_cents: positiveCentsSchema,
      components: z.object({
        base_salary_cents: positiveCentsSchema,
        commission_cents: positiveCentsSchema,
        tips_cents: positiveCentsSchema,
        overtime_cents: positiveCentsSchema,
        advances_cents: positiveCentsSchema,
        essalud_cents: positiveCentsSchema,
        pension_cents: positiveCentsSchema,
      }),
    }),
  }),
  
  // EVALUATION events
  BaseEnvelopeSchema.extend({
    event_type: z.literal("EVALUATION_CREATED"),
    aggregate_type: z.literal("EVALUATION"),
    payload: z.object({
      evaluation_id: uuidSchema,
      employee_id: uuidSchema,
      evaluator_id: uuidSchema,
      period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  }),
  
  // TRAINING events
  BaseEnvelopeSchema.extend({
    event_type: z.literal("TRAINING_COMPLETED"),
    aggregate_type: z.literal("TRAINING"),
    payload: z.object({
      training_id: uuidSchema,
      employee_id: uuidSchema,
      training_name: z.string(),
      completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      certificate_url: z.string().optional(),
    }),
  }),
]);
```


## Correctness Properties

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas del sistema - esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables por máquina.*

### Property 1: Perfil completo se almacena correctamente

*Para cualquier* empleado creado, todos los campos requeridos (información personal y laboral) deben almacenarse correctamente y ser recuperables.

**Validates: Requirements 1.1, 1.2**

### Property 2: Archivos se almacenan con tenant isolation

*Para cualquier* archivo subido (foto de perfil, documento, certificado), la ruta en Supabase Storage debe incluir el tenant_id para garantizar aislamiento multi-tenant.

**Validates: Requirements 1.3, 1.5, 8.4**

### Property 3: Validación de contacto de emergencia

*Para cualquier* contacto de emergencia, si falta algún campo requerido (nombre, relación, teléfono, dirección), la creación debe ser rechazada.

**Validates: Requirements 1.4**

### Property 4: Audit trail completo

*Para cualquier* cambio en el perfil de un empleado, debe existir un evento correspondiente en la tabla events con el actor_id y timestamp.

**Validates: Requirements 1.6**

### Property 5: Soft delete preserva datos

*Para cualquier* empleado desactivado, is_active debe ser false pero todos los datos históricos deben permanecer intactos.

**Validates: Requirements 1.7**

### Property 6: Detección de conflictos de horarios

*Para cualquier* asignación de horario a un empleado, si existe otro horario activo que se solape en días y horas, la asignación debe ser rechazada.

**Validates: Requirements 2.2**

### Property 7: Flujo de solicitud de cambio de turno

*Para cualquier* solicitud de cambio de turno, después de crearla debe existir una solicitud con status PENDING y debe notificarse al supervisor.

**Validates: Requirements 2.3, 2.4**

### Property 8: Generación de horarios rotativos

*Para cualquier* patrón rotativo definido, aplicarlo durante N semanas debe generar exactamente N horarios por empleado siguiendo el patrón.

**Validates: Requirements 2.6**

### Property 9: Notificaciones programadas de turnos

*Para cualquier* turno programado, debe existir una notificación programada para 2 horas antes del inicio.

**Validates: Requirements 2.7**

### Property 10: Registro de asistencia con timestamp

*Para cualquier* marcación de entrada, el sistema debe registrar el timestamp exacto y calcular tardanza comparando con el horario programado.

**Validates: Requirements 3.1**

### Property 11: Cálculo de horas trabajadas y extras

*Para cualquier* par de marcaciones (entrada/salida), las horas trabajadas deben ser (salida - entrada - breaks), y las horas extras deben ser max(0, horas_trabajadas - horas_programadas).

**Validates: Requirements 3.2**

### Property 12: Detección de tardanzas

*Para cualquier* marcación de entrada después del horario programado, late_minutes debe ser igual a la diferencia en minutos.

**Validates: Requirements 3.3**

### Property 13: Justificación actualiza registro

*Para cualquier* ausencia justificada, el registro de asistencia debe actualizarse con la justificación y el status debe cambiar a JUSTIFIED.

**Validates: Requirements 3.5**

### Property 14: Cálculo automático de métricas de asistencia

*Para cualquier* empleado, el sistema debe calcular automáticamente: horas trabajadas, horas extras, tardanzas, ausencias y breaks desde los registros de asistencia.

**Validates: Requirements 3.6**

### Property 15: Corrección con audit trail

*Para cualquier* corrección manual de asistencia, debe existir un evento de auditoría con el actor_id del supervisor que aprobó.

**Validates: Requirements 3.7**

### Property 16: Cálculo de salario base

*Para cualquier* empleado, el salario base del mes debe ser (base_salary_cents * días_trabajados / días_laborables_del_mes).

**Validates: Requirements 4.1**

### Property 17: Cálculo de comisiones

*Para cualquier* empleado con commission_rate > 0, las comisiones del mes deben ser (suma_ventas_del_mes * commission_rate / 100).

**Validates: Requirements 4.2**

### Property 18: Suma de propinas

*Para cualquier* empleado, las propinas del mes deben ser la suma de todos los registros en la tabla tips para ese empleado en el período.

**Validates: Requirements 4.3**

### Property 19: Descuento de adelantos

*Para cualquier* planilla calculada, el total de adelantos descontados debe ser igual a la suma de todos los adelantos aprobados y no pagados del empleado.

**Validates: Requirements 4.4, 6.5**

### Property 20: Descuento por faltas

*Para cualquier* falta injustificada, el descuento debe ser (base_salary_cents / días_laborables_del_mes).

**Validates: Requirements 4.5**

### Property 21: Cálculo de horas extras con recargos

*Para cualquier* hora extra trabajada, las primeras 2 horas deben tener recargo del 25% y las adicionales del 35%.

**Validates: Requirements 4.6, 13.4**

### Property 22: Boleta de pago contiene todos los conceptos

*Para cualquier* boleta de pago generada, debe incluir: salario base, comisiones, propinas, horas extras, adelantos, descuentos, aportes legales y neto a pagar.

**Validates: Requirements 4.7**

### Property 23: Cálculo de aportes legales

*Para cualquier* salario bruto, EsSalud debe ser 9% y ONP debe ser 13% (o AFP según corresponda).

**Validates: Requirements 4.8, 13.7**

### Property 24: Validación de saldo de vacaciones

*Para cualquier* solicitud de vacaciones, si días_solicitados > saldo_disponible, la solicitud debe ser rechazada.

**Validates: Requirements 5.1**

### Property 25: Solicitud crea registro pendiente

*Para cualquier* solicitud de vacaciones válida, debe crearse un registro con status PENDING.

**Validates: Requirements 5.2**

### Property 26: Aprobación descuenta saldo

*Para cualquier* solicitud de vacaciones aprobada, el saldo de vacaciones del empleado debe disminuir en días_solicitados.

**Validates: Requirements 5.4**

### Property 27: Rechazo notifica con motivo

*Para cualquier* solicitud rechazada, debe crearse una notificación para el empleado que incluya el motivo del rechazo.

**Validates: Requirements 5.5**

### Property 28: Cálculo de vacaciones acumuladas

*Para cualquier* empleado, los días de vacaciones acumulados deben ser (años_trabajados * 30).

**Validates: Requirements 5.6, 13.3**

### Property 29: Permiso médico permite adjuntar certificado

*Para cualquier* solicitud de permiso médico, debe permitir almacenar un certificate_url.

**Validates: Requirements 5.7**

### Property 30: Diferenciación de permisos con/sin goce

*Para cualquier* permiso, el campo with_pay debe determinar si afecta el cálculo de planilla.

**Validates: Requirements 5.8**

### Property 31: Validación de límite de adelanto

*Para cualquier* solicitud de adelanto, si amount_cents > (base_salary_cents * 0.4), la solicitud debe ser rechazada.

**Validates: Requirements 6.1**

### Property 32: Validación de adelantos pendientes

*Para cualquier* solicitud de adelanto, si existe otro adelanto con status APPROVED y no pagado, la solicitud debe ser rechazada.

**Validates: Requirements 6.2**

### Property 33: Aprobación registra para descuento

*Para cualquier* adelanto aprobado, debe aparecer en la lista de descuentos de la próxima planilla.

**Validates: Requirements 6.3**

### Property 34: Cálculo de monto disponible

*Para cualquier* empleado, el monto disponible para adelanto debe ser ((base_salary_cents * días_trabajados / días_del_mes) * 0.4) - adelantos_pendientes.

**Validates: Requirements 6.4**

### Property 35: Historial de adelantos

*Para cualquier* adelanto creado, debe existir un evento ADVANCE_REQUESTED en la tabla events.

**Validates: Requirements 6.6**

### Property 36: Evaluación almacena todos los criterios

*Para cualquier* evaluación creada, debe almacenar scores para todos los criterios definidos (puntualidad, calidad, actitud, ventas).

**Validates: Requirements 7.1**

### Property 37: Métricas automáticas se calculan

*Para cualquier* evaluación, automatic_metrics debe incluir: total_sales, avg_tips y attendance_rate calculados desde los datos históricos.

**Validates: Requirements 7.2**

### Property 38: Evaluación completa notifica

*Para cualquier* evaluación con status COMPLETED, debe existir una notificación para el empleado.

**Validates: Requirements 7.3**

### Property 39: Empleado puede comentar

*Para cualquier* evaluación, el campo employee_comments debe permitir que el empleado agregue sus comentarios.

**Validates: Requirements 7.4**

### Property 40: Reporte de desempeño contiene datos correctos

*Para cualquier* reporte de desempeño generado, debe incluir todas las evaluaciones del período y las métricas calculadas.

**Validates: Requirements 7.5**

### Property 41: Tracking de objetivos

*Para cualquier* objetivo definido, el progreso debe actualizarse automáticamente cuando hay cambios en las métricas relevantes.

**Validates: Requirements 7.6**

### Property 42: Capacitación registra todos los campos

*Para cualquier* capacitación completada, debe almacenar: training_name, completion_date, duration_hours y certificate_url (opcional).

**Validates: Requirements 8.1**

### Property 43: Asignación automática de capacitaciones

*Para cualquier* capacitación obligatoria creada, debe asignarse automáticamente a todos los empleados del rol correspondiente.

**Validates: Requirements 8.2**

### Property 44: Recordatorios de capacitaciones pendientes

*Para cualquier* capacitación asignada y no completada, debe existir una notificación programada de recordatorio.

**Validates: Requirements 8.3**

### Property 45: Reporte de capacitaciones contiene datos correctos

*Para cualquier* reporte de capacitaciones, debe incluir todas las capacitaciones completadas en el período filtrado.

**Validates: Requirements 8.5**

### Property 46: Dashboard calcula métricas correctamente

*Para cualquier* dashboard de RRHH, las métricas (empleados activos, asistencia del día, solicitudes pendientes) deben calcularse desde los datos actuales.

**Validates: Requirements 9.1**

### Property 47: Filtros funcionan correctamente

*Para cualquier* conjunto de filtros aplicados (rol, estado, ubicación, fecha), el resultado debe incluir solo empleados que cumplan TODOS los filtros.

**Validates: Requirements 9.2**

### Property 48: Búsqueda encuentra empleados correctos

*Para cualquier* query de búsqueda, debe retornar empleados cuyo nombre, DNI o código contenga el query (case-insensitive).

**Validates: Requirements 9.3**

### Property 49: Operaciones masivas se aplican a todos

*Para cualquier* operación masiva (activar, desactivar, cambiar rol), debe aplicarse a TODOS los empleados seleccionados.

**Validates: Requirements 9.4**

### Property 50: Exportación genera archivo correcto

*Para cualquier* exportación a Excel o PDF, el archivo debe contener todos los datos solicitados en el formato correcto.

**Validates: Requirements 9.6, 15.8**

### Property 51: Empleado puede leer su perfil

*Para cualquier* empleado autenticado, debe poder leer su propio perfil completo (información personal y contacto de emergencia).

**Validates: Requirements 10.2**

### Property 52: Empleado puede actualizar información personal

*Para cualquier* empleado autenticado, debe poder actualizar sus campos personales (teléfono, dirección, email) pero no campos laborales.

**Validates: Requirements 10.3**

### Property 53: Empleado ve sus propios turnos

*Para cualquier* empleado autenticado, el calendario de turnos debe mostrar solo sus propios turnos del mes.

**Validates: Requirements 10.4**

### Property 54: Empleado ve su historial de asistencia

*Para cualquier* empleado autenticado, debe poder ver su historial completo de asistencia con horas trabajadas.

**Validates: Requirements 10.5**

### Property 55: Empleado puede descargar boletas

*Para cualquier* empleado autenticado, debe poder descargar sus propias boletas de pago pero no las de otros empleados.

**Validates: Requirements 10.6**

### Property 56: Empleado ve saldo de vacaciones correcto

*Para cualquier* empleado autenticado, el saldo de vacaciones mostrado debe ser igual a (días_acumulados - días_tomados - días_solicitados_pendientes).

**Validates: Requirements 10.7**

### Property 57: Empleado puede solicitar vacaciones

*Para cualquier* empleado autenticado, debe poder crear solicitudes de vacaciones y permisos desde su panel.

**Validates: Requirements 10.8**

### Property 58: Todas las operaciones emiten eventos

*Para cualquier* operación de RRHH (crear empleado, marcar asistencia, aprobar solicitud, calcular planilla), debe emitirse el evento correspondiente.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

### Property 59: Eventos incluyen tenant_id

*Para cualquier* evento emitido, debe incluir el tenant_id para garantizar aislamiento multi-tenant.

**Validates: Requirements 11.6**

### Property 60: Event replay reconstruye estado

*Para cualquier* empleado, reproducir todos sus eventos en orden debe reconstruir su estado actual correctamente.

**Validates: Requirements 11.7**

### Property 61: Eventos offline se almacenan localmente

*Para cualquier* operación realizada sin conexión, el evento debe almacenarse en IndexedDB.

**Validates: Requirements 12.1**

### Property 62: Sincronización envía todos los eventos

*Para cualquier* reconexión después de estar offline, todos los eventos pendientes en IndexedDB deben enviarse al servidor.

**Validates: Requirements 12.2**

### Property 63: Lectura offline desde caché

*Para cualquier* consulta de datos sin conexión, los datos deben leerse desde IndexedDB.

**Validates: Requirements 12.3**

### Property 64: Solicitudes offline se sincronizan

*Para cualquier* solicitud creada offline, debe almacenarse localmente y sincronizarse cuando hay conexión.

**Validates: Requirements 12.4**

### Property 65: Resolución de conflictos

*Para cualquier* conflicto de sincronización, debe aplicarse la regla de conflict resolution existente (last-write-wins o merge).

**Validates: Requirements 12.5**

### Property 66: Cálculo de CTS

*Para cualquier* empleado, el CTS semestral debe ser ((salario_bruto + 1/6_gratificación) / 12) * meses_trabajados.

**Validates: Requirements 13.1**

### Property 67: Cálculo de gratificaciones

*Para cualquier* empleado, las gratificaciones de Julio y Diciembre deben ser salario_bruto + bonificación_extraordinaria (9% del salario).

**Validates: Requirements 13.2**

### Property 68: Validación de salario mínimo

*Para cualquier* empleado, si base_salary_cents < salario_mínimo_legal, la creación/actualización debe ser rechazada.

**Validates: Requirements 13.6**

### Property 69: Reporte PLAME tiene formato correcto

*Para cualquier* reporte PLAME generado, debe seguir el formato oficial de SUNAT con todos los campos requeridos.

**Validates: Requirements 13.5**

### Property 70: Notificación de aprobación

*Para cualquier* solicitud aprobada, debe enviarse una notificación push al empleado.

**Validates: Requirements 14.1**

### Property 71: Notificación a supervisor

*Para cualquier* solicitud pendiente, debe enviarse una notificación al supervisor correspondiente.

**Validates: Requirements 14.3**

### Property 72: Notificación de boleta con link

*Para cualquier* boleta generada, debe enviarse una notificación al empleado con el link de descarga.

**Validates: Requirements 14.4**

### Property 73: Notificación de cumpleaños

*Para cualquier* empleado que cumple años, debe enviarse una notificación al administrador en la fecha correcta.

**Validates: Requirements 14.5**

### Property 74: Preferencias de notificaciones

*Para cualquier* empleado, las preferencias de notificaciones deben almacenarse y respetarse al enviar notificaciones.

**Validates: Requirements 14.6**

### Property 75: Reportes contienen datos correctos

*Para cualquier* reporte generado (asistencia, planilla, vacaciones, desempeño, rotación, costos), debe incluir todos los datos del período filtrado calculados correctamente.

**Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7**

### Property 76: Gráficos de tendencias

*Para cualquier* gráfico de tendencias generado, los datos deben corresponder a las métricas históricas del período seleccionado.

**Validates: Requirements 15.9**


## Error Handling

### Validation Errors

```typescript
// Errores de validación de input
export class ValidationError extends Error {
  constructor(
    public field: string,
    public message: string,
    public code: string
  ) {
    super(`Validation error on ${field}: ${message}`);
  }
}

// Ejemplos:
// - DNI inválido
// - Salario menor al mínimo legal
// - Fechas de vacaciones inválidas
// - Monto de adelanto excede el 40%
```

### Business Logic Errors

```typescript
// Errores de lógica de negocio
export class BusinessLogicError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

// Ejemplos:
// - INSUFFICIENT_VACATION_BALANCE
// - SCHEDULE_CONFLICT
// - PENDING_ADVANCE_EXISTS
// - EMPLOYEE_NOT_ACTIVE
```

### Authentication Errors

```typescript
// Errores de autenticación
export class AuthenticationError extends Error {
  constructor(
    public code: string,
    public message: string
  ) {
    super(message);
  }
}

// Ejemplos:
// - INVALID_PIN
// - EMPLOYEE_NOT_FOUND
// - PIN_LOCKED (después de 3 intentos fallidos)
```

### Offline Errors

```typescript
// Errores de operación offline
export class OfflineError extends Error {
  constructor(
    public operation: string,
    public message: string
  ) {
    super(`Offline error in ${operation}: ${message}`);
  }
}

// Ejemplos:
// - SYNC_FAILED
// - INDEXEDDB_FULL
// - CONFLICT_RESOLUTION_FAILED
```

### Error Recovery Strategies

1. **Validation Errors**: Retornar 400 con mensaje descriptivo
2. **Business Logic Errors**: Retornar 422 con código de error y detalles
3. **Authentication Errors**: Retornar 401 o 403 según corresponda
4. **Offline Errors**: Almacenar en IndexedDB y reintentar en próxima sincronización
5. **Database Errors**: Retornar 500 y loggear para investigación
6. **File Upload Errors**: Reintentar hasta 3 veces, luego fallar con mensaje

## Testing Strategy

### Dual Testing Approach

El sistema utilizará dos tipos de tests complementarios:

1. **Unit Tests**: Para casos específicos, edge cases y condiciones de error
2. **Property-Based Tests**: Para verificar propiedades universales con datos aleatorios

Ambos tipos son necesarios para cobertura completa. Los unit tests capturan bugs concretos, mientras que los property tests verifican corrección general.

### Property-Based Testing Configuration

- **Librería**: fast-check (para TypeScript/JavaScript)
- **Iteraciones mínimas**: 100 por property test
- **Tag format**: `Feature: employee-management-system, Property {number}: {property_text}`
- **Cada correctness property** debe implementarse como UN SOLO property-based test

### Unit Testing Focus

Los unit tests deben enfocarse en:

- **Ejemplos específicos**: Casos de uso reales documentados
- **Edge cases**: Valores límite (salario mínimo, 40% de adelanto, etc.)
- **Error conditions**: Validaciones que deben fallar
- **Integration points**: Interacción entre servicios

### Property Testing Focus

Los property tests deben enfocarse en:

- **Invariantes**: Propiedades que siempre se mantienen
- **Round trips**: Operaciones que deben ser reversibles
- **Cálculos**: Fórmulas matemáticas (salarios, horas, aportes)
- **Event sourcing**: Replay de eventos reconstruye estado

### Test Organization

```
tests/
├── unit/
│   ├── services/
│   │   ├── employee.service.test.ts
│   │   ├── attendance.service.test.ts
│   │   ├── payroll.service.test.ts
│   │   └── ...
│   ├── reducers/
│   │   ├── employee.reducer.test.ts
│   │   ├── attendance.reducer.test.ts
│   │   └── ...
│   └── utils/
│       ├── payroll-calculations.test.ts
│       └── legal-calculations.test.ts
├── property/
│   ├── employee-properties.test.ts
│   ├── attendance-properties.test.ts
│   ├── payroll-properties.test.ts
│   ├── leave-request-properties.test.ts
│   └── ...
└── integration/
    ├── employee-lifecycle.test.ts
    ├── payroll-end-to-end.test.ts
    └── offline-sync.test.ts
```

### Example Property Test

```typescript
import fc from 'fast-check';

// Feature: employee-management-system, Property 16: Cálculo de salario base
describe('Payroll Calculations', () => {
  it('should calculate base salary proportionally to days worked', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100000, max: 1000000 }), // base_salary_cents
        fc.integer({ min: 1, max: 30 }), // days_worked
        fc.integer({ min: 20, max: 31 }), // working_days_in_month
        (baseSalary, daysWorked, workingDays) => {
          const calculated = calculateBaseSalary(baseSalary, daysWorked, workingDays);
          const expected = Math.floor((baseSalary * daysWorked) / workingDays);
          
          expect(calculated).toBe(expected);
          expect(calculated).toBeLessThanOrEqual(baseSalary);
          expect(calculated).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Example Unit Test

```typescript
describe('EmployeeService', () => {
  it('should reject employee with salary below minimum wage', async () => {
    const service = new EmployeeService();
    const MINIMUM_WAGE = 102500; // S/1,025.00 en centavos
    
    await expect(
      service.create({
        name: 'Juan Pérez',
        role: 'WAITER',
        base_salary_cents: 100000, // Menor al mínimo
        hire_date: '2026-01-01',
        contract_type: 'INDEFINIDO',
      })
    ).rejects.toThrow('Salary below minimum wage');
  });
});
```

### Integration Testing

Los integration tests deben verificar:

1. **Flujo completo de empleado**: Crear → Asignar horario → Marcar asistencia → Calcular planilla
2. **Flujo de vacaciones**: Solicitar → Aprobar → Descontar saldo → Verificar en calendario
3. **Flujo de adelantos**: Solicitar → Aprobar → Descontar en planilla → Verificar historial
4. **Sincronización offline**: Crear eventos offline → Reconectar → Verificar sincronización

### Performance Testing

Verificar que el sistema maneja:

- 1000+ empleados activos
- 10,000+ registros de asistencia por mes
- Cálculo de planilla para 1000 empleados en < 30 segundos
- Sincronización de 1000 eventos offline en < 10 segundos

## API Endpoints

### Employee Management

```
POST   /api/hr/employees                    - Crear empleado
GET    /api/hr/employees                    - Listar empleados (con filtros)
GET    /api/hr/employees/:id                - Obtener empleado por ID
PATCH  /api/hr/employees/:id                - Actualizar empleado
DELETE /api/hr/employees/:id                - Desactivar empleado
POST   /api/hr/employees/:id/photo          - Subir foto de perfil
POST   /api/hr/employees/:id/documents      - Subir documento
POST   /api/hr/employees/:id/emergency-contact - Agregar contacto de emergencia
POST   /api/hr/employees/bulk/activate      - Activar múltiples empleados
POST   /api/hr/employees/bulk/deactivate    - Desactivar múltiples empleados
GET    /api/hr/employees/search             - Buscar empleados
GET    /api/hr/employees/export             - Exportar a Excel
```

### Attendance

```
POST   /api/hr/attendance/clock-in          - Marcar entrada
POST   /api/hr/attendance/clock-out         - Marcar salida
GET    /api/hr/attendance                   - Listar asistencias (con filtros)
GET    /api/hr/attendance/:id               - Obtener asistencia por ID
POST   /api/hr/attendance/:id/justify       - Justificar ausencia
PATCH  /api/hr/attendance/:id/correct       - Corregir asistencia
GET    /api/hr/attendance/report            - Reporte de asistencia
```

### Schedules

```
POST   /api/hr/schedules                    - Crear horario
GET    /api/hr/schedules                    - Listar horarios
GET    /api/hr/schedules/:id                - Obtener horario por ID
PATCH  /api/hr/schedules/:id                - Actualizar horario
DELETE /api/hr/schedules/:id                - Eliminar horario
POST   /api/hr/schedules/:id/assign         - Asignar a empleado
GET    /api/hr/schedules/calendar/weekly    - Calendario semanal
GET    /api/hr/schedules/calendar/monthly   - Calendario mensual
POST   /api/hr/schedules/shift-change       - Solicitar cambio de turno
POST   /api/hr/schedules/shift-change/:id/approve - Aprobar cambio
POST   /api/hr/schedules/shift-change/:id/reject  - Rechazar cambio
```

### Payroll

```
POST   /api/hr/payroll/calculate            - Calcular planilla mensual
GET    /api/hr/payroll                      - Listar planillas
GET    /api/hr/payroll/:id                  - Obtener planilla por ID
GET    /api/hr/payroll/:id/payslip          - Descargar boleta PDF
GET    /api/hr/payroll/export               - Exportar a Excel
GET    /api/hr/payroll/plame                - Generar reporte PLAME
```

### Leave Requests

```
POST   /api/hr/leave-requests               - Crear solicitud
GET    /api/hr/leave-requests               - Listar solicitudes
GET    /api/hr/leave-requests/:id           - Obtener solicitud por ID
POST   /api/hr/leave-requests/:id/approve   - Aprobar solicitud
POST   /api/hr/leave-requests/:id/reject    - Rechazar solicitud
DELETE /api/hr/leave-requests/:id           - Cancelar solicitud
GET    /api/hr/leave-requests/balance       - Obtener saldo de vacaciones
POST   /api/hr/leave-requests/:id/certificate - Subir certificado médico
```

### Advances

```
POST   /api/hr/advances                     - Solicitar adelanto
GET    /api/hr/advances                     - Listar adelantos
GET    /api/hr/advances/:id                 - Obtener adelanto por ID
POST   /api/hr/advances/:id/approve         - Aprobar adelanto
POST   /api/hr/advances/:id/reject          - Rechazar adelanto
GET    /api/hr/advances/available           - Calcular monto disponible
```

### Evaluations

```
POST   /api/hr/evaluations                  - Crear evaluación
GET    /api/hr/evaluations                  - Listar evaluaciones
GET    /api/hr/evaluations/:id              - Obtener evaluación por ID
PATCH  /api/hr/evaluations/:id              - Actualizar evaluación
POST   /api/hr/evaluations/:id/complete     - Completar evaluación
POST   /api/hr/evaluations/:id/comment      - Agregar comentario de empleado
GET    /api/hr/evaluations/:id/report       - Generar reporte de desempeño
```

### Training

```
POST   /api/hr/training                     - Registrar capacitación
GET    /api/hr/training                     - Listar capacitaciones
GET    /api/hr/training/:id                 - Obtener capacitación por ID
POST   /api/hr/training/:id/certificate     - Subir certificado
POST   /api/hr/training/mandatory           - Crear capacitación obligatoria
GET    /api/hr/training/report              - Reporte de capacitaciones
```

### Reports

```
GET    /api/hr/reports/attendance           - Reporte de asistencia
GET    /api/hr/reports/hours-worked         - Reporte de horas trabajadas
GET    /api/hr/reports/payroll              - Reporte de planilla
GET    /api/hr/reports/vacations            - Reporte de vacaciones
GET    /api/hr/reports/performance          - Reporte de desempeño
GET    /api/hr/reports/turnover             - Reporte de rotación
GET    /api/hr/reports/labor-cost           - Reporte de costo laboral
GET    /api/hr/reports/trends               - Gráficos de tendencias
```

### Self-Service (Employee Panel)

```
GET    /api/hr/me                           - Mi perfil
PATCH  /api/hr/me                           - Actualizar mi información
GET    /api/hr/me/schedule                  - Mi calendario de turnos
GET    /api/hr/me/attendance                - Mi historial de asistencia
GET    /api/hr/me/payslips                  - Mis boletas de pago
GET    /api/hr/me/vacation-balance          - Mi saldo de vacaciones
POST   /api/hr/me/leave-requests            - Solicitar vacaciones
GET    /api/hr/me/leave-requests            - Mis solicitudes
GET    /api/hr/me/advances                  - Mis adelantos
GET    /api/hr/me/evaluations               - Mis evaluaciones
GET    /api/hr/me/training                  - Mis capacitaciones
```

## UI Components

### Admin Panel - Dashboard RRHH

```typescript
// Componente principal del dashboard
<HRDashboard>
  <MetricsCards>
    <MetricCard title="Empleados Activos" value={activeCount} />
    <MetricCard title="Asistencia Hoy" value={attendanceRate} />
    <MetricCard title="Solicitudes Pendientes" value={pendingRequests} />
    <MetricCard title="Planilla del Mes" value={payrollTotal} />
  </MetricsCards>
  
  <QuickActions>
    <Button onClick={createEmployee}>Nuevo Empleado</Button>
    <Button onClick={calculatePayroll}>Calcular Planilla</Button>
    <Button onClick={viewReports}>Ver Reportes</Button>
  </QuickActions>
  
  <RecentActivity>
    {/* Lista de actividad reciente */}
  </RecentActivity>
</HRDashboard>
```

### Admin Panel - Gestión de Empleados

```typescript
<EmployeeManagement>
  <Filters>
    <Select name="role" options={roles} />
    <Select name="status" options={statuses} />
    <Select name="location" options={locations} />
    <DatePicker name="hireDate" />
  </Filters>
  
  <SearchBar onSearch={handleSearch} />
  
  <EmployeeTable>
    <Column field="name" sortable />
    <Column field="dni" />
    <Column field="role" />
    <Column field="location" />
    <Column field="hireDate" sortable />
    <Column field="status" />
    <Column field="actions" />
  </EmployeeTable>
  
  <BulkActions>
    <Button onClick={bulkActivate}>Activar</Button>
    <Button onClick={bulkDeactivate}>Desactivar</Button>
    <Button onClick={bulkChangeRole}>Cambiar Rol</Button>
    <Button onClick={exportToExcel}>Exportar</Button>
  </BulkActions>
</EmployeeManagement>
```

### Employee Self-Service Panel

```typescript
<EmployeeDashboard>
  <ProfileCard employee={currentEmployee} />
  
  <Tabs>
    <Tab label="Mi Información">
      <ProfileForm employee={currentEmployee} onUpdate={handleUpdate} />
    </Tab>
    
    <Tab label="Mis Turnos">
      <ScheduleCalendar employeeId={currentEmployee.id} />
    </Tab>
    
    <Tab label="Mi Asistencia">
      <AttendanceHistory employeeId={currentEmployee.id} />
    </Tab>
    
    <Tab label="Mis Boletas">
      <PayslipList employeeId={currentEmployee.id} />
    </Tab>
    
    <Tab label="Vacaciones">
      <VacationBalance balance={vacationBalance} />
      <LeaveRequestForm onSubmit={handleLeaveRequest} />
      <LeaveRequestList employeeId={currentEmployee.id} />
    </Tab>
  </Tabs>
</EmployeeDashboard>
```

## Implementation Notes

### Legislación Peruana

El sistema debe cumplir con:

1. **Salario Mínimo**: S/1,025.00 (2026) = 102,500 centavos
2. **Vacaciones**: 30 días por año trabajado
3. **CTS**: Semestral (Mayo y Noviembre)
4. **Gratificaciones**: Julio y Diciembre (salario + 9% bonificación)
5. **Horas Extras**: 25% primeras 2 horas, 35% adicionales
6. **EsSalud**: 9% del salario bruto
7. **ONP**: 13% del salario bruto
8. **AFP**: ~13% según AFP elegida
9. **PLAME**: Formato oficial de SUNAT para declaración mensual

### Supabase Storage Structure

```
{tenant_id}/
├── employees/
│   ├── {employee_id}/
│   │   ├── profile-photo.jpg
│   │   └── documents/
│   │       ├── contract.pdf
│   │       ├── certificate.pdf
│   │       └── background-check.pdf
│   └── ...
├── payslips/
│   ├── {period_month}/
│   │   ├── {employee_id}.pdf
│   │   └── ...
│   └── ...
└── training/
    ├── {training_id}/
    │   ├── {employee_id}-certificate.pdf
    │   └── ...
    └── ...
```

### IndexedDB Schema (Offline Support)

```typescript
// Dexie schema para offline support
const db = new Dexie('park_pos_hr');

db.version(1).stores({
  hr_events: '++id, tenant_id, event_type, occurred_at, synced',
  employees_cache: 'id, tenant_id, is_active',
  schedules_cache: 'id, tenant_id, employee_id',
  attendance_cache: 'id, tenant_id, employee_id, date',
  leave_requests_cache: 'id, tenant_id, employee_id, status',
});
```

### Performance Optimizations

1. **Índices de Base de Datos**: Todos los queries frecuentes tienen índices
2. **Caché de Empleados**: Caché en memoria para empleados activos
3. **Lazy Loading**: Cargar documentos y certificados solo cuando se solicitan
4. **Pagination**: Todas las listas con paginación (50 items por página)
5. **Background Jobs**: Cálculo de planilla y generación de reportes en background
6. **Batch Operations**: Operaciones masivas en lotes de 100

### Security Considerations

1. **PIN Hashing**: SHA-256 con salt único por tenant
2. **PIN Lockout**: 3 intentos fallidos = bloqueo por 15 minutos
3. **Role-Based Access**: Permisos estrictos por rol
4. **Tenant Isolation**: Todos los queries filtran por tenant_id
5. **File Access**: URLs firmadas de Supabase con expiración
6. **Audit Trail**: Todos los cambios registrados con actor_id
7. **Data Encryption**: Datos sensibles encriptados en reposo

---

**Fin del Documento de Diseño**
