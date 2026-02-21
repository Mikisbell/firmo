/**
 * ESC/POS Builder Tests
 *
 * @module core/printing/__tests__/escpos-builder.test
 */

import { describe, it, expect } from 'vitest';
import { ESCPOSBuilder } from '../escpos-builder';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

describe('ESCPOSBuilder', () => {
  describe('initialize', () => {
    it('debe emitir ESC @', () => {
      const result = new ESCPOSBuilder().initialize().build();
      expect(result[0]).toBe(ESC);
      expect(result[1]).toBe(0x40);
    });
  });

  describe('text', () => {
    it('debe codificar texto UTF-8', () => {
      const result = new ESCPOSBuilder().text('Hola').build();
      expect(new TextDecoder().decode(result)).toBe('Hola');
    });

    it('debe manejar caracteres especiales', () => {
      const result = new ESCPOSBuilder().text('S/ 15.50').build();
      expect(new TextDecoder().decode(result)).toBe('S/ 15.50');
    });

    it('debe manejar texto vacío', () => {
      const result = new ESCPOSBuilder().text('').build();
      expect(result.length).toBe(0);
    });
  });

  describe('lineFeed', () => {
    it('debe emitir LF', () => {
      const result = new ESCPOSBuilder().lineFeed().build();
      expect(result[0]).toBe(LF);
      expect(result.length).toBe(1);
    });

    it('debe emitir múltiples LF', () => {
      const result = new ESCPOSBuilder().lineFeed(3).build();
      expect(result.length).toBe(3);
      expect(result[0]).toBe(LF);
      expect(result[1]).toBe(LF);
      expect(result[2]).toBe(LF);
    });
  });

  describe('bold', () => {
    it('debe emitir ESC E 1 para bold on', () => {
      const result = new ESCPOSBuilder().bold(true).build();
      expect(result[0]).toBe(ESC);
      expect(result[1]).toBe(0x45);
      expect(result[2]).toBe(0x01);
    });

    it('debe emitir ESC E 0 para bold off', () => {
      const result = new ESCPOSBuilder().bold(false).build();
      expect(result[2]).toBe(0x00);
    });
  });

  describe('underline', () => {
    it('debe emitir ESC - 1 para underline on', () => {
      const result = new ESCPOSBuilder().underline(true).build();
      expect(result[0]).toBe(ESC);
      expect(result[1]).toBe(0x2d);
      expect(result[2]).toBe(0x01);
    });
  });

  describe('align', () => {
    it('debe alinear a la izquierda (ESC a 0)', () => {
      const result = new ESCPOSBuilder().align('left').build();
      expect(result[0]).toBe(ESC);
      expect(result[1]).toBe(0x61);
      expect(result[2]).toBe(0x00);
    });

    it('debe alinear al centro (ESC a 1)', () => {
      const result = new ESCPOSBuilder().align('center').build();
      expect(result[2]).toBe(0x01);
    });

    it('debe alinear a la derecha (ESC a 2)', () => {
      const result = new ESCPOSBuilder().align('right').build();
      expect(result[2]).toBe(0x02);
    });
  });

  describe('fontSize', () => {
    it('debe establecer tamaño normal (GS ! 0x00)', () => {
      const result = new ESCPOSBuilder().fontSize(1, 1).build();
      expect(result[0]).toBe(GS);
      expect(result[1]).toBe(0x21);
      expect(result[2]).toBe(0x00);
    });

    it('debe establecer doble alto (GS ! 0x01)', () => {
      const result = new ESCPOSBuilder().fontSize(1, 2).build();
      expect(result[2]).toBe(0x01);
    });

    it('debe establecer doble ancho (GS ! 0x10)', () => {
      const result = new ESCPOSBuilder().fontSize(2, 1).build();
      expect(result[2]).toBe(0x10);
    });

    it('debe establecer doble ancho y alto (GS ! 0x11)', () => {
      const result = new ESCPOSBuilder().fontSize(2, 2).build();
      expect(result[2]).toBe(0x11);
    });
  });

  describe('separator', () => {
    it('debe generar línea de separación', () => {
      const result = new ESCPOSBuilder().separator('-', 10).build();
      const decoded = new TextDecoder().decode(result);
      expect(decoded).toContain('----------');
      // Should end with LF
      expect(result[result.length - 1]).toBe(LF);
    });

    it('debe usar carácter personalizado', () => {
      const result = new ESCPOSBuilder().separator('=', 5).build();
      const decoded = new TextDecoder().decode(result);
      expect(decoded).toContain('=====');
    });
  });

  describe('textColumns', () => {
    it('debe alinear texto izquierda-derecha', () => {
      const result = new ESCPOSBuilder().textColumns('Item', 'S/ 10.00', 20).build();
      const decoded = new TextDecoder().decode(result);
      expect(decoded).toContain('Item');
      expect(decoded).toContain('S/ 10.00');
      // Should end with LF
      expect(result[result.length - 1]).toBe(LF);
    });
  });

  describe('qrCode', () => {
    it('debe generar comandos QR', () => {
      const result = new ESCPOSBuilder().qrCode('https://test.com').build();
      // Should contain GS ( k sequences
      expect(result.length).toBeGreaterThan(30);
      // Should start with GS ( k for model selection
      expect(result[0]).toBe(GS);
      expect(result[1]).toBe(0x28);
      expect(result[2]).toBe(0x6b);
    });

    it('debe incluir los datos del QR', () => {
      const data = 'TEST_QR_DATA';
      const result = new ESCPOSBuilder().qrCode(data).build();
      const decoded = new TextDecoder().decode(result);
      expect(decoded).toContain(data);
    });
  });

  describe('cut', () => {
    it('debe emitir corte parcial (GS V 1)', () => {
      const result = new ESCPOSBuilder().cut(true).build();
      // 3 LF + GS V 1
      const cutCmd = result.slice(-2);
      expect(cutCmd[0]).toBe(0x56);
      expect(cutCmd[1]).toBe(0x01);
    });

    it('debe emitir corte total (GS V 0)', () => {
      const result = new ESCPOSBuilder().cut(false).build();
      const cutCmd = result.slice(-2);
      expect(cutCmd[1]).toBe(0x00);
    });

    it('debe agregar line feeds antes del corte', () => {
      const result = new ESCPOSBuilder().cut().build();
      // Should have 3 LFs before the GS V command
      expect(result[0]).toBe(LF);
      expect(result[1]).toBe(LF);
      expect(result[2]).toBe(LF);
    });
  });

  describe('openDrawer', () => {
    it('debe emitir ESC p para pin 0', () => {
      const result = new ESCPOSBuilder().openDrawer(0).build();
      expect(result[0]).toBe(ESC);
      expect(result[1]).toBe(0x70);
      expect(result[2]).toBe(0x00); // pin 0
    });

    it('debe emitir ESC p para pin 1', () => {
      const result = new ESCPOSBuilder().openDrawer(1).build();
      expect(result[2]).toBe(0x01);
    });
  });

  describe('build', () => {
    it('debe retornar vacío si no hay comandos', () => {
      const result = new ESCPOSBuilder().build();
      expect(result.length).toBe(0);
    });

    it('debe concatenar múltiples operaciones', () => {
      const result = new ESCPOSBuilder()
        .initialize()
        .bold(true)
        .text('TEST')
        .bold(false)
        .lineFeed()
        .build();

      expect(result.length).toBeGreaterThan(10);
      // First should be ESC @ (initialize)
      expect(result[0]).toBe(ESC);
      expect(result[1]).toBe(0x40);
    });

    it('debe generar receipt completo', () => {
      const result = new ESCPOSBuilder()
        .initialize()
        .align('center')
        .bold(true)
        .fontSize(2, 2)
        .text('MI RESTAURANTE')
        .lineFeed()
        .fontSize(1, 1)
        .bold(false)
        .text('Av. Principal 123')
        .lineFeed()
        .separator()
        .align('left')
        .textColumns('1x Pollo', 'S/ 45.00')
        .textColumns('2x Gaseosa', 'S/ 10.00')
        .separator()
        .bold(true)
        .textColumns('TOTAL', 'S/ 55.00')
        .bold(false)
        .lineFeed()
        .align('center')
        .qrCode('20123456789|03|B001|001|9.90|55.00|2025-12-15')
        .lineFeed()
        .text('Gracias por su compra')
        .cut()
        .build();

      expect(result.length).toBeGreaterThan(100);
    });
  });

  describe('size', () => {
    it('debe retornar tamaño actual del buffer', () => {
      const builder = new ESCPOSBuilder();
      expect(builder.size).toBe(0);

      builder.initialize();
      expect(builder.size).toBe(2); // ESC @

      builder.text('Hi');
      expect(builder.size).toBe(4); // ESC @ + "Hi"
    });
  });

  describe('fluent API', () => {
    it('debe soportar encadenamiento', () => {
      const builder = new ESCPOSBuilder();
      const result = builder.initialize().bold(true).text('X').bold(false).lineFeed();
      expect(result).toBe(builder); // Returns same instance
    });
  });
});
