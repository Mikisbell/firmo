'use client';

import "@/src/app/globals.css";
import { AuthProvider } from '@/src/components/auth';
import { RoleGuard } from '@/src/components/auth/RoleGuard';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { ADMIN_ROLES } from '@/src/core/constants/roles';
import { PushSubscriptionPrompt } from './components/PushSubscriptionPrompt';
import { useSyncClient } from '@/src/hooks/useSyncClient';

export default function MozoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    useSyncClient(); // ADDED: Global sync for all mozo pages

    return (
        <ErrorBoundary>
            <AuthProvider requireAuth={true}>
                <RoleGuard allowedRoles={['WAITER', 'CASHIER', ...ADMIN_ROLES]}>
                    <PushSubscriptionPrompt />
                    {children}
                </RoleGuard>
            </AuthProvider>
        </ErrorBoundary>
    );
}
