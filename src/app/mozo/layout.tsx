import "@/src/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "PARK | Mozo",
    description: "Terminal de Pedidos Móvil",
};

export default function WaiterLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
            {/* Mobile Header */}
            <header className="h-14 border-b border-zinc-800 flex items-center px-4 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
                <div className="font-bold text-lg text-emerald-400 mr-auto">PARK <span className="text-xs text-zinc-500 font-normal">MOZO</span></div>
                <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Online" />
                </div>
            </header>

            {/* Main Content (Scrollable) */}
            <main className="flex-1 overflow-y-auto p-4">
                {children}
            </main>

            {/* Mobile Bottom Nav */}
            <nav className="h-16 border-t border-zinc-800 bg-zinc-900 grid grid-cols-3 items-center text-xs text-center pb-safe">
                <button className="flex flex-col items-center justify-center h-full text-emerald-400">
                    <span className="text-xl">🍽️</span>
                    Mesas
                </button>
                <button className="flex flex-col items-center justify-center h-full text-zinc-500">
                    <span className="text-xl">⚡</span>
                    Rápido
                </button>
                <button className="flex flex-col items-center justify-center h-full text-zinc-500">
                    <span className="text-xl">⚙️</span>
                    Perfil
                </button>
            </nav>
        </div>
    );
}
