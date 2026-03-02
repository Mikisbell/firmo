/**
 * Onboarding Step Complete API — PUT marks a step as complete
 *
 * Marks an onboarding step as completed for the authenticated tenant.
 * tenant_id and employee_id are extracted from JWT (never from client).
 *
 * Requirements: F2.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { completeOnboardingStep } from '@/src/core/tenant/onboarding';
import { ONBOARDING_STEPS, type OnboardingStepKey } from '@/src/core/tenant/onboarding-steps';

const VALID_STEP_KEYS = ONBOARDING_STEPS.map((s) => s.step_key) as readonly string[];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const { key } = await params;

    // Validate key is a valid OnboardingStepKey
    if (!VALID_STEP_KEYS.includes(key)) {
      return NextResponse.json(
        {
          error: `Paso de onboarding invalido: ${key}`,
          valid_keys: VALID_STEP_KEYS,
        },
        { status: 400 }
      );
    }

    // Extract tenantId and employeeId from JWT — NEVER from client
    const tenantId = authResult.user.tenantId;
    const employeeId = authResult.user.id;

    const step = await completeOnboardingStep(
      tenantId,
      key as OnboardingStepKey,
      employeeId
    );

    return NextResponse.json({
      success: true,
      step,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('not found')
    ) {
      return NextResponse.json(
        { error: 'Paso de onboarding no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Error al completar paso de onboarding' },
      { status: 500 }
    );
  }
}
