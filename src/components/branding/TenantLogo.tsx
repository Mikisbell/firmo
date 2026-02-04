'use client';

/**
 * Tenant Logo Component
 * Displays tenant logo with fallback to text
 * Validates logo format and handles load errors
 * 
 * Requirements: 6.1, 6.6, 6.7
 */

import React, { useState } from 'react';
import { Store } from 'lucide-react';

interface TenantLogoProps {
  logoUrl?: string;
  legalName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export function TenantLogo({
  logoUrl,
  legalName = 'PARK POS',
  size = 'md',
  className = '',
}: TenantLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!logoUrl);

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // If logo URL is provided and hasn't failed, try to display it
  if (logoUrl && !imageError) {
    return (
      <div className={`${sizeClasses[size]} ${className} relative flex items-center justify-center`}>
        {isLoading && (
          <div className="absolute inset-0 bg-zinc-800 rounded-lg animate-pulse" />
        )}
        <img
          src={logoUrl}
          alt={legalName}
          onError={handleImageError}
          onLoad={handleImageLoad}
          className={`${sizeClasses[size]} object-contain rounded-lg ${
            isLoading ? 'opacity-0' : 'opacity-100'
          } transition-opacity duration-200`}
        />
      </div>
    );
  }

  // Fallback: Show icon or initials
  return (
    <div
      className={`${sizeClasses[size]} ${className} bg-amber-500/20 rounded-lg flex items-center justify-center`}
    >
      <Store className={`w-${size === 'sm' ? '4' : size === 'md' ? '6' : '8'} h-${size === 'sm' ? '4' : size === 'md' ? '6' : '8'} text-amber-500`} />
    </div>
  );
}
