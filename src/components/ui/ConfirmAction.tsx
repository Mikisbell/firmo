'use client';

/**
 * ConfirmAction Component
 * Modal de confirmación para acciones destructivas
 * 
 * Task 15.5 - Mobile Responsive Spec
 */

import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmActionProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  
  // Content
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  
  // Styling
  variant?: 'danger' | 'warning' | 'info';
  
  // Auto-close (for undo pattern)
  autoCloseMs?: number;
  showProgress?: boolean;
}

const VARIANTS = {
  danger: {
    icon: 'text-red-500',
    button: 'bg-red-600 hover:bg-red-700 active:bg-red-800',
    progress: 'bg-red-500',
  },
  warning: {
    icon: 'text-amber-500',
    button: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800',
    progress: 'bg-amber-500',
  },
  info: {
    icon: 'text-blue-500',
    button: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
    progress: 'bg-blue-500',
  },
};

export function ConfirmAction({
  isOpen,
  onConfirm,
  onCancel,
  title = '¿Confirmar acción?',
  message = 'Esta acción no se puede deshacer.',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  autoCloseMs,
  showProgress = true,
}: ConfirmActionProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const styles = VARIANTS[variant];

  // Auto-close timer
  useEffect(() => {
    if (isOpen && autoCloseMs) {
      timerRef.current = setTimeout(() => {
        onConfirm();
      }, autoCloseMs);
      
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }
  }, [isOpen, autoCloseMs, onConfirm]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }, [onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
          onClick={handleBackdropClick}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-sm bg-zinc-900 rounded-2xl shadow-xl overflow-hidden"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
          >
            {/* Auto-close progress bar */}
            {autoCloseMs && showProgress && (
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: autoCloseMs / 1000, ease: 'linear' }}
                className={`absolute top-0 left-0 right-0 h-1 origin-left ${styles.progress}`}
              />
            )}
            
            {/* Close button */}
            <button
              onClick={onCancel}
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-zinc-800 transition-colors touch-target"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
            
            {/* Content */}
            <div className="p-6 pt-8 text-center">
              <div className={`mx-auto w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4 ${styles.icon}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              
              <h2 id="confirm-title" className="text-lg font-semibold text-white mb-2">
                {title}
              </h2>
              
              <p id="confirm-message" className="text-sm text-zinc-400 mb-6">
                {message}
              </p>
              
              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 text-white font-medium
                           hover:bg-zinc-700 active:bg-zinc-600 transition-colors
                           touch-target touch-feedback"
                >
                  {cancelLabel}
                </button>
                
                <button
                  onClick={onConfirm}
                  className={`flex-1 py-3 px-4 rounded-xl text-white font-medium
                            transition-colors touch-target touch-feedback ${styles.button}`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ConfirmAction;
