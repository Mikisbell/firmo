import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { PWAProvider } from "@/src/components/pwa/PWAProvider";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
    themeColor: "#4f46e5",
};

export const metadata: Metadata = {
    title: "PARK POS",
    description: "Offline-First Point of Sale",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "PARK POS",
    },
    icons: {
        icon: [
            { url: "/images/favicon.ico", sizes: "any" },
            { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
            { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        ],
        apple: "/images/apple-touch-icon.png",
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
                {/* Preload critical resources for improved TTFB and FCP */}
                {/* Preload Inter font (variable font) - Next.js optimizes this automatically */}
                <link
                    rel="preload"
                    href="/_next/static/media/inter-latin.woff2"
                    as="font"
                    type="font/woff2"
                    crossOrigin="anonymous"
                />
                
                {/* Preload critical CSS - Next.js bundles this automatically */}
                <link
                    rel="preload"
                    href="/_next/static/css/app/layout.css"
                    as="style"
                />
                
                {/* Preconnect to external domains for faster resource loading */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                
                {/* DNS prefetch for external services */}
                <link rel="dns-prefetch" href="https://vercel.live" />
            </head>
            <body className={`${inter.className} bg-zinc-950 text-white antialiased`}>
                <PWAProvider>
                    {children}
                </PWAProvider>
                <Toaster position="top-center" richColors theme="dark" />
            </body>
        </html>
    );
}
