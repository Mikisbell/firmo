/**
 * Simple Activation Page (Fallback)
 *
 * A simplified activation page that works over HTTP without crypto.subtle
 * Used when the main TerminalSetup fails due to browser security restrictions
 *
 * @module app/simple-activate
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Monitor, AlertTriangle, Check, Loader2, ArrowLeft, X, Settings } from 'lucide-react';

function SimpleActivationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [terminalId, setTerminalId] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Pre-fill terminal from URL params if available
  useEffect(() => {
    const terminalFromUrl = searchParams.get('terminal');
    if (terminalFromUrl) {
      setTerminalId(terminalFromUrl);
    }
  }, [searchParams]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Remove dashes from code
      const cleanCode = activationCode.replace(/-/g, '');

      // Call activation API (simple fallback)
      const res = await fetch('/api/terminals/activate-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminal_id: terminalId,
          code: cleanCode,
          // Skip fingerprint for simple activation
          fingerprint: {
            hash: 'simple-activation-fallback',
            signals: {}
          }
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.details || data.error || 'Error al activar';
        throw new Error(errorMessage);
      }

      setSuccess(true);

      // Redirect after 2 seconds to the correct route based on terminal role
      setTimeout(() => {
        const role = data.terminal?.role;
        const terminalId = data.terminal?.terminal_id;

        // Determine target route based on terminal ID and role
        let targetRoute = '/pos'; // Default

        if (terminalId?.startsWith('CAJA_')) {
          targetRoute = '/pos';
        } else if (terminalId?.startsWith('MOZO_')) {
          targetRoute = '/mozo';
        } else if (terminalId === 'SPC_HORNO') {
          targetRoute = '/cocina/horno';
        } else if (terminalId === 'SPC_COCINA') {
          targetRoute = '/cocina';
        } else if (terminalId === 'SPC_BAR') {
          targetRoute = '/bar';
        } else if (terminalId === 'SPC_EMPAQUE') {
          targetRoute = '/cocina/empaque';
        } else if (role === 'CASHIER') {
          targetRoute = '/pos';
        } else if (role === 'WAITER') {
          targetRoute = '/mozo';
        } else if (role === 'KDS') {
          targetRoute = '/cocina';
        } else if (role === 'BAR') {
          targetRoute = '/bar';
        }

        window.location.href = targetRoute;
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 rounded-2xl border border-zinc-800 p-8 text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">¡Terminal Activado!</h1>
          <p className="text-zinc-400 mb-6">
            {terminalId} ha sido activado exitosamente.
          </p>
          <p className="text-sm text-zinc-500">
            Redirigiendo a la caja...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative">
      {/* Navigation Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors text-zinc-400 hover:text-zinc-100"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Volver a terminales</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.href = '/admin'}
              className="p-2 rounded-lg hover:bg-zinc-800/50 transition-colors text-zinc-400 hover:text-zinc-100"
              title="Panel de Administración"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Warning Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-400 mb-1">Modo Simple Activado</p>
            <p className="text-amber-400/80">
              Estás accediendo desde una red local sin HTTPS.
              Usa este formulario simplificado para activar el terminal.
            </p>
          </div>
        </div>

        {/* Activation Form */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Monitor className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold">Activar Terminal</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Ingresa los datos de activación
            </p>
          </div>

          <form onSubmit={handleActivate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Terminal ID
              </label>
              <input
                type="text"
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value.toUpperCase())}
                placeholder="CAJA_01"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg font-mono text-lg uppercase"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Código de Activación
              </label>
              <input
                type="text"
                value={activationCode}
                onChange={(e) => {
                  // Auto-format with dash
                  const val = e.target.value.replace(/-/g, '').slice(0, 6);
                  if (val.length > 3) {
                    setActivationCode(`${val.slice(0, 3)}-${val.slice(3)}`);
                  } else {
                    setActivationCode(val);
                  }
                }}
                placeholder="123-456"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg font-mono text-lg text-center tracking-wider"
                maxLength={7}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || terminalId.length < 3 || activationCode.replace(/-/g, '').length !== 6}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Activando...
                </>
              ) : (
                'Activar Terminal'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-500 mt-6">
            Para mayor seguridad, configure HTTPS en producción
          </p>
        </div>
      </div>
      </main>
    </div>
  );
}

export default function SimpleActivationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 rounded-2xl border border-zinc-800 p-8 text-center">
          <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Cargando...</h1>
          <p className="text-zinc-400">
            Preparando formulario de activación
          </p>
        </div>
      </div>
    }>
      <SimpleActivationContent />
    </Suspense>
  );
}
