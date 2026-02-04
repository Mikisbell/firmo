'use client';

/**
 * Receipt Template Component
 * Displays receipt with tenant branding
 * Includes legal name, RUC, address, and footer text
 * 
 * Requirements: 6.2, 6.3, 6.4
 */

import React from 'react';
import { TenantInfo, ReceiptFooter } from '@/src/components/branding';

export interface ReceiptItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

interface ReceiptTemplateProps {
  tenantLegalName: string;
  tenantRuc?: string;
  tenantAddress?: string;
  receiptFooterText?: string;
  orderNumber: string;
  items: ReceiptItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  paymentMethod?: string;
  timestamp?: Date;
  className?: string;
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ReceiptTemplate({
  tenantLegalName,
  tenantRuc,
  tenantAddress,
  receiptFooterText,
  orderNumber,
  items,
  subtotal_cents,
  tax_cents,
  total_cents,
  paymentMethod,
  timestamp,
  className = '',
}: ReceiptTemplateProps) {
  return (
    <div className={`bg-white text-black p-4 max-w-sm mx-auto font-mono text-sm ${className}`}>
      {/* Header with tenant info */}
      <TenantInfo
        legalName={tenantLegalName}
        ruc={tenantRuc}
        address={tenantAddress}
        variant="receipt"
        className="mb-4"
      />

      {/* Separator */}
      <div className="border-t border-black my-3" />

      {/* Order details */}
      <div className="mb-3">
        <div className="flex justify-between">
          <span>Orden:</span>
          <span className="font-bold">{orderNumber}</span>
        </div>
        {timestamp && (
          <div className="flex justify-between text-xs">
            <span>Fecha:</span>
            <span>{timestamp.toLocaleString('es-PE')}</span>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-black my-3" />

      {/* Items */}
      <div className="mb-3">
        {items.map((item, idx) => (
          <div key={idx} className="mb-2">
            <div className="flex justify-between">
              <span className="flex-1">{item.description}</span>
              <span className="ml-2">{formatCents(item.total_cents)}</span>
            </div>
            <div className="text-xs text-gray-600 flex justify-between">
              <span>{item.quantity} x {formatCents(item.unit_price_cents)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="border-t border-black my-3" />

      {/* Totals */}
      <div className="mb-3 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCents(subtotal_cents)}</span>
        </div>
        {tax_cents > 0 && (
          <div className="flex justify-between">
            <span>IGV:</span>
            <span>{formatCents(tax_cents)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t border-black pt-1">
          <span>Total:</span>
          <span>{formatCents(total_cents)}</span>
        </div>
      </div>

      {/* Payment method */}
      {paymentMethod && (
        <div className="mb-3 text-center text-xs">
          <p>Pago: {paymentMethod}</p>
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-black my-3" />

      {/* Footer */}
      <ReceiptFooter footerText={receiptFooterText} className="text-black border-t-0" />

      {/* Thank you message */}
      <div className="text-center text-xs mt-4">
        <p>¡Gracias por su compra!</p>
      </div>
    </div>
  );
}
