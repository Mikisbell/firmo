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
        throw new Error(errorData.error || 'Failed to provision tenant');
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
      setError(err instanceof Error ? err.message : 'An error occurred');
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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Tenant Provisioning Complete</h1>
          <p className="text-zinc-400 mt-1">
            Your new tenant has been successfully provisioned
          </p>
        </div>

        {/* Success Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/30 rounded-lg p-6"
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-green-400">Success!</h2>
              <p className="text-green-300 text-sm mt-1">
                Tenant "{formData.legal_name}" has been provisioned with all required resources.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Credentials Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 rounded-xl border border-zinc-800 p-6"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            Tenant Credentials
          </h2>

          <div className="space-y-4">
            {/* Tenant ID */}
            <div>
              <label className="text-xs text-zinc-500 uppercase mb-2 block">
                Tenant ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={result.tenant_id}
                  readOnly
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-300"
                />
                <button
                  onClick={() => copyToClipboard(result.tenant_id, 'tenant_id')}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {copiedField === 'tenant_id' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-zinc-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Admin Employee ID */}
            <div>
              <label className="text-xs text-zinc-500 uppercase mb-2 block">
                Admin Employee ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={result.admin_employee_id}
                  readOnly
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-300"
                />
                <button
                  onClick={() => copyToClipboard(result.admin_employee_id, 'admin_employee_id')}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {copiedField === 'admin_employee_id' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-zinc-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Activation Code */}
            <div>
              <label className="text-xs text-zinc-500 uppercase mb-2 block">
                Activation Code
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={result.activation_code}
                  readOnly
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-300 text-center text-lg font-bold"
                />
                <button
                  onClick={() => copyToClipboard(result.activation_code, 'activation_code')}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {copiedField === 'activation_code' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-zinc-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Admin PIN */}
            <div>
              <label className="text-xs text-zinc-500 uppercase mb-2 block">
                Admin PIN
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={result.credentials.admin_pin}
                  readOnly
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-300"
                />
                <button
                  onClick={() => setShowPin(!showPin)}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {showPin ? (
                    <EyeOff className="w-5 h-5 text-zinc-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-zinc-400" />
                  )}
                </button>
                <button
                  onClick={() => copyToClipboard(result.credentials.admin_pin, 'admin_pin')}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {copiedField === 'admin_pin' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-zinc-400" />
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
          className="bg-zinc-900 rounded-xl border border-zinc-800 p-6"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Onboarding Checklist
          </h2>

          <div className="space-y-3">
            {result.onboarding_checklist.map((step) => (
              <div
                key={step.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <div className="w-6 h-6 rounded-full border-2 border-zinc-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-zinc-400">
                    {step.step_number}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-zinc-500 mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setResult(null)}
            className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors font-medium"
          >
            Provision Another Tenant
          </button>
          <button
            onClick={() => window.location.href = '/admin/tenant/dashboard'}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Provision New Tenant</h1>
        <p className="text-zinc-400 mt-1">
          Create a new tenant with all required configuration
        </p>
      </div>

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
        className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6"
      >
        {/* Business Information */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Business Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Legal Name *
              </label>
              <input
                type="text"
                name="legal_name"
                value={formData.legal_name}
                onChange={handleInputChange}
                placeholder="Pollería El Buen Sabor"
                required
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
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
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Address</label>
              <textarea
                name="address_text"
                value={formData.address_text || ''}
                onChange={handleInputChange}
                placeholder="Av. Principal 123, Lima"
                rows={2}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Admin Information */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-green-400" />
            Admin Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Admin Name *
              </label>
              <input
                type="text"
                name="admin_name"
                value={formData.admin_name}
                onChange={handleInputChange}
                placeholder="Juan Pérez"
                required
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Admin PIN (4 digits) *
              </label>
              <input
                type="password"
                name="admin_pin"
                value={formData.admin_pin}
                onChange={handleInputChange}
                placeholder="1234"
                pattern="\d{4}"
                required
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Regional Settings */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-400" />
            Regional Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Timezone</label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Currency</label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
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
            Optional Settings
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Receipt Footer Text
              </label>
              <textarea
                name="receipt_footer_text"
                value={formData.receipt_footer_text || ''}
                onChange={handleInputChange}
                placeholder="Thank you for your purchase!"
                rows={2}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Default Delivery Fee (cents)
                </label>
                <input
                  type="number"
                  name="default_delivery_fee_cents"
                  value={formData.default_delivery_fee_cents}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Max Offline Coupons per Order
                </label>
                <input
                  type="number"
                  name="max_offline_coupons_per_order"
                  value={formData.max_offline_coupons_per_order}
                  onChange={handleInputChange}
                  min="1"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
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
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800"
                />
                <span className="text-sm font-medium">Enable Tips</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="tips_on_invoice"
                  checked={formData.tips_on_invoice}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800"
                />
                <span className="text-sm font-medium">Show Tips on Invoice</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="allow_offline_coupon"
                  checked={formData.allow_offline_coupon}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800"
                />
                <span className="text-sm font-medium">Allow Offline Coupons</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="require_manager_for_offline"
                  checked={formData.require_manager_for_offline}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800"
                />
                <span className="text-sm font-medium">Require Manager for Offline</span>
              </label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Provisioning...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Provision Tenant
              </>
            )}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
