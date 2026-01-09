'use client';

// src/app/pos/layout.tsx
// Layout for POS routes - requires authentication

import { AuthProvider } from '@/src/components/auth';

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider requireAuth={true}>
      {children}
    </AuthProvider>
  );
}
