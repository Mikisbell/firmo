'use client';

/**
 * Reusable DataTable Component — Design System Phase 2
 *
 * Tabla touch-friendly con busqueda, filtros y paginacion.
 * Refactorizada para usar primitivas del Design System (Card, Button, Badge,
 * Checkbox, EmptyState, SkeletonTable). Mantiene compatibilidad con la API previa.
 *
 * Phase 1 Critical Review - Issue #2: DOM Weight Optimization
 * - Conditional data-testid (test env only)
 */

import { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Filter, Inbox } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { Checkbox } from '@/src/components/ui/Checkbox';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { SkeletonTable } from '@/src/components/ui/Skeleton';

// Determine if we're in test environment
const isTestEnv =
  process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT_TEST === 'true';

export interface Column<T> {
  key: keyof T | string;
  label: string | React.ReactNode;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  /** Si es true, aplica tabular-nums y alinea a la derecha */
  numeric?: boolean;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

export interface BulkAction<T> {
  label: string;
  onClick: (selected: T[]) => void;
  variant?: 'primary' | 'secondary' | 'destructive';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  filters?: FilterConfig[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  pageSize?: number;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  rowTestId?: string;
  /** Habilita checkboxes de seleccion por fila */
  selectable?: boolean;
  /** Acciones masivas mostradas cuando hay filas seleccionadas */
  bulkActions?: BulkAction<T>[];
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  filters = [],
  searchPlaceholder = 'Buscar...',
  searchKeys = [],
  pageSize = 10,
  onRowClick,
  loading = false,
  emptyMessage = 'No hay datos',
  rowTestId,
  selectable = false,
  bulkActions = [],
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter and search data
  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    let result = [...data];

    if (search && searchKeys.length > 0) {
      const searchLower = search.toLowerCase();
      result = result.filter((item) =>
        searchKeys.some((key) => {
          const value = item[key];
          return value && String(value).toLowerCase().includes(searchLower);
        }),
      );
    }

    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter((item) => {
          const itemValue = (item as Record<string, unknown>)[key];
          return String(itemValue) === value;
        });
      }
    });

    return result;
  }, [data, search, searchKeys, activeFilters]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(page * pageSize, (page + 1) * pageSize);

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSearch('');
    setPage(0);
  };

  const hasActiveFilters = Boolean(
    search || Object.values(activeFilters).some(Boolean),
  );

  // --- Selection helpers ---
  const selectedItems = useMemo(
    () => data.filter((item) => selectedIds.has(item.id)),
    [data, selectedIds],
  );

  const allVisibleSelected =
    paginatedData.length > 0 &&
    paginatedData.every((item) => selectedIds.has(item.id));
  const someVisibleSelected =
    !allVisibleSelected &&
    paginatedData.some((item) => selectedIds.has(item.id));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        paginatedData.forEach((item) => next.delete(item.id));
      } else {
        paginatedData.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Count extra columns (for colspan)
  const totalCols = columns.length + (selectable ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search and filter bar */}
      <div className="flex flex-col sm:flex-row gap-3" data-testid="search-filter-bar">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-park-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            data-testid="search-input"
            aria-label="Search"
            className="w-full pl-10 pr-4 py-2.5 bg-park-gray-900 border border-park-gray-800 rounded-lg text-sm text-park-gray-200 placeholder:text-park-gray-500 focus:outline-none focus:border-park-gray-700 focus-visible:ring-2 focus-visible:ring-park-brand-500"
          />
        </div>

        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            data-testid="filters-toggle-btn"
            aria-label={`${showFilters ? 'Hide' : 'Show'} filters`}
            aria-expanded={showFilters}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors min-h-[44px]',
              hasActiveFilters
                ? 'bg-park-warning-subtle border-amber-500/40 text-amber-400'
                : 'bg-park-gray-900 border-park-gray-800 text-park-gray-200 hover:border-park-gray-700',
            )}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filtros</span>
            {hasActiveFilters && (
              <Badge variant="warning" size="sm">
                {Object.values(activeFilters).filter(Boolean).length +
                  (search ? 1 : 0)}
              </Badge>
            )}
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && filters.length > 0 && (
        <Card padding="sm" data-testid="filters-panel">
          <div className="flex flex-wrap gap-3 items-end">
            {filters.map((filter) => (
              <div key={filter.key} className="flex flex-col gap-1">
                <label
                  className="text-xs text-park-gray-500"
                  htmlFor={`filter-${filter.key}`}
                >
                  {filter.label}
                </label>
                <select
                  id={`filter-${filter.key}`}
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  data-testid={`filter-select-${filter.key}`}
                  aria-label={`Filter by ${filter.label}`}
                  className="px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm text-park-gray-200 min-h-[40px] focus:outline-none focus:border-park-gray-600"
                >
                  <option value="">Todos</option>
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                data-testid="clear-filters-btn"
                aria-label="Clear all filters"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {search && (
            <Badge variant="info" size="sm">
              Buscar: {search}
            </Badge>
          )}
          {Object.entries(activeFilters)
            .filter(([, v]) => v)
            .map(([key, value]) => {
              const config = filters.find((f) => f.key === key);
              const label =
                config?.options.find((o) => o.value === value)?.label || value;
              return (
                <Badge key={key} variant="info" size="sm">
                  {config?.label}: {label}
                </Badge>
              );
            })}
        </div>
      )}

      {/* Bulk action bar */}
      {selectable && selectedIds.size > 0 && (
        <Card padding="sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-park-gray-200">
                <span className="font-semibold tabular-nums">
                  {selectedIds.size}
                </span>{' '}
                seleccionado{selectedIds.size === 1 ? '' : 's'}
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Limpiar seleccion
              </Button>
            </div>
            {bulkActions.length > 0 && (
              <div className="flex items-center gap-2">
                {bulkActions.map((action) => (
                  <Button
                    key={action.label}
                    variant={action.variant || 'secondary'}
                    size="sm"
                    onClick={() => action.onClick(selectedItems)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <SkeletonTable rows={pageSize} columns={totalCols} />
        ) : paginatedData.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={emptyMessage}
            description={
              hasActiveFilters
                ? 'Intenta ajustar los filtros o la busqueda.'
                : undefined
            }
            action={
              hasActiveFilters
                ? { label: 'Limpiar filtros', onClick: clearFilters }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto" data-testid="data-table-container">
            <table
              className="w-full"
              data-testid="data-table"
              role="table"
            >
              <thead
                className="bg-park-gray-900/50 border-b border-park-gray-800"
                data-testid="table-header"
              >
                <tr role="row">
                  {selectable && (
                    <th
                      className="px-4 py-3 w-10"
                      role="columnheader"
                      aria-label="Select all"
                    >
                      <Checkbox
                        label=""
                        checked={allVisibleSelected || someVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        aria-label={
                          allVisibleSelected
                            ? 'Deseleccionar todo'
                            : 'Seleccionar todo'
                        }
                      />
                    </th>
                  )}
                  {columns.map((col, colIndex) => (
                    <th
                      key={String(col.key)}
                      className={cn(
                        'px-4 py-3 text-xs font-medium text-park-gray-400 uppercase tracking-wider',
                        col.numeric ? 'text-right tabular-nums' : 'text-left',
                      )}
                      style={{ width: col.width }}
                      role="columnheader"
                      data-testid={
                        isTestEnv
                          ? `column-header-${colIndex}-${String(col.key)}`
                          : undefined
                      }
                      aria-label={`Column: ${col.label}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody data-testid="table-body">
                {paginatedData.map((item, rowIndex) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      data-testid={
                        rowTestId
                          ? rowTestId
                          : isTestEnv
                            ? `table-row-${rowIndex}-${item.id}`
                            : undefined
                      }
                      onClick={(e) => {
                        // Don't trigger row click when clicking on checkbox cell
                        if (
                          selectable &&
                          (e.target as HTMLElement).closest(
                            '[data-checkbox-cell]',
                          )
                        ) {
                          return;
                        }
                        onRowClick?.(item);
                      }}
                      className={cn(
                        'border-b border-park-gray-800/50 transition-colors',
                        'hover:bg-park-gray-800/30',
                        isSelected && 'bg-park-brand-600/5',
                        onRowClick ? 'cursor-pointer' : '',
                      )}
                      role="row"
                      aria-label={`Row ${rowIndex + 1}`}
                      aria-selected={selectable ? isSelected : undefined}
                    >
                      {selectable && (
                        <td
                          className="px-4 py-3 w-10"
                          data-checkbox-cell
                          role="cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            label=""
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item.id)}
                          />
                        </td>
                      )}
                      {columns.map((col, colIndex) => (
                        <td
                          key={String(col.key)}
                          className={cn(
                            'px-4 py-3 text-sm text-park-gray-200',
                            col.numeric && 'text-right tabular-nums',
                          )}
                          role="cell"
                          data-testid={
                            isTestEnv
                              ? `cell-${rowIndex}-${colIndex}-${item.id}-${String(col.key)}`
                              : undefined
                          }
                          aria-label={`${col.label}: ${
                            col.render
                              ? 'rendered'
                              : String(
                                  (item as Record<string, unknown>)[
                                    col.key as string
                                  ] ?? '',
                                )
                          }`}
                        >
                          {col.render
                            ? col.render(item)
                            : String(
                                (item as Record<string, unknown>)[
                                  col.key as string
                                ] ?? '',
                              )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div
          className="flex items-center justify-between"
          data-testid="pagination-controls"
        >
          <p
            className="text-sm text-park-gray-400 tabular-nums"
            data-testid="pagination-info"
          >
            Mostrando {page * pageSize + 1}-
            {Math.min((page + 1) * pageSize, filteredData.length)} de{' '}
            {filteredData.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              data-testid="pagination-prev-btn"
              aria-label="Previous page"
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              <span className="sr-only">Anterior</span>
            </Button>
            <span
              className="text-sm text-park-gray-400 tabular-nums px-2"
              data-testid="pagination-current"
            >
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              data-testid="pagination-next-btn"
              aria-label="Next page"
              icon={<ChevronRight className="w-4 h-4" />}
            >
              <span className="sr-only">Siguiente</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
