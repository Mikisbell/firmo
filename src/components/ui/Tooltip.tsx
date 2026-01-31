'use client';

/**
 * Tooltip Component
 * Tooltip simple con Tailwind CSS
 * Solo visible en desktop (≥1024px)
 * 
 * Requirements: P0 - Sidebar Improvements
 */

import { ReactNode, useState } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
}

export function Tooltip({ content, children, side = 'right', disabled = false }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (disabled) {
    return <>{children}</>;
  }

  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-zinc-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-zinc-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-zinc-800',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`
            hidden lg:block
            absolute z-50 px-2 py-1 text-xs font-medium text-white
            bg-zinc-800 border border-zinc-700 rounded shadow-lg
            whitespace-nowrap pointer-events-none
            ${sideClasses[side]}
          `}
          role="tooltip"
        >
          {content}
          {/* Arrow */}
          <div
            className={`
              absolute w-0 h-0
              border-4 border-transparent
              ${arrowClasses[side]}
            `}
          />
        </div>
      )}
    </div>
  );
}
