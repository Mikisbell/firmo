/**
 * Error Boundary Component
 * Captura errores de React y muestra UI de error user-friendly
 * 
 * Referencia: SOLUCIONES_IMPLEMENTACION.md #4
 * UX Improvement: P0 - Manejo consistente de errores críticos
 */

'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error capturado por ErrorBoundary:', error, errorInfo);
    // Aquí se puede enviar a Sentry u otro servicio de monitoreo
    // Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 rounded-xl border border-zinc-800 p-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            
            <h2 className="text-xl font-bold mb-2 text-white">Algo salió mal</h2>
            
            <p className="text-zinc-400 mb-4">
              Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
            </p>
            
            {this.state.error && (
              <details className="text-left mb-4">
                <summary className="text-sm text-zinc-500 cursor-pointer hover:text-zinc-400 transition-colors">
                  Ver detalles técnicos
                </summary>
                <pre className="mt-2 p-3 bg-zinc-950 rounded text-xs text-red-400 overflow-auto max-h-40">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
