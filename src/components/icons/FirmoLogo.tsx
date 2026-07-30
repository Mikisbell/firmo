import React from 'react';

interface FirmoLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * FIRMO POS Official Brand Logo.
 * Displays the official /images/logo/logo.png asset cleanly with zero background wrapper,
 * scaled to fit the text height symmetrically.
 */
export const FirmoLogo = React.memo(function FirmoLogo({
  size = 52,
  className = '',
  alt = 'FIRMO POS',
}: FirmoLogoProps) {
  return (
    <img
      src="/images/logo/logo.png"
      alt={alt}
      width={size}
      height={size}
      className={`object-contain block shrink-0 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
});
