/**
 * PedidosYa Adapter Tests
 *
 * @module core/integrations/platforms/__tests__/pedidosya-adapter.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { PedidosYaAdapter } from '../pedidosya-adapter';

let adapter: PedidosYaAdapter;

beforeEach(() => {
  adapter = new PedidosYaAdapter();
});

// ============================================================================
// validateWebhook
// ============================================================================

describe('validateWebhook', () => {
  const secret = 'test-secret-key';

  it('debe validar firma correcta', () => {
    const payload = '{"id":"order-1"}';
    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    const result = adapter.validateWebhook(payload, signature, secret);
    expect(result.valid).toBe(true);
    expect(result.eventType).toBe('NEW_ORDER');
  });

  it('debe rechazar firma incorrecta', () => {
    const payload = '{"id":"order-1"}';
    const result = adapter.validateWebhook(payload, 'wrong-signature', secret);
    expect(result.valid).toBe(false);
    expect(result.eventType).toBeUndefined();
  });

  it('debe rechazar payload vacío', () => {
    const result = adapter.validateWebhook('', 'sig', secret);
    expect(result.valid).toBe(false);
  });

  it('debe rechazar signature vacía', () => {
    const result = adapter.validateWebhook('payload', '', secret);
    expect(result.valid).toBe(false);
  });

  it('debe rechazar secret vacío', () => {
    const result = adapter.validateWebhook('payload', 'sig', '');
    expect(result.valid).toBe(false);
  });

  it('debe detectar payload modificado', () => {
    const originalPayload = '{"id":"order-1"}';
    const signature = createHmac('sha256', secret).update(originalPayload).digest('hex');
    const modifiedPayload = '{"id":"order-2"}';

    const result = adapter.validateWebhook(modifiedPayload, signature, secret);
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// parseOrder
// ============================================================================

describe('parseOrder', () => {
  it('debe parsear pedido completo', () => {
    const payload = {
      id: 'PY-12345',
      customer: { name: 'Juan Pérez', phone: '+51987654321' },
      address: { description: 'Av. Javier Prado 1234, San Isidro' },
      details: [
        { name: '1/4 Pollo a la Brasa', quantity: 2, unitPrice: 25.50, comments: 'Extra crispy' },
        { name: 'Inca Kola 1L', quantity: 1, unitPrice: 8.00 },
      ],
      totalAmount: 59.00,
      estimatedPickupTime: '2026-02-20T19:30:00Z',
      comments: 'Sin cubiertos',
    };

    const result = adapter.parseOrder(payload);
    expect(result.platformOrderId).toBe('PY-12345');
    expect(result.customerName).toBe('Juan Pérez');
    expect(result.customerPhone).toBe('+51987654321');
    expect(result.deliveryAddress).toBe('Av. Javier Prado 1234, San Isidro');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe('1/4 Pollo a la Brasa');
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[0].unitPriceCents).toBe(2550);
    expect(result.items[0].notes).toBe('Extra crispy');
    expect(result.items[1].unitPriceCents).toBe(800);
    expect(result.platformTotalCents).toBe(5900);
    expect(result.estimatedPickup).toBe('2026-02-20T19:30:00Z');
    expect(result.notes).toBe('Sin cubiertos');
  });

  it('debe parsear pedido con datos mínimos', () => {
    const payload = { id: 'PY-MIN-001' };

    const result = adapter.parseOrder(payload);
    expect(result.platformOrderId).toBe('PY-MIN-001');
    expect(result.customerName).toBeNull();
    expect(result.customerPhone).toBeNull();
    expect(result.deliveryAddress).toBeNull();
    expect(result.items).toHaveLength(0);
    expect(result.platformTotalCents).toBe(0);
    expect(result.notes).toBeNull();
  });

  it('debe calcular total desde items si no hay totalAmount', () => {
    const payload = {
      id: 'PY-CALC',
      details: [
        { name: 'Item A', quantity: 2, unitPrice: 10.00 },
        { name: 'Item B', quantity: 1, unitPrice: 15.50 },
      ],
    };

    const result = adapter.parseOrder(payload);
    expect(result.platformTotalCents).toBe(3550); // (2*1000)+(1*1550)
  });

  it('debe lanzar error con payload null', () => {
    expect(() => adapter.parseOrder(null)).toThrow('Invalid PedidosYa payload');
  });

  it('debe lanzar error sin id', () => {
    expect(() => adapter.parseOrder({ customer: {} })).toThrow('missing id');
  });

  it('debe manejar items sin comentarios', () => {
    const payload = {
      id: 'PY-NOCOMM',
      details: [{ name: 'Pollo', quantity: 1, unitPrice: 30.00 }],
    };

    const result = adapter.parseOrder(payload);
    expect(result.items[0].notes).toBeUndefined();
  });

  it('debe convertir precios a centavos correctamente', () => {
    const payload = {
      id: 'PY-CENTS',
      details: [{ name: 'Item', quantity: 1, unitPrice: 19.99 }],
      totalAmount: 19.99,
    };

    const result = adapter.parseOrder(payload);
    expect(result.items[0].unitPriceCents).toBe(1999);
    expect(result.platformTotalCents).toBe(1999);
  });
});

// ============================================================================
// acceptOrder
// ============================================================================

describe('acceptOrder', () => {
  const config = { apiKey: 'test-key', storeId: 'store-1' };

  it('debe retornar true si API responde OK', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await adapter.acceptOrder(config, 'PY-123');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/orders/PY-123/accept'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('debe retornar false si API falla', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await adapter.acceptOrder(config, 'PY-123');
    expect(result).toBe(false);
  });

  it('debe retornar false si hay error de red', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await adapter.acceptOrder(config, 'PY-123');
    expect(result).toBe(false);
  });

  it('debe enviar Authorization header correcto', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await adapter.acceptOrder(config, 'PY-123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );
  });
});

// ============================================================================
// rejectOrder
// ============================================================================

describe('rejectOrder', () => {
  const config = { apiKey: 'test-key', storeId: 'store-1' };

  it('debe enviar razón de rechazo', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await adapter.rejectOrder(config, 'PY-123', 'Sin stock');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/reject'),
      expect.objectContaining({
        body: JSON.stringify({ reason: 'Sin stock' }),
      }),
    );
  });

  it('debe retornar false si API falla', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await adapter.rejectOrder(config, 'PY-123', 'reason');
    expect(result).toBe(false);
  });
});

// ============================================================================
// updateOrderStatus
// ============================================================================

describe('updateOrderStatus', () => {
  const config = { apiKey: 'test-key', storeId: 'store-1' };

  it('debe actualizar status correctamente', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await adapter.updateOrderStatus(config, 'PY-123', 'PREPARING');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/status'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ status: 'PREPARING' }),
      }),
    );
  });

  it('debe retornar false si hay error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await adapter.updateOrderStatus(config, 'PY-123', 'READY');
    expect(result).toBe(false);
  });
});

// ============================================================================
// Platform identity
// ============================================================================

describe('platform identity', () => {
  it('debe identificarse como PEDIDOSYA', () => {
    expect(adapter.platform).toBe('PEDIDOSYA');
  });
});
