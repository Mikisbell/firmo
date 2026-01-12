'use client';

import "@/src/app/globals.css";
import { AuthProvider } from '@/src/components/auth';

export default function CocinaLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider requireAuth={true}>
            {children}
        </AuthProvider>
    );
}
