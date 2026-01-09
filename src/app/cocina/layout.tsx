import "@/src/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "PARK | SPC",
    description: "Sistema de Pantalla de Cocina",
};

export default function SPCLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Layout simple - cada página maneja su propio diseño
    return <>{children}</>;
}
