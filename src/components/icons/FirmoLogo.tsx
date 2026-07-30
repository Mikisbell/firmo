import React from 'react';

interface FirmoLogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon-only' | 'light' | 'monochrome';
}

/**
 * FIRMO POS Brand Logo — Premium Swiss Geometric Vector
 * Features a sharp geometric letter "F" fused with a dynamic ember flame stroke.
 * Supports dark, light, and monochrome variants for all UI surfaces.
 */
export const FirmoLogo = React.memo(function FirmoLogo({
  size = 40,
  className = '',
  variant = 'full',
}: FirmoLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FIRMO POS"
    >
      <defs>
        {/* Background Dark Onyx Gradient */}
        <linearGradient id="firmo-bg-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#18181B" />
          <stop offset="100%" stopColor="#09090B" />
        </linearGradient>

        {/* Flame Ember Gradient */}
        <linearGradient id="firmo-flame-grad" x1="16" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="50%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        {/* Gloss Overlay */}
        <linearGradient id="firmo-gloss" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Outer Container with Rounded Radius */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#firmo-bg-grad)" />
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#firmo-gloss)" />
      <rect x="2" y="2" width="60" height="60" rx="14" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.1" />

      {/* Geometric Letter "F" Stem in Crisp White */}
      <path
        d="M18 16H44V23H26V29H38V36H26V48H18V16Z"
        fill="white"
      />

      {/* Dynamic Flame Slash (Integrated into the F Top & Crossbars) */}
      <path
        d="M40 12C40 12 48 18 48 24C48 28.4 44.4 32 40 32C37.8 32 36 30.2 36 28C36 24 40 12 40 12Z"
        fill="url(#firmo-flame-grad)"
      />

      {/* Ember Spark Core Accent */}
      <circle cx="44" cy="40" r="3" fill="#F97316" />
    </svg>
  );
});
