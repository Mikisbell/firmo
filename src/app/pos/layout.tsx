'use client';

// src/app/pos/layout.tsx
// Layout for POS routes - requires authentication

import { AuthProvider } from '@/src/components/auth';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <AuthProvider requireAuth={true}>
        {children}
      </AuthProvider>
    </ErrorBoundary>
  );
}
