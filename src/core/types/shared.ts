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
