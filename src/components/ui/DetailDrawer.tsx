'use client';

/**
 * Panel lateral deslizable (drawer) al estilo Stripe ContextView.
 * Se usa para ver/editar detalles sin abandonar la lista actual.
 *
 * Caracteristicas:
 * - Slide-in desde la derecha con transicion CSS (sin deps externas)
 * - Backdrop con blur
 * - Cierra con Escape, click en backdrop o boton X
 * - Focus trap basico (foco inicial en el primer elemento focusable)
 * - Footer fijo opcional para botones de accion
 */

import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

type DrawerWidth = 'sm' | 'md' | 'lg';

export interface DetailDrawerProps {
  /** Controla si el drawer esta abierto */
  open: boolean;
  /** Callback para cerrar el drawer */
  onClose: () => void;
  /** Titulo principal */
  title: string;
  /** Descripcion opcional debajo del titulo */
  description?: string;
  /** Contenido scrollable */
  children: React.ReactNode;
  /** Ancho del panel: sm=400px, md=500px, lg=640px */
  width?: DrawerWidth;
  /** Nodo fijo al pie del drawer (botones de accion) */
  footer?: React.ReactNode;
}

const widthMap: Record<DrawerWidth, string> = {
  sm: 'w-[400px] max-w-[90vw]',
  md: 'w-[500px] max-w-[90vw]',
  lg: 'w-[640px] max-w-[90vw]',
};

export function DetailDrawer({
  open,
  onClose,
  title,
  description,
  children,
  width = 'md',
  footer,
}: DetailDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // --- Escape key ---
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // --- Focus trap (primer elemento focusable) ---
  useEffect(() => {
    if (!open || !panelRef.current) return;

    const focusable = panelRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
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

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
          open
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'fixed top-0 right-0 z-40 h-full flex flex-col',
          'bg-park-gray-900 border-l border-park-gray-800 shadow-2xl',
          'transition-transform duration-200 ease-out',
          widthMap[width],
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-park-gray-800 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-park-gray-400 mt-0.5 truncate">
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

        {/* Content (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer (fijo) */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-park-gray-800 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
