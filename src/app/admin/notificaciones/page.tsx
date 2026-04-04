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
import { Button, Badge, Card, PageHeader, MetricCard } from '@/src/components/ui';

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
      
      const res = await fetch('/api/admin/notifications/test', {
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
      <PageHeader
        title="Notificaciones"
        description="Gestionar suscripciones y enviar notificaciones de prueba"
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchStatus}
            disabled={loading}
          >
            Actualizar
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Total Empleados"
          value={employees.length}
          icon={<User className="w-5 h-5" />}
        />
        <MetricCard
          label="Con Suscripción"
          value={subscribedCount}
          icon={<Bell className="w-5 h-5" />}
        />
        <MetricCard
          label="Inactivos (+7 días)"
          value={inactiveCount}
          icon={<AlertTriangle className="w-5 h-5" />}
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
      <Card padding="none">
        <div className="p-4 border-b border-park-gray-800">
          <h2 className="font-semibold text-white">Estado de Suscripciones</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-park-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center text-park-gray-500">
            No hay empleados registrados
          </div>
        ) : (
          <div className="divide-y divide-park-gray-800">
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
      </Card>
    </div>
  );
}


// ============ COMPONENTS ============

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
          <Badge variant="warning" dot>Inactivo</Badge>
        )}
        
        {hasSubscription && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSendTest}
            disabled={isSending}
            icon={isSending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            className="text-blue-400"
          >
            Probar
          </Button>
        )}
      </div>
    </div>
  );
}
