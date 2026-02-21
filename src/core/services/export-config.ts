/**
 * Export Config Registry - Defines export configurations per entity
 *
 * Each entity has columns definition and a query function to fetch data.
 * Used by UniversalExportService.
 *
 * @module core/services/export-config
 */

import type { PrismaClient } from '@prisma/client';
import type { ExportColumn } from './export.service';

// ============================================================================
// Types
// ============================================================================

export interface ExportEntityConfig {
  key: string;
  label: string;
  columns: ExportColumn[];
  queryFn: (prisma: PrismaClient, tenantId: string, filters?: ExportFilters) => Promise<Record<string, unknown>[]>;
}

export interface ExportFilters {
  start?: string;
  end?: string;
  status?: string;
  locationId?: string;
}

// ============================================================================
// Entity Configs
// ============================================================================

const ventasConfig: ExportEntityConfig = {
  key: 'ventas',
  label: 'Reporte de Ventas',
  columns: [
    { header: 'Fecha', key: 'date', width: 15, format: 'date' },
    { header: 'Órdenes', key: 'orderCount', width: 12, format: 'number' },
    { header: 'Ventas', key: 'totalCents', width: 18, format: 'currency' },
    { header: 'Ticket Promedio', key: 'avgTicketCents', width: 18, format: 'currency' },
    { header: 'Efectivo', key: 'cashCents', width: 15, format: 'currency' },
    { header: 'Yape/Plin', key: 'digitalCents', width: 15, format: 'currency' },
    { header: 'Tarjeta', key: 'cardCents', width: 15, format: 'currency' },
  ],
  queryFn: async (prisma, tenantId, filters) => {
    const where: any = { tenant_id: tenantId };
    if (filters?.start) where.business_date = { ...where.business_date, gte: new Date(filters.start) };
    if (filters?.end) where.business_date = { ...where.business_date, lte: new Date(filters.end) };

    const rows = await prisma.daily_sales_summary.findMany({
      where,
      orderBy: { business_date: 'desc' },
    });

    return rows.map((r: any) => ({
      date: r.business_date,
      orderCount: r.order_count,
      totalCents: r.total_sales_cents,
      avgTicketCents: r.order_count > 0 ? Math.round(r.total_sales_cents / r.order_count) : 0,
      cashCents: r.cash_cents || 0,
      digitalCents: (r.yape_cents || 0) + (r.plin_cents || 0),
      cardCents: r.card_cents || 0,
    }));
  },
};

const productosConfig: ExportEntityConfig = {
  key: 'productos',
  label: 'Catálogo de Productos',
  columns: [
    { header: 'Nombre', key: 'name', width: 30 },
    { header: 'SKU', key: 'sku', width: 15 },
    { header: 'Categoría', key: 'category', width: 15 },
    { header: 'Precio', key: 'priceCents', width: 15, format: 'currency' },
    { header: 'Costo', key: 'costCents', width: 15, format: 'currency' },
    { header: 'Activo', key: 'isActive', width: 10 },
  ],
  queryFn: async (prisma, tenantId) => {
    const rows = await prisma.products.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' },
    });

    return rows.map((r: any) => ({
      name: r.name,
      sku: r.sku || '',
      category: r.category || '',
      priceCents: r.price_cents,
      costCents: r.cost_cents || 0,
      isActive: r.is_active ? 'Sí' : 'No',
    }));
  },
};

const empleadosConfig: ExportEntityConfig = {
  key: 'empleados',
  label: 'Lista de Empleados',
  columns: [
    { header: 'Nombre', key: 'name', width: 25 },
    { header: 'Cargo', key: 'position', width: 20 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Salario', key: 'salaryCents', width: 15, format: 'currency' },
    { header: 'Estado', key: 'status', width: 12 },
  ],
  queryFn: async (prisma, tenantId) => {
    const rows = await prisma.employees.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' },
    });

    return rows.map((r: any) => ({
      name: r.name,
      position: r.position || '',
      email: r.email || '',
      salaryCents: r.base_salary_cents || 0,
      status: r.is_active ? 'ACTIVO' : 'INACTIVO',
    }));
  },
};

const pedidosPlataformaConfig: ExportEntityConfig = {
  key: 'pedidos-plataforma',
  label: 'Pedidos de Plataformas',
  columns: [
    { header: 'Fecha', key: 'date', width: 15, format: 'date' },
    { header: 'Plataforma', key: 'platform', width: 15 },
    { header: '# Pedido', key: 'platformOrderId', width: 18 },
    { header: 'Estado', key: 'status', width: 12 },
    { header: 'Total Plataforma', key: 'platformTotalCents', width: 18, format: 'currency' },
    { header: 'Total Restaurante', key: 'restaurantTotalCents', width: 18, format: 'currency' },
    { header: 'Comisión', key: 'commissionCents', width: 15, format: 'currency' },
  ],
  queryFn: async (prisma, tenantId, filters) => {
    const where: any = { tenant_id: tenantId };
    if (filters?.start) where.created_at = { ...where.created_at, gte: new Date(filters.start) };
    if (filters?.end) where.created_at = { ...where.created_at, lte: new Date(filters.end) };
    if (filters?.status) where.status = filters.status;

    const rows = await prisma.platform_orders.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return rows.map((r: any) => ({
      date: r.created_at,
      platform: r.platform,
      platformOrderId: r.platform_order_id,
      status: r.status,
      platformTotalCents: r.platform_total_cents,
      restaurantTotalCents: r.restaurant_total_cents,
      commissionCents: r.commission_cents,
    }));
  },
};

const cajaChicaConfig: ExportEntityConfig = {
  key: 'caja-chica',
  label: 'Transacciones Caja Chica',
  columns: [
    { header: 'Fecha', key: 'date', width: 15, format: 'date' },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Categoría', key: 'category', width: 15 },
    { header: 'Monto', key: 'amountCents', width: 15, format: 'currency' },
    { header: 'Descripción', key: 'description', width: 30 },
    { header: 'Aprobado', key: 'approved', width: 10 },
  ],
  queryFn: async (prisma, tenantId, filters) => {
    const where: any = { tenant_id: tenantId };
    if (filters?.start) where.created_at = { ...where.created_at, gte: new Date(filters.start) };
    if (filters?.end) where.created_at = { ...where.created_at, lte: new Date(filters.end) };

    const rows = await prisma.petty_cash_transactions.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return rows.map((r: any) => ({
      date: r.created_at,
      type: r.transaction_type,
      category: r.category || '',
      amountCents: r.amount_cents,
      description: r.description || '',
      approved: r.approved_by ? 'Sí' : 'No',
    }));
  },
};

const comprasConfig: ExportEntityConfig = {
  key: 'compras',
  label: 'Órdenes de Compra',
  columns: [
    { header: 'Fecha', key: 'date', width: 15, format: 'date' },
    { header: '# PO', key: 'poNumber', width: 15 },
    { header: 'Proveedor', key: 'supplier', width: 20 },
    { header: 'Estado', key: 'status', width: 12 },
    { header: 'Total', key: 'totalCents', width: 18, format: 'currency' },
  ],
  queryFn: async (prisma, tenantId, filters) => {
    const where: any = { tenant_id: tenantId };
    if (filters?.status) where.status = filters.status;

    const rows = await prisma.purchase_orders.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: { suppliers: true },
    });

    return rows.map((r: any) => ({
      date: r.created_at,
      poNumber: r.po_number || r.id.slice(0, 8),
      supplier: r.suppliers?.name || '',
      status: r.status,
      totalCents: r.total_cents,
    }));
  },
};

const conciliacionConfig: ExportEntityConfig = {
  key: 'conciliacion',
  label: 'Conciliación de Pagos',
  columns: [
    { header: 'Período Inicio', key: 'periodStart', width: 15, format: 'date' },
    { header: 'Período Fin', key: 'periodEnd', width: 15, format: 'date' },
    { header: 'Método', key: 'method', width: 15 },
    { header: 'Esperado', key: 'expectedCents', width: 18, format: 'currency' },
    { header: 'Recibido', key: 'receivedCents', width: 18, format: 'currency' },
    { header: 'Diferencia', key: 'differenceCents', width: 18, format: 'currency' },
    { header: 'Estado', key: 'status', width: 15 },
  ],
  queryFn: async (prisma, tenantId, filters) => {
    const where: any = { tenant_id: tenantId };
    if (filters?.status) where.status = filters.status;

    const rows = await prisma.payment_settlements.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return rows.map((r: any) => ({
      periodStart: r.period_start,
      periodEnd: r.period_end,
      method: r.payment_method,
      expectedCents: r.expected_cents,
      receivedCents: r.received_cents || 0,
      differenceCents: r.difference_cents || 0,
      status: r.status,
    }));
  },
};

// ============================================================================
// Registry
// ============================================================================

const EXPORT_CONFIGS: ExportEntityConfig[] = [
  ventasConfig,
  productosConfig,
  empleadosConfig,
  pedidosPlataformaConfig,
  cajaChicaConfig,
  comprasConfig,
  conciliacionConfig,
];

export function getExportConfig(key: string): ExportEntityConfig | undefined {
  return EXPORT_CONFIGS.find((c) => c.key === key);
}

export function getAvailableExports(): Array<{ key: string; label: string }> {
  return EXPORT_CONFIGS.map((c) => ({ key: c.key, label: c.label }));
}
