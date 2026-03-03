/**
 * SUNAT Contingency API — GET, POST, DELETE
 *
 * Manages SUNAT contingency mode per tenant:
 * - GET: Current contingency state + pending invoices
 * - POST: Activate manual contingency (OWNER/ADMIN)
 * - DELETE: Deactivate contingency (OWNER/ADMIN, fails if overdue invoices)
 *
 * Auth: requireAdminPermission('manage_fiscal') — OWNER/ADMIN only.
 *
 * @module app/api/admin/facturacion/contingencia/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdminPermission } from '@/src/core/middleware/admin-permission';
import prisma from '@/src/core/db/prisma';
import { logAudit } from '@/src/core/observability/logger-pino';
import { ContingencyManager } from '@/src/core/integrations/sunat/contingency';

// ============================================================================
// Zod Schema for POST body
// ============================================================================

const ActivateContingencySchema = z
  .object({
    reason: z.enum([
      'SUNAT_UNREACHABLE',
      'NETWORK_OUTAGE',
      'CERTIFICATE_ERROR',
      'MANUAL_ACTIVATION',
    ]),
  })
  .strict();

// ============================================================================
// GET — Current contingency state + pending invoices
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await requireAdminPermission(request, 'manage_fiscal');
  if (!authResult.authorized) return authResult.response;

  try {
    const tenantId = authResult.user.tenantId;
    const manager = new ContingencyManager(prisma);

    const state = await manager.getState(tenantId);

    if (!state) {
      return NextResponse.json({
        active: false,
        state: null,
        pendingInvoices: [],
        overdueInvoices: [],
        urgentInvoices: [],
      });
    }

    const [pendingInvoices, overdueInvoices, urgentInvoices] =
      await Promise.all([
        manager.getPendingInvoices(tenantId),
        manager.getOverdueInvoices(tenantId),
        manager.getUrgentReconciliations(tenantId, 24),
      ]);

    return NextResponse.json({
      active: state.active,
      state: {
        id: state.id,
        reason: state.reason,
        activatedAt: state.activatedAt.toISOString(),
        activatedBy: state.activatedBy,
        deactivatedAt: state.deactivatedAt?.toISOString() ?? null,
        pendingCount: state.pendingCount,
        autoActivated: state.autoActivated,
        failureCount: state.failureCount,
        createdAt: state.createdAt.toISOString(),
      },
      pendingInvoices: pendingInvoices.map((inv) => ({
        id: inv.id,
        invoiceId: inv.invoiceId,
        series: inv.series,
        number: inv.number,
        issuedAt: inv.issuedAt.toISOString(),
        reconcileBy: inv.reconcileBy.toISOString(),
        reconciledAt: inv.reconciledAt?.toISOString() ?? null,
      })),
      overdueInvoices: overdueInvoices.map((inv) => ({
        id: inv.id,
        invoiceId: inv.invoiceId,
        series: inv.series,
        number: inv.number,
        issuedAt: inv.issuedAt.toISOString(),
        reconcileBy: inv.reconcileBy.toISOString(),
      })),
      urgentInvoices: urgentInvoices.map((inv) => ({
        id: inv.id,
        invoiceId: inv.invoiceId,
        series: inv.series,
        number: inv.number,
        issuedAt: inv.issuedAt.toISOString(),
        reconcileBy: inv.reconcileBy.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener estado de contingencia' },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST — Activate manual contingency
// ============================================================================

export async function POST(request: NextRequest) {
  const authResult = await requireAdminPermission(request, 'manage_fiscal');
  if (!authResult.authorized) return authResult.response;

  try {
    const tenantId = authResult.user.tenantId;
    const body = await request.json();
    const validated = ActivateContingencySchema.parse(body);

    const manager = new ContingencyManager(prisma);

    // Check if already active
    const existing = await manager.getState(tenantId);
    if (existing) {
      return NextResponse.json(
        {
          error: 'Contingencia ya está activa',
          code: 'CONTINGENCY_ALREADY_ACTIVE',
          state: {
            reason: existing.reason,
            activatedAt: existing.activatedAt.toISOString(),
          },
        },
        { status: 409 },
      );
    }

    const state = await manager.activate(
      tenantId,
      validated.reason,
      authResult.user.id,
      false, // manual activation, not auto
    );

    // Audit log
    logAudit('CREATE', 'contingency', authResult.user.id, {
      tenantId,
      reason: validated.reason,
      contingencyId: state.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Modo contingencia activado',
        state: {
          id: state.id,
          reason: state.reason,
          activatedAt: state.activatedAt.toISOString(),
          activatedBy: state.activatedBy,
          pendingCount: state.pendingCount,
          autoActivated: state.autoActivated,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Error al activar contingencia' },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE — Deactivate contingency
// ============================================================================

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdminPermission(request, 'manage_fiscal');
  if (!authResult.authorized) return authResult.response;

  try {
    const tenantId = authResult.user.tenantId;
    const manager = new ContingencyManager(prisma);

    // Check if active
    const state = await manager.getState(tenantId);
    if (!state) {
      return NextResponse.json(
        {
          error: 'No hay contingencia activa para desactivar',
          code: 'CONTINGENCY_NOT_ACTIVE',
        },
        { status: 404 },
      );
    }

    // Check for overdue invoices
    const overdue = await manager.getOverdueInvoices(tenantId);
    if (overdue.length > 0) {
      return NextResponse.json(
        {
          error: `No se puede desactivar: hay ${overdue.length} comprobante(s) vencido(s) sin conciliar`,
          code: 'CONTINGENCY_OVERDUE_INVOICES',
          overdueCount: overdue.length,
          overdueInvoices: overdue.map((inv) => ({
            invoiceId: inv.invoiceId,
            series: inv.series,
            number: inv.number,
            reconcileBy: inv.reconcileBy.toISOString(),
          })),
        },
        { status: 409 },
      );
    }

    const result = await manager.deactivate(tenantId);

    if (!result) {
      return NextResponse.json(
        { error: 'Error al desactivar contingencia' },
        { status: 500 },
      );
    }

    // Audit log
    logAudit('DELETE', 'contingency', authResult.user.id, {
      tenantId,
      contingencyId: state.id,
      reason: state.reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Modo contingencia desactivado',
    });
  } catch {
    return NextResponse.json(
      { error: 'Error al desactivar contingencia' },
      { status: 500 },
    );
  }
}
