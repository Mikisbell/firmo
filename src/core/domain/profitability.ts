/**
 * Profitability Domain - Lógica de Negocio de Rentabilidad
 * 
 * Este archivo contiene las funciones de cálculo y helpers para el módulo de rentabilidad.
 * Todas las funciones usan branded types para seguridad de tipos.
 * 
 * Fórmulas:
 * - Ganancia = Precio - COGS
 * - Margen = (Ganancia / Precio) × 100
 * 
 * @see src/core/types/profitability.ts para definiciones de tipos
 */

import { Centavos } from '@/src/core/types/shared';
import { COGS, Profit, Margin, toProfit, toMargin } from '@/src/core/types/profitability';

// ============================================================================
// Funciones de Cálculo - Lógica de Negocio
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
 * const price = asCentavos(3500);  // S/35.00
 * const cogs = toCOGS(2050);       // S/20.50
 * const profit = calculateProfit(price, cogs);  // 1450 cents = S/14.50
 */
export function calculateProfit(price: Centavos, cogs: COGS): Profit {
  const profitCents = price - cogs;
  return toProfit(profitCents);
}

/**
 * Calcula el margen de ganancia de un producto
 * 
 * Fórmula: Margen = (Ganancia / Precio) × 100
 * 
 * Casos especiales:
 * - Si precio = 0, retorna margen = 0 (evita división por cero)
 * - Si ganancia < 0, retorna margen negativo (pérdida)
 * 
 * @param profit - Ganancia en centavos
 * @param price - Precio de venta en centavos
 * @returns Margen como porcentaje con 2 decimales
 * 
 * @example
 * const profit = toProfit(1450);   // S/14.50
 * const price = asCentavos(3500);  // S/35.00
 * const margin = calculateMargin(profit, price);  // 41.43%
 * 
 * @example
 * // Caso de pérdida
 * const loss = toProfit(-500);     // -S/5.00
 * const price = asCentavos(2000);  // S/20.00
 * const margin = calculateMargin(loss, price);  // -25.00%
 */
export function calculateMargin(profit: Profit, price: Centavos): Margin {
  // Caso especial: precio cero
  if (price === 0) {
    return toMargin(0);
  }
  
  // Calcular margen: (ganancia / precio) × 100
  const marginPercent = (profit / price) * 100;
  
  // Redondear a 2 decimales
  const rounded = Math.round(marginPercent * 100) / 100;
  
  // Clampear al rango válido [-100, 100]
  // Esto puede ocurrir cuando profit > price (margen > 100%)
  // o cuando profit < -price (margen < -100%)
  const clamped = Math.max(-100, Math.min(100, rounded));
  
  return toMargin(clamped);
}

/**
 * Calcula ganancia y margen de un producto en una sola operación
 * 
 * Útil cuando necesitas ambos valores para evitar cálculos duplicados.
 * 
 * @param price - Precio de venta en centavos
 * @param cogs - Costo de producción en centavos
 * @returns Objeto con ganancia y margen
 * 
 * @example
 * const price = asCentavos(3500);
 * const cogs = toCOGS(2050);
 * const { profit, margin } = calculateProfitAndMargin(price, cogs);
 * // profit = 1450 cents, margin = 41.43%
 */
export function calculateProfitAndMargin(
  price: Centavos,
  cogs: COGS
): { profit: Profit; margin: Margin } {
  const profit = calculateProfit(price, cogs);
  const margin = calculateMargin(profit, price);
  
  return { profit, margin };
}

// ============================================================================
// Helpers de Conversión - Formateo y Display
// ============================================================================

/**
 * Formatea un valor en centavos a string con símbolo de moneda
 * 
 * @param cents - Valor en centavos
 * @returns String formateado (ej: "S/ 35.00")
 * 
 * @example
 * formatCents(3500)   // "S/ 35.00"
 * formatCents(-500)   // "S/ -5.00"
 * formatCents(0)      // "S/ 0.00"
 */
export function formatCents(cents: number): string {
  const soles = cents / 100;
  return `S/ ${soles.toFixed(2)}`;
}

/**
 * Formatea un margen a string con símbolo de porcentaje
 * 
 * @param margin - Margen como porcentaje
 * @returns String formateado (ej: "41.43%")
 * 
 * @example
 * formatMargin(toMargin(41.43))   // "41.43%"
 * formatMargin(toMargin(-20))     // "-20.00%"
 * formatMargin(toMargin(0))       // "0.00%"
 */
export function formatMargin(margin: Margin): string {
  return `${margin.toFixed(2)}%`;
}

/**
 * Formatea COGS a string con símbolo de moneda
 * 
 * @param cogs - COGS en centavos
 * @returns String formateado (ej: "S/ 20.50")
 */
export function formatCOGS(cogs: COGS): string {
  return formatCents(cogs);
}

/**
 * Formatea Profit a string con símbolo de moneda
 * 
 * @param profit - Profit en centavos
 * @returns String formateado (ej: "S/ 14.50")
 */
export function formatProfit(profit: Profit): string {
  return formatCents(profit);
}

// ============================================================================
// Validadores de Rangos - Validación de Negocio
// ============================================================================

/**
 * Valida que un precio sea válido para cálculos de rentabilidad
 * 
 * Reglas:
 * - Debe ser >= 0
 * - Debe ser integer
 * 
 * @param price - Precio a validar
 * @returns true si es válido
 * @throws Error si es inválido
 */
export function validatePrice(price: Centavos): boolean {
  if (!Number.isInteger(price)) {
    throw new Error(`Precio debe ser integer, recibido: ${price}`);
  }
  if (price < 0) {
    throw new Error(`Precio no puede ser negativo, recibido: ${price}`);
  }
  return true;
}

/**
 * Valida que un COGS sea válido
 * 
 * Reglas:
 * - Debe ser >= 0
 * - Debe ser integer
 * 
 * @param cogs - COGS a validar
 * @returns true si es válido
 * @throws Error si es inválido
 */
export function validateCOGS(cogs: COGS): boolean {
  if (!Number.isInteger(cogs)) {
    throw new Error(`COGS debe ser integer, recibido: ${cogs}`);
  }
  if (cogs < 0) {
    throw new Error(`COGS no puede ser negativo, recibido: ${cogs}`);
  }
  return true;
}

/**
 * Valida que un margen esté en el rango válido
 * 
 * Reglas:
 * - Debe estar en rango [-100, 100]
 * 
 * @param margin - Margen a validar
 * @returns true si es válido
 * @throws Error si es inválido
 */
export function validateMargin(margin: Margin): boolean {
  if (margin < -100 || margin > 100) {
    throw new Error(`Margin debe estar en rango [-100, 100], recibido: ${margin}`);
  }
  return true;
}

/**
 * Valida que una cantidad sea válida
 * 
 * Reglas:
 * - Debe ser > 0
 * - Debe ser number (puede ser decimal para ingredientes)
 * 
 * @param quantity - Cantidad a validar
 * @returns true si es válido
 * @throws Error si es inválido
 */
export function validateQuantity(quantity: number): boolean {
  if (typeof quantity !== 'number' || isNaN(quantity)) {
    throw new Error(`Cantidad debe ser un número, recibido: ${quantity}`);
  }
  if (quantity <= 0) {
    throw new Error(`Cantidad debe ser mayor a cero, recibido: ${quantity}`);
  }
  return true;
}

// ============================================================================
// Helpers de Agregación - Cálculos sobre Múltiples Items
// ============================================================================

/**
 * Suma múltiples valores de COGS
 * 
 * @param cogsArray - Array de COGS a sumar
 * @returns COGS total
 * 
 * @example
 * const cogs1 = toCOGS(1000);
 * const cogs2 = toCOGS(500);
 * const total = sumCOGS([cogs1, cogs2]);  // 1500 cents
 */
export function sumCOGS(cogsArray: COGS[]): COGS {
  const total = cogsArray.reduce((sum, cogs) => sum + cogs, 0);
  return toProfit(total) as unknown as COGS;  // Safe cast: sum of COGS is COGS
}

/**
 * Suma múltiples valores de Profit
 * 
 * @param profitArray - Array de Profit a sumar
 * @returns Profit total
 * 
 * @example
 * const profit1 = toProfit(1450);
 * const profit2 = toProfit(-500);
 * const total = sumProfit([profit1, profit2]);  // 950 cents
 */
export function sumProfit(profitArray: Profit[]): Profit {
  const total = profitArray.reduce((sum, profit) => sum + profit, 0);
  return toProfit(total);
}

/**
 * Calcula el margen promedio de múltiples productos
 * 
 * Usa promedio ponderado por precio de venta.
 * 
 * @param items - Array de items con profit y price
 * @returns Margen promedio ponderado
 * 
 * @example
 * const items = [
 *   { profit: toProfit(1450), price: asCentavos(3500) },
 *   { profit: toProfit(500), price: asCentavos(2000) }
 * ];
 * const avgMargin = calculateAverageMargin(items);
 */
export function calculateAverageMargin(
  items: Array<{ profit: Profit; price: Centavos }>
): Margin {
  if (items.length === 0) {
    return toMargin(0);
  }
  
  // Calcular totales
  const totalProfit = items.reduce((sum, item) => sum + item.profit, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  
  // Calcular margen promedio ponderado
  return calculateMargin(toProfit(totalProfit), totalPrice as Centavos);
}
