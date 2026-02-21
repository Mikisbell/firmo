'use client';

/**
 * usePaymentQR - Hook for generating Yape/Plin QR codes from POS
 *
 * @module hooks/usePaymentQR
 */

import { useState, useCallback } from 'react';

interface PaymentQRData {
  qrDataUrl: string;
  paymentUrl: string;
  merchantPhone: string;
  merchantName: string | null;
}

interface UsePaymentQRReturn {
  qrData: PaymentQRData | null;
  isLoading: boolean;
  error: string | null;
  generateQR: (method: 'YAPE' | 'PLIN', amountCents: number, orderNumber: number | string) => Promise<void>;
  clearQR: () => void;
}

export function usePaymentQR(): UsePaymentQRReturn {
  const [qrData, setQrData] = useState<PaymentQRData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQR = useCallback(async (
    method: 'YAPE' | 'PLIN',
    amountCents: number,
    orderNumber: number | string,
  ) => {
    setIsLoading(true);
    setError(null);
    setQrData(null);

    try {
      const res = await fetch('/api/pos/payment-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, amountCents, orderNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al generar QR');
        return;
      }

      setQrData(data);
    } catch {
      setError('Error de conexión al generar QR');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearQR = useCallback(() => {
    setQrData(null);
    setError(null);
  }, []);

  return { qrData, isLoading, error, generateQR, clearQR };
}
