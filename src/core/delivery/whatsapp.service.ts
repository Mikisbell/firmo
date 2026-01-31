/**
 * WhatsApp Service for Delivery Module 2026 Modernization
 * 
 * Handles automated customer communication via Twilio WhatsApp API:
 * - Message template system with variable substitution
 * - Event-based message sending (assigned, dispatched, completed, failed)
 * - Rate limiting (10 messages/day per customer)
 * - ETA update messages (debounced, max 1 per 10 minutes)
 * - Opt-out preference handling
 * - Message history tracking
 * 
 * @module delivery/whatsapp-service
 */

import type {
  OrderId,
  WhatsAppTemplateName,
  MessageTemplate,
  WhatsAppMessage,
  WhatsAppMessageStatus,
  DeliveryOrder,
} from './types-2026';
import { WHATSAPP_RATE_LIMIT_PER_DAY, ETA_CHANGE_NOTIFICATION_THRESHOLD_MINUTES } from './types-2026';
import prisma from '@/src/core/db/prisma';

// ============================================
// Message Templates
// ============================================

/**
 * Approved WhatsApp message templates
 * These templates must be approved by Twilio for compliance
 */
export const MESSAGE_TEMPLATES: Record<WhatsAppTemplateName, MessageTemplate> = {
  ORDER_ASSIGNED: {
    name: 'ORDER_ASSIGNED',
    body: 'Hola {{customer_name}}! Tu pedido #{{order_number}} ha sido asignado a {{driver_name}}. Tiempo estimado: {{eta}} minutos.',
    variables: ['customer_name', 'order_number', 'driver_name', 'eta'],
  },
  ORDER_DISPATCHED: {
    name: 'ORDER_DISPATCHED',
    body: '🚗 {{driver_name}} está en camino con tu pedido #{{order_number}}. Rastrea tu pedido: {{tracking_link}}',
    variables: ['driver_name', 'order_number', 'tracking_link'],
  },
  ETA_UPDATE: {
    name: 'ETA_UPDATE',
    body: 'Actualización: Tu pedido #{{order_number}} llegará en {{eta}} minutos.',
    variables: ['order_number', 'eta'],
  },
  ORDER_DELIVERED: {
    name: 'ORDER_DELIVERED',
    body: '✅ Tu pedido #{{order_number}} ha sido entregado. ¡Buen provecho! Califica tu experiencia: {{feedback_link}}',
    variables: ['order_number', 'feedback_link'],
  },
  ORDER_FAILED: {
    name: 'ORDER_FAILED',
    body: '❌ No pudimos entregar tu pedido #{{order_number}}. Razón: {{reason}}. Contáctanos: {{support_phone}}',
    variables: ['order_number', 'reason', 'support_phone'],
  },
};

// ============================================
// Rate Limiting
// ============================================

/**
 * ETA update debounce tracking
 * Maps orderId to last update timestamp
 */
const etaUpdateDebounce = new Map<string, Date>();

/**
 * ETA update debounce interval (10 minutes)
 */
const ETA_UPDATE_DEBOUNCE_MS = 10 * 60 * 1000;

// ============================================
// WhatsApp Service
// ============================================

export class WhatsAppService {
  /**
   * Get message template by name
   */
  getTemplate(templateName: WhatsAppTemplateName): MessageTemplate {
    return MESSAGE_TEMPLATES[templateName];
  }

  /**
   * Render message template with variables
   */
  private renderTemplate(template: MessageTemplate, variables: Record<string, string>): string {
    let body = template.body;
    
    for (const variable of template.variables) {
      const value = variables[variable];
      if (value === undefined) {
        throw new Error(`Missing variable: ${variable} for template ${template.name}`);
      }
      body = body.replace(`{{${variable}}}`, value);
    }
    
    return body;
  }

  /**
   * Check if customer has opted out of WhatsApp messages
   */
  private async hasOptedOut(phoneNumber: string): Promise<boolean> {
    // TODO: Implement opt-out check when customer table is available
    // For now, assume no one has opted out
    return false;
  }

  /**
   * Check if customer is within rate limit (10 messages/day)
   */
  async canSendMessage(phoneNumber: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const messageCount = await prisma.whatsapp_messages.count({
      where: {
        phone_number: phoneNumber,
        created_at: {
          gte: today,
        },
      },
    });
    
    return messageCount < WHATSAPP_RATE_LIMIT_PER_DAY;
  }

  /**
   * Send WhatsApp message via Twilio API
   */
  private async sendViaTwilio(
    phoneNumber: string,
    messageBody: string
  ): Promise<{ sid: string } | { error: string }> {
    // Check for Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !whatsappNumber) {
      console.warn('Twilio credentials not configured, skipping WhatsApp send');
      return { error: 'Twilio credentials not configured' };
    }

    try {
      // Use Twilio REST API
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
          To: `whatsapp:${phoneNumber}`,
          Body: messageBody,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { error: `Twilio API error: ${error}` };
      }

      const data = await response.json();
      return { sid: data.sid };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Store message in database
   */
  private async storeMessage(
    orderId: OrderId,
    phoneNumber: string,
    templateName: WhatsAppTemplateName,
    messageBody: string,
    status: WhatsAppMessageStatus,
    twilioSid?: string,
    errorMessage?: string
  ): Promise<WhatsAppMessage> {
    const message = await prisma.whatsapp_messages.create({
      data: {
        order_id: orderId,
        phone_number: phoneNumber,
        template_name: templateName,
        message_body: messageBody,
        status,
        twilio_sid: twilioSid,
        error_message: errorMessage,
        sent_at: status === 'SENT' ? new Date() : null,
      },
    });

    return {
      id: message.id,
      orderId: orderId,
      phoneNumber: message.phone_number,
      templateName: templateName,
      messageBody: message.message_body,
      status: status,
      twilioSid: message.twilio_sid || undefined,
      errorMessage: message.error_message || undefined,
      sentAt: message.sent_at || undefined,
      deliveredAt: message.delivered_at || undefined,
      createdAt: message.created_at,
    };
  }

  /**
   * Send message with rate limiting and opt-out checks
   */
  private async sendMessage(
    orderId: OrderId,
    phoneNumber: string,
    templateName: WhatsAppTemplateName,
    variables: Record<string, string>
  ): Promise<WhatsAppMessage> {
    // Check opt-out
    const optedOut = await this.hasOptedOut(phoneNumber);
    if (optedOut) {
      return this.storeMessage(
        orderId,
        phoneNumber,
        templateName,
        '',
        'FAILED',
        undefined,
        'Customer has opted out'
      );
    }

    // Check rate limit
    const canSend = await this.canSendMessage(phoneNumber);
    if (!canSend) {
      return this.storeMessage(
        orderId,
        phoneNumber,
        templateName,
        '',
        'QUEUED',
        undefined,
        'Rate limit exceeded'
      );
    }

    // Render template
    const template = this.getTemplate(templateName);
    const messageBody = this.renderTemplate(template, variables);

    // Send via Twilio
    const result = await this.sendViaTwilio(phoneNumber, messageBody);

    if ('error' in result) {
      return this.storeMessage(
        orderId,
        phoneNumber,
        templateName,
        messageBody,
        'FAILED',
        undefined,
        result.error
      );
    }

    return this.storeMessage(
      orderId,
      phoneNumber,
      templateName,
      messageBody,
      'SENT',
      result.sid
    );
  }

  /**
   * Send ORDER_ASSIGNED message
   */
  async sendOrderAssigned(orderId: OrderId): Promise<void> {
    // Get order details
    const order = await prisma.delivery_orders.findUnique({
      where: { id: orderId },
      include: {
        drivers: true,
        orders: {
          include: {
            customers: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (!order.drivers) {
      throw new Error(`Order ${orderId} has no assigned driver`);
    }

    // Calculate ETA (simplified for now)
    const eta = 30; // TODO: Get from ETA calculator

    // Get customer name from customer relation or use phone as fallback
    const customerName = order.orders?.customers?.name || order.customer_phone;

    await this.sendMessage(orderId, order.customer_phone, 'ORDER_ASSIGNED', {
      customer_name: customerName,
      order_number: order.id.slice(-6),
      driver_name: order.drivers.name,
      eta: eta.toString(),
    });
  }

  /**
   * Send ORDER_DISPATCHED message
   */
  async sendOrderDispatched(orderId: OrderId): Promise<void> {
    const order = await prisma.delivery_orders.findUnique({
      where: { id: orderId },
      include: {
        drivers: true,
      },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (!order.drivers) {
      throw new Error(`Order ${orderId} has no assigned driver`);
    }

    const trackingLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://parkpos.com'}/track/${orderId}`;

    await this.sendMessage(orderId, order.customer_phone, 'ORDER_DISPATCHED', {
      driver_name: order.drivers.name,
      order_number: order.id.slice(-6),
      tracking_link: trackingLink,
    });
  }

  /**
   * Send ETA_UPDATE message (debounced)
   */
  async sendETAUpdate(orderId: OrderId, newETA: number): Promise<void> {
    // Check debounce
    const lastUpdate = etaUpdateDebounce.get(orderId);
    const now = new Date();
    
    if (lastUpdate) {
      const timeSinceLastUpdate = now.getTime() - lastUpdate.getTime();
      if (timeSinceLastUpdate < ETA_UPDATE_DEBOUNCE_MS) {
        console.log(`ETA update for ${orderId} debounced (last update ${timeSinceLastUpdate}ms ago)`);
        return;
      }
    }

    // Update debounce timestamp
    etaUpdateDebounce.set(orderId, now);

    const order = await prisma.delivery_orders.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    await this.sendMessage(orderId, order.customer_phone, 'ETA_UPDATE', {
      order_number: order.id.slice(-6),
      eta: newETA.toString(),
    });
  }

  /**
   * Send ORDER_DELIVERED message
   */
  async sendOrderDelivered(orderId: OrderId): Promise<void> {
    const order = await prisma.delivery_orders.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const feedbackLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://parkpos.com'}/feedback/${orderId}`;

    await this.sendMessage(orderId, order.customer_phone, 'ORDER_DELIVERED', {
      order_number: order.id.slice(-6),
      feedback_link: feedbackLink,
    });
  }

  /**
   * Send ORDER_FAILED message
   */
  async sendOrderFailed(orderId: OrderId, reason: string): Promise<void> {
    const order = await prisma.delivery_orders.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const supportPhone = process.env.SUPPORT_PHONE || '+51999999999';

    await this.sendMessage(orderId, order.customer_phone, 'ORDER_FAILED', {
      order_number: order.id.slice(-6),
      reason,
      support_phone: supportPhone,
    });
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();
