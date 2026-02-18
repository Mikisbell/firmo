/**
 * Profitability Types - Tipos de Rentabilidad
 * 
 * Este archivo define los branded types específicos para el módulo de rentabilidad.
 * Todos los valores monetarios usan Centavos (integer) para prevenir errores de redondeo.
 * 
 * ⚠️ LIMITACIONES DE BRANDED TYPES:
 * - Se pierden en operaciones aritméticas (debes re-brandear el resultado)
 * - Son "opt-in" (TypeScript no los fuerza estrictamente)
 * 
 * @see src/core/types/shared.ts para más detalles sobre branded types
 */

import { Centavos } from './shared';

// ============================================================================
// Branded Types para Rentabilidad
// ============================================================================

/**
 * COGS (Cost of Goods Sold) - Costo de los bienes vendidos
 * 
 * Representa el costo de producción de un producto, calculado desde su receta.
 * SIEMPRE en centavos (integer), NUNCA negativo.
 * 
 * @example
 * const cogs: COGS = toCOGS(2050);  // S/20.50 de costo
 */
export type COGS = Centavos & { readonly __brand: 'COGS' };

/**
 * Profit - Ganancia
 * 
 * Representa la ganancia de un producto (Precio - COGS).
 * SIEMPRE en centavos (integer), PUEDE ser negativo (pérdida).
 * 
 * @example
 * const profit: Profit = toProfit(1450);  // S/14.50 de ganancia
 * const loss: Profit = toProfit(-500);    // S/5.00 de pérdida
 */
export type Profit = Centavos & { readonly __brand: 'Profit' };

/**
 * Margin - Margen de ganancia
 * 
 * Representa el margen de ganancia como porcentaje ((Ganancia / Precio) × 100).
 * Rango válido: [-100, 100]
 * - Positivo: ganancia
 * - Negativo: pérdida
 * - 0: sin ganancia ni pérdida
 * 
 * @example
 * const margin: Margin = toMargin(41.43);   // 41.43% de margen
 * const lossMargin: Margin = toMargin(-20); // -20% (pérdida)
 */
export type Margin = number & { readonly __brand: 'Margin' };

// ============================================================================
// Type Guards & Constructors - Validación en Runtime
// ============================================================================

/**
 * Crea un valor COGS con validación
 * 
 * @param cents - Valor en centavos
 * @returns COGS validado
 * @throws Error si el valor no es un integer no-negativo
 * 
 * @example
 * const cogs = toCOGS(2050);  // OK
 * const invalid = toCOGS(-100);  // ERROR: COGS no puede ser negativo
 * const invalid2 = toCOGS(20.5);  // ERROR: COGS debe ser integer
 */
export function toCOGS(cents: number): COGS {
  if (!Number.isInteger(cents)) {
    throw new Error(`COGS debe ser integer, recibido: ${cents}`);
  }
  if (cents < 0) {
    throw new Error(`COGS no puede ser negativo, recibido: ${cents}`);
  }
  return cents as COGS;
}

/**
 * Crea un valor COGS sin validación (para fuentes confiables)
 * 
 * Usar SOLO cuando el valor ya está validado (ej: desde base de datos).
 * 
 * @param cents - Valor en centavos (ya validado)
 * @returns COGS sin validación
 * 
 * @example
 * const cogsFromDB = unsafeCOGS(dbRecord.cogs_cents);  // OK, ya validado por Prisma
 */
export function unsafeCOGS(cents: number): COGS {
  return cents as COGS;
}

/**
 * Crea un valor Profit con validación
 * 
 * @param cents - Valor en centavos (puede ser negativo para pérdidas)
 * @returns Profit validado
 * @throws Error si el valor no es un integer
 * 
 * @example
 * const profit = toProfit(1450);   // OK: S/14.50 ganancia
 * const loss = toProfit(-500);     // OK: S/5.00 pérdida
 * const invalid = toProfit(14.5);  // ERROR: Profit debe ser integer
 */
export function toProfit(cents: number): Profit {
  if (!Number.isInteger(cents)) {
    throw new Error(`Profit debe ser integer, recibido: ${cents}`);
  }
  return cents as Profit;
}

/**
 * Crea un valor Profit sin validación (para fuentes confiables)
 * 
 * @param cents - Valor en centavos (ya validado)
 * @returns Profit sin validación
 */
export function unsafeProfit(cents: number): Profit {
  return cents as Profit;
}

/**
 * Crea un valor Margin con validación
 * 
 * @param percentage - Porcentaje de margen
 * @returns Margin validado
 * @throws Error si el valor está fuera del rango [-100, 100]
 * 
 * @example
 * const margin = toMargin(41.43);    // OK: 41.43%
 * const loss = toMargin(-20);        // OK: -20% pérdida
 * const invalid = toMargin(150);     // ERROR: fuera de rango
 */
export function toMargin(percentage: number): Margin {
  if (percentage < -100 || percentage > 100) {
    throw new Error(`Margin debe estar en rango [-100, 100], recibido: ${percentage}`);
  }
  return percentage as Margin;
}

/**
 * Crea un valor Margin sin validación (para fuentes confiables)
 * 
 * @param percentage - Porcentaje (ya validado)
 * @returns Margin sin validación
 */
export function unsafeMargin(percentage: number): Margin {
  return percentage as Margin;
}

// ============================================================================
// Type Guards - Verificación de Tipos
// ============================================================================

/**
 * Verifica si un valor es un COGS válido
 * 
 * @param value - Valor a verificar
 * @returns true si es un COGS válido
 */
export function isCOGS(value: unknown): value is COGS {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Verifica si un valor es un Profit válido
 * 
 * @param value - Valor a verificar
 * @returns true si es un Profit válido
 */
export function isProfit(value: unknown): value is Profit {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Verifica si un valor es un Margin válido
 * 
 * @param value - Valor a verificar
 * @returns true si es un Margin válido
 */
export function isMargin(value: unknown): value is Margin {
  return typeof value === 'number' && value >= -100 && value <= 100;
}

// ============================================================================
// Cálculos de Rentabilidad
// ============================================================================

/**
 * Calcula la ganancia de un producto
 * 
 * Fórmula: Ganancia = Precio - COGS
 * 
 * @param price - Precio de venta en centavos
 * @param cogs - Costo de producción en centavos
 * @returns Ganancia en centavos (puede ser negativa si hay pérdida)
 * 
 * @example
 * const price = 3500;  // S/35.00
 * const cogs = toCOGS(2050);  // S/20.50
 * const profit = calculateProfit(price, cogs);  // 1450 centavos = S/14.50
 * 
 * @example
 * // Caso de pérdida
 * const price = 1000;  // S/10.00
 * const cogs = toCOGS(1500);  // S/15.00
 * const loss = calculateProfit(price, cogs);  // -500 centavos = -S/5.00
 */
export function calculateProfit(price: Centavos, cogs: COGS): Profit {
  return toProfit(price - cogs);
}

/**
 * Calcula el margen de ganancia de un producto
 * 
 * Fórmula: Margen = (Ganancia / Precio) × 100
 * 
 * Casos especiales:
 * - Si precio = 0, retorna margen = 0 (evita división por cero)
 * - Redondea a 2 decimales para consistencia
 * 
 * @param profit - Ganancia en centavos
 * @param price - Precio de venta en centavos
 * @returns Margen como porcentaje en rango [-100, 100]
 * 
 * @example
 * const profit = toProfit(1450);  // S/14.50
 * const price = 3500;  // S/35.00
 * const margin = calculateMargin(profit, price);  // 41.43%
 * 
 * @example
 * // Caso de pérdida
 * const loss = toProfit(-500);  // -S/5.00
 * const price = 1000;  // S/10.00
 * const margin = calculateMargin(loss, price);  // -50%
 * 
 * @example
 * // Caso de precio cero
 * const profit = toProfit(0);
 * const price = 0;
 * const margin = calculateMargin(profit, price);  // 0%
 */
export function calculateMargin(profit: Profit, price: Centavos): Margin {
  // Manejo de división por cero
  if (price === 0) {
    return toMargin(0);
  }
  
  // Calcular margen: (ganancia / precio) × 100
  const marginPercent = (profit / price) * 100;
  
  // Redondear a 2 decimales
  const rounded = Math.round(marginPercent * 100) / 100;
  
  return toMargin(rounded);
}
