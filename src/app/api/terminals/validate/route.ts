/**
 * Terminal Validation API
 * 
 * POST /api/terminals/validate
 * Validates a terminal's fingerprint and returns validation result.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateTerminal } from '@/src/core/auth/terminal-registry';
import { logger } from '@/src/core/observability/logger';
import type { FingerprintResult } from '@/src/core/auth/fingerprint-v2';

interface ValidateRequest {
  terminal_id: string;
  tenant_id: string;
  fingerprint: FingerprintResult;
}

export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json();
    
    // Validate required fields
    if (!body.terminal_id || !body.tenant_id || !body.fingerprint) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: terminal_id, tenant_id, fingerprint' },
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

    // Validate terminal
    const result = await validateTerminal(
      body.terminal_id,
      body.fingerprint,
      body.tenant_id
    );

    if (!result.valid) {
      logger.warn('TERMINAL_VALIDATION_FAILED', 'Terminal validation failed', {
        terminal_id: body.terminal_id,
        error: result.error,
        requiresReactivation: result.requiresReactivation,
      });

      return NextResponse.json(
        {
          valid: false,
          error: result.error,
          requiresReactivation: result.requiresReactivation || false,
          similarity: result.similarity,
        },
        { status: result.requiresReactivation ? 401 : 403 }
      );
    }

    logger.info('TERMINAL_VALIDATED', 'Terminal validated successfully', {
      terminal_id: body.terminal_id,
      similarity: result.similarity,
    });

    return NextResponse.json({
      valid: true,
      terminal: {
        id: result.terminal?.id,
        terminal_id: result.terminal?.terminal_id,
        role: result.terminal?.role,
        status: result.terminal?.status,
        drift_score: result.terminal?.drift_score,
      },
      similarity: result.similarity,
    });
  } catch (error) {
    logger.error('TERMINAL_VALIDATION_ERROR', 'Error validating terminal', error instanceof Error ? error : undefined, {});

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
