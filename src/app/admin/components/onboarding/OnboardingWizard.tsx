'use client';

import React, { useState, useEffect } from 'react';
import { OnboardingStep } from '@/src/core/tenant/onboarding';
import OnboardingStepProgress from './OnboardingStepProgress';
import OnboardingStepForm from './OnboardingStepForm';

interface OnboardingWizardProps {
  tenant_id: string;
  steps: OnboardingStep[];
  onStepComplete: (step_key: string) => Promise<void>;
  onOnboardingComplete: () => Promise<void>;
}

export default function OnboardingWizard({
  tenant_id,
  steps,
  onStepComplete,
  onOnboardingComplete,
}: OnboardingWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(
    new Set(steps.filter((s) => s.is_completed).map((s) => s.step_key))
  );

  const currentStep = steps[currentStepIndex];
  const requiredSteps = steps.filter((s) => s.is_required);
  const completedRequired = Array.from(completedSteps).filter((key) => {
    const step = steps.find((s) => s.step_key === key);
    return step?.is_required;
  }).length;
  const completionPercentage = Math.round(
    (completedRequired / requiredSteps.length) * 100
  );

  const handleStepComplete = async () => {
    try {
      setIsLoading(true);
      setError(null);

      await onStepComplete(currentStep.step_key);
      setCompletedSteps((prev) => new Set([...prev, currentStep.step_key]));

      // Check if all required steps are complete
      const allRequiredComplete = requiredSteps.every((s) =>
        completedSteps.has(s.step_key) || s.step_key === currentStep.step_key
      );

      if (allRequiredComplete) {
        await onOnboardingComplete();
      } else {
        // Move to next incomplete step
        const nextIncompleteIndex = steps.findIndex(
          (s, idx) =>
            idx > currentStepIndex &&
            !completedSteps.has(s.step_key) &&
            s.is_required
        );

        if (nextIncompleteIndex !== -1) {
          setCurrentStepIndex(nextIncompleteIndex);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to complete step'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipStep = () => {
    if (!currentStep.is_required) {
      const nextIncompleteIndex = steps.findIndex(
        (s, idx) =>
          idx > currentStepIndex &&
          !completedSteps.has(s.step_key) &&
          s.is_required
      );

      if (nextIncompleteIndex !== -1) {
        setCurrentStepIndex(nextIncompleteIndex);
      } else {
        setCurrentStepIndex(currentStepIndex + 1);
      }
    }
  };

  const handleGoToStep = (index: number) => {
    if (index < steps.length) {
      setCurrentStepIndex(index);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome to PARK POS
          </h1>
          <p className="text-slate-600">
            Let's set up your restaurant system. Complete the required steps to
            get started.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Setup Progress
            </h2>
            <span className="text-2xl font-bold text-blue-600">
              {completionPercentage}%
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <p className="text-sm text-slate-600 mt-2">
            {completedRequired} of {requiredSteps.length} required steps
            completed
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Step List */}
          <div className="lg:col-span-1">
            <OnboardingStepProgress
              steps={steps}
              currentStepIndex={currentStepIndex}
              completedSteps={completedSteps}
              onSelectStep={handleGoToStep}
            />
          </div>

          {/* Step Form */}
          <div className="lg:col-span-3">
            {currentStep && (
              <OnboardingStepForm
                step={currentStep}
                isLoading={isLoading}
                error={error}
                onComplete={handleStepComplete}
                onSkip={handleSkipStep}
              />
            )}
          </div>
        </div>

        {/* Completion Message */}
        {completionPercentage === 100 && (
          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              🎉 Setup Complete!
            </h3>
            <p className="text-green-700">
              Your PARK POS system is ready to use. You can now start accepting
              orders.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
