with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the content of the main area (from <main className="flex-1 overflow-y-auto"> up to the Right sidebar)
old_main_start = """                <main className="flex-1 overflow-y-auto">
                    {/* View Tabs */}"""
old_main_end = """            {/* Right: Check Detail (or Empty State) */}
            <div className="w-[420px] xl:w-[480px] bg-white shadow-2xl z-20 flex flex-col">"""

new_main = """                <main className="flex-1 overflow-y-auto bg-park-gray-950 p-4">
                    {/* Content based on view */}
                    <div className="w-full h-full">
                        {currentNavSection === "ORDERS" ? (
                            <PendingOrdersList
                                orders={liveOrders}
                                isConnected={sseConnected}
                                onSelectOrder={handleSelectPendingOrder}
                            />
                        ) : currentNavSection === "POS" || currentNavSection === "DELIVERY" ? (
                            <div className="flex flex-col h-full bg-park-black rounded-3xl overflow-hidden border border-white/5 shadow-2xl shadow-black/20">
                                {/* Header for POS/Delivery */}
                                <div className="flex items-center justify-between p-4 bg-zinc-900/60 border-b border-white/5">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setCashierView("DELIVERY");
                                                setNewOrderModalOpen(true);
                                            }}
                                            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20"
                                        >
                                            <Plus size={18} />
                                            NUEVO PEDIDO {currentNavSection === "DELIVERY" && "DELIVERY"}
                                        </button>
                                    </div>
                                    {!shiftIsOpen && (
                                        <p className="text-xs text-park-gray-500">
                                            Abre un turno para crear pedidos
                                        </p>
                                    )}
                                </div>
                                
                                {/* Catalog for adding items */}
                                <div className="flex-1 overflow-y-auto p-2 bg-park-black">
                                    {currentOrder && pendingNewOrder ? (
                                        <>
                                            {/* Current order info banner */}
                                            <div className="m-2 mb-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 shadow-inner">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {pendingNewOrder.order_type === "DELIVERY" ? (
                                                            <Truck size={20} className="text-indigo-400" />
                                                        ) : (
                                                            <Receipt size={20} className="text-indigo-400" />
                                                        )}
                                                        <span className="text-lg font-bold text-white">
                                                            {pendingNewOrder.customer_name}
                                                        </span>
                                                        <span className="text-sm font-mono text-park-gray-400 bg-black/40 px-3 py-1 rounded-full">
                                                            {pendingNewOrder.customer_phone}
                                                        </span>
                                                    </div>
                                                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
                                                        pendingNewOrder.order_type === "DELIVERY"
                                                            ? "bg-purple-500/20 text-purple-400"
                                                            : "bg-blue-500/20 text-blue-400"
                                                    }`}>
                                                        {pendingNewOrder.order_type === "DELIVERY" ? "Delivery" : "Para llevar"}
                                                    </span>
                                                </div>
                                                {pendingNewOrder.delivery_address && (
                                                    <p className="text-sm text-park-gray-400 mt-2 ml-8 flex items-center gap-2">
                                                        <span>📍</span> {pendingNewOrder.delivery_address}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="px-2">
                                                <CatalogGrid
                                                    onAdd={handleAddWithOrderType}
                                                    recommendations={recommendations}
                                                    shiftOpen={shiftIsOpen}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                            <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
                                                <ShoppingCart className="text-park-gray-600 w-10 h-10" />
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">Caja Principal Lista</h3>
                                            <p className="text-park-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
                                                Inicia un "Nuevo Pedido" arriba, o selecciona una orden activa en la sección MESAS.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                                    <LayoutDashboard className="text-park-gray-600 w-10 h-10" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Próximamente</h3>
                                <p className="text-park-gray-400 text-sm max-w-sm">Esta sección estará disponible en la próxima actualización de la Caja.</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Right: Check Detail (or Empty State) */}
            <div className="w-[380px] xl:w-[420px] bg-white text-park-black shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.5)] z-40 flex flex-col shrink-0">"""

idx1 = content.find(old_main_start)
idx2 = content.find(old_main_end)

if idx1 != -1 and idx2 != -1:
    content = content[:idx1] + new_main + content[idx2 + len(old_main_end):]
    with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced main area successfully.")
else:
    print("Could not find the indices.")
