/**
 * Profitability Service - Servicio de Rentabilidad
 * 
 * Proporciona análisis financiero completo para PARK POS:
 * - Cálculo de COGS desde recetas
 * - Análisis de ganancias y márgenes
 * - Reportes por producto y categoría
 * - Análisis temporal de rentabilidad
 * 
 * Características:
 * - Integración con COGSCalculator
 * - Filtros por fecha, producto y categoría
 * - Agregaciones y métricas
 * - Branded types para seguridad financiera
 * 
 * @module core/services/profitability
 */

import prisma from '@/src/core/db/prisma';
import { cogsCalculator } from '@/src/core/services/cogs-calculator';
import { logger } from '@/src/core/observability/structured-logger';
import { metrics } from '@/src/core/observability/metrics';
import {
  COGS,
  Profit,
  Margin,
  calculateProfit,
  calculateMargin,
  toCOGS,
  toProfit,
  toMargin,
  unsafeCOGS,
  unsafeProfit,
} from '@/src/core/types/profitability';
import { Centavos, unsafeCentavos } from '@/src/core/types/shared';
import { eventBus } from '@/src/core/infra/event-bus';
import { v4 as uuidv4 } from 'uuid';
import type { ProfitabilityReportGeneratedEvent } from '@/src/core/domain/events';

// ============================================================================
// Interfaces - Filtros y Parámetros
// ============================================================================

/**
 * Filtros para reportes de rentabilidad
 */
export interface ReportFilters {
  /** Fecha de inicio del período (opcional) */
  startDate?: Date;
  /** Fecha de fin del período (opcional) */
  endDate?: Date;
  /** IDs de productos a incluir (opcional) */
  productIds?: string[];
  /** IDs de categorías a incluir (opcional) */
  categoryIds?: string[];
  /** ID del tenant (requerido) */
  tenantId: string;
}

/**
 * Rango de fechas para análisis temporal
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// ============================================================================
// Interfaces - Métricas y Resultados
// ============================================================================

/**
 * Métricas financieras de un producto
 */
export interface ProductMetrics {
  /** ID del producto */
  productId: string;
  /** Nombre del producto */
  productName: string;
  /** Categoría del producto */
  category: string;
  /** ID de la categoría */
  categoryId: string;
  /** Precio de venta en centavos */
  priceCents: Centavos;
  /** COGS en centavos */
  cogsCents: COGS;
  /** Ganancia por unidad en centavos */
  profitCents: Profit;
  /** Margen de ganancia en porcentaje */
  marginPercent: Margin;
  /** Unidades vendidas en el período */
  unitsSold: number;
  /** Ingresos totales en centavos */
  totalRevenueCents: Centavos;
  /** Ganancia total en centavos */
  totalProfitCents: Profit;
}

/**
 * Reporte completo de rentabilidad
 */
export interface ProfitabilityReport {
  /** Lista de productos con métricas */
  products: ProductMetrics[];
  /** Resumen agregado */
  summary: {
    /** Ingresos totales en centavos */
    totalRevenueCents: Centavos;
    /** COGS total en centavos */
    totalCogsCents: COGS;
    /** Ganancia total en centavos */
    totalProfitCents: Profit;
    /** Margen promedio en porcentaje */
    averageMargin: Margin;
  };
  /** Período del reporte */
  period: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Análisis detallado de un producto
 */
export interface ProductAnalysis extends ProductMetrics {
  /** Desglose de receta (si existe) */
  recipe?: {
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: string;
      costCents: Centavos;
    }>;
    totalCogsCents: COGS;
  };
  /** Ventas por día */
  salesByDay: Array<{
    date: Date;
    unitsSold: number;
    revenueCents: Centavos;
    profitCents: Profit;
  }>;
}

/**
 * Métricas financieras de una categoría
 */
export interface CategoryMetrics {
  /** ID de la categoría */
  categoryId: string;
  /** Nombre de la categoría */
  categoryName: string;
  /** Cantidad de productos en la categoría */
  productCount: number;
  /** Ingresos totales en centavos */
  totalRevenueCents: Centavos;
  /** COGS total en centavos */
  totalCogsCents: COGS;
  /** Ganancia total en centavos */
  totalProfitCents: Profit;
  /** Margen promedio en porcentaje */
  averageMargin: Margin;
}

/**
 * Análisis de márgenes por categoría
 */
export interface MarginAnalysis {
  /** Lista de categorías con métricas */
  categories: CategoryMetrics[];
  /** Resumen agregado */
  summary: {
    /** Ingresos totales en centavos */
    totalRevenueCents: Centavos;
    /** Ganancia total en centavos */
    totalProfitCents: Profit;
    /** Margen general en porcentaje */
    overallMargin: Margin;
  };
}

// ============================================================================
// Servicio de Rentabilidad
// ============================================================================

/**
 * Servicio de análisis de rentabilidad
 * 
 * Proporciona métodos para calcular y analizar la rentabilidad
 * de productos y categorías en PARK POS.
 */
export class ProfitabilityService {
  /**
   * Obtiene un reporte completo de rentabilidad
   * 
   * Calcula métricas financieras para todos los productos que cumplen
   * con los filtros especificados, incluyendo COGS, ganancia y margen.
   * 
   * @param filters - Filtros para el reporte
   * @returns Reporte completo con productos y resumen
   * 
   * @example
   * const service = new ProfitabilityService();
   * const report = await service.getProfitabilityReport({
   *   startDate: new Date('2026-01-01'),
   *   endDate: new Date('2026-01-31'),
   *   tenantId: 'tenant_123',
   * });
   */
  async getProfitabilityReport(filters: ReportFilters): Promise<ProfitabilityReport> {
    const startTime = Date.now();
    
    try {
      logger.info('Generating profitability report', { filters });
      
      // 1. Obtener órdenes del período
      const orders = await prisma.orders.findMany({
        where: {
          tenant_id: filters.tenantId,
          created_at: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        },
      });
      
      logger.debug('Orders retrieved', { count: orders.length });
      
      // 3. Extraer items de las órdenes y agrupar por producto
      const productMap = new Map<string, ProductMetrics>();
      
      for (const order of orders) {
        const items = order.items as any[];
        
        if (!Array.isArray(items)) continue;
        
        for (const item of items) {
          const productId = item.productId;
          
          // Aplicar filtros de producto y categoría
          if (filters.productIds && !filters.productIds.includes(productId)) {
            continue;
          }
          
          // Inicializar métricas si no existen
          if (!productMap.has(productId)) {
            // Obtener producto de la base de datos
            const product = await prisma.products.findFirst({
              where: {
                tenant_id: filters.tenantId,
                id: productId,
              },
            });
            
            if (!product) continue;
            
            // Aplicar filtro de categoría
            if (filters.categoryIds && !filters.categoryIds.includes(product.category)) {
              continue;
            }
            
            // Calcular COGS del producto
            const cogs = await cogsCalculator.calculateFromRecipe(
              productId,
              filters.tenantId
            );
            
            // Calcular ganancia y margen
            const profit = calculateProfit(unsafeCentavos(product.price_cents), cogs);
            const margin = calculateMargin(profit, unsafeCentavos(product.price_cents));
            
            productMap.set(productId, {
              productId,
              productName: product.name,
              category: product.category,
              categoryId: product.category,
              priceCents: unsafeCentavos(product.price_cents),
              cogsCents: cogs,
              profitCents: profit,
              marginPercent: margin,
              unitsSold: 0,
              totalRevenueCents: unsafeCentavos(0),
              totalProfitCents: toProfit(0),
            });
          }
          
          // Actualizar totales
          const metrics = productMap.get(productId)!;
          metrics.unitsSold += item.quantity;
          metrics.totalRevenueCents = unsafeCentavos(
            metrics.totalRevenueCents + item.priceCents * item.quantity
          );
          metrics.totalProfitCents = unsafeProfit(
            metrics.totalProfitCents + metrics.profitCents * item.quantity
          );
        }
      }
      
      // 4. Convertir a array y ordenar por ganancia total descendente
      const products = Array.from(productMap.values())
        .sort((a, b) => b.totalProfitCents - a.totalProfitCents);
      
      // 5. Calcular resumen agregado
      const summary = this.calculateSummary(products);
      
      // 6. Determinar período del reporte
      const period = {
        startDate: filters.startDate || new Date(0),
        endDate: filters.endDate || new Date(),
      };
      
      // 7. Emitir evento PROFITABILITY_REPORT_GENERATED para auditoría
      await this.emitProfitabilityReportGeneratedEvent({
        tenantId: filters.tenantId,
        reportType: 'FULL',
        periodStart: period.startDate,
        periodEnd: period.endDate,
        productCount: products.length,
        totalRevenueCents: summary.totalRevenueCents,
        totalProfitCents: summary.totalProfitCents,
        averageMargin: summary.averageMargin,
        filters: {
          productIds: filters.productIds,
          categoryIds: filters.categoryIds,
        }
      });
      
      logger.info('Profitability report generated', {
        productCount: products.length,
        totalRevenue: summary.totalRevenueCents,
        totalProfit: summary.totalProfitCents,
        averageMargin: summary.averageMargin,
      });
      
      metrics.timing('profitability.report.generate', Date.now() - startTime);
      metrics.increment('profitability.report.generated');
      
      return {
        products,
        summary,
        period,
      };
      
    } catch (error) {
      logger.error('Failed to generate profitability report', error as Error, { filters });
      metrics.increment('profitability.report.error');
      throw error;
    }
  }
  
  /**
   * Obtiene análisis detallado de un producto
   * 
   * Incluye métricas financieras, desglose de receta y ventas por día.
   * 
   * @param productId - ID del producto
   * @param period - Rango de fechas para análisis
   * @param tenantId - ID del tenant
   * @returns Análisis detallado del producto
   * 
   * @example
   * const analysis = await service.getProductAnalysis(
   *   'prod_123',
   *   {
   *     startDate: new Date('2026-01-01'),
   *     endDate: new Date('2026-01-31'),
   *   },
   *   'tenant_123'
   * );
   */
  async getProductAnalysis(
    productId: string,
    period: DateRange,
    tenantId: string
  ): Promise<ProductAnalysis> {
    const startTime = Date.now();
    
    try {
      logger.info('Generating product analysis', { productId, period, tenantId });
      
      // 1. Obtener producto
      const product = await prisma.products.findFirst({
        where: {
          tenant_id: tenantId,
          id: productId,
        },
      });
      
      if (!product) {
        throw new Error(`Producto no encontrado: ${productId}`);
      }
      
      // 2. Calcular COGS
      const cogs = await cogsCalculator.calculateFromRecipe(productId, tenantId);
      
      // 3. Calcular ganancia y margen
      const profit = calculateProfit(unsafeCentavos(product.price_cents), cogs);
      const margin = calculateMargin(profit, unsafeCentavos(product.price_cents));
      
      // 4. Obtener ventas del período
      const orders = await prisma.orders.findMany({
        where: {
          tenant_id: tenantId,
          created_at: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
      });
      
      // Extraer items del producto específico
      const productItems: Array<{ quantity: number; priceCents: number; createdAt: Date }> = [];
      
      for (const order of orders) {
        const items = order.items as any[];
        
        if (!Array.isArray(items)) continue;
        
        for (const item of items) {
          if (item.productId === productId) {
            productItems.push({
              quantity: item.quantity,
              priceCents: item.priceCents,
              createdAt: order.created_at,
            });
          }
        }
      }
      
      // 5. Calcular totales
      const unitsSold = productItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalRevenueCents = productItems.reduce(
        (sum, item) => sum + item.priceCents * item.quantity,
        0
      );
      const totalProfitCents = unitsSold * profit;
      
      // 6. Obtener desglose de receta (si existe)
      const recipe = await this.getRecipeBreakdown(productId, tenantId);
      
      // 7. Calcular ventas por día
      const salesByDay = this.calculateSalesByDay(productItems, profit);
      
      // 8. Emitir evento PROFITABILITY_REPORT_GENERATED para auditoría
      await this.emitProfitabilityReportGeneratedEvent({
        tenantId,
        reportType: 'BY_PRODUCT',
        periodStart: period.startDate,
        periodEnd: period.endDate,
        productCount: 1,
        totalRevenueCents: unsafeCentavos(totalRevenueCents),
        totalProfitCents: toProfit(totalProfitCents),
        averageMargin: margin,
        filters: {
          productIds: [productId],
        }
      });
      
      logger.info('Product analysis generated', {
        productId,
        unitsSold,
        totalRevenue: totalRevenueCents,
        totalProfit: totalProfitCents,
      });
      
      metrics.timing('profitability.product_analysis.generate', Date.now() - startTime);
      metrics.increment('profitability.product_analysis.generated');
      
      return {
        productId,
        productName: product.name,
        category: product.category,
        categoryId: product.category,
        priceCents: unsafeCentavos(product.price_cents),
        cogsCents: cogs,
        profitCents: profit,
        marginPercent: margin,
        unitsSold,
        totalRevenueCents: unsafeCentavos(totalRevenueCents),
        totalProfitCents: toProfit(totalProfitCents),
        recipe,
        salesByDay,
      };
      
    } catch (error) {
      logger.error('Failed to generate product analysis', error as Error, {
        productId,
        period,
        tenantId,
      });
      metrics.increment('profitability.product_analysis.error');
      throw error;
    }
  }
  
  /**
   * Obtiene análisis de márgenes por categoría
   * 
   * Agrupa productos por categoría y calcula métricas financieras
   * para cada una, ordenadas por ganancia total descendente.
   * 
   * @param filters - Filtros para el análisis
   * @returns Análisis de márgenes por categoría
   * 
   * @example
   * const analysis = await service.getMarginAnalysis({
   *   startDate: new Date('2026-01-01'),
   *   endDate: new Date('2026-01-31'),
   *   tenantId: 'tenant_123',
   * });
   */
  async getMarginAnalysis(filters: ReportFilters): Promise<MarginAnalysis> {
    const startTime = Date.now();
    
    try {
      logger.info('Generating margin analysis', { filters });
      
      // 1. Obtener reporte completo primero
      const report = await this.getProfitabilityReport(filters);
      
      // 2. Agrupar por categoría
      const categoryMap = new Map<string, CategoryMetrics>();
      
      for (const product of report.products) {
        const categoryId = product.categoryId;
        
        // Inicializar métricas si no existen
        if (!categoryMap.has(categoryId)) {
          categoryMap.set(categoryId, {
            categoryId,
            categoryName: product.category,
            productCount: 0,
            totalRevenueCents: unsafeCentavos(0),
            totalCogsCents: toCOGS(0),
            totalProfitCents: toProfit(0),
            averageMargin: toMargin(0),
          });
        }
        
        // Actualizar totales
        const metrics = categoryMap.get(categoryId)!;
        metrics.productCount += 1;
        metrics.totalRevenueCents = unsafeCentavos(
          metrics.totalRevenueCents + product.totalRevenueCents
        );
        metrics.totalCogsCents = unsafeCOGS(
          metrics.totalCogsCents + product.cogsCents * product.unitsSold
        );
        metrics.totalProfitCents = unsafeProfit(
          metrics.totalProfitCents + product.totalProfitCents
        );
      }
      
      // 3. Calcular margen promedio por categoría
      for (const metrics of categoryMap.values()) {
        metrics.averageMargin = calculateMargin(
          metrics.totalProfitCents,
          metrics.totalRevenueCents
        );
      }
      
      // 4. Convertir a array y ordenar por ganancia total descendente
      const categories = Array.from(categoryMap.values())
        .sort((a, b) => b.totalProfitCents - a.totalProfitCents);
      
      // 5. Calcular resumen agregado
      const summary = {
        totalRevenueCents: report.summary.totalRevenueCents,
        totalProfitCents: report.summary.totalProfitCents,
        overallMargin: report.summary.averageMargin,
      };
      
      // 6. Emitir evento PROFITABILITY_REPORT_GENERATED para auditoría
      await this.emitProfitabilityReportGeneratedEvent({
        tenantId: filters.tenantId,
        reportType: 'MARGIN_ANALYSIS',
        periodStart: filters.startDate || new Date(0),
        periodEnd: filters.endDate || new Date(),
        productCount: report.products.length,
        totalRevenueCents: summary.totalRevenueCents,
        totalProfitCents: summary.totalProfitCents,
        averageMargin: summary.overallMargin,
        filters: {
          productIds: filters.productIds,
          categoryIds: filters.categoryIds,
        }
      });
      
      logger.info('Margin analysis generated', {
        categoryCount: categories.length,
        totalRevenue: summary.totalRevenueCents,
        totalProfit: summary.totalProfitCents,
        overallMargin: summary.overallMargin,
      });
      
      metrics.timing('profitability.margin_analysis.generate', Date.now() - startTime);
      metrics.increment('profitability.margin_analysis.generated');
      
      return {
        categories,
        summary,
      };
      
    } catch (error) {
      logger.error('Failed to generate margin analysis', error as Error, { filters });
      metrics.increment('profitability.margin_analysis.error');
      throw error;
    }
  }
  
  // ============================================================================
  // Métodos Privados - Helpers
  // ============================================================================
  
  /**
   * Calcula el resumen agregado de un reporte
   */
  private calculateSummary(products: ProductMetrics[]) {
    const totalRevenueCents = products.reduce(
      (sum, p) => sum + p.totalRevenueCents,
      0
    );
    
    const totalCogsCents = products.reduce(
      (sum, p) => sum + p.cogsCents * p.unitsSold,
      0
    );
    
    const totalProfitCents = products.reduce(
      (sum, p) => sum + p.totalProfitCents,
      0
    );
    
    const averageMargin = calculateMargin(
      toProfit(totalProfitCents),
      unsafeCentavos(totalRevenueCents)
    );
    
    return {
      totalRevenueCents: unsafeCentavos(totalRevenueCents),
      totalCogsCents: toCOGS(totalCogsCents),
      totalProfitCents: toProfit(totalProfitCents),
      averageMargin,
    };
  }
  
  /**
   * Obtiene el desglose de receta de un producto
   */
  private async getRecipeBreakdown(
    productId: string,
    tenantId: string
  ): Promise<ProductAnalysis['recipe'] | undefined> {
    try {
      const recipe = await prisma.recipes.findUnique({
        where: {
          tenant_id_product_id: {
            tenant_id: tenantId,
            product_id: productId,
          },
        },
      });
      
      if (!recipe || !recipe.is_active) {
        return undefined;
      }
      
      const ingredients = recipe.ingredients as any;
      
      if (!Array.isArray(ingredients) || ingredients.length === 0) {
        return undefined;
      }
      
      // Obtener detalles de cada ingrediente
      const ingredientDetails = await Promise.all(
        ingredients.map(async (ing: any) => {
          const item = await prisma.inventory.findUnique({
            where: {
              tenant_id_code: {
                tenant_id: tenantId,
                code: ing.inventory_code,
              },
            },
          });
          
          const costCents = item?.cost_cents || 0;
          
          return {
            name: item?.name || ing.inventory_code,
            quantity: ing.quantity,
            unit: ing.unit,
            costCents: unsafeCentavos(costCents * ing.quantity),
          };
        })
      );
      
      const totalCogsCents = ingredientDetails.reduce(
        (sum, ing) => sum + ing.costCents,
        0
      );
      
      return {
        ingredients: ingredientDetails,
        totalCogsCents: toCOGS(totalCogsCents),
      };
      
    } catch (error) {
      logger.error('Failed to get recipe breakdown', error as Error, {
        productId,
        tenantId,
      });
      return undefined;
    }
  }
  
  /**
   * Calcula ventas por día desde items de productos
   */
  private calculateSalesByDay(
    productItems: Array<{ quantity: number; priceCents: number; createdAt: Date }>,
    profitPerUnit: Profit
  ): ProductAnalysis['salesByDay'] {
    // Agrupar por día
    const dayMap = new Map<string, {
      date: Date;
      unitsSold: number;
      revenueCents: number;
    }>();
    
    for (const item of productItems) {
      const date = new Date(item.createdAt);
      const dayKey = date.toISOString().split('T')[0];
      
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, {
          date: new Date(dayKey),
          unitsSold: 0,
          revenueCents: 0,
        });
      }
      
      const day = dayMap.get(dayKey)!;
      day.unitsSold += item.quantity;
      day.revenueCents += item.priceCents * item.quantity;
    }
    
    // Convertir a array y calcular ganancia
    return Array.from(dayMap.values())
      .map((day) => ({
        date: day.date,
        unitsSold: day.unitsSold,
        revenueCents: unsafeCentavos(day.revenueCents),
        profitCents: toProfit(day.unitsSold * profitPerUnit),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  // ============================================================================
  // Métodos Privados - Emisión de Eventos
  // ============================================================================
  
  /**
   * Emite evento PROFITABILITY_REPORT_GENERATED para auditoría
   * 
   * @param params - Parámetros del evento
   */
  private async emitProfitabilityReportGeneratedEvent(params: {
    tenantId: string;
    reportType: 'FULL' | 'BY_PRODUCT' | 'BY_CATEGORY' | 'MARGIN_ANALYSIS';
    periodStart: Date;
    periodEnd: Date;
    productCount: number;
    totalRevenueCents: Centavos;
    totalProfitCents: Profit;
    averageMargin: Margin;
    filters?: {
      productIds?: string[];
      categoryIds?: string[];
    };
    generatedBy?: string;
  }): Promise<void> {
    try {
      const reportId = uuidv4();
      
      const event: ProfitabilityReportGeneratedEvent = {
        // Identity
        event_id: uuidv4(),
        tenant_id: params.tenantId,
        
        // Terminal info
        terminal_id: 'profitability-service',
        terminal_sequence: 0,
        
        // Time
        occurred_at: new Date().toISOString(),
        
        // Aggregate
        aggregate_type: 'INVENTORY',
        aggregate_id: reportId,
        
        // Event type and payload
        event_type: 'PROFITABILITY_REPORT_GENERATED',
        payload: {
          report_id: reportId,
          generated_at: new Date().toISOString(),
          period_start: params.periodStart.toISOString(),
          period_end: params.periodEnd.toISOString(),
          total_products: params.productCount,
          generated_by: params.generatedBy || uuidv4(), // Requerido en el schema
        },
        
        // Tracing
        correlation_id: uuidv4(),
        causation_id: null,
        
        // Actor
        actor_id: params.generatedBy || null,
        actor_role_snapshot: null,
        
        // Version
        schema_version: 1,
        payload_version: 1,
        
        // Context
        shift_id: null,
        business_date: null,
      };
      
      // Publicar evento al event bus
      await eventBus.publish(params.tenantId, event);
      
      logger.debug('PROFITABILITY_REPORT_GENERATED event emitted', {
        reportId,
        reportType: params.reportType,
        tenantId: params.tenantId,
        productCount: params.productCount,
        eventId: event.event_id,
      });
      
      metrics.increment('profitability.event.emitted', { 
        eventType: 'PROFITABILITY_REPORT_GENERATED',
        reportType: params.reportType,
      });
      
    } catch (error) {
      logger.error('Failed to emit PROFITABILITY_REPORT_GENERATED event', error as Error, {
        reportType: params.reportType,
        tenantId: params.tenantId,
      });
      
      metrics.increment('profitability.event.error', { 
        eventType: 'PROFITABILITY_REPORT_GENERATED',
        reportType: params.reportType,
      });
      
      // No lanzar error - la emisión de eventos no debe bloquear el flujo principal
    }
  }
}

/**
 * Instancia singleton del servicio de rentabilidad
 */
export const profitabilityService = new ProfitabilityService();
