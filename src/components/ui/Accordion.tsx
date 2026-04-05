'use client';

/**
 * Accordion — Secciones expandibles/colapsables.
 *
 * Modos:
 * - allowMultiple=false (default): solo un item abierto a la vez
 * - allowMultiple=true: varios items pueden estar abiertos simultaneamente
 *
 * El header es clickeable, con chevron animado que rota 180deg al abrir.
 */

import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface AccordionItem {
  /** Identificador unico del item */
  id: string;
  /** Titulo del header */
  title: string;
  /** Contenido renderizado al expandir */
  content: ReactNode;
  /** Icono opcional a la izquierda del titulo */
  icon?: ReactNode;
}

export interface AccordionProps {
  /** Items del accordion */
  items: AccordionItem[];
  /** IDs de items abiertos por defecto */
  defaultOpen?: string[];
  /** Si permite multiples items abiertos simultaneamente (default: false) */
  allowMultiple?: boolean;
}

export function Accordion({
  items,
  defaultOpen = [],
  allowMultiple = false,
}: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(defaultOpen),
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) next.clear();
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        return (
          <div
            key={item.id}
            className="bg-park-gray-900 border border-park-gray-800 rounded-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${item.id}`}
              className={cn(
                'w-full px-4 py-3 flex items-center justify-between cursor-pointer',
                'hover:bg-park-gray-800/50 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-park-brand-500',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-park-gray-200 text-left">
                {item.icon && (
                  <span className="flex items-center text-park-gray-400 [&>svg]:h-4 [&>svg]:w-4">
                    {item.icon}
                  </span>
                )}
                {item.title}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-park-gray-400 transition-transform duration-200 shrink-0',
                  isOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>
            {isOpen && (
              <div
                id={`accordion-panel-${item.id}`}
                role="region"
                className="px-4 pb-4 text-sm text-park-gray-300"
              >
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
