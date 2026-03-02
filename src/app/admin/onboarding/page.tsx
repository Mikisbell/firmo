'use client';

/**
 * Admin Onboarding Page
 *
 * Displays the onboarding wizard for the authenticated tenant.
 * Fetches data from GET /api/admin/onboarding and allows completing steps
 * via PUT /api/admin/onboarding/steps/:key/complete.
 *
 * Requirements: F2.2
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import OnboardingWizard from '../components/onboarding/OnboardingWizard';
import type { OnboardingStep } from '@/src/core/tenant/onboarding';

interface OnboardingApiResponse {
  tenant_id: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  steps: OnboardingStep[];
  completion_percentage: number;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

export default function AdminOnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOnboarding = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/onboarding');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Error ${response.status} al cargar onboarding`
        );
      }

      const result: OnboardingApiResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar onboarding'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnboarding();
  }, [fetchOnboarding]);

  const handleStepComplete = async (stepKey: string) => {
    const response = await fetch(
      `/api/admin/onboarding/steps/${stepKey}/complete`,
      { method: 'PUT' }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || 'Error al completar paso'
      );
    }

    // Refresh data after completing a step
    await fetchOnboarding();
  };

  const handleOnboardingComplete = async () => {
    router.push('/admin');
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
          <p className="text-zinc-400 text-sm">
            Cargando configuracion inicial...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-zinc-200 mb-2">
              Error al cargar onboarding
            </h2>
            <p className="text-zinc-400 text-sm">{error}</p>
          </div>
          <button
            onClick={fetchOnboarding}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // No data
  if (!data || !data.steps.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-zinc-200 mb-2">
              Sin datos de onboarding
            </h2>
            <p className="text-zinc-400 text-sm">
              No se encontro lista de configuracion para este tenant.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <OnboardingWizard
      tenant_id={data.tenant_id}
      steps={data.steps}
      onStepComplete={handleStepComplete}
      onOnboardingComplete={handleOnboardingComplete}
    />
  );
}
