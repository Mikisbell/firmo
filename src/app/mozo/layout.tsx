'use client';

import "@/src/app/globals.css";
import { AuthProvider } from '@/src/components/auth';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { PushSubscriptionPrompt } from './components/PushSubscriptionPrompt';

export default function MozoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Mesero requiere autenticación
    return (
        <ErrorBoundary>
            <AuthProvider requireAuth={true}>
                <PushSubscriptionPrompt />
                {children}
            </AuthProvider>
        </ErrorBoundary>
    );
}
