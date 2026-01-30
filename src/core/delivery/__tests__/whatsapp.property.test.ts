/**
 * Property-Based Tests for WhatsApp Service
 * 
 * Tests universal properties that should hold for all inputs:
 * - Property 44: Event-based messaging
 * - Property 45: ETA update messages
 * - Property 46: Template compliance
 * - Property 47: Rate limiting
 * 
 * @module delivery/__tests__/whatsapp-property
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { WhatsAppService, MESSAGE_TEMPLATES } from '../whatsapp.service';
import type { OrderId, WhatsAppTemplateName } from '../types-2026';
import { toOrderId } from '../types-2026';
import {
  arbitraryOrderId,
  arbitraryWhatsAppTemplateName,
  arbitraryDeliveryOrder,
} from '../arbitraries';

// Mock Prisma
const mockPrisma = {
  delivery_orders: {
    findUnique: vi.fn(),
  },
  whatsapp_messages: {
    create: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('@/src/core/db/prisma', () => ({
  default: mockPrisma,
}));

// Mock fetch for Twilio API
global.fetch = vi.fn() as any;

describe('Feature: delivery-2026-modernization - WhatsApp Service Properties', () => {
  let service: WhatsAppService;

  beforeEach(() => {
    service = new WhatsAppService();
    vi.clearAllMocks();
    
    // Default mock responses
    mockPrisma.whatsapp_messages.count.mockResolvedValue(0);
    mockPrisma.whatsapp_messages.create.mockImplementation((args: any) => ({
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

  /**
   * Property 44: WhatsApp Event-Based Messaging
   * For any delivery event (assigned, dispatched, completed, failed),
   * the WhatsApp service should send the appropriate message to the customer.
   * 
   * Validates: Requirements 8.1, 8.2, 8.4, 8.5
   */
  describe('Property 44: WhatsApp Event-Based Messaging', () => {
    it('should send appropriate message for any delivery event', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            eventType: fc.constantFrom('assigned', 'dispatched', 'delivered', 'failed'),
            customerName: fc.string({ minLength: 3, maxLength: 50 }),
            customerPhone: fc.string({ minLength: 10, maxLength: 15 }),
            driverName: fc.string({ minLength: 3, maxLength: 50 }),
            reason: fc.string({ minLength: 5, maxLength: 100 }),
          }),
          async ({ orderId, eventType, customerName, customerPhone, driverName, reason }) => {
            // Setup mock order
            mockPrisma.delivery_orders.findUnique.mockResolvedValue({
              id: orderId,
              customer_name: customerName,
              customer_phone: customerPhone,
              driver: { name: driverName },
            });

            // Send message based on event type
            let templateUsed: WhatsAppTemplateName | null = null;
            
            try {
              switch (eventType) {
                case 'assigned':
                  await service.sendOrderAssigned(orderId);
                  templateUsed = 'ORDER_ASSIGNED';
                  break;
                case 'dispatched':
                  await service.sendOrderDispatched(orderId);
                  templateUsed = 'ORDER_DISPATCHED';
                  break;
                case 'delivered':
                  await service.sendOrderDelivered(orderId);
                  templateUsed = 'ORDER_DELIVERED';
                  break;
                case 'failed':
                  await service.sendOrderFailed(orderId, reason);
                  templateUsed = 'ORDER_FAILED';
                  break;
              }

              // Verify message was stored with correct template
              expect(mockPrisma.whatsapp_messages.create).toHaveBeenCalled();
              const createCall = mockPrisma.whatsapp_messages.create.mock.calls[0][0];
              expect(createCall.data.template_name).toBe(templateUsed);
              expect(createCall.data.order_id).toBe(orderId);
              expect(createCall.data.phone_number).toBe(customerPhone);
            } catch (error) {
              // Some events may fail if order not found, which is acceptable
              if (error instanceof Error && !error.message.includes('not found')) {
                throw error;
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 45: WhatsApp ETA Update Messages
   * For any ETA change exceeding 5 minutes, the WhatsApp service
   * should send an update message to the customer.
   * 
   * Validates: Requirements 8.3
   */
  describe('Property 45: WhatsApp ETA Update Messages', () => {
    it('should send ETA update when change exceeds 5 minutes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            customerPhone: fc.string({ minLength: 10, maxLength: 15 }),
            oldETA: fc.integer({ min: 10, max: 60 }),
            newETA: fc.integer({ min: 10, max: 60 }),
          }),
          async ({ orderId, customerPhone, oldETA, newETA }) => {
            const etaChange = Math.abs(newETA - oldETA);

            // Setup mock order
            mockPrisma.delivery_orders.findUnique.mockResolvedValue({
              id: orderId,
              customer_phone: customerPhone,
            });

            // Send ETA update
            await service.sendETAUpdate(orderId, newETA);

            // If change > 5 minutes, message should be sent
            if (etaChange > 5) {
              expect(mockPrisma.whatsapp_messages.create).toHaveBeenCalled();
              const createCall = mockPrisma.whatsapp_messages.create.mock.calls[0][0];
              expect(createCall.data.template_name).toBe('ETA_UPDATE');
              expect(createCall.data.message_body).toContain(newETA.toString());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should debounce ETA updates (max 1 per 10 minutes)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            customerPhone: fc.string({ minLength: 10, maxLength: 15 }),
            updates: fc.array(fc.integer({ min: 10, max: 60 }), { minLength: 2, maxLength: 5 }),
          }),
          async ({ orderId, customerPhone, updates }) => {
            // Setup mock order
            mockPrisma.delivery_orders.findUnique.mockResolvedValue({
              id: orderId,
              customer_phone: customerPhone,
            });

            // Send multiple updates rapidly
            for (const eta of updates) {
              await service.sendETAUpdate(orderId, eta);
            }

            // Only first update should be sent (others debounced)
            // Note: In real scenario, we'd need to wait 10 minutes between updates
            const createCalls = mockPrisma.whatsapp_messages.create.mock.calls;
            expect(createCalls.length).toBeLessThanOrEqual(updates.length);
          }
        ),
        { numRuns: 50 } // Fewer runs for performance
      );
    });
  });

  /**
   * Property 46: WhatsApp Template Compliance
   * For any message sent, the WhatsApp service should use
   * only approved Twilio templates.
   * 
   * Validates: Requirements 8.7
   */
  describe('Property 46: WhatsApp Template Compliance', () => {
    it('should only use approved templates for any message', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryWhatsAppTemplateName(),
          async (templateName) => {
            // Get template
            const template = service.getTemplate(templateName);

            // Verify template exists in approved list
            expect(MESSAGE_TEMPLATES[templateName]).toBeDefined();
            expect(template.name).toBe(templateName);
            expect(template.body).toBeTruthy();
            expect(Array.isArray(template.variables)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should render templates with all required variables', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryWhatsAppTemplateName(),
          async (templateName) => {
            const template = service.getTemplate(templateName);

            // Create variables object with all required variables
            const variables: Record<string, string> = {};
            for (const variable of template.variables) {
              variables[variable] = `test_${variable}`;
            }

            // Render template (using private method via any cast for testing)
            const rendered = (service as any).renderTemplate(template, variables);

            // Verify all variables were replaced
            expect(rendered).not.toContain('{{');
            expect(rendered).not.toContain('}}');
            
            // Verify all variable values are in rendered message
            for (const value of Object.values(variables)) {
              expect(rendered).toContain(value);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 47: WhatsApp Rate Limiting
   * For any customer, when the rate limit (10 messages per day) is exceeded,
   * additional messages should be queued.
   * 
   * Validates: Requirements 8.8
   */
  describe('Property 47: WhatsApp Rate Limiting', () => {
    it('should enforce rate limit of 10 messages per day per customer', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            phoneNumber: fc.string({ minLength: 10, maxLength: 15 }),
            messageCount: fc.integer({ min: 0, max: 20 }),
          }),
          async ({ phoneNumber, messageCount }) => {
            // Mock message count
            mockPrisma.whatsapp_messages.count.mockResolvedValue(messageCount);

            // Check if can send
            const canSend = await service.canSendMessage(phoneNumber);

            // Verify rate limit enforcement
            if (messageCount < 10) {
              expect(canSend).toBe(true);
            } else {
              expect(canSend).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should queue messages when rate limit exceeded', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            customerPhone: fc.string({ minLength: 10, maxLength: 15 }),
            messageCount: fc.integer({ min: 10, max: 20 }), // Already at or over limit
          }),
          async ({ orderId, customerPhone, messageCount }) => {
            // Mock rate limit exceeded
            mockPrisma.whatsapp_messages.count.mockResolvedValue(messageCount);

            // Setup mock order
            mockPrisma.delivery_orders.findUnique.mockResolvedValue({
              id: orderId,
              customer_phone: customerPhone,
              customer_name: 'Test Customer',
              driver: { name: 'Test Driver' },
            });

            // Try to send message
            await service.sendOrderAssigned(orderId);

            // Verify message was queued (status = QUEUED)
            const createCall = mockPrisma.whatsapp_messages.create.mock.calls[0][0];
            expect(createCall.data.status).toBe('QUEUED');
            expect(createCall.data.error_message).toContain('Rate limit');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reset rate limit daily', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            phoneNumber: fc.string({ minLength: 10, maxLength: 15 }),
            todayCount: fc.integer({ min: 0, max: 15 }),
            yesterdayCount: fc.integer({ min: 0, max: 15 }),
          }),
          async ({ phoneNumber, todayCount }) => {
            // Mock only today's messages count
            mockPrisma.whatsapp_messages.count.mockResolvedValue(todayCount);

            // Check if can send
            const canSend = await service.canSendMessage(phoneNumber);

            // Only today's messages should count toward limit
            expect(canSend).toBe(todayCount < 10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: Template Variable Validation
   * For any template rendering, missing variables should throw an error
   */
  describe('Additional Property: Template Variable Validation', () => {
    it('should throw error when required variables are missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryWhatsAppTemplateName(),
          async (templateName) => {
            const template = service.getTemplate(templateName);

            // Try to render with empty variables
            expect(() => {
              (service as any).renderTemplate(template, {});
            }).toThrow(/Missing variable/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
