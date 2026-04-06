/**
 * WhatsApp Tracking Notification
 *
 * Envía notificación de seguimiento al cliente cuando se crea un delivery.
 * Usa MessagingService (Twilio REST) para enviar el mensaje.
 * Si el servicio no está configurado, loguea warning y no falla.
 *
 * @module delivery/whatsapp-tracking
 */

import { MessagingService } from '@/src/core/services/messaging.service';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('whatsapp-tracking');

const messaging = new MessagingService();

interface TrackingNotificationParams {
  customerPhone: string;
  trackingCode: string;
}

/**
 * Envía mensaje WhatsApp con URL de seguimiento al cliente.
 * No lanza excepciones — si falla, loguea el error y retorna silenciosamente.
 */
export async function sendDeliveryTrackingWhatsApp(
  params: TrackingNotificationParams,
): Promise<void> {
  const { customerPhone, trackingCode } = params;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://parkpos.com';

  const body = [
    '🛵 ¡Tu pedido está en camino!',
    '',
    `Código de seguimiento: ${trackingCode}`,
    `Sigue tu pedido en: ${baseUrl}/track/${trackingCode}`,
    '',
    '— PARK Pollería',
  ].join('\n');

  const result = await messaging.sendWhatsApp(customerPhone, body);

  if (result.success) {
    log.info('Notificación de tracking enviada', {
      trackingCode,
      providerId: result.providerId,
    });
  } else {
    log.warn('No se pudo enviar notificación de tracking', {
      trackingCode,
      error: result.error,
    });
  }
}
