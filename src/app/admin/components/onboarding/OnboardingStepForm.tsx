'use client';

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
              Set up your restaurant's basic information. This will be displayed
              on receipts and invoices.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                ℹ️ You can update this information later in Settings.
              </p>
            </div>
          </div>
        );

      case 'CONFIGURE_SETTINGS':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Configure your system preferences including timezone, currency,
              and KDS settings.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                ℹ️ Default timezone is set to America/Lima (Peru).
              </p>
            </div>
          </div>
        );

      case 'CREATE_TERMINAL':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Create your first POS terminal. This is the device where orders
              will be taken.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                ℹ️ You can add more terminals later. Each terminal needs a
                unique ID.
              </p>
            </div>
          </div>
        );

      case 'CREATE_EMPLOYEE':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Create your first employee. This person will be able to log in to
              the system using their PIN.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                ℹ️ Make sure to set a secure PIN (4-6 digits).
              </p>
            </div>
          </div>
        );

      case 'CREATE_PRODUCT':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Add your first product to the catalog. This will be available for
              ordering.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                ℹ️ Products are organized by category and assigned to kitchen
                stations.
              </p>
            </div>
          </div>
        );

      case 'CONFIGURE_STATIONS':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Configure your kitchen stations. These are where orders are sent
              for preparation.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                ℹ️ Default stations: Parrilla, Cocina, Bar, Empaque. You can
                customize these.
              </p>
            </div>
          </div>
        );

      case 'CONFIGURE_PAYMENT_METHODS':
        return (
          <div className="space-y-4">
            <p className="text-slate-600">
              Set up the payment methods your restaurant accepts.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                ℹ️ Common methods: Cash, Card, QR Code. You can add more later.
              </p>
            </div>
          </div>
        );

      default:
        return (
          <p className="text-slate-600">
            Complete this step to continue with the setup.
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
            <p className="font-medium text-green-900">Step Completed</p>
            <p className="text-sm text-green-700">
              This step has been completed. You can move to the next step.
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
            Skip
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
              Processing...
            </>
          ) : step.is_completed ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Completed
            </>
          ) : (
            'Complete Step'
          )}
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          💡 Tip: You can complete these steps in any order. Required steps are
          marked with a red asterisk.
        </p>
      </div>
    </div>
  );
}
