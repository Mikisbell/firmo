'use client';

/**
 * RoleGuard - Protege rutas según el rol del empleado en sesión.
 *
 * Se debe usar DENTRO de <AuthProvider> para tener acceso al contexto.
 * Si el rol de la sesión no está en allowedRoles, redirige a "/" inmediatamente.
 *
 * Ejemplo:
 *   <AuthProvider requireAuth>
 *     <RoleGuard allowedRoles={['BAR']}>
 *       {children}
 *     </RoleGuard>
 *   </AuthProvider>
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const { session, isLoading } = useAuth();

  // En desarrollo NO bloqueamos por rol: permite probar todas las estaciones sin
  // re-login (mismo criterio que el bypass de AuthProvider). En produccion se aplica
  // el guard real. Gate de go-live: validar el flujo de roles real antes de lanzar.
  const isDev = process.env.NODE_ENV !== 'production';

  const role = session?.employee_role ?? null;
  const allowed = isDev || (!isLoading && role !== null && allowedRoles.includes(role));

  useEffect(() => {
    if (!isDev && !isLoading && role !== null && !allowedRoles.includes(role)) {
      router.replace('/');
    }
  }, [isDev, isLoading, role, allowedRoles, router]);

  if (!allowed) return null;

  return <>{children}</>;
}
