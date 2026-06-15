import re

with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add new icons to import from lucide-react
content = re.sub(
    r'import { ShoppingCart, Wifi, WifiOff, CloudOff, Cloud, Undo2, Receipt, Truck, Plus, Utensils, LayoutDashboard } from "lucide-react";',
    r'import { ShoppingCart, Wifi, WifiOff, CloudOff, Cloud, Undo2, Receipt, Truck, Plus, Utensils, LayoutDashboard, Menu, Store, History, Settings } from "lucide-react";',
    content
)

# 2. Add current section state
state_block = """    const [cashierView, setCashierView] = useState<CashierView>("PENDING");"""
new_state_block = """    const [cashierView, setCashierView] = useState<CashierView>("PENDING");
    const [currentNavSection, setCurrentNavSection] = useState<"POS" | "ORDERS" | "DELIVERY" | "REPORTS" | "SETTINGS">("POS");"""
content = content.replace(state_block, new_state_block)

# 3. Replace the layout
layout_start = """            {/* Left: Catalog */}
            <div className="flex-1 flex flex-col relative z-0">
                <header className="h-20 px-6 bg-gradient-to-r from-zinc-900/95 to-park-black/95 backdrop-blur-md border-b border-white/5 flex justify-between items-center z-10 sticky top-0 shadow-2xl shadow-black/50">"""

layout_replacement = """            {/* NEW ENTERPRISE LAYOUT - 3 COLUMNS */}

            {/* COLUMN 1: SIDEBAR NAVIGATION */}
            <nav className="w-[88px] bg-zinc-950 border-r border-white/5 flex flex-col items-center py-6 gap-6 z-30 shrink-0 shadow-2xl shadow-black">
                <div className="mb-4">
                    <ParkLogo size={44} className="rounded-xl shadow-lg" />
                </div>
                
                <div className="flex flex-col gap-4 flex-1 w-full px-3">
                    <button 
                        onClick={() => setCurrentNavSection("POS")}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all duration-200 ${currentNavSection === "POS" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]" : "text-park-gray-400 hover:text-white hover:bg-white/5"}`}
                    >
                        <Store size={24} strokeWidth={currentNavSection === "POS" ? 2.5 : 2} />
                        <span className="text-[10px] font-bold tracking-wider">POS</span>
                    </button>
                    
                    <button 
                        onClick={() => setCurrentNavSection("ORDERS")}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all duration-200 relative ${currentNavSection === "ORDERS" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]" : "text-park-gray-400 hover:text-white hover:bg-white/5"}`}
                    >
                        <Utensils size={24} strokeWidth={currentNavSection === "ORDERS" ? 2.5 : 2} />
                        <span className="text-[10px] font-bold tracking-wider">MESAS</span>
                        {liveOrders.length > 0 && (
                            <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-zinc-950 animate-pulse"></span>
                        )}
                    </button>
                    
                    <button 
                        onClick={() => setCurrentNavSection("DELIVERY")}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all duration-200 ${currentNavSection === "DELIVERY" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]" : "text-park-gray-400 hover:text-white hover:bg-white/5"}`}
                    >
                        <Truck size={24} strokeWidth={currentNavSection === "DELIVERY" ? 2.5 : 2} />
                        <span className="text-[10px] font-bold tracking-wider">ENVÍOS</span>
                    </button>
                    
                    <button 
                        onClick={() => setCurrentNavSection("REPORTS")}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all duration-200 ${currentNavSection === "REPORTS" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]" : "text-park-gray-400 hover:text-white hover:bg-white/5"}`}
                    >
                        <History size={24} strokeWidth={currentNavSection === "REPORTS" ? 2.5 : 2} />
                        <span className="text-[10px] font-bold tracking-wider">HISTORIAL</span>
                    </button>
                </div>
                
                <div className="flex flex-col gap-4 w-full px-3 mt-auto">
                    {/* Shift Status inside sidebar */}
                    <ShiftStatus
                        isOpen={shiftIsOpen}
                        shiftId={shift?.shift_id}
                        expectedCash={shift?.expected_cash_cents ?? 0}
                        openedAt={shift?.opened_at}
                        employeeName={session?.employee_name ?? "Sin sesión"}
                        onOpenClick={() => openShiftModal("open")}
                        onCloseClick={() => openShiftModal("close")}
                        onMovementsClick={() => openShiftModal("movements")}
                    />
                    
                    {/* Employee Profile */}
                    {session && (
                        <EmployeeProfileButton
                            employeeName={session.employee_name}
                            employeeRole={session.employee_role}
                            accentColor="emerald"
                            onOpenDrawer={() => setProfileOpen(true)}
                            onLogout={handleSimpleLogout}
                        />
                    )}
                </div>
            </nav>

            {/* COLUMN 2: MAIN CENTRAL AREA */}
            <div className="flex-1 flex flex-col relative z-0 bg-park-black">
                <header className="h-16 px-6 bg-zinc-900/40 backdrop-blur-md border-b border-white/5 flex justify-between items-center z-10 sticky top-0">"""
content = content.replace(layout_start, layout_replacement)

# 4. Remove the old header components that were moved to the sidebar (Logo, EmployeeProfileButton, ShiftStatus)
header_inner_start = """                    <div className="flex items-center gap-3">
                        <ParkLogo size={40} className="rounded-xl shadow-lg" />
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">
                                <span className="text-emerald-400">CAJA</span>
                                <span className="text-white ml-1">PRINCIPAL</span>
                            </h1>
                            <p className="text-emerald-300/50 text-[10px] uppercase tracking-widest">Cobros • Delivery • Reportes</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Employee Profile Button */}
                        {session && (
                            <EmployeeProfileButton
                                employeeName={session.employee_name}
                                employeeRole={session.employee_role}
                                accentColor="emerald"
                                onOpenDrawer={() => setProfileOpen(true)}
                                onLogout={handleSimpleLogout}
                            />
                        )}

                        {/* Shift Status */}
                        <ShiftStatus
                            isOpen={shiftIsOpen}
                            shiftId={shift?.shift_id}
                            expectedCash={shift?.expected_cash_cents ?? 0}
                            openedAt={shift?.opened_at}
                            employeeName={session?.employee_name ?? "Sin sesión"}
                            onOpenClick={() => openShiftModal("open")}
                            onCloseClick={() => openShiftModal("close")}
                            onMovementsClick={() => openShiftModal("movements")}
                        />"""

new_header_inner = """                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-white">
                                {currentNavSection === "POS" && "Terminal de Ventas"}
                                {currentNavSection === "ORDERS" && "Órdenes Activas"}
                                {currentNavSection === "DELIVERY" && "Gestión de Envíos"}
                                {currentNavSection === "REPORTS" && "Historial y Reportes"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">"""
content = content.replace(header_inner_start, new_header_inner)

with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
