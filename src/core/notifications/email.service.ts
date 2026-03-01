/**
 * Email Notification Service
 *
 * Sends transactional emails via Resend.
 * Falls back to logging when RESEND_API_KEY is not configured.
 *
 * @module core/notifications/email.service
 */

import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('email-service');

interface EmailPayload {
  to: string[];
  subject: string;
  html: string;
  from?: string;
}

interface EmailResult {
  sent: boolean;
  id?: string;
  error?: string;
}

const DEFAULT_FROM = 'PARK POS <alerts@parkpos.pe>';

/**
 * Send an email via Resend API.
 * If RESEND_API_KEY is not set, logs the email and returns success (noop mode).
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    log.warn('RESEND_API_KEY no configurada — email en modo noop', {
      to: payload.to,
      subject: payload.subject,
    });
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: payload.from ?? DEFAULT_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });

    if (result.error) {
      log.error('Error al enviar email via Resend', new Error(result.error.message), {
        to: payload.to,
        subject: payload.subject,
      });
      return { sent: false, error: result.error.message };
    }

    log.info('Email enviado exitosamente', {
      id: result.data?.id,
      to: payload.to,
      subject: payload.subject,
    });

    return { sent: true, id: result.data?.id };
  } catch (error) {
    log.error('Error inesperado al enviar email', error instanceof Error ? error : new Error(String(error)), {
      to: payload.to,
      subject: payload.subject,
    });
    return { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Build HTML for an alert notification email.
 */
export function buildAlertEmailHtml(params: {
  alertType: string;
  severity: string;
  message: string;
  currentValue: number;
  thresholdValue: number;
  tenantId: string;
  timestamp: Date;
}): string {
  const severityColor = params.severity === 'CRITICAL' ? '#dc2626'
    : params.severity === 'WARNING' ? '#f59e0b'
    : '#3b82f6';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-left: 4px solid ${severityColor}; padding: 12px 16px; margin-bottom: 20px; background: #f9fafb;">
    <h2 style="margin: 0 0 8px; color: ${severityColor};">${params.severity}: ${params.alertType}</h2>
    <p style="margin: 0; color: #374151;">${params.message}</p>
  </div>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Valor actual</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${params.currentValue}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Umbral</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${params.thresholdValue}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Tenant</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${params.tenantId}</td></tr>
    <tr><td style="padding: 8px; color: #6b7280;">Fecha</td><td style="padding: 8px;">${params.timestamp.toISOString()}</td></tr>
  </table>
  <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">PARK POS — Sistema de alertas automatizado</p>
</body>
</html>`.trim();
}
