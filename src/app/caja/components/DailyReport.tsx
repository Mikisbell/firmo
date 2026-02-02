/**
 * Daily Report Component
 * 
 * Shows daily sales report and Z-report for shift closure.
 */

'use client';

import { useState } from 'react';
import { Printer, Download, TrendingUp, DollarSign, CreditCard, Smartphone } from 'lucide-react';

interface DailyReportProps {
  shift: any;
}

export default function DailyReport({ shift }: DailyReportProps) {
  const [dateRange, setDateRange] = useState('today');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reporte de Ventas</h2>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm text-zinc-400">Ventas Totales</span>
          </div>
          <p className="text-2xl font-bold">S/0.00</p>
        </div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-sm text-zinc-400">Efectivo</span>
          </div>
          <p className="text-2xl font-bold">S/0.00</p>
        </div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-zinc-400">Tarjetas</span>
          </div>
          <p className="text-2xl font-bold">S/0.00</p>
        </div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-zinc-400">Yape/Plin</span>
          </div>
          <p className="text-2xl font-bold">S/0.00</p>
        </div>
      </div>

      {/* Sales Chart Placeholder */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h3 className="font-semibold mb-4">Ventas por Hora</h3>
        <div className="h-64 flex items-center justify-center bg-zinc-800/50 rounded-lg">
          <p className="text-zinc-400">Gráfico de ventas - Implementar con recharts</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h3 className="font-semibold mb-4">Transacciones del Día</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left py-2 px-4 text-sm text-zinc-400">Hora</th>
                <th className="text-left py-2 px-4 text-sm text-zinc-400">Orden</th>
                <th className="text-left py-2 px-4 text-sm text-zinc-400">Método</th>
                <th className="text-right py-2 px-4 text-sm text-zinc-400">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="py-8 text-center text-zinc-400">
                  No hay transacciones registradas
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
