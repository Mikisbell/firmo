'use client';

/**
 * Public Digital Menu Page - Customer-facing
 *
 * LIGHT theme (customer-facing, not admin dark theme).
 * Shows restaurant menu grouped by category with prices.
 * Includes "Call Waiter" button at the bottom.
 *
 * @module app/menu/[tenantSlug]/[tableId]/page
 */

import { useState, useEffect, use } from 'react';
import { Loader2, Bell, MapPin, UtensilsCrossed, MessageSquarePlus, ChevronDown, ChevronUp, Star } from 'lucide-react';

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

interface PageParams {
  tenantSlug: string;
  tableId: string;
}

export default function PublicMenuPage({ params }: { params: Promise<PageParams> }) {
  const { tenantSlug, tableId } = use(params);
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'QUEJA' | 'SUGERENCIA' | 'ELOGIO'>('ELOGIO');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    async function fetchMenu() {
      try {
        const res = await fetch(`/api/menu/${tenantSlug}/${tableId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? 'Menú no disponible');
          return;
        }
        const data: MenuData = await res.json();
        setMenuData(data);
        if (data.categories.length > 0) {
          setActiveCategory(data.categories[0].name);
        }
      } catch {
        setError('Error al cargar el menú');
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, [tenantSlug, tableId]);

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
      // silent fail — user can retry
    } finally {
      setSendingFeedback(false);
    }
  };

  const handleCallWaiter = async () => {
    if (callingWaiter || waiterCalled) return;
    setCallingWaiter(true);
    try {
      const res = await fetch(`/api/menu/${tenantSlug}/${tableId}/call-waiter`, {
        method: 'POST',
      });
      if (res.ok) {
        setWaiterCalled(true);
        setTimeout(() => setWaiterCalled(false), 120_000); // Reset after 2 min
      }
    } catch {
      // Silent fail for call waiter
    } finally {
      setCallingWaiter(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="mt-3 text-gray-500 text-sm">Cargando menú...</p>
      </div>
    );
  }

  if (error || !menuData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-6">
        <UtensilsCrossed className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Menú no disponible</h1>
        <p className="text-gray-500 text-sm text-center">{error ?? 'No se pudo cargar el menú'}</p>
      </div>
    );
  }

  const formatPrice = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
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

        {/* Category Tabs */}
        {menuData.categories.length > 1 && (
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

      {/* Products */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {menuData.categories
          .filter((cat) => !activeCategory || cat.name === activeCategory)
          .map((cat) => (
            <div key={cat.name} className="mb-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                {cat.name}
              </h2>
              <div className="space-y-2">
                {cat.products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm"
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
                    </div>
                    <span className="text-amber-600 font-bold text-sm whitespace-nowrap">
                      {formatPrice(product.priceCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Feedback Section */}
      <div className="max-w-lg mx-auto px-4 pb-4">
        <button
          onClick={() => { setShowFeedback(!showFeedback); setFeedbackSent(false); }}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm text-gray-700 font-medium text-sm"
        >
          <span className="flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-amber-500" />
            Deja tu opinión
          </span>
          {showFeedback ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showFeedback && (
          <div className="mt-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
            {feedbackSent ? (
              <div className="text-center py-4">
                <p className="text-2xl mb-2">🙏</p>
                <p className="font-semibold text-gray-800">¡Gracias por tu opinión!</p>
                <p className="text-sm text-gray-500 mt-1">Tu mensaje nos ayuda a mejorar.</p>
                <button
                  onClick={() => setFeedbackSent(false)}
                  className="mt-3 text-xs text-amber-600 underline"
                >
                  Enviar otra opinión
                </button>
              </div>
            ) : (
              <>
                {/* Type selector */}
                <div className="flex gap-2">
                  {([
                    { value: 'ELOGIO', label: '👍 Elogio' },
                    { value: 'SUGERENCIA', label: '💡 Sugerencia' },
                    { value: 'QUEJA', label: '😤 Queja' },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setFeedbackType(value)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        feedbackType === value
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Star rating */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setFeedbackRating(star)}>
                      <Star
                        className={`w-6 h-6 transition-colors ${
                          star <= feedbackRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-gray-400 ml-1">{feedbackRating}/5</span>
                </div>

                {/* Message */}
                <textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="Cuéntanos tu experiencia..."
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none outline-none focus:border-amber-400"
                />

                {/* Optional name */}
                <input
                  type="text"
                  value={feedbackName}
                  onChange={(e) => setFeedbackName(e.target.value)}
                  placeholder="Tu nombre (opcional)"
                  maxLength={100}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-amber-400"
                />

                <button
                  onClick={handleSendFeedback}
                  disabled={!feedbackMessage.trim() || sendingFeedback}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {sendingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {sendingFeedback ? 'Enviando...' : 'Enviar opinión'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Call Waiter Button - Sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm border-t border-gray-100">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleCallWaiter}
            disabled={callingWaiter || waiterCalled}
            className={`
              w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all
              ${waiterCalled
                ? 'bg-green-500 text-white'
                : callingWaiter
                  ? 'bg-gray-300 text-gray-500'
                  : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-lg'
              }
            `}
          >
            {callingWaiter ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
            {waiterCalled
              ? 'Mozo notificado'
              : callingWaiter
                ? 'Llamando...'
                : 'Llamar al Mozo'}
          </button>
        </div>
      </div>
    </div>
  );
}
