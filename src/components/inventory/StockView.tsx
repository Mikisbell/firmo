'use client';

/**
 * StockView Component
 * Vista principal de inventario con lista de insumos, búsqueda y acciones
 * Task 3.1 - Inventory UI Spec
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Plus, 
  Minus, 
  FileText, 
  AlertTriangle,
  Package,
  TrendingDown,
  Clock,
  Activity,
  PackageMinus,
  Trash2,
  Scale
} from 'lucide-react';
import { InventoryItem, StockSummary, StockStatus, ExpiryUrgency } from '@/src/core/inventory/stock-types';
import { KardexMovementType } from '@/src/app/api/inventory/kardex/[code]/route';
import { asCentavos } from '@/src/core/types/shared';

interface StockViewProps {
  tenantId: string;
  locationId?: string;
  employeeId?: string; // Optional - for future audit logging
  onReceive?: (item: InventoryItem) => void;
  onWaste?: (item: InventoryItem) => void;
  onKardex?: (item: InventoryItem) => void;
  onHighlightItem?: (code: string) => void;
}

// Tipo para movimientos recientes
interface RecentMovement {
  id: string;
  timestamp: string;
  type: KardexMovementType;
  quantity: number;
  inventoryCode: string;
  inventoryName: string;
  actorName: string;
}

// Función para calcular status (exportada para tests)
export function calculateStatus(stock: number, minStock: number): StockStatus {
  if (minStock <= 0) return 'OK';
  if (stock < minStock) return 'CRITICAL';
  if (stock < minStock * 1.5) return 'LOW';
  return 'OK';
}

// Indicador de status visual
function StatusIndicator({ status }: { status: StockStatus }) {
  const config = {
    CRITICAL: { color: 'bg-red-500', icon: '🔴', label: 'Crítico' },
    LOW: { color: 'bg-amber-500', icon: '🟡', label: 'Bajo' },
    OK: { color: 'bg-green-500', icon: '🟢', label: 'OK' },
  };
  
  const { color, icon, label } = config[status];
  
  return (
    <span className="flex items-center gap-1.5" title={label}>
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-xs text-zinc-400">{icon}</span>
    </span>
  );
}

// Indicador de vencimiento FEFO (Task 11.1)
function ExpiryIndicator({ urgency, daysUntilExpiry }: { urgency: ExpiryUrgency; daysUntilExpiry: number | null }) {
  if (urgency === 'OK' || !daysUntilExpiry) return null;
  
  const config: Record<ExpiryUrgency, { icon: string; color: string; label: string }> = {
    EXPIRED: { icon: '💀', color: 'text-red-500', label: 'Vencido' },
    TODAY: { icon: '🔴', color: 'text-red-400', label: 'Vence hoy' },
    TOMORROW: { icon: '🔴', color: 'text-red-400', label: 'Vence mañana' },
    SOON_3D: { icon: '🟠', color: 'text-orange-400', label: `Vence en ${daysUntilExpiry}d` },
    SOON_7D: { icon: '🟡', color: 'text-amber-400', label: `Vence en ${daysUntilExpiry}d` },
    OK: { icon: '', color: '', label: '' },
  };
  
  const { icon, color, label } = config[urgency];
  
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`} title={label}>
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

// Summary Card
function SummaryCard({ summary, isLoading }: { summary: StockSummary; isLoading: boolean }) {
  const cards = [
    { 
      label: 'Stock Bajo', 
      value: summary.lowStockCount, 
      icon: TrendingDown, 
      color: 'text-red-400', 
      bg: 'bg-red-500/20' 
    },
    { 
      label: 'Por Vencer', 
      value: summary.expiringCount, 
      icon: Clock, 
      color: 'text-amber-400', 
      bg: 'bg-amber-500/20' 
    },
    { 
      label: 'Valor Total', 
      value: `S/${(summary.totalValueCents / 100).toFixed(2)}`, 
      icon: Package, 
      color: 'text-blue-400', 
      bg: 'bg-blue-500/20' 
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-7 h-7 rounded ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <span className="text-xs text-zinc-400">{card.label}</span>
          </div>
          <p className={`text-lg font-bold ${isLoading ? 'animate-pulse' : ''}`}>
            {isLoading ? '...' : card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// Sección "Por Vencer" - FEFO (Task 11.1)
function ExpiringSection({ 
  items, 
  isLoading,
  onWaste 
}: { 
  items: InventoryItem[]; 
  isLoading: boolean;
  onWaste?: (item: InventoryItem) => void;
}) {
  // Filtrar items que vencen en 7 días o menos, ordenados por urgencia
  const expiringItems = useMemo(() => {
    const urgencyOrder: Record<ExpiryUrgency, number> = {
      EXPIRED: 0,
      TODAY: 1,
      TOMORROW: 2,
      SOON_3D: 3,
      SOON_7D: 4,
      OK: 5,
    };
    
    return items
      .filter(item => item.expiryUrgency !== 'OK')
      .sort((a, b) => urgencyOrder[a.expiryUrgency] - urgencyOrder[b.expiryUrgency]);
  }, [items]);

  if (isLoading) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-amber-500/30 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-400">Por Vencer</span>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (expiringItems.length === 0) {
    return null; // No mostrar sección si no hay items por vencer
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-amber-500/30 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-400">Por Vencer</span>
          <span className="text-xs text-zinc-500">({expiringItems.length})</span>
        </div>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {expiringItems.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center justify-between p-2 rounded-lg ${
              item.expiryUrgency === 'EXPIRED' ? 'bg-red-500/10' :
              item.expiryUrgency === 'TODAY' || item.expiryUrgency === 'TOMORROW' ? 'bg-red-500/5' :
              'bg-amber-500/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <ExpiryIndicator urgency={item.expiryUrgency} daysUntilExpiry={item.daysUntilExpiry} />
              <div>
                <span className="text-xs font-mono text-zinc-400">{item.code}</span>
                <span className="text-sm ml-2">{item.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">
                {item.stock.toFixed(1)} {item.unit}
              </span>
              {item.expiryUrgency === 'EXPIRED' && onWaste && (
                <button
                  onClick={() => onWaste(item)}
                  className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                  title="Registrar merma por vencimiento"
                >
                  Dar de baja
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Configuración de iconos por tipo de movimiento
const MOVEMENT_TYPE_CONFIG: Record<KardexMovementType, { icon: typeof Package; color: string; bg: string; emoji: string }> = {
  IN: { icon: Package, color: 'text-green-400', bg: 'bg-green-500/20', emoji: '📥' },
  OUT: { icon: PackageMinus, color: 'text-blue-400', bg: 'bg-blue-500/20', emoji: '📤' },
  WASTE: { icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/20', emoji: '🗑️' },
  ADJUST: { icon: Scale, color: 'text-amber-400', bg: 'bg-amber-500/20', emoji: '⚖️' },
};

// Componente de Últimos Movimientos
function RecentMovementsSection({ 
  movements, 
  isLoading, 
  onMovementClick 
}: { 
  movements: RecentMovement[]; 
  isLoading: boolean;
  onMovementClick?: (code: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-400">Últimos Movimientos</span>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-400">Últimos Movimientos</span>
        </div>
        <p className="text-sm text-zinc-500 text-center py-4">Sin movimientos recientes</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-400">Últimos Movimientos</span>
        <span className="text-xs text-zinc-500">({movements.length})</span>
      </div>
      <div className="space-y-1">
        {movements.map((movement) => {
          const config = MOVEMENT_TYPE_CONFIG[movement.type];
          const Icon = config.icon;
          
          return (
            <motion.button
              key={movement.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => onMovementClick?.(movement.inventoryCode)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors text-left"
            >
              <div className={`w-7 h-7 rounded ${config.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-400">{movement.inventoryCode}</span>
                  <span className="text-xs text-zinc-500 truncate">{movement.inventoryName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={movement.quantity > 0 ? 'text-green-400' : 'text-red-400'}>
                    {movement.quantity > 0 ? '+' : ''}{movement.quantity.toFixed(2)}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-500">{movement.actorName}</span>
                </div>
              </div>
              <div className="text-xs text-zinc-500 flex-shrink-0">
                {new Date(movement.timestamp).toLocaleTimeString('es-PE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default function StockView({
  tenantId,
  locationId,
  onReceive,
  onWaste,
  onKardex,
  onHighlightItem,
}: StockViewProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<StockSummary>({
    lowStockCount: 0,
    expiringCount: 0,
    totalValueCents: asCentavos(0),
  });
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMovements, setIsLoadingMovements] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);

  // Debounce search query (150ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch inventory data
  useEffect(() => {
    const fetchStock = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({ tenant_id: tenantId });
        if (locationId) params.append('location_id', locationId);
        if (debouncedQuery) params.append('search', debouncedQuery);
        if (showLowStockOnly) params.append('low_stock_only', 'true');
        
        const response = await fetch(`/api/inventory/stock?${params}`);
        
        if (!response.ok) {
          throw new Error('Error al cargar inventario');
        }
        
        const data = await response.json();
        setItems(data.items);
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStock();
  }, [tenantId, locationId, debouncedQuery, showLowStockOnly]);

  // Fetch recent movements
  useEffect(() => {
    const fetchRecentMovements = async () => {
      setIsLoadingMovements(true);
      try {
        const params = new URLSearchParams({ tenant_id: tenantId, limit: '10' });
        if (locationId) params.append('location_id', locationId);
        
        const response = await fetch(`/api/inventory/movements/recent?${params}`);
        
        if (response.ok) {
          const data = await response.json();
          setRecentMovements(data.movements || []);
        }
      } catch {
        // Silently fail - recent movements are not critical
      } finally {
        setIsLoadingMovements(false);
      }
    };
    
    fetchRecentMovements();
  }, [tenantId, locationId]);

  // Handle movement click - highlight the item in the list
  const handleMovementClick = useCallback((code: string) => {
    setHighlightedCode(code);
    onHighlightItem?.(code);
    
    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedCode(null), 3000);
    
    // Scroll to item if needed
    const element = document.getElementById(`inventory-item-${code}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [onHighlightItem]);

  // Filter items locally for instant feedback
  const filteredItems = useMemo(() => {
    if (!debouncedQuery) return items;
    const query = debouncedQuery.toLowerCase();
    return items.filter(
      item => 
        item.code.toLowerCase().includes(query) || 
        item.name.toLowerCase().includes(query)
    );
  }, [items, debouncedQuery]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <SummaryCard summary={summary} isLoading={isLoading} />

      {/* Expiring Section - FEFO (Task 11.1) */}
      <ExpiringSection items={items} isLoading={isLoading} onWaste={onWaste} />

      {/* Search and filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por código o nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            showLowStockOnly 
              ? 'bg-red-500/20 text-red-400 border border-red-500/50' 
              : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Stock Bajo
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Items list */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-800/50 text-xs font-medium text-zinc-400 uppercase">
          <div className="col-span-2">Código</div>
          <div className="col-span-3">Nombre</div>
          <div className="col-span-2 text-right">Stock</div>
          <div className="col-span-2 text-right">Mínimo</div>
          <div className="col-span-1 text-center">Estado</div>
          <div className="col-span-2 text-center">Acciones</div>
        </div>

        {/* Items */}
        <div className="divide-y divide-zinc-800">
          {isLoading ? (
            // Skeleton loader
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 animate-pulse">
                <div className="col-span-2 h-4 bg-zinc-800 rounded" />
                <div className="col-span-3 h-4 bg-zinc-800 rounded" />
                <div className="col-span-2 h-4 bg-zinc-800 rounded" />
                <div className="col-span-2 h-4 bg-zinc-800 rounded" />
                <div className="col-span-1 h-4 bg-zinc-800 rounded" />
                <div className="col-span-2 h-4 bg-zinc-800 rounded" />
              </div>
            ))
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-500">
              {debouncedQuery ? 'No se encontraron resultados' : 'No hay insumos registrados'}
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                id={`inventory-item-${item.code}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`grid grid-cols-12 gap-2 px-4 py-3 hover:bg-zinc-800/30 transition-colors ${
                  item.status === 'CRITICAL' ? 'bg-red-500/5' : ''
                } ${item.expiryUrgency !== 'OK' ? 'bg-amber-500/5' : ''} ${highlightedCode === item.code ? 'bg-amber-500/20 ring-1 ring-amber-500/50' : ''}`}
              >
                <div className="col-span-2 font-mono text-sm text-zinc-300">
                  {item.code}
                </div>
                <div className="col-span-3 text-sm truncate flex items-center gap-2" title={item.name}>
                  {item.name}
                  {/* Indicador de vencimiento FEFO (Task 11.1) */}
                  <ExpiryIndicator urgency={item.expiryUrgency} daysUntilExpiry={item.daysUntilExpiry} />
                </div>
                <div className="col-span-2 text-right font-medium">
                  {item.stock.toFixed(2)} <span className="text-xs text-zinc-500">{item.unit}</span>
                </div>
                <div className="col-span-2 text-right text-zinc-400">
                  {item.minStock.toFixed(2)} <span className="text-xs text-zinc-500">{item.unit}</span>
                </div>
                <div className="col-span-1 flex justify-center">
                  <StatusIndicator status={item.status} />
                </div>
                <div className="col-span-2 flex justify-center gap-1">
                  <button
                    onClick={() => onReceive?.(item)}
                    className="p-2.5 rounded-lg hover:bg-green-500/20 text-green-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center active:bg-green-500/30"
                    title="Registrar entrada"
                    aria-label={`Registrar entrada de ${item.name}`}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onWaste?.(item)}
                    className="p-2.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center active:bg-red-500/30"
                    title="Registrar merma"
                    aria-label={`Registrar merma de ${item.name}`}
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onKardex?.(item)}
                    className="p-2.5 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center active:bg-blue-500/30"
                    title="Ver kardex"
                    aria-label={`Ver kardex de ${item.name}`}
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="text-xs text-zinc-500 text-right">
        {filteredItems.length} insumo{filteredItems.length !== 1 ? 's' : ''} 
        {showLowStockOnly && ' con stock bajo'}
      </div>

      {/* Recent Movements Section */}
      <RecentMovementsSection 
        movements={recentMovements}
        isLoading={isLoadingMovements}
        onMovementClick={handleMovementClick}
      />
    </div>
  );
}
