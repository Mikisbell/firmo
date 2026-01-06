# Requirements Document

## Introduction

Este documento define los requisitos para los flujos de documentación faltantes en PARK POS. Identificados en auditoría arquitectónica de Enero 2026, estos módulos son críticos para producción real de una cadena de pollerías.

## Glossary

- **PARK_POS**: Sistema POS offline-first para pollerías peruanas
- **Tenant**: Negocio/local que usa el sistema
- **SKU**: Stock Keeping Unit - identificador único de producto
- **SUNAT**: Superintendencia Nacional de Aduanas y de Administración Tributaria (Perú)
- **CDR**: Constancia de Recepción de SUNAT
- **Merma**: Pérdida de inventario por vencimiento, daño o robo
- **FIFO**: First In First Out - método de valoración de inventario
- **Caja_Chica**: Fondo de efectivo para gastos menores

## Requirements

### Requirement 1: Documentación de Inventario ✅ COMPLETADO

**Archivo creado:** `docs/03-features/FLUJO_INVENTARIO.md`

**User Story:** Como dueño de pollería, quiero controlar mi inventario de insumos, para saber cuánto tengo, cuánto me queda y cuándo debo comprar más.

#### Acceptance Criteria

1. THE Documentation SHALL include a complete inventory management flow with at least 10 real scenarios
2. WHEN documenting inventory, THE Document SHALL cover: stock reception, counting, alerts, waste, transfers between locations
3. THE Document SHALL define data models for: Product_Stock, Stock_Movement, Stock_Alert, Supplier
4. THE Document SHALL define events for: STOCK_RECEIVED, STOCK_ADJUSTED, STOCK_TRANSFERRED, STOCK_ALERT_TRIGGERED
5. WHEN a sale occurs, THE Document SHALL describe how stock is automatically decremented
6. THE Document SHALL include UI mockups for: stock dashboard, reception form, counting screen, alerts panel
7. THE Document SHALL address offline behavior for inventory operations
8. THE Document SHALL define FIFO costing method for COGS calculation

### Requirement 2: Documentación de Facturación SUNAT ✅ COMPLETADO

**Archivo creado:** `docs/03-features/FLUJO_FACTURACION_SUNAT.md`

**User Story:** Como dueño de pollería en Perú, quiero emitir comprobantes electrónicos válidos ante SUNAT, para cumplir con la ley y evitar multas.

#### Acceptance Criteria

1. THE Documentation SHALL include complete SUNAT electronic invoicing flow
2. WHEN documenting invoicing, THE Document SHALL cover: boletas, facturas, notas de crédito, notas de débito
3. THE Document SHALL define integration with SUNAT OSE (Operador de Servicios Electrónicos)
4. THE Document SHALL describe contingency mode when SUNAT is unavailable
5. THE Document SHALL include CDR handling and storage
6. THE Document SHALL define retry logic for failed submissions
7. THE Document SHALL include UI for: invoice issuance, void process, resend failed, daily summary
8. THE Document SHALL address offline invoicing with later sync

### Requirement 3: Documentación de Mesas y Layout ✅ COMPLETADO

**Archivo creado:** `docs/03-features/FLUJO_MESAS_LAYOUT.md`

**User Story:** Como administrador de pollería con 50 mesas, quiero ver un mapa visual del local, para saber qué mesas están libres, ocupadas o reservadas.

#### Acceptance Criteria

1. THE Documentation SHALL include visual table management flow
2. WHEN documenting tables, THE Document SHALL cover: table states, merging, splitting, zones
3. THE Document SHALL define data models for: Table, Zone, Table_Layout
4. THE Document SHALL include UI mockups for: floor plan editor, real-time status view
5. THE Document SHALL describe how tables link to orders
6. THE Document SHALL address multi-floor or outdoor areas

### Requirement 4: Documentación de Caja Chica ✅ COMPLETADO

**Archivo creado:** `docs/03-features/FLUJO_CAJA_CHICA.md`

**User Story:** Como cajero, quiero registrar gastos menores del día, para que el cierre de caja cuadre correctamente.

#### Acceptance Criteria

1. THE Documentation SHALL include petty cash management flow
2. WHEN documenting petty cash, THE Document SHALL cover: withdrawals, deposits, receipts, approvals
3. THE Document SHALL define events for: PETTY_CASH_WITHDRAWAL, PETTY_CASH_DEPOSIT, PETTY_CASH_RECONCILED
4. THE Document SHALL include authorization rules for amounts over threshold
5. THE Document SHALL integrate with shift closing

### Requirement 5: Documentación de Propinas ✅ COMPLETADO

**Archivo creado:** `docs/03-features/FLUJO_PROPINAS.md`

**User Story:** Como mesero, quiero que mis propinas se registren correctamente, para recibir lo que me corresponde.

#### Acceptance Criteria

1. THE Documentation SHALL include tip management flow
2. WHEN documenting tips, THE Document SHALL cover: tip entry, distribution methods, reporting
3. THE Document SHALL define distribution modes: individual, pooled, by zone
4. THE Document SHALL address tip reporting for tax purposes
5. THE Document SHALL include UI for tip entry and daily summary per employee

### Requirement 6: Documentación de Reservas ✅ COMPLETADO

**Archivo creado:** `docs/03-features/FLUJO_RESERVAS.md`

**User Story:** Como cliente, quiero reservar una mesa para mi cumpleaños, para asegurar que tendré lugar cuando llegue.

#### Acceptance Criteria

1. THE Documentation SHALL include reservation management flow
2. WHEN documenting reservations, THE Document SHALL cover: booking, confirmation, no-show, deposits
3. THE Document SHALL define integration with WhatsApp for confirmations
4. THE Document SHALL include calendar view UI
5. THE Document SHALL address overbooking prevention

### Requirement 7: Documentación de Turnos y Empleados ✅ COMPLETADO

**Archivo creado:** `docs/03-features/FLUJO_EMPLEADOS_TURNOS.md`

**User Story:** Como administrador, quiero controlar los horarios de mis empleados, para saber quién trabaja cada día y calcular horas extras.

#### Acceptance Criteria

1. THE Documentation SHALL include employee scheduling flow
2. WHEN documenting schedules, THE Document SHALL cover: shifts, attendance, overtime, absences
3. THE Document SHALL define data models for: Schedule, Attendance, Overtime
4. THE Document SHALL include UI for: weekly schedule, clock in/out, attendance report

### Requirement 8: Actualización de README y MASTER ✅ COMPLETADO

**Archivos actualizados:** `docs/README.md`, `.kiro/specs/flujos-faltantes/requirements.md`

**User Story:** Como desarrollador, quiero que toda la documentación esté indexada, para encontrar fácilmente lo que necesito.

#### Acceptance Criteria

1. THE README.md SHALL be updated to include all new documentation files
2. THE MASTER.md SHALL be updated with new checklist items for documentation
3. WHEN adding new docs, THE Index SHALL maintain alphabetical order within sections
