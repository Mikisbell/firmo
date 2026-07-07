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
import { toast } from 'sonner';
import OnboardingWizard from '../components/onboarding/OnboardingWizard';
import { Button, Card, PageHeader, Progress } from '@/src/components/ui';
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
    localStorage.removeItem('park-onboarding-progress');
    toast.success('Configuracion completada', {
      description: 'Tu sistema FIRMO POS esta listo para usar.',
    });
    router.push('/admin');
  };

  const handleCompleteLater = () => {
    if (data) {
      localStorage.setItem('park-onboarding-progress', JSON.stringify({
        completion_percentage: data.completion_percentage,
        completed_steps: data.steps.filter((s) => s.is_completed).map((s) => s.step_key),
        saved_at: new Date().toISOString(),
      }));
    }
    toast.info('Progreso guardado', {
      description: 'Podes continuar la configuracion en cualquier momento.',
    });
    router.push('/admin');
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <Card>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
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
            <h2 className="text-lg font-semibold text-white mb-2">
              Error al cargar onboarding
            </h2>
            <p className="text-park-gray-400 text-sm">{error}</p>
          </div>
          <Button
            variant="secondary"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={fetchOnboarding}
          >
            Reintentar
          </Button>
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
            <h2 className="text-lg font-semibold text-white mb-2">
              Sin datos de onboarding
            </h2>
            <p className="text-park-gray-400 text-sm">
              No se encontro lista de configuracion para este tenant.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-white">Progreso del Asistente</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-park-gray-400 tabular-nums">
              Paso {data.progress.completed} de {data.progress.total}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCompleteLater}
            >
              Completar despues
            </Button>
          </div>
        </div>
        <Progress
          value={data.progress.completed}
          max={data.progress.total}
          variant={data.progress.completed === data.progress.total ? 'success' : 'default'}
        />
      </Card>
      <OnboardingWizard
        tenant_id={data.tenant_id}
        steps={data.steps}
        onStepComplete={handleStepComplete}
        onOnboardingComplete={handleOnboardingComplete}
      />
    </div>
  );
}
