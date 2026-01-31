/**
 * Terminal Activation API
 * 
 * POST /api/terminals/activate
 * Activates a device with an activation code and binds the fingerprint.
 * 
 * Requirements: 2.2, 2.3, 2.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { activateDevice } from '@/src/core/auth/terminal-registry';
import { logger } from '@/src/core/observability/logger';
import type { FingerprintResult } from '@/src/core/auth/fingerprint-v2';

interface ActivateRequest {
  code: string;
  tenant_id: string;
  fingerprint: FingerprintResult;
}

export async function POST(request: NextRequest) {
  try {
    const body: ActivateRequest = await request.json();
    
    // Validate required fields
    if (!body.code || !body.tenant_id || !body.fingerprint) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: code, tenant_id, fingerprint' },
        { status: 400 }
      );
    }

    // Validate code format (6 digits, with or without dash)
    const normalizedCode = body.code.replace(/-/g, '');
    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: 'Código de activación inválido. Debe ser 6 dígitos.' },
        { status: 400 }
      );
    }

    // Validate fingerprint structure
    if (!body.fingerprint.hash || !body.fingerprint.signals) {
      return NextResponse.json(
        { error: 'Fingerprint inválido: falta hash o signals' },
        { status: 400 }
      );
    }

    // Validate minimum signal count
    if (body.fingerprint.signalCount < 8) {
      return NextResponse.json(
        { error: 'Fingerprint insuficiente: se requieren al menos 8 señales' },
        { status: 400 }
      );
    }

    // Activate device
    const result = await activateDevice(
      body.code,
      body.fingerprint,
      body.tenant_id
    );

    if (!result.success) {
      logger.warn('DEVICE_ACTIVATION_FAILED', 'Device activation failed', {
        code: normalizedCode.slice(0, 3) + '***', // Partial code for logging
        error: result.error,
      });

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    logger.info('DEVICE_ACTIVATED', 'Device activated successfully', {
      terminal_id: result.terminal?.terminal_id,
      role: result.terminal?.role,
    });

    return NextResponse.json({
      success: true,
      terminal: {
        id: result.terminal?.id,
        terminal_id: result.terminal?.terminal_id,
        role: result.terminal?.role,
        status: result.terminal?.status,
        device_name: result.terminal?.device_name,
        location_id: result.terminal?.location_id,
      },
    });
  } catch (error) {
    logger.error('DEVICE_ACTIVATION_ERROR', 'Error activating device', error instanceof Error ? error : undefined, {});

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
