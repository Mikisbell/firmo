/**
 * Peru Identity Lookup Schemas
 * Zod schemas for RENIEC (DNI) and SUNAT (RUC) API responses
 *
 * Providers:
 * - Primary: apisperu.com (2,000 free/month DNI+RUC, S/30/mo unlimited)
 * - Fallback: apis.net.pe v1 (free DNI only, ~25/day)
 *
 * @module core/integrations/peru-identity/schemas
 */

import { z } from 'zod';

// Query validation for lookup endpoint
export const LookupQuerySchema = z.object({
  doc_number: z.string().min(8).max(11),
  doc_type: z.enum(['DNI', 'RUC']),
}).refine((d) => {
  if (d.doc_type === 'DNI') return /^\d{8}$/.test(d.doc_number);
  if (d.doc_type === 'RUC') return /^(10|20)\d{9}$/.test(d.doc_number);
  return false;
}, { message: 'Formato de documento inválido' });

// === apisperu.com responses ===

// DNI response from apisperu.com
export const ApisPeruDniSchema = z.object({
  success: z.boolean(),
  dni: z.string().optional(),
  nombres: z.string().optional(),
  apellidoPaterno: z.string().optional(),
  apellidoMaterno: z.string().optional(),
  codVerifica: z.string().optional(),
  nombre: z.string().optional(), // Some responses use 'nombre' as full name
});

// RUC response from apisperu.com
export const ApisPeruRucSchema = z.object({
  success: z.boolean(),
  ruc: z.string().optional(),
  razonSocial: z.string().optional(),
  estado: z.string().optional(),
  condicion: z.string().optional(),
  direccion: z.string().optional(),
  departamento: z.string().optional(),
  provincia: z.string().optional(),
  distrito: z.string().optional(),
});

// === apis.net.pe fallback responses ===

// RENIEC DNI response (apis.net.pe v1 — free fallback)
export const ApisNetPeV1DniSchema = z.object({
  nombre: z.string().optional(),
  nombres: z.string().optional(),
  apellidoPaterno: z.string().optional(),
  apellidoMaterno: z.string().optional(),
  tipoDocumento: z.string().optional(),
  numeroDocumento: z.string().optional(),
});

// Lookup result returned to caller
export interface IdentityLookupResult {
  found: true;
  source: 'local' | 'cache' | 'external';
  customer: {
    name: string;
    doc_type: 'DNI' | 'RUC';
    doc_number: string;
    address?: string;
    estado?: string;
    condicion?: string;
  };
  localCustomerId?: string;
}

export interface IdentityLookupNotFound {
  found: false;
}

export type LookupResult = IdentityLookupResult | IdentityLookupNotFound;
