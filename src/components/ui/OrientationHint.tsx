'use client';

/**
 * OrientationHint Component
 * Sugiere orientación landscape para mejor experiencia
 * 
 * Task 16.2 - Mobile Responsive Spec
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';

export interface OrientationHintProps {
  /** Orientación recomendada */
  recommended?: 'landscape' | 'portrait';
  /** Mostrar solo una vez por sesión */
  showOnce?: boolean;
  /** Key para localStorage */
  storageKey?: string;
  /** Delay antes de mostrar (ms) */
  delay?: number;
}

const STORAGE_PREFIX = 'park-pos-orientation-hint-';

export function OrientationHint({
  recommended = 'landscape',
  showOnce = true,
  storageKey = 'default',
  delay = 1000,
}: OrientationHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    if (showOnce) {
      const dismissed = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
      if (dismissed === 'true') return;
    }

    // Check orientation
    const checkOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const needsHint = recommended === 'landscape' ? !isLandscape : isLandscape;
      
      // Only show on mobile/tablet (< 1024px)
      const isMobileOrTablet = window.innerWidth < 1024;
      
      setShouldShow(needsHint && isMobileOrTablet);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [recommended, showOnce, storageKey]);

  // Delay showing the hint
  useEffect(() => {
    if (shouldShow) {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [shouldShow, delay]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (showOnce) {
      localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, 'true');
    }
  };

  const message = recommended === 'landscape'
    ? 'Gira tu dispositivo para mejor visualización'
    : 'Gira tu dispositivo a vertical para mejor experiencia';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-20 left-4 right-4 z-[var(--z-toast)] md:left-auto md:right-4 md:max-w-sm"
        >
          <div className="bg-zinc-800 rounded-xl shadow-lg border border-zinc-700 p-4 flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-emerald-400" />
            </div>
            
            <p className="flex-1 text-sm text-zinc-200">
              {message}
            </p>
            
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-2 rounded-full hover:bg-zinc-700 transition-colors touch-target"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OrientationHint;
