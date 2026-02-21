/**
 * Facturación Schemas - Zod validation for invoice admin operations
 *
 * @module core/admin/schemas/facturacion.schema
 */

import { z } from 'zod';

// ============================================================================
// Query schemas
// ============================================================================

export const InvoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  type: z.enum(['BOLETA', 'FACTURA']).optional(),
  status: z.enum(['ISSUED', 'VOIDED', 'PENDING']).optional(),
  sunat_status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'TIMEOUT']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().max(100).optional(),
});

export type InvoiceQueryParams = z.infer<typeof InvoiceQuerySchema>;

// ============================================================================
// Void invoice
// ============================================================================

export const VoidInvoiceSchema = z.object({
  reason: z
    .string()
    .min(5, 'La razón debe tener al menos 5 caracteres')
    .max(500, 'La razón es muy larga'),
});

export type VoidInvoiceDTO = z.infer<typeof VoidInvoiceSchema>;

// ============================================================================
// Invoice stats query
// ============================================================================

export const InvoiceStatsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type InvoiceStatsQuery = z.infer<typeof InvoiceStatsQuerySchema>;
