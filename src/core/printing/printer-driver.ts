/**
 * Thermal Printer Communication Layer
 *
 * Provides transport-agnostic printer communication through:
 * - TCP/IP (LAN network printers — most common in POS)
 * - USB (via WebUSB API in browser, or node-usb on server)
 * - HTTP (print relay services like QZ Tray, PrintNode)
 *
 * All transports implement the PrinterTransport interface and receive
 * raw ESC/POS byte arrays from the receipt/kitchen ticket builders.
 *
 * @module core/printing/printer-driver
 */

import { pinoLogger } from '@/src/core/observability/logger-pino';

// ============================================================================
// Transport Interface
// ============================================================================

export interface PrinterTransport {
  /** Unique identifier for this transport */
  readonly type: 'TCP' | 'USB' | 'HTTP';

  /** Send raw ESC/POS bytes to the printer */
  send(data: Uint8Array): Promise<PrintResult>;

  /** Check if the printer is reachable */
  healthCheck(): Promise<boolean>;

  /** Close connection / cleanup */
  disconnect(): Promise<void>;
}

export interface PrintResult {
  success: boolean;
  error?: string;
  /** Bytes actually sent */
  bytesSent?: number;
}

export interface PrinterConfig {
  id: string;
  name: string;
  transport: 'TCP' | 'USB' | 'HTTP';
  /** TCP: "192.168.1.100:9100", USB: vendor:product, HTTP: endpoint URL */
  address: string;
  /** Paper width: 58 or 80 mm */
  paperWidth: 58 | 80;
  /** Assigned stations (COCINA, BAR, CAJA, etc.) */
  stations: string[];
  /** Whether this is the default receipt printer */
  isDefault: boolean;
  enabled: boolean;
}

// ============================================================================
// TCP/IP Transport (LAN Network Printers — most common)
// ============================================================================

/**
 * Sends ESC/POS data to a network printer via raw TCP socket.
 * Standard port: 9100 (Epson, Star, Bixolon, etc.)
 *
 * NOTE: TCP sockets only work server-side (Node.js). For browser-based
 * printing, use the HTTP transport with a print relay.
 */
export class TcpPrinterTransport implements PrinterTransport {
  readonly type = 'TCP' as const;
  private host: string;
  private port: number;

  constructor(address: string) {
    const [host, portStr] = address.split(':');
    this.host = host;
    this.port = parseInt(portStr, 10) || 9100;
  }

  async send(data: Uint8Array): Promise<PrintResult> {
    try {
      // Dynamic import to avoid bundling net in browser
      const net = await import('net');

      return new Promise((resolve) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
          socket.destroy();
          resolve({ success: false, error: 'Connection timeout (5s)' });
        }, 5000);

        socket.connect(this.port, this.host, () => {
          socket.write(Buffer.from(data), (err) => {
            clearTimeout(timeout);
            socket.end();
            if (err) {
              resolve({ success: false, error: err.message });
            } else {
              resolve({ success: true, bytesSent: data.length });
            }
          });
        });

        socket.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ success: false, error: err.message });
        });
      });
    } catch (err) {
      return {
        success: false,
        error: `TCP transport failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const net = await import('net');
      return new Promise((resolve) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, 2000);

        socket.connect(this.port, this.host, () => {
          clearTimeout(timeout);
          socket.end();
          resolve(true);
        });

        socket.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // TCP is connectionless per-job, nothing to clean up
  }
}

// ============================================================================
// HTTP Transport (Print Relay — QZ Tray, PrintNode, custom relay)
// ============================================================================

/**
 * Sends ESC/POS data to a print relay service over HTTP.
 * Supports browser-side printing through a local relay agent.
 *
 * Compatible with:
 * - QZ Tray (http://localhost:8183)
 * - PrintNode API
 * - Custom print relay microservice
 */
export class HttpPrinterTransport implements PrinterTransport {
  readonly type = 'HTTP' as const;
  private endpoint: string;

  constructor(address: string) {
    this.endpoint = address;
  }

  async send(data: Uint8Array): Promise<PrintResult> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from(data) as unknown as BodyInit,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => 'unknown error');
        return { success: false, error: `HTTP ${response.status}: ${text}` };
      }

      return { success: true, bytesSent: data.length };
    } catch (err) {
      return {
        success: false,
        error: `HTTP transport failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.endpoint.replace(/\/print$/, '/health'), {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // HTTP is stateless, nothing to clean up
  }
}

// ============================================================================
// USB Transport (WebUSB — browser only)
// ============================================================================

/**
 * Sends ESC/POS data via WebUSB API (browser only).
 * Requires user gesture to request device access.
 *
 * Common USB vendor IDs for thermal printers:
 * - Epson: 0x04B8
 * - Star Micronics: 0x0519
 * - Bixolon: 0x1504
 * - Citizen: 0x1D90
 */
export class UsbPrinterTransport implements PrinterTransport {
  readonly type = 'USB' as const;
  private vendorId: number;
  private productId: number;

  constructor(address: string) {
    const [vendor, product] = address.split(':').map(s => parseInt(s, 16));
    this.vendorId = vendor || 0x04B8; // Epson default
    this.productId = product || 0;
  }

  async send(data: Uint8Array): Promise<PrintResult> {
    try {
      if (typeof navigator === 'undefined' || !('usb' in navigator)) {
        return { success: false, error: 'WebUSB not available (server-side or unsupported browser)' };
      }

      const device = await (navigator as any).usb.requestDevice({
        filters: [{ vendorId: this.vendorId, ...(this.productId ? { productId: this.productId } : {}) }],
      });

      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      // Find the bulk OUT endpoint
      const iface = device.configuration!.interfaces[0];
      const endpoint = iface.alternates[0].endpoints.find(
        (ep: any) => ep.direction === 'out' && ep.type === 'bulk'
      );

      if (!endpoint) {
        await device.close();
        return { success: false, error: 'No bulk OUT endpoint found' };
      }

      await device.transferOut(endpoint.endpointNumber, data);
      await device.close();

      return { success: true, bytesSent: data.length };
    } catch (err) {
      return {
        success: false,
        error: `USB transport failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      return false;
    }
    try {
      const devices = await (navigator as any).usb.getDevices();
      return devices.some(
        (d: any) => d.vendorId === this.vendorId && (!this.productId || d.productId === this.productId)
      );
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // WebUSB devices are released on close()
  }
}

// ============================================================================
// Transport Factory
// ============================================================================

export function createTransport(config: PrinterConfig): PrinterTransport {
  switch (config.transport) {
    case 'TCP':
      return new TcpPrinterTransport(config.address);
    case 'HTTP':
      return new HttpPrinterTransport(config.address);
    case 'USB':
      return new UsbPrinterTransport(config.address);
    default:
      throw new Error(`Unsupported transport: ${config.transport}`);
  }
}

// ============================================================================
// Printer Manager (singleton)
// ============================================================================

/**
 * Manages multiple printers and routes print jobs by station.
 */
export class PrinterManager {
  private printers = new Map<string, { config: PrinterConfig; transport: PrinterTransport }>();

  /** Register a printer */
  register(config: PrinterConfig): void {
    if (!config.enabled) return;
    const transport = createTransport(config);
    this.printers.set(config.id, { config, transport });
    pinoLogger.info({ printerId: config.id, name: config.name, transport: config.transport }, 'Printer registered');
  }

  /** Unregister a printer */
  async unregister(printerId: string): Promise<void> {
    const printer = this.printers.get(printerId);
    if (printer) {
      await printer.transport.disconnect();
      this.printers.delete(printerId);
    }
  }

  /** Send data to a specific printer */
  async print(printerId: string, data: Uint8Array): Promise<PrintResult> {
    const printer = this.printers.get(printerId);
    if (!printer) {
      return { success: false, error: `Printer ${printerId} not found` };
    }
    return printer.transport.send(data);
  }

  /** Send data to the printer assigned to a station */
  async printToStation(station: string, data: Uint8Array): Promise<PrintResult> {
    for (const [, printer] of this.printers) {
      if (printer.config.stations.includes(station)) {
        return printer.transport.send(data);
      }
    }
    return { success: false, error: `No printer assigned to station: ${station}` };
  }

  /** Send data to the default receipt printer */
  async printReceipt(data: Uint8Array): Promise<PrintResult> {
    for (const [, printer] of this.printers) {
      if (printer.config.isDefault) {
        return printer.transport.send(data);
      }
    }
    // Fallback: try first printer
    const first = this.printers.values().next().value;
    if (first) return first.transport.send(data);
    return { success: false, error: 'No printers configured' };
  }

  /** Health check all printers */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [id, printer] of this.printers) {
      results[id] = await printer.transport.healthCheck();
    }
    return results;
  }

  /** Get all registered printers */
  getAll(): PrinterConfig[] {
    return Array.from(this.printers.values()).map(p => p.config);
  }
}

/** Singleton printer manager */
export const printerManager = new PrinterManager();
