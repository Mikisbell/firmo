import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "PARK POS",
    description: "Offline-First Point of Sale",
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
                {children}
                <Toaster position="top-center" richColors theme="dark" />
            </body>
        </html>
    );
}
