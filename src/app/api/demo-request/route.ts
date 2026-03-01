/**
 * Demo Request API
 *
 * POST - Accept demo request from landing page.
 * Stores request in the database for follow-up.
 *
 * @module app/api/demo-request/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { logger } from '@/src/core/observability/structured-logger';

const demoRequestSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').transform((v) => v.trim()),
  email: z.string().email('Email válido es requerido').transform((v) => v.toLowerCase().trim()),
  restaurant: z.string().min(1, 'Nombre del restaurante es requerido').transform((v) => v.trim()),
  phone: z.string().nullish().transform((v) => v?.trim() || null),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = demoRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { name, email, restaurant, phone } = parsed.data;

    // Store in tenant_settings as a demo_request (using events table for audit)
    // Since we don't have a dedicated demo_requests table, we store as an event
    await prisma.events.create({
      data: {
        id: randomUUID(),
        tenant_id: '00000000-0000-0000-0000-000000000000', // system tenant
        terminal_id: 'LANDING',
        type: 'DEMO_REQUESTED',
        entity_type: 'SYSTEM',
        entity_id: null,
        payload: {
          name,
          email,
          restaurant,
          phone,
          requested_at: new Date().toISOString(),
          source: 'landing_page',
        },
        occurred_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Solicitud recibida. Te contactaremos pronto.',
    });
  } catch (error) {
    logger.error('Error al procesar solicitud de demo', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al procesar solicitud' },
      { status: 500 },
    );
  }
}
