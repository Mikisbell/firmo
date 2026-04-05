'use client';

/**
 * SUNAT Configuration Tab — Provider selection, credentials, test connection.
 *
 * @module app/admin/facturacion/configuracion-tab
 */

import { useState } from 'react';
import {
  Settings,
  Shield,
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSunatConfig } from '@/src/hooks/useFacturacion';
import { Input } from '@/src/components/ui';

type Provider = 'SUNAT_DIRECT' | 'NUBEFACT' | 'NONE';
type Mode = 'PRODUCTION' | 'BETA' | 'DISABLED';

export default function ConfiguracionTab() {
  const { config, isLoading, mutate } = useSunatConfig();

  const [provider, setProvider] = useState<Provider>('NONE');
  const [mode, setMode] = useState<Mode>('DISABLED');
  const [solUser, setSolUser] = useState('');
  const [solPassword, setSolPassword] = useState('');
  const [certPem, setCertPem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [nubefactToken, setNubefactToken] = useState('');
  const [nubefactUrl, setNubefactUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    duration_ms: number;
  } | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Sync form state with fetched config (once)
  if (config && !initialized) {
    setProvider((config.sunat_provider as Provider) ?? 'NONE');
    setMode((config.sunat_mode as Mode) ?? 'DISABLED');
    setSolUser(config.sunat_sol_user ?? '');
    setNubefactUrl(config.nubefact_url ?? '');
    setInitialized(true);
  }

  const handleFileUpload = (
    setter: (v: string) => void,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10240) {
      toast.error('Archivo demasiado grande (máx. 10KB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setter(text);
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        sunat_provider: provider,
        sunat_mode: mode,
      };

      if (provider === 'SUNAT_DIRECT') {
        if (solUser) body.sunat_sol_user = solUser;
        if (solPassword) body.sunat_sol_password = solPassword;
        if (certPem) body.sunat_certificate_pem = certPem;
        if (keyPem) body.sunat_private_key_pem = keyPem;
      } else if (provider === 'NUBEFACT') {
        if (nubefactToken) body.nubefact_token = nubefactToken;
        if (nubefactUrl) body.nubefact_url = nubefactUrl;
      }

      const res = await fetch('/api/admin/facturacion/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Error al guardar');
        return;
      }

      toast.success('Configuración guardada');
      // Clear sensitive fields after save
      setSolPassword('');
      setCertPem('');
      setKeyPem('');
      setNubefactToken('');
      mutate();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/facturacion/test-connection', {
        method: 'POST',
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success('Conexión exitosa');
      } else {
        toast.error(data.message ?? 'Conexión fallida');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  const certExpiresInDays = config?.cert_expires_in_days;
  const certExpiring = certExpiresInDays !== null && certExpiresInDays !== undefined && certExpiresInDays < 30;
  const certExpired = certExpiresInDays !== null && certExpiresInDays !== undefined && certExpiresInDays < 0;

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-zinc-100 uppercase">Proveedor de Facturación</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { value: 'SUNAT_DIRECT' as Provider, label: 'SUNAT Directo', desc: 'Conexión directa con certificado digital' },
            { value: 'NUBEFACT' as Provider, label: 'Nubefact', desc: 'Servicio tercero (requiere token)' },
            { value: 'NONE' as Provider, label: 'Deshabilitado', desc: 'Sin facturación electrónica' },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setProvider(opt.value)}
              className={`p-4 rounded-lg border text-left transition-colors ${
                provider === opt.value
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
              }`}
            >
              <span className={`text-sm font-bold ${provider === opt.value ? 'text-amber-400' : 'text-zinc-300'}`}>
                {opt.label}
              </span>
              <p className="text-xs text-zinc-500 mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* SUNAT Direct Fields */}
      {provider === 'SUNAT_DIRECT' && (
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-zinc-100 uppercase">Credenciales SUNAT</h2>
          </div>

          {/* RUC */}
          {config?.ruc && (
            <div className="mb-4 p-3 bg-zinc-900 rounded-lg">
              <span className="text-xs text-zinc-500">RUC:</span>
              <span className="text-sm text-zinc-200 ml-2 font-mono">{config.ruc}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Usuario SOL"
              type="text"
              value={solUser}
              onChange={(e) => setSolUser(e.target.value)}
              placeholder="MODDATOS"
            />

            <Input
              label={`Clave SOL${config?.has_sol_password ? ' (guardada)' : ''}`}
              type="password"
              value={solPassword}
              onChange={(e) => setSolPassword(e.target.value)}
              placeholder={config?.has_sol_password ? '••••••••' : 'Ingrese clave SOL'}
            />
          </div>

          {/* Certificate Upload */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                Certificado Digital (.pem)
                {config?.has_certificate && <span className="text-green-400 ml-1">(cargado)</span>}
              </label>
              <label className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-600 transition-colors">
                <Upload className="w-4 h-4 text-zinc-500" />
                <span className="text-sm text-zinc-400">
                  {certPem ? 'Archivo seleccionado' : 'Seleccionar archivo .pem'}
                </span>
                <input
                  type="file"
                  accept=".pem,.cer,.crt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(setCertPem, e)}
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">
                Clave Privada (.pem)
                {config?.has_private_key && <span className="text-green-400 ml-1">(cargada)</span>}
              </label>
              <label className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-600 transition-colors">
                <Upload className="w-4 h-4 text-zinc-500" />
                <span className="text-sm text-zinc-400">
                  {keyPem ? 'Archivo seleccionado' : 'Seleccionar archivo .pem'}
                </span>
                <input
                  type="file"
                  accept=".pem,.key"
                  className="hidden"
                  onChange={(e) => handleFileUpload(setKeyPem, e)}
                />
              </label>
            </div>
          </div>

          {/* Certificate Expiration Alert */}
          {certExpired && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-300">Certificado digital expirado</span>
            </div>
          )}
          {certExpiring && !certExpired && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-sm text-yellow-300">
                El certificado digital expira en {certExpiresInDays} días
              </span>
            </div>
          )}
          {config?.sunat_cert_expires_at && !certExpiring && !certExpired && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-300">
                Certificado válido hasta {new Date(config.sunat_cert_expires_at).toLocaleDateString('es-PE')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Nubefact Fields */}
      {provider === 'NUBEFACT' && (
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-zinc-100 uppercase">Credenciales Nubefact</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Input
              label={`Token de Autorización${config?.has_nubefact_token ? ' (guardado)' : ''}`}
              type="password"
              value={nubefactToken}
              onChange={(e) => setNubefactToken(e.target.value)}
              placeholder={config?.has_nubefact_token ? '••••••••' : 'Ingrese token'}
            />
            <Input
              label="URL de API"
              type="url"
              value={nubefactUrl}
              onChange={(e) => setNubefactUrl(e.target.value)}
              placeholder="https://api.nubefact.com/api/v1/..."
            />
          </div>
        </div>
      )}

      {/* Mode Selection */}
      {provider !== 'NONE' && (
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-5">
          <h2 className="text-sm font-bold text-zinc-100 uppercase mb-3">Modo de Operación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { value: 'PRODUCTION' as Mode, label: 'Producción', desc: 'Comprobantes reales ante SUNAT', color: 'green' },
              { value: 'BETA' as Mode, label: 'Beta (Pruebas)', desc: 'Envía a servidor de pruebas', color: 'yellow' },
              { value: 'DISABLED' as Mode, label: 'Deshabilitado', desc: 'No envía a SUNAT', color: 'zinc' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  mode === opt.value
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                }`}
              >
                <span className={`text-sm font-bold ${mode === opt.value ? 'text-amber-400' : 'text-zinc-300'}`}>
                  {opt.label}
                </span>
                <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Guardar Configuración
        </button>

        {provider !== 'NONE' && mode !== 'DISABLED' && (
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center gap-2 px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 font-bold rounded-xl transition-colors"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            Probar Conexión
          </button>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border ${
            testResult.success
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <span className={`text-sm font-bold ${testResult.success ? 'text-green-300' : 'text-red-300'}`}>
              {testResult.success ? 'Conexión exitosa' : 'Conexión fallida'}
            </span>
          </div>
          <p className="text-xs text-zinc-400">{testResult.message}</p>
          <p className="text-xs text-zinc-500 mt-1">Tiempo: {testResult.duration_ms}ms</p>
        </div>
      )}
    </div>
  );
}
