import React from 'react';

interface FirmoLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * FIRMO POS Official Brand Logo.
 * Loads the official asset from /images/logo/logo.png.
 */
export const FirmoLogo = React.memo(function FirmoLogo({
  size = 40,
  className = '',
  alt = 'FIRMO POS',
}: FirmoLogoProps) {
  return (
    <img
      src="/images/logo/logo.png"
      alt={alt}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
});
