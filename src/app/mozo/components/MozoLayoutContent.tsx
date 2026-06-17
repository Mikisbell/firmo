"use client";

import { usePathname } from "next/navigation";
import { useWaiterContext } from "../context/WaiterContext";
import { BottomNavigation, BottomNavItem } from "@/src/components/ui/BottomNavigation";
import { Utensils, Bell, Settings } from "lucide-react";
import { useResponsive } from "@/src/hooks/useResponsive";

export function MozoLayoutContent({ children }: { children: React.ReactNode }) {
    const { totalAlertsCount, readyItemNotifs, readSet } = useWaiterContext();
    const { isMobile } = useResponsive();
    const pathname = usePathname();

    // No mostrar la navegación inferior si estamos en una pantalla específica (ej. /mozo/mesa/[id])
    const isTableView = pathname.match(/^\/mozo\/mesa\/[a-zA-Z0-9_-]+$/);

    const unreadReadyItems = readyItemNotifs.filter(n => !readSet.has(n.id)).length;

    const navItems: BottomNavItem[] = [
        { 
            id: 'mesas', 
            icon: <Utensils className="w-6 h-6" />, 
            label: 'Mesas', 
            href: '/mozo', 
            badge: totalAlertsCount > 0 ? totalAlertsCount : undefined 
        },
        { 
            id: 'listos', 
            icon: <Bell className="w-6 h-6" />, 
            label: 'Listos', 
            href: '/mozo/listos', 
            badge: unreadReadyItems > 0 ? unreadReadyItems : undefined 
        },
        { 
            id: 'config', 
            icon: <Settings className="w-6 h-6" />, 
            label: 'Config', 
            href: '/mozo/configuracion' 
        },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-park-gray-950">
            <main className="flex-1 pb-16 relative">
                {children}
            </main>
            {isMobile && !isTableView && (
                <BottomNavigation items={navItems} />
            )}
        </div>
    );
}
