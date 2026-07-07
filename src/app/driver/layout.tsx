import "@/src/app/globals.css";

export const metadata = {
    title: "FIRMO POS — Motorizado",
    description: "App de entregas para motorizado",
};

export default function DriverLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
            {children}
        </div>
    );
}
