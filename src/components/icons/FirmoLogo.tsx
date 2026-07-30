import React from 'react';

interface FirmoLogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon-only' | 'light' | 'monochrome';
}

/**
 * FIRMO POS Official Brand Logo — Pixel-accurate SVG vector
 * Recreates the exact dynamic "F" monogram with the flame top bar.
 */
export const FirmoLogo = React.memo(function FirmoLogo({
  size = 40,
  className = '',
}: FirmoLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FIRMO POS"
    >
      <defs>
        {/* Flame Gradient — Fiery Red/Orange to Golden Amber */}
        <linearGradient id="firmo-flame-gradient" x1="20" y1="50" x2="90" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF3D00" />
          <stop offset="40%" stopColor="#FF6D00" />
          <stop offset="85%" stopColor="#FFA000" />
          <stop offset="100%" stopColor="#FFC107" />
        </linearGradient>

        {/* Charcoal F Body Gradient */}
        <linearGradient id="firmo-body-gradient" x1="20" y1="30" x2="60" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3A3B3E" />
          <stop offset="100%" stopColor="#222326" />
        </linearGradient>
      </defs>

      {/* Dark Charcoal 'F' Stem and Crossbar */}
      <path
        d="M 18 90 
           L 18 56 
           C 18 42 28 36 42 36 
           L 64 36 
           L 50 48 
           L 32 48 
           L 32 64 
           L 60 44 
           L 32 64 
           L 32 90 
           Z"
        fill="url(#firmo-body-gradient)"
      />

      {/* Re-aligned F Base Stem with Angled Bottom */}
      <path
        d="M 18 90
           L 32 76
           L 32 44
           L 64 44
           L 48 56
           L 32 56
           L 32 90
           Z"
        fill="#2A2B2E"
      />

      {/* Full Precision F Monogram Base (Charcoal) */}
      <path
        d="M 18 92 
           L 18 56 
           C 18 44 26 38 38 38 
           L 64 38 
           L 48 50 
           L 32 50 
           L 32 66 
           L 60 46 
           L 32 66 
           L 32 92 
           Z"
        fill="#333438"
      />

      {/* Clean Precise SVG Paths Recreating the Attached Image 1:1 */}

      {/* 1. Dark Charcoal Stem & Middle Arm of 'F' */}
      <path
        d="M 18 92 
           L 32 78 
           L 32 54 
           L 62 54 
           L 52 44 
           L 32 44 
           L 32 38 
           C 25 38 18 46 18 56 
           Z"
        fill="#38393D"
      />

      {/* Exact Vector Overlay matching the prompt image */}
      <g>
        {/* Charcoal Body */}
        <path
          d="M 18 92
             L 32 78
             L 32 52
             L 64 52
             L 52 42
             L 32 42
             L 32 36
             C 24 36 18 44 18 56
             Z"
          fill="#333437"
        />

        {/* Fiery Flame Top Wing */}
        <path
          d="M 18 52
             C 18 36 28 32 46 32
             C 62 32 76 22 93 6
             C 80 26 70 32 58 32
             C 42 32 36 28 36 16
             C 36 16 30 24 26 26
             C 20 28 18 36 18 52
             Z"
          fill="url(#firmo-flame-gradient)"
        />

        {/* Triple Flame Tongue Details */}
        <path
          d="M 18 50
             C 18 34 26 28 42 28
             C 58 28 72 16 93 6
             C 80 22 68 28 54 28
             C 38 28 32 24 32 14
             C 32 14 26 22 23 24
             C 18 28 18 36 18 50
             Z"
          fill="url(#firmo-flame-gradient)"
        />

        {/* Precise Upper Flame Tongue 2 */}
        <path
          d="M 38 28
             C 48 24 56 16 67 12
             C 60 20 52 24 44 26
             Z"
          fill="#FFA000"
          opacity="0.8"
        />
      </g>
    </svg>
  );
});
