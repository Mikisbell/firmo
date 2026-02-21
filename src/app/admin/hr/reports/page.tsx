'use client';

/**
 * HR Reports Page - Reportes y Analytics
 * Admin view for generating and viewing HR reports.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { BarChart3, Download, AlertTriangle, TrendingUp, Users, Clock, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reportes</h1>
          <p className="text-zinc-400 text-sm">Analytics y reportes de Recursos Humanos</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

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
                  ? 'bg-zinc-700 border-zinc-600'
                  : 'bg-zinc-800/50 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? type.color : 'text-zinc-500'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                {type.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Report Content */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6">
        {isLoading ? (
          <div className="text-zinc-400 text-center py-12">Generando reporte...</div>
        ) : error ? (
          <div className="text-red-400 text-center py-12 flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Error al generar reporte
          </div>
        ) : report ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <BarChart3 className={`w-6 h-6 ${selectedType?.color ?? 'text-zinc-400'}`} />
              <div>
                <h2 className="text-lg font-semibold text-white">{report.title}</h2>
                <p className="text-zinc-400 text-sm">
                  Período: {report.period} | Generado: {new Date(report.generatedAt).toLocaleString('es-PE')}
                </p>
              </div>
            </div>

            {report.rows.length === 0 ? (
              <div className="text-zinc-500 text-center py-8">
                No hay datos disponibles para este período. Los datos se generarán cuando se procesen registros de RRHH.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <pre className="text-sm text-zinc-300">
                  {JSON.stringify(report.rows, null, 2)}
                </pre>
              </div>
            )}

            {/* Totals */}
            {Object.keys(report.totals).length > 0 && (
              <div className="border-t border-zinc-700 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-zinc-400 mb-2">Totales</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(report.totals).map(([key, value]) => (
                    <div key={key} className="bg-zinc-900 rounded-lg p-3">
                      <p className="text-xs text-zinc-500">{key}</p>
                      <p className="text-lg font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
