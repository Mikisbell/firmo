/**
 * WhatsApp Message Templates
 * Centralized templates for all delivery WhatsApp notifications.
 *
 * @module delivery/whatsapp-templates
 */

/* eslint-disable no-irregular-whitespace */

export const WHATSAPP_TEMPLATES = {
  TRACKING: (code: string, url: string) =>
    [
      '\u{1F6F5} \u{00A1}Tu pedido est\u{00E1} en camino!',
      '',
      `C\u{00F3}digo: ${code}`,
      `Seguimiento: ${url}`,
      '',
      '\u{2014} PARK Poller\u{00ED}a',
    ].join('\n'),

  ORDER_CONFIRMED: (orderNumber: number, eta: number) =>
    [
      `\u{2705} Pedido #${orderNumber} confirmado`,
      '',
      `Tiempo estimado: ~${eta} minutos`,
      '',
      '\u{2014} PARK Poller\u{00ED}a',
    ].join('\n'),

  DRIVER_ASSIGNED: (driverName: string, trackingUrl: string) =>
    [
      `\u{1F3CD}\u{FE0F} Tu motorizado ${driverName} fue asignado`,
      '',
      `Segu\u{00ED} tu pedido: ${trackingUrl}`,
      '',
      '\u{2014} PARK Poller\u{00ED}a',
    ].join('\n'),

  DELIVERED: (feedbackUrl: string) =>
    [
      '\u{1F389} \u{00A1}Pedido entregado!',
      '',
      '\u{00BF}C\u{00F3}mo fue tu experiencia?',
      feedbackUrl,
      '',
      '\u{2014} PARK Poller\u{00ED}a',
    ].join('\n'),
};
