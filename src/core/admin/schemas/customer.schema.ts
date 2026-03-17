/**
 * Customer Schema Validation
 * Zod schemas for customer fiscal identity CRUD operations
 */

import { z } from 'zod';

export const DOC_TYPES = ['RUC', 'DNI', 'CE', 'PASSPORT'] as const;

const docCrossValidation = (data: { doc_type?: string | null; doc_number?: string | null }, ctx: z.RefinementCtx) => {
  if (data.doc_type && !data.doc_number) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doc_number'],
      message: 'Numero de documento requerido cuando se especifica tipo',
    });
  }
  if (data.doc_number && !data.doc_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doc_type'],
      message: 'Tipo de documento requerido cuando se especifica numero',
    });
  }
  if (data.doc_type === 'RUC' && data.doc_number && !/^(10|20)\d{9}$/.test(data.doc_number)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doc_number'],
      message: 'RUC debe tener 11 digitos y comenzar con 10 o 20',
    });
  }
  if (data.doc_type === 'DNI' && data.doc_number && !/^\d{8}$/.test(data.doc_number)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['doc_number'],
      message: 'DNI debe tener exactamente 8 digitos',
    });
  }
};

export const CreateCustomerSchema = z.object({
  phone: z.string()
    .min(7, 'Telefono invalido')
    .max(20, 'Telefono invalido'),
  name: z.string()
    .min(2, 'Nombre debe tener al menos 2 caracteres')
    .max(200, 'Nombre muy largo')
    .optional()
    .nullable(),
  email: z.string().email('Email invalido').optional().nullable(),
  doc_type: z.enum(DOC_TYPES, { message: 'Tipo de documento invalido' }).optional().nullable(),
  doc_number: z.string().min(8, 'Numero de documento muy corto').max(20, 'Numero de documento muy largo').optional().nullable(),
}).superRefine(docCrossValidation);

export const UpdateCustomerSchema = z.object({
  phone: z.string().min(7).max(20).optional(),
  name: z.string().min(2).max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  doc_type: z.enum(DOC_TYPES).optional().nullable(),
  doc_number: z.string().min(8).max(20).optional().nullable(),
}).superRefine(docCrossValidation);

export const CustomerQuerySchema = z.object({
  search: z.string().optional(),
  doc_type: z.enum(DOC_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type CustomerQueryInput = z.infer<typeof CustomerQuerySchema>;
