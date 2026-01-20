/**
 * Pagination Component
 * UI component for displaying pagination controls
 * 
 * Features:
 * - First, Previous, Next, Last buttons
 * - Current page indicator
 * - Results count display
 * - Responsive design
 * - Touch-friendly (min 44x44px buttons)
 * 
 * Requirements: FASE1 DÍA 3 - Paginación
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  startIndex: number;
  endIndex: number;
  total: number;
  onFirstPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
  loading?: boolean;
}

/**
 * Pagination component with navigation controls
 * 
 * @example
 * <Pagination
 *   page={pagination.page}
 *   totalPages={pagination.totalPages}
 *   hasNext={pagination.hasNext}
 *   hasPrev={pagination.hasPrev}
 *   startIndex={pagination.startIndex}
 *   endIndex={pagination.endIndex}
 *   total={pagination.total}
 *   onFirstPage={pagination.firstPage}
 *   onPrevPage={pagination.prevPage}
 *   onNextPage={pagination.nextPage}
 *   onLastPage={pagination.lastPage}
 *   loading={pagination.loading}
 * />
 */
export function Pagination({
  page,
  totalPages,
  hasNext,
  hasPrev,
  startIndex,
  endIndex,
  total,
  onFirstPage,
  onPrevPage,
  onNextPage,
  onLastPage,
  loading = false,
}: PaginationProps) {
  // Don't render if no data
  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-zinc-900/50 border-t border-zinc-800">
      {/* Results info */}
      <div className="text-sm text-zinc-400">
        Mostrando <span className="font-medium text-white">{startIndex}</span> a{' '}
        <span className="font-medium text-white">{endIndex}</span> de{' '}
        <span className="font-medium text-white">{total}</span> resultados
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-2">
        {/* First page button */}
        <button
          onClick={onFirstPage}
          disabled={!hasPrev || loading}
          className="min-w-[44px] min-h-[44px] p-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400 transition-colors"
          aria-label="Primera página"
          title="Primera página"
        >
          <ChevronsLeft className="w-5 h-5" />
        </button>

        {/* Previous page button */}
        <button
          onClick={onPrevPage}
          disabled={!hasPrev || loading}
          className="min-w-[44px] min-h-[44px] p-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400 transition-colors"
          aria-label="Página anterior"
          title="Página anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Page indicator */}
        <div className="px-4 py-2 text-sm text-zinc-300">
          Página <span className="font-medium text-white">{page}</span> de{' '}
          <span className="font-medium text-white">{totalPages}</span>
        </div>

        {/* Next page button */}
        <button
          onClick={onNextPage}
          disabled={!hasNext || loading}
          className="min-w-[44px] min-h-[44px] p-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400 transition-colors"
          aria-label="Página siguiente"
          title="Página siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Last page button */}
        <button
          onClick={onLastPage}
          disabled={!hasNext || loading}
          className="min-w-[44px] min-h-[44px] p-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400 transition-colors"
          aria-label="Última página"
          title="Última página"
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Compact pagination component for mobile/small spaces
 */
export function PaginationCompact({
  page,
  totalPages,
  hasNext,
  hasPrev,
  onPrevPage,
  onNextPage,
  loading = false,
}: Pick<PaginationProps, 'page' | 'totalPages' | 'hasNext' | 'hasPrev' | 'onPrevPage' | 'onNextPage' | 'loading'>) {
  if (totalPages === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2">
      <button
        onClick={onPrevPage}
        disabled={!hasPrev || loading}
        className="min-w-[44px] min-h-[44px] p-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Anterior"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="px-3 py-1 text-sm text-zinc-300">
        {page} / {totalPages}
      </div>

      <button
        onClick={onNextPage}
        disabled={!hasNext || loading}
        className="min-w-[44px] min-h-[44px] p-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Siguiente"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

