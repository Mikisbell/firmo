'use client';

/**
 * Admin Customers Page
 * Manages customer fiscal identity (RUC/DNI) for SUNAT invoicing.
 * Multi-tenant: tenant_id is derived server-side from JWT.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, User, Phone, Mail, FileText, ShoppingBag, X } from 'lucide-react';
import useSWR from 'swr';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  doc_type: string | null;
  doc_number: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  updated_at: string;
}

interface CustomerForm {
  phone: string;
  name: string;
  email: string;
  doc_type: string;
  doc_number: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatMoney(centavos: number): string {
  return `S/ ${(centavos / 100).toFixed(2)}`;
}

function getDocPlaceholder(docType: string): string {
  switch (docType) {
    case 'RUC':
      return '20XXXXXXXXX (11 dígitos)';
    case 'DNI':
      return 'XXXXXXXX (8 dígitos)';
    case 'CE':
      return 'Carnet de extranjería';
    case 'PASSPORT':
      return 'Número de pasaporte';
    default:
      return 'Número de documento';
  }
}

function getDocHint(docType: string): string | null {
  switch (docType) {
    case 'RUC':
      return 'Debe comenzar con 10 o 20 y tener 11 dígitos.';
    case 'DNI':
      return 'Debe tener exactamente 8 dígitos numéricos.';
    default:
      return null;
  }
}

const DOC_TYPE_LABELS: Record<string, string> = {
  RUC: 'RUC',
  DNI: 'DNI',
  CE: 'CE',
  PASSPORT: 'Pasaporte',
};

// ---------------------------------------------------------------------------
// CustomerModal
// ---------------------------------------------------------------------------

function CustomerModal({
  customer,
  onClose,
  onSave,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<CustomerForm>({
    phone: customer?.phone ?? '',
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    doc_type: customer?.doc_type ?? '',
    doc_number: customer?.doc_number ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = customer
        ? `/api/admin/customers/${customer.id}`
        : '/api/admin/customers';
      const method = customer ? 'PUT' : 'POST';

      const payload: Record<string, string | null> = {
        phone: form.phone.trim(),
        name: form.name.trim() || null,
        email: form.email.trim() || null,
        doc_type: form.doc_type || null,
        doc_number: form.doc_number.trim() || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Error al guardar');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const docHint = form.doc_type ? getDocHint(form.doc_type) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-md border border-zinc-800">
        {/* Modal header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Phone */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Teléfono <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-amber-500 focus:outline-none transition-colors"
              placeholder="999 999 999"
              required
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Nombre / Razón Social
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-amber-500 focus:outline-none transition-colors"
              placeholder="Juan Pérez o Empresa S.A.C."
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Email{' '}
              <span className="text-zinc-500 text-xs">(opcional)</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-amber-500 focus:outline-none transition-colors"
              placeholder="cliente@correo.com"
            />
          </div>

          {/* Document type */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Tipo de Documento
            </label>
            <select
              value={form.doc_type}
              onChange={(e) =>
                setForm({ ...form, doc_type: e.target.value, doc_number: '' })
              }
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-amber-500 focus:outline-none transition-colors"
            >
              <option value="">— Sin documento —</option>
              <option value="RUC">RUC</option>
              <option value="DNI">DNI</option>
              <option value="CE">CE (Carnet de extranjería)</option>
              <option value="PASSPORT">Pasaporte</option>
            </select>
          </div>

          {/* Document number */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Número de Documento
            </label>
            <input
              type="text"
              value={form.doc_number}
              onChange={(e) =>
                setForm({ ...form, doc_number: e.target.value })
              }
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-amber-500 focus:outline-none transition-colors disabled:opacity-40"
              placeholder={
                form.doc_type
                  ? getDocPlaceholder(form.doc_type)
                  : 'Seleccione tipo de documento primero'
              }
              disabled={!form.doc_type}
            />
            {docHint && (
              <p className="text-xs text-zinc-500 mt-1">{docHint}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ClientesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Debounce search input (300 ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams();
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data, error: swrError, isLoading, mutate } = useSWR(
    `/api/admin/customers?${params}`,
    fetcher
  );

  const customers: Customer[] = data?.items ?? [];
  const total: number = data?.total ?? customers.length;

  const handleEdit = useCallback((customer: Customer) => {
    setEditingCustomer(customer);
    setShowModal(true);
  }, []);

  const handleNew = useCallback(() => {
    setEditingCustomer(null);
    setShowModal(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
    setEditingCustomer(null);
  }, []);

  const handleModalSave = useCallback(() => {
    setShowModal(false);
    setEditingCustomer(null);
    mutate();
  }, [mutate]);

  const handleDelete = useCallback(
    async (customer: Customer) => {
      const displayName =
        customer.name || customer.phone || 'este cliente';
      if (
        !confirm(
          `¿Eliminar a ${displayName}? Esta acción no se puede deshacer.`
        )
      )
        return;

      try {
        const res = await fetch(`/api/admin/customers/${customer.id}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const body = await res.json();
          if (res.status === 409) {
            alert('Cliente tiene pedidos activos y no puede eliminarse.');
          } else {
            alert(body.error || 'Error al eliminar cliente');
          }
          return;
        }

        mutate();
      } catch {
        alert('Error de conexión al eliminar cliente');
      }
    },
    [mutate]
  );

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-zinc-400 mt-1">
            {isLoading ? (
              <span className="inline-block w-16 h-4 bg-zinc-700 rounded animate-pulse" />
            ) : (
              `${total} cliente${total !== 1 ? 's' : ''} registrado${total !== 1 ? 's' : ''}`
            )}
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Search bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o documento..."
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-amber-500 focus:outline-none transition-colors placeholder:text-zinc-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Error state                                                          */}
      {/* ------------------------------------------------------------------ */}
      {swrError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          Error al cargar clientes. Intente recargar la página.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Table                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Documento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Pedidos
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Total Gastado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Loading skeleton */}
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-800">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}

              {/* Empty state */}
              {!isLoading && customers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-16 text-center text-zinc-500"
                  >
                    <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    {debouncedSearch
                      ? `No se encontraron clientes para "${debouncedSearch}"`
                      : 'No hay clientes registrados'}
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!isLoading &&
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                  >
                    {/* Cliente: nombre + teléfono */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div>
                          <div className="font-medium text-white text-sm">
                            {customer.name || (
                              <span className="text-zinc-500 italic">
                                Sin nombre
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-zinc-400 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Documento */}
                    <td className="px-4 py-3">
                      {customer.doc_type && customer.doc_number ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-medium">
                            {DOC_TYPE_LABELS[customer.doc_type] ??
                              customer.doc_type}
                          </span>
                          <span className="text-sm text-zinc-300 font-mono">
                            {customer.doc_number}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-sm flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Sin documento
                        </span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      {customer.email ? (
                        <div className="flex items-center gap-1 text-sm text-zinc-300">
                          <Mail className="w-3 h-3 text-zinc-500" />
                          <span className="truncate max-w-[180px]">
                            {customer.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-sm">—</span>
                      )}
                    </td>

                    {/* Pedidos */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ShoppingBag className="w-3 h-3 text-zinc-500" />
                        <span className="text-sm text-zinc-300">
                          {customer.total_orders}
                        </span>
                      </div>
                    </td>

                    {/* Total gastado */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-medium ${
                          customer.total_spent > 0
                            ? 'text-amber-400'
                            : 'text-zinc-600'
                        }`}
                      >
                        {customer.total_spent > 0
                          ? formatMoney(customer.total_spent)
                          : '—'}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="p-2 rounded-lg hover:bg-zinc-700 transition-colors"
                          title="Editar cliente"
                        >
                          <Edit2 className="w-4 h-4 text-zinc-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(customer)}
                          className="p-2 rounded-lg hover:bg-zinc-700 transition-colors"
                          title="Eliminar cliente"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Modal                                                                */}
      {/* ------------------------------------------------------------------ */}
      {showModal && (
        <CustomerModal
          customer={editingCustomer}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
