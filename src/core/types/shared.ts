/**
 * Shared Types - Single Source of Truth
 * 
 * Este archivo centraliza todos los tipos de dominio compartidos.
 * REGLA: Nunca redefinir estos tipos en otros archivos, solo importar.
 * 
 * ⚠️ LIMITACIONES IMPORTANTES DE BRANDED TYPES EN TYPESCRIPT:
 * 
 * 1. SE PIERDEN EN OPERACIONES ARITMÉTICAS:
 *    const a: Centavos = asCentavos(100);
 *    const b: Centavos = asCentavos(50);
 *    const sum = a + b;  // ← Tipo es `number`, NO `Centavos`
 *    // DEBES re-brandear: const total: Centavos = asCentavos(a + b);
 * 
 * 2. SON "OPT-IN" (gentleman's agreement):
 *    TypeScript no te obliga a usarlos. Un desarrollador puede
 *    asignar `number` a donde espera `Centavos` sin error.
 * 
 * 3. CUÁNDO USAR CADA HELPER:
 *    - asCentavos()     → Input de usuario, APIs externas (VALIDA)
 *    - unsafeCentavos() → Datos de Prisma, eventos Zod (YA VALIDADOS)
 * 
 * 4. BusinessDate vs getBusinessDate():
 *    - dateToBusinessDate() → Conversión pura (NO considera hora de corte)
 *    - getBusinessDate()    → Lógica de negocio (hora de corte 6AM)
 *    ⚠️ Para lógica de turnos, SIEMPRE usar getBusinessDate() de business-date.ts
 * 
 * 5. IDs BRANDED (OrderId, ShiftId, etc.):
 *    Útiles solo si pasas múltiples IDs juntos. En PARK POS, el contexto
 *    de uso ya distingue los IDs, por lo que son OPCIONALES.
 * 
 * @see docs/CHANGELOG.md [1.6.7] para decisión arquitectónica
 */

// ============================================================================
// Re-exports from events.ts (Zod-validated types)
// ============================================================================

export type { 
  PaymentMethod, 
  OrderType, 
  ItemStatus,
  OrderLine,
  Check,
  Order,
  ParkEvent,
  EventType,
} from '@/src/core/domain/events';

export { 
  PaymentMethodSchema,
  OrderTypeSchema,
  ItemStatusSchema,
  OrderLineSchema,
  CheckSchema,
  EventSchema,
} from '@/src/core/domain/events';

// ============================================================================
// Branded Types - Zero Runtime Cost, Full Type Safety
// ============================================================================

/**
 * Brand utility type - creates nominal types from structural types
 * This prevents accidental mixing of semantically different values
 * 
 * @example
 * const orderId: OrderId = 'abc' as OrderId;  // OK
 * const shiftId: ShiftId = orderId;           // ERROR: Type 'OrderId' is not assignable to 'ShiftId'
 */
type Brand<T, B extends string> = T & { readonly __brand: B };

/**
 * Money in centavos (céntimos) - ALWAYS integer, NEVER float
 * 
 * ⚠️ ADVERTENCIA: El brand se PIERDE en operaciones aritméticas.
 * Después de sumar/multiplicar, DEBES re-brandear el resultado.
 * 
 * @example
 * const price: Centavos = asCentavos(2500);  // S/25.00
 * const qty = 3;
 * const total = price * qty;                  // ← Tipo es `number`!
 * const totalCents: Centavos = asCentavos(total);  // ← Re-brandear
 */
export type Centavos = Brand<number, 'Centavos'>;

/**
 * Order identifier - UUID format
 */
export type OrderId = Brand<string, 'OrderId'>;

/**
 * Shift identifier - UUID format
 */
export type ShiftId = Brand<string, 'ShiftId'>;

/**
 * Tenant identifier - UUID format
 */
export type TenantId = Brand<string, 'TenantId'>;

/**
 * Terminal identifier - string format (e.g., "MOZO-01", "CAJA-01")
 */
export type TerminalId = Brand<string, 'TerminalId'>;

/**
 * Business date in YYYY-MM-DD format
 * Used for Prisma queries where business_date expects string, not Date
 */
export type BusinessDate = Brand<string, 'BusinessDate'>;

/**
 * Employee identifier - UUID format
 */
export type EmployeeId = Brand<string, 'EmployeeId'>;

/**
 * Attendance record identifier - UUID format
 */
export type AttendanceId = Brand<string, 'AttendanceId'>;

/**
 * Schedule identifier - UUID format
 */
export type ScheduleId = Brand<string, 'ScheduleId'>;

/**
 * Leave request identifier - UUID format
 */
export type LeaveRequestId = Brand<string, 'LeaveRequestId'>;

/**
 * Advance identifier - UUID format
 */
export type AdvanceId = Brand<string, 'AdvanceId'>;

/**
 * Payroll record identifier - UUID format
 */
export type PayrollId = Brand<string, 'PayrollId'>;

/**
 * Evaluation identifier - UUID format
 */
export type EvaluationId = Brand<string, 'EvaluationId'>;

/**
 * Training record identifier - UUID format
 */
export type TrainingId = Brand<string, 'TrainingId'>;

// ============================================================================
// Type Guards & Constructors - Runtime Validation
// ============================================================================

/**
 * Creates a Centavos value with validation
 * @throws Error if value is not a non-negative integer
 */
export function asCentavos(value: number): Centavos {
  if (!Number.isInteger(value)) {
    throw new Error(`Centavos must be integer, got: ${value}`);
  }
  if (value < 0) {
    throw new Error(`Centavos must be non-negative, got: ${value}`);
  }
  return value as Centavos;
}

/**
 * Creates a Centavos value without validation (for trusted sources)
 * Use only when value is already validated (e.g., from database)
 */
export function unsafeCentavos(value: number): Centavos {
  return value as Centavos;
}

/**
 * Creates an OrderId from a UUID string
 */
export function asOrderId(value: string): OrderId {
  return value as OrderId;
}

/**
 * Creates a ShiftId from a UUID string
 */
export function asShiftId(value: string): ShiftId {
  return value as ShiftId;
}

/**
 * Creates a TenantId from a UUID string
 */
export function asTenantId(value: string): TenantId {
  return value as TenantId;
}

/**
 * Creates a TerminalId from a string
 */
export function asTerminalId(value: string): TerminalId {
  return value as TerminalId;
}

/**
 * Creates a BusinessDate from a string in YYYY-MM-DD format
 * @throws Error if format is invalid
 */
export function asBusinessDate(value: string): BusinessDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`BusinessDate must be YYYY-MM-DD format, got: ${value}`);
  }
  return value as BusinessDate;
}

/**
 * Creates an EmployeeId from a UUID string
 */
export function asEmployeeId(value: string): EmployeeId {
  return value as EmployeeId;
}

/**
 * Creates an AttendanceId from a UUID string
 */
export function asAttendanceId(value: string): AttendanceId {
  return value as AttendanceId;
}

/**
 * Creates a ScheduleId from a UUID string
 */
export function asScheduleId(value: string): ScheduleId {
  return value as ScheduleId;
}

/**
 * Creates a LeaveRequestId from a UUID string
 */
export function asLeaveRequestId(value: string): LeaveRequestId {
  return value as LeaveRequestId;
}

/**
 * Creates an AdvanceId from a UUID string
 */
export function asAdvanceId(value: string): AdvanceId {
  return value as AdvanceId;
}

/**
 * Creates a PayrollId from a UUID string
 */
export function asPayrollId(value: string): PayrollId {
  return value as PayrollId;
}

/**
 * Creates an EvaluationId from a UUID string
 */
export function asEvaluationId(value: string): EvaluationId {
  return value as EvaluationId;
}

/**
 * Creates a TrainingId from a UUID string
 */
export function asTrainingId(value: string): TrainingId {
  return value as TrainingId;
}

/**
 * Creates a BusinessDate from a Date object - PURE CONVERSION
 * 
 * ⚠️ ADVERTENCIA CRÍTICA:
 * Esta función hace conversión PURA (ignora hora de corte de 6AM).
 * 
 * Para lógica de turnos, reportes, o cualquier cosa que dependa del
 * "día de negocio", DEBES usar getBusinessDate() de business-date.ts:
 * 
 * @example
 * // 2AM del 8 de enero
 * const date = new Date('2026-01-08T02:00:00');
 * 
 * dateToBusinessDate(date)  // → "2026-01-08" ← INCORRECTO para turnos
 * getBusinessDate(date)     // → "2026-01-07" ← CORRECTO (pertenece al día anterior)
 * 
 * @see src/core/utils/business-date.ts para getBusinessDate()
 */
export function dateToBusinessDate(date: Date): BusinessDate {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}` as BusinessDate;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extracts the base type from a branded type
 */
export type Unbrand<T> = T extends Brand<infer U, string> ? U : T;

/**
 * Makes all branded types in an object optional and unbranded
 * Useful for test fixtures and partial updates
 */
export type UnbrandedPartial<T> = {
  [K in keyof T]?: Unbrand<T[K]>;
};

// ============================================================================
// RRHH (Human Resources) Types
// ============================================================================

/**
 * Employee role in the system
 */
export enum EmployeeRole {
  CASHIER = 'CASHIER',
  WAITER = 'WAITER',
  COOK = 'COOK',
  SUPERVISOR = 'SUPERVISOR',
  ADMIN = 'ADMIN',
}

/**
 * Contract type for employees
 */
export enum ContractType {
  INDEFINIDO = 'INDEFINIDO',
  PLAZO_FIJO = 'PLAZO_FIJO',
  PART_TIME = 'PART_TIME',
}

/**
 * Work schedule type
 */
export enum WorkScheduleType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  ROTATING = 'ROTATING',
}

/**
 * Leave request type
 */
export enum LeaveType {
  VACATION = 'VACATION',
  SICK_LEAVE = 'SICK_LEAVE',
  PERSONAL_LEAVE = 'PERSONAL_LEAVE',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
}

/**
 * Advance request status
 */
export enum AdvanceStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

/**
 * Payroll record status
 */
export enum PayrollStatus {
  DRAFT = 'DRAFT',
  CALCULATED = 'CALCULATED',
  PAID = 'PAID',
}

/**
 * Attendance status
 */
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  JUSTIFIED = 'JUSTIFIED',
}

/**
 * Schedule type
 */
export enum ScheduleType {
  FIXED = 'FIXED',
  ROTATING = 'ROTATING',
}

/**
 * Request status (generic for leave requests, shift changes, etc.)
 */
export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * Pension system type (Peru)
 */
export enum PensionSystem {
  ONP = 'ONP',
  AFP_INTEGRA = 'AFP_INTEGRA',
  AFP_PRIMA = 'AFP_PRIMA',
  AFP_PROFUTURO = 'AFP_PROFUTURO',
  AFP_HABITAT = 'AFP_HABITAT',
}

/**
 * Document type for employee documents
 */
export enum DocumentType {
  CONTRACT = 'CONTRACT',
  CERTIFICATE = 'CERTIFICATE',
  BACKGROUND_CHECK = 'BACKGROUND_CHECK',
  ID_COPY = 'ID_COPY',
  MEDICAL_CERTIFICATE = 'MEDICAL_CERTIFICATE',
  OTHER = 'OTHER',
}

/**
 * Training type
 */
export enum TrainingType {
  MANDATORY = 'MANDATORY',
  OPTIONAL = 'OPTIONAL',
  CERTIFICATION = 'CERTIFICATION',
}

/**
 * Evaluation status
 */
export enum EvaluationStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  REVIEWED = 'REVIEWED',
}

/**
 * Emergency contact relationship
 */
export enum EmergencyContactRelationship {
  SPOUSE = 'SPOUSE',
  PARENT = 'PARENT',
  SIBLING = 'SIBLING',
  CHILD = 'CHILD',
  FRIEND = 'FRIEND',
  OTHER = 'OTHER',
}

// ============================================================================
// RRHH Interfaces
// ============================================================================

/**
 * Employee profile (complete)
 */
export interface Employee {
  id: EmployeeId;
  tenant_id: TenantId;
  name: string;
  role: EmployeeRole;
  pin_hash: string | null;
  is_active: boolean;
  created_at: Date;
  
  // Personal information
  dni: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  birth_date: Date | null;
  profile_photo_url: string | null;
  
  // Labor information
  hire_date: Date;
  position: string;
  base_salary_cents: Centavos;
  contract_type: ContractType;
  work_schedule_type: WorkScheduleType;
  location_id: string | null;
  
  // Configuration
  commission_rate: number | null;
  pension_system: PensionSystem | null;
  has_health_insurance: boolean;
}

/**
 * Attendance record
 */
export interface Attendance {
  id: AttendanceId;
  tenant_id: TenantId;
  location_id: string;
  employee_id: EmployeeId;
  schedule_id: ScheduleId | null;
  date: BusinessDate;
  clock_in: Date;
  clock_out: Date | null;
  breaks: Break[];
  scheduled_minutes: number;
  worked_minutes: number;
  overtime_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  status: AttendanceStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Break period within an attendance record
 */
export interface Break {
  start: Date;
  end: Date;
  duration_mins: number;
}

/**
 * Schedule definition
 */
export interface Schedule {
  id: ScheduleId;
  tenant_id: TenantId;
  location_id: string;
  name: string;
  schedule_type: ScheduleType;
  days_of_week: number[]; // 1=Monday, 7=Sunday
  start_time: string; // "08:00"
  end_time: string; // "17:00"
  break_minutes: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Leave request (vacations, sick leave, etc.)
 */
export interface LeaveRequest {
  id: LeaveRequestId;
  tenant_id: TenantId;
  employee_id: EmployeeId;
  leave_type: LeaveType;
  start_date: BusinessDate;
  end_date: BusinessDate;
  days_requested: number;
  reason: string | null;
  with_pay: boolean;
  status: RequestStatus;
  approved_by: EmployeeId | null;
  approved_at: Date | null;
  rejection_reason: string | null;
  certificate_url: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Advance request (salary advance)
 */
export interface Advance {
  id: AdvanceId;
  tenant_id: TenantId;
  employee_id: EmployeeId;
  amount_cents: Centavos;
  reason: string;
  status: AdvanceStatus;
  approved_by: EmployeeId | null;
  approved_at: Date | null;
  paid_at: Date | null;
  deducted_from_payroll: PayrollId | null;
  rejection_reason: string | null;
  created_at: Date;
}

/**
 * Payroll record (monthly salary calculation)
 */
export interface PayrollRecord {
  id: PayrollId;
  tenant_id: TenantId;
  employee_id: EmployeeId;
  period_month: string; // "2026-01"
  business_date_start: BusinessDate;
  business_date_end: BusinessDate;
  
  // Salary components
  base_salary_cents: Centavos;
  commission_cents: Centavos;
  tips_cents: Centavos;
  overtime_cents: Centavos;
  bonuses_cents: Centavos;
  
  // Deductions
  advances_cents: Centavos;
  absences_cents: Centavos;
  other_deductions_cents: Centavos;
  
  // Legal contributions
  essalud_cents: Centavos;
  pension_cents: Centavos;
  
  // Totals
  gross_salary_cents: Centavos;
  net_salary_cents: Centavos;
  
  // Metadata
  days_worked: number;
  hours_worked: number;
  overtime_hours: number;
  absences_count: number;
  
  // Files
  payslip_url: string | null;
  
  // Audit
  calculated_by: EmployeeId;
  calculated_at: Date;
  paid_at: Date | null;
}

/**
 * Evaluation (performance review)
 */
export interface Evaluation {
  id: EvaluationId;
  tenant_id: TenantId;
  employee_id: EmployeeId;
  evaluator_id: EmployeeId;
  period_start: BusinessDate;
  period_end: BusinessDate;
  scores: Record<string, number>; // {punctuality: 4, quality: 5, ...}
  automatic_metrics: Record<string, number>; // {total_sales: 50000, ...}
  comments: string | null;
  employee_comments: string | null;
  goals: Goal[] | null;
  status: EvaluationStatus;
  completed_at: Date | null;
  created_at: Date;
}

/**
 * Goal for employee evaluation
 */
export interface Goal {
  goal: string;
  progress: number; // 0.0 to 1.0
}

/**
 * Training record
 */
export interface TrainingRecord {
  id: TrainingId;
  tenant_id: TenantId;
  employee_id: EmployeeId;
  training_name: string;
  training_type: TrainingType;
  provider: string | null;
  duration_hours: number | null;
  completion_date: BusinessDate;
  certificate_url: string | null;
  score: number | null; // 0-100
  notes: string | null;
  assigned_by: EmployeeId | null;
  created_at: Date;
}

/**
 * Emergency contact
 */
export interface EmergencyContact {
  id: string;
  tenant_id: TenantId;
  employee_id: EmployeeId;
  name: string;
  relationship: EmergencyContactRelationship;
  phone: string;
  address: string | null;
  is_primary: boolean;
  created_at: Date;
}

/**
 * Employee document
 */
export interface EmployeeDocument {
  id: string;
  tenant_id: TenantId;
  employee_id: EmployeeId;
  document_type: DocumentType;
  file_url: string;
  file_name: string;
  file_size: number; // bytes
  issue_date: Date | null;
  expiry_date: Date | null;
  uploaded_by: EmployeeId;
  uploaded_at: Date;
}
