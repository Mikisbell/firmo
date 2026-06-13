# Specs: Employee Management System (RRHH) - Documentación Retrospectiva

> Formato: Gherkin | RFC 2119 keywords | Estado: Implementado

## Convenciones

- **MUST** / **DEBE**: Requerimiento obligatorio (ya implementado)
- **SHOULD** / **DEBERÍA**: Recomendado fuertemente (ya implementado)
- **MAY** / **PUEDE**: Opcional

---

## Módulo 1: Employee Management

### F1.1: Employee CRUD Operations

```gherkin
Feature: Employee CRUD Operations
  Los empleados DEBEN poder ser creados, leídos, actualizados y eliminados (soft delete).

  Scenario: Create employee with valid data
    Given que un admin está autenticado
    When se envía POST /api/hr/employees con datos válidos
    Then DEBE retornar status 201
    And el empleado DEBE ser creado en la DB
    And el PIN DEBE estar hasheado con SHA-256
    And DEBE registrarse en admin_access_logs

  Scenario: Reject duplicate PIN
    Given que existe un empleado con PIN "1234"
    When se intenta crear otro empleado con el mismo PIN
    Then DEBE retornar status 409
    And el error DEBE decir "PIN ya está en uso"

  Scenario: List employees with pagination
    Given que existen empleados en el tenant
    When se envía GET /api/hr/employees?page=1&limit=10
    Then DEBE retornar status 200
    And DEBE incluir paginación (page, limit, total, totalPages)
    And DEBE filtrar por tenant_id del JWT

  Scenario: Update employee
    Given que existe un empleado
    When se envía PUT /api/hr/employees/[id] con cambios
    Then DEBE retornar status 200
    And los cambios DEBEN persistirse
    And DEBE registrarse en admin_access_logs

  Scenario: Soft delete employee
    Given que existe un empleado activo
    When se envía DELETE /api/hr/employees/[id]
    Then DEBE retornar status 204
    And is_active DEBE ser false
    And el registro DEBE preservarse en la DB
```

---

## Módulo 2: Attendance Management

### F2.1: Clock In/Out Operations

```gherkin
Feature: Attendance Clock In/Out
  Los empleados DEBEN poder registrar entrada y salida.

  Scenario: Clock in
    Given que un empleado está autenticado
    When se envía POST /api/hr/attendance con action=CLOCK_IN
    Then DEBE crear un registro de attendance
    And DEBE calcular late_minutes si aplica
    And DEBE emitir evento ATTENDANCE_CLOCKED_IN

  Scenario: Clock out
    Given que un empleado tiene clock in activo
    When se envía POST /api/hr/attendance con action=CLOCK_OUT
    Then DEBE actualizar el registro con clock_out
    And DEBE calcular worked_minutes y overtime_minutes
    And DEBE emitir evento ATTENDANCE_CLOCKED_OUT

  Scenario: Detect absence
    Given que un empleado no hizo clock in
    And pasó la hora programada
    When el sistema ejecuta detección de ausencias
    Then DEBE crear registro con status=ABSENT
    And DEBE emitir evento ATTENDANCE_ABSENCE_DETECTED
```

---

## Módulo 3: Payroll Management

### F3.1: Payroll Calculation

```gherkin
Feature: Payroll Calculation
  La planilla DEBE calcularse correctamente con todos los componentes.

  Scenario: Calculate monthly payroll
    Given que es fin de mes
    When se envía POST /api/hr/payroll/calculate con period_month
    Then DEBE calcular para todos los empleados activos
    And DEBE incluir: base_salary, commission, tips, overtime
    And DEBE deducir: advances, absences, pension, essalud
    And DEBE calcular gross_salary y net_salary en centavos
    And DEBE emitir evento PAYROLL_CALCULATED

  Scenario: Get payroll history
    Given que existen registros de planilla
    When se envía GET /api/hr/payroll/[employeeId]
    Then DEBE retornar historial del empleado
    And DEBE filtrar por tenant_id del JWT
```

---

## Módulo 4: Schedule Management

### F4.1: Schedule Templates

```gherkin
Feature: Schedule Templates
  Los horarios DEBEN poder definirse como templates y asignarse.

  Scenario: Create schedule template
    Given que un admin está autenticado
    When se envía POST /api/hr/schedules con datos válidos
    Then DEBE crear template de horario
    And DEBE validar days_of_week (1-7)
    And DEBE validar start_time y end_time (HH:mm)

  Scenario: Assign schedule to employee
    Given que existe un template de horario
    When se envía POST /api/hr/schedules/[id]/assign
    Then DEBE asignar el horario al empleado
    And DEBE crear registros en schedule_assignments
```

---

## Módulo 5: Leave Request Management

### F5.1: Leave Request Workflow

```gherkin
Feature: Leave Request Workflow
  Las solicitudes de permiso DEBEN seguir un workflow de aprobación.

  Scenario: Create leave request
    Given que un empleado está autenticado
    When se envía POST /api/hr/leave-requests
    Then DEBE crear solicitud con status=PENDING
    And DEBE calcular days_requested
    And DEBE emitir evento LEAVE_REQUEST_CREATED

  Scenario: Approve leave request
    Given que existe una solicitud pendiente
    When un admin envía POST /api/hr/leave-requests/[id]/approve
    Then DEBE cambiar status a APPROVED
    And DEBE deducir días del balance de vacaciones
    And DEBE emitir evento LEAVE_REQUEST_APPROVED

  Scenario: Reject leave request
    Given que existe una solicitud pendiente
    When un admin envía POST /api/hr/leave-requests/[id]/reject
    Then DEBE cambiar status a REJECTED
    And DEBE incluir rejection_reason
    And DEBE emitir evento LEAVE_REQUEST_REJECTED
```

---

## Módulo 6: Advance Management

### F6.1: Salary Advance Workflow

```gherkin
Feature: Salary Advance Workflow
  Los adelantos de sueldo DEBEN seguir un workflow de aprobación.

  Scenario: Request advance
    Given que un empleado está autenticado
    When se envía POST /api/hr/advances
    Then DEBE crear solicitud con status=PENDING
    And amount_cents DEBE ser integer
    And DEBE emitir evento ADVANCE_REQUESTED

  Scenario: Approve advance
    Given que existe una solicitud pendiente
    When un admin envía POST /api/hr/advances/[id]/approve
    Then DEBE cambiar status a APPROVED
    And DEBE registrar approved_by del JWT
    And DEBE emitir evento ADVANCE_APPROVED
```

---

## Módulo 7: Evaluation Management

### F7.1: Performance Evaluations

```gherkin
Feature: Performance Evaluations
  Las evaluaciones de desempeño DEBEN registrarse y consultarse.

  Scenario: Create evaluation
    Given que un admin está autenticado
    When se envía POST /api/hr/evaluations
    Then DEBE crear evaluación con status=DRAFT
    And DEBE incluir scores (JSON object)
    And DEBE incluir automatic_metrics
    And DEBE emitir evento EVALUATION_CREATED

  Scenario: Get employee evaluations
    Given que existen evaluaciones
    When se envía GET /api/hr/evaluations/employee/[employeeId]
    Then DEBE retornar todas las evaluaciones del empleado
    And DEBE calcular average score
```

---

## Módulo 8: Training Management

### F8.1: Training Records

```gherkin
Feature: Training Records
  Las capacitaciones DEBEN registrarse y rastrearse.

  Scenario: Record training completion
    Given que un empleado completó una capacitación
    When se envía POST /api/hr/training
    Then DEBE crear registro de training
    And DEBE incluir duration_hours
    And DEBE incluir certificate_url si aplica
    And DEBE emitir evento TRAINING_COMPLETED

  Scenario: Get training compliance
    Given que existen registros de training
    When se envía GET /api/hr/training/employee/[employeeId]/compliance
    Then DEBE retornar compliance status
    And DEBE calcular total_hours
    And DEBE identificar mandatory trainings pendientes
```

---

## Módulo 9: Employee Self-Service

### F9.1: Self-Service APIs

```gherkin
Feature: Employee Self-Service
  Los empleados DEBEN poder consultar su propia información.

  Scenario: Get my profile
    Given que un empleado está autenticado
    When se envía GET /api/hr/me
    Then DEBE retornar su perfil completo
    And DEBE usar employee_id del JWT

  Scenario: Get my attendance
    Given que un empleado está autenticado
    When se envía GET /api/hr/me/attendance
    Then DEBE retornar su historial de asistencia
    And DEBE filtrar por employee_id del JWT

  Scenario: Get my payslips
    Given que un empleado está autenticado
    When se envía GET /api/hr/me/payslips
    Then DEBE retornar sus recibos de pago
    And DEBE incluir payslip_url si existe

  Scenario: Get my vacation balance
    Given que un empleado está autenticado
    When se envía GET /api/hr/me/vacation-balance
    Then DEBE retornar días disponibles
    And DEBE calcular: earned - used - pending
```

---

## Módulo 10: HR Reports

### F10.1: Aggregated Reports

```gherkin
Feature: HR Reports
  Los reportes DEBEN agregar datos de múltiples fuentes.

  Scenario: Get attendance report
    Given que un admin está autenticado
    When se envía GET /api/hr/reports?type=attendance&period=2026-03
    Then DEBE retornar reporte de asistencia
    And DEBE incluir: total_days, present, absent, late
    And DEBE agrupar por employee

  Scenario: Get payroll report
    Given que un admin está autenticado
    When se envía GET /api/hr/reports?type=payroll&period=2026-03
    Then DEBE retornar reporte de planilla
    And DEBE incluir: gross_total, net_total, deductions
    And DEBE agrupar por employee
```

---

## Criterios Globales

```gherkin
Feature: Security and Compliance
  Todas las APIs DEBEN cumplir con las reglas de seguridad.

  Scenario: tenant_id from JWT
    Given que cualquier API de HR es llamada
    Then tenant_id DEBE venir del JWT (authResult.user.tenantId)
    And NUNCA DEBE venir del request body

  Scenario: Authentication required
    Given que cualquier API de HR es llamada sin JWT
    Then DEBE retornar status 401
    And DEBE usar requireAdminAuth o requirePosAuth

  Scenario: Money in cents
    Given que cualquier campo monetario es usado
    Then DEBE ser integer (centavos)
    And DEBE usar branded type Centavos
    And NUNCA DEBE usar float/decimal

  Scenario: Audit trail
    Given que cualquier mutación es ejecutada
    Then DEBE registrarse en admin_access_logs
    And DEBE incluir: action, resource, metadata, employee_id

  Scenario: Soft deletes
    Given que cualquier entidad es eliminada
    Then DEBE ser soft delete (is_active = false)
    And el registro DEBE preservarse en la DB
```

---

## Estado de Implementación

| Módulo | Specs | Implementación | Tests |
|--------|-------|----------------|-------|
| Employee Management | ✅ | ✅ | ✅ 22/22 |
| Attendance Management | ✅ | ✅ | ✅ 27/27 |
| Payroll Management | ✅ | ✅ | ✅ 9/9 |
| Schedule Management | ✅ | ✅ | ✅ 14/14 |
| Leave Request Management | ✅ | ✅ | ✅ 5/5 |
| Advance Management | ✅ | ✅ | ✅ 44/44 |
| Evaluation Management | ✅ | ✅ | ✅ 49/49 |
| Training Management | ✅ | ✅ | ✅ 32/32 |
| Employee Self-Service | ✅ | ✅ | ✅ 40/40 |
| HR Reports | ✅ | ✅ | ✅ 12/12 |

**Leyenda**:
- ✅ Completo
- ⚠️ Parcial (implementado pero tests incompletos)
- ❌ No implementado
