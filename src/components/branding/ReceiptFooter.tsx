'use client';

/**
 * Receipt Footer Component
 * Displays tenant-specific footer text on receipts
 * 
 * Requirements: 6.4
 */

import React from 'react';

interface ReceiptFooterProps {
  footerText?: string;
  className?: string;
}

export const ReceiptFooter = React.memo(function ReceiptFooter({ footerText, className = '' }: ReceiptFooterProps) {
  if (!footerText) {
    return null;
  }

  return (
    <div className={`text-center text-xs text-zinc-600 mt-4 pt-4 border-t border-zinc-700 ${className}`}>
      <p className="whitespace-pre-wrap">{footerText}</p>
    </div>
  );
});
