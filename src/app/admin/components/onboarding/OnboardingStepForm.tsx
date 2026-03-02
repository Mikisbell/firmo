'use client';

/**
 * Onboarding Step Form Component
 *
 * Displays the content and actions for a single onboarding step.
 * Uses ONBOARDING_STEPS from the unified constant.
 * All user-facing text in Spanish.
 *
 * Requirements: F2.3
 */

import React from 'react';
import { OnboardingStep } from '@/src/core/tenant/onboarding';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface OnboardingStepFormProps {
  step: OnboardingStep;
  isLoading: boolean;
  error: string | null;
  onComplete: () => Promise<void>;
  onSkip: () => void;
}

export default function OnboardingStepForm({
  step,
  isLoading,
  error,
  onComplete,
  onSkip,
}: OnboardingStepFormProps) {
  const getStepContent = () => {
    switch (step.step_key) {
      case 'CONFIGURE_BASIC_INFO':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Configura la informacion basica de tu restaurante. Estos datos apareceran
              en recibos y facturas.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                Puedes actualizar esta informacion despues en Configuracion.
              </p>
            </div>
          </div>
        );

      case 'CREATE_EMPLOYEE':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Crea tu primer empleado. Esta persona podra iniciar sesion en el
              sistema usando su PIN.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                Asegurate de configurar un PIN seguro (4-6 digitos).
              </p>
            </div>
          </div>
        );

      case 'CREATE_PRODUCT':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Agrega tu primer producto al catalogo. Estara disponible para
              tomar pedidos.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                Los productos se organizan por categoria y se asignan a
                estaciones de cocina.
              </p>
            </div>
          </div>
        );

      case 'CONFIGURE_STATIONS':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Configura tus estaciones de cocina. Los pedidos se envian a estas
              estaciones para su preparacion.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                Estaciones por defecto: Parrilla, Cocina, Bar, Empaque. Puedes
                personalizarlas.
              </p>
            </div>
          </div>
        );

      case 'ACTIVATE_TERMINAL':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Activa tu terminal POS con el codigo de activacion proporcionado.
              El terminal es donde se tomaran los pedidos.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                Puedes agregar mas terminales despues. Cada terminal necesita un
                codigo unico.
              </p>
            </div>
          </div>
        );

      case 'CONFIGURE_PAYMENT_METHODS':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Configura los metodos de pago que acepta tu restaurante.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                Metodos comunes: Efectivo, Tarjeta, Codigo QR. Puedes agregar
                mas despues.
              </p>
            </div>
          </div>
        );

      default:
        return (
          <p className="text-slate-600">
            Completa este paso para continuar con la configuracion.
          </p>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-8">
      {/* Step Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
            {step.step_number}
          </span>
          <h2 className="text-2xl font-bold text-slate-900">{step.title}</h2>
        </div>
        {step.description && (
          <p className="text-slate-600 ml-11">{step.description}</p>
        )}
      </div>

      {/* Step Content */}
      <div className="mb-8 p-6 bg-slate-50 rounded-lg">
        {getStepContent()}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {step.is_completed && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900">Paso Completado</p>
            <p className="text-sm text-green-700">
              Este paso ha sido completado. Puedes continuar al siguiente paso.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        {!step.is_required && (
          <button
            onClick={onSkip}
            disabled={isLoading}
            className="px-6 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Omitir
          </button>
        )}

        <button
          onClick={onComplete}
          disabled={isLoading || step.is_completed}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Procesando...
            </>
          ) : step.is_completed ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Completado
            </>
          ) : (
            'Completar Paso'
          )}
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          Consejo: Puedes completar estos pasos en cualquier orden. Los pasos requeridos
          estan marcados con asterisco rojo.
        </p>
      </div>
    </div>
  );
}
