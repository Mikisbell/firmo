/**
 * Simple Terminal Activation API (Fallback)
 * 
 * Activation endpoint that works without fingerprint validation
 * for HTTP/non-secure contexts
 * 
 * POST /api/terminals/activate-simple
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/logger';
import { getTenantId } from '@/src/core/config/tenant';
import crypto from 'crypto';

/**
 * Generate a valid UUID v4 using Math.random
 * This is more compatible with Next.js runtime than crypto.randomUUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a fallback fingerprint hash for simple activation
 * This creates a unique device fingerprint based on terminal info
 */
function generateSimpleFingerprint(terminalId: string, salt: string): string {
  const data = `${terminalId}:${salt}:${Date.now()}:${Math.random()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { terminal_id, code, fingerprint } = body;
    
    console.log('[ACTIVATE-SIMPLE] Request received:', { 
      terminal_id, 
      code_provided: !!code,
      fingerprint_provided: !!fingerprint 
    });

    // Validate required fields
    if (!terminal_id || !code) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: terminal_id, code' },
        { status: 400 }
      );
    }

    const tenantId = getTenantId();

    // Find terminal
    const terminal = await prisma.terminal_devices.findFirst({
      where: {
        terminal_id,
        tenant_id: tenantId,
      },
    });

    if (!terminal) {
      return NextResponse.json(
        { error: 'Terminal no encontrado' },
        { status: 404 }
      );
    }

    // Find activation code
    const activationCode = await prisma.activation_codes.findFirst({
      where: {
        terminal_id,
        code: code.replace(/-/g, ''),
        used: false,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!activationCode) {
      return NextResponse.json(
        { error: 'Código de activación inválido o expirado' },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date() > activationCode.expires_at) {
      return NextResponse.json(
        { error: 'Código de activación expirado' },
        { status: 400 }
      );
    }

    // Generate fallback fingerprint hash for simple activation
    const fallbackFingerprint = generateSimpleFingerprint(terminal_id, terminal.fingerprint_salt);
    
    console.log('[ACTIVATE-SIMPLE] Generating fallback fingerprint:', {
      terminal_id,
      fingerprint_preview: fallbackFingerprint.substring(0, 20) + '...'
    });

    // Activate terminal with fallback fingerprint
    await prisma.terminal_devices.update({
      where: { id: terminal.id },
      data: {
        fingerprint_hash: fallbackFingerprint,
        status: 'active',
        bound_at: new Date(),
        last_seen_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Mark code as used
    await prisma.activation_codes.update({
      where: { id: activationCode.id },
      data: { used: true },
    });

    // Log event
    await prisma.events.create({
      data: {
        id: generateUUID(),
        tenant_id: tenantId,
        occurred_at: new Date(),
        type: 'TERMINAL_ACTIVATED_SIMPLE',
        entity_type: 'TERMINAL',
        entity_id: terminal.id,
        actor_id: generateUUID(), // Generate valid UUID instead of 'system' string
        actor_role_snapshot: 'SYSTEM',
        terminal_id,
        payload: {
          terminal_id,
          activation_method: 'simple',
          reason: 'Non-secure context fallback',
        },
      },
    });

    logger.info('TERMINAL_ACTIVATED_SIMPLE', 'Terminal activated via simple method', {
      terminal_id,
      tenant_id: tenantId,
    });

    return NextResponse.json({
      success: true,
      message: 'Terminal activado exitosamente',
      terminal: {
        id: terminal.id,
        terminal_id: terminal.terminal_id,
        role: terminal.role,
        status: 'active',
      },
    });

  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: String(error),
    };
    
    console.error('[ACTIVATE-SIMPLE] Error:', errorDetails);
    logger.error('SIMPLE_ACTIVATION_ERROR', 'Error in simple activation', error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: errorDetails.message,
      },
      { status: 500 }
    );
  }
}
