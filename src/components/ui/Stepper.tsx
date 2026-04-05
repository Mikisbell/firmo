'use client';

/**
 * Stepper — Indicador de wizard multi-paso.
 *
 * Caracteristicas:
 * - Orientacion horizontal (default) o vertical
 * - 3 estados por paso: completado, actual, pendiente
 * - Iconos: checkmark para completados, numero para actual/pendiente
 * - Conectores de linea entre pasos (completados se pintan en brand)
 * - Labels y descripciones opcionales por paso
 */

import { Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface Step {
  /** Texto principal del paso */
  label: string;
  /** Texto secundario opcional */
  description?: string;
}

export interface StepperProps {
  /** Lista de pasos a mostrar */
  steps: Step[];
  /** Indice del paso actual (0-indexed) */
  currentStep: number;
  /** Orientacion del stepper (default horizontal) */
  orientation?: 'horizontal' | 'vertical';
}

type StepState = 'completed' | 'current' | 'pending';

function getStepState(index: number, currentStep: number): StepState {
  if (index < currentStep) return 'completed';
  if (index === currentStep) return 'current';
  return 'pending';
}

const circleStyles: Record<StepState, string> = {
  completed: 'bg-park-brand-600 border-park-brand-600 text-white',
  current: 'border-park-brand-500 text-park-brand-500 bg-park-gray-900',
  pending: 'border-park-gray-700 text-park-gray-500 bg-park-gray-900',
};

export function Stepper({
  steps,
  currentStep,
  orientation = 'horizontal',
}: StepperProps) {
  const isVertical = orientation === 'vertical';

  return (
    <ol
      className={cn(
        'flex',
        isVertical ? 'flex-col gap-2' : 'items-start gap-4',
      )}
      aria-label="Progreso del wizard"
    >
      {steps.map((step, index) => {
        const state = getStepState(index, currentStep);
        const isLast = index === steps.length - 1;
        const connectorCompleted = index < currentStep;

        return (
          <li
            key={`${step.label}-${index}`}
            className={cn(
              'flex',
              isVertical ? 'flex-row items-start gap-3' : 'flex-col items-start flex-1',
            )}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {/* Circulo + conector */}
            <div
              className={cn(
                'flex',
                isVertical ? 'flex-col items-center' : 'flex-row items-center w-full',
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-sm font-medium transition-colors',
                  circleStyles[state],
                )}
                aria-hidden="true"
              >
                {state === 'completed' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Conector */}
              {!isLast && (
                <div
                  className={cn(
                    isVertical ? 'h-8 w-0.5 my-1' : 'h-0.5 flex-1 ml-2',
                    connectorCompleted ? 'bg-park-brand-600' : 'bg-park-gray-800',
                  )}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Labels */}
            <div
              className={cn(
                'min-w-0',
                isVertical ? 'pt-1 pb-4' : 'mt-2',
              )}
            >
              <p
                className={cn(
                  'text-sm font-medium',
                  state === 'pending' ? 'text-park-gray-500' : 'text-park-gray-200',
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-xs text-park-gray-500 mt-0.5">
                  {step.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
