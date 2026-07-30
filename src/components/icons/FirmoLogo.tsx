import React from 'react';

interface FirmoLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * FIRMO POS Official Brand Logo.
 * Displays the official /images/logo/logo.png asset inside a sleek dark badge
 * to ensure 100% symmetry and contrast on both light and dark UI surfaces.
 */
export const FirmoLogo = React.memo(function FirmoLogo({
  size = 40,
  className = '',
  alt = 'FIRMO POS',
}: FirmoLogoProps) {
  return (
    <div
      className={`inline-flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl p-1.5 shadow-sm shrink-0 overflow-hidden ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <img
        src="/images/logo/logo.png"
        alt={alt}
        className="w-full h-full object-contain block"
      />
    </div>
  );
});
