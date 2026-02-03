'use client';

/**
 * Reusable DataTable Component
 * Touch-friendly table with search, filters, and pagination
 * 
 * Requirements: 3.1
 * 
 * Phase 1 Critical Review - Issue #2: DOM Weight Optimization
 * - Conditional data-testid (test env only)
 * - Prevents 30KB DOM overhead in production
 * - Maintains test functionality
 */

import { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

// Determine if we're in test environment
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT_TEST === 'true';

export interface Column<T> {
  key: keyof T | string;
  label: string | React.ReactNode;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
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
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Filter and search data
  const filteredData = useMemo(() => {
    // Defensive: ensure data is an array
    if (!data || !Array.isArray(data)) {
      return [];
    }
    
    let result = [...data];

    // Apply search
    if (search && searchKeys.length > 0) {
      const searchLower = search.toLowerCase();
      result = result.filter((item) =>
        searchKeys.some((key) => {
          const value = item[key];
          return value && String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply filters
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

  const hasActiveFilters = search || Object.values(activeFilters).some(Boolean);

  return (
    <div className="space-y-4">
      {/* Search and filter bar */}
      <div className="flex flex-col sm:flex-row gap-3" data-testid="search-filter-bar">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
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
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-zinc-700"
          />
        </div>
        
        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            data-testid="filters-toggle-btn"
            aria-label={`${showFilters ? 'Hide' : 'Show'} filters`}
            aria-expanded={showFilters}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors min-h-[44px] ${
              hasActiveFilters
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filtros</span>
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      {showFilters && filters.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 bg-zinc-900 rounded-lg border border-zinc-800" data-testid="filters-panel">
          {filters.map((filter) => (
            <div key={filter.key} className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500" htmlFor={`filter-${filter.key}`}>{filter.label}</label>
              <select
                id={`filter-${filter.key}`}
                value={activeFilters[filter.key] || ''}
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                data-testid={`filter-select-${filter.key}`}
                aria-label={`Filter by ${filter.label}`}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm min-h-[44px]"
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
            <button
              onClick={clearFilters}
              data-testid="clear-filters-btn"
              aria-label="Clear all filters"
              className="self-end px-3 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800" data-testid="data-table-container">
        <table 
          className="w-full"
          data-testid="data-table"
          role="table"
        >
          <thead className="bg-zinc-900" data-testid="table-header">
            <tr role="row">
              {columns.map((col, colIndex) => (
                <th
                  key={String(col.key)}
                  className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
                  style={{ width: col.width }}
                  role="columnheader"
                  data-testid={isTestEnv ? `column-header-${colIndex}-${String(col.key)}` : undefined}
                  aria-label={`Column: ${col.label}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800" data-testid="table-body">
            {loading ? (
              <tr data-testid="loading-row">
                <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
                    Cargando...
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr data-testid="empty-row">
                <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, rowIndex) => (
                <tr
                  key={item.id}
                  data-testid={isTestEnv ? `table-row-${rowIndex}-${item.id}` : undefined}
                  onClick={() => onRowClick?.(item)}
                  className={`bg-zinc-950 hover:bg-zinc-900 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  role="row"
                  aria-label={`Row ${rowIndex + 1}`}
                >
                  {columns.map((col, colIndex) => (
                    <td 
                      key={String(col.key)} 
                      className="px-4 py-3 text-sm"
                      role="cell"
                      data-testid={isTestEnv ? `cell-${rowIndex}-${colIndex}-${item.id}-${String(col.key)}` : undefined}
                      aria-label={`${col.label}: ${col.render ? 'rendered' : String((item as Record<string, unknown>)[col.key as string] ?? '')}`}
                    >
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key as string] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between" data-testid="pagination-controls">
          <p className="text-sm text-zinc-500" data-testid="pagination-info">
            Mostrando {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredData.length)} de{' '}
            {filteredData.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              data-testid="pagination-prev-btn"
              aria-label="Previous page"
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-zinc-400" data-testid="pagination-current">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              data-testid="pagination-next-btn"
              aria-label="Next page"
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
