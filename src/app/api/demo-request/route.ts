/**
 * Demo Request API
 *
 * POST - Accept demo request from landing page.
 * Stores request in the database for follow-up.
 *
 * @module app/api/demo-request/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, restaurant, phone } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nombre es requerido' },
        { status: 400 },
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email válido es requerido' },
        { status: 400 },
      );
    }

    if (!restaurant || typeof restaurant !== 'string' || restaurant.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nombre del restaurante es requerido' },
        { status: 400 },
      );
    }

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
          name: name.trim(),
          email: email.toLowerCase().trim(),
          restaurant: restaurant.trim(),
          phone: phone?.trim() || null,
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
    console.error('Demo request error:', error);
    return NextResponse.json(
      { error: 'Error al procesar solicitud' },
      { status: 500 },
    );
  }
}
