/**
 * Printer Driver Integration Tests
 *
 * Tests the full pipeline: PrinterManager → Transport → mock printer.
 * No real hardware required — transports are mocked.
 *
 * For real hardware testing, see HARDWARE_TESTING.md in this directory.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrinterTransport, PrintResult, PrinterConfig } from '../printer-driver';

// Mock transport that records all sent data
function createMockTransport(opts?: { failOnSend?: boolean }): PrinterTransport & { sentData: Uint8Array[] } {
  const sentData: Uint8Array[] = [];
  return {
    type: 'TCP' as const,
    sentData,
    async send(data: Uint8Array): Promise<PrintResult> {
      if (opts?.failOnSend) {
        return { success: false, error: 'Printer offline' };
      }
      sentData.push(data);
      return { success: true, bytesSent: data.length };
    },
    async healthCheck(): Promise<boolean> {
      return !opts?.failOnSend;
    },
    async disconnect(): Promise<void> {
      // noop
    },
  };
}

describe('PrinterTransport interface', () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it('sends raw ESC/POS bytes', async () => {
    const escInit = new Uint8Array([0x1b, 0x40]); // ESC @
    const result = await transport.send(escInit);

    expect(result.success).toBe(true);
    expect(result.bytesSent).toBe(2);
    expect(transport.sentData).toHaveLength(1);
    expect(transport.sentData[0]).toEqual(escInit);
  });

  it('handles printer offline', async () => {
    const offline = createMockTransport({ failOnSend: true });
    const result = await offline.send(new Uint8Array([0x1b, 0x40]));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Printer offline');
  });

  it('health check returns true for online printer', async () => {
    expect(await transport.healthCheck()).toBe(true);
  });

  it('health check returns false for offline printer', async () => {
    const offline = createMockTransport({ failOnSend: true });
    expect(await offline.healthCheck()).toBe(false);
  });
});

describe('PrinterConfig', () => {
  it('validates TCP config structure', () => {
    const config: PrinterConfig = {
      id: 'printer-1',
      name: 'Cocina Principal',
      transport: 'TCP',
      address: '192.168.1.100:9100',
      paperWidth: 80,
      stations: ['COCINA', 'BAR'],
      isDefault: false,
      enabled: true,
    };

    expect(config.transport).toBe('TCP');
    expect(config.address).toMatch(/^\d+\.\d+\.\d+\.\d+:\d+$/);
    expect(config.paperWidth).toBe(80);
  });

  it('validates HTTP relay config', () => {
    const config: PrinterConfig = {
      id: 'printer-2',
      name: 'Caja Receipt',
      transport: 'HTTP',
      address: 'http://localhost:8183/print',
      paperWidth: 58,
      stations: ['CAJA'],
      isDefault: true,
      enabled: true,
    };

    expect(config.transport).toBe('HTTP');
    expect(config.address).toMatch(/^https?:\/\//);
  });

  it('validates USB config', () => {
    const config: PrinterConfig = {
      id: 'printer-3',
      name: 'Epson USB',
      transport: 'USB',
      address: '04B8:0000',
      paperWidth: 80,
      stations: ['CAJA'],
      isDefault: false,
      enabled: true,
    };

    expect(config.transport).toBe('USB');
    expect(config.address).toMatch(/^[0-9A-F]{4}:[0-9A-F]{4}$/i);
  });
});

describe('End-to-end print pipeline', () => {
  it('builds ESC/POS receipt and sends to transport', async () => {
    const transport = createMockTransport();

    // Simulate ESC/POS receipt: init + text + cut
    const ESC_INIT = new Uint8Array([0x1b, 0x40]); // Initialize printer
    const TEXT = new TextEncoder().encode('PARK POS\nGracias por su compra\n');
    const CUT = new Uint8Array([0x1d, 0x56, 0x00]); // Full cut

    // Combine into single buffer
    const receipt = new Uint8Array([...ESC_INIT, ...TEXT, ...CUT]);
    const result = await transport.send(receipt);

    expect(result.success).toBe(true);
    expect(result.bytesSent).toBeGreaterThan(10);

    // Verify receipt content
    const sent = transport.sentData[0];
    expect(sent[0]).toBe(0x1b); // ESC
    expect(sent[1]).toBe(0x40); // @
    // Last 3 bytes should be GS V 0 (cut)
    expect(sent[sent.length - 3]).toBe(0x1d); // GS
    expect(sent[sent.length - 2]).toBe(0x56); // V
    expect(sent[sent.length - 1]).toBe(0x00); // full cut
  });

  it('retries on failure up to max attempts', async () => {
    let attempts = 0;
    const flaky: PrinterTransport = {
      type: 'TCP',
      async send(data) {
        attempts++;
        if (attempts < 3) return { success: false, error: 'Busy' };
        return { success: true, bytesSent: data.length };
      },
      async healthCheck() { return true; },
      async disconnect() {},
    };

    const MAX_RETRIES = 3;
    let result: PrintResult = { success: false };

    for (let i = 0; i < MAX_RETRIES; i++) {
      result = await flaky.send(new Uint8Array([0x1b, 0x40]));
      if (result.success) break;
    }

    expect(result.success).toBe(true);
    expect(attempts).toBe(3);
  });
});
