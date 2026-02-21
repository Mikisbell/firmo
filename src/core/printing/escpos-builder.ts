/**
 * ESC/POS Command Builder
 *
 * Pure TypeScript implementation for generating ESC/POS thermal printer commands.
 * No external dependencies. Produces Uint8Array byte sequences.
 *
 * @module core/printing/escpos-builder
 */

// ============================================================================
// ESC/POS Constants
// ============================================================================

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const NUL = 0x00;

// Alignment
const ALIGN_LEFT = 0x00;
const ALIGN_CENTER = 0x01;
const ALIGN_RIGHT = 0x02;

// QR Code function codes
const QR_MODEL = 49;       // Function 65: select model
const QR_SIZE = 50;        // Function 67: set module size
const QR_ERROR = 51;       // Function 69: set error correction
const QR_STORE = 52;       // Function 80: store data
const QR_PRINT = 53;       // Function 81: print

export type Alignment = 'left' | 'center' | 'right';

// ============================================================================
// Text Encoder (UTF-8 fallback for CP858/Latin)
// ============================================================================

function encodeText(str: string): Uint8Array {
  // Use TextEncoder for UTF-8, which most modern thermal printers support
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// ============================================================================
// ESCPOSBuilder
// ============================================================================

export class ESCPOSBuilder {
  private chunks: Uint8Array[] = [];

  /**
   * Initialize printer (reset to default settings)
   * ESC @
   */
  initialize(): this {
    this.chunks.push(new Uint8Array([ESC, 0x40]));
    return this;
  }

  /**
   * Print text
   */
  text(str: string): this {
    this.chunks.push(encodeText(str));
    return this;
  }

  /**
   * Line feed
   */
  lineFeed(lines = 1): this {
    for (let i = 0; i < lines; i++) {
      this.chunks.push(new Uint8Array([LF]));
    }
    return this;
  }

  /**
   * Bold on/off
   * ESC E n
   */
  bold(on: boolean): this {
    this.chunks.push(new Uint8Array([ESC, 0x45, on ? 0x01 : 0x00]));
    return this;
  }

  /**
   * Underline on/off
   * ESC - n
   */
  underline(on: boolean): this {
    this.chunks.push(new Uint8Array([ESC, 0x2d, on ? 0x01 : 0x00]));
    return this;
  }

  /**
   * Set text alignment
   * ESC a n
   */
  align(mode: Alignment): this {
    const n =
      mode === 'center' ? ALIGN_CENTER : mode === 'right' ? ALIGN_RIGHT : ALIGN_LEFT;
    this.chunks.push(new Uint8Array([ESC, 0x61, n]));
    return this;
  }

  /**
   * Set font size (width and height multiplier)
   * GS ! n — where n = ((width-1) << 4) | (height-1)
   */
  fontSize(width: 1 | 2 | 3 = 1, height: 1 | 2 | 3 = 1): this {
    const n = ((width - 1) << 4) | (height - 1);
    this.chunks.push(new Uint8Array([GS, 0x21, n]));
    return this;
  }

  /**
   * Print a separator line
   */
  separator(char = '-', width = 48): this {
    const line = char.repeat(width);
    this.text(line);
    this.lineFeed();
    return this;
  }

  /**
   * Print text left-right aligned on same line
   */
  textColumns(left: string, right: string, width = 48): this {
    const spaces = Math.max(1, width - left.length - right.length);
    this.text(left + ' '.repeat(spaces) + right);
    this.lineFeed();
    return this;
  }

  /**
   * Generate QR Code
   * Uses GS ( k commands (QR Code model 2)
   */
  qrCode(data: string, moduleSize = 4): this {
    const encoded = encodeText(data);
    const storeLen = encoded.length + 3;
    const pL = storeLen & 0xff;
    const pH = (storeLen >> 8) & 0xff;

    // Select model 2
    this.chunks.push(
      new Uint8Array([GS, 0x28, 0x6b, 0x04, 0x00, QR_MODEL, 0x41, 0x02, 0x00]),
    );

    // Set module size
    this.chunks.push(
      new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, QR_SIZE, 0x43, moduleSize]),
    );

    // Set error correction level (M = 49)
    this.chunks.push(
      new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, QR_ERROR, 0x45, 0x31]),
    );

    // Store data
    const storeHeader = new Uint8Array([GS, 0x28, 0x6b, pL, pH, QR_STORE, 0x50, 0x30]);
    this.chunks.push(storeHeader);
    this.chunks.push(encoded);

    // Print QR code
    this.chunks.push(
      new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, QR_PRINT, 0x51, 0x30]),
    );

    return this;
  }

  /**
   * Cut paper
   * GS V n — 0=full cut, 1=partial cut
   */
  cut(partial = true): this {
    this.lineFeed(3);
    this.chunks.push(new Uint8Array([GS, 0x56, partial ? 0x01 : 0x00]));
    return this;
  }

  /**
   * Open cash drawer
   * ESC p m t1 t2 — m=pin (0=pin2, 1=pin5), t1/t2 = pulse duration
   */
  openDrawer(pin: 0 | 1 = 0): this {
    // 100ms on, 100ms off
    this.chunks.push(new Uint8Array([ESC, 0x70, pin, 0x19, 0x19]));
    return this;
  }

  /**
   * Print raster bit image
   * GS v 0 m xL xH yL yH data
   */
  image(widthBytes: number, data: Uint8Array): this {
    const heightLines = Math.ceil(data.length / widthBytes);
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = heightLines & 0xff;
    const yH = (heightLines >> 8) & 0xff;

    this.chunks.push(new Uint8Array([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]));
    this.chunks.push(data);
    return this;
  }

  /**
   * Build final byte array
   */
  build(): Uint8Array {
    if (this.chunks.length === 0) return new Uint8Array(0);

    const totalLen = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;

    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Get current buffer size
   */
  get size(): number {
    return this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  }
}
