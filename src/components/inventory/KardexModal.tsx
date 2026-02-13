'use client';

/**
 * KardexModal Component
 * Modal para ver historial de movimientos de un insumo
 * Task 5.1 - Inventory UI Spec
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight,
  Package,
  PackageMinus,
  Trash2,
  Scale,
  Calendar,
  Filter
} from 'lucide-react';
import { KardexEntry, KardexSummary, KardexMovementType } from '@/src/app/api/inventory/kardex/[code]/route';

interface KardexModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryCode: string;
  inventoryName: string;
  tenantId: string;
}

interface KardexFilters {
  startDate: string;
  endDate: string;
  type: KardexMovementType | '';
}

// Iconos por tipo de movimiento
const TYPE_CONFIG: Record<KardexMovementType, { icon: typeof Package; label: string; color: string; bg: string }> = {
  IN: { icon: Package, label: 'Entrada', color: 'text-green-400', bg: 'bg-green-500/20' },
  OUT: { icon: PackageMinus, label: 'Salida', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  WASTE: { icon: Trash2, label: 'Merma', color: 'text-red-400', bg: 'bg-red-500/20' },
  ADJUST: { icon: Scale, label: 'Ajuste', color: 'text-amber-400', bg: 'bg-amber-500/20' },
};

// Emoji por tipo
export function getTypeEmoji(type: KardexMovementType): string {
  const emojis: Record<KardexMovementType, string> = {
    IN: '📥',
    OUT: '📤',
    WASTE: '🗑️',
    ADJUST: '⚖️',
  };
  return emojis[type];
}

// Componente de entrada individual
function KardexEntryRow({ entry }: { entry: KardexEntry }) {
  const config = TYPE_CONFIG[entry.type];
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-zinc-800/30 transition-colors border-b border-zinc-800 last:border-0"
    >
      {/* Fecha */}
      <div className="col-span-2 text-sm text-zinc-400">
        {new Date(entry.timestamp).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        })}
        <div className="text-xs text-zinc-500">
          {new Date(entry.timestamp).toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
      
      {/* Tipo */}
      <div className="col-span-2 flex items-center gap-2">
        <div className={`w-7 h-7 rounded ${config.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <span className="text-xs">{getTypeEmoji(entry.type)}</span>
      </div>
      
      {/* Cantidad */}
      <div className={`col-span-2 text-right font-mono font-medium ${
        entry.quantity > 0 ? 'text-green-400' : 'text-red-400'
      }`}>
        {entry.quantity > 0 ? '+' : ''}{entry.quantity.toFixed(2)}
      </div>
      
      {/* Saldo */}
      <div className="col-span-2 text-right font-mono text-zinc-300">
        {entry.balance.toFixed(2)}
      </div>
      
      {/* Referencia */}
      <div className="col-span-2 text-sm text-zinc-400 truncate" title={entry.reference}>
        {entry.reference}
      </div>
      
      {/* Actor */}
      <div className="col-span-2 text-sm text-zinc-400 truncate" title={entry.actorName}>
        {entry.actorName}
      </div>
    </motion.div>
  );
}

// Summary Card
function KardexSummaryCard({ summary }: { summary: KardexSummary }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
        <div className="text-xs text-green-400 mb-1">Total Entradas</div>
        <div className="text-lg font-bold text-green-400">+{summary.totalIn.toFixed(2)}</div>
      </div>
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <div className="text-xs text-blue-400 mb-1">Total Salidas</div>
        <div className="text-lg font-bold text-blue-400">-{summary.totalOut.toFixed(2)}</div>
      </div>
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
        <div className="text-xs text-red-400 mb-1">Total Mermas</div>
        <div className="text-lg font-bold text-red-400">-{summary.totalWaste.toFixed(2)}</div>
      </div>
    </div>
  );
}

export default function KardexModal({
  isOpen,
  onClose,
  inventoryCode,
  inventoryName,
  tenantId,
}: KardexModalProps) {
  const [entries, setEntries] = useState<KardexEntry[]>([]);
  const [summary, setSummary] = useState<KardexSummary>({
    totalIn: 0,
    totalOut: 0,
    totalWaste: 0,
    periodStart: '',
    periodEnd: '',
  });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<KardexFilters>({
    startDate: '',
    endDate: '',
    type: '',
  });

  // Fetch kardex data
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchKardex = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          tenant_id: tenantId,
          page: pagination.page.toString(),
          page_size: pagination.pageSize.toString(),
        });
        
        if (filters.startDate) params.append('start_date', filters.startDate);
        if (filters.endDate) params.append('end_date', filters.endDate);
        if (filters.type) params.append('type', filters.type);
        
        const response = await fetch(`/api/inventory/kardex/${inventoryCode}?${params}`);
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Error al cargar kardex');
        }
        
        const data = await response.json();
        setEntries(data.entries);
        setSummary(data.summary);
        setPagination(prev => ({ ...prev, total: data.pagination.total }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchKardex();
  }, [isOpen, inventoryCode, tenantId, pagination.page, pagination.pageSize, filters.startDate, filters.endDate, filters.type]);

  // Reset page when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [filters.startDate, filters.endDate, filters.type]);

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  const handleApplyFilters = () => {
    setShowFilters(false);
    // El useEffect se encargará de refetch cuando cambien los filtros
  };

  const handleClearFilters = () => {
    setFilters({ startDate: '', endDate: '', type: '' });
    setShowFilters(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-4xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-semibold">Kardex</h2>
              <p className="text-sm text-zinc-400">
                {inventoryCode} - {inventoryName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters || filters.startDate || filters.endDate || filters.type
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'hover:bg-zinc-800 text-zinc-400'
                }`}
                title="Filtros"
              >
                <Filter className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-zinc-800 overflow-hidden"
              >
                <div className="px-6 py-4 bg-zinc-800/30">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Desde</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="date"
                          value={filters.startDate}
                          onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                          className="w-full pl-10 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Hasta</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="date"
                          value={filters.endDate}
                          onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                          className="w-full pl-10 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Tipo</label>
                      <select
                        value={filters.type}
                        onChange={(e) => setFilters(f => ({ ...f, type: e.target.value as KardexMovementType | '' }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Todos</option>
                        <option value="IN">📥 Entrada</option>
                        <option value="OUT">📤 Salida</option>
                        <option value="WASTE">🗑️ Merma</option>
                        <option value="ADJUST">⚖️ Ajuste</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        onClick={handleApplyFilters}
                        className="flex-1 px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
                      >
                        Aplicar
                      </button>
                      <button
                        onClick={handleClearFilters}
                        className="px-4 py-2 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary */}
          <div className="px-6 py-4">
            <KardexSummaryCard summary={summary} />
          </div>

          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-zinc-800/50 text-xs font-medium text-zinc-400 uppercase mx-6 rounded-t-lg">
            <div className="col-span-2">Fecha</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-2 text-right">Cantidad</div>
            <div className="col-span-2 text-right">Saldo</div>
            <div className="col-span-2">Referencia</div>
            <div className="col-span-2">Actor</div>
          </div>

          {/* Entries list */}
          <div className="flex-1 overflow-y-auto mx-6 border border-zinc-800 rounded-b-lg">
            {isLoading ? (
              <div className="divide-y divide-zinc-800">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 animate-pulse">
                    <div className="col-span-2 h-4 bg-zinc-800 rounded" />
                    <div className="col-span-2 h-4 bg-zinc-800 rounded" />
                    <div className="col-span-2 h-4 bg-zinc-800 rounded" />
                    <div className="col-span-2 h-4 bg-zinc-800 rounded" />
                    <div className="col-span-2 h-4 bg-zinc-800 rounded" />
                    <div className="col-span-2 h-4 bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-red-400">
                {error}
              </div>
            ) : entries.length === 0 ? (
              <div className="px-4 py-8 text-center text-zinc-500">
                No hay movimientos registrados
              </div>
            ) : (
              entries.map((entry) => (
                <KardexEntryRow key={entry.id} entry={entry} />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
              <span className="text-sm text-zinc-400">
                Mostrando {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} de {pagination.total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm">
                  Página {pagination.page} de {totalPages}
                </span>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= totalPages}
                  className="p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
