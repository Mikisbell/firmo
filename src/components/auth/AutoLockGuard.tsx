'use client';

/**
 * AutoLockGuard Component
 * 
 * Monitors user interaction (touch, pointer, keyboard) and triggers a lock callback
 * when the terminal is left inactive. Protects shared POS screens.
 */

import { useEffect, useRef, useCallback } from 'react';

interface AutoLockGuardProps {
  enabled?: boolean;
  timeoutMs?: number; // Inactivity timeout in milliseconds (default: 30000ms / 30s)
  onLock: () => void;
  children: React.ReactNode;
}

export function AutoLockGuard({
  enabled = true,
  timeoutMs = 30000,
  onLock,
  children,
}: AutoLockGuardProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (enabled) {
      timerRef.current = setTimeout(() => {
        onLock();
      }, timeoutMs);
    }
  }, [enabled, timeoutMs, onLock]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll'];
    
    // Attach event listeners
    events.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    // Start initial timer
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [enabled, resetTimer]);

  return <>{children}</>;
}
