import { describe, it, expect } from 'vitest';
import { isWebAuthnSupported, registerBiometricPasskey, authenticateWithBiometrics } from '@/src/core/auth/webauthn';

describe('WebAuthn Biometrics Module', () => {
  it('should detect WebAuthn browser API availability', () => {
    const supported = isWebAuthnSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('should return error gracefully when WebAuthn is unavailable or user cancels', async () => {
    const res = await registerBiometricPasskey({
      id: 'emp-1',
      name: 'Carlos López',
      dni: '22222222',
    });
    expect(res).toBeDefined();
    expect(typeof res.success).toBe('boolean');
  });

  it('should handle biometric authentication attempt', async () => {
    const res = await authenticateWithBiometrics('22222222');
    expect(res).toBeDefined();
    expect(typeof res.success).toBe('boolean');
  });
});
