'use client';

/**
 * Modal de dialogo centrado (distinto de DetailDrawer que se desliza desde la derecha).
 *
 * Caracteristicas:
 * - Backdrop con blur y overlay oscuro
 * - Centrado vertical y horizontal
 * - 4 tamanios: sm, md, lg, xl
 * - Header con titulo, descripcion y boton X
 * - Body con padding y scroll si el contenido excede
 * - Footer opcional con borde superior
 * - z-index 50 (por encima del DetailDrawer)
 * - Focus trap basico, body scroll lock
 * - Transicion CSS suave (200ms)
 * - Cierra con Escape y click en backdrop (ambos opcionales)
 */

import { useEffect, useRef, useCallback, useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  /** Controla si el modal esta abierto */
  open: boolean;
  /** Callback para cerrar el modal */
  onClose: () => void;
  /** Titulo principal */
  title: string;
  /** Descripcion opcional debajo del titulo */
  description?: string;
  /** Tamanio del modal: sm=max-w-md, md=max-w-lg, lg=max-w-2xl, xl=max-w-4xl */
  size?: ModalSize;
  /** Contenido del body */
  children: React.ReactNode;
  /** Nodo fijo al pie del modal (botones de accion) */
  footer?: React.ReactNode;
  /** Cierra al hacer click en el backdrop (default true) */
  closeOnBackdrop?: boolean;
  /** Cierra al presionar Escape (default true) */
  closeOnEscape?: boolean;
}

const sizeMap: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;

  // --- Escape key ---
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) onClose();
    },
    [onClose, closeOnEscape],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // --- Focus management: guarda trigger, focus al panel, restaura al cerrar ---
  useEffect(() => {
    if (!open || !panelRef.current) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  // --- Lock body scroll ---
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleBackdropClick = () => {
    if (closeOnBackdrop) onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
          open
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal container (centered) */}
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none',
          'transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          className={cn(
            'pointer-events-auto w-full flex flex-col max-h-[90vh]',
            'bg-park-gray-900 border border-park-gray-800 rounded-xl shadow-2xl',
            'transition-transform duration-200 ease-out',
            sizeMap[size],
            open ? 'scale-100' : 'scale-95',
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-park-gray-800 flex-shrink-0">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-white truncate">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-sm text-park-gray-400 mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 rounded-lg p-1.5 text-park-gray-400 hover:text-white hover:bg-park-gray-800 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body (scrollable) */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {/* Footer (opcional) */}
          {footer && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-park-gray-800 flex-shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
