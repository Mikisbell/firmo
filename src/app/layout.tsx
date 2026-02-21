import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { PWAProvider } from "@/src/components/pwa/PWAProvider";
import { SWRProvider } from "@/src/components/providers/SWRProvider";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
    themeColor: "#10b981",
};

export const metadata: Metadata = {
    title: "PARK POS",
    description: "Sistema POS offline-first para pollerías y parrilleras peruanas. Facturación SUNAT, multi-terminal, KDS cocina, gestión de personal.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "PARK POS",
    },
    icons: {
        icon: [
            { url: "/icon.svg", type: "image/svg+xml" },
            { url: "/images/favicon.ico", sizes: "any" },
            { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        ],
        apple: "/images/apple-touch-icon.png",
    },
    openGraph: {
        title: "PARK POS",
        description: "Sistema POS offline-first para pollerías y parrilleras peruanas",
        siteName: "PARK POS",
        type: "website",
        locale: "es_PE",
    },
    twitter: {
        card: "summary_large_image",
        title: "PARK POS",
        description: "Sistema POS offline-first para pollerías y parrilleras peruanas",
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" className="dark">
            <head>
                {/* Preconnect to external domains for faster resource loading */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                
                {/* DNS prefetch for external services */}
                <link rel="dns-prefetch" href="https://vercel.live" />
            </head>
            <body className={`${inter.className} bg-zinc-950 text-white antialiased`}>
                <SWRProvider>
                    <PWAProvider>
                        {children}
                    </PWAProvider>
                    <Toaster position="top-center" richColors theme="dark" />
                </SWRProvider>
            </body>
        </html>
    );
}
