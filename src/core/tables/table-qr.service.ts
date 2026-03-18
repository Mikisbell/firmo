/**
 * Table QR Service - Generates QR codes for restaurant tables
 *
 * Each table gets a QR code linking to the public digital menu.
 * URL format: {baseUrl}/menu/{tenantSlug}/{tableId}
 *
 * @module core/tables/table-qr.service
 */

import { PrismaClient } from '@prisma/client';
import { Result, ok, err, DomainError, NotFoundError, ValidationError } from '@/src/core/result';
import { qrGeneratorService } from '@/src/core/payments/qr-generator.service';
import prisma from '@/src/core/db/prisma';

// ============================================================================
// Types
// ============================================================================

export interface TableQRItem {
  tableId: string;
  tableNumber: string;
  displayName: string;
  qrDataUrl: string;
  menuUrl: string;
}

export interface TableMenuData {
  tenant: {
    name: string;
    logoUrl: string | null;
    address: string | null;
  };
  table: {
    id: string;
    number: string;
    displayName: string | null;
  };
  categories: Array<{
    name: string;
    products: Array<{
      id: string;
      name: string;
      priceCents: number;
      category: string | null;
      images: string[];
    }>;
  }>;
}

// ============================================================================
// TableQrService
// ============================================================================

export class TableQrService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate the public menu URL for a table
   */
  generateTableQRUrl(tenantSlug: string, tableId: string, baseUrl: string): string {
    return `${baseUrl}/menu/${tenantSlug}/${tableId}`;
  }

  /**
   * Generate a QR code data URL for a specific table
   */
  async generateTableQRDataUrl(
    tenantSlug: string,
    tableId: string,
    baseUrl: string,
  ): Promise<Result<{ qrDataUrl: string; menuUrl: string }, DomainError>> {
    if (!tenantSlug || !tenantSlug.trim()) {
      return err(new ValidationError('Tenant slug es requerido', 'tenantSlug'));
    }
    if (!tableId || !tableId.trim()) {
      return err(new ValidationError('Table ID es requerido', 'tableId'));
    }
    if (!baseUrl || !baseUrl.trim()) {
      return err(new ValidationError('Base URL es requerida', 'baseUrl'));
    }

    const menuUrl = this.generateTableQRUrl(tenantSlug, tableId, baseUrl);
    const qrResult = await qrGeneratorService.generateGenericQR(menuUrl, {
      width: 400,
      errorCorrectionLevel: 'H',
    });

    if (!qrResult.success) {
      return err(qrResult.error);
    }

    return ok({ qrDataUrl: qrResult.data, menuUrl });
  }

  /**
   * Generate QR codes for all active tables in a location
   */
  async generateAllTableQRs(
    tenantId: string,
    locationId: string,
    baseUrl: string,
  ): Promise<Result<TableQRItem[], DomainError>> {
    // Get tenant slug
    const tenant = await this.prisma.tenants.findFirst({
      where: { id: tenantId },
      select: { slug: true, name: true },
    });

    if (!tenant?.slug) {
      return err(new ValidationError(
        'El restaurante no tiene slug configurado. Configure uno en Administración.',
        'slug',
      ));
    }

    // Get active tables for the location, sorted numerically
    const tables = (await this.prisma.tables.findMany({
      where: { tenant_id: tenantId, location_id: locationId, is_active: true },
      select: { id: true, number: true, display_name: true },
    })).sort((a, b) => {
      const na = parseInt(a.number, 10);
      const nb = parseInt(b.number, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.number.localeCompare(b.number);
    });

    if (tables.length === 0) {
      return ok([]);
    }

    // Generate QR for each table
    const results: TableQRItem[] = [];
    for (const table of tables) {
      const menuUrl = this.generateTableQRUrl(tenant.slug, table.id, baseUrl);
      const qrResult = await qrGeneratorService.generateGenericQR(menuUrl, {
        width: 400,
        errorCorrectionLevel: 'H',
      });

      if (qrResult.success) {
        results.push({
          tableId: table.id,
          tableNumber: table.number,
          displayName: table.display_name ?? `Mesa ${table.number}`,
          qrDataUrl: qrResult.data,
          menuUrl,
        });
      }
    }

    return ok(results);
  }

  /**
   * Resolve a table menu from tenant slug + table ID
   * Used by the public menu page to render menu items
   */
  async resolveTableMenu(
    tenantSlug: string,
    tableId: string,
  ): Promise<Result<TableMenuData, DomainError>> {
    // Resolve tenant by slug
    const tenant = await this.prisma.tenants.findFirst({
      where: { slug: tenantSlug },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return err(new NotFoundError('Restaurante', tenantSlug));
    }

    // Get tenant settings for logo/address
    const settings = await this.prisma.tenant_settings.findUnique({
      where: { tenant_id: tenant.id },
      select: { logo_url: true, address_text: true },
    });

    // Verify table exists and belongs to tenant
    const table = await this.prisma.tables.findFirst({
      where: { id: tableId, tenant_id: tenant.id, is_active: true },
      select: { id: true, number: true, display_name: true },
    });

    if (!table) {
      return err(new NotFoundError('Mesa', tableId));
    }

    // Get active, available products grouped by category
    const products = await this.prisma.products.findMany({
      where: {
        tenant_id: tenant.id,
        is_active: true,
        is_available: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        price_cents: true,
        category: true,
        images: true,
      },
    });

    // Group by category
    const categoryMap = new Map<string, TableMenuData['categories'][number]['products']>();
    for (const product of products) {
      const cat = product.category ?? 'Otros';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push({
        id: product.id,
        name: product.name,
        priceCents: product.price_cents,
        category: product.category,
        images: (product.images as string[] | null) ?? [],
      });
    }

    const categories = Array.from(categoryMap.entries()).map(([name, prods]) => ({
      name,
      products: prods,
    }));

    return ok({
      tenant: {
        name: tenant.name,
        logoUrl: settings?.logo_url ?? null,
        address: settings?.address_text ?? null,
      },
      table: {
        id: table.id,
        number: table.number,
        displayName: table.display_name,
      },
      categories,
    });
  }
}

// Singleton
export const tableQrService = new TableQrService(prisma);
