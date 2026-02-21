/**
 * Evaluations API - POST (create evaluation)
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { EvaluationService } from '@/src/core/services/evaluation.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new EvaluationService(prisma);

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const result = await service.create(tenantId, {
      employee_id: body.employee_id,
      evaluator_id: body.evaluator_id,
      period_start: new Date(body.period_start),
      period_end: new Date(body.period_end),
      scores: body.scores,
      automatic_metrics: body.automatic_metrics,
      comments: body.comments,
      goals: body.goals,
      created_by: authResult.user.id,
    });

    return resultToResponse(result, 201);
  } catch {
    return resultToResponse(
      { success: false, error: { message: 'Invalid request body', code: 'VALIDATION_ERROR', name: 'DomainError' } as any },
    );
  }
}
