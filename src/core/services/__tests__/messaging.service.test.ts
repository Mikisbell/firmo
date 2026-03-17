/**
 * Messaging Service - Tests
 *
 * Tests for template interpolation, variable extraction, and WhatsApp sending.
 *
 * @module core/services/__tests__/messaging.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { MessagingService } from '../messaging.service';

vi.mock('@/src/core/observability/logger-pino', () => {
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), child: vi.fn() };
  logger.child.mockReturnValue(logger);
  return { pinoLogger: logger };
});

describe('MessagingService', () => {
  // --------------------------------------------------------------------------
  // interpolate
  // --------------------------------------------------------------------------

  describe('interpolate', () => {
    it('replaces all known variables', () => {
      const result = MessagingService.interpolate(
        'Hola {{nombre}}, tienes {{puntos}} pts ({{tier}})',
        { nombre: 'Juan', puntos: '500', tier: 'ORO' },
      );
      expect(result).toBe('Hola Juan, tienes 500 pts (ORO)');
    });

    it('leaves unknown variables untouched', () => {
      const result = MessagingService.interpolate(
        'Hola {{nombre}}, tu {{codigo}} es',
        { nombre: 'Ana' },
      );
      expect(result).toBe('Hola Ana, tu {{codigo}} es');
    });

    it('handles empty vars', () => {
      const result = MessagingService.interpolate('Sin variables', {});
      expect(result).toBe('Sin variables');
    });

    it('handles empty template', () => {
      const result = MessagingService.interpolate('', { nombre: 'Test' });
      expect(result).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // extractVariables
  // --------------------------------------------------------------------------

  describe('extractVariables', () => {
    it('extracts unique variable names', () => {
      const vars = MessagingService.extractVariables(
        'Hola {{nombre}}, tienes {{puntos}} pts. {{nombre}} es VIP',
      );
      expect(vars).toEqual(['nombre', 'puntos']);
    });

    it('returns empty array for no variables', () => {
      expect(MessagingService.extractVariables('Sin variables')).toEqual([]);
    });

    it('returns empty for empty string', () => {
      expect(MessagingService.extractVariables('')).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // sendWhatsApp
  // --------------------------------------------------------------------------

  describe('sendWhatsApp', () => {
    let service: MessagingService;

    beforeEach(() => {
      service = new MessagingService();
    });

    it('returns error when credentials missing', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_WHATSAPP_NUMBER;

      const result = await service.sendWhatsApp('+51999888777', 'Test');
      expect(result.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Property tests
  // --------------------------------------------------------------------------

  describe('property tests', () => {
    it('interpolate replaces all provided variables', () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.stringMatching(/^[a-z]{1,10}$/), fc.string({ minLength: 1, maxLength: 20 })),
          (vars) => {
            const template = Object.keys(vars).map((k) => `{{${k}}}`).join(' ');
            const result = MessagingService.interpolate(template, vars);
            // Result should not contain any {{key}} for provided keys
            for (const key of Object.keys(vars)) {
              expect(result).not.toContain(`{{${key}}}`);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('extractVariables is idempotent', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (template) => {
            const first = MessagingService.extractVariables(template);
            const second = MessagingService.extractVariables(template);
            expect(first).toEqual(second);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('extractVariables finds all interpolated vars', () => {
      fc.assert(
        fc.property(
          fc.array(fc.stringMatching(/^[a-z]{1,10}$/), { minLength: 1, maxLength: 5 }),
          (varNames) => {
            const template = varNames.map((v) => `Hello {{${v}}}`).join(' ');
            const extracted = MessagingService.extractVariables(template);
            const unique = [...new Set(varNames)];
            expect(extracted.sort()).toEqual(unique.sort());
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
