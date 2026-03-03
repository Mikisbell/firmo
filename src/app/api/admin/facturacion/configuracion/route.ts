/**
 * SUNAT Configuration API - GET (read) and PUT (update)
 *
 * Manages per-tenant SUNAT electronic invoicing configuration.
 * GET returns config with sensitive values masked (has_* booleans).
 * PUT updates config with encryption and PEM validation.
 *
 * Auth: requireAdminPermission('manage_fiscal') — OWNER only.
 *
 * @module app/api/admin/facturacion/configuracion/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdminPermission } from '@/src/core/middleware/admin-permission';
import prisma from '@/src/core/db/prisma';
import { logAudit } from '@/src/core/observability/logger-pino';
import {
  encryptCredential,
  validateCertificatePem,
  validatePrivateKeyPem,
} from '@/src/core/integrations/sunat/credential-encryption';

// ============================================================================
// Zod Schema for PUT body
// ============================================================================

const SunatConfigUpdateSchema = z
  .object({
    sunat_provider: z
      .enum(['SUNAT_DIRECT', 'NUBEFACT', 'NONE'])
      .optional(),
    sunat_mode: z
      .enum(['PRODUCTION', 'BETA', 'DISABLED'])
      .optional(),
    sunat_sol_user: z.string().max(100).optional(),
    sunat_sol_password: z.string().max(500).optional(),
    sunat_certificate_pem: z.string().max(10240).optional(), // 10KB max
    sunat_private_key_pem: z.string().max(10240).optional(), // 10KB max
    nubefact_token: z.string().max(500).optional(),
    nubefact_url: z.string().url().max(500).optional(),
  })
  .strict();

// ============================================================================
// GET — Read SUNAT configuration (masked sensitive fields)
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await requireAdminPermission(request, 'manage_fiscal');
  if (!authResult.authorized) return authResult.response;

  try {
    const tenantId = authResult.user.tenantId;

    const settings = await (prisma.tenant_settings as any).findFirst({
      where: { tenant_id: tenantId },
      select: {
        sunat_provider: true,
        sunat_mode: true,
        sunat_sol_user: true,
        sunat_sol_password: true,
        sunat_certificate_pem: true,
        sunat_private_key_pem: true,
        sunat_cert_expires_at: true,
        nubefact_token: true,
        nubefact_url: true,
        ruc: true,
      },
    });

    if (!settings) {
      return NextResponse.json({
        sunat_provider: 'NONE',
        sunat_mode: 'DISABLED',
        sunat_sol_user: null,
        has_sol_password: false,
        has_certificate: false,
        has_private_key: false,
        sunat_cert_expires_at: null,
        cert_expires_in_days: null,
        nubefact_url: null,
        has_nubefact_token: false,
        ruc: null,
      });
    }

    // Calculate certificate expiration in days
    let certExpiresInDays: number | null = null;
    if (settings.sunat_cert_expires_at) {
      const now = new Date();
      const expiresAt = new Date(settings.sunat_cert_expires_at);
      const diffMs = expiresAt.getTime() - now.getTime();
      certExpiresInDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    return NextResponse.json({
      sunat_provider: settings.sunat_provider ?? 'NONE',
      sunat_mode: settings.sunat_mode ?? 'DISABLED',
      sunat_sol_user: settings.sunat_sol_user ?? null,
      has_sol_password: !!settings.sunat_sol_password,
      has_certificate: !!settings.sunat_certificate_pem,
      has_private_key: !!settings.sunat_private_key_pem,
      sunat_cert_expires_at: settings.sunat_cert_expires_at ?? null,
      cert_expires_in_days: certExpiresInDays,
      nubefact_url: settings.nubefact_url ?? null,
      has_nubefact_token: !!settings.nubefact_token,
      ruc: settings.ruc ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener configuración SUNAT' },
      { status: 500 },
    );
  }
}

// ============================================================================
// PUT — Update SUNAT configuration
// ============================================================================

export async function PUT(request: NextRequest) {
  const authResult = await requireAdminPermission(request, 'manage_fiscal');
  if (!authResult.authorized) return authResult.response;

  try {
    const tenantId = authResult.user.tenantId;
    const body = await request.json();
    const validated = SunatConfigUpdateSchema.parse(body);

    // Build update data
    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    // Non-sensitive fields — store as-is
    if (validated.sunat_provider !== undefined) {
      updateData.sunat_provider = validated.sunat_provider;
      changedFields.push('sunat_provider');
    }
    if (validated.sunat_mode !== undefined) {
      updateData.sunat_mode = validated.sunat_mode;
      changedFields.push('sunat_mode');
    }
    if (validated.sunat_sol_user !== undefined) {
      updateData.sunat_sol_user = validated.sunat_sol_user;
      changedFields.push('sunat_sol_user');
    }
    if (validated.nubefact_url !== undefined) {
      updateData.nubefact_url = validated.nubefact_url;
      changedFields.push('nubefact_url');
    }

    // Sensitive fields — encrypt before storage
    if (validated.sunat_sol_password !== undefined) {
      updateData.sunat_sol_password = encryptCredential(
        validated.sunat_sol_password,
      );
      changedFields.push('sunat_sol_password');
    }
    if (validated.nubefact_token !== undefined) {
      updateData.nubefact_token = encryptCredential(
        validated.nubefact_token,
      );
      changedFields.push('nubefact_token');
    }

    // Certificate PEM — validate + encrypt
    if (validated.sunat_certificate_pem !== undefined) {
      const certResult = validateCertificatePem(
        validated.sunat_certificate_pem,
      );
      if (!certResult.success) {
        return NextResponse.json(
          {
            error: certResult.error.message,
            code: certResult.error.code,
          },
          { status: 400 },
        );
      }
      updateData.sunat_certificate_pem = encryptCredential(
        validated.sunat_certificate_pem,
      );
      updateData.sunat_cert_expires_at = certResult.data.expiresAt;
      changedFields.push('sunat_certificate_pem');
    }

    // Private key PEM — validate + encrypt
    if (validated.sunat_private_key_pem !== undefined) {
      const keyResult = validatePrivateKeyPem(
        validated.sunat_private_key_pem,
      );
      if (!keyResult.success) {
        return NextResponse.json(
          {
            error: keyResult.error.message,
            code: keyResult.error.code,
          },
          { status: 400 },
        );
      }
      updateData.sunat_private_key_pem = encryptCredential(
        validated.sunat_private_key_pem,
      );
      changedFields.push('sunat_private_key_pem');
    }

    // Validation: SUNAT_DIRECT + PRODUCTION requires all credentials
    const effectiveProvider =
      validated.sunat_provider ?? undefined;
    const effectiveMode =
      validated.sunat_mode ?? undefined;

    if (
      effectiveProvider === 'SUNAT_DIRECT' &&
      effectiveMode === 'PRODUCTION'
    ) {
      // Load current settings to check what's already in DB
      const currentSettings = await (
        prisma.tenant_settings as any
      ).findFirst({
        where: { tenant_id: tenantId },
        select: {
          sunat_sol_user: true,
          sunat_sol_password: true,
          sunat_certificate_pem: true,
          sunat_private_key_pem: true,
        },
      });

      const hasSolUser =
        validated.sunat_sol_user ?? currentSettings?.sunat_sol_user;
      const hasSolPassword =
        validated.sunat_sol_password ??
        currentSettings?.sunat_sol_password;
      const hasCertificate =
        validated.sunat_certificate_pem ??
        currentSettings?.sunat_certificate_pem;
      const hasPrivateKey =
        validated.sunat_private_key_pem ??
        currentSettings?.sunat_private_key_pem;

      const missing: string[] = [];
      if (!hasSolUser) missing.push('usuario SOL');
      if (!hasSolPassword) missing.push('contraseña SOL');
      if (!hasCertificate) missing.push('certificado digital');
      if (!hasPrivateKey) missing.push('clave privada');

      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: `Para SUNAT Directo en modo Producción se requiere: ${missing.join(', ')}`,
            code: 'SUNAT_MISSING_CREDENTIALS',
            missing,
          },
          { status: 400 },
        );
      }
    }

    // Nothing to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 },
      );
    }

    // Update DB
    await (prisma.tenant_settings as any).update({
      where: { tenant_id: tenantId },
      data: updateData,
    });

    // Audit log (NEVER log sensitive values)
    logAudit('UPDATE', 'sunat_config', authResult.user.id, {
      tenantId,
      changedFields,
    });

    // Return updated config via GET logic (re-read from DB to return consistent state)
    const updatedSettings = await (
      prisma.tenant_settings as any
    ).findFirst({
      where: { tenant_id: tenantId },
      select: {
        sunat_provider: true,
        sunat_mode: true,
        sunat_sol_user: true,
        sunat_sol_password: true,
        sunat_certificate_pem: true,
        sunat_private_key_pem: true,
        sunat_cert_expires_at: true,
        nubefact_token: true,
        nubefact_url: true,
        ruc: true,
      },
    });

    let certExpiresInDays: number | null = null;
    if (updatedSettings?.sunat_cert_expires_at) {
      const now = new Date();
      const expiresAt = new Date(updatedSettings.sunat_cert_expires_at);
      const diffMs = expiresAt.getTime() - now.getTime();
      certExpiresInDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    return NextResponse.json({
      sunat_provider: updatedSettings?.sunat_provider ?? 'NONE',
      sunat_mode: updatedSettings?.sunat_mode ?? 'DISABLED',
      sunat_sol_user: updatedSettings?.sunat_sol_user ?? null,
      has_sol_password: !!updatedSettings?.sunat_sol_password,
      has_certificate: !!updatedSettings?.sunat_certificate_pem,
      has_private_key: !!updatedSettings?.sunat_private_key_pem,
      sunat_cert_expires_at:
        updatedSettings?.sunat_cert_expires_at ?? null,
      cert_expires_in_days: certExpiresInDays,
      nubefact_url: updatedSettings?.nubefact_url ?? null,
      has_nubefact_token: !!updatedSettings?.nubefact_token,
      ruc: updatedSettings?.ruc ?? null,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Error al actualizar configuración SUNAT' },
      { status: 500 },
    );
  }
}
