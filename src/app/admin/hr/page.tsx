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
  ClipboardCheck,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  UserPlus,
  Calculator,
  BarChart3,
  Activity,
} from 'lucide-react';
import { Button, Card, MetricCard, PageHeader } from '@/src/components/ui';

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

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-park-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <Card>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Recursos Humanos"
        description="Panel de administracion de personal"
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchMetrics}
            disabled={loading}
          >
            Actualizar
          </Button>
        }
      />

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
          value={metrics.activeEmployees}
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          label="Asistencia Hoy"
          value={`${metrics.attendanceTodayPercent}%`}
          icon={<Clock className="w-5 h-5" />}
        />
        <MetricCard
          label="Permisos Pendientes"
          value={metrics.pendingLeaveRequests}
          icon={<FileText className="w-5 h-5" />}
        />
        <MetricCard
          label="Adelantos Pendientes"
          value={metrics.pendingAdvances}
          icon={<Briefcase className="w-5 h-5" />}
        />
        <MetricCard
          label="Planilla del Mes"
          value="--"
          icon={<DollarSign className="w-5 h-5" />}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Acciones Rapidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/admin/hr/employees?action=new"
            className="flex items-center gap-3 p-3 rounded-lg bg-park-gray-800 hover:bg-park-gray-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Nuevo Empleado</p>
              <p className="text-xs text-park-gray-500">Registrar personal</p>
            </div>
          </Link>
          <Link
            href="/admin/hr/attendance?action=clockin"
            className="flex items-center gap-3 p-3 rounded-lg bg-park-gray-800 hover:bg-park-gray-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Marcar Asistencia</p>
              <p className="text-xs text-park-gray-500">Registrar entrada</p>
            </div>
          </Link>
          <Link
            href="/admin/hr/payroll"
            className="flex items-center gap-3 p-3 rounded-lg bg-park-gray-800 hover:bg-park-gray-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Calcular Planilla</p>
              <p className="text-xs text-park-gray-500">Procesar sueldos</p>
            </div>
          </Link>
          <Link
            href="/admin/hr/attendance?view=report"
            className="flex items-center gap-3 p-3 rounded-lg bg-park-gray-800 hover:bg-park-gray-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Ver Reportes</p>
              <p className="text-xs text-park-gray-500">Informes del mes</p>
            </div>
          </Link>
        </div>
      </Card>

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
              <Link href={section.href}>
                <Card hover className="h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${section.color}`}>
                      <section.icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-park-gray-600 group-hover:text-park-gray-400 transition-colors" />
                  </div>
                  <h3 className="font-semibold mb-1">{section.title}</h3>
                  <p className="text-sm text-park-gray-500">{section.description}</p>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
