'use client';

import "@/src/app/globals.css";
import { AuthProvider } from '@/src/components/auth';
import { RoleGuard } from '@/src/components/auth/RoleGuard';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

export default function BarLayout({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary>
            <AuthProvider requireAuth={true}>
                <RoleGuard allowedRoles={['BAR']}>
                    {children}
                </RoleGuard>
            </AuthProvider>
        </ErrorBoundary>
    );
}
