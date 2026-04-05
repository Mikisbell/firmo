'use client';

/**
 * Control de Pollo - Dashboard en tiempo real
 *
 * 4 tarjetas metricas: Crudo | Cocinando | Cocido | Vendido
 * Formulario de produccion, medidor de rendimiento, alertas de merma,
 * historial de lotes con boton "Completar".
 */

import { useState } from 'react';
import { Egg, Flame, ChefHat, ShoppingCart, AlertTriangle, Plus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePolloDashboard, usePolloHistory } from '@/src/hooks/usePolloControl';
import { motion } from 'framer-motion';
import { Button, Badge, Card, PageHeader, MetricCard, Alert } from '@/src/components/ui';

// TODO: Obtener de config/context del tenant
const DEFAULT_LOCATION_ID = '00000000-0000-0000-0000-000000000001';

interface ProductionLog {
  id: string;
  batch_number: number;
  raw_units: number;
  raw_weight_kg: number;
  cooked_units: number | null;
  cooked_weight_kg: number | null;
  yield_percent: number | null;
  waste_units: number | null;
  status: string;
  started_at: string;
  notes: string | null;
}

function YieldGauge({ percent }: { percent: number }) {
  const color = percent === 0
    ? 'text-park-gray-500'
    : percent >= 68 && percent <= 76
      ? 'text-emerald-400'
      : percent < 60 || percent > 85
        ? 'text-red-400'
        : 'text-amber-400';

  const bgColor = percent === 0
    ? 'bg-park-gray-700'
    : percent >= 68 && percent <= 76
      ? 'bg-emerald-500'
      : percent < 60 || percent > 85
        ? 'bg-red-500'
        : 'bg-amber-500';

  return (
    <Card>
      <div className="text-sm text-park-gray-400 mb-3">Rendimiento Promedio</div>
      <div className={`text-4xl font-bold ${color}`}>
        {percent > 0 ? `${percent}%` : '\u2014'}
      </div>
      <div className="mt-3 h-2 bg-park-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${bgColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-park-gray-600 mt-1">
        <span>60%</span>
        <span className="text-park-gray-500">72% objetivo</span>
        <span>85%</span>
      </div>
    </Card>
  );
}

export default function PolloControlPage() {
  const [locationId] = useState(DEFAULT_LOCATION_ID);
  const { equivalents, summary, isLoading, mutate: mutateDashboard } = usePolloDashboard(locationId);
  const { history, mutate: mutateHistory } = usePolloHistory({ locationId });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [rawUnits, setRawUnits] = useState('');
  const [rawWeightKg, setRawWeightKg] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Complete form state
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [cookedUnits, setCookedUnits] = useState('');
  const [cookedWeightKg, setCookedWeightKg] = useState('');
  const [wasteUnits, setWasteUnits] = useState('');

  const handleLogProduction = async () => {
    if (!rawUnits || !rawWeightKg) {
      toast.error('Ingresa unidades y peso');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/pollo-control/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          raw_units: Number(rawUnits),
          raw_weight_kg: Number(rawWeightKg),
          notes: notes || null,
        }),
      });
      if (res.ok) {
        toast.success('Lote registrado');
        setRawUnits('');
        setRawWeightKg('');
        setNotes('');
        setShowForm(false);
        mutateDashboard();
        mutateHistory();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al registrar');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (logId: string) => {
    if (!cookedUnits || !cookedWeightKg) {
      toast.error('Ingresa unidades y peso cocido');
      return;
    }
    try {
      const res = await fetch(`/api/admin/pollo-control/production/${logId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cooked_units: Number(cookedUnits),
          cooked_weight_kg: Number(cookedWeightKg),
          waste_units: wasteUnits ? Number(wasteUnits) : 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.anomalies?.length > 0) {
          data.anomalies.forEach((a: any) => {
            if (a.level === 'CRITICAL') toast.error(a.message);
            else toast.warning(a.message);
          });
        } else {
          toast.success('Lote completado');
        }
        setCompletingId(null);
        setCookedUnits('');
        setCookedWeightKg('');
        setWasteUnits('');
        mutateDashboard();
        mutateHistory();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al completar');
      }
    } catch {
      toast.error('Error de conexion');
    }
  };

  const STATUS_LABELS: Record<string, string> = {
    CRUDO: 'Crudo',
    COCINANDO: 'Cocinando',
    COCIDO: 'Cocido',
    SERVIDO: 'Servido',
  };

  const STATUS_BADGE: Record<string, 'info' | 'warning' | 'success' | 'neutral'> = {
    CRUDO: 'info',
    COCINANDO: 'warning',
    COCIDO: 'success',
    SERVIDO: 'neutral',
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><div className="h-20 bg-park-gray-800 rounded animate-pulse" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Control Pollo"
        description="Produccion en tiempo real - Actualiza cada 15s"
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setShowForm(!showForm)}
          >
            Registrar Lote
          </Button>
        }
      />

      {/* Formulario de produccion */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Card>
            <h3 className="text-lg font-semibold text-park-gray-200 mb-4">Nuevo Lote de Pollos Crudos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-park-gray-400 mb-1">Unidades crudas</label>
                <input
                  type="number"
                  value={rawUnits}
                  onChange={(e) => setRawUnits(e.target.value)}
                  placeholder="20"
                  className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-park-gray-200 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm text-park-gray-400 mb-1">Peso total (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={rawWeightKg}
                  onChange={(e) => setRawWeightKg(e.target.value)}
                  placeholder="50.0"
                  className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-park-gray-200 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm text-park-gray-400 mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Lote manana"
                  className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-park-gray-200 min-h-[44px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleLogProduction} loading={submitting}>
                {submitting ? 'Registrando...' : 'Registrar'}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Alerta de merma excesiva */}
      {summary && summary.total_raw_units > 0 &&
        (summary.total_waste_units / summary.total_raw_units) > 0.1 && (
          <Alert
            variant="warning"
            title="Merma excesiva"
            description={`La merma del dia (${summary.total_waste_units} uds) supera el 10% del total ingresado (${summary.total_raw_units} uds). Revisa el proceso de coccion.`}
          />
        )}

      {/* 4 Tarjetas Metricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Crudo en Stock"
          value={equivalents?.raw_in_stock ?? 0}
          icon={<Egg className="w-5 h-5 text-sky-400" />}
        />
        <MetricCard
          label="Cocinando"
          value={equivalents?.cooking ?? 0}
          icon={<Flame className="w-5 h-5 text-amber-400" />}
        />
        <MetricCard
          label="Cocido Disponible"
          value={equivalents?.cooked_available ?? 0}
          icon={<ChefHat className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          label="Vendido Hoy"
          value={equivalents?.sold_today ?? 0}
          icon={<ShoppingCart className="w-5 h-5 text-violet-400" />}
        />
      </div>

      {/* Rendimiento + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <YieldGauge percent={summary?.avg_yield_percent ?? 0} />

        {/* Alertas */}
        <Card>
          <div className="text-sm text-park-gray-400 mb-3">Alertas del Dia</div>
          {summary?.anomalies && summary.anomalies.length > 0 ? (
            <div className="space-y-2">
              {summary.anomalies.map((a: any, i: number) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-3 rounded-lg ${
                    a.level === 'CRITICAL'
                      ? 'bg-red-900/20 border border-red-800'
                      : 'bg-amber-900/20 border border-amber-800'
                  }`}
                >
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    a.level === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'
                  }`} />
                  <span className={`text-sm ${
                    a.level === 'CRITICAL' ? 'text-red-300' : 'text-amber-300'
                  }`}>
                    {a.message}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm">Sin anomalias detectadas</span>
            </div>
          )}

          {/* Resumen numerico */}
          {summary && (
            <div className="mt-4 pt-4 border-t border-park-gray-800 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-park-gray-500">Ingresados:</span>
                <span className="ml-2 text-park-gray-200">{summary.total_raw_units}</span>
              </div>
              <div>
                <span className="text-park-gray-500">Cocidos:</span>
                <span className="ml-2 text-park-gray-200">{summary.total_cooked_units}</span>
              </div>
              <div>
                <span className="text-park-gray-500">Merma:</span>
                <span className="ml-2 text-park-gray-200">{summary.total_waste_units}</span>
              </div>
              <div>
                <span className="text-park-gray-500">Sin contabilizar:</span>
                <span className={`ml-2 ${summary.unaccounted_units > 0 ? 'text-red-400' : 'text-park-gray-200'}`}>
                  {summary.unaccounted_units}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Historial de Lotes */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-park-gray-800">
          <h3 className="text-lg font-semibold text-park-gray-200">Lotes del Dia</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                <th className="text-left py-3 px-4 text-park-gray-400 font-medium">Lote</th>
                <th className="text-center py-3 px-4 text-park-gray-400 font-medium">Crudos</th>
                <th className="text-center py-3 px-4 text-park-gray-400 font-medium">Peso (kg)</th>
                <th className="text-center py-3 px-4 text-park-gray-400 font-medium">Cocidos</th>
                <th className="text-center py-3 px-4 text-park-gray-400 font-medium">Rendimiento</th>
                <th className="text-center py-3 px-4 text-park-gray-400 font-medium">Merma</th>
                <th className="text-center py-3 px-4 text-park-gray-400 font-medium">Estado</th>
                <th className="text-center py-3 px-4 text-park-gray-400 font-medium">Accion</th>
              </tr>
            </thead>
            <tbody>
              {(history as ProductionLog[]).length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-park-gray-500">
                    No hay lotes registrados hoy
                  </td>
                </tr>
              ) : (
                (history as ProductionLog[]).map((log) => (
                  <tr key={log.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                    <td className="py-3 px-4 text-park-gray-200 font-mono">#{log.batch_number}</td>
                    <td className="py-3 px-4 text-center text-park-gray-300">{log.raw_units}</td>
                    <td className="py-3 px-4 text-center text-park-gray-300">{log.raw_weight_kg}</td>
                    <td className="py-3 px-4 text-center text-park-gray-300">{log.cooked_units ?? '\u2014'}</td>
                    <td className="py-3 px-4 text-center">
                      {log.yield_percent != null ? (
                        <span className={
                          log.yield_percent >= 68 && log.yield_percent <= 76
                            ? 'text-emerald-400'
                            : log.yield_percent < 60 || log.yield_percent > 85
                              ? 'text-red-400'
                              : 'text-amber-400'
                        }>
                          {log.yield_percent}%
                        </span>
                      ) : '\u2014'}
                    </td>
                    <td className="py-3 px-4 text-center text-park-gray-300">{log.waste_units ?? '\u2014'}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={STATUS_BADGE[log.status] ?? 'neutral'}>
                        {STATUS_LABELS[log.status] ?? log.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {log.status === 'CRUDO' || log.status === 'COCINANDO' ? (
                        completingId === log.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="Uds"
                              value={cookedUnits}
                              onChange={(e) => setCookedUnits(e.target.value)}
                              className="w-16 px-2 py-1 bg-park-gray-800 border border-park-gray-700 rounded text-sm text-park-gray-200"
                            />
                            <input
                              type="number"
                              step="0.1"
                              placeholder="Kg"
                              value={cookedWeightKg}
                              onChange={(e) => setCookedWeightKg(e.target.value)}
                              className="w-16 px-2 py-1 bg-park-gray-800 border border-park-gray-700 rounded text-sm text-park-gray-200"
                            />
                            <input
                              type="number"
                              placeholder="Merma"
                              value={wasteUnits}
                              onChange={(e) => setWasteUnits(e.target.value)}
                              className="w-16 px-2 py-1 bg-park-gray-800 border border-park-gray-700 rounded text-sm text-park-gray-200"
                            />
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleComplete(log.id)}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCompletingId(log.id)}
                          >
                            Completar
                          </Button>
                        )
                      ) : (
                        <span className="text-park-gray-600 text-xs">Completado</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
