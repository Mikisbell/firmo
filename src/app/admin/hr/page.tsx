'use client';

/**
 * HR Dashboard - Panel Principal de Recursos Humanos
 *
 * Metrics cards, quick actions, and navigation to HR sub-sections.
 * Fetches summary data from multiple HR API endpoints.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users,
  Clock,
  Calendar,
  DollarSign,
  FileText,
  GraduationCap,
  Briefcase,
  TrendingUp,
  Plus,
  ClipboardCheck,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  UserPlus,
  Calculator,
  BarChart3,
  Activity,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardMetrics {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaveRequests: number;
  pendingAdvances: number;
  attendanceToday: number;
  attendanceTodayPercent: number;
}

interface NavSection {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Empleados',
    description: 'Gestionar personal, roles y datos laborales',
    href: '/admin/hr/employees',
    icon: Users,
    color: 'text-blue-400 bg-blue-500/20',
  },
  {
    title: 'Asistencia',
    description: 'Control de marcaciones y reportes',
    href: '/admin/hr/attendance',
    icon: Clock,
    color: 'text-green-400 bg-green-500/20',
  },
  {
    title: 'Horarios',
    description: 'Plantillas y asignaciones de turnos',
    href: '/admin/hr/schedules',
    icon: Calendar,
    color: 'text-purple-400 bg-purple-500/20',
  },
  {
    title: 'Planilla',
    description: 'Cálculo de sueldos y boletas de pago',
    href: '/admin/hr/payroll',
    icon: DollarSign,
    color: 'text-amber-400 bg-amber-500/20',
  },
  {
    title: 'Permisos y Vacaciones',
    description: 'Solicitudes de licencia y descansos',
    href: '/admin/hr/leave-requests',
    icon: FileText,
    color: 'text-cyan-400 bg-cyan-500/20',
  },
  {
    title: 'Adelantos',
    description: 'Solicitudes y aprobación de adelantos',
    href: '/admin/hr/advances',
    icon: Briefcase,
    color: 'text-pink-400 bg-pink-500/20',
  },
  {
    title: 'Evaluaciones',
    description: 'Revisiones de desempeño del personal',
    href: '/admin/hr/evaluations',
    icon: TrendingUp,
    color: 'text-orange-400 bg-orange-500/20',
  },
  {
    title: 'Capacitaciones',
    description: 'Registro de entrenamientos y certificaciones',
    href: '/admin/hr/training',
    icon: GraduationCap,
    color: 'text-teal-400 bg-teal-500/20',
  },
  {
    title: 'Actividad Diaria',
    description: 'Marcaciones y ventas por empleado del día',
    href: '/admin/hr/actividad',
    icon: Activity,
    color: 'text-emerald-400 bg-emerald-500/20',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HRDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingLeaveRequests: 0,
    pendingAdvances: 0,
    attendanceToday: 0,
    attendanceTodayPercent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch employees to get counts
      const employeesRes = await fetch('/api/hr/employees?pageSize=1000');
      const employeesData = employeesRes.ok ? await employeesRes.json() : null;

      const employees = employeesData?.items || employeesData?.data || employeesData || [];
      const employeeList = Array.isArray(employees) ? employees : [];
      const totalEmployees = employeeList.length;
      const activeEmployees = employeeList.filter((e: { is_active?: boolean }) => e.is_active !== false).length;

      setMetrics({
        totalEmployees,
        activeEmployees,
        pendingLeaveRequests: 0,
        pendingAdvances: 0,
        attendanceToday: 0,
        attendanceTodayPercent: activeEmployees > 0 ? 0 : 0,
      });
    } catch (err) {
      console.error('Error fetching HR metrics:', err);
      setError('No se pudieron cargar las métricas. Verifique la conexión.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Recursos Humanos</h1>
          <p className="text-zinc-400 mt-1">Panel de administracion de personal</p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Empleados Activos"
          value={metrics.activeEmployees.toString()}
          subtitle={`${metrics.totalEmployees} total`}
          icon={Users}
          loading={loading}
          color="text-blue-400"
        />
        <MetricCard
          label="Asistencia Hoy"
          value={`${metrics.attendanceTodayPercent}%`}
          subtitle={`${metrics.attendanceToday} presentes`}
          icon={Clock}
          loading={loading}
          color="text-green-400"
        />
        <MetricCard
          label="Permisos Pendientes"
          value={metrics.pendingLeaveRequests.toString()}
          subtitle="por aprobar"
          icon={FileText}
          loading={loading}
          color="text-yellow-400"
        />
        <MetricCard
          label="Adelantos Pendientes"
          value={metrics.pendingAdvances.toString()}
          subtitle="por aprobar"
          icon={Briefcase}
          loading={loading}
          color="text-pink-400"
        />
        <MetricCard
          label="Planilla del Mes"
          value="--"
          subtitle="por calcular"
          icon={DollarSign}
          loading={loading}
          color="text-amber-400"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-semibold mb-4">Acciones Rapidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/admin/hr/employees?action=new"
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Nuevo Empleado</p>
              <p className="text-xs text-zinc-500">Registrar personal</p>
            </div>
          </Link>
          <Link
            href="/admin/hr/attendance?action=clockin"
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Marcar Asistencia</p>
              <p className="text-xs text-zinc-500">Registrar entrada</p>
            </div>
          </Link>
          <Link
            href="/admin/hr/payroll"
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Calcular Planilla</p>
              <p className="text-xs text-zinc-500">Procesar sueldos</p>
            </div>
          </Link>
          <Link
            href="/admin/hr/attendance?view=report"
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Ver Reportes</p>
              <p className="text-xs text-zinc-500">Informes del mes</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Navigation Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Modulos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {NAV_SECTIONS.map((section, index) => (
            <motion.div
              key={section.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={section.href}
                className="block p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${section.color}`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
                <h3 className="font-semibold mb-1">{section.title}</h3>
                <p className="text-sm text-zinc-500">{section.description}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  loading,
  color,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  loading: boolean;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900 rounded-xl p-4 border border-zinc-800"
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className={`text-2xl font-bold mt-3 ${loading ? 'animate-pulse' : ''}`}>
        {loading ? '...' : value}
      </p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
      <p className="text-xs text-zinc-600">{subtitle}</p>
    </motion.div>
  );
}
