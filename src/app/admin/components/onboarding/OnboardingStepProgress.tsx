'use client';

/**
 * Onboarding Step Progress Component
 *
 * Displays the list of onboarding steps with their status (completed, current, locked).
 * All user-facing text in Spanish.
 *
 * Requirements: F2.3
 */

import React from 'react';
import { OnboardingStep } from '@/src/core/tenant/onboarding';
import { CheckCircle2, Circle, Lock } from 'lucide-react';

interface OnboardingStepProgressProps {
  steps: OnboardingStep[];
  currentStepIndex: number;
  completedSteps: Set<string>;
  onSelectStep: (index: number) => void;
}

export default function OnboardingStepProgress({
  steps,
  currentStepIndex,
  completedSteps,
  onSelectStep,
}: OnboardingStepProgressProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        Pasos de Configuracion
      </h3>

      <div className="space-y-2">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.step_key);
          const isCurrent = index === currentStepIndex;
          const isClickable = isCompleted || isCurrent || index < currentStepIndex;

          return (
            <button
              key={step.step_key}
              onClick={() => isClickable && onSelectStep(index)}
              disabled={!isClickable}
              className={`w-full text-left p-3 rounded-lg transition-all ${
                isCurrent
                  ? 'bg-blue-50 border-2 border-blue-500'
                  : isCompleted
                    ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                    : 'bg-slate-50 border border-slate-200 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : isCurrent ? (
                    <Circle className="w-5 h-5 text-blue-600 fill-blue-100" />
                  ) : (
                    <Lock className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium text-sm ${
                      isCurrent
                        ? 'text-blue-900'
                        : isCompleted
                          ? 'text-green-900'
                          : 'text-slate-600'
                    }`}
                  >
                    {step.step_number}. {step.title}
                  </p>
                  {step.is_required && (
                    <p className="text-xs text-slate-500 mt-1">Requerido</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
