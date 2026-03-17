/**
 * Messaging Service - WhatsApp/SMS via Twilio REST API
 *
 * Clean abstraction for sending marketing messages.
 * Reuses the same Twilio REST pattern as delivery/whatsapp.service.ts
 * but decoupled from order-specific logic.
 *
 * @module core/services/messaging.service
 */

import { pinoLogger } from '@/src/core/observability/logger-pino';

const logger = pinoLogger.child({ service: 'messaging' });

// ============================================================================
// Types
// ============================================================================

export interface SendResult {
  success: true;
  providerId: string;
}

export interface SendError {
  success: false;
  error: string;
}

export type SendOutcome = SendResult | SendError;

// ============================================================================
// Service
// ============================================================================

export class MessagingService {
  /**
   * Send a WhatsApp message via Twilio REST API
   */
  async sendWhatsApp(to: string, body: string): Promise<SendOutcome> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !whatsappNumber) {
      logger.warn('Twilio credentials not configured');
      return { success: false, error: 'Twilio credentials not configured' };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: `whatsapp:${whatsappNumber}`,
          To: `whatsapp:${to}`,
          Body: body,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, to }, 'Twilio API error');
        return { success: false, error: `Twilio API error (${response.status}): ${errorText}` };
      }

      const data = await response.json();
      return { success: true, providerId: data.sid };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: msg, to }, 'WhatsApp send failed');
      return { success: false, error: msg };
    }
  }

  /**
   * Send SMS via Twilio REST API (stub for future implementation)
   */
  async sendSms(_to: string, _body: string): Promise<SendOutcome> {
    return { success: false, error: 'SMS not yet implemented' };
  }

  // --------------------------------------------------------------------------
  // Template utilities (static)
  // --------------------------------------------------------------------------

  /**
   * Interpolate template variables: "Hola {{nombre}}" + {nombre: "Juan"} → "Hola Juan"
   */
  static interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return vars[key] ?? match;
    });
  }

  /**
   * Extract variable names from template: "Hola {{nombre}}, tienes {{puntos}} pts" → ["nombre", "puntos"]
   */
  static extractVariables(template: string): string[] {
    const matches = template.matchAll(/\{\{(\w+)\}\}/g);
    const vars = new Set<string>();
    for (const m of matches) {
      vars.add(m[1]);
    }
    return [...vars];
  }
}
