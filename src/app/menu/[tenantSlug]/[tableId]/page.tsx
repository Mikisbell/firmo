'use client';

/**
 * Public Customer Portal - Digital Menu, Order Status, Feedback
 *
 * LIGHT theme (customer-facing, not admin dark theme).
 * Shows restaurant menu, active order status, and feedback form.
 * Includes sticky bottom bar with "Call Waiter" and "Request Check" buttons.
 *
 * @module app/menu/[tenantSlug]/[tableId]/page
 */

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { t } from '@/src/i18n';
import {
  Loader2,
  Bell,
  MapPin,
  UtensilsCrossed,
  MessageSquarePlus,
  ChevronDown,
  ChevronUp,
  Star,
  Receipt,
  ClipboardList,
  RefreshCw,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Gift,
  CheckCircle2,
  Send,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Product {
  id: string;
  name: string;
  priceCents: number;
  category: string | null;
  images: string[];
}

interface Category {
  name: string;
  products: Product[];
}

interface MenuData {
  tenant: { name: string; logoUrl: string | null; address: string | null };
  table: { id: string; number: string; displayName: string | null };
  categories: Category[];
}

interface OrderItem {
  name: string;
  qty: number;
  total_cents: number;
  status: string;
  notes: string | null;
}

interface ActiveOrder {
  order_number: number;
  status: string;
  fulfillment_status: string;
  total_cents: number;
  items: OrderItem[];
  created_at: string;
}

interface PageParams {
  tenantSlug: string;
  tableId: string;
}

interface CartItem {
  product_id: string;
  name: string;
  price_cents: number;
  qty: number;
  notes?: string;
}

interface LoyaltyData {
  found: boolean;
  points?: number;
  tier?: string;
  nextTier?: { name: string; pointsNeeded: number } | null;
  progress?: number;
  reason?: string;
}

interface OrderSendResult {
  success: boolean;
  orderNumber?: number;
  orderId?: string;
  error?: string;
}

type PortalTab = 'menu' | 'orders' | 'feedback';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatPrice = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

const STATUS_DISPLAY: Record<string, { icon: string; label: string; color: string }> = {
  PENDING: { icon: '\u23F3', label: 'Recibido', color: 'bg-gray-100 text-gray-700' },
  COOKING: { icon: '\uD83D\uDD25', label: 'Preparando', color: 'bg-orange-100 text-orange-700' },
  READY: { icon: '\u2705', label: 'Listo', color: 'bg-green-100 text-green-700' },
  DONE: { icon: '\uD83C\uDF7D\uFE0F', label: 'Servido', color: 'bg-blue-100 text-blue-700' },
};

const TIER_LABELS: Record<string, string> = {
  BRONCE: 'Bronce',
  PLATA: 'Plata',
  ORO: 'Oro',
  PLATINO: 'Platino',
};

function getElapsedTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `Hace ${hours}h ${mins % 60}min`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PublicMenuPage({ params }: { params: Promise<PageParams> }) {
  const { tenantSlug, tableId } = use(params);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<PortalTab>('menu');

  // Menu state
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Orders state
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartPanel, setShowCartPanel] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [sendingOrder, setSendingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderSendResult | null>(null);

  // Loyalty state
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [loyaltyPhone, setLoyaltyPhone] = useState('');
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  // Call waiter state
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);

  // Refs
  const cartPanelRef = useRef<HTMLDivElement>(null);

  // Request check state
  const [requestingCheck, setRequestingCheck] = useState(false);
  const [checkRequested, setCheckRequested] = useState(false);

  // Feedback state
  const [feedbackType, setFeedbackType] = useState<'QUEJA' | 'SUGERENCIA' | 'ELOGIO'>('ELOGIO');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  // ----- Fetch Menu -----
  useEffect(() => {
    async function fetchMenu() {
      try {
        const res = await fetch(`/api/menu/${tenantSlug}/${tableId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? 'Menu no disponible');
          return;
        }
        const data: MenuData = await res.json();
        setMenuData(data);
        if (data.categories.length > 0) {
          setActiveCategory(data.categories[0].name);
        }
      } catch {
        setError('Error al cargar el menu');
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, [tenantSlug, tableId]);

  // ----- Fetch Orders -----
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetch(`/api/menu/${tenantSlug}/${tableId}/orders`);
      if (!res.ok) {
        setOrdersError('No se pudieron cargar los pedidos');
        return;
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch {
      setOrdersError('Error al cargar pedidos');
    } finally {
      setOrdersLoading(false);
    }
  }, [tenantSlug, tableId]);

  // Auto-refresh orders every 15s when on orders tab
  useEffect(() => {
    if (activeTab !== 'orders') return;
    fetchOrders();
    const interval = setInterval(fetchOrders, 15_000);
    return () => clearInterval(interval);
  }, [activeTab, fetchOrders]);

  // ----- Cart Actions -----

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [
        ...prev,
        { product_id: product.id, name: product.name, price_cents: product.priceCents, qty: 1 },
      ];
    });
  }

  function updateCartQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product_id === productId ? { ...item, qty: item.qty + delta } : item,
        )
        .filter((item) => item.qty > 0),
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  }

  function updateItemNotes(productId: string, notes: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, notes } : item,
      ),
    );
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price_cents * item.qty, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  function getCartQty(productId: string): number {
    return cart.find((item) => item.product_id === productId)?.qty ?? 0;
  }

  // ----- Send Order -----

  async function handleSendOrder() {
    if (sendingOrder || cart.length === 0) return;
    setSendingOrder(true);
    setOrderResult(null);

    try {
      const res = await fetch(`/api/menu/${tenantSlug}/${tableId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            price_cents: item.price_cents,
            qty: item.qty,
            notes: item.notes || undefined,
          })),
          notes: orderNotes || undefined,
          customerName: customerName || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOrderResult({ success: true, orderNumber: data.orderNumber, orderId: data.orderId });
        setCart([]);
        setOrderNotes('');
        setCustomerName('');
        setShowCartPanel(false);
        // Switch to orders tab after a brief delay
        setTimeout(() => setActiveTab('orders'), 2000);
      } else {
        setOrderResult({ success: false, error: data.error ?? 'Error al enviar pedido' });
      }
    } catch {
      setOrderResult({ success: false, error: 'Error de conexion. Intenta de nuevo.' });
    } finally {
      setSendingOrder(false);
    }
  }

  // ----- Loyalty Check -----

  async function handleLoyaltyCheck() {
    if (loyaltyLoading || !loyaltyPhone.trim()) return;
    setLoyaltyLoading(true);
    setLoyaltyData(null);

    try {
      const phone = loyaltyPhone.replace(/\D/g, '');
      const res = await fetch(`/api/menu/${tenantSlug}/loyalty?phone=${phone}`);
      const data: LoyaltyData = await res.json();
      setLoyaltyData(data);
    } catch {
      setLoyaltyData({ found: false });
    } finally {
      setLoyaltyLoading(false);
    }
  }

  // ----- Call Waiter -----
  const handleCallWaiter = async () => {
    if (callingWaiter || waiterCalled) return;
    setCallingWaiter(true);
    try {
      const res = await fetch(`/api/menu/${tenantSlug}/${tableId}/call-waiter`, {
        method: 'POST',
      });
      if (res.ok) {
        setWaiterCalled(true);
        setTimeout(() => setWaiterCalled(false), 120_000);
      }
    } catch {
      // Silent fail
    } finally {
      setCallingWaiter(false);
    }
  };

  // ----- Request Check -----
  const handleRequestCheck = async () => {
    if (requestingCheck || checkRequested) return;
    setRequestingCheck(true);
    try {
      const res = await fetch(`/api/menu/${tenantSlug}/${tableId}/request-check`, {
        method: 'POST',
      });
      if (res.ok) {
        setCheckRequested(true);
        setTimeout(() => setCheckRequested(false), 300_000); // 5 min cooldown
      }
    } catch {
      // Silent fail
    } finally {
      setRequestingCheck(false);
    }
  };

  // ----- Send Feedback -----
  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim() || sendingFeedback) return;
    setSendingFeedback(true);
    try {
      const res = await fetch(`/api/menu/${tenantSlug}/${tableId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          message: feedbackMessage.trim(),
          customer_name: feedbackName.trim() || undefined,
          rating: feedbackRating,
        }),
      });
      if (res.ok) {
        setFeedbackSent(true);
        setFeedbackMessage('');
        setFeedbackName('');
      }
    } catch {
      // silent fail
    } finally {
      setSendingFeedback(false);
    }
  };

  // ----- Loading / Error -----
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="mt-3 text-gray-500 text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !menuData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-6">
        <UtensilsCrossed className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Menu no disponible</h1>
        <p className="text-gray-500 text-sm text-center">{error ?? 'No se pudo cargar el menu'}</p>
      </div>
    );
  }

  // ----- Order Success Screen -----
  if (orderResult?.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pedido enviado!</h1>
          <p className="text-gray-500 mb-4">Tu mozo lo recibira en breve.</p>
          {orderResult.orderNumber && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl py-3 px-4 mb-6">
              <p className="text-xs text-amber-600 font-medium">Numero de pedido</p>
              <p className="text-3xl font-bold text-amber-700">#{orderResult.orderNumber}</p>
            </div>
          )}
          <button
            onClick={() => { setOrderResult(null); setActiveTab('orders'); }}
            className="w-full py-3 bg-amber-500 active:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
          >
            Ver mi pedido
          </button>
          <button
            onClick={() => setOrderResult(null)}
            className="w-full py-2 mt-2 text-sm text-gray-500 underline"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {menuData.tenant.logoUrl ? (
              <img
                src={menuData.tenant.logoUrl}
                alt={menuData.tenant.name}
                className="w-12 h-12 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-amber-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 text-lg truncate">{menuData.tenant.name}</h1>
              {menuData.tenant.address && (
                <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {menuData.tenant.address}
                </p>
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex-shrink-0">
              <span className="text-xs font-bold text-amber-700">
                Mesa {menuData.table.displayName ?? menuData.table.number}
              </span>
            </div>
          </div>
        </div>

        {/* Portal Tab Navigation */}
        <div className="max-w-lg mx-auto px-4 pb-2">
          <div className="flex gap-2">
            {([
              { key: 'menu' as const, icon: ClipboardList, label: 'Menu' },
              { key: 'orders' as const, icon: Receipt, label: 'Mi Pedido' },
              { key: 'feedback' as const, icon: Star, label: 'Opinion' },
            ]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors
                  ${activeTab === key
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Tabs (only on menu tab) */}
        {activeTab === 'menu' && menuData.categories.length > 1 && (
          <div className="max-w-lg mx-auto px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {menuData.categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`
                    whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0
                    ${activeCategory === cat.name
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* TAB: Menu */}
      {/* ================================================================ */}
      {activeTab === 'menu' && (
        <div className="max-w-lg mx-auto px-4 py-4">
          {menuData.categories
            .filter((cat) => !activeCategory || cat.name === activeCategory)
            .map((cat) => (
              <div key={cat.name} className="mb-6">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {cat.name}
                </h2>
                <div className="space-y-2">
                  {cat.products.map((product) => {
                    const qty = getCartQty(product.id);
                    return (
                      <div
                        key={product.id}
                        className={`bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm transition-colors ${
                          qty > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-gray-100'
                        }`}
                      >
                        {product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <UtensilsCrossed className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                          <span className="text-amber-600 font-bold text-sm">
                            {formatPrice(product.priceCents)}
                          </span>
                        </div>

                        {/* Add to cart / qty stepper */}
                        <div className="flex-shrink-0">
                          {qty === 0 ? (
                            <button
                              onClick={() => addToCart(product)}
                              className="w-9 h-9 rounded-full bg-amber-500 active:bg-amber-600 text-white flex items-center justify-center transition-colors shadow-sm"
                              aria-label={`Agregar ${product.name}`}
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateCartQty(product.id, -1)}
                                className="w-8 h-8 rounded-full bg-gray-200 active:bg-gray-300 text-gray-700 flex items-center justify-center transition-colors"
                                aria-label="Quitar uno"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-7 text-center font-bold text-sm text-gray-900">
                                {qty}
                              </span>
                              <button
                                onClick={() => updateCartQty(product.id, 1)}
                                className="w-8 h-8 rounded-full bg-amber-500 active:bg-amber-600 text-white flex items-center justify-center transition-colors"
                                aria-label="Agregar uno mas"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ================================================================ */}
      {/* Loyalty Section (visible on menu tab) */}
      {/* ================================================================ */}
      {activeTab === 'menu' && (
        <div className="max-w-lg mx-auto px-4 pb-4">
          <button
            onClick={() => { setShowLoyalty(!showLoyalty); setLoyaltyData(null); }}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm text-gray-700 font-medium text-sm"
          >
            <span className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-500" />
              Mis Puntos
            </span>
            {showLoyalty ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showLoyalty && (
            <div className="mt-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-800">Programa de Fidelidad</p>

              <div className="flex gap-2">
                <input
                  type="tel"
                  value={loyaltyPhone}
                  onChange={(e) => setLoyaltyPhone(e.target.value)}
                  placeholder="987 654 321"
                  maxLength={15}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleLoyaltyCheck}
                  disabled={loyaltyLoading || !loyaltyPhone.trim()}
                  className="px-4 py-2 bg-amber-500 active:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm rounded-lg transition-colors flex items-center gap-1"
                >
                  {loyaltyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Consultar
                </button>
              </div>

              {loyaltyData && (
                <div className="pt-2">
                  {loyaltyData.found ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-amber-600">{loyaltyData.points}</p>
                          <p className="text-xs text-gray-500">puntos disponibles</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-800">
                            {TIER_LABELS[loyaltyData.tier ?? ''] ?? loyaltyData.tier}
                          </p>
                          <p className="text-xs text-gray-500">tu nivel</p>
                        </div>
                      </div>

                      {loyaltyData.nextTier && (
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Siguiente: {TIER_LABELS[loyaltyData.nextTier.name] ?? loyaltyData.nextTier.name}</span>
                            <span>{loyaltyData.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                              style={{ width: `${loyaltyData.progress ?? 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Faltan {loyaltyData.nextTier.pointsNeeded} pts
                          </p>
                        </div>
                      )}

                      {!loyaltyData.nextTier && (
                        <p className="text-xs text-amber-600 font-medium">Nivel maximo alcanzado!</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-sm text-gray-500">
                        {loyaltyData.reason === 'loyalty_disabled'
                          ? 'El programa de fidelidad no esta activo en este restaurante.'
                          : 'No encontramos puntos con ese numero. Consulta con tu mozo.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: Mi Pedido (Order Status) */}
      {/* ================================================================ */}
      {activeTab === 'orders' && (
        <div className="max-w-lg mx-auto px-4 py-4">
          {/* Refresh indicator */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800">Mis Pedidos</h2>
            <button
              onClick={fetchOrders}
              disabled={ordersLoading}
              className="flex items-center gap-1 text-xs text-gray-500 active:text-amber-600 py-1 px-2 rounded-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </button>
          </div>

          {ordersLoading && orders.length === 0 && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="mt-2 text-sm text-gray-500">{t('common.loading')}</p>
            </div>
          )}

          {ordersError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-sm text-red-600">{ordersError}</p>
            </div>
          )}

          {!ordersLoading && !ordersError && orders.length === 0 && (
            <div className="flex flex-col items-center py-12">
              <Receipt className="w-12 h-12 text-gray-300 mb-3" />
              <p className="font-semibold text-gray-700">No tienes pedidos activos</p>
              <p className="text-sm text-gray-500 mt-1">
                Tu pedido aparecera aqui cuando el mozo lo registre.
              </p>
            </div>
          )}

          {orders.map((order) => (
            <div key={order.order_number} className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
              {/* Order header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                <div>
                  <span className="text-sm font-bold text-gray-800">
                    Pedido #{order.order_number}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {getElapsedTime(order.created_at)}
                  </span>
                </div>
                <span className="text-sm font-bold text-amber-600">
                  {formatPrice(order.total_cents)}
                </span>
              </div>

              {/* Order items */}
              <div className="divide-y divide-gray-50">
                {order.items.map((item, idx) => {
                  const display = STATUS_DISPLAY[item.status] ?? STATUS_DISPLAY.PENDING;
                  return (
                    <div key={idx} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {item.qty}x {item.name}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {'\uD83D\uDCDD'} {item.notes}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                          {formatPrice(item.total_cents)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${display.color}`}>
                          {display.icon} {display.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {orders.length > 0 && (
            <p className="text-center text-xs text-gray-400 mt-2">
              Se actualiza automaticamente cada 15 segundos
            </p>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: Opinion (Feedback) */}
      {/* ================================================================ */}
      {activeTab === 'feedback' && (
        <div className="max-w-lg mx-auto px-4 py-4">
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-amber-500" />
            Deja tu opinion
          </h2>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
            {feedbackSent ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">{'\uD83D\uDE4F'}</p>
                <p className="font-semibold text-gray-800 text-lg">Gracias por tu opinion!</p>
                <p className="text-sm text-gray-500 mt-1">Tu mensaje nos ayuda a mejorar.</p>
                <button
                  onClick={() => setFeedbackSent(false)}
                  className="mt-4 text-sm text-amber-600 underline"
                >
                  Enviar otra opinion
                </button>
              </div>
            ) : (
              <>
                {/* Type selector */}
                <div className="flex gap-2">
                  {([
                    { value: 'ELOGIO', label: '\uD83D\uDC4D Elogio' },
                    { value: 'SUGERENCIA', label: '\uD83D\uDCA1 Sugerencia' },
                    { value: 'QUEJA', label: '\uD83D\uDE24 Queja' },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setFeedbackType(value)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        feedbackType === value
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-gray-50 text-gray-600 border-gray-200 active:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Star rating */}
                <div className="flex items-center gap-1 justify-center py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setFeedbackRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          star <= feedbackRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-sm text-gray-400 ml-2">{feedbackRating}/5</span>
                </div>

                {/* Message */}
                <textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="Cuentanos tu experiencia..."
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-3 text-sm border border-gray-200 rounded-xl resize-none outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
                />

                {/* Optional name */}
                <input
                  type="text"
                  value={feedbackName}
                  onChange={(e) => setFeedbackName(e.target.value)}
                  placeholder="Tu nombre (opcional)"
                  maxLength={100}
                  className="w-full px-3 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
                />

                <button
                  onClick={handleSendFeedback}
                  disabled={!feedbackMessage.trim() || sendingFeedback}
                  className="w-full py-3 bg-amber-500 active:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {sendingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {sendingFeedback ? 'Enviando...' : 'Enviar opinion'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Sticky Bottom Bar - Always visible */}
      {/* ================================================================ */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-gray-100">
        <div className="max-w-lg mx-auto p-3 space-y-2">
          {/* Cart bar — shown when cart has items */}
          {cart.length > 0 && (
            <button
              onClick={() => setShowCartPanel(true)}
              className="w-full py-3 px-4 rounded-xl bg-green-500 active:bg-green-600 text-white font-bold text-base flex items-center justify-between shadow-lg transition-all"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <span>{cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}</span>
              </span>
              <span>Ver Pedido · {formatPrice(cartTotal)}</span>
            </button>
          )}

          {/* Call Waiter + Request Check row */}
          <div className="flex gap-3">
            <button
              onClick={handleCallWaiter}
              disabled={callingWaiter || waiterCalled}
              className={`
                flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                ${waiterCalled
                  ? 'bg-green-500 text-white'
                  : callingWaiter
                    ? 'bg-gray-300 text-gray-500'
                    : 'bg-amber-500 active:bg-amber-600 text-white shadow-lg'
                }
              `}
            >
              {callingWaiter ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
              {waiterCalled ? 'Mozo notificado' : callingWaiter ? 'Llamando...' : 'Llamar Mozo'}
            </button>

            <button
              onClick={handleRequestCheck}
              disabled={requestingCheck || checkRequested}
              className={`
                flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                ${checkRequested
                  ? 'bg-green-500 text-white'
                  : requestingCheck
                    ? 'bg-gray-300 text-gray-500'
                    : 'bg-orange-500 active:bg-orange-600 text-white shadow-lg'
                }
              `}
            >
              {requestingCheck ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Receipt className="w-5 h-5" />
              )}
              {checkRequested
                ? 'Cuenta solicitada'
                : requestingCheck
                  ? 'Solicitando...'
                  : 'Pedir Cuenta'}
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Cart Slide-up Panel (overlay) */}
      {/* ================================================================ */}
      {showCartPanel && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCartPanel(false)}
          />

          {/* Panel */}
          <div
            ref={cartPanelRef}
            className="relative bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto"
            style={{ animation: 'slideUp 0.3s ease-out' }}
          >
            {/* Panel header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-900">Tu Pedido</h2>
              <button
                onClick={() => setShowCartPanel(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Cart items */}
            <div className="px-4 py-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product_id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                      <p className="text-amber-600 font-bold text-xs">
                        {formatPrice(item.price_cents * item.qty)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <button
                        onClick={() => updateCartQty(item.product_id, -1)}
                        className="w-7 h-7 rounded-full bg-gray-200 active:bg-gray-300 text-gray-700 flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-bold text-sm">{item.qty}</span>
                      <button
                        onClick={() => updateCartQty(item.product_id, 1)}
                        className="w-7 h-7 rounded-full bg-amber-500 active:bg-amber-600 text-white flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="w-7 h-7 rounded-full bg-red-100 active:bg-red-200 text-red-500 flex items-center justify-center transition-colors ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={item.notes ?? ''}
                    onChange={(e) => updateItemNotes(item.product_id, e.target.value)}
                    placeholder="Notas (sin sal, extra picante...)"
                    maxLength={500}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-amber-400 bg-white"
                  />
                </div>
              ))}
            </div>

            {/* Order notes & name */}
            <div className="px-4 pb-3 space-y-3">
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Notas adicionales para tu pedido..."
                rows={2}
                maxLength={1000}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none outline-none focus:border-amber-400"
              />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tu nombre (opcional)"
                maxLength={100}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400"
              />
            </div>

            {/* Order error */}
            {orderResult && !orderResult.success && (
              <div className="px-4 pb-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {orderResult.error}
                </div>
              </div>
            )}

            {/* Subtotal + Send */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600 font-medium">Subtotal</span>
                <span className="text-xl font-bold text-gray-900">{formatPrice(cartTotal)}</span>
              </div>
              <button
                onClick={handleSendOrder}
                disabled={sendingOrder || cart.length === 0}
                className="w-full py-3.5 bg-green-500 active:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                {sendingOrder ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {sendingOrder ? 'Enviando...' : 'Enviar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-up animation keyframes */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
