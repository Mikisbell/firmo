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
import { WHATSAPP_TEMPLATES } from './whatsapp-templates';

const log = createLogger('whatsapp-tracking');

const messaging = new MessagingService();

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://parkpos.com';
}

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
  const trackingUrl = `${getBaseUrl()}/track/${trackingCode}`;
  const body = WHATSAPP_TEMPLATES.TRACKING(trackingCode, trackingUrl);

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

/**
 * Envía mensaje WhatsApp cuando se asigna un motorizado al delivery.
 * No lanza excepciones — si falla, loguea el error y retorna silenciosamente.
 */
export async function sendDriverAssignedWhatsApp(
  customerPhone: string,
  driverName: string,
  trackingCode: string,
): Promise<void> {
  const trackingUrl = `${getBaseUrl()}/track/${trackingCode}`;
  const body = WHATSAPP_TEMPLATES.DRIVER_ASSIGNED(driverName, trackingUrl);

  const result = await messaging.sendWhatsApp(customerPhone, body);

  if (result.success) {
    log.info('Notificación de driver asignado enviada', {
      trackingCode,
      driverName,
      providerId: result.providerId,
    });
  } else {
    log.warn('No se pudo enviar notificación de driver asignado', {
      trackingCode,
      error: result.error,
    });
  }
}

/**
 * Envía mensaje WhatsApp cuando el pedido fue entregado.
 * No lanza excepciones — si falla, loguea el error y retorna silenciosamente.
 */
export async function sendDeliveredWhatsApp(
  customerPhone: string,
  trackingCode: string,
): Promise<void> {
  const feedbackUrl = `${getBaseUrl()}/track/${trackingCode}`;
  const body = WHATSAPP_TEMPLATES.DELIVERED(feedbackUrl);

  const result = await messaging.sendWhatsApp(customerPhone, body);

  if (result.success) {
    log.info('Notificación de entrega enviada', {
      trackingCode,
      providerId: result.providerId,
    });
  } else {
    log.warn('No se pudo enviar notificación de entrega', {
      trackingCode,
      error: result.error,
    });
  }
}
