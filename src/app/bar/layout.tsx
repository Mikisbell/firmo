import "@/src/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "PARK | Bar",
    description: "Sistema de Pantalla de Cocina - Bar",
};

export default function BarLayout({ children }: { children: React.ReactNode }) {
    // Layout simple - la página maneja su propio diseño
    return <>{children}</>;
}
