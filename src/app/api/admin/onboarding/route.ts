/**
 * Onboarding API — GET checklist for authenticated tenant
 *
 * Returns the onboarding checklist steps with progress info.
 * tenant_id is extracted from JWT (never from client).
 *
 * Requirements: F2.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getOnboardingChecklist } from '@/src/core/tenant/onboarding';
import { withRequestLogging } from '@/src/core/middleware/request-logger';

async function handleGET(request: NextRequest) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    // Extract tenantId from JWT — NEVER from client
    const tenantId = authResult.user.tenantId;

    const checklist = await getOnboardingChecklist(tenantId);

    const completed = checklist.steps.filter((s) => s.is_completed).length;
    const total = checklist.steps.length;

    return NextResponse.json({
      tenant_id: checklist.tenant_id,
      status: checklist.status,
      steps: checklist.steps,
      completion_percentage: checklist.completion_percentage,
      progress: {
        completed,
        total,
        percentage: checklist.completion_percentage,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Onboarding checklist not found'
    ) {
      return NextResponse.json(
        { error: 'Lista de onboarding no encontrada para este tenant' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Error al obtener lista de onboarding' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
