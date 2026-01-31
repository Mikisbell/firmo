'use client';

/**
 * Inventory Admin Page
 * Main dashboard for inventory management operations
 * Requires PIN authentication (ADMIN, MANAGER roles)
 * Task 14 - Inventory UI Spec (Integration & Polish)
 * 
 * Features:
 * - 14.1 Componentes integrados ✅
 * - 14.2 Skeleton loaders ✅
 * - 14.3 Responsive design (touch-friendly, min 44x44px buttons)
 * - 14.4 Feedback visual (toasts, sync indicator)
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Truck, 
  ClipboardList, 
  Trash2, 
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  TrendingDown,
  Wifi,
  WifiOff,
  Cloud,
  Check,
  X,
  LogOut,
  Home
} from 'lucide-react';
import { PinModal, InventoryRole } from '@/src/components/inventory/PinModal';
import StockView from '@/src/components/inventory/StockView';
import EntryModal from '@/src/components/inventory/EntryModal';
import WasteModal from '@/src/components/inventory/WasteModal';
import KardexModal from '@/src/components/inventory/KardexModal';
import { InventoryItem } from '@/src/core/inventory/stock-types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearTerminalConfig } from '@/src/core/auth/fingerprint';
import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal';

type TabType = 'dashboard' | 'recepcion' | 'conteo' | 'merma' | 'alertas';

interface AuthEmployee {
  id: string;
  name: string;
  role: string;
}

const TERMINAL_ID = 'ADMIN_01';

// ============ TOAST SYSTEM ============

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
              toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
              toast.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
              toast.type === 'warning' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' :
              'bg-blue-500/20 border-blue-500/50 text-blue-400'
            }`}
          >
            <div className="flex-shrink-0">
              {toast.type === 'success' && <Check className="w-5 h-5" />}
              {toast.type === 'error' && <X className="w-5 h-5" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
              {toast.type === 'info' && <Cloud className="w-5 h-5" />}
            </div>
            <p className="text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => onDismiss(toast.id)}
              className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============ SYNC INDICATOR ============

function SyncIndicator({ isOnline, pendingCount }: { isOnline: boolean; pendingCount: number }) {
  if (isOnline && pendingCount === 0) {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm">
        <Wifi className="w-4 h-4" />
        <span className="hidden sm:inline">Conectado</span>
      </div>
    );
  }
  
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 text-amber-400 text-sm">
        <WifiOff className="w-4 h-4" />
        <span className="hidden sm:inline">Sin conexión</span>
        {pendingCount > 0 && (
          <span className="bg-amber-500/20 px-2 py-0.5 rounded-full text-xs">
            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  }
  
  // Online but with pending events (syncing)
  return (
    <div className="flex items-center gap-2 text-blue-400 text-sm">
      <Cloud className="w-4 h-4 animate-pulse" />
      <span className="hidden sm:inline">Sincronizando</span>
      <span className="bg-blue-500/20 px-2 py-0.5 rounded-full text-xs">
        {pendingCount}
      </span>
    </div>
  );
}

export default function InventarioPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPinModal, setShowPinModal] = useState(true);
  const [employee, setEmployee] = useState<AuthEmployee | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stats, setStats] = useState({
    lowStockCount: 0,
    pendingReceipts: 0,
    pendingCounts: 0,
    todayWaste: 0,
  });

  // Modal states
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showKardexModal, setShowKardexModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Toast state (Task 14.4)
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Sync state (Task 14.4)
  const [isOnline, setIsOnline] = useState(true);
  const [pendingEventsCount] = useState(0);

  const allowedRoles: InventoryRole[] = ['ADMIN', 'MANAGER'];

  const handleExit = () => {
    clearTerminalConfig();
    router.push("/");
  };

  const handleHome = () => {
    router.push("/");
  };

  // Toast helpers
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message }]);
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Online/offline detection (Task 14.4)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      addToast('success', 'Conexión restaurada. Sincronizando...');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      addToast('warning', 'Sin conexión. Los cambios se guardarán localmente.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  const handleAuthSuccess = useCallback((emp: AuthEmployee) => {
    setEmployee(emp);
    setIsAuthenticated(true);
    setShowPinModal(false);
    loadStats();
    addToast('success', `Bienvenido, ${emp.name}`);
  }, [addToast]);

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/inventory/stats?tenant_id=${DEFAULT_TENANT_ID}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Handlers para acciones de StockView
  const handleReceive = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setShowEntryModal(true);
  }, []);

  const handleWaste = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setShowWasteModal(true);
  }, []);

  const handleKardex = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setShowKardexModal(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setShowEntryModal(false);
    setShowWasteModal(false);
    setShowKardexModal(false);
    setSelectedItem(null);
  }, []);

  const handleOperationSuccess = useCallback((message?: string) => {
    handleModalClose();
    // Trigger refresh of StockView
    setRefreshKey(k => k + 1);
    loadStats();
    addToast('success', message || 'Operación completada');
  }, [handleModalClose, addToast]);

  const handleOperationError = useCallback((error: string) => {
    addToast('error', error);
  }, [addToast]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Package },
    { id: 'recepcion', label: 'Recepción', icon: Truck },
    { id: 'conteo', label: 'Conteo', icon: ClipboardList },
    { id: 'merma', label: 'Merma', icon: Trash2 },
    { id: 'alertas', label: 'Alertas', icon: AlertTriangle },
  ] as const;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <PinModal
          isOpen={showPinModal}
          onClose={() => window.history.back()}
          onSuccess={handleAuthSuccess}
          allowedRoles={allowedRoles}
          title="Acceso a Inventario"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link 
              href="/"
              className="p-3 rounded-lg hover:bg-zinc-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Volver al inicio"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Gestión de Inventario</h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                {employee?.name} ({employee?.role})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sync Indicator (Task 14.4) */}
            <SyncIndicator isOnline={isOnline} pendingCount={pendingEventsCount} />
            <button
              onClick={() => {
                loadStats();
                setRefreshKey(k => k + 1);
                addToast('info', 'Actualizando datos...');
              }}
              className="p-3 rounded-lg hover:bg-zinc-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Actualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            {/* Home Button */}
            <button
              onClick={handleHome}
              className="p-3 rounded-lg hover:bg-zinc-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center border border-zinc-700"
              aria-label="Ir al inicio"
            >
              <Home className="w-5 h-5" />
            </button>
            {/* Exit Button */}
            <button
              onClick={handleExit}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/30 min-h-[44px]"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs - Responsive (Task 14.3) */}
      <nav className="bg-zinc-900/50 border-b border-zinc-800 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap min-h-[48px] ${
                activeTab === tab.id
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-zinc-400 hover:text-white active:bg-zinc-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Content - Responsive padding (Task 14.3) */}
      <main className="p-4 sm:p-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <DashboardStats stats={stats} />
            <StockView
              key={refreshKey}
              tenantId={DEFAULT_TENANT_ID}
              employeeId={employee?.id || ''}
              onReceive={handleReceive}
              onWaste={handleWaste}
              onKardex={handleKardex}
            />
          </div>
        )}
        {activeTab === 'recepcion' && (
          <RecepcionTab 
            tenantId={DEFAULT_TENANT_ID}
            employeeId={employee?.id || ''} 
            onReceive={handleReceive}
            refreshKey={refreshKey}
          />
        )}
        {activeTab === 'conteo' && (
          <ConteoTab employeeId={employee?.id || ''} />
        )}
        {activeTab === 'merma' && (
          <MermaTab 
            tenantId={DEFAULT_TENANT_ID}
            employeeId={employee?.id || ''} 
            onWaste={handleWaste}
            refreshKey={refreshKey}
          />
        )}
        {activeTab === 'alertas' && (
          <AlertasTab tenantId={DEFAULT_TENANT_ID} />
        )}
      </main>

      {/* Modals */}
      {selectedItem && (
        <>
          <EntryModal
            isOpen={showEntryModal}
            onClose={handleModalClose}
            onSuccess={() => handleOperationSuccess('Entrada registrada correctamente')}
            onError={handleOperationError}
            inventoryItem={selectedItem}
            employeeId={employee?.id || ''}
            terminalId={TERMINAL_ID}
            tenantId={DEFAULT_TENANT_ID}
            locationId={selectedItem.locationId || ''}
          />
          <WasteModal
            isOpen={showWasteModal}
            onClose={handleModalClose}
            onSuccess={() => handleOperationSuccess('Merma registrada correctamente')}
            onError={handleOperationError}
            inventoryItem={selectedItem}
            employeeId={employee?.id || ''}
            terminalId={TERMINAL_ID}
            tenantId={DEFAULT_TENANT_ID}
            locationId={selectedItem.locationId || ''}
          />
          <KardexModal
            isOpen={showKardexModal}
            onClose={handleModalClose}
            inventoryCode={selectedItem.code}
            inventoryName={selectedItem.name}
            tenantId={DEFAULT_TENANT_ID}
          />
        </>
      )}

      {/* Toast Container (Task 14.4) */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}


// Dashboard Stats Cards
function DashboardStats({ stats }: { stats: { lowStockCount: number; pendingReceipts: number; pendingCounts: number; todayWaste: number } }) {
  const cards = [
    { label: 'Stock Bajo', value: stats.lowStockCount, icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/20' },
    { label: 'Recepciones Pendientes', value: stats.pendingReceipts, icon: Truck, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { label: 'Conteos Pendientes', value: stats.pendingCounts, icon: ClipboardList, color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { label: 'Merma Hoy', value: stats.todayWaste, icon: Trash2, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 rounded-xl p-4 border border-zinc-800"
        >
          <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <p className="text-2xl font-bold">{card.value}</p>
          <p className="text-sm text-zinc-400">{card.label}</p>
        </motion.div>
      ))}
    </div>
  );
}

// Recepcion Tab - Uses StockView with filter
function RecepcionTab({ 
  tenantId, 
  employeeId, 
  onReceive,
  refreshKey
}: { 
  tenantId: string;
  employeeId: string;
  onReceive: (item: InventoryItem) => void;
  refreshKey: number;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <h2 className="text-lg font-semibold mb-2">Recepción de Mercadería</h2>
        <p className="text-sm text-zinc-400">
          Selecciona un insumo y haz clic en [+] para registrar una entrada.
        </p>
      </div>
      <StockView
        key={refreshKey}
        tenantId={tenantId}
        employeeId={employeeId}
        onReceive={onReceive}
      />
    </div>
  );
}

// Conteo Tab (placeholder - future implementation)
function ConteoTab({ employeeId }: { employeeId: string }) {
  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h2 className="text-lg font-semibold mb-4">Conteo de Inventario</h2>
      <p className="text-zinc-400">
        Inicia un nuevo conteo físico o continúa uno existente.
      </p>
      <div className="mt-4 p-4 bg-zinc-800/50 rounded-lg">
        <p className="text-sm text-zinc-500">
          Empleado autorizado: {employeeId}
        </p>
        <p className="text-xs text-amber-400 mt-2">
          🚧 Funcionalidad en desarrollo
        </p>
      </div>
    </div>
  );
}

// Merma Tab - Uses StockView with filter
function MermaTab({ 
  tenantId, 
  employeeId, 
  onWaste,
  refreshKey
}: { 
  tenantId: string;
  employeeId: string;
  onWaste: (item: InventoryItem) => void;
  refreshKey: number;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <h2 className="text-lg font-semibold mb-2">Registro de Merma</h2>
        <p className="text-sm text-zinc-400">
          Selecciona un insumo y haz clic en [-] para registrar una merma.
        </p>
      </div>
      <StockView
        key={refreshKey}
        tenantId={tenantId}
        employeeId={employeeId}
        onWaste={onWaste}
      />
    </div>
  );
}

// Alertas Tab - Shows low stock and expiring items
function AlertasTab({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <h2 className="text-lg font-semibold mb-2">Alertas de Stock</h2>
        <p className="text-sm text-zinc-400">
          Productos con stock bajo o próximos a vencer.
        </p>
      </div>
      <StockView
        tenantId={tenantId}
        employeeId=""
      />
    </div>
  );
}
