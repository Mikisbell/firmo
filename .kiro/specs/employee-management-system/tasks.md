# Plan de Implementación: Sistema de Gestión de Recursos Humanos

## Overview

Este plan de implementación convierte el diseño del Sistema de Gestión de Recursos Humanos en una serie de tareas incrementales para un LLM de generación de código. Cada tarea construye sobre las anteriores y termina con integración completa. El enfoque es SOLO en tareas que involucran escribir, modificar o testear código.

## 🎯 Estrategia Recomendada: Implementación Por Fases

**Enfoque:** Implementar una fase completa a la vez, validar con usuarios reales, y continuar con la siguiente fase.

**Ventajas:**
- ✅ Entregas valor incremental cada semana
- ✅ Validación temprana con usuarios reales
- ✅ Ajustes según feedback antes de continuar
- ✅ Reduce riesgo de construir funcionalidades innecesarias
- ✅ Permite priorizar según necesidades del negocio

**Tiempo estimado:** 1 semana por fase (12 semanas total)

## Estrategia de Implementación

### 📅 Cronograma Por Fases

**Semana 1 - Fase 1**: Extensión del schema de Prisma y modelos base
**Semana 2 - Fase 2**: Event schemas y reducers
**Semana 3 - Fase 3**: Servicios core (Employee, Attendance, Schedule)
**Semana 4 - Fase 4**: Servicios de planilla y cálculos legales
**Semana 5 - Fase 5**: Servicios de solicitudes (Leave, Advance, Evaluation, Training)
**Semana 6 - Fase 6**: APIs REST
**Semana 7 - Fase 7**: UI Admin Panel
**Semana 8 - Fase 8**: UI Employee Self-Service
**Semana 9 - Fase 9**: Soporte Offline (IndexedDB)
**Semana 10 - Fase 10**: Reportes y Analytics
**Semana 11 - Fase 11**: Notificaciones
**Semana 12 - Fase 12**: Testing completo y optimizaciones

### 🎯 Entregables Por Fase

Cada fase termina con:
1. ✅ Código implementado y funcionando
2. ✅ Tests pasando (unit + property-based)
3. ✅ Documentación actualizada
4. ✅ Demo funcional para validación con usuarios
5. ✅ Checkpoint de revisión antes de continuar

### 🚀 Cómo Usar Este Plan

1. **Ejecuta una fase completa** (todas las tareas de esa fase)
2. **Valida con usuarios** (demo + feedback)
3. **Ajusta si es necesario** (cambios menores basados en feedback)
4. **Continúa con la siguiente fase** (solo si la anterior está validada)

### ⚠️ Reglas Importantes

- ❌ NO saltar fases (cada fase depende de las anteriores)
- ❌ NO empezar Fase N+1 sin completar Fase N
- ✅ SÍ hacer ajustes menores entre fases según feedback
- ✅ SÍ validar cada fase con usuarios antes de continuar

## Tasks

### Fase 1: Schema y Modelos Base

- [ ] 1. Extender schema de Prisma con tablas de RRHH
  - Agregar campos nuevos a modelo `employees` existente
  - Crear modelos: `emergency_contacts`, `employee_documents`, `schedules`, `employee_schedules`
  - Crear modelos: `shift_change_requests`, `leave_requests`, `advances`
  - Crear modelos: `evaluations`, `training_records`, `payroll_records`
  - Ejecutar migración de Prisma
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.1, 5.1, 6.1, 7.1, 8.1, 4.1_

- [ ]* 1.1 Escribir tests de schema
  - Verificar que todas las tablas se crean correctamente
  - Verificar relaciones entre tablas
  - Verificar índices
  - _Requirements: 1.1, 1.2_

- [ ] 2. Crear tipos TypeScript compartidos para RRHH
  - Extender `src/core/types/shared.ts` con branded types: `EmployeeId`, `AttendanceId`, `ScheduleId`
  - Crear enums: `EmployeeRole`, `ContractType`, `LeaveType`, `AdvanceStatus`, `PayrollStatus`
  - Crear interfaces: `Employee`, `Attendance`, `Schedule`, `LeaveRequest`, `Advance`, `PayrollRecord`
  - _Requirements: Todos_


### Fase 2: Event Schemas y Reducers

- [ ] 3. Crear event schemas para RRHH
  - Extender `src/core/domain/events.ts` con eventos de RRHH
  - Eventos: EMPLOYEE_CREATED, EMPLOYEE_PROFILE_UPDATED, EMPLOYEE_DEACTIVATED
  - Eventos: ATTENDANCE_CLOCKED_IN, ATTENDANCE_CLOCKED_OUT, ATTENDANCE_ABSENCE_DETECTED, ATTENDANCE_JUSTIFIED
  - Eventos: LEAVE_REQUEST_CREATED, LEAVE_REQUEST_APPROVED, LEAVE_REQUEST_REJECTED
  - Eventos: ADVANCE_REQUESTED, ADVANCE_APPROVED
  - Eventos: PAYROLL_CALCULATED, EVALUATION_CREATED, TRAINING_COMPLETED
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ]* 3.1 Escribir property test para event schemas
  - **Property 58: Todas las operaciones emiten eventos**
  - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

- [ ] 4. Crear reducers para RRHH
  - Crear `src/core/reducers/employee.reducer.ts`
  - Crear `src/core/reducers/attendance.reducer.ts`
  - Crear `src/core/reducers/leave-request.reducer.ts`
  - Crear `src/core/reducers/payroll.reducer.ts`
  - Cada reducer debe reconstruir estado desde eventos
  - _Requirements: 11.7_

- [ ]* 4.1 Escribir property test para event replay
  - **Property 60: Event replay reconstruye estado**
  - **Validates: Requirements 11.7**

### Fase 3: Servicios Core

- [ ] 5. Implementar EmployeeService
  - Crear `src/core/services/employee.service.ts`
  - Métodos: create, update, deactivate, getById, list, search
  - Métodos: uploadProfilePhoto, addEmergencyContact, uploadDocument
  - Métodos: bulkActivate, bulkDeactivate, bulkChangeRole, exportToExcel
  - Integrar con Supabase Storage para archivos
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 9.2, 9.3, 9.4, 9.6_

- [ ]* 5.1 Escribir property tests para EmployeeService
  - **Property 1: Perfil completo se almacena correctamente**
  - **Property 2: Archivos se almacenan con tenant isolation**
  - **Property 3: Validación de contacto de emergencia**
  - **Property 4: Audit trail completo**
  - **Property 5: Soft delete preserva datos**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

- [ ]* 5.2 Escribir unit tests para EmployeeService
  - Test: Crear empleado con salario menor al mínimo debe fallar
  - Test: Búsqueda case-insensitive funciona correctamente
  - Test: Filtros múltiples se aplican correctamente
  - _Requirements: 13.6, 9.3, 9.2_


- [ ] 6. Implementar AttendanceService
  - Crear `src/core/services/attendance.service.ts`
  - Métodos: clockIn, clockOut, getByEmployee, justifyAbsence, correctAttendance
  - Métodos: calculateHoursWorked, calculateOvertime, calculateLateness
  - Método: detectAbsences (cron job diario)
  - Método: getMonthlyReport
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ]* 6.1 Escribir property tests para AttendanceService
  - **Property 10: Registro de asistencia con timestamp**
  - **Property 11: Cálculo de horas trabajadas y extras**
  - **Property 12: Detección de tardanzas**
  - **Property 13: Justificación actualiza registro**
  - **Property 14: Cálculo automático de métricas de asistencia**
  - **Property 15: Corrección con audit trail**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.7**

- [ ]* 6.2 Escribir unit tests para AttendanceService
  - Test: Detectar ausencia cuando no hay marcación
  - Test: Calcular horas extras correctamente
  - Test: Validar PIN antes de marcar
  - _Requirements: 3.4, 3.2_

- [ ] 7. Implementar ScheduleService
  - Crear `src/core/services/schedule.service.ts`
  - Métodos: create, update, delete, assignToEmployee
  - Métodos: requestShiftChange, approveShiftChange, rejectShiftChange
  - Métodos: getWeeklyCalendar, getMonthlyCalendar
  - Métodos: createRotatingSchedule, applyRotation
  - Método: sendShiftReminders (cron job)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ]* 7.1 Escribir property tests para ScheduleService
  - **Property 6: Detección de conflictos de horarios**
  - **Property 7: Flujo de solicitud de cambio de turno**
  - **Property 8: Generación de horarios rotativos**
  - **Property 9: Notificaciones programadas de turnos**
  - **Validates: Requirements 2.2, 2.3, 2.4, 2.6, 2.7**

- [ ] 8. Checkpoint - Verificar servicios core
  - Asegurar que todos los tests pasan
  - Verificar integración entre servicios
  - Preguntar al usuario si hay dudas

### Fase 4: Servicios de Planilla y Cálculos Legales

- [ ] 9. Implementar PayrollService
  - Crear `src/core/services/payroll.service.ts`
  - Métodos: calculateMonthly, calculateForEmployee
  - Métodos: calculateBaseSalary, calculateCommissions, calculateTips, calculateOvertime, calculateDeductions
  - Métodos: calculateCTS, calculateGratification, calculateEsSalud, calculateONP
  - Métodos: generatePayslip (PDF), sendPayslipNotification
  - Métodos: exportToExcel, generatePLAME
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 13.1, 13.2, 13.5, 13.6, 13.7_

- [ ]* 9.1 Escribir property tests para PayrollService
  - **Property 16: Cálculo de salario base**
  - **Property 17: Cálculo de comisiones**
  - **Property 18: Suma de propinas**
  - **Property 19: Descuento de adelantos**
  - **Property 20: Descuento por faltas**
  - **Property 21: Cálculo de horas extras con recargos**
  - **Property 22: Boleta de pago contiene todos los conceptos**
  - **Property 23: Cálculo de aportes legales**
  - **Property 66: Cálculo de CTS**
  - **Property 67: Cálculo de gratificaciones**
  - **Property 68: Validación de salario mínimo**
  - **Property 69: Reporte PLAME tiene formato correcto**
  - **Validates: Requirements 4.1-4.9, 13.1, 13.2, 13.5, 13.6, 13.7**

- [ ]* 9.2 Escribir unit tests para PayrollService
  - Test: Cálculo de CTS semestral
  - Test: Gratificación con bonificación extraordinaria
  - Test: Formato PLAME cumple con SUNAT
  - _Requirements: 13.1, 13.2, 13.5_


### Fase 5: Servicios de Solicitudes

- [ ] 10. Implementar LeaveRequestService, AdvanceService, EvaluationService, TrainingService
  - Crear `src/core/services/leave-request.service.ts`
  - Crear `src/core/services/advance.service.ts`
  - Crear `src/core/services/evaluation.service.ts`
  - Crear `src/core/services/training.service.ts`
  - Implementar todos los métodos según diseño
  - _Requirements: 5.1-5.8, 6.1-6.6, 7.1-7.6, 8.1-8.5_

- [ ]* 10.1 Escribir property tests para servicios de solicitudes
  - **Property 24-30**: Leave Request properties
  - **Property 31-35**: Advance properties
  - **Property 36-41**: Evaluation properties
  - **Property 42-45**: Training properties
  - **Validates: Requirements 5.1-5.8, 6.1-6.6, 7.1-7.6, 8.1-8.5**

- [ ] 11. Checkpoint - Verificar servicios de solicitudes
  - Asegurar que todos los tests pasan
  - Preguntar al usuario si hay dudas

### Fase 6: APIs REST

- [ ] 12. Implementar APIs de Employee Management
  - Crear endpoints en `src/app/api/hr/employees/`
  - POST, GET, PATCH, DELETE para CRUD
  - POST para photo, documents, emergency-contact
  - POST para bulk operations
  - GET para search y export
  - Validación con Zod
  - _Requirements: 1.1-1.7, 9.2-9.4, 9.6_

- [ ] 13. Implementar APIs de Attendance, Schedules, Payroll
  - Crear endpoints en `src/app/api/hr/attendance/`, `schedules/`, `payroll/`
  - Implementar todos los endpoints según diseño
  - _Requirements: 3.1-3.7, 2.1-2.7, 4.1-4.9_

- [ ] 14. Implementar APIs de Leave Requests, Advances, Evaluations, Training
  - Crear endpoints en `src/app/api/hr/leave-requests/`, `advances/`, `evaluations/`, `training/`
  - Implementar todos los endpoints según diseño
  - _Requirements: 5.1-5.8, 6.1-6.6, 7.1-7.6, 8.1-8.5_

- [ ] 15. Implementar APIs de Self-Service
  - Crear endpoints en `src/app/api/hr/me/`
  - GET /me, PATCH /me
  - GET /me/schedule, /me/attendance, /me/payslips, /me/vacation-balance
  - POST /me/leave-requests
  - _Requirements: 10.1-10.8_

- [ ]* 15.1 Escribir integration tests para APIs
  - Test: Flujo completo de empleado (crear → asignar horario → marcar asistencia)
  - Test: Flujo de vacaciones (solicitar → aprobar → descontar saldo)
  - Test: Flujo de adelantos (solicitar → aprobar → descontar en planilla)
  - _Requirements: Todos_

- [ ] 16. Checkpoint - Verificar APIs
  - Asegurar que todos los tests pasan
  - Verificar autenticación y autorización
  - Preguntar al usuario si hay dudas

### Fase 7: UI Admin Panel

- [ ] 17. Implementar Dashboard RRHH
  - Crear `src/app/admin/hr/page.tsx`
  - Componentes: MetricsCards, QuickActions, RecentActivity
  - Integrar con APIs
  - _Requirements: 9.1_

- [ ] 18. Implementar Gestión de Empleados
  - Crear `src/app/admin/hr/employees/page.tsx`
  - Componentes: Filters, SearchBar, EmployeeTable, BulkActions
  - Modales: CreateEmployeeModal, EditEmployeeModal
  - _Requirements: 1.1-1.7, 9.2-9.6_

- [ ] 19. Implementar Gestión de Asistencia y Horarios
  - Crear `src/app/admin/hr/attendance/page.tsx`
  - Crear `src/app/admin/hr/schedules/page.tsx`
  - Componentes: AttendanceTable, ScheduleCalendar
  - _Requirements: 3.1-3.7, 2.1-2.7_

- [ ] 20. Implementar Gestión de Planilla
  - Crear `src/app/admin/hr/payroll/page.tsx`
  - Componentes: PayrollTable, CalculatePayrollButton
  - _Requirements: 4.1-4.9_

- [ ] 21. Implementar Gestión de Solicitudes
  - Crear `src/app/admin/hr/leave-requests/page.tsx`
  - Crear `src/app/admin/hr/advances/page.tsx`
  - Componentes: RequestTable, ApprovalModal
  - _Requirements: 5.1-5.8, 6.1-6.6_

- [ ] 22. Implementar Evaluaciones y Capacitaciones
  - Crear `src/app/admin/hr/evaluations/page.tsx`
  - Crear `src/app/admin/hr/training/page.tsx`
  - _Requirements: 7.1-7.6, 8.1-8.5_


### Fase 8: UI Employee Self-Service

- [ ] 23. Implementar Employee Dashboard
  - Crear `src/app/employee/page.tsx`
  - Componentes: ProfileCard, Tabs (Mi Información, Mis Turnos, Mi Asistencia, Mis Boletas, Vacaciones)
  - Integrar con APIs de self-service
  - _Requirements: 10.1-10.8_

- [ ]* 23.1 Escribir property tests para permisos de self-service
  - **Property 51: Empleado puede leer su perfil**
  - **Property 52: Empleado puede actualizar información personal**
  - **Property 53: Empleado ve sus propios turnos**
  - **Property 54: Empleado ve su historial de asistencia**
  - **Property 55: Empleado puede descargar boletas**
  - **Property 56: Empleado ve saldo de vacaciones correcto**
  - **Property 57: Empleado puede solicitar vacaciones**
  - **Validates: Requirements 10.2-10.8**

- [ ] 24. Checkpoint - Verificar UIs
  - Asegurar que todas las pantallas funcionan
  - Verificar responsive design
  - Preguntar al usuario si hay dudas

### Fase 9: Soporte Offline (IndexedDB)

- [ ] 25. Implementar IndexedDB schema y sync
  - Crear `src/core/db/hr-db.ts` con Dexie
  - Tablas: hr_events, employees_cache, schedules_cache, attendance_cache, leave_requests_cache
  - Implementar sync logic en `src/core/sync/hr-sync.ts`
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 25.1 Escribir property tests para offline support
  - **Property 61: Eventos offline se almacenan localmente**
  - **Property 62: Sincronización envía todos los eventos**
  - **Property 63: Lectura offline desde caché**
  - **Property 64: Solicitudes offline se sincronizan**
  - **Property 65: Resolución de conflictos**
  - **Validates: Requirements 12.1-12.5**

- [ ]* 25.2 Escribir integration tests para offline sync
  - Test: Crear eventos offline → reconectar → verificar sincronización
  - Test: Conflicto de sincronización se resuelve correctamente
  - _Requirements: 12.2, 12.5_

### Fase 10: Reportes y Analytics

- [ ] 26. Implementar ReportService
  - Crear `src/core/services/report.service.ts`
  - Métodos: generateAttendanceReport, generateHoursWorkedReport, generatePayrollReport
  - Métodos: generateVacationReport, generatePerformanceReport, generateTurnoverReport, generateLaborCostReport
  - Métodos: exportToExcel, exportToPDF, generateTrendCharts
  - _Requirements: 15.1-15.9_

- [ ]* 26.1 Escribir property tests para ReportService
  - **Property 75: Reportes contienen datos correctos**
  - **Property 76: Gráficos de tendencias**
  - **Validates: Requirements 15.1-15.9**

- [ ] 27. Implementar APIs de Reportes
  - Crear endpoints en `src/app/api/hr/reports/`
  - GET /attendance, /hours-worked, /payroll, /vacations, /performance, /turnover, /labor-cost, /trends
  - _Requirements: 15.1-15.9_

- [ ] 28. Implementar UI de Reportes
  - Crear `src/app/admin/hr/reports/page.tsx`
  - Componentes: ReportFilters, ReportTable, ChartDisplay
  - Botones de exportación a Excel y PDF
  - _Requirements: 15.1-15.9_

### Fase 11: Notificaciones

- [ ] 29. Implementar NotificationService
  - Crear `src/core/services/notification.service.ts`
  - Métodos: sendPushNotification, scheduleShiftReminder, scheduleBirthdayNotification
  - Métodos: updatePreferences, notifyTeam
  - Integrar con sistema de notificaciones existente
  - _Requirements: 14.1-14.6_

- [ ]* 29.1 Escribir property tests para NotificationService
  - **Property 70: Notificación de aprobación**
  - **Property 71: Notificación a supervisor**
  - **Property 72: Notificación de boleta con link**
  - **Property 73: Notificación de cumpleaños**
  - **Property 74: Preferencias de notificaciones**
  - **Validates: Requirements 14.1-14.6**

- [ ] 30. Implementar cron jobs para notificaciones
  - Crear `src/cron/hr-notifications.ts`
  - Job: Recordatorios de turno (cada hora)
  - Job: Cumpleaños (diario a las 8AM)
  - Job: Capacitaciones pendientes (semanal)
  - _Requirements: 2.7, 8.3, 14.5_

### Fase 12: Testing Completo y Optimizaciones

- [ ] 31. Ejecutar todos los property tests
  - Verificar que las 76 properties pasan
  - Cada property test debe ejecutar mínimo 100 iteraciones
  - _Requirements: Todos_

- [ ] 32. Ejecutar todos los unit tests
  - Verificar cobertura de edge cases
  - Verificar manejo de errores
  - _Requirements: Todos_

- [ ] 33. Ejecutar integration tests
  - Flujo completo de empleado
  - Flujo de vacaciones
  - Flujo de adelantos
  - Flujo de planilla
  - Sincronización offline
  - _Requirements: Todos_

- [ ] 34. Performance testing
  - Test: 1000+ empleados activos
  - Test: 10,000+ registros de asistencia por mes
  - Test: Cálculo de planilla para 1000 empleados en < 30 segundos
  - Test: Sincronización de 1000 eventos offline en < 10 segundos
  - _Requirements: Todos_

- [ ] 35. Optimizaciones
  - Agregar índices de base de datos faltantes
  - Implementar caché en memoria para empleados activos
  - Implementar lazy loading de documentos
  - Implementar pagination en todas las listas
  - Implementar background jobs para operaciones pesadas
  - _Requirements: Todos_

- [ ] 36. Checkpoint Final
  - Asegurar que TODOS los tests pasan
  - Verificar que el sistema cumple con TODOS los requirements
  - Verificar cumplimiento legal peruano
  - Preguntar al usuario si hay dudas o ajustes finales

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requirements específicos que implementa
- Los checkpoints aseguran validación incremental
- Los property tests validan corrección universal
- Los unit tests validan casos específicos y edge cases
- Los integration tests validan flujos end-to-end
- El sistema debe funcionar 100% offline y sincronizar cuando hay conexión
- Todos los montos deben estar en centavos (integer), nunca float
- Todos los eventos deben incluir tenant_id para aislamiento multi-tenant
- Todos los archivos deben almacenarse en Supabase Storage con tenant isolation
- El sistema debe cumplir con la legislación laboral peruana

---

**Fin del Plan de Implementación**
