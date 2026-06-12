'use client';

/**
 * Unified Employee Profile Page — 8 Tabs
 * Following 7shifts model: ONE profile page with ALL employee information.
 *
 * Tabs: General | Empleo | Salario | Delivery | Horarios | Asistencia | Evaluaciones | Documentos
 */

import { use, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  User, Briefcase, DollarSign, Truck, Clock, CalendarCheck,
  Star, FileText, Pencil, Shield, KeyRound, CreditCard,
  UserCheck, AlertTriangle, Calendar, X,
  Check,
} from 'lucide-react';
import {
  Button, Badge, Card, PageHeader, Breadcrumbs, Tabs, TabsContent,
  MetricCard, EmptyState, Alert, Progress, Avatar, Input, Select,
  DatePicker, RadioGroup, Checkbox, FileUpload, FormField,
} from '@/src/components/ui';
import { useQueryState } from '@/src/hooks';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Propietario' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'SUPERVISOR', label: 'Supervisor(a)' },
  { value: 'CASHIER', label: 'Cajero(a)' },
  { value: 'WAITER', label: 'Mozo(a)' },
  { value: 'KITCHEN', label: 'Cocina' },
  { value: 'COOK', label: 'Cocinero(a)' },
  { value: 'PACKER', label: 'Empaquetador(a)' },
  { value: 'BAR', label: 'Barman' },
  { value: 'DRIVER', label: 'Motorizado(a)' },
] as const;

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label]),
);

const CONTRACT_OPTIONS = [
  { value: 'INDEFINIDO', label: 'Indefinido' },
  { value: 'PLAZO_FIJO', label: 'Plazo Fijo' },
  { value: 'PART_TIME', label: 'Part Time' },
];

const SCHEDULE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Tiempo Completo' },
  { value: 'PART_TIME', label: 'Medio Tiempo' },
  { value: 'ROTATING', label: 'Rotativo' },
];

const PENSION_OPTIONS = [
  { value: 'ONP', label: 'ONP' },
  { value: 'AFP_INTEGRA', label: 'AFP Integra' },
  { value: 'AFP_PRIMA', label: 'AFP Prima' },
  { value: 'AFP_PROFUTURO', label: 'AFP Profuturo' },
  { value: 'AFP_HABITAT', label: 'AFP Habitat' },
];

type TabValue =
  | 'general'
  | 'empleo'
  | 'salario'
  | 'delivery'
  | 'horarios'
  | 'asistencia'
  | 'evaluaciones'
  | 'documentos';

const TAB_ITEMS: Array<{ value: TabValue; label: string; icon: React.ReactNode }> = [
  { value: 'general', label: 'General', icon: <User size={16} /> },
  { value: 'empleo', label: 'Empleo', icon: <Briefcase size={16} /> },
  { value: 'salario', label: 'Salario', icon: <DollarSign size={16} /> },
  { value: 'delivery', label: 'Delivery', icon: <Truck size={16} /> },
  { value: 'horarios', label: 'Horarios', icon: <Clock size={16} /> },
  { value: 'asistencia', label: 'Asistencia', icon: <CalendarCheck size={16} /> },
  { value: 'evaluaciones', label: 'Evaluaciones', icon: <Star size={16} /> },
  { value: 'documentos', label: 'Documentos', icon: <FileText size={16} /> },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeProfile {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  dni: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  birth_date: string | null;
  position: string | null;
  base_salary_cents: number;
  contract_type: string;
  work_schedule_type: string;
  hire_date: string | null;
  commission_rate: number | null;
  pension_system: string | null;
  has_health_insurance: boolean;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;
  drivers: Array<{
    id: string;
    name: string;
    phone: string | null;
    is_active: boolean;
    vehicle_info: string | null;
  }>;
}

interface AttendanceRecord {
  id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  worked_minutes: number;
  overtime_minutes: number;
  late_minutes: number;
  status: string;
}

interface PayrollRecord {
  id: string;
  period_month: string;
  base_salary_cents: number;
  gross_salary_cents: number;
  net_salary_cents: number;
  essalud_cents: number;
  pension_cents: number;
  commission_cents: number;
  advances_cents: number;
}

interface Evaluation {
  id: string;
  period_start: string;
  period_end: string;
  scores: Record<string, number>;
  comments: string | null;
  status: string;
  created_at: string;
}

interface EmployeeDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

interface Training {
  id: string;
  training_type: string;
  title: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

interface DeliveryStats {
  total: number;
  delivered: number;
  failed: number;
  avgTimeMins: number | null;
}

interface DeliveryOrder {
  id: string;
  order_id: string;
  address_text: string;
  status: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error('Error al cargar datos');
    return r.json();
  });

const listFetcher = (url: string) =>
  fetch(url, { credentials: 'include' })
    .then((r) => r.json())
    .then((d) => d.data ?? d.items ?? d);

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '--:--';
  return new Date(dateStr).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMinutes(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-park-gray-800 last:border-0">
      <span className="text-park-gray-500 text-sm w-40 shrink-0">{label}</span>
      <span className="text-white text-sm">{value ?? '—'}</span>
    </div>
  );
}

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'critical' | 'info' | 'neutral'; label: string }> = {
  PRESENT: { variant: 'success', label: 'Presente' },
  ABSENT: { variant: 'critical', label: 'Ausente' },
  LATE: { variant: 'warning', label: 'Tardanza' },
  JUSTIFIED: { variant: 'info', label: 'Justificado' },
  COMPLETED: { variant: 'success', label: 'Completado' },
  IN_PROGRESS: { variant: 'info', label: 'En curso' },
  PENDING: { variant: 'warning', label: 'Pendiente' },
  DRAFT: { variant: 'neutral', label: 'Borrador' },
};

// ─── Tab: General ─────────────────────────────────────────────────────────────

function GeneralTab({
  employee,
  onSaved,
}: {
  employee: EmployeeProfile;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: employee.name,
    dni: employee.dni ?? '',
    email: employee.email ?? '',
    phone: employee.phone ?? '',
    address: employee.address ?? '',
    birth_date: employee.birth_date?.slice(0, 10) ?? '',
    emergency_contact_name: employee.emergency_contact_name ?? '',
    emergency_contact_phone: employee.emergency_contact_phone ?? '',
  });
  const [newPin, setNewPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(employee.photo_url);

  const handlePhotoUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    // TODO: POST /api/admin/employees/[id]/photo
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!payload.dni) payload.dni = null;
      if (!payload.email) payload.email = null;
      if (!payload.phone) payload.phone = null;
      if (!payload.address) payload.address = null;
      if (!payload.birth_date) payload.birth_date = null;
      if (!payload.emergency_contact_name) payload.emergency_contact_name = null;
      if (!payload.emergency_contact_phone) payload.emergency_contact_phone = null;
      if (newPin) payload.pin = newPin;

      const res = await fetch(`/api/admin/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al actualizar');
      }
      toast.success('Datos personales actualizados');
      setNewPin('');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <FileUpload
        label="Foto de perfil"
        accept="image/*"
        maxSize={5 * 1024 * 1024}
        preview={photoPreview}
        onUpload={handlePhotoUpload}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Nombre completo"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder="Ej: Juan Perez"
        />
        <FormField label="DNI" hint="8 digitos">
          <Input
            type="text"
            inputMode="numeric"
            value={form.dni}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 8);
              setForm({ ...form, dni: val });
            }}
            leftIcon={<CreditCard className="h-4 w-4" />}
            className="font-mono tracking-widest"
            placeholder="12345678"
            maxLength={8}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="juan@correo.com"
        />
        <Input
          label="Telefono"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="999 888 777"
        />
      </div>

      <Input
        label="Direccion"
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
        placeholder="Av. Principal 123, Lima"
      />

      <DatePicker
        label="Fecha de nacimiento"
        value={form.birth_date}
        onChange={(val) => setForm({ ...form, birth_date: val })}
        max={new Date().toISOString().slice(0, 10)}
      />

      {/* Emergency contact */}
      <div className="border-t border-park-gray-800 pt-4">
        <h3 className="text-sm font-medium text-park-gray-400 mb-4">Contacto de emergencia</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nombre"
            value={form.emergency_contact_name}
            onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
            placeholder="Nombre del contacto"
          />
          <Input
            label="Telefono"
            type="tel"
            value={form.emergency_contact_phone}
            onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
            placeholder="999 888 777"
          />
        </div>
      </div>

      {/* PIN */}
      <div className="border-t border-park-gray-800 pt-4">
        <FormField label="Cambiar PIN de acceso" hint="4-6 digitos. Dejar vacio para no cambiar.">
          <Input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setNewPin(val);
            }}
            leftIcon={<KeyRound className="h-4 w-4" />}
            placeholder="****"
            autoComplete="off"
          />
        </FormField>
      </div>

      <Button type="submit" variant="primary" loading={saving} className="w-full sm:w-auto">
        {saving ? 'Guardando...' : 'Guardar Datos Personales'}
      </Button>
    </form>
  );
}

// ─── Tab: Empleo ──────────────────────────────────────────────────────────────

function EmpleoTab({
  employee,
  onSaved,
}: {
  employee: EmployeeProfile;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    role: employee.role,
    is_active: employee.is_active,
    contract_type: employee.contract_type ?? 'INDEFINIDO',
    hire_date: employee.hire_date?.slice(0, 10) ?? '',
    position: employee.position ?? '',
    work_schedule_type: employee.work_schedule_type ?? 'FULL_TIME',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al actualizar');
      }
      toast.success('Datos de empleo actualizados');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={form.is_active ? 'success' : 'neutral'} dot>
          {form.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      <Select
        label="Rol"
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
        options={[...ROLE_OPTIONS]}
        required
      />

      <Input
        label="Posicion / Cargo"
        value={form.position}
        onChange={(e) => setForm({ ...form, position: e.target.value })}
        placeholder="Ej: Jefe de cocina"
      />

      <Select
        label="Tipo de contrato"
        value={form.contract_type}
        onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
        options={CONTRACT_OPTIONS}
      />

      <DatePicker
        label="Fecha de ingreso"
        value={form.hire_date}
        onChange={(val) => setForm({ ...form, hire_date: val })}
      />

      <Select
        label="Tipo de horario"
        value={form.work_schedule_type}
        onChange={(e) => setForm({ ...form, work_schedule_type: e.target.value })}
        options={SCHEDULE_OPTIONS}
      />

      <div className="p-4 bg-park-gray-800/50 rounded-lg">
        <Checkbox
          label="Empleado activo (puede iniciar sesion)"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: (e.target as HTMLInputElement).checked })}
        />
      </div>

      <Button type="submit" variant="primary" loading={saving} className="w-full sm:w-auto">
        {saving ? 'Guardando...' : 'Guardar Datos de Empleo'}
      </Button>
    </form>
  );
}

// ─── Tab: Salario ─────────────────────────────────────────────────────────────

function SalarioTab({
  employee,
  onSaved,
}: {
  employee: EmployeeProfile;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    base_salary_cents: employee.base_salary_cents,
    commission_rate: employee.commission_rate ?? 0,
    pension_system: employee.pension_system ?? 'ONP',
    has_health_insurance: employee.has_health_insurance,
  });
  const [saving, setSaving] = useState(false);

  // Lazy load payroll records
  const { data: payrollRecords } = useSWR<PayrollRecord[]>(
    `/api/hr/payroll/employee/${employee.id}?limit=3`,
    listFetcher,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al actualizar');
      }
      toast.success('Datos salariales actualizados');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormField label="Sueldo base" hint="Ingrese el monto en soles">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-park-gray-500 text-sm">S/</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={(form.base_salary_cents / 100).toFixed(2)}
              onChange={(e) =>
                setForm({ ...form, base_salary_cents: Math.round(parseFloat(e.target.value || '0') * 100) })
              }
              className="pl-10"
              placeholder="0.00"
            />
          </div>
        </FormField>

        <Input
          label="Comision %"
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={String(form.commission_rate * 100)}
          onChange={(e) =>
            setForm({ ...form, commission_rate: parseFloat(e.target.value || '0') / 100 })
          }
          hint="Porcentaje de comision sobre ventas"
        />

        <RadioGroup
          name="pension_system"
          label="Sistema de pension"
          value={form.pension_system}
          onChange={(val) => setForm({ ...form, pension_system: val })}
          options={PENSION_OPTIONS}
        />

        <div className="p-4 bg-park-gray-800/50 rounded-lg">
          <Checkbox
            label="EsSalud"
            description="El empleado cuenta con seguro EsSalud"
            checked={form.has_health_insurance}
            onChange={(e) => setForm({ ...form, has_health_insurance: (e.target as HTMLInputElement).checked })}
          />
        </div>

        <Button type="submit" variant="primary" loading={saving} className="w-full sm:w-auto">
          {saving ? 'Guardando...' : 'Guardar Datos Salariales'}
        </Button>
      </form>

      {/* Last 3 payroll records */}
      <div className="border-t border-park-gray-800 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-park-gray-400">Ultimas planillas</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = `/admin/hr/payroll?employee=${employee.id}`}
          >
            Ver planilla completa
          </Button>
        </div>
        {!payrollRecords || payrollRecords.length === 0 ? (
          <p className="text-sm text-park-gray-500">Sin registros de planilla</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-3 py-2 text-left text-park-gray-400 font-medium">Periodo</th>
                  <th className="px-3 py-2 text-right text-park-gray-400 font-medium">Bruto</th>
                  <th className="px-3 py-2 text-right text-park-gray-400 font-medium">Descuentos</th>
                  <th className="px-3 py-2 text-right text-park-gray-400 font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {payrollRecords.map((r) => (
                  <tr key={r.id} className="border-b border-park-gray-800/50">
                    <td className="px-3 py-2 text-white">{r.period_month}</td>
                    <td className="px-3 py-2 text-right text-park-gray-300">{formatCurrency(r.gross_salary_cents)}</td>
                    <td className="px-3 py-2 text-right text-orange-400">
                      {formatCurrency(r.essalud_cents + r.pension_cents + r.advances_cents)}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-400 font-medium">{formatCurrency(r.net_salary_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Delivery ────────────────────────────────────────────────────────────

function DeliveryTab({
  employee,
  onRefresh,
}: {
  employee: EmployeeProfile;
  onRefresh: () => void;
}) {
  const linkedDriver = employee.drivers?.[0] ?? null;

  const { data: stats } = useSWR<DeliveryStats>(
    linkedDriver ? `/api/delivery/stats/driver/${linkedDriver.id}` : null,
    fetcher,
  );

  const { data: recentDeliveries } = useSWR<DeliveryOrder[]>(
    linkedDriver ? `/api/delivery/driver/${linkedDriver.id}/orders?limit=5` : null,
    listFetcher,
  );

  const [creating, setCreating] = useState(false);

  const handleCreateDriverProfile = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: employee.name,
          phone: employee.phone,
          employee_id: employee.id,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al crear perfil');
      }
      toast.success('Perfil de motorizado creado');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setCreating(false);
    }
  };

  // Only show for DRIVER role or if already linked
  if (!linkedDriver && employee.role !== 'DRIVER') {
    return (
      <Alert
        variant="info"
        title="No aplicable"
        description="Esta seccion solo esta disponible para empleados con rol de Motorizado."
      />
    );
  }

  if (!linkedDriver) {
    return (
      <div className="space-y-4">
        <Alert
          variant="info"
          title="Sin perfil de delivery"
          description="Este empleado no tiene un perfil de motorizado asignado."
          action={
            <Button
              variant="primary"
              size="sm"
              icon={<Truck size={16} />}
              onClick={handleCreateDriverProfile}
              loading={creating}
            >
              Crear perfil de motorizado
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-park-gray-800/50 rounded-lg border border-park-gray-800">
        <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
          <Truck className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium">{linkedDriver.name}</p>
          <p className="text-xs text-park-gray-500">
            {linkedDriver.vehicle_info ?? 'Sin info de vehiculo'}
            {linkedDriver.phone && ` · ${linkedDriver.phone}`}
          </p>
        </div>
        <Badge variant={linkedDriver.is_active ? 'success' : 'neutral'} dot className="ml-auto">
          {linkedDriver.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard label="Total entregas" value={stats.total} icon={<Truck className="w-5 h-5 text-park-gray-500" />} />
          <MetricCard label="Entregadas" value={stats.delivered} icon={<Check className="w-5 h-5 text-green-400" />} />
          <MetricCard label="Fallidas" value={stats.failed} icon={<X className="w-5 h-5 text-red-400" />} />
          <MetricCard
            label="Tiempo promedio"
            value={stats.avgTimeMins != null ? `${stats.avgTimeMins} min` : '—'}
            icon={<Clock className="w-5 h-5 text-amber-400" />}
          />
        </div>
      )}

      {recentDeliveries && recentDeliveries.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-park-gray-400 mb-3">Ultimas entregas</h3>
          <div className="space-y-2">
            {recentDeliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-park-gray-800/50 rounded-lg border border-park-gray-800">
                <div>
                  <p className="text-sm text-white">{d.address_text}</p>
                  <p className="text-xs text-park-gray-500">{formatDate(d.created_at)}</p>
                </div>
                <Badge variant={STATUS_BADGE[d.status]?.variant ?? 'neutral'} dot>
                  {STATUS_BADGE[d.status]?.label ?? d.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Horarios ────────────────────────────────────────────────────────────

function HorariosTab({ employee }: { employee: EmployeeProfile }) {
  const SCHEDULE_LABELS: Record<string, string> = {
    FULL_TIME: 'Tiempo Completo',
    PART_TIME: 'Medio Tiempo',
    ROTATING: 'Rotativo',
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <Row label="Tipo de horario" value={SCHEDULE_LABELS[employee.work_schedule_type] ?? employee.work_schedule_type} />
      </Card>

      <div>
        <h3 className="text-sm font-medium text-park-gray-400 mb-3">Disponibilidad semanal</h3>
        <div className="grid grid-cols-7 gap-2">
          {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day) => (
            <div key={day} className="text-center">
              <p className="text-xs text-park-gray-500 mb-2">{day}</p>
              <div className="h-16 bg-park-gray-800/50 rounded-lg border border-park-gray-800 flex items-center justify-center">
                <span className="text-xs text-park-gray-600">—</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-park-gray-600 mt-2">
          La configuracion de horarios detallada se gestiona desde el modulo de Recursos Humanos.
        </p>
      </div>

      <Button
        variant="secondary"
        onClick={() => window.location.href = '/admin/hr/schedules'}
      >
        Gestionar horarios
      </Button>
    </div>
  );
}

// ─── Tab: Asistencia ──────────────────────────────────────────────────────────

function AsistenciaTab({ employeeId }: { employeeId: string }) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startDate = `${currentMonth}-01`;
  const endDate = `${currentMonth}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  const { data: records, isLoading } = useSWR<AttendanceRecord[]>(
    `/api/hr/attendance?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`,
    listFetcher,
  );

  const totalPresent = records?.filter((r) => r.status === 'PRESENT').length ?? 0;
  const totalLate = records?.filter((r) => r.status === 'LATE').length ?? 0;
  const totalAbsent = records?.filter((r) => r.status === 'ABSENT').length ?? 0;
  const totalWorkedMinutes = records?.reduce((sum, r) => sum + (r.worked_minutes || 0), 0) ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-park-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-park-gray-400">
        Resumen del mes — {now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Presentes" value={totalPresent} icon={<UserCheck className="w-5 h-5 text-green-400" />} />
        <MetricCard label="Tardanzas" value={totalLate} icon={<AlertTriangle className="w-5 h-5 text-yellow-400" />} />
        <MetricCard label="Ausencias" value={totalAbsent} icon={<X className="w-5 h-5 text-red-400" />} />
        <MetricCard label="Horas trabajadas" value={formatMinutes(totalWorkedMinutes)} icon={<Clock className="w-5 h-5 text-blue-400" />} />
      </div>

      {/* Last 10 records */}
      {records && records.length > 0 ? (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Entrada</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Salida</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Horas</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 10).map((record) => {
                  const badge = STATUS_BADGE[record.status] ?? { variant: 'neutral' as const, label: record.status };
                  return (
                    <tr key={record.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-white">
                        {new Date(record.date).toLocaleDateString('es-PE', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono text-park-gray-300">{formatTime(record.clock_in)}</td>
                      <td className="px-4 py-3 font-mono text-park-gray-300">{formatTime(record.clock_out)}</td>
                      <td className="px-4 py-3 text-park-gray-300">{formatMinutes(record.worked_minutes || 0)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant} dot>{badge.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<Calendar />}
          title="Sin registros este mes"
          description="No hay registros de asistencia para el periodo actual"
        />
      )}

      <Button
        variant="secondary"
        onClick={() => window.location.href = `/admin/hr/attendance?employee=${employeeId}`}
      >
        Ver asistencia completa
      </Button>
    </div>
  );
}

// ─── Tab: Evaluaciones ────────────────────────────────────────────────────────

function EvaluacionesTab({ employee }: { employee: EmployeeProfile }) {
  const { data: evaluations, isLoading } = useSWR<Evaluation[]>(
    `/api/hr/evaluations/employee/${employee.id}`,
    listFetcher,
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-park-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const allScores = evaluations?.flatMap((ev) => Object.values(ev.scores ?? {})) ?? [];
  const avgScore = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;

  return (
    <div className="space-y-6">
      {avgScore > 0 && (
        <div className="flex items-center gap-4 p-4 bg-park-gray-800/50 rounded-lg border border-park-gray-800">
          <div>
            <p className="text-sm text-park-gray-400">Puntuacion promedio</p>
            <p className="text-2xl font-bold text-amber-400">{avgScore.toFixed(1)} / 10</p>
          </div>
          <div className="flex-1 max-w-xs">
            <Progress value={avgScore} max={10} variant="warning" size="lg" showLabel />
          </div>
        </div>
      )}

      {employee.role === 'WAITER' && (
        <Alert
          variant="info"
          title="Ranking de mozo"
          description="El ranking de mozos se calcula a partir de evaluaciones, propinas y feedback de clientes."
        />
      )}

      {evaluations && evaluations.length > 0 ? (
        <div className="space-y-3">
          {evaluations.map((ev) => {
            const scores = Object.entries(ev.scores ?? {});
            const avg = scores.length > 0
              ? scores.reduce((s, [, v]) => s + v, 0) / scores.length
              : 0;
            return (
              <div key={ev.id} className="p-4 bg-park-gray-800/50 rounded-lg border border-park-gray-800">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">
                      {formatDate(ev.period_start)} — {formatDate(ev.period_end)}
                    </p>
                    {ev.comments && (
                      <p className="text-xs text-park-gray-500 mt-1">{ev.comments}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-amber-400">{avg.toFixed(1)}</span>
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  </div>
                </div>
                {scores.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {scores.map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-park-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-1.5">
                          <Progress value={val} max={10} size="sm" variant="warning" className="w-16" />
                          <span className="text-park-gray-300 w-5 text-right">{val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Star />}
          title="Sin evaluaciones"
          description="No hay evaluaciones registradas para este empleado"
        />
      )}

      <Button
        variant="secondary"
        onClick={() => window.location.href = `/admin/hr/evaluations?employee=${employee.id}`}
      >
        Ver evaluaciones
      </Button>
    </div>
  );
}

// ─── Tab: Documentos ──────────────────────────────────────────────────────────

function DocumentosTab({ employee }: { employee: EmployeeProfile }) {
  const { data: documents, isLoading: docsLoading, mutate: mutateDocs } = useSWR<EmployeeDocument[]>(
    `/api/hr/documents/employee/${employee.id}`,
    listFetcher,
  );

  const { data: trainings } = useSWR<Training[]>(
    `/api/hr/training/employee/${employee.id}`,
    listFetcher,
  );

  const [uploading, setUploading] = useState(false);

  const handleDocUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employee_id', employee.id);
      formData.append('document_type', 'GENERAL');

      const res = await fetch(`/api/hr/documents/employee/${employee.id}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Error al subir documento');
      toast.success('Documento subido');
      mutateDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Document upload */}
      <FileUpload
        label="Subir nuevo documento"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        maxSize={10 * 1024 * 1024}
        onUpload={handleDocUpload}
      />

      {/* Document list */}
      <div>
        <h3 className="text-sm font-medium text-park-gray-400 mb-3">Documentos</h3>
        {docsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-park-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !documents || documents.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="Sin documentos"
            description="No hay documentos subidos para este empleado"
          />
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-park-gray-800/50 rounded-lg border border-park-gray-800">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-park-gray-500" />
                  <div>
                    <p className="text-sm text-white">{doc.file_name}</p>
                    <p className="text-xs text-park-gray-500">
                      {doc.document_type} · {formatDate(doc.uploaded_at)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(doc.file_url, '_blank')}
                >
                  Ver
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Training records */}
      <div className="border-t border-park-gray-800 pt-6">
        <h3 className="text-sm font-medium text-park-gray-400 mb-3">Capacitaciones</h3>
        {!trainings || trainings.length === 0 ? (
          <p className="text-sm text-park-gray-500">Sin capacitaciones registradas</p>
        ) : (
          <div className="space-y-2">
            {trainings.map((t) => {
              const badge = STATUS_BADGE[t.status] ?? { variant: 'neutral' as const, label: t.status };
              return (
                <div key={t.id} className="flex items-center justify-between p-3 bg-park-gray-800/50 rounded-lg border border-park-gray-800">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-park-gray-500">
                      {t.training_type}
                      {t.completed_at && ` · Completado: ${formatDate(t.completed_at)}`}
                    </p>
                  </div>
                  <Badge variant={badge.variant} dot>{badge.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="h-5 w-48 bg-park-gray-800 rounded animate-pulse" />
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 bg-park-gray-800 rounded-full animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 w-56 bg-park-gray-800 rounded-lg animate-pulse" />
          <div className="h-4 w-36 bg-park-gray-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-12 w-full bg-park-gray-800 rounded-lg animate-pulse" />
      <Card padding="none">
        <div className="space-y-4 p-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useQueryState<TabValue>('tab', 'general');

  const {
    data: employee,
    error,
    isLoading,
    mutate,
  } = useSWR<EmployeeProfile>(`/api/admin/employees/${id}`, fetcher);

  const handleToggleActive = async () => {
    if (!employee) return;
    const action = employee.is_active ? 'desactivar' : 'reactivar';
    if (!confirm(`¿${employee.is_active ? 'Desactivar' : 'Reactivar'} a ${employee.name}?`)) return;

    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !employee.is_active }),
      });
      if (!res.ok) throw new Error(`Error al ${action}`);
      toast.success(`Empleado ${action === 'desactivar' ? 'desactivado' : 'reactivado'}`);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  if (isLoading) return <ProfileSkeleton />;

  if (error || !employee) {
    return (
      <div className="p-4 space-y-6">
        <Breadcrumbs items={[{ label: 'Equipo', href: '/admin/equipo' }, { label: 'Error' }]} />
        <PageHeader title="Error" />
        <Alert
          variant="critical"
          title="Error al cargar empleado"
          description={error?.message ?? 'Empleado no encontrado'}
        />
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[employee.role] ?? employee.role;

  return (
    <div className="p-4 space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Equipo', href: '/admin/equipo' },
          { label: employee.name },
        ]}
      />

      {/* Header with avatar */}
      <div className="flex items-start gap-4">
        <Avatar
          src={employee.photo_url ?? undefined}
          name={employee.name}
          size="xl"
          status={employee.is_active ? 'online' : 'offline'}
        />
        <div className="flex-1 min-w-0">
          <PageHeader
            title={employee.name}
            description={`${roleLabel} · ${employee.is_active ? 'Activo' : 'Inactivo'}`}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  icon={<Pencil size={16} />}
                  onClick={() => setActiveTab('general')}
                >
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleToggleActive}
                >
                  {employee.is_active ? 'Desactivar' : 'Reactivar'}
                </Button>
              </div>
            }
          />
          <div className="flex items-center gap-2 -mt-2">
            <Badge variant="neutral">
              <Shield className="w-3 h-3" /> {roleLabel}
            </Badge>
            <Badge variant={employee.is_active ? 'success' : 'neutral'} dot>
              {employee.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
            {employee.dni && (
              <span className="text-xs text-park-gray-600 font-mono">DNI {employee.dni}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v as TabValue)}
        tabs={TAB_ITEMS}
        className="overflow-x-auto"
      />

      {/* Tab content */}
      <TabsContent value="general" activeValue={activeTab}>
        <GeneralTab employee={employee} onSaved={() => mutate()} />
      </TabsContent>

      <TabsContent value="empleo" activeValue={activeTab}>
        <EmpleoTab employee={employee} onSaved={() => mutate()} />
      </TabsContent>

      <TabsContent value="salario" activeValue={activeTab}>
        <SalarioTab employee={employee} onSaved={() => mutate()} />
      </TabsContent>

      <TabsContent value="delivery" activeValue={activeTab}>
        <DeliveryTab employee={employee} onRefresh={() => mutate()} />
      </TabsContent>

      <TabsContent value="horarios" activeValue={activeTab}>
        <HorariosTab employee={employee} />
      </TabsContent>

      <TabsContent value="asistencia" activeValue={activeTab}>
        <AsistenciaTab employeeId={id} />
      </TabsContent>

      <TabsContent value="evaluaciones" activeValue={activeTab}>
        <EvaluacionesTab employee={employee} />
      </TabsContent>

      <TabsContent value="documentos" activeValue={activeTab}>
        <DocumentosTab employee={employee} />
      </TabsContent>
    </div>
  );
}
