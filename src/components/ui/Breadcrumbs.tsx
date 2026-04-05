'use client';

/**
 * Breadcrumbs de navegacion.
 * Items con href se renderizan como enlaces, sin href son la pagina actual.
 * Separador: chevron derecho de lucide-react.
 */

import { ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface BreadcrumbItem {
  label: string;
  /** Si no tiene href, es la pagina actual */
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center text-sm', className)}
    >
      <ol className="flex items-center flex-wrap gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <a
                  href={item.href}
                  className="text-park-gray-400 hover:text-park-gray-200 transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  className="text-park-gray-200 font-medium"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight
                  className="w-4 h-4 text-park-gray-600"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
