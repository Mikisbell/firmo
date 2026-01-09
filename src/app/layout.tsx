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
            <body className={`${inter.className} bg-zinc-950 text-white antialiased`}>
                <PWAProvider>
                    {children}
                </PWAProvider>
                <Toaster position="top-center" richColors theme="dark" />
            </body>
        </html>
    );
}
