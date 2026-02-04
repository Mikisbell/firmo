'use client';

/**
 * Tenant Info Component
 * Displays tenant legal name, RUC, and address
 * Used in receipts, invoices, and headers
 * 
 * Requirements: 6.2, 6.3
 */

import React from 'react';

interface TenantInfoProps {
  legalName: string;
  ruc?: string;
  address?: string;
  variant?: 'header' | 'receipt' | 'invoice';
  className?: string;
}

export function TenantInfo({
  legalName,
  ruc,
  address,
  variant = 'header',
  className = '',
}: TenantInfoProps) {
  if (variant === 'header') {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <h1 className="text-lg font-bold text-white">{legalName}</h1>
        {ruc && <p className="text-xs text-zinc-400">RUC: {ruc}</p>}
        {address && <p className="text-xs text-zinc-400">{address}</p>}
      </div>
    );
  }

  if (variant === 'receipt' || variant === 'invoice') {
    return (
      <div className={`text-center text-sm ${className}`}>
        <p className="font-bold">{legalName}</p>
        {ruc && <p className="text-xs">RUC: {ruc}</p>}
        {address && <p className="text-xs">{address}</p>}
      </div>
    );
  }

  return null;
}
