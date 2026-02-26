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

  const role = session?.employee_role ?? null;
  const allowed = !isLoading && role !== null && allowedRoles.includes(role);

  useEffect(() => {
    if (!isLoading && role !== null && !allowedRoles.includes(role)) {
      router.replace('/');
    }
  }, [isLoading, role, allowedRoles, router]);

  if (isLoading || !allowed) return null;

  return <>{children}</>;
}
