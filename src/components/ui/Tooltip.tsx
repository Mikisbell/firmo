'use client';

/**
 * Tooltip CSS-only con delay configurable.
 * Aparece al hacer hover sobre el elemento hijo.
 * No usa portal ni librerias de posicionamiento.
 */

import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  /** Deshabilita el tooltip (compat con uso previo) */
  disabled?: boolean;
}

const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
};

const arrowClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-park-gray-800 border-l-transparent border-r-transparent border-b-transparent',
  right:
    'right-full top-1/2 -translate-y-1/2 border-r-park-gray-800 border-t-transparent border-b-transparent border-l-transparent',
  bottom:
    'bottom-full left-1/2 -translate-x-1/2 border-b-park-gray-800 border-l-transparent border-r-transparent border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-park-gray-800 border-t-transparent border-b-transparent border-r-transparent',
};

export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 300,
  disabled = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (disabled) {
    return <>{children}</>;
  }

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      <div
        className={cn(
          'absolute z-50 px-2 py-1 text-xs text-park-gray-200',
          'bg-park-gray-800 border border-park-gray-700 rounded',
          'whitespace-nowrap pointer-events-none shadow-lg',
          'transition-opacity duration-150',
          sideClasses[side],
          isVisible ? 'opacity-100' : 'opacity-0 invisible',
        )}
        role="tooltip"
        aria-hidden={!isVisible}
      >
        {content}
        <span
          className={cn(
            'absolute w-0 h-0 border-4',
            arrowClasses[side],
          )}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
