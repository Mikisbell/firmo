/**
 * Evaluations API - POST (create evaluation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { EvaluationService } from '@/src/core/services/evaluation.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const EvaluationSchema = z.object({
  employee_id: z.string().min(1).max(255),
  evaluator_id: z.string().min(1).max(255),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  scores: z.record(z.string(), z.number().min(0).max(10)),
  automatic_metrics: z.record(z.string(), z.number()).optional(),
  comments: z.string().max(2000).optional(),
  goals: z.array(z.object({ goal: z.string().max(500), progress: z.number().min(0).max(100) })).optional(),
});

const service = new EvaluationService(prisma);

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const parsed = EvaluationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const result = await service.create(tenantId, {
      employee_id: parsed.data.employee_id,
      evaluator_id: parsed.data.evaluator_id,
      period_start: new Date(parsed.data.period_start),
      period_end: new Date(parsed.data.period_end),
      scores: parsed.data.scores,
      automatic_metrics: parsed.data.automatic_metrics,
      comments: parsed.data.comments,
      goals: parsed.data.goals,
      created_by: authResult.user.id,
    });

    return resultToResponse(result, 201);
  } catch {
    return resultToResponse(
      { success: false, error: { message: 'Cuerpo de solicitud inválido', code: 'VALIDATION_ERROR', name: 'DomainError' } as any },
    );
  }
}
