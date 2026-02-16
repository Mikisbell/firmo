'use client';

/**
 * Admin Notification Management Page
 * Gestión de suscripciones push y envío de notificaciones de prueba
 * 
 * Features:
 * - Ver estado de suscripción de empleados
 * - Alerta para empleados inactivos > 7 días
 * - Enviar notificación de prueba
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  BellOff,
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
} from 'lucide-react';
import type { EmployeeSubscriptionStatus } from '@/src/core/notifications/types';
import { useNotificationStatus } from '@/src/hooks/useSWRHooks';

export default function NotificacionesAdminPage() {
  // Migrado a SWR - Tarea 9.3 Lote 2
  const { data, error: swrError, isLoading: loading, mutate } = useNotificationStatus();
  const employees = data?.employees || [];
  
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(swrError ? 'Error al cargar estado de notificaciones' : null);

  const fetchStatus = useCallback(() => {
    // Revalidar datos con SWR
    mutate();
  }, [mutate]);

  const sendTestNotification = async (employeeId: string, employeeName: string) => {
    try {
      setSendingTo(employeeId);
      setSuccessMessage(null);
      
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include httpOnly cookies for authentication
        body: JSON.stringify({ employee_id: employeeId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al enviar');
      }

      setSuccessMessage(`Notificación enviada a ${employeeName}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar notificación');
    } finally {
      setSendingTo(null);
    }
  };

  const subscribedCount = employees.filter(e => e.has_subscription).length;
  const inactiveCount = employees.filter(e => e.days_inactive > 7).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-400" />
            Notificaciones Push
          </h1>
          <p className="text-zinc-400 mt-1">
            Gestionar suscripciones y enviar notificaciones de prueba
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          label="Total Empleados"
          value={employees.length}
          icon={User}
          color="text-zinc-400"
        />
        <SummaryCard
          label="Con Suscripción"
          value={subscribedCount}
          icon={Bell}
          color="text-green-400"
        />
        <SummaryCard
          label="Inactivos (+7 días)"
          value={inactiveCount}
          icon={AlertTriangle}
          color={inactiveCount > 0 ? 'text-amber-400' : 'text-zinc-400'}
        />
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          {successMessage}
        </motion.div>
      )}

      {/* Employee List */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="font-semibold">Estado de Suscripciones</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No hay empleados registrados
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {employees.map((employee) => (
              <EmployeeRow
                key={employee.employee_id}
                employee={employee}
                onSendTest={() => sendTestNotification(employee.employee_id, employee.employee_name)}
                isSending={sendingTo === employee.employee_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ============ COMPONENTS ============

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function EmployeeRow({
  employee,
  onSendTest,
  isSending,
}: {
  employee: EmployeeSubscriptionStatus;
  onSendTest: () => void;
  isSending: boolean;
}) {
  const isInactive = employee.days_inactive > 7;
  const hasSubscription = employee.has_subscription;

  return (
    <div className={`flex items-center justify-between p-4 ${isInactive ? 'bg-amber-500/5' : ''}`}>
      <div className="flex items-center gap-3">
        {/* Status Icon */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          hasSubscription 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-zinc-700 text-zinc-500'
        }`}>
          {hasSubscription ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
        </div>

        {/* Employee Info */}
        <div>
          <p className="font-medium">{employee.employee_name}</p>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {hasSubscription ? (
              <>
                <CheckCircle className="w-3 h-3 text-green-400" />
                <span>Suscrito</span>
                {employee.last_active && (
                  <>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>
                      {employee.days_inactive === 0 
                        ? 'Activo hoy' 
                        : `Hace ${employee.days_inactive} días`}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span>Sin suscripción</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isInactive && (
          <span className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-full flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Inactivo
          </span>
        )}
        
        {hasSubscription && (
          <button
            onClick={onSendTest}
            disabled={isSending}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            {isSending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            Probar
          </button>
        )}
      </div>
    </div>
  );
}
