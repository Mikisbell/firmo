'use client';

/**
 * Tenant Provisioning Page
 * 
 * Provides a form to provision new tenants with all required configuration.
 * Displays provisioning progress and tenant credentials upon completion.
 * 
 * Requirements: 3.7
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  Loader,
  Building2,
  User,
  Lock,
  Globe,
  DollarSign,
  FileText,
} from 'lucide-react';
import { Button, Card, PageHeader } from '@/src/components/ui';

interface ProvisioningFormData {
  legal_name: string;
  ruc?: string;
  address_text?: string;
  admin_name: string;
  admin_pin: string;
  timezone: string;
  currency: string;
  receipt_footer_text?: string;
  kds_audio_enabled: boolean;
  kds_audio_volume: number;
  default_delivery_fee_cents: number;
  enable_tips: boolean;
  tips_on_invoice: boolean;
  allow_offline_coupon: boolean;
  max_offline_coupons_per_order: number;
  require_manager_for_offline: boolean;
}

interface ProvisioningResult {
  tenant_id: string;
  admin_employee_id: string;
  activation_code: string;
  credentials: {
    tenant_id: string;
    admin_employee_id: string;
    admin_pin: string;
  };
  onboarding_checklist: Array<{
    id: string;
    step_number: number;
    title: string;
    description: string;
    is_completed: boolean;
  }>;
}

const TIMEZONES = [
  'America/Lima',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'America/Anchorage',
  'America/Caracas',
  'America/Bogota',
  'America/Santiago',
  'America/Buenos_Aires',
];

const CURRENCIES = ['PEN', 'USD', 'EUR', 'BRL', 'CLP', 'COP', 'ARS'];

export default function TenantProvisioningPage() {
  const [formData, setFormData] = useState<ProvisioningFormData>({
    legal_name: '',
    admin_name: '',
    admin_pin: '',
    timezone: 'America/Lima',
    currency: 'PEN',
    kds_audio_enabled: true,
    kds_audio_volume: 50,
    default_delivery_fee_cents: 0,
    enable_tips: true,
    tips_on_invoice: false,
    allow_offline_coupon: true,
    max_offline_coupons_per_order: 5,
    require_manager_for_offline: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisioningResult | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const target = e.target as HTMLInputElement;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? target.checked
          : type === 'number'
          ? parseInt(value, 10)
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/tenants/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al provisionar tenant');
      }

      const data = await response.json();
      setResult(data);
      setFormData({
        legal_name: '',
        admin_name: '',
        admin_pin: '',
        timezone: 'America/Lima',
        currency: 'PEN',
        kds_audio_enabled: true,
        kds_audio_volume: 50,
        default_delivery_fee_cents: 0,
        enable_tips: true,
        tips_on_invoice: false,
        allow_offline_coupon: true,
        max_offline_coupons_per_order: 5,
        require_manager_for_offline: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrio un error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (result) {
    return (
      <div className="p-4 space-y-6">
        <PageHeader
          title="Aprovisionamiento de Tenant Completo"
          description="Tu nuevo tenant ha sido aprovisionado exitosamente"
        />

        {/* Success Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/30 rounded-lg p-6"
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-green-400">Exito!</h2>
              <p className="text-green-300 text-sm mt-1">
                Tenant &quot;{formData.legal_name}&quot; ha sido aprovisionado con todos los recursos requeridos.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Credentials Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-park-gray-900 rounded-xl border border-park-gray-800 p-6"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            Credenciales del Tenant
          </h2>

          <div className="space-y-4">
            {/* Tenant ID */}
            <div>
              <label className="text-xs text-park-gray-500 uppercase mb-2 block">
                ID del Tenant
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={result.tenant_id}
                  readOnly
                  className="flex-1 px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm font-mono text-park-gray-300"
                />
                <button
                  onClick={() => copyToClipboard(result.tenant_id, 'tenant_id')}
                  className="p-2 hover:bg-park-gray-800 rounded-lg transition-colors"
                >
                  {copiedField === 'tenant_id' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-park-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Admin Employee ID */}
            <div>
              <label className="text-xs text-park-gray-500 uppercase mb-2 block">
                ID del Empleado Admin
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={result.admin_employee_id}
                  readOnly
                  className="flex-1 px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm font-mono text-park-gray-300"
                />
                <button
                  onClick={() => copyToClipboard(result.admin_employee_id, 'admin_employee_id')}
                  className="p-2 hover:bg-park-gray-800 rounded-lg transition-colors"
                >
                  {copiedField === 'admin_employee_id' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-park-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Activation Code */}
            <div>
              <label className="text-xs text-park-gray-500 uppercase mb-2 block">
                Codigo de Activacion
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={result.activation_code}
                  readOnly
                  className="flex-1 px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm font-mono text-park-gray-300 text-center text-lg font-bold"
                />
                <button
                  onClick={() => copyToClipboard(result.activation_code, 'activation_code')}
                  className="p-2 hover:bg-park-gray-800 rounded-lg transition-colors"
                >
                  {copiedField === 'activation_code' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-park-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Admin PIN */}
            <div>
              <label className="text-xs text-park-gray-500 uppercase mb-2 block">
                PIN del Admin
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={result.credentials.admin_pin}
                  readOnly
                  className="flex-1 px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm font-mono text-park-gray-300"
                />
                <button
                  onClick={() => setShowPin(!showPin)}
                  className="p-2 hover:bg-park-gray-800 rounded-lg transition-colors"
                >
                  {showPin ? (
                    <EyeOff className="w-5 h-5 text-park-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-park-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => copyToClipboard(result.credentials.admin_pin, 'admin_pin')}
                  className="p-2 hover:bg-park-gray-800 rounded-lg transition-colors"
                >
                  {copiedField === 'admin_pin' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-park-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Onboarding Checklist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-park-gray-900 rounded-xl border border-park-gray-800 p-6"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Lista de Configuracion
          </h2>

          <div className="space-y-3">
            {result.onboarding_checklist.map((step) => (
              <div
                key={step.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-park-gray-800/50 hover:bg-park-gray-800 transition-colors"
              >
                <div className="w-6 h-6 rounded-full border-2 border-park-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-park-gray-400">
                    {step.step_number}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-park-gray-500 mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setResult(null)}
          >
            Provisionar Otro Tenant
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => window.location.href = '/admin/tenant/dashboard'}
          >
            Ir al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Provisionar Nuevo Tenant"
        description="Crear un nuevo tenant con toda la configuracion requerida"
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        </motion.div>
      )}

      {/* Provisioning Form */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="bg-park-gray-900 rounded-xl border border-park-gray-800 p-6 space-y-6"
      >
        {/* Business Information */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Informacion del Negocio
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Nombre Legal *
              </label>
              <input
                data-testid="legal-name-input"
                type="text"
                name="legal_name"
                value={formData.legal_name}
                onChange={handleInputChange}
                placeholder="Pollería El Buen Sabor"
                required
                className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">RUC</label>
              <input
                type="text"
                name="ruc"
                value={formData.ruc || ''}
                onChange={handleInputChange}
                placeholder="20123456789"
                className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Direccion</label>
              <textarea
                name="address_text"
                value={formData.address_text || ''}
                onChange={handleInputChange}
                placeholder="Av. Principal 123, Lima"
                rows={2}
                className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Admin Information */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-green-400" />
            Informacion del Administrador
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Nombre del Admin *
              </label>
              <input
                data-testid="admin-name-input"
                type="text"
                name="admin_name"
                value={formData.admin_name}
                onChange={handleInputChange}
                placeholder="Juan Pérez"
                required
                className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                PIN del Admin (4 digitos) *
              </label>
              <input
                data-testid="admin-pin-input"
                type="password"
                name="admin_pin"
                value={formData.admin_pin}
                onChange={handleInputChange}
                placeholder="1234"
                pattern="\d{4}"
                required
                className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Regional Settings */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-400" />
            Configuracion Regional
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Zona Horaria</label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Moneda</label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Optional Settings */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-400" />
            Configuracion Opcional
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Texto de Pie de Recibo
              </label>
              <textarea
                name="receipt_footer_text"
                value={formData.receipt_footer_text || ''}
                onChange={handleInputChange}
                placeholder="Gracias por su compra!"
                rows={2}
                className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Tarifa de Delivery por Defecto (centavos)
                </label>
                <input
                  type="number"
                  name="default_delivery_fee_cents"
                  value={formData.default_delivery_fee_cents}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Max Cupones Offline por Orden
                </label>
                <input
                  type="number"
                  name="max_offline_coupons_per_order"
                  value={formData.max_offline_coupons_per_order}
                  onChange={handleInputChange}
                  min="1"
                  className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="enable_tips"
                  checked={formData.enable_tips}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-park-gray-700 bg-park-gray-800"
                />
                <span className="text-sm font-medium">Habilitar Propinas</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="tips_on_invoice"
                  checked={formData.tips_on_invoice}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-park-gray-700 bg-park-gray-800"
                />
                <span className="text-sm font-medium">Mostrar Propinas en Factura</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="allow_offline_coupon"
                  checked={formData.allow_offline_coupon}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-park-gray-700 bg-park-gray-800"
                />
                <span className="text-sm font-medium">Permitir Cupones Offline</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="require_manager_for_offline"
                  checked={formData.require_manager_for_offline}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-park-gray-700 bg-park-gray-800"
                />
                <span className="text-sm font-medium">Requerir Gerente para Offline</span>
              </label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={!loading ? <CheckCircle className="w-4 h-4" /> : undefined}
            className="flex-1"
          >
            {loading ? 'Aprovisionando...' : 'Provisionar Tenant'}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
