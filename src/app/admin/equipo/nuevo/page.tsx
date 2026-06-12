'use client';

/**
 * New Employee Creation Page
 * Simplified form: basic data + employment + PIN + photo.
 * If role=DRIVER, automatically creates driver profile.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, KeyRound } from 'lucide-react';
import {
  Button, Card, CardFooter, PageHeader, Breadcrumbs,
  Input, Select, Checkbox, FormField, FileUpload, DatePicker,
} from '@/src/components/ui';

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
];

const CONTRACT_OPTIONS = [
  { value: 'INDEFINIDO', label: 'Indefinido' },
  { value: 'PLAZO_FIJO', label: 'Plazo Fijo' },
  { value: 'PART_TIME', label: 'Part Time' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    dni: '',
    phone: '',
    email: '',
    role: 'WAITER',
    pin: '',
    is_active: true,
    contract_type: 'INDEFINIDO',
    hire_date: new Date().toISOString().slice(0, 10),
    base_salary_cents: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Create employee
      const payload = {
        ...form,
        dni: form.dni || null,
        phone: form.phone || null,
        email: form.email || null,
      };

      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear empleado');
      }

      const created = await res.json();
      const employeeId = created.id ?? created.data?.id;

      // If DRIVER role, auto-create driver profile
      if (form.role === 'DRIVER' && employeeId) {
        try {
          await fetch('/api/drivers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: form.name,
              phone: form.phone,
              employee_id: employeeId,
            }),
          });
        } catch {
          // Non-blocking: employee was created, driver profile can be added later
          toast.warning('Empleado creado, pero no se pudo crear el perfil de motorizado automaticamente');
        }
      }

      toast.success('Empleado creado exitosamente', {
        description: `${form.name} ha sido agregado al equipo`,
      });
      router.push('/admin/equipo');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      setError(errorMessage);
      toast.error('Error al crear empleado', { description: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Equipo', href: '/admin/equipo' },
          { label: 'Nuevo' },
        ]}
      />
      <PageHeader
        title="Nuevo Miembro del Equipo"
        description="Registrar un nuevo empleado en el sistema"
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Section: Basic data */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-park-gray-300 uppercase tracking-wide">
              Datos basicos
            </h3>

            <FileUpload
              label="Foto de perfil (opcional)"
              accept="image/*"
              maxSize={5 * 1024 * 1024}
              preview={photoPreview}
              onUpload={handlePhotoUpload}
            />

            <Input
              label="Nombre completo"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Juan Perez"
              required
              maxLength={100}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="DNI" hint="8 digitos. Se usa para login junto al PIN.">
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

              <Input
                label="Telefono"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="999 888 777"
              />
            </div>

            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="juan@correo.com"
            />

            <Select
              label="Rol"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              options={ROLE_OPTIONS}
              hint="Define los permisos y accesos del empleado"
              required
            />
          </div>

          {/* Section: Employment */}
          <div className="space-y-4 border-t border-park-gray-800 pt-6">
            <h3 className="text-sm font-semibold text-park-gray-300 uppercase tracking-wide">
              Empleo
            </h3>

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
              required
            />

            <FormField label="Sueldo base" hint="Monto mensual en soles">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-park-gray-500 text-sm">S/</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.base_salary_cents > 0 ? (form.base_salary_cents / 100).toFixed(2) : ''}
                  onChange={(e) =>
                    setForm({ ...form, base_salary_cents: Math.round(parseFloat(e.target.value || '0') * 100) })
                  }
                  className="pl-10"
                  placeholder="0.00"
                />
              </div>
            </FormField>
          </div>

          {/* Section: PIN */}
          <div className="space-y-4 border-t border-park-gray-800 pt-6">
            <h3 className="text-sm font-semibold text-park-gray-300 uppercase tracking-wide">
              Acceso
            </h3>

            <Input
              label="PIN de acceso"
              type="text"
              value={form.pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 6) setForm({ ...form, pin: value });
              }}
              leftIcon={<KeyRound className="h-4 w-4" />}
              className="font-mono text-lg tracking-widest"
              placeholder="****"
              required
              pattern="\d{4,6}"
              maxLength={6}
              hint="4-6 digitos numericos. Debe ser unico en el sistema."
            />

            <div className="p-4 bg-park-gray-800/50 rounded-lg">
              <Checkbox
                label="Empleado activo (puede iniciar sesion)"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: (e.target as HTMLInputElement).checked })}
              />
            </div>

            {form.role === 'DRIVER' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm">
                Se creara automaticamente un perfil de motorizado al guardar.
              </div>
            )}
          </div>

          <CardFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              className="flex-1"
            >
              {saving ? 'Creando...' : 'Crear Empleado'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
