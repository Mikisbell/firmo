'use client';

/**
 * Employee Home / Profile Page
 *
 * Dashboard showing the employee's profile card, quick stats
 * (days worked, vacation balance, next shift), and quick action buttons.
 */

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  User,
  Briefcase,
  CreditCard,
  CalendarDays,
  Palmtree,
  DollarSign,
  Clock,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar');
  return r.json();
});

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero(a)',
  WAITER: 'Mesero(a)',
  KITCHEN: 'Cocina',
  COOK: 'Cocinero(a)',
  SUPERVISOR: 'Supervisor(a)',
  DRIVER: 'Repartidor(a)',
};

const CONTRACT_LABELS: Record<string, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo Fijo',
  PART_TIME: 'Part Time',
};

export default function EmployeeHomePage() {
  const router = useRouter();
  const { data: profile, error: profileError, isLoading: profileLoading } = useSWR('/api/hr/me', fetcher);
  const { data: vacationBalance } = useSWR('/api/hr/me/vacation-balance', fetcher);
  const { data: schedule } = useSWR('/api/hr/me/schedule', fetcher);

  // Compute current month for attendance query
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: attendance } = useSWR(`/api/hr/me/attendance?month=${currentMonth}`, fetcher);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-zinc-400 text-sm">No se pudo cargar tu perfil</p>
      </div>
    );
  }

  // Calculate days worked this month
  const daysWorkedThisMonth = Array.isArray(attendance)
    ? attendance.filter((a: { status: string }) => a.status === 'PRESENT' || a.status === 'LATE').length
    : 0;

  // Find next scheduled shift
  const now = new Date();
  const nextShift = Array.isArray(schedule)
    ? schedule.find((s: { date: string }) => new Date(s.date) >= now)
    : null;

  return (
    <div className="space-y-5">
      {/* Profile Card */}
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <span className="text-amber-400 font-bold text-xl">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{profile?.name}</h2>
            <p className="text-amber-400 text-sm font-medium">
              {ROLE_LABELS[profile?.role] || profile?.role}
            </p>
            {profile?.position && (
              <p className="text-zinc-400 text-sm mt-0.5">{profile.position}</p>
            )}
          </div>
        </div>

        {/* Profile details */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {profile?.dni && (
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="text-zinc-300">DNI: {profile.dni}</span>
            </div>
          )}
          {profile?.hire_date && (
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="text-zinc-300">Desde {formatDate(profile.hire_date)}</span>
            </div>
          )}
          {profile?.contract_type && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="text-zinc-300">{CONTRACT_LABELS[profile.contract_type] || profile.contract_type}</span>
            </div>
          )}
          {profile?.phone && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="text-zinc-300 truncate">{profile.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
            <CalendarDays className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-lg font-bold">{daysWorkedThisMonth}</p>
          <p className="text-[10px] text-zinc-500 leading-tight">Dias trabajados</p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center mx-auto mb-2">
            <Palmtree className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-lg font-bold">
            {vacationBalance?.available_days ?? '--'}
          </p>
          <p className="text-[10px] text-zinc-500 leading-tight">Vacaciones disp.</p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          {nextShift ? (
            <>
              <p className="text-sm font-bold">{nextShift.shift_start}</p>
              <p className="text-[10px] text-zinc-500 leading-tight">
                {new Date(nextShift.date).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' })}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold">--</p>
              <p className="text-[10px] text-zinc-500 leading-tight">Proximo turno</p>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Acciones rapidas</h3>
        <button
          onClick={() => router.push('/employee/vacation')}
          className="w-full flex items-center gap-3 bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-colors min-h-[52px]"
        >
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
            <Palmtree className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Solicitar Vacaciones</p>
            <p className="text-xs text-zinc-500">Enviar solicitud de descanso</p>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>

        <button
          onClick={() => router.push('/employee/payslips')}
          className="w-full flex items-center gap-3 bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-colors min-h-[52px]"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Ver Boletas de Pago</p>
            <p className="text-xs text-zinc-500">Historial de remuneraciones</p>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>

        <button
          onClick={() => router.push('/employee/attendance')}
          className="w-full flex items-center gap-3 bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-colors min-h-[52px]"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Mi Asistencia</p>
            <p className="text-xs text-zinc-500">Registro de marcaciones del mes</p>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>
      </div>

      {/* Salary info (if available) */}
      {profile?.base_salary_cents > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Salario Base Mensual</p>
              <p className="text-lg font-bold text-green-400">
                {formatCurrency(profile.base_salary_cents)}
              </p>
            </div>
            {profile?.pension_system && (
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">
                {profile.pension_system.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
