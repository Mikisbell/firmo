'use client';

/**
 * Create Employee Page
 * Form to create new employee with name, role, PIN, and active status
 *
 * Requirements: 1.1, 1.2, 1.5, 1.7, 6.1, 6.2, 6.3, 6.4, 6.5
 * UX Improvements: Toast notifications (P0)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard } from 'lucide-react';
import {
  Button,
  Card,
  CardFooter,
  PageHeader,
  Input,
  Select,
  Checkbox,
  FormField,
  Breadcrumbs,
} from '@/src/components/ui';

const ROLE_OPTIONS = [
  { value: 'OWNER',      label: 'Propietario' },
  { value: 'ADMIN',      label: 'Administrador' },
  { value: 'MANAGER',    label: 'Gerente' },
  { value: 'SUPERVISOR', label: 'Supervisor(a)' },
  { value: 'CASHIER',    label: 'Cajero(a)' },
  { value: 'WAITER',     label: 'Mesero(a)' },
  { value: 'KITCHEN',    label: 'Cocina' },
  { value: 'COOK',       label: 'Cocinero(a)' },
  { value: 'PACKER',     label: 'Empaquetador(a)' },
  { value: 'BAR',        label: 'Barman' },
  { value: 'DRIVER',     label: 'Motorizado(a)' },
];

export default function NewEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    role: 'WAITER',
    pin: '',
    is_active: true,
    dni: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear empleado');
      }

      toast.success('Empleado creado exitosamente', {
        description: `${form.name} ha sido agregado al sistema`,
      });
      router.push('/admin/empleados');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      setError(errorMessage);
      toast.error('Error al crear empleado', {
        description: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: 'Empleados', href: '/admin/empleados' },
            { label: 'Nuevo' },
          ]}
        />
      </div>
      <PageHeader
        title="Nuevo Empleado"
        description="Crear nuevo usuario del sistema"
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <Input
            label="Nombre completo *"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Juan Pérez"
            required
            maxLength={100}
          />

          {/* DNI */}
          <FormField
            label="DNI (para login)"
            hint="8 dígitos. El empleado lo usará junto a su PIN para ingresar."
          >
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
              pattern="\d{8}"
            />
          </FormField>

          {/* Role */}
          <Select
            label="Rol *"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={ROLE_OPTIONS}
            hint="Define los permisos y accesos del empleado"
            required
          />

          {/* PIN */}
          <Input
            label="PIN de acceso *"
            type="text"
            value={form.pin}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              if (value.length <= 6) {
                setForm({ ...form, pin: value });
              }
            }}
            className="font-mono text-lg tracking-widest"
            placeholder="••••"
            required
            pattern="\d{4,6}"
            maxLength={6}
            hint="4-6 dígitos numéricos. Debe ser único en el sistema."
          />

          {/* Active status */}
          <div className="p-4 bg-park-gray-800/50 rounded-lg">
            <Checkbox
              label="Empleado activo (puede iniciar sesión)"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
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
