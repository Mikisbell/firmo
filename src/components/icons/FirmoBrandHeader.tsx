import React from 'react';
import { FirmoLogo } from './FirmoLogo';
import { Bell, Utensils } from 'lucide-react';

interface FirmoBrandHeaderProps {
  logoSize?: number;
  className?: string;
  theme?: 'dark' | 'light';
}

/**
 * FIRMO Official Brand Composition Header.
 * Winner Tagline (SEO #1 & Maximum B2B Conversion):
 * [Logo F] FIRMO
 *         [Bell Icon] SISTEMA POS PARA RESTAURANTES [Fork/Knife Icon]
 */
export const FirmoBrandHeader = React.memo(function FirmoBrandHeader({
  logoSize = 56,
  className = '',
  theme = 'light',
}: FirmoBrandHeaderProps) {
  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Flame F Monogram */}
      <FirmoLogo size={logoSize} />

      {/* Right Text Block */}
      <div className="flex flex-col justify-center">
        {/* Main Title: FIRMO */}
        <h1
          className={[
            'font-black text-2xl sm:text-3xl tracking-tight leading-none uppercase font-sans',
            isDark ? 'text-white' : 'text-slate-900',
          ].join(' ')}
        >
          FIRMO
        </h1>

        {/* Subtitle with Bell and Fork/Knife Icons */}
        <div className="flex items-center gap-1.5 mt-1">
          <Bell className={`w-3 h-3 ${isDark ? 'text-slate-400' : 'text-slate-600'} shrink-0`} />
          <span
            className={[
              'text-[10px] sm:text-xs font-black tracking-wider uppercase font-mono',
              isDark ? 'text-slate-300' : 'text-slate-700',
            ].join(' ')}
          >
            SISTEMA POS PARA RESTAURANTES
          </span>
          <Utensils className={`w-3 h-3 ${isDark ? 'text-slate-400' : 'text-slate-600'} shrink-0`} />
        </div>
      </div>
    </div>
  );
});
