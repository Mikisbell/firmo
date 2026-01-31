/**
 * Enhanced Device Fingerprint Generator v2
 * 
 * Generates a comprehensive device fingerprint using 12+ signals:
 * 1. Canvas 2D fingerprint
 * 2. WebGL fingerprint (renderer + vendor)
 * 3. Audio context fingerprint
 * 4. Font detection
 * 5. Screen properties
 * 6. Hardware signals (cores, memory, touch)
 * 7. Timezone and locale
 * 8. Platform and user agent
 * 9. WebGL extensions
 * 10. Color depth and pixel ratio
 * 11. Storage availability
 * 12. Media devices hash
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5 (Terminal Architecture v2)
 */

import { logger } from '@/src/core/observability/logger';

export interface FingerprintSignals {
  canvas: string;
  webgl: string;
  webglVendor: string;
  webglRenderer: string;
  audio: string;
  fonts: string;
  screen: string;
  hardware: string;
  timezone: string;
  platform: string;
  webglExtensions: string;
  colorDepth: string;
  storage: string;
  mediaDevices: string;
}

export interface FingerprintResult {
  hash: string;
  signals: FingerprintSignals;
  signalCount: number;
  timestamp: number;
}

// Test fonts to detect
const TEST_FONTS = [
  'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
  'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Lucida Console',
  'Tahoma', 'Palatino Linotype', 'Segoe UI', 'Roboto', 'Open Sans'
];

/**
 * Generate Canvas 2D fingerprint
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    // Draw text with specific styling
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.font = '11pt Arial';
    ctx.fillText('PARK-POS-v2 🍗', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.font = '18pt Arial';
    ctx.fillText('PARK-POS-v2 🍗', 4, 45);

    // Add geometric shapes
    ctx.beginPath();
    ctx.arc(50, 25, 10, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toDataURL().slice(-100);
  } catch {
    return 'canvas-error';
  }
}

/**
 * Generate WebGL fingerprint
 */
function getWebGLFingerprint(): { fingerprint: string; vendor: string; renderer: string; extensions: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) {
      return { fingerprint: 'no-webgl', vendor: '', renderer: '', extensions: '' };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
    
    // Get supported extensions
    const extensions = gl.getSupportedExtensions()?.sort().join(',') || '';
    
    // Get WebGL parameters
    const params = [
      gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      gl.getParameter(gl.MAX_VARYING_VECTORS),
      gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
    ].join(',');

    return {
      fingerprint: params,
      vendor: String(vendor),
      renderer: String(renderer),
      extensions: extensions.slice(0, 200), // Truncate for storage
    };
  } catch {
    return { fingerprint: 'webgl-error', vendor: '', renderer: '', extensions: '' };
  }
}

/**
 * Generate Audio Context fingerprint
 */
async function getAudioFingerprint(): Promise<string> {
  try {
    const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return 'no-audio';

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const analyser = context.createAnalyser();
    const gain = context.createGain();
    const compressor = context.createDynamicsCompressor();

    // Configure nodes
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, context.currentTime);
    
    compressor.threshold.setValueAtTime(-50, context.currentTime);
    compressor.knee.setValueAtTime(40, context.currentTime);
    compressor.ratio.setValueAtTime(12, context.currentTime);
    compressor.attack.setValueAtTime(0, context.currentTime);
    compressor.release.setValueAtTime(0.25, context.currentTime);

    // Connect nodes
    oscillator.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0, context.currentTime); // Mute output

    oscillator.start(0);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const dataArray = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(dataArray);
    
    oscillator.stop();
    await context.close();

    // Create fingerprint from frequency data
    const sum = dataArray.slice(0, 30).reduce((a, b) => a + b, 0);
    return sum.toFixed(6);
  } catch {
    return 'audio-error';
  }
}

/**
 * Detect available fonts
 */
function getFontsFingerprint(): string {
  try {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    
    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.fontSize = testSize;
    span.innerHTML = testString;
    document.body.appendChild(span);

    const baseWidths: Record<string, number> = {};
    for (const baseFont of baseFonts) {
      span.style.fontFamily = baseFont;
      baseWidths[baseFont] = span.offsetWidth;
    }

    const detectedFonts: string[] = [];
    for (const font of TEST_FONTS) {
      for (const baseFont of baseFonts) {
        span.style.fontFamily = `'${font}', ${baseFont}`;
        if (span.offsetWidth !== baseWidths[baseFont]) {
          detectedFonts.push(font);
          break;
        }
      }
    }

    document.body.removeChild(span);
    return detectedFonts.sort().join(',');
  } catch {
    return 'fonts-error';
  }
}

/**
 * Get screen properties
 */
function getScreenFingerprint(): string {
  return [
    screen.width,
    screen.height,
    screen.availWidth,
    screen.availHeight,
    screen.colorDepth,
    window.devicePixelRatio || 1,
    screen.orientation?.type || 'unknown',
  ].join('|');
}

/**
 * Get hardware signals
 */
function getHardwareFingerprint(): string {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return [
    navigator.hardwareConcurrency || 0,
    nav.deviceMemory || 0,
    navigator.maxTouchPoints || 0,
    'ontouchstart' in window ? 1 : 0,
  ].join('|');
}

/**
 * Get timezone and locale
 */
function getTimezoneFingerprint(): string {
  return [
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    new Date().getTimezoneOffset(),
    navigator.language,
    navigator.languages?.join(',') || navigator.language,
  ].join('|');
}

/**
 * Get platform info
 */
function getPlatformFingerprint(): string {
  return [
    navigator.platform,
    navigator.userAgent.slice(0, 100),
    navigator.vendor || '',
  ].join('|');
}

/**
 * Get color depth info
 */
function getColorDepthFingerprint(): string {
  return [
    screen.colorDepth,
    screen.pixelDepth,
    window.devicePixelRatio || 1,
  ].join('|');
}

/**
 * Get storage availability
 */
function getStorageFingerprint(): string {
  const features = [
    typeof localStorage !== 'undefined' ? 1 : 0,
    typeof sessionStorage !== 'undefined' ? 1 : 0,
    typeof indexedDB !== 'undefined' ? 1 : 0,
    navigator.cookieEnabled ? 1 : 0,
  ];
  return features.join('|');
}

/**
 * Get media devices hash (async)
 */
async function getMediaDevicesFingerprint(): Promise<string> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return 'no-media';
    const devices = await navigator.mediaDevices.enumerateDevices();
    const counts = {
      audioinput: 0,
      audiooutput: 0,
      videoinput: 0,
    };
    for (const device of devices) {
      if (device.kind in counts) {
        counts[device.kind as keyof typeof counts]++;
      }
    }
    return `${counts.audioinput}|${counts.audiooutput}|${counts.videoinput}`;
  } catch {
    return 'media-error';
  }
}


/**
 * Generate complete device fingerprint with all signals
 */
export async function generateFingerprintV2(): Promise<FingerprintResult> {
  const startTime = Date.now();
  
  // Collect all signals
  const webgl = getWebGLFingerprint();
  const [audio, mediaDevices] = await Promise.all([
    getAudioFingerprint(),
    getMediaDevicesFingerprint(),
  ]);

  const signals: FingerprintSignals = {
    canvas: getCanvasFingerprint(),
    webgl: webgl.fingerprint,
    webglVendor: webgl.vendor,
    webglRenderer: webgl.renderer,
    audio,
    fonts: getFontsFingerprint(),
    screen: getScreenFingerprint(),
    hardware: getHardwareFingerprint(),
    timezone: getTimezoneFingerprint(),
    platform: getPlatformFingerprint(),
    webglExtensions: webgl.extensions,
    colorDepth: getColorDepthFingerprint(),
    storage: getStorageFingerprint(),
    mediaDevices,
  };

  // Count valid signals (non-error)
  const signalCount = Object.values(signals).filter(
    s => s && !s.includes('error') && !s.includes('no-')
  ).length;

  // Create combined hash
  const combined = Object.values(signals).join('|||');
  const hash = await hashString(combined);

  logger.info('FINGERPRINT_V2_GENERATED', 'Device fingerprint generated', {
    signalCount,
    duration: Date.now() - startTime,
  });

  return {
    hash,
    signals,
    signalCount,
    timestamp: Date.now(),
  };
}

/**
 * Hash a string using SHA-256
 */
async function hashString(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash fingerprint with tenant-specific salt
 * Requirements: 1.2
 */
export async function hashWithSalt(fingerprint: FingerprintResult, salt: string): Promise<string> {
  const data = `${salt}:${fingerprint.hash}:${salt}`;
  return hashString(data);
}

/**
 * Calculate similarity between two fingerprints (0-100)
 * Requirements: 1.3, 1.5
 */
export function calculateSimilarity(fp1: FingerprintSignals, fp2: FingerprintSignals): number {
  const keys = Object.keys(fp1) as (keyof FingerprintSignals)[];
  let matches = 0;
  let total = 0;

  for (const key of keys) {
    const v1 = fp1[key];
    const v2 = fp2[key];
    
    // Skip error signals
    if (v1.includes('error') || v2.includes('error')) continue;
    if (v1.includes('no-') || v2.includes('no-')) continue;
    
    total++;
    
    // Exact match
    if (v1 === v2) {
      matches++;
      continue;
    }
    
    // Partial match for certain signals (allow minor drift)
    if (key === 'screen' || key === 'hardware') {
      const parts1 = v1.split('|');
      const parts2 = v2.split('|');
      const partMatches = parts1.filter((p, i) => p === parts2[i]).length;
      matches += partMatches / parts1.length;
    }
  }

  return total > 0 ? Math.round((matches / total) * 100) : 0;
}

/**
 * Check if fingerprint meets minimum signal threshold
 */
export function isValidFingerprint(fp: FingerprintResult, minSignals = 8): boolean {
  return fp.signalCount >= minSignals;
}

/**
 * Get fingerprint drift score (how much it changed)
 * Returns 0-100 where 0 = no drift, 100 = completely different
 */
export function getDriftScore(fp1: FingerprintSignals, fp2: FingerprintSignals): number {
  return 100 - calculateSimilarity(fp1, fp2);
}

/**
 * Store fingerprint in localStorage
 */
export function storeFingerprint(fp: FingerprintResult): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('park_fingerprint_v2', JSON.stringify(fp));
}

/**
 * Get stored fingerprint from localStorage
 */
export function getStoredFingerprint(): FingerprintResult | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('park_fingerprint_v2');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Clear stored fingerprint
 */
export function clearStoredFingerprint(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('park_fingerprint_v2');
}
