/**
 * Terminal Registry Service
 * 
 * Manages terminal device registration, activation codes, and device binding.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 3.1
 * 
 * Cache Integration: Task 9.9
 * - Cache terminal data with 15-minute TTL (900s)
 * - Invalidate on terminal updates
 * - Use cache-aside pattern
 */

import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { hashWithSalt, type FingerprintResult } from './fingerprint-v2';
import { randomBytes } from 'crypto';
import { cache, generateCacheKey, DEFAULT_TTLS } from '@/src/core/cache/cache-service';
import { metrics } from '@/src/core/observability/metrics';

// ============ TYPES ============

export type TerminalStatus = 'pending' | 'active' | 'disabled';
/**
 * TODO(db-sync): This local TerminalRole uses legacy Spanish vocabulary stored in the
 * DB terminal_devices.role column ('CAJA' | 'MOZO' | 'KDS_COCINA' | 'KDS_HORNO' | 'KDS_BAR').
 * The canonical English TerminalRole is defined in src/core/constants/roles.ts.
 * The type cast in mapToTerminalDevice() (record.role as TerminalRole) is safe because
 * DB values were inserted with these exact strings. Migration required before changing this.
 */
export type TerminalRole = 'CAJA' | 'MOZO' | 'KDS_COCINA' | 'KDS_HORNO' | 'KDS_BAR';

export interface TerminalDevice {
  id: string;
  terminal_id: string;
  tenant_id: string;
  role: TerminalRole;
  fingerprint_hash: string | null;
  fingerprint_salt: string;
  status: TerminalStatus;
  bound_at: Date | null;
  last_seen_at: Date;
  last_fingerprint_check: Date;
  drift_score: number;
  location_id: string;
  device_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface ActivationCode {
  id: string;
  terminal_id: string;
  code: string;
  expires_at: Date;
  attempts: number;
  used: boolean;
  created_by: string;
  created_at: Date;
}

export interface CreateTerminalInput {
  terminal_id: string;
  tenant_id: string;
  role: TerminalRole;
  location_id: string;
  device_name: string;
  created_by: string;
}

export interface ValidationResult {
  valid: boolean;
  terminal?: TerminalDevice;
  similarity?: number;
  error?: string;
  requiresReactivation?: boolean;
}

// ============ CONSTANTS ============

const ACTIVATION_CODE_EXPIRY_MINUTES = 15;
const ACTIVATION_CODE_LENGTH = 6;
const MAX_ACTIVATION_ATTEMPTS = 5;
const FINGERPRINT_DRIFT_THRESHOLD = 50; // Below this requires re-activation

// ============ HELPER FUNCTIONS ============

/**
 * Generate a random 6-digit activation code
 * Requirements: 2.1
 */
export function generateActivationCodeValue(): string {
  const bytes = randomBytes(4);
  const num = bytes.readUInt32BE(0) % 1000000;
  return num.toString().padStart(ACTIVATION_CODE_LENGTH, '0');
}

/**
 * Format activation code for display (XXX-XXX)
 * Requirements: 2.6
 */
export function formatActivationCode(code: string): string {
  if (code.length !== 6) return code;
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Parse activation code from display format
 */
export function parseActivationCode(formatted: string): string {
  return formatted.replace(/-/g, '');
}

/**
 * Generate a random salt for fingerprint hashing
 */
function generateSalt(): string {
  return randomBytes(32).toString('hex');
}

// ============ TERMINAL REGISTRY SERVICE ============

/**
 * Create a new terminal device
 * Requirements: 3.1
 */
export async function createTerminal(input: CreateTerminalInput): Promise<{ terminal: TerminalDevice; code: ActivationCode }> {
  const salt = generateSalt();
  
  // Create terminal in pending status
  const terminal = await prisma.terminal_devices.create({
    data: {
      terminal_id: input.terminal_id,
      tenant_id: input.tenant_id,
      role: input.role,
      fingerprint_salt: salt,
      status: 'pending',
      location_id: input.location_id,
      device_name: input.device_name,
      drift_score: 0,
    },
  });

  // Generate activation code
  const code = await generateActivationCode(input.terminal_id, input.created_by);

  logger.info('New terminal created', {
    event: 'TERMINAL_CREATED',
    terminal_id: input.terminal_id,
    role: input.role,
    tenant_id: input.tenant_id,
  });

  return {
    terminal: mapToTerminalDevice(terminal),
    code,
  };
}

/**
 * Generate a new activation code for a terminal
 * Requirements: 2.1, 2.6
 */
export async function generateActivationCode(terminalId: string, createdBy: string): Promise<ActivationCode> {
  const code = generateActivationCodeValue();
  const expiresAt = new Date(Date.now() + ACTIVATION_CODE_EXPIRY_MINUTES * 60 * 1000);

  // Mark any existing unused codes as used
  await prisma.activation_codes.updateMany({
    where: {
      terminal_id: terminalId,
      used: false,
    },
    data: {
      used: true,
    },
  });

  // Look up terminal to get tenant_id
  const terminal = await prisma.terminal_devices.findUnique({
    where: { terminal_id: terminalId },
    select: { tenant_id: true },
  });

  if (!terminal) {
    throw new Error(`Terminal not found: ${terminalId}`);
  }

  // Create new code
  const activationCode = await prisma.activation_codes.create({
    data: {
      terminal_id: terminalId,
      tenant_id: terminal.tenant_id,
      code,
      expires_at: expiresAt,
      created_by: createdBy,
      attempts: 0,
      used: false,
    },
  });

  logger.info('Activation code generated', {
    event: 'ACTIVATION_CODE_GENERATED',
    terminal_id: terminalId,
    expires_at: expiresAt.toISOString(),
  });

  return mapToActivationCode(activationCode);
}

/**
 * Activate a device with an activation code
 * 
 * Cache Invalidation:
 * - Invalidates terminal cache on successful activation
 * - Uses tag-based invalidation
 * 
 * Requirements: 2.2, 2.3, 2.4
 */
export async function activateDevice(
  code: string,
  fingerprint: FingerprintResult,
  tenantId: string
): Promise<{ success: boolean; terminal?: TerminalDevice; error?: string }> {
  const normalizedCode = parseActivationCode(code);

  // Find the activation code
  const activationCode = await prisma.activation_codes.findFirst({
    where: {
      code: normalizedCode,
      used: false,
    },
    include: {
      terminal_device: true,
    },
  });

  if (!activationCode) {
    logger.warn('Invalid activation code', { 
      event: 'ACTIVATION_FAILED',
      code: normalizedCode 
    });
    return { success: false, error: 'Código de activación inválido' };
  }

  // Check if code is expired (Requirement 2.3)
  if (new Date() > activationCode.expires_at) {
    logger.warn('Activation code expired', {
      event: 'ACTIVATION_FAILED',
      terminal_id: activationCode.terminal_id,
      expired_at: activationCode.expires_at.toISOString(),
    });
    return { success: false, error: 'Código de activación expirado' };
  }

  // Check max attempts
  if (activationCode.attempts >= MAX_ACTIVATION_ATTEMPTS) {
    logger.warn('Max activation attempts exceeded', {
      event: 'ACTIVATION_FAILED',
      terminal_id: activationCode.terminal_id,
      attempts: activationCode.attempts,
    });
    return { success: false, error: 'Máximo de intentos excedido' };
  }

  // Increment attempts
  await prisma.activation_codes.update({
    where: { id: activationCode.id },
    data: { attempts: activationCode.attempts + 1 },
  });

  // Check tenant match
  if (activationCode.terminal_device.tenant_id !== tenantId) {
    logger.warn('Tenant mismatch', {
      event: 'ACTIVATION_FAILED',
      terminal_id: activationCode.terminal_id,
      expected_tenant: activationCode.terminal_device.tenant_id,
      provided_tenant: tenantId,
    });
    return { success: false, error: 'Terminal no pertenece a este tenant' };
  }

  // Check if fingerprint is already bound to another terminal (Requirement 2.4)
  const existingBinding = await prisma.terminal_devices.findFirst({
    where: {
      tenant_id: tenantId,
      fingerprint_hash: { not: null },
      terminal_id: { not: activationCode.terminal_id },
      status: 'active',
    },
  });

  if (existingBinding) {
    // Check similarity with existing binding
    const existingHash = await hashWithSalt(fingerprint, existingBinding.fingerprint_salt);
    if (existingHash === existingBinding.fingerprint_hash) {
      logger.warn('Device already bound to another terminal', {
        event: 'ACTIVATION_FAILED',
        terminal_id: activationCode.terminal_id,
        existing_terminal: existingBinding.terminal_id,
      });
      return { success: false, error: 'Este dispositivo ya está vinculado a otro terminal' };
    }
  }

  // Hash fingerprint with terminal's salt
  const fingerprintHash = await hashWithSalt(fingerprint, activationCode.terminal_device.fingerprint_salt);

  // Update terminal with fingerprint and activate
  const updatedTerminal = await prisma.terminal_devices.update({
    where: { id: activationCode.terminal_device.id },
    data: {
      fingerprint_hash: fingerprintHash,
      status: 'active',
      bound_at: new Date(),
      last_seen_at: new Date(),
      last_fingerprint_check: new Date(),
      drift_score: 0,
    },
  });

  // Mark code as used
  await prisma.activation_codes.update({
    where: { id: activationCode.id },
    data: { used: true },
  });

  // Invalidate terminal cache
  await cache.deleteByTag(`tenant:${tenantId}`);
  await cache.deleteByTag('terminals');
  metrics.increment('cache.invalidation', { resource: 'terminal', reason: 'activation' });

  logger.info('Device successfully activated', {
    event: 'DEVICE_ACTIVATED',
    terminal_id: activationCode.terminal_id,
    role: updatedTerminal.role,
  });

  return {
    success: true,
    terminal: mapToTerminalDevice(updatedTerminal),
  };
}

/**
 * Validate a terminal's fingerprint
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export async function validateTerminal(
  terminalId: string,
  fingerprint: FingerprintResult,
  tenantId: string
): Promise<ValidationResult> {
  // Get terminal
  const terminal = await prisma.terminal_devices.findFirst({
    where: {
      terminal_id: terminalId,
      tenant_id: tenantId,
    },
  });

  // Check terminal exists (Requirement 3.1)
  if (!terminal) {
    return { valid: false, error: 'Terminal no encontrado' };
  }

  // Check terminal is active (Requirement 3.3)
  if (terminal.status !== 'active') {
    return { valid: false, error: `Terminal en estado: ${terminal.status}` };
  }

  // Check fingerprint is bound
  if (!terminal.fingerprint_hash) {
    return { valid: false, error: 'Terminal no tiene fingerprint vinculado', requiresReactivation: true };
  }

  // Calculate fingerprint similarity (Requirement 3.2)
  const currentHash = await hashWithSalt(fingerprint, terminal.fingerprint_salt);
  const hashMatch = currentHash === terminal.fingerprint_hash;

  // For hash-based comparison, we use exact match
  // For signal-based drift detection, we'd need stored signals
  const similarity = hashMatch ? 100 : 0;

  // Update last seen
  await prisma.terminal_devices.update({
    where: { id: terminal.id },
    data: {
      last_seen_at: new Date(),
      last_fingerprint_check: new Date(),
      drift_score: 100 - similarity,
    },
  });

  // Check drift threshold (Requirement 3.4)
  if (similarity < FINGERPRINT_DRIFT_THRESHOLD) {
    logger.warn('Fingerprint drift detected', {
      event: 'FINGERPRINT_DRIFT',
      terminal_id: terminalId,
      similarity,
      threshold: FINGERPRINT_DRIFT_THRESHOLD,
    });
    return {
      valid: false,
      terminal: mapToTerminalDevice(terminal),
      similarity,
      error: 'Fingerprint no coincide',
      requiresReactivation: true,
    };
  }

  return {
    valid: true,
    terminal: mapToTerminalDevice(terminal),
    similarity,
  };
}

/**
 * Get a terminal by ID with caching
 * 
 * Cache Strategy:
 * - TTL: 15 minutes (900 seconds)
 * - Cache key: terminal:{tenantId}:{terminalId}
 * - Tags: tenant:{tenantId}, terminals
 * 
 * Requirements: 3.1
 */
export async function getTerminal(terminalId: string, tenantId: string): Promise<TerminalDevice | null> {
  const startTime = Date.now();
  
  // Generate cache key
  const cacheKey = generateCacheKey('terminal', tenantId, terminalId);
  
  try {
    // Try cache first (cache-aside pattern)
    const cached = await cache.get<TerminalDevice>(cacheKey);
    
    if (cached) {
      metrics.increment('cache.hit', { resource: 'terminal', backend: cache.getType() });
      metrics.timing('terminal.get', Date.now() - startTime, { source: 'cache' });
      return cached;
    }
    
    metrics.increment('cache.miss', { resource: 'terminal', backend: cache.getType() });
    
    // Cache miss - fetch from database
    const terminal = await prisma.terminal_devices.findFirst({
      where: {
        terminal_id: terminalId,
        tenant_id: tenantId,
      },
    });
    
    if (!terminal) {
      return null;
    }
    
    const mappedTerminal = mapToTerminalDevice(terminal);
    
    // Store in cache with 15-minute TTL
    await cache.set(cacheKey, mappedTerminal, {
      ttl: DEFAULT_TTLS.terminals, // 900 seconds (15 minutes)
      tags: [`tenant:${tenantId}`, 'terminals'],
    });
    
    metrics.timing('terminal.get', Date.now() - startTime, { source: 'database' });
    
    return mappedTerminal;
    
  } catch (error) {
    logger.error('Failed to get terminal', error as Error, {
      event: 'TERMINAL_GET_ERROR',
      terminalId,
      tenantId,
    });
    metrics.increment('terminal.error', { operation: 'get' });
    throw error;
  }
}

/**
 * List all terminals for a tenant with caching
 * 
 * Cache Strategy:
 * - TTL: 15 minutes (900 seconds)
 * - Cache key: terminals:{tenantId}:list
 * - Tags: tenant:{tenantId}, terminals
 * 
 * Requirements: 3.1
 */
export async function listTerminals(tenantId: string): Promise<TerminalDevice[]> {
  const startTime = Date.now();
  
  // Generate cache key
  const cacheKey = generateCacheKey('terminals', tenantId, 'list');
  
  try {
    // Try cache first (cache-aside pattern)
    const cached = await cache.get<TerminalDevice[]>(cacheKey);
    
    if (cached) {
      metrics.increment('cache.hit', { resource: 'terminals-list', backend: cache.getType() });
      metrics.timing('terminals.list', Date.now() - startTime, { source: 'cache' });
      return cached;
    }
    
    metrics.increment('cache.miss', { resource: 'terminals-list', backend: cache.getType() });
    
    // Cache miss - fetch from database
    const terminals = await prisma.terminal_devices.findMany({
      where: { tenant_id: tenantId },
      orderBy: { terminal_id: 'asc' },
    });
    
    const mappedTerminals = terminals.map(mapToTerminalDevice);
    
    // Store in cache with 15-minute TTL
    await cache.set(cacheKey, mappedTerminals, {
      ttl: DEFAULT_TTLS.terminals, // 900 seconds (15 minutes)
      tags: [`tenant:${tenantId}`, 'terminals'],
    });
    
    metrics.timing('terminals.list', Date.now() - startTime, { source: 'database' });
    
    return mappedTerminals;
    
  } catch (error) {
    logger.error('Failed to list terminals', error as Error, {
      event: 'TERMINALS_LIST_ERROR',
      tenantId,
    });
    metrics.increment('terminals.error', { operation: 'list' });
    throw error;
  }
}

/**
 * Disable a terminal and invalidate cache
 * 
 * Cache Invalidation:
 * - Invalidates terminal cache on status change
 * 
 * Requirements: 3.3
 */
export async function disableTerminal(terminalId: string, tenantId: string): Promise<void> {
  await prisma.terminal_devices.updateMany({
    where: {
      terminal_id: terminalId,
      tenant_id: tenantId,
    },
    data: {
      status: 'disabled',
    },
  });

  // Invalidate terminal cache
  await cache.deleteByTag(`tenant:${tenantId}`);
  await cache.deleteByTag('terminals');
  metrics.increment('cache.invalidation', { resource: 'terminal', reason: 'disable' });

  logger.info('Terminal disabled', { 
    event: 'TERMINAL_DISABLED',
    terminal_id: terminalId 
  });
}

/**
 * Update terminal status and invalidate cache
 * 
 * Cache Invalidation:
 * - Invalidates terminal cache on status change
 */
export async function updateTerminalStatus(
  terminalId: string,
  tenantId: string,
  status: TerminalStatus
): Promise<TerminalDevice | null> {
  const terminal = await prisma.terminal_devices.updateMany({
    where: {
      terminal_id: terminalId,
      tenant_id: tenantId,
    },
    data: { status },
  });

  if (terminal.count === 0) return null;

  // Invalidate terminal cache
  await cache.deleteByTag(`tenant:${tenantId}`);
  await cache.deleteByTag('terminals');
  metrics.increment('cache.invalidation', { resource: 'terminal', reason: 'status_update' });

  return getTerminal(terminalId, tenantId);
}

// ============ MAPPERS ============

function mapToTerminalDevice(record: {
  id: string;
  terminal_id: string;
  tenant_id: string;
  role: string;
  fingerprint_hash: string | null;
  fingerprint_salt: string;
  status: string;
  bound_at: Date | null;
  last_seen_at: Date;
  last_fingerprint_check: Date;
  drift_score: number;
  location_id: string;
  device_name: string;
  created_at: Date;
  updated_at: Date;
}): TerminalDevice {
  return {
    id: record.id,
    terminal_id: record.terminal_id,
    tenant_id: record.tenant_id,
    role: record.role as TerminalRole,
    fingerprint_hash: record.fingerprint_hash,
    fingerprint_salt: record.fingerprint_salt,
    status: record.status as TerminalStatus,
    bound_at: record.bound_at,
    last_seen_at: record.last_seen_at,
    last_fingerprint_check: record.last_fingerprint_check,
    drift_score: record.drift_score,
    location_id: record.location_id,
    device_name: record.device_name,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function mapToActivationCode(record: {
  id: string;
  terminal_id: string;
  code: string;
  expires_at: Date;
  attempts: number;
  used: boolean;
  created_by: string;
  created_at: Date;
}): ActivationCode {
  return {
    id: record.id,
    terminal_id: record.terminal_id,
    code: record.code,
    expires_at: record.expires_at,
    attempts: record.attempts,
    used: record.used,
    created_by: record.created_by,
    created_at: record.created_at,
  };
}
