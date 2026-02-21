/**
 * LlamaFood Adapter Tests
 *
 * @module core/integrations/platforms/__tests__/llamafood-adapter.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { LlamaFoodAdapter } from '../llamafood-adapter';

let adapter: LlamaFoodAdapter;

beforeEach(() => {
  adapter = new LlamaFoodAdapter();
});

// ============================================================================
// validateWebhook
// ============================================================================

describe('validateWebhook', () => {
  const secret = 'llamafood-secret';

  it('debe validar firma HMAC correcta', () => {
    const payload = '{"pedido_id":"LF-001"}';
    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    const result = adapter.validateWebhook(payload, signature, secret);
    expect(result.valid).toBe(true);
  });

  it('debe aceptar firma con prefijo sha256=', () => {
    const payload = '{"pedido_id":"LF-001","tipo_evento":"NUEVO_PEDIDO"}';
    const hash = createHmac('sha256', secret).update(payload).digest('hex');
    const signature = `sha256=${hash}`;

    const result = adapter.validateWebhook(payload, signature, secret);
    expect(result.valid).toBe(true);
    expect(result.eventType).toBe('NUEVO_PEDIDO');
  });

  it('debe extraer tipo_evento del payload', () => {
    const payload = '{"pedido_id":"LF-001","tipo_evento":"PEDIDO_CANCELADO"}';
    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    const result = adapter.validateWebhook(payload, signature, secret);
    expect(result.valid).toBe(true);
    expect(result.eventType).toBe('PEDIDO_CANCELADO');
  });

  it('debe usar NUEVO_PEDIDO como tipo por defecto', () => {
    const payload = '{"pedido_id":"LF-001"}';
    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    const result = adapter.validateWebhook(payload, signature, secret);
    expect(result.eventType).toBe('NUEVO_PEDIDO');
  });

  it('debe rechazar firma incorrecta', () => {
    const result = adapter.validateWebhook('payload', 'wrong', secret);
    expect(result.valid).toBe(false);
  });

  it('debe rechazar parámetros vacíos', () => {
    expect(adapter.validateWebhook('', 'sig', secret).valid).toBe(false);
    expect(adapter.validateWebhook('data', '', secret).valid).toBe(false);
    expect(adapter.validateWebhook('data', 'sig', '').valid).toBe(false);
  });
});

// ============================================================================
// parseOrder
// ============================================================================

describe('parseOrder', () => {
  it('debe parsear pedido completo', () => {
    const payload = {
      pedido_id: 'LF-98765',
      cliente: { nombre: 'María García', telefono: '987654321' },
      direccion: 'Jr. de la Unión 456, Cercado de Lima',
      productos: [
        { producto: 'Pollo Entero', cantidad: 1, precio_unitario: 5500, observaciones: 'Con ensalada' },
        { producto: 'Chicha Morada', cantidad: 2, precio_unitario: 800 },
      ],
      total_centavos: 7100,
      hora_recojo_estimada: '2026-02-20T20:00:00Z',
      notas: 'Timbre no funciona, llamar',
    };

    const result = adapter.parseOrder(payload);
    expect(result.platformOrderId).toBe('LF-98765');
    expect(result.customerName).toBe('María García');
    expect(result.customerPhone).toBe('987654321');
    expect(result.deliveryAddress).toBe('Jr. de la Unión 456, Cercado de Lima');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe('Pollo Entero');
    expect(result.items[0].unitPriceCents).toBe(5500);
    expect(result.items[0].notes).toBe('Con ensalada');
    expect(result.items[1].unitPriceCents).toBe(800);
    expect(result.platformTotalCents).toBe(7100);
    expect(result.estimatedPickup).toBe('2026-02-20T20:00:00Z');
    expect(result.notes).toBe('Timbre no funciona, llamar');
  });

  it('debe parsear pedido mínimo', () => {
    const result = adapter.parseOrder({ pedido_id: 'LF-MIN' });
    expect(result.platformOrderId).toBe('LF-MIN');
    expect(result.customerName).toBeNull();
    expect(result.items).toHaveLength(0);
    expect(result.platformTotalCents).toBe(0);
  });

  it('debe calcular total desde productos si no hay total_centavos', () => {
    const payload = {
      pedido_id: 'LF-CALC',
      productos: [
        { producto: 'A', cantidad: 3, precio_unitario: 1000 },
        { producto: 'B', cantidad: 1, precio_unitario: 500 },
      ],
    };

    const result = adapter.parseOrder(payload);
    expect(result.platformTotalCents).toBe(3500); // 3*1000+1*500
  });

  it('debe lanzar error con payload null', () => {
    expect(() => adapter.parseOrder(null)).toThrow('Invalid LlamaFood payload');
  });

  it('debe lanzar error sin pedido_id', () => {
    expect(() => adapter.parseOrder({ cliente: {} })).toThrow('missing pedido_id');
  });

  it('usa ya centavos (no convierte)', () => {
    const payload = {
      pedido_id: 'LF-CENTS',
      productos: [{ producto: 'Item', cantidad: 1, precio_unitario: 2550 }],
      total_centavos: 2550,
    };

    const result = adapter.parseOrder(payload);
    expect(result.items[0].unitPriceCents).toBe(2550);
    expect(result.platformTotalCents).toBe(2550);
  });
});

// ============================================================================
// acceptOrder
// ============================================================================

describe('acceptOrder', () => {
  const config = { apiKey: 'llama-key', storeId: 'tienda-1' };

  it('debe retornar true si API responde OK', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await adapter.acceptOrder(config, 'LF-123');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pedidos/LF-123/aceptar'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Api-Key': 'llama-key' }),
      }),
    );
  });

  it('debe retornar false si API falla', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await adapter.acceptOrder(config, 'LF-123');
    expect(result).toBe(false);
  });

  it('debe retornar false en error de red', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network'));
    const result = await adapter.acceptOrder(config, 'LF-123');
    expect(result).toBe(false);
  });
});

// ============================================================================
// rejectOrder
// ============================================================================

describe('rejectOrder', () => {
  const config = { apiKey: 'llama-key', storeId: 'tienda-1' };

  it('debe enviar motivo de rechazo', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await adapter.rejectOrder(config, 'LF-123', 'Cerrado');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rechazar'),
      expect.objectContaining({
        body: JSON.stringify({ motivo: 'Cerrado' }),
      }),
    );
  });

  it('debe retornar false en error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await adapter.rejectOrder(config, 'LF-123', 'reason');
    expect(result).toBe(false);
  });
});

// ============================================================================
// updateOrderStatus
// ============================================================================

describe('updateOrderStatus', () => {
  const config = { apiKey: 'llama-key', storeId: 'tienda-1' };

  it('debe actualizar estado', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await adapter.updateOrderStatus(config, 'LF-123', 'LISTO');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/estado'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ estado: 'LISTO' }),
      }),
    );
  });
});

// ============================================================================
// Platform identity
// ============================================================================

describe('platform identity', () => {
  it('debe identificarse como LLAMAFOOD', () => {
    expect(adapter.platform).toBe('LLAMAFOOD');
  });
});
