import "@/src/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "PARK | KDS",
    description: "Pantalla de Cocina",
};

export default function KDSLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-black text-white font-mono flex flex-col overflow-hidden">
            {/* KDS Header - High Contrast */}
            <header className="h-16 bg-zinc-900 border-b-4 border-emerald-600 flex items-center px-6 justify-between">
                <h1 className="text-3xl font-black tracking-widest text-emerald-500">KDS <span className="text-white">COCINA</span></h1>

                <div className="flex gap-6 text-xl font-bold">
                    <div className="flex items-center gap-2">
                        <span className="text-yellow-400">PENDIENTE:</span>
                        <span>12</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-blue-400">EN PROCESO:</span>
                        <span>5</span>
                    </div>
                    <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse" />
                </div>
            </header>

            {/* Main Grid */}
            <main className="flex-1 p-4 bg-zinc-950 overflow-x-auto">
                {children}
            </main>
        </div>
    );
}
