'use client';

/**
 * Modal de atajos de teclado para el panel de administracion.
 * Se abre con la tecla "?" y muestra todos los atajos disponibles agrupados por categoria.
 * Incluye navegacion rapida con secuencia "G" + tecla dentro de 500ms.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'K'], description: 'Buscar en todo el sistema', category: 'Navegacion' },
  { keys: ['Esc'], description: 'Cerrar modal o panel', category: 'Navegacion' },
  { keys: ['?'], description: 'Mostrar atajos de teclado', category: 'Ayuda' },
  { keys: ['G', 'D'], description: 'Ir a Dashboard', category: 'Navegacion rapida' },
  { keys: ['G', 'P'], description: 'Ir a Productos', category: 'Navegacion rapida' },
  { keys: ['G', 'E'], description: 'Ir a Empleados', category: 'Navegacion rapida' },
  { keys: ['G', 'V'], description: 'Ir a Ventas/Mesas', category: 'Navegacion rapida' },
  { keys: ['G', 'R'], description: 'Ir a Reportes', category: 'Navegacion rapida' },
];

const NAV_MAP: Record<string, string> = {
  d: '/admin/dashboard',
  p: '/admin/productos',
  e: '/admin/empleados',
  v: '/admin/ventas',
  r: '/admin/reportes',
};

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (el as HTMLElement).isContentEditable
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 bg-park-gray-800 border border-park-gray-700 rounded text-xs font-mono text-park-gray-300">
      {children}
    </kbd>
  );
}

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;

      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
        return;
      }

      // Open with ?
      if (e.key === '?' && !isOpen) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      // Don't process navigation shortcuts while modal is open
      if (isOpen) return;

      // G + key navigation sequence
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!gPressedRef.current) {
          gPressedRef.current = true;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          gTimerRef.current = setTimeout(() => {
            gPressedRef.current = false;
          }, 500);
          return;
        }
      }

      if (gPressedRef.current) {
        const target = NAV_MAP[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          router.push(target);
        }
        gPressedRef.current = false;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [isOpen, close, router]);

  if (!isOpen) return null;

  // Group shortcuts by category
  const grouped = SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-modal-backdrop)]"
        onClick={close}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg bg-park-gray-900 border border-park-gray-700 rounded-xl shadow-2xl animate-in"
          role="dialog"
          aria-label="Atajos de teclado"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-park-gray-800">
            <h2 className="text-lg font-semibold text-white">Atajos de teclado</h2>
            <button
              onClick={close}
              className="p-1.5 rounded-lg text-park-gray-400 hover:text-white hover:bg-park-gray-800 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-6">
            {Object.entries(grouped).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-park-gray-500 mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm text-park-gray-300">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && (
                              <span className="text-park-gray-600 text-xs">+</span>
                            )}
                            <Kbd>{key}</Kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-park-gray-800">
            <p className="text-xs text-park-gray-500 text-center">
              Presiona <Kbd>Esc</Kbd> para cerrar
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
