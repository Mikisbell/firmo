'use client';

/**
 * Controles de paginacion del Design System.
 * Muestra prev/next, numeros de pagina con elipsis y contador opcional.
 * Logica siblingCount: muestra primera, ultima, actual y N paginas alrededor.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/src/lib/utils';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
  /** Muestra "Mostrando X-Y de Z" */
  showInfo?: boolean;
  /** Cantidad de numeros a mostrar a cada lado de la pagina actual */
  siblingCount?: number;
  className?: string;
}

const DOTS = '...' as const;

/**
 * Genera el rango de paginas a mostrar con elipsis donde hay gaps.
 * Ej: [1, '...', 4, 5, 6, '...', 20]
 */
function getPageRange(
  current: number,
  total: number,
  siblingCount: number,
): Array<number | typeof DOTS> {
  // Total slots = siblings + firstPage + lastPage + current + 2 dots = siblings*2 + 5
  const totalSlots = siblingCount * 2 + 5;

  if (totalSlots >= total) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);

  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < total - 1;

  const firstPage = 1;
  const lastPage = total;

  if (!showLeftDots && showRightDots) {
    const leftCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftCount }, (_, i) => i + 1);
    return [...leftRange, DOTS, lastPage];
  }

  if (showLeftDots && !showRightDots) {
    const rightCount = 3 + siblingCount * 2;
    const rightRange = Array.from(
      { length: rightCount },
      (_, i) => total - rightCount + 1 + i,
    );
    return [firstPage, DOTS, ...rightRange];
  }

  // both dots
  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i,
  );
  return [firstPage, DOTS, ...middleRange, DOTS, lastPage];
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
  showInfo = false,
  siblingCount = 1,
  className,
}: PaginationProps) {
  if (totalPages <= 0) return null;

  const safePage = Math.max(1, Math.min(page, totalPages));
  const pages = getPageRange(safePage, totalPages, siblingCount);

  const startIndex =
    pageSize && totalItems ? (safePage - 1) * pageSize + 1 : 0;
  const endIndex =
    pageSize && totalItems
      ? Math.min(safePage * pageSize, totalItems)
      : 0;

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4',
        className,
      )}
    >
      {showInfo && pageSize && totalItems ? (
        <div className="text-sm text-park-gray-400 tabular-nums">
          Mostrando {startIndex}-{endIndex} de {totalItems}
        </div>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(safePage - 1)}
          disabled={!canPrev}
          aria-label="Pagina anterior"
          icon={<ChevronLeft className="h-4 w-4" />}
        >
          Anterior
        </Button>

        <div className="flex items-center gap-1 mx-1">
          {pages.map((p, idx) =>
            p === DOTS ? (
              <span
                key={`dots-${idx}`}
                className="px-2 text-sm text-park-gray-500 tabular-nums"
                aria-hidden="true"
              >
                ...
              </span>
            ) : (
              <Button
                key={p}
                variant={p === safePage ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => onPageChange(p)}
                aria-label={`Pagina ${p}`}
                aria-current={p === safePage ? 'page' : undefined}
                className="min-w-[2rem] tabular-nums"
              >
                {p}
              </Button>
            ),
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(safePage + 1)}
          disabled={!canNext}
          aria-label="Pagina siguiente"
          iconRight={<ChevronRight className="h-4 w-4" />}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
