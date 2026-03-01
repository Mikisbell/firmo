'use client';

/**
 * Public Reservation Page — Mobile-first customer-facing form
 *
 * Steps:
 * 1. Select date + party size
 * 2. Pick available time slot
 * 3. Fill customer name + phone + optional notes
 * 4. Confirmation screen with code
 *
 * Light theme (customer-facing, NOT admin dark theme).
 * All text in Spanish.
 *
 * Fetches from:
 * - GET /api/reservations/[tenantSlug]?date=X&party_size=Y (slots)
 * - POST /api/reservations/[tenantSlug] (create)
 * - GET /api/reservations/[tenantSlug]/[code] (lookup)
 *
 * @module app/reservar/[tenantSlug]/page
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  CalendarDays,
  Users,
  Clock,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  Phone,
  User,
  MessageSquare,
  AlertCircle,
  Copy,
  Loader2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface AvailabilitySlot {
  time: string;
  available: boolean;
}

interface ReservationResult {
  confirmation_code: string;
  status: string;
  date: string;
  time: string;
  party_size: number;
  restaurant_name: string;
}

interface LookupResult {
  confirmation_code: string;
  status: string;
  date: string;
  time: string;
  party_size: number;
  customer_name: string;
  special_requests: string | null;
  restaurant_name: string;
}

type Step = 'date-size' | 'time-slot' | 'details' | 'confirmation';

// ============================================================================
// Helpers
// ============================================================================

/** Format date as "Lun 3 Mar" */
function formatDateShort(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

/** Format date as "Viernes, 3 de Marzo 2026" */
function formatDateLong(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/** Get today's date as YYYY-MM-DD */
function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Get a date N days from today as YYYY-MM-DD */
function getDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Build array of next N dates starting from tomorrow */
function buildDateOptions(count: number): string[] {
  const dates: string[] = [];
  for (let i = 1; i <= count; i++) {
    dates.push(getDateOffset(i));
  }
  return dates;
}

/** Status label map */
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  ARRIVED: 'Llegada',
  SEATED: 'Sentada',
  NO_SHOW: 'No se presento',
  COMPLETED: 'Completada',
};

/** Status color class map */
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  ARRIVED: 'bg-blue-100 text-blue-800',
  SEATED: 'bg-emerald-100 text-emerald-800',
  NO_SHOW: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
};

// ============================================================================
// Main Component
// ============================================================================

export default function ReservarPage() {
  const params = useParams();
  const tenantSlug = params.tenantSlug as string;

  // Steps state
  const [step, setStep] = useState<Step>('date-size');
  const [restaurantName, setRestaurantName] = useState<string>('');

  // Form state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [partySize, setPartySize] = useState<number>(2);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  // Data state
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReservationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lookup mode
  const [showLookup, setShowLookup] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Tenant not found
  const [tenantNotFound, setTenantNotFound] = useState(false);

  // Date options (next 14 days)
  const dateOptions = buildDateOptions(14);

  // ── Fetch available slots ──
  useEffect(() => {
    if (!selectedDate || partySize < 1) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      setError(null);
      setSlots([]);

      try {
        const res = await fetch(
          `/api/reservations/${tenantSlug}?date=${selectedDate}&party_size=${partySize}`,
        );

        if (res.status === 404) {
          setTenantNotFound(true);
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Error al consultar disponibilidad');
          return;
        }

        if (data.success && data.data) {
          setSlots(data.data.slots || []);
          if (data.data.restaurant_name) {
            setRestaurantName(data.data.restaurant_name);
          }
        }
      } catch {
        setError('Error de conexion. Intente de nuevo.');
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, partySize, tenantSlug]);

  // ── Submit reservation ──
  const handleSubmit = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Por favor complete todos los campos requeridos');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${tenantSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          date: selectedDate,
          time: selectedTime,
          party_size: partySize,
          special_requests: specialRequests.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          const messages = data.details.map((d: { message: string }) => d.message).join('. ');
          setError(messages || data.error);
        } else {
          setError(data.error || 'Error al crear la reserva');
        }
        return;
      }

      if (data.success && data.data) {
        setResult(data.data);
        setStep('confirmation');
      }
    } catch {
      setError('Error de conexion. Intente de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Lookup reservation ──
  const handleLookup = async () => {
    if (!lookupCode.trim()) return;

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const res = await fetch(
        `/api/reservations/${tenantSlug}/${lookupCode.trim().toUpperCase()}`,
      );

      const data = await res.json();

      if (!res.ok) {
        setLookupError(data.error || 'Reserva no encontrada');
        return;
      }

      if (data.success && data.data) {
        setLookupResult(data.data);
      }
    } catch {
      setLookupError('Error de conexion. Intente de nuevo.');
    } finally {
      setLookupLoading(false);
    }
  };

  // ── Copy code to clipboard ──
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // fallback: do nothing, user can manually copy
    }
  };

  // ── Tenant not found ──
  if (tenantNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Restaurante no encontrado</h1>
          <p className="text-gray-500">
            El enlace que seguiste no corresponde a un restaurante registrado.
          </p>
        </div>
      </div>
    );
  }

  // ── Lookup mode ──
  if (showLookup) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => { setShowLookup(false); setLookupResult(null); setLookupError(null); setLookupCode(''); }}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Volver"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Consultar reserva</h1>
              {restaurantName && (
                <p className="text-sm text-gray-500">{restaurantName}</p>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Search */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Codigo de confirmacion
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                placeholder="Ej: R4K7M2"
                maxLength={6}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-center text-lg font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
              />
              <button
                onClick={handleLookup}
                disabled={lookupLoading || lookupCode.trim().length < 3}
                className={cn(
                  'px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2',
                  lookupLoading || lookupCode.trim().length < 3
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
                )}
              >
                {lookupLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Lookup Error */}
          {lookupError && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{lookupError}</p>
            </div>
          )}

          {/* Lookup Result */}
          {lookupResult && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Tu reserva</h2>
                <span className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  STATUS_COLORS[lookupResult.status] || 'bg-gray-100 text-gray-800',
                )}>
                  {STATUS_LABELS[lookupResult.status] || lookupResult.status}
                </span>
              </div>

              <div className="space-y-3">
                <InfoRow icon={CalendarDays} label="Fecha" value={formatDateLong(lookupResult.date)} />
                <InfoRow icon={Clock} label="Hora" value={lookupResult.time} />
                <InfoRow icon={Users} label="Personas" value={`${lookupResult.party_size}`} />
                <InfoRow icon={User} label="Nombre" value={lookupResult.customer_name} />
                {lookupResult.special_requests && (
                  <InfoRow icon={MessageSquare} label="Notas" value={lookupResult.special_requests} />
                )}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Codigo</span>
                <span className="font-mono text-sm font-bold text-gray-700 tracking-wider">
                  {lookupResult.confirmation_code}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main reservation flow ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step !== 'date-size' && step !== 'confirmation' && (
                <button
                  onClick={() => {
                    if (step === 'time-slot') setStep('date-size');
                    if (step === 'details') setStep('time-slot');
                  }}
                  className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Volver"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700" />
                </button>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
                  <h1 className="text-lg font-bold text-gray-900">
                    {restaurantName || 'Reservar mesa'}
                  </h1>
                </div>
                {step !== 'confirmation' && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {step === 'date-size' && 'Paso 1 de 3 — Fecha y personas'}
                    {step === 'time-slot' && 'Paso 2 de 3 — Selecciona horario'}
                    {step === 'details' && 'Paso 3 de 3 — Tus datos'}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowLookup(true)}
              className="text-sm text-emerald-600 font-medium hover:text-emerald-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-emerald-50"
            >
              Consultar
            </button>
          </div>

          {/* Step progress bar */}
          {step !== 'confirmation' && (
            <div className="flex gap-1.5 mt-3">
              {['date-size', 'time-slot', 'details'].map((s, i) => (
                <div
                  key={s}
                  className={cn(
                    'h-1 rounded-full flex-1 transition-colors',
                    i <= ['date-size', 'time-slot', 'details'].indexOf(step)
                      ? 'bg-emerald-500'
                      : 'bg-gray-200',
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Error banner */}
        {error && step !== 'confirmation' && (
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100 mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-1 rounded hover:bg-red-100">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}

        {/* ───────── Step 1: Date + Party Size ───────── */}
        {step === 'date-size' && (
          <div className="space-y-6">
            {/* Party size selector */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <Users className="w-4 h-4 text-emerald-600" />
                Cantidad de personas
              </label>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setPartySize(Math.max(1, partySize - 1))}
                  disabled={partySize <= 1}
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-colors',
                    partySize <= 1
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:bg-emerald-300',
                  )}
                  aria-label="Menos personas"
                >
                  -
                </button>
                <div className="text-center min-w-[60px]">
                  <span className="text-3xl font-bold text-gray-900">{partySize}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{partySize === 1 ? 'persona' : 'personas'}</p>
                </div>
                <button
                  onClick={() => setPartySize(Math.min(20, partySize + 1))}
                  disabled={partySize >= 20}
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-colors',
                    partySize >= 20
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:bg-emerald-300',
                  )}
                  aria-label="Mas personas"
                >
                  +
                </button>
              </div>
            </div>

            {/* Date selector */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                Fecha de reserva
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {dateOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setSelectedDate(d); setSelectedTime(''); }}
                    className={cn(
                      'px-3 py-3 rounded-lg text-center transition-all border',
                      selectedDate === d
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50',
                    )}
                  >
                    <span className="block text-xs font-medium">
                      {formatDateShort(d)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Continue button */}
            <button
              onClick={() => setStep('time-slot')}
              disabled={!selectedDate}
              className={cn(
                'w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-colors',
                selectedDate
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed',
              )}
            >
              Siguiente
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ───────── Step 2: Time Slot ───────── */}
        {step === 'time-slot' && (
          <div className="space-y-6">
            {/* Selection summary */}
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <CalendarDays className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span className="text-sm text-emerald-800 font-medium">
                {formatDateLong(selectedDate)} — {partySize} {partySize === 1 ? 'persona' : 'personas'}
              </span>
            </div>

            {/* Slots */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
                <Clock className="w-4 h-4 text-emerald-600" />
                Horarios disponibles
              </label>

              {loadingSlots ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                  <span className="ml-3 text-sm text-gray-500">Consultando disponibilidad...</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    No hay horarios disponibles para esta fecha y cantidad de personas.
                  </p>
                  <button
                    onClick={() => setStep('date-size')}
                    className="mt-4 text-sm text-emerald-600 font-medium hover:underline"
                  >
                    Elegir otra fecha
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={cn(
                        'py-3 rounded-lg text-center transition-all border text-sm font-medium',
                        !slot.available
                          ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                          : selectedTime === slot.time
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50',
                      )}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Continue button */}
            <button
              onClick={() => setStep('details')}
              disabled={!selectedTime}
              className={cn(
                'w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-colors',
                selectedTime
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed',
              )}
            >
              Siguiente
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ───────── Step 3: Details ───────── */}
        {step === 'details' && (
          <div className="space-y-6">
            {/* Selection summary */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="flex items-center gap-1.5 text-sm text-emerald-800">
                <CalendarDays className="w-4 h-4" />
                {formatDateShort(selectedDate)}
              </span>
              <span className="text-emerald-300">|</span>
              <span className="flex items-center gap-1.5 text-sm text-emerald-800">
                <Clock className="w-4 h-4" />
                {selectedTime}
              </span>
              <span className="text-emerald-300">|</span>
              <span className="flex items-center gap-1.5 text-sm text-emerald-800">
                <Users className="w-4 h-4" />
                {partySize}
              </span>
            </div>

            {/* Form */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
              {/* Name */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                  <User className="w-4 h-4 text-emerald-600" />
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Maria Lopez"
                  maxLength={100}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  Telefono *
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="987654321"
                  maxLength={20}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Special requests */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Notas especiales <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Ej: Mesa cerca de la ventana, cumpleanos, silla para bebe..."
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !customerName.trim() || !customerPhone.trim()}
              className={cn(
                'w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-colors',
                submitting || !customerName.trim() || !customerPhone.trim()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-200',
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Reservando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Confirmar reserva
                </>
              )}
            </button>
          </div>
        )}

        {/* ───────── Step 4: Confirmation ───────── */}
        {step === 'confirmation' && result && (
          <div className="space-y-6">
            {/* Success icon */}
            <div className="text-center pt-4">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Reserva registrada
              </h2>
              <p className="text-gray-500 text-sm">
                Tu reserva ha sido registrada exitosamente
              </p>
            </div>

            {/* Confirmation code */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
              <p className="text-sm text-gray-500 mb-2">Codigo de confirmacion</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-mono font-bold text-emerald-700 tracking-[0.2em]">
                  {result.confirmation_code}
                </span>
                <button
                  onClick={() => copyCode(result.confirmation_code)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Copiar codigo"
                >
                  <Copy className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Guarda este codigo para consultar o cancelar tu reserva
              </p>
            </div>

            {/* Details */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-3">
              {restaurantName && (
                <InfoRow icon={UtensilsCrossed} label="Restaurante" value={restaurantName} />
              )}
              <InfoRow icon={CalendarDays} label="Fecha" value={formatDateLong(result.date)} />
              <InfoRow icon={Clock} label="Hora" value={result.time} />
              <InfoRow icon={Users} label="Personas" value={`${result.party_size}`} />
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-sm text-gray-600">
                    Estado: <strong className="text-yellow-600">Pendiente de confirmacion</strong>
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-4">
                  El restaurante confirmara tu reserva pronto
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => { setShowLookup(true); setLookupCode(result.confirmation_code); }}
                className="w-full py-3 rounded-xl font-medium text-sm bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                Consultar estado de reserva
              </button>
              <button
                onClick={() => {
                  setStep('date-size');
                  setSelectedDate('');
                  setSelectedTime('');
                  setCustomerName('');
                  setCustomerPhone('');
                  setSpecialRequests('');
                  setResult(null);
                  setError(null);
                }}
                className="w-full py-3 rounded-xl font-medium text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Hacer otra reserva
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {step !== 'confirmation' && (
        <footer className="max-w-lg mx-auto px-4 py-6 text-center">
          <p className="text-xs text-gray-400">
            Al reservar aceptas las politicas del restaurante.
            <br />
            La reserva se mantiene por 15 minutos despues de la hora.
          </p>
        </footer>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-900 font-medium">{value}</p>
      </div>
    </div>
  );
}
