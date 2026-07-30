import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { PWAProvider } from "@/src/components/pwa/PWAProvider";
import { SWRProvider } from "@/src/components/providers/SWRProvider";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const viewport: Viewport = {
  themeColor: "#0A0E14",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "FIRMO POS — By FreeCloud",
  description: "Sistema POS offline-first desarrollado por FreeCloud para pollerías y restaurantes peruanos. Facturación SUNAT, multi-terminal y KDS cocina.",
  manifest: "/manifest.json",
  authors: [{ name: "FreeCloud" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FIRMO POS",
  },
  icons: {
    icon: [
      { url: "/images/logo/logo-freecloud.ico", type: "image/x-icon" },
      { url: "/images/logo/logo.png", type: "image/png" },
    ],
    shortcut: "/images/logo/logo-freecloud.ico",
    apple: "/images/logo/logo.png",
  },
  openGraph: {
    title: "FIRMO POS — By FreeCloud",
    description: "Sistema POS offline-first desarrollado por FreeCloud para pollerías y restaurantes peruanos",
    siteName: "FIRMO POS",
    type: "website",
    locale: "es_PE",
  },
  twitter: {
    card: "summary_large_image",
    title: "FIRMO POS — By FreeCloud",
    description: "Sistema POS offline-first desarrollado por FreeCloud para pollerías y restaurantes peruanos",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://vercel.live" />
      </head>
      <body className={`${inter.className} bg-[#0A0E14] text-white antialiased`}>
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
