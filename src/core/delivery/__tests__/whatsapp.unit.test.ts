/**
 * Unit Tests for WhatsApp Service
 * 
 * Tests specific examples and edge cases:
 * - Message template rendering
 * - Rate limiting logic
 * - Opt-out handling
 * - Error handling (Twilio failures)
 * - Event-based message sending
 * - ETA update debouncing
 * 
 * @module delivery/__tests__/whatsapp-unit
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WhatsAppService, MESSAGE_TEMPLATES } from '../whatsapp.service';
import type { OrderId } from '../types-2026';
import { toOrderId } from '../types-2026';

// Mock Prisma - must be defined before vi.mock
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    delivery_orders: {
      findUnique: vi.fn(),
    },
    whatsapp_messages: {
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Import after mock
import prisma from '@/src/core/db/prisma';

// Mock fetch for Twilio API
global.fetch = vi.fn() as any;

describe('WhatsApp Service - Unit Tests', () => {
  let service: WhatsAppService;
  const mockOrderId = toOrderId('order-123');
  const mockPhoneNumber = '+51987654321';

  beforeEach(() => {
    service = new WhatsAppService();
    vi.clearAllMocks();
    
    // Set environment variables
    process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
    process.env.TWILIO_WHATSAPP_NUMBER = '+15005550006';
    process.env.NEXT_PUBLIC_APP_URL = 'https://parkpos.com';
    process.env.SUPPORT_PHONE = '+51999999999';
    
    // Default mock responses
    vi.mocked(prisma.whatsapp_messages.count).mockResolvedValue(0);
    vi.mocked(prisma.whatsapp_messages.create).mockImplementation((args: any) => ({
      id: 'msg-123',
      ...args.data,
      created_at: new Date(),
      sent_at: null,
      delivered_at: null,
    }));
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ sid: 'twilio-sid-123' }),
    });
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_NUMBER;
  });

  describe('getTemplate', () => {
    it('should return ORDER_ASSIGNED template', () => {
      const template = service.getTemplate('ORDER_ASSIGNED');
      
      expect(template.name).toBe('ORDER_ASSIGNED');
      expect(template.body).toContain('{{customer_name}}');
      expect(template.body).toContain('{{order_number}}');
      expect(template.body).toContain('{{driver_name}}');
      expect(template.body).toContain('{{eta}}');
      expect(template.variables).toEqual(['customer_name', 'order_number', 'driver_name', 'eta']);
    });

    it('should return ORDER_DISPATCHED template', () => {
      const template = service.getTemplate('ORDER_DISPATCHED');
      
      expect(template.name).toBe('ORDER_DISPATCHED');
      expect(template.body).toContain('🚗');
      expect(template.body).toContain('{{tracking_link}}');
      expect(template.variables).toEqual(['driver_name', 'order_number', 'tracking_link']);
    });

    it('should return ETA_UPDATE template', () => {
      const template = service.getTemplate('ETA_UPDATE');
      
      expect(template.name).toBe('ETA_UPDATE');
      expect(template.body).toContain('Actualización');
      expect(template.variables).toEqual(['order_number', 'eta']);
    });

    it('should return ORDER_DELIVERED template', () => {
      const template = service.getTemplate('ORDER_DELIVERED');
      
      expect(template.name).toBe('ORDER_DELIVERED');
      expect(template.body).toContain('✅');
      expect(template.body).toContain('{{feedback_link}}');
      expect(template.variables).toEqual(['order_number', 'feedback_link']);
    });

    it('should return ORDER_FAILED template', () => {
      const template = service.getTemplate('ORDER_FAILED');
      
      expect(template.name).toBe('ORDER_FAILED');
      expect(template.body).toContain('❌');
      expect(template.body).toContain('{{reason}}');
      expect(template.body).toContain('{{support_phone}}');
      expect(template.variables).toEqual(['order_number', 'reason', 'support_phone']);
    });
  });

  describe('canSendMessage', () => {
    it('should return true when under rate limit', async () => {
      vi.mocked(prisma.whatsapp_messages.count).mockResolvedValue(5);
      
      const canSend = await service.canSendMessage(mockPhoneNumber);
      
      expect(canSend).toBe(true);
    });

    it('should return false when at rate limit', async () => {
      vi.mocked(prisma.whatsapp_messages.count).mockResolvedValue(10);
      
      const canSend = await service.canSendMessage(mockPhoneNumber);
      
      expect(canSend).toBe(false);
    });

    it('should return false when over rate limit', async () => {
      vi.mocked(prisma.whatsapp_messages.count).mockResolvedValue(15);
      
      const canSend = await service.canSendMessage(mockPhoneNumber);
      
      expect(canSend).toBe(false);
    });

    it('should check messages from today only', async () => {
      await service.canSendMessage(mockPhoneNumber);
      
      const countCall = vi.mocked(prisma.whatsapp_messages.count).mock.calls[0]?.[0];
      expect(countCall?.where?.phone_number).toBe(mockPhoneNumber);
      expect(countCall?.where?.created_at).toBeDefined();
      
      // Verify date is today at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const createdAt = countCall?.where?.created_at as any;
      if (createdAt && typeof createdAt === 'object' && 'gte' in createdAt) {
        expect(createdAt.gte.getTime()).toBe(today.getTime());
      }
    });
  });

  describe('sendOrderAssigned', () => {
    it('should send ORDER_ASSIGNED message successfully', async () => {
      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        customer_phone: mockPhoneNumber,
        drivers: { name: 'Carlos Ruiz' },
        orders: { customers: { name: 'Juan Pérez' } },
      } as never);

      await service.sendOrderAssigned(mockOrderId);

      // Verify message was created
      expect(prisma.whatsapp_messages.create).toHaveBeenCalled();
      const createCall = vi.mocked(prisma.whatsapp_messages.create).mock.calls[0][0];
      
      expect(createCall.data.order_id).toBe(mockOrderId);
      expect(createCall.data.phone_number).toBe(mockPhoneNumber);
      expect(createCall.data.template_name).toBe('ORDER_ASSIGNED');
      expect(createCall.data.message_body).toContain('Juan Pérez');
      expect(createCall.data.message_body).toContain('Carlos Ruiz');
      expect(createCall.data.status).toBe('SENT');
      expect(createCall.data.twilio_sid).toBe('twilio-sid-123');
    });

    it('should throw error when order not found', async () => {
      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue(null);

      await expect(service.sendOrderAssigned(mockOrderId)).rejects.toThrow('Order not found');
    });

    it('should throw error when driver not assigned', async () => {
      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        customer_phone: mockPhoneNumber,
        drivers: null,
      } as never);

      await expect(service.sendOrderAssigned(mockOrderId)).rejects.toThrow('no assigned driver');
    });
  });

  describe('sendOrderDispatched', () => {
    it('should send ORDER_DISPATCHED message with tracking link', async () => {
      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        customer_phone: mockPhoneNumber,
        drivers: { name: 'Carlos Ruiz' },
      } as never);

      await service.sendOrderDispatched(mockOrderId);

      const createCall = vi.mocked(prisma.whatsapp_messages.create).mock.calls[0][0];
      
      expect(createCall.data.template_name).toBe('ORDER_DISPATCHED');
      expect(createCall.data.message_body).toContain('Carlos Ruiz');
      expect(createCall.data.message_body).toContain('https://parkpos.com/track/');
      expect(createCall.data.message_body).toContain(mockOrderId);
    });
  });

  describe('sendETAUpdate', () => {
    it('should send ETA_UPDATE message', async () => {
      // Use a unique orderId to avoid debounce interference with other tests
      const etaOrderId = toOrderId('order-eta-send');
      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: etaOrderId,
        customer_phone: mockPhoneNumber,
      } as never);

      await service.sendETAUpdate(etaOrderId, 25);

      const createCall = vi.mocked(prisma.whatsapp_messages.create).mock.calls[0][0];

      expect(createCall.data.template_name).toBe('ETA_UPDATE');
      expect(createCall.data.message_body).toContain('25');
    });

    it('should debounce rapid ETA updates', async () => {
      // Use a unique orderId to avoid debounce interference with other tests
      const debounceOrderId = toOrderId('order-debounce-test');
      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: debounceOrderId,
        customer_phone: mockPhoneNumber,
      } as never);

      // Send first update
      await service.sendETAUpdate(debounceOrderId, 30);
      expect(vi.mocked(prisma.whatsapp_messages.create)).toHaveBeenCalledTimes(1);

      // Send second update immediately (should be debounced)
      await service.sendETAUpdate(debounceOrderId, 25);
      expect(vi.mocked(prisma.whatsapp_messages.create)).toHaveBeenCalledTimes(1); // Still 1

      // Send third update immediately (should be debounced)
      await service.sendETAUpdate(debounceOrderId, 20);
      expect(vi.mocked(prisma.whatsapp_messages.create)).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('sendOrderDelivered', () => {
    it('should send ORDER_DELIVERED message with feedback link', async () => {
      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        customer_phone: mockPhoneNumber,
      } as never);

      await service.sendOrderDelivered(mockOrderId);

      const createCall = vi.mocked(prisma.whatsapp_messages.create).mock.calls[0][0];
      
      expect(createCall.data.template_name).toBe('ORDER_DELIVERED');
      expect(createCall.data.message_body).toContain('✅');
      expect(createCall.data.message_body).toContain('https://parkpos.com/feedback/');
      expect(createCall.data.message_body).toContain(mockOrderId);
    });
  });

  describe('sendOrderFailed', () => {
    it('should send ORDER_FAILED message with reason', async () => {
      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        customer_phone: mockPhoneNumber,
      } as never);

      await service.sendOrderFailed(mockOrderId, 'Dirección incorrecta');

      const createCall = vi.mocked(prisma.whatsapp_messages.create).mock.calls[0][0];
      
      expect(createCall.data.template_name).toBe('ORDER_FAILED');
      expect(createCall.data.message_body).toContain('❌');
      expect(createCall.data.message_body).toContain('Dirección incorrecta');
      expect(createCall.data.message_body).toContain('+51999999999');
    });
  });

  describe('Rate Limiting', () => {
    it('should queue message when rate limit exceeded', async () => {
      vi.mocked(prisma.whatsapp_messages.count).mockResolvedValue(10);
      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        customer_phone: mockPhoneNumber,
        drivers: { name: 'Carlos Ruiz' },
      } as never);

      await service.sendOrderAssigned(mockOrderId);

      const createCall = vi.mocked(prisma.whatsapp_messages.create).mock.calls[0][0];
      
      expect(createCall.data.status).toBe('QUEUED');
      expect(createCall.data.error_message).toContain('Rate limit exceeded');
      expect(global.fetch).not.toHaveBeenCalled(); // Should not call Twilio
    });
  });

  describe('Twilio API Integration', () => {
    it('should call Twilio API with correct parameters', async () => {
      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        customer_phone: mockPhoneNumber,
        drivers: { name: 'Carlos Ruiz' },
      } as never);

      await service.sendOrderAssigned(mockOrderId);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.twilio.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should handle Twilio API failure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        text: async () => 'Twilio error message',
      });

      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        customer_phone: mockPhoneNumber,
        drivers: { name: 'Carlos Ruiz' },
      } as never);

      await service.sendOrderAssigned(mockOrderId);

      const createCall = vi.mocked(prisma.whatsapp_messages.create).mock.calls[0][0];
      
      expect(createCall.data.status).toBe('FAILED');
      expect(createCall.data.error_message).toContain('Twilio API error');
    });

    it('should handle network error', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        customer_phone: mockPhoneNumber,
        drivers: { name: 'Carlos Ruiz' },
      } as never);

      await service.sendOrderAssigned(mockOrderId);

      const createCall = vi.mocked(prisma.whatsapp_messages.create).mock.calls[0][0];
      
      expect(createCall.data.status).toBe('FAILED');
      expect(createCall.data.error_message).toContain('Network error');
    });

    it('should skip Twilio when credentials not configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;

      vi.mocked(prisma.delivery_orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        customer_phone: mockPhoneNumber,
        drivers: { name: 'Carlos Ruiz' },
      } as never);

      await service.sendOrderAssigned(mockOrderId);

      expect(global.fetch).not.toHaveBeenCalled();
      
      const createCall = vi.mocked(prisma.whatsapp_messages.create).mock.calls[0][0];
      expect(createCall.data.status).toBe('FAILED');
      expect(createCall.data.error_message).toContain('not configured');
    });
  });

  describe('Template Rendering', () => {
    it('should replace all variables in template', () => {
      const template = MESSAGE_TEMPLATES.ORDER_ASSIGNED;
      const variables = {
        customer_name: 'Juan Pérez',
        order_number: '123456',
        driver_name: 'Carlos Ruiz',
        eta: '30',
      };

      const rendered = (service as any).renderTemplate(template, variables);

      expect(rendered).toContain('Juan Pérez');
      expect(rendered).toContain('123456');
      expect(rendered).toContain('Carlos Ruiz');
      expect(rendered).toContain('30');
      expect(rendered).not.toContain('{{');
      expect(rendered).not.toContain('}}');
    });

    it('should throw error when variable is missing', () => {
      const template = MESSAGE_TEMPLATES.ORDER_ASSIGNED;
      const variables = {
        customer_phone: 'Juan Pérez',
        // Missing: order_number, driver_name, eta
      };

      expect(() => {
        (service as any).renderTemplate(template, variables);
      }).toThrow('Missing variable');
    });
  });
});
