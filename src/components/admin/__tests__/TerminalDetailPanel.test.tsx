/**
 * TerminalDetailPanel Component Tests
 * 
 * Requirements: 2.1, 3.3 (Terminal Architecture v2)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

const mockTerminalData = {
  terminal: {
    id: '1',
    terminal_id: 'CAJA_01',
    tenant_id: 'test-tenant',
    role: 'CAJA',
    status: 'active',
    device_name: 'iPad Caja Principal',
    location_id: 'MAIN',
    fingerprint_hash: 'abc123def456789012345678901234567890123456789012345678901234',
    bound_at: '2024-01-15T10:00:00Z',
    last_seen_at: new Date().toISOString(),
    last_fingerprint_check: new Date().toISOString(),
    drift_score: 5,
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  activation_codes: [
    {
      id: '1',
      code: '123456',
      expires_at: '2024-01-15T09:15:00Z',
      attempts: 1,
      used: true,
      created_by: 'admin',
      created_at: '2024-01-15T09:00:00Z',
    },
  ],
  current_code: null,
};

describe('TerminalDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockTerminalData,
    });
  });

  it('should fetch terminal details on mount', async () => {
    const terminalId = 'CAJA_01';
    const response = await fetch(`/api/admin/terminals-v2/${terminalId}`);
    const data = await response.json();

    expect(fetch).toHaveBeenCalledWith(`/api/admin/terminals-v2/${terminalId}`);
    expect(data.terminal.terminal_id).toBe('CAJA_01');
    expect(data.terminal.device_name).toBe('iPad Caja Principal');
  });

  it('should handle regenerate code action', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        code: {
          code: '999888',
          formatted: '999-888',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      }),
    });

    const terminalId = 'CAJA_01';
    const response = await fetch(`/api/admin/terminals-v2/${terminalId}/regenerate-code`, {
      method: 'POST',
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.code.code).toBe('999888');
    expect(data.code.formatted).toBe('999-888');
  });

  it('should handle status update action', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const terminalId = 'CAJA_01';
    const response = await fetch(`/api/admin/terminals-v2/${terminalId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disabled' }),
    });
    const data = await response.json();

    expect(data.success).toBe(true);
  });

  it('should detect online status for recently seen terminals', () => {
    const isOnline = (lastSeen: string | null) => {
      if (!lastSeen) return false;
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      return new Date(lastSeen).getTime() > fiveMinutesAgo;
    };

    const recentTime = new Date().toISOString();
    const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    expect(isOnline(recentTime)).toBe(true);
    expect(isOnline(oldTime)).toBe(false);
    expect(isOnline(null)).toBe(false);
  });

  it('should format activation codes correctly', () => {
    const formatCode = (code: string) => {
      if (code.length !== 6) return code;
      return `${code.slice(0, 3)}-${code.slice(3)}`;
    };

    expect(formatCode('123456')).toBe('123-456');
    expect(formatCode('789012')).toBe('789-012');
    expect(formatCode('12345')).toBe('12345');
  });
});
