'use client';

/**
 * Admin Customers Page
 * Manages customer fiscal identity (RUC/DNI) for SUNAT invoicing.
 * Multi-tenant: tenant_id is derived server-side from JWT.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, User, Phone, Mail, FileText, ShoppingBag, X } from 'lucide-react';
import useSWR from 'swr';
import { Button, Badge, Card, PageHeader, EmptyState, Modal } from '@/src/components/ui';

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
    <Modal
      open={true}
      onClose={onClose}
      title={customer ? 'Editar Cliente' : 'Nuevo Cliente'}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="customer-form"
            disabled={saving}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
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

      </form>
    </Modal>
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
      <PageHeader
        title="Clientes"
        description={isLoading ? 'Cargando...' : `${total} cliente${total !== 1 ? 's' : ''} registrado${total !== 1 ? 's' : ''}`}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={handleNew}
          >
            Nuevo Cliente
          </Button>
        }
      />

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
      <Card padding="none">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && customers.length === 0 && (
          <EmptyState
            icon={<User />}
            title={debouncedSearch
              ? `No se encontraron clientes para "${debouncedSearch}"`
              : 'No hay clientes registrados'}
            description="Agrega tu primer cliente para gestionar datos fiscales y fidelización"
            action={!debouncedSearch ? { label: 'Nuevo Cliente', onClick: handleNew } : undefined}
          />
        )}

        {/* Data rows */}
        {!isLoading && customers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Documento</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Email</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Pedidos</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Total Gastado</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors"
                  >
                    {/* Cliente: nombre + teléfono */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-park-gray-800 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-park-gray-400" />
                        </div>
                        <div>
                          <div className="font-medium text-white text-sm">
                            {customer.name || (
                              <span className="text-park-gray-600 italic">
                                Sin nombre
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-park-gray-400 mt-0.5">
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
                          <Badge variant="info">
                            {DOC_TYPE_LABELS[customer.doc_type] ?? customer.doc_type}
                          </Badge>
                          <span className="text-sm text-park-gray-300 font-mono">
                            {customer.doc_number}
                          </span>
                        </div>
                      ) : (
                        <span className="text-park-gray-600 text-sm flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Sin documento
                        </span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      {customer.email ? (
                        <div className="flex items-center gap-1 text-sm text-park-gray-300">
                          <Mail className="w-3 h-3 text-park-gray-500" />
                          <span className="truncate max-w-[180px]">
                            {customer.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-park-gray-600 text-sm">—</span>
                      )}
                    </td>

                    {/* Pedidos */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ShoppingBag className="w-3 h-3 text-park-gray-500" />
                        <span className="text-sm text-park-gray-300">
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
                            : 'text-park-gray-600'
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                          icon={<Edit2 className="w-4 h-4" />}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(customer)}
                          icon={<Trash2 className="w-4 h-4" />}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
