import React from 'react';

interface FirmoLogoProps {
  size?: number;
  className?: string;
}

/**
 * FIRMO POS brand logo - Professional inline SVG.
 * Emerald gradient rounded square with stylized "P" and flame accent.
 */
export const FirmoLogo = React.memo(function FirmoLogo({ size = 40, className = '' }: FirmoLogoProps) {
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
        <linearGradient id="park-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id="park-flame" x1="38" y1="12" x2="46" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#park-bg)" />

      {/* Subtle inner shadow */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill="white" opacity="0.08" />
      <rect x="2" y="2" width="60" height="60" rx="14" fill="none" stroke="white" strokeWidth="1" opacity="0.15" />

      {/* Stylized "P" letter */}
      <path
        d="M20 48V16h12c3.5 0 6.5 1.2 8.5 3.2S43 23.5 43 27s-1 5.8-3 7.8-5 3.2-8.5 3.2H26v10h-6z
           M26 32.5h6c1.8 0 3.2-.6 4.2-1.6S38 28.8 38 27s-.6-3.2-1.8-4.2S33.8 21.5 32 21.5h-6V32.5z"
        fill="white"
      />

      {/* Flame accent (top-right) */}
      <path
        d="M44 8c0 0-3 4-3 7.5c0 2.5 1.5 4.5 3 4.5s3-2 3-4.5C47 12 44 8 44 8z"
        fill="url(#park-flame)"
        opacity="0.9"
      />
    </svg>
  );
});
