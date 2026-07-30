import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { PWAProvider } from "@/src/components/pwa/PWAProvider";
import { SWRProvider } from "@/src/components/providers/SWRProvider";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const viewport: Viewport = {
    themeColor: "#09090b",
    viewportFit: "cover",
};

export const metadata: Metadata = {
    title: "FIRMO POS",
    description: "Sistema POS offline-first para pollerías y parrilleras peruanas. Facturación SUNAT, multi-terminal, KDS cocina, gestión de personal.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "FIRMO POS",
    },
    icons: {
        icon: [
            { url: "/images/logo/logo.png", type: "image/png" },
        ],
        shortcut: "/images/logo/logo.png",
        apple: "/images/logo/logo.png",
    },
    openGraph: {
        title: "FIRMO POS",
        description: "Sistema POS offline-first para pollerías y parrilleras peruanas",
        siteName: "FIRMO POS",
        type: "website",
        locale: "es_PE",
    },
    twitter: {
        card: "summary_large_image",
        title: "FIRMO POS",
        description: "Sistema POS offline-first para pollerías y parrilleras peruanas",
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" className={`dark ${inter.variable}`} suppressHydrationWarning>
            <head>
                {/* Preconnect to external domains for faster resource loading */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                
                {/* DNS prefetch for external services */}
                <link rel="dns-prefetch" href="https://vercel.live" />
            </head>
            <body className={`${inter.className} bg-zinc-950 text-white antialiased`}>
                <ErrorBoundary>
                    <SWRProvider>
                        <PWAProvider>
                            {children}
                        </PWAProvider>
                        <Toaster position="top-center" richColors theme="dark" />
                    </SWRProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}
