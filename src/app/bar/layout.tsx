import "@/src/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "PARK | Bar",
    description: "Pantalla de Bar",
};

export default function BarLayout({ children }: { children: React.ReactNode }) {
    return children;
}
