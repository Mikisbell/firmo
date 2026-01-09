export async function getCryptoKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    // Hash password to get a stable 256-bit (32-byte) key for AES-GCM
    const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(password));

    return crypto.subtle.importKey(
        "raw",
        keyMaterial,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function encryptData(data: object, password: string): Promise<Blob> {
    const key = await getCryptoKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

    const encoder = new TextEncoder();
    const encodedData = encoder.encode(JSON.stringify(data));

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encodedData
    );

    // Combine IV + Encrypted Data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return new Blob([combined], { type: "application/octet-stream" });
}

import { logger } from '@/src/core/observability/logger';

export async function decryptData(blob: Blob, password: string): Promise<unknown> {
    logger.debug('DECRYPT_START', 'Starting decryption', { blobSize: blob.size });

    const buffer = await blob.arrayBuffer();
    const u8 = new Uint8Array(buffer);

    if (u8.length < 13) {
        throw new Error(`Archivo muy pequeño (${u8.length} bytes). Probablemente corrupto.`);
    }

    // Extract IV (first 12 bytes)
    const iv = u8.slice(0, 12);
    // Extract Ciphertext (rest)
    const ciphertext = u8.slice(12);

    logger.debug('DECRYPT_PROGRESS', 'Extracted IV and ciphertext', { ivLength: iv.length, ciphertextLength: ciphertext.length });

    try {
        const key = await getCryptoKey(password);

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );

        const decoder = new TextDecoder();
        const str = decoder.decode(decrypted);
        return JSON.parse(str);
    } catch (e) {
        logger.error('DECRYPT_FAILED', 'Crypto operation failed', e instanceof Error ? e : undefined, {});
        throw new Error("Contraseña incorrecta o archivo corrupto.");
    }
}
