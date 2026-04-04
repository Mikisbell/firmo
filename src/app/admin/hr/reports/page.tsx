'use client';

/**
 * HR Reports Page - Reportes y Analytics
 * Admin view for generating and viewing HR reports.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { BarChart3, Download, AlertTriangle, TrendingUp, Users, Clock, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, PageHeader } from '@/src/components/ui';

interface Report {
  title: string;
  type: string;
  period: string;
  generatedAt: string;
  rows: unknown[];
  totals: Record<string, number>;
}

const REPORT_TYPES = [
  { value: 'attendance', label: 'Asistencia', icon: Clock, color: 'text-green-400' },
  { value: 'hours', label: 'Horas Trabajadas', icon: Clock, color: 'text-blue-400' },
  { value: 'payroll', label: 'Planilla', icon: DollarSign, color: 'text-amber-400' },
  { value: 'vacation', label: 'Vacaciones', icon: Calendar, color: 'text-cyan-400' },
  { value: 'performance', label: 'Desempeño', icon: TrendingUp, color: 'text-purple-400' },
  { value: 'turnover', label: 'Rotación', icon: Users, color: 'text-red-400' },
  { value: 'labor-cost', label: 'Costos Laborales', icon: DollarSign, color: 'text-orange-400' },
];

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar reporte');
  return r.json();
});

export default function ReportsPage() {
  const now = new Date();
  const [reportType, setReportType] = useState('attendance');
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );

  const { data: report, error, isLoading } = useSWR<Report>(
    `/api/hr/reports?type=${reportType}&period=${period}`,
    fetcher
  );

  const selectedType = REPORT_TYPES.find(t => t.value === reportType);

  function handleExport() {
    toast.success('Exportación iniciada');
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Reportes"
        description="Analytics y reportes de Recursos Humanos"
        actions={
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-park-gray-800 border border-park-gray-700 text-white rounded-lg px-3 py-2 text-sm"
            />
            <Button
              variant="secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExport}
            >
              Exportar
            </Button>
          </div>
        }
      />

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {REPORT_TYPES.map((type) => {
          const Icon = type.icon;
          const isActive = reportType === type.value;
          return (
            <button
              key={type.value}
              onClick={() => setReportType(type.value)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                isActive
                  ? 'bg-park-gray-700 border-park-gray-600'
                  : 'bg-park-gray-800/50 border-zinc-800 hover:border-park-gray-700'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? type.color : 'text-park-gray-500'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-park-gray-500'}`}>
                {type.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Report Content */}
      <Card>
        {isLoading ? (
          <div className="text-park-gray-400 text-center py-12">Generando reporte...</div>
        ) : error ? (
          <div className="text-red-400 text-center py-12 flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Error al generar reporte
          </div>
        ) : report ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <BarChart3 className={`w-6 h-6 ${selectedType?.color ?? 'text-park-gray-400'}`} />
              <div>
                <h2 className="text-lg font-semibold text-white">{report.title}</h2>
                <p className="text-park-gray-400 text-sm">
                  Período: {report.period} | Generado: {new Date(report.generatedAt).toLocaleString('es-PE')}
                </p>
              </div>
            </div>

            {report.rows.length === 0 ? (
              <div className="text-park-gray-500 text-center py-8">
                No hay datos disponibles para este período. Los datos se generarán cuando se procesen registros de RRHH.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <pre className="text-sm text-park-gray-300">
                  {JSON.stringify(report.rows, null, 2)}
                </pre>
              </div>
            )}

            {/* Totals */}
            {Object.keys(report.totals).length > 0 && (
              <div className="border-t border-park-gray-700 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-park-gray-400 mb-2">Totales</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(report.totals).map(([key, value]) => (
                    <div key={key} className="bg-park-gray-900 rounded-lg p-3">
                      <p className="text-xs text-park-gray-500">{key}</p>
                      <p className="text-lg font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
