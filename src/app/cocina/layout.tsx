'use client';

import "@/src/app/globals.css";
import { AuthProvider } from '@/src/components/auth';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

export default function CocinaLayout({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary>
            <AuthProvider requireAuth={true}>
                {children}
            </AuthProvider>
        </ErrorBoundary>
    );
}
