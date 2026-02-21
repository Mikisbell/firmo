/**
 * Yape/Plin Settings - Zod Schemas
 *
 * @module core/admin/schemas/yape-plin.schema
 */

import { z } from 'zod';

const peruPhoneSchema = z.string().regex(/^9\d{8}$/, 'Debe ser 9 dígitos empezando con 9');

export const YapePlinSettingsSchema = z.object({
  yape_merchant_phone: peruPhoneSchema.nullable().optional(),
  yape_merchant_name: z.string().min(1).max(100).nullable().optional(),
  plin_merchant_phone: peruPhoneSchema.nullable().optional(),
  plin_merchant_name: z.string().min(1).max(100).nullable().optional(),
});

export type YapePlinSettingsDTO = z.infer<typeof YapePlinSettingsSchema>;

export const PaymentQRRequestSchema = z.object({
  method: z.enum(['YAPE', 'PLIN']),
  amountCents: z.number().int().positive(),
  orderNumber: z.union([z.number(), z.string()]),
});

export type PaymentQRRequestDTO = z.infer<typeof PaymentQRRequestSchema>;
