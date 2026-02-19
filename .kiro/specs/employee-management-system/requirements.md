# Documento de Requirements - Sistema de Gestión de Recursos Humanos

## Introducción

El Sistema de Gestión de Recursos Humanos (RRHH) para PARK POS es un módulo completo que permite administrar todo el ciclo de vida de los empleados en pollerías peruanas, desde la contratación hasta la gestión de planillas, asistencia, vacaciones y evaluación de desempeño. El sistema debe integrarse perfectamente con la arquitectura event-sourcing existente, soportar operación offline-first, y cumplir con la legislación laboral peruana.

## Glossary

- **Employee**: Empleado del restaurante (mesero, cajero, cocinero, supervisor, administrador)
- **Attendance**: Registro de asistencia (entrada/salida) de un empleado
- **Schedule**: Horario de trabajo asignado a un empleado
- **Shift**: Turno de trabajo (mañana, tarde, noche)
- **Payroll**: Planilla de sueldos mensual
- **Leave_Request**: Solicitud de vacaciones o permiso
- **Performance_Review**: Evaluación de desempeño de un empleado
- **Training**: Capacitación o curso completado por un empleado
- **Emergency_Contact**: Contacto de emergencia de un empleado
- **Document**: Documento laboral (contrato, certificado, antecedentes)
- **Advance**: Adelanto de sueldo solicitado por un empleado
- **Deduction**: Descuento aplicado al sueldo (préstamo, falta)
- **Commission**: Comisión por ventas
- **Overtime**: Horas extras trabajadas
- **Business_Date**: Fecha de negocio (con hora de corte 6AM)
- **Tenant**: Pollería (multi-tenant)
- **Location**: Sucursal de la pollería

## Requirements

### Requirement 1: Perfil Completo de Empleado

**User Story:** Como administrador, quiero gestionar perfiles completos de empleados con toda su información personal y laboral, para tener un registro centralizado y actualizado de mi equipo.

#### Acceptance Criteria

1. WHEN un administrador crea un nuevo empleado, THE System SHALL almacenar información personal (nombre, DNI, dirección, teléfono, email, fecha de nacimiento)
2. WHEN un administrador crea un nuevo empleado, THE System SHALL almacenar información laboral (fecha de ingreso, puesto, salario base, tipo de contrato, horario)
3. WHEN un administrador sube una foto de perfil, THE System SHALL almacenarla en Supabase Storage con tenant isolation
4. WHEN un administrador agrega un contacto de emergencia, THE System SHALL validar que incluya nombre, relación, teléfono y dirección
5. WHEN un administrador sube un documento laboral, THE System SHALL almacenarlo con metadata (tipo, fecha de emisión, fecha de vencimiento)
6. THE System SHALL mantener un historial de cambios en el perfil del empleado con audit trail
7. WHEN un empleado es desactivado, THE System SHALL mantener su información histórica pero marcarlo como inactivo

### Requirement 2: Gestión de Horarios y Turnos

**User Story:** Como administrador, quiero definir y gestionar horarios de trabajo para mis empleados, para organizar la operación del restaurante de manera eficiente.

#### Acceptance Criteria

1. WHEN un administrador crea un horario, THE System SHALL permitir definir días de la semana, hora de entrada, hora de salida y tipo de turno
2. WHEN un administrador asigna un horario a un empleado, THE System SHALL validar que no haya conflictos con otros horarios del mismo empleado
3. WHEN un empleado solicita un cambio de turno, THE System SHALL crear una solicitud pendiente de aprobación
4. WHEN un supervisor aprueba un cambio de turno, THE System SHALL actualizar el calendario y notificar a ambos empleados
5. THE System SHALL generar un calendario visual de turnos por semana y por mes
6. WHEN se crea un horario rotativo, THE System SHALL aplicarlo automáticamente según el patrón definido
7. THE System SHALL enviar notificaciones de recordatorio de turno 2 horas antes del inicio

### Requirement 3: Control de Asistencia

**User Story:** Como administrador, quiero registrar y monitorear la asistencia de mis empleados, para controlar puntualidad y calcular horas trabajadas correctamente.

#### Acceptance Criteria

1. WHEN un empleado marca entrada con su PIN, THE System SHALL registrar la hora exacta y validar contra su horario programado
2. WHEN un empleado marca salida con su PIN, THE System SHALL calcular las horas trabajadas y detectar horas extras
3. IF un empleado llega tarde, THEN THE System SHALL calcular los minutos de tardanza y marcar el registro
4. WHEN un empleado no marca entrada en su horario, THE System SHALL crear un registro de ausencia automáticamente
5. WHEN un empleado justifica una ausencia, THE System SHALL actualizar el registro con la justificación y documentos de soporte
6. THE System SHALL calcular automáticamente: horas trabajadas, horas extras, tardanzas, ausencias y breaks
7. THE System SHALL permitir correcciones manuales de asistencia con aprobación de supervisor y audit trail

### Requirement 4: Cálculo de Planilla

**User Story:** Como administrador, quiero calcular automáticamente la planilla mensual de mis empleados, para procesar pagos de manera precisa y eficiente.

#### Acceptance Criteria

1. WHEN se cierra el mes, THE System SHALL calcular el salario base de cada empleado según días trabajados
2. WHEN se calcula la planilla, THE System SHALL sumar comisiones basadas en ventas del empleado
3. WHEN se calcula la planilla, THE System SHALL sumar propinas distribuidas al empleado
4. WHEN se calcula la planilla, THE System SHALL restar adelantos de sueldo solicitados
5. WHEN se calcula la planilla, THE System SHALL restar descuentos por faltas injustificadas
6. WHEN se calcula la planilla, THE System SHALL calcular horas extras con recargo del 25% (primeras 2 horas) y 35% (adicionales)
7. THE System SHALL generar boletas de pago en formato PDF con todos los conceptos detallados
8. THE System SHALL calcular aportes legales (ONP/AFP, EsSalud) según legislación peruana
9. THE System SHALL permitir exportar la planilla a Excel para procesamiento en banco

### Requirement 5: Gestión de Vacaciones y Permisos

**User Story:** Como empleado, quiero solicitar vacaciones y permisos de manera digital, para gestionar mis ausencias de forma organizada.

#### Acceptance Criteria

1. WHEN un empleado solicita vacaciones, THE System SHALL validar que tenga días disponibles acumulados
2. WHEN un empleado solicita vacaciones, THE System SHALL crear una solicitud pendiente de aprobación
3. WHEN un supervisor revisa una solicitud, THE System SHALL mostrar el calendario de ausencias del equipo
4. WHEN un supervisor aprueba vacaciones, THE System SHALL descontar los días del saldo del empleado
5. WHEN un supervisor rechaza una solicitud, THE System SHALL notificar al empleado con el motivo
6. THE System SHALL calcular automáticamente días de vacaciones acumulados (30 días por año trabajado)
7. WHEN un empleado solicita un permiso médico, THE System SHALL permitir adjuntar certificado médico
8. THE System SHALL diferenciar entre permisos con goce de haber y sin goce de haber

### Requirement 6: Adelantos de Sueldo

**User Story:** Como empleado, quiero solicitar adelantos de mi sueldo, para cubrir necesidades financieras urgentes.

#### Acceptance Criteria

1. WHEN un empleado solicita un adelanto, THE System SHALL validar que no exceda el 40% de su sueldo mensual
2. WHEN un empleado solicita un adelanto, THE System SHALL validar que no tenga adelantos pendientes de pago
3. WHEN un supervisor aprueba un adelanto, THE System SHALL registrarlo para descontarlo en la próxima planilla
4. THE System SHALL calcular automáticamente el monto disponible para adelanto según días trabajados del mes
5. WHEN se calcula la planilla, THE System SHALL descontar todos los adelantos aprobados del mes
6. THE System SHALL mantener un historial de adelantos por empleado

### Requirement 7: Evaluación de Desempeño

**User Story:** Como supervisor, quiero evaluar el desempeño de mis empleados, para identificar fortalezas y áreas de mejora.

#### Acceptance Criteria

1. WHEN un supervisor crea una evaluación, THE System SHALL permitir calificar múltiples criterios (puntualidad, calidad, actitud, ventas)
2. WHEN se crea una evaluación, THE System SHALL calcular métricas automáticas del empleado (ventas, propinas, asistencia)
3. WHEN se completa una evaluación, THE System SHALL notificar al empleado para que la revise
4. THE System SHALL permitir al empleado agregar comentarios a su evaluación
5. THE System SHALL generar un reporte de desempeño con gráficos de evolución
6. WHEN se define un objetivo para un empleado, THE System SHALL monitorear su progreso automáticamente

### Requirement 8: Gestión de Capacitaciones

**User Story:** Como administrador, quiero registrar y monitorear las capacitaciones de mis empleados, para asegurar que el equipo esté bien entrenado.

#### Acceptance Criteria

1. WHEN un empleado completa una capacitación, THE System SHALL registrar el curso, fecha, duración y certificado
2. WHEN se crea una capacitación obligatoria, THE System SHALL asignarla automáticamente a los empleados correspondientes
3. THE System SHALL enviar recordatorios de capacitaciones pendientes
4. WHEN un empleado sube un certificado, THE System SHALL almacenarlo en Supabase Storage
5. THE System SHALL generar reportes de capacitaciones completadas por empleado y por área

### Requirement 9: Panel de Administración RRHH

**User Story:** Como administrador, quiero un panel centralizado para gestionar todos los aspectos de recursos humanos, para tener control total del equipo.

#### Acceptance Criteria

1. WHEN un administrador accede al panel RRHH, THE System SHALL mostrar un dashboard con métricas clave (empleados activos, asistencia del día, solicitudes pendientes)
2. THE System SHALL permitir filtrar empleados por rol, estado, ubicación y fecha de ingreso
3. THE System SHALL permitir búsqueda rápida por nombre, DNI o código de empleado
4. THE System SHALL permitir acciones masivas (activar/desactivar, cambiar rol, exportar datos)
5. WHEN se selecciona un empleado, THE System SHALL mostrar su perfil completo con tabs (Información, Asistencia, Planilla, Vacaciones, Evaluaciones)
6. THE System SHALL generar reportes exportables en Excel y PDF

### Requirement 10: Panel de Auto-Servicio para Empleados

**User Story:** Como empleado, quiero acceder a mi información personal y laboral, para consultar mis datos sin depender del administrador.

#### Acceptance Criteria

1. WHEN un empleado inicia sesión con su PIN, THE System SHALL mostrar su dashboard personal
2. THE System SHALL permitir al empleado ver su perfil completo (información personal, contacto de emergencia)
3. THE System SHALL permitir al empleado actualizar información personal (teléfono, dirección, email)
4. THE System SHALL mostrar al empleado su calendario de turnos del mes
5. THE System SHALL mostrar al empleado su historial de asistencia con horas trabajadas
6. THE System SHALL permitir al empleado descargar sus boletas de pago
7. THE System SHALL mostrar al empleado su saldo de vacaciones disponibles
8. THE System SHALL permitir al empleado solicitar vacaciones y permisos desde su panel

### Requirement 11: Integración con Event Sourcing

**User Story:** Como arquitecto del sistema, quiero que el módulo RRHH se integre con la arquitectura event-sourcing existente, para mantener consistencia y trazabilidad.

#### Acceptance Criteria

1. WHEN se crea un empleado, THE System SHALL emitir un evento EMPLOYEE_CREATED
2. WHEN se actualiza un perfil, THE System SHALL emitir un evento EMPLOYEE_PROFILE_UPDATED
3. WHEN se marca asistencia, THE System SHALL emitir un evento ATTENDANCE_CLOCKED_IN o ATTENDANCE_CLOCKED_OUT
4. WHEN se aprueba una solicitud, THE System SHALL emitir un evento LEAVE_REQUEST_APPROVED
5. WHEN se calcula la planilla, THE System SHALL emitir un evento PAYROLL_CALCULATED
6. THE System SHALL almacenar todos los eventos en la tabla events con tenant_id
7. THE System SHALL permitir reconstruir el estado de cualquier empleado desde sus eventos

### Requirement 12: Soporte Offline-First

**User Story:** Como usuario del sistema, quiero que el módulo RRHH funcione sin conexión a internet, para no interrumpir operaciones cuando hay problemas de conectividad.

#### Acceptance Criteria

1. WHEN un empleado marca asistencia offline, THE System SHALL almacenar el evento en IndexedDB
2. WHEN se recupera la conexión, THE System SHALL sincronizar todos los eventos pendientes con el servidor
3. THE System SHALL permitir consultar información de empleados en modo offline desde caché local
4. WHEN se solicita una acción que requiere aprobación offline, THE System SHALL crear la solicitud localmente y sincronizarla después
5. THE System SHALL resolver conflictos de sincronización usando las reglas de conflict resolution existentes

### Requirement 13: Cumplimiento Legal Peruano

**User Story:** Como administrador, quiero que el sistema cumpla con la legislación laboral peruana, para evitar problemas legales y multas.

#### Acceptance Criteria

1. THE System SHALL calcular CTS (Compensación por Tiempo de Servicios) semestralmente
2. THE System SHALL calcular gratificaciones legales (Julio y Diciembre)
3. THE System SHALL calcular vacaciones según ley peruana (30 días por año)
4. THE System SHALL calcular horas extras con recargos legales (25% y 35%)
5. THE System SHALL generar reportes PLAME para declaración mensual a SUNAT
6. THE System SHALL validar que el salario mínimo no sea menor al mínimo legal vigente
7. THE System SHALL calcular aportes a EsSalud (9%) y ONP/AFP según corresponda

### Requirement 14: Notificaciones y Recordatorios

**User Story:** Como usuario del sistema, quiero recibir notificaciones sobre eventos importantes de RRHH, para estar informado en tiempo real.

#### Acceptance Criteria

1. WHEN se aprueba una solicitud, THE System SHALL enviar notificación push al empleado
2. WHEN se acerca un turno (2 horas antes), THE System SHALL enviar recordatorio al empleado
3. WHEN hay una solicitud pendiente, THE System SHALL notificar al supervisor
4. WHEN se genera una boleta de pago, THE System SHALL enviar notificación al empleado con link de descarga
5. WHEN un empleado cumple años, THE System SHALL notificar al administrador
6. THE System SHALL permitir configurar preferencias de notificaciones por empleado

### Requirement 15: Reportes y Analytics

**User Story:** Como administrador, quiero generar reportes detallados de recursos humanos, para tomar decisiones informadas sobre mi equipo.

#### Acceptance Criteria

1. THE System SHALL generar reporte de asistencia mensual por empleado con gráficos
2. THE System SHALL generar reporte de horas trabajadas vs horas programadas
3. THE System SHALL generar reporte de planilla mensual con todos los conceptos
4. THE System SHALL generar reporte de vacaciones tomadas y pendientes
5. THE System SHALL generar reporte de desempeño con métricas de ventas y propinas
6. THE System SHALL generar reporte de rotación de personal (altas y bajas)
7. THE System SHALL generar reporte de costo laboral por ubicación
8. THE System SHALL permitir exportar todos los reportes a Excel y PDF
9. THE System SHALL generar gráficos de tendencias (asistencia, ventas, rotación)
