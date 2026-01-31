/**
 * useInventory Hook
 * Hook principal para gestión de inventario con soporte offline
 * Task 7.1 - Inventory UI Spec
 * 
 * Features:
 * - Estado: items, summary, recentMovements, isLoading, error
 * - Operaciones: receiveGoods, recordWaste, getKardex, search, refresh
 * - Optimistic UI: actualizar vista inmediatamente
 * - Offline: guardar eventos en IndexedDB cuando no hay conexión
 * - Sync automático cuando vuelve conexión
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { InventoryItem, StockSummary } from '@/src/core/inventory/stock-types';
import { asCentavos } from '@/src/core/types/shared';
import { KardexEntry, KardexSummary, KardexMovementType } from '@/src/app/api/inventory/kardex/[code]/route';
import { inventoryOfflineDb, PendingInventoryEvent } from '@/src/core/db/inventory-offline-db';

// ============ TYPES ============

export interface GoodsReceiptInput {
  inventoryCode: string;
  quantity: number;
  unitCostCents: number;
  supplierId?: string;
  invoiceNumber?: string;
  lotNumber?: string;
  expiryDate?: string | null;
  notes?: string;
}

export interface WasteInput {
  inventoryCode: string;
  quantity: number;
  lotNumber?: string;
  reasonCode: 'EXPIRED' | 'DAMAGED' | 'THEFT' | 'PRODUCTION_LOSS' | 'COUNT_ADJUSTMENT' | 'OTHER';
  reasonDetail?: string;
  photoUrl?: string;
}

export interface KardexFilters {
  startDate?: string;
  endDate?: string;
  type?: KardexMovementType;
}

export interface RecentMovement {
  id: string;
  timestamp: string;
  type: KardexMovementType;
  quantity: number;
  inventoryCode: string;
  inventoryName: string;
  actorName: string;
}

export interface UseInventoryOptions {
  tenantId: string;
  locationId?: string;
  employeeId: string;
  terminalId: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export interface UseInventoryReturn {
  // State
  items: InventoryItem[];
  summary: StockSummary;
  recentMovements: RecentMovement[];
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;
  pendingEventsCount: number;
  
  // Operations
  receiveGoods: (input: GoodsReceiptInput) => Promise<boolean>;
  recordWaste: (input: WasteInput) => Promise<boolean>;
  getKardex: (code: string, filters?: KardexFilters) => Promise<{ entries: KardexEntry[]; summary: KardexSummary } | null>;
  search: (query: string) => void;
  refresh: () => Promise<void>;
  syncPendingEvents: () => Promise<void>;
}

// ============ HELPER FUNCTIONS ============

function generateEventId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ============ HOOK ============

export function useInventory(options: UseInventoryOptions): UseInventoryReturn {
  const { tenantId, locationId, employeeId, terminalId, onError, onSuccess } = options;
  
  // State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<StockSummary>({
    lowStockCount: 0,
    expiringCount: 0,
    totalValueCents: asCentavos(0),
  });
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingEventsCount, setPendingEventsCount] = useState(0);
  
  // Refs for sync
  const syncInProgress = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============ FETCH FUNCTIONS ============

  const fetchStock = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ tenant_id: tenantId });
      if (locationId) params.append('location_id', locationId);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/inventory/stock?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar inventario');
      }
      
      const data = await response.json();
      setItems(data.items);
      setSummary(data.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, locationId, searchQuery, onError]);

  const fetchRecentMovements = useCallback(async () => {
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
    }
  }, [tenantId, locationId]);

  // ============ OFFLINE SUPPORT ============

  const updatePendingCount = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const count = await inventoryOfflineDb.getPendingCount();
      setPendingEventsCount(count);
    } catch {
      // Ignore errors
    }
  }, []);

  const saveEventOffline = useCallback(async (event: Omit<PendingInventoryEvent, 'id' | 'syncStatus' | 'retryCount' | 'lastError'>) => {
    if (typeof window === 'undefined') return;
    
    await inventoryOfflineDb.addPendingEvent({
      ...event,
      syncStatus: 'pending',
      retryCount: 0,
    });
    
    await updatePendingCount();
  }, [updatePendingCount]);

  const syncPendingEvents = useCallback(async () => {
    if (typeof window === 'undefined' || syncInProgress.current || !isOnline) return;
    
    syncInProgress.current = true;
    
    try {
      const pendingEvents = await inventoryOfflineDb.getPendingEvents();
      
      for (const event of pendingEvents) {
        try {
          // Mark as syncing
          await inventoryOfflineDb.updateEventStatus(event.eventId, 'syncing');
          
          // Determine endpoint based on event type
          let endpoint = '';
          let body: Record<string, unknown> = {};
          
          if (event.type === 'GOODS_RECEIVED') {
            endpoint = '/api/inventory/receive';
            const payload = typeof event.payload === 'object' && event.payload !== null ? event.payload : {};
            body = {
              tenant_id: event.tenantId,
              location_id: event.locationId,
              event_id: event.eventId,
              ...payload,
              actor_id: event.actorId,
              terminal_id: event.terminalId,
            };
          } else if (event.type === 'WASTE_RECORDED') {
            endpoint = '/api/inventory/waste';
            const payload = typeof event.payload === 'object' && event.payload !== null ? event.payload : {};
            body = {
              tenant_id: event.tenantId,
              location_id: event.locationId,
              event_id: event.eventId,
              ...payload,
              actor_id: event.actorId,
              terminal_id: event.terminalId,
            };
          }
          
          if (!endpoint) continue;
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          
          if (response.ok || response.status === 409) {
            // Success or duplicate (idempotent)
            await inventoryOfflineDb.updateEventStatus(event.eventId, 'synced');
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          await inventoryOfflineDb.incrementRetry(event.eventId, errorMessage);
        }
      }
      
      // Clean up synced events
      await inventoryOfflineDb.cleanupSyncedEvents();
      await updatePendingCount();
      
      // Refresh data after sync
      await fetchStock();
      await fetchRecentMovements();
      
    } finally {
      syncInProgress.current = false;
    }
  }, [isOnline, updatePendingCount, fetchStock, fetchRecentMovements]);

  // ============ OPERATIONS ============

  const receiveGoods = useCallback(async (input: GoodsReceiptInput): Promise<boolean> => {
    const eventId = generateEventId();
    const timestamp = new Date().toISOString();
    
    // Optimistic update
    setItems(prev => prev.map(item => {
      if (item.code === input.inventoryCode) {
        const newStock = item.stock + input.quantity;
        return {
          ...item,
          stock: newStock,
          status: newStock < item.minStock ? 'CRITICAL' : newStock < item.minStock * 1.5 ? 'LOW' : 'OK',
        } as InventoryItem;
      }
      return item;
    }));
    
    // Add to recent movements optimistically
    const item = items.find(i => i.code === input.inventoryCode);
    if (item) {
      setRecentMovements(prev => [{
        id: eventId,
        timestamp,
        type: 'IN',
        quantity: input.quantity,
        inventoryCode: input.inventoryCode,
        inventoryName: item.name,
        actorName: 'Tú',
      }, ...prev.slice(0, 9)]);
    }
    
    if (!isOnline) {
      // Save offline
      await saveEventOffline({
        eventId,
        type: 'GOODS_RECEIVED',
        tenantId,
        locationId: locationId || '',
        actorId: employeeId,
        terminalId,
        createdAt: timestamp,
        payload: input,
      });
      
      onSuccess?.('Entrada guardada localmente. Se sincronizará cuando haya conexión.');
      return true;
    }
    
    try {
      const response = await fetch('/api/inventory/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          location_id: locationId,
          event_id: eventId,
          inventory_code: input.inventoryCode,
          quantity: input.quantity,
          unit_cost_cents: input.unitCostCents,
          supplier_id: input.supplierId,
          invoice_number: input.invoiceNumber,
          lot_number: input.lotNumber,
          expiry_date: input.expiryDate,
          notes: input.notes,
          actor_id: employeeId,
          terminal_id: terminalId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al registrar entrada');
      }
      
      onSuccess?.('Entrada registrada correctamente');
      
      // Refresh to get accurate data
      await fetchStock();
      await fetchRecentMovements();
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      
      // Revert optimistic update
      await fetchStock();
      
      // Save offline for retry
      await saveEventOffline({
        eventId,
        type: 'GOODS_RECEIVED',
        tenantId,
        locationId: locationId || '',
        actorId: employeeId,
        terminalId,
        createdAt: timestamp,
        payload: input,
      });
      
      onError?.(message);
      return false;
    }
  }, [tenantId, locationId, employeeId, terminalId, items, isOnline, saveEventOffline, fetchStock, fetchRecentMovements, onSuccess, onError]);

  const recordWaste = useCallback(async (input: WasteInput): Promise<boolean> => {
    const eventId = generateEventId();
    const timestamp = new Date().toISOString();
    
    // Optimistic update
    setItems(prev => prev.map(item => {
      if (item.code === input.inventoryCode) {
        const newStock = Math.max(0, item.stock - input.quantity);
        return {
          ...item,
          stock: newStock,
          status: newStock < item.minStock ? 'CRITICAL' : newStock < item.minStock * 1.5 ? 'LOW' : 'OK',
        } as InventoryItem;
      }
      return item;
    }));
    
    // Add to recent movements optimistically
    const item = items.find(i => i.code === input.inventoryCode);
    if (item) {
      setRecentMovements(prev => [{
        id: eventId,
        timestamp,
        type: 'WASTE',
        quantity: -input.quantity,
        inventoryCode: input.inventoryCode,
        inventoryName: item.name,
        actorName: 'Tú',
      }, ...prev.slice(0, 9)]);
    }
    
    if (!isOnline) {
      // Save offline
      await saveEventOffline({
        eventId,
        type: 'WASTE_RECORDED',
        tenantId,
        locationId: locationId || '',
        actorId: employeeId,
        terminalId,
        createdAt: timestamp,
        payload: input,
      });
      
      onSuccess?.('Merma guardada localmente. Se sincronizará cuando haya conexión.');
      return true;
    }
    
    try {
      const response = await fetch('/api/inventory/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          location_id: locationId,
          event_id: eventId,
          inventory_code: input.inventoryCode,
          quantity: input.quantity,
          lot_number: input.lotNumber,
          reason_code: input.reasonCode,
          reason_detail: input.reasonDetail,
          photo_url: input.photoUrl,
          actor_id: employeeId,
          terminal_id: terminalId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al registrar merma');
      }
      
      onSuccess?.('Merma registrada correctamente');
      
      // Refresh to get accurate data
      await fetchStock();
      await fetchRecentMovements();
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      
      // Revert optimistic update
      await fetchStock();
      
      // Save offline for retry
      await saveEventOffline({
        eventId,
        type: 'WASTE_RECORDED',
        tenantId,
        locationId: locationId || '',
        actorId: employeeId,
        terminalId,
        createdAt: timestamp,
        payload: input,
      });
      
      onError?.(message);
      return false;
    }
  }, [tenantId, locationId, employeeId, terminalId, items, isOnline, saveEventOffline, fetchStock, fetchRecentMovements, onSuccess, onError]);

  const getKardex = useCallback(async (
    code: string, 
    filters?: KardexFilters
  ): Promise<{ entries: KardexEntry[]; summary: KardexSummary } | null> => {
    try {
      const params = new URLSearchParams({ tenant_id: tenantId });
      if (filters?.startDate) params.append('start_date', filters.startDate);
      if (filters?.endDate) params.append('end_date', filters.endDate);
      if (filters?.type) params.append('type', filters.type);
      
      const response = await fetch(`/api/inventory/kardex/${encodeURIComponent(code)}?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar kardex');
      }
      
      const data = await response.json();
      return {
        entries: data.entries,
        summary: data.summary,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      onError?.(message);
      return null;
    }
  }, [tenantId, onError]);

  const search = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchStock(), fetchRecentMovements()]);
  }, [fetchStock, fetchRecentMovements]);

  // ============ EFFECTS ============

  // Initial fetch
  useEffect(() => {
    fetchStock();
    fetchRecentMovements();
    updatePendingCount();
  }, [fetchStock, fetchRecentMovements, updatePendingCount]);

  // Online/offline detection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      // Sync pending events when back online
      syncPendingEvents();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingEvents]);

  // Periodic sync attempt with exponential backoff
  useEffect(() => {
    if (!isOnline || pendingEventsCount === 0) return;

    const attemptSync = () => {
      syncPendingEvents();
    };

    // Initial sync attempt
    attemptSync();

    // Retry every 30 seconds if there are pending events
    const interval = setInterval(attemptSync, 30000);

    return () => {
      clearInterval(interval);
      // Copy ref value to variable for cleanup
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const retryTimeout = retryTimeoutRef.current;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [isOnline, pendingEventsCount, syncPendingEvents]);

  return {
    items,
    summary,
    recentMovements,
    isLoading,
    error,
    isOnline,
    pendingEventsCount,
    receiveGoods,
    recordWaste,
    getKardex,
    search,
    refresh,
    syncPendingEvents,
  };
}
