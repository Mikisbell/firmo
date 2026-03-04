'use client';

// src/app/pos/layout.tsx
// Layout for POS routes - requires authentication

import { AuthProvider } from '@/src/components/auth';
import { RoleGuard } from '@/src/components/auth/RoleGuard';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <AuthProvider requireAuth={true}>
        <RoleGuard allowedRoles={[...ADMIN_ROLES, 'CASHIER']}>
          {children}
        </RoleGuard>
      </AuthProvider>
    </ErrorBoundary>
  );
}
