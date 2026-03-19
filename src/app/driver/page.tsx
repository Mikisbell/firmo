"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { formatCents } from "@/src/core/domain/money";
import {
    Bike,
    Phone,
    MapPin,
    Clock,
    RefreshCw,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Package,
    User,
    LogOut,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type DeliveryStatus = "PENDING" | "ASSIGNED" | "DISPATCHED" | "DELIVERED" | "FAILED";

interface DeliveryOrder {
    id: string;
    order_id: string;
    driver_id: string | null;
    drivers?: { id: string; name: string; phone: string } | null;
    address_text: string;
    address_reference: string | null;
    customer_phone: string;
    delivery_fee: number;
    status: DeliveryStatus;
    created_at: string;
    assigned_at: string | null;
    dispatched_at: string | null;
    delivered_at: string | null;
    failed_at: string | null;
    failure_reason: string | null;
    delivery_time_mins: number | null;
}

interface Driver {
    id: string;
    name: string;
    phone: string;
    is_active: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "park_driver_id";
const REFRESH_INTERVAL_MS = 30_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortId(id: string): string {
    return id.slice(-6).toUpperCase();
}

function elapsedLabel(isoDate: string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return "hace un momento";
    if (diffMins < 60) return `hace ${diffMins}m`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `hace ${hrs}h ${mins}m` : `hace ${hrs}h`;
}

function statusLabel(status: DeliveryStatus): string {
    switch (status) {
        case "PENDING": return "Pendiente";
        case "ASSIGNED": return "Asignado";
        case "DISPATCHED": return "En camino";
        case "DELIVERED": return "Entregado";
        case "FAILED": return "Fallido";
    }
}

// ─── Status color classes ─────────────────────────────────────────────────────

function statusColors(status: DeliveryStatus) {
    switch (status) {
        case "PENDING":
            return {
                border: "border-zinc-600",
                badge: "bg-zinc-700 text-zinc-300",
                dot: "bg-zinc-400",
            };
        case "ASSIGNED":
            return {
                border: "border-blue-500/60",
                badge: "bg-blue-900/60 text-blue-300",
                dot: "bg-blue-400",
            };
        case "DISPATCHED":
            return {
                border: "border-amber-500/60",
                badge: "bg-amber-900/60 text-amber-300",
                dot: "bg-amber-400 animate-pulse",
            };
        default:
            return {
                border: "border-zinc-700",
                badge: "bg-zinc-800 text-zinc-400",
                dot: "bg-zinc-500",
            };
    }
}

// ─── Driver Selector Screen ────────────────────────────────────────────────────

interface DriverSelectorProps {
    onSelect: (driver: Driver) => void;
}

function DriverSelector({ onSelect }: DriverSelectorProps) {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadDrivers() {
            try {
                const res = await fetch("/api/drivers");
                if (!res.ok) throw new Error("No se pudo cargar la lista de motorizados");
                const data = (await res.json()) as { drivers: Driver[] };
                setDrivers(data.drivers.filter((d) => d.is_active));
            } catch (err) {
                const message = err instanceof Error ? err.message : "Error al cargar motorizados";
                toast.error(message);
            } finally {
                setLoading(false);
            }
        }
        void loadDrivers();
    }, []);

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
            {/* Logo / Brand */}
            <div className="mb-8 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-900/40">
                    <Bike className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-black tracking-wider text-white">
                    PARK <span className="text-amber-400">DELIVERY</span>
                </h1>
                <p className="text-zinc-400 text-sm mt-1">¿Quién eres?</p>
            </div>

            {/* Driver list */}
            <div className="w-full max-w-sm space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
                    </div>
                ) : drivers.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                        <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No hay motorizados activos</p>
                    </div>
                ) : (
                    drivers.map((driver) => (
                        <button
                            key={driver.id}
                            onClick={() => onSelect(driver)}
                            className="w-full flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 hover:bg-zinc-800 rounded-2xl transition-all group min-h-[4rem]"
                        >
                            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/30 transition-colors">
                                <User className="w-6 h-6 text-amber-400" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-white">{driver.name}</p>
                                <p className="text-zinc-400 text-sm">{driver.phone}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-amber-400 transition-colors" />
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Delivery Card ────────────────────────────────────────────────────────────

interface DeliveryCardProps {
    delivery: DeliveryOrder;
    driverId: string;
    onAction: () => void;
}

function DeliveryCard({ delivery, driverId, onAction }: DeliveryCardProps) {
    const [loading, setLoading] = useState(false);
    const colors = statusColors(delivery.status);

    async function callApi(path: string, body?: Record<string, string>) {
        setLoading(true);
        try {
            const res = await fetch(path, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) {
                const errData = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(errData.error ?? "Error en la operación");
            }
            onAction();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error desconocido";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }

    function handleTake() {
        void callApi(`/api/delivery/${delivery.id}/assign`, { driverId });
    }

    function handleDispatch() {
        void callApi(`/api/delivery/${delivery.id}/dispatch`);
    }

    function handleDeliver() {
        void callApi(`/api/delivery/${delivery.id}/deliver`);
    }

    function handleFail() {
        const reason = window.prompt("Motivo del fallo:");
        if (reason === null) return; // cancelled
        void callApi(`/api/delivery/${delivery.id}/fail`, { reason: reason.trim() || "Sin motivo" });
    }

    return (
        <div className={`bg-zinc-900 border-2 ${colors.border} rounded-2xl overflow-hidden`}>
            {/* Card header */}
            <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm tracking-wider">
                            #{shortId(delivery.id)}
                        </p>
                        <p className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {elapsedLabel(delivery.created_at)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${colors.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        {statusLabel(delivery.status)}
                    </span>
                </div>
            </div>

            {/* Address */}
            <div className="px-4 pb-3 space-y-1">
                <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-white font-medium leading-tight">{delivery.address_text}</p>
                        {delivery.address_reference && (
                            <p className="text-zinc-400 text-xs mt-0.5">{delivery.address_reference}</p>
                        )}
                    </div>
                </div>

                {/* Phone */}
                <a
                    href={`tel:${delivery.customer_phone}`}
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors w-fit"
                >
                    <Phone className="w-4 h-4" />
                    <span>{delivery.customer_phone}</span>
                </a>
            </div>

            {/* Footer: fee + action buttons */}
            <div className="px-4 pb-4 flex items-center justify-between gap-3">
                <div className="bg-zinc-800 px-3 py-1.5 rounded-xl">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 leading-none mb-0.5">Delivery</p>
                    <p className="text-amber-400 font-bold text-sm">{formatCents(delivery.delivery_fee)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {delivery.status === "PENDING" && (
                        <button
                            onClick={handleTake}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors min-h-[3rem]"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Bike className="w-4 h-4" />
                            )}
                            Tomar
                        </button>
                    )}

                    {delivery.status === "ASSIGNED" && (
                        <button
                            onClick={handleDispatch}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors min-h-[3rem]"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Bike className="w-4 h-4" />
                            )}
                            Salir a entregar
                        </button>
                    )}

                    {delivery.status === "DISPATCHED" && (
                        <>
                            <button
                                onClick={handleDeliver}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors min-h-[3rem]"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                )}
                                Entregado
                            </button>
                            <button
                                onClick={handleFail}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-3 bg-red-900/70 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-red-300 text-sm font-semibold rounded-xl transition-colors min-h-[3rem]"
                            >
                                <XCircle className="w-4 h-4" />
                                Falló
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DriverPage() {
    const [driver, setDriver] = useState<Driver | null>(null);
    const [hydrated, setHydrated] = useState(false);

    const [allDeliveries, setAllDeliveries] = useState<DeliveryOrder[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // ── Hydrate driver from localStorage ──────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as Driver;
                setDriver(parsed);
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        setHydrated(true);
    }, []);

    // ── Persist driver selection ───────────────────────────────────────────────
    function handleSelectDriver(selected: Driver) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
        setDriver(selected);
    }

    function handleChangeDriver() {
        localStorage.removeItem(STORAGE_KEY);
        setDriver(null);
        setAllDeliveries([]);
    }

    // ── Fetch deliveries ───────────────────────────────────────────────────────
    const fetchDeliveries = useCallback(async () => {
        if (!driver) return;
        setLoadingData(true);
        try {
            const [pendingRes, myRes] = await Promise.all([
                fetch("/api/delivery?status=PENDING"),
                fetch(`/api/delivery/driver/${driver.id}`),
            ]);

            if (!pendingRes.ok || !myRes.ok) {
                throw new Error("Error al cargar pedidos");
            }

            const pendingData = (await pendingRes.json()) as { deliveries: DeliveryOrder[] };
            const myData = (await myRes.json()) as { deliveries: DeliveryOrder[] };

            // Merge: my active (ASSIGNED/DISPATCHED) + all PENDING
            const myActive = (myData.deliveries ?? []).filter(
                (d) => d.status === "ASSIGNED" || d.status === "DISPATCHED"
            );
            const pendingDeliveries = (pendingData.deliveries ?? []).filter(
                (d) => d.status === "PENDING"
            );

            // Deduplicate by id (a PENDING could already be in myActive if it was just assigned)
            const myActiveIds = new Set(myActive.map((d) => d.id));
            const uniquePending = pendingDeliveries.filter((d) => !myActiveIds.has(d.id));

            setAllDeliveries([...myActive, ...uniquePending]);
            setLastUpdated(new Date());
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error al cargar pedidos";
            toast.error(message);
        } finally {
            setLoadingData(false);
        }
    }, [driver]);

    // Initial load + auto-refresh
    useEffect(() => {
        if (!driver) return;
        void fetchDeliveries();
        const interval = setInterval(() => void fetchDeliveries(), REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [driver, fetchDeliveries]);

    // ── Render: not hydrated yet ───────────────────────────────────────────────
    if (!hydrated) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
            </div>
        );
    }

    // ── Render: no driver selected ─────────────────────────────────────────────
    if (!driver) {
        return <DriverSelector onSelect={handleSelectDriver} />;
    }

    // ── Split deliveries ───────────────────────────────────────────────────────
    const myOrders = allDeliveries.filter(
        (d) => d.driver_id === driver.id && (d.status === "ASSIGNED" || d.status === "DISPATCHED")
    );
    const pendingOrders = allDeliveries.filter((d) => d.status === "PENDING");

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-zinc-950 to-zinc-950">
            {/* ── Header ── */}
            <header className="sticky top-0 z-30 bg-gradient-to-r from-amber-950/95 to-orange-950/80 backdrop-blur-md border-b-2 border-amber-500/60 shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                    {/* Brand + driver name */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                            <Bike className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base font-black tracking-wider text-white leading-tight">
                                <span className="text-amber-400">DELIVERY</span>
                            </h1>
                            <p className="text-amber-300/70 text-xs truncate">{driver.name}</p>
                        </div>
                    </div>

                    {/* Stats + actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Active count badge */}
                        {myOrders.length > 0 && (
                            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 rounded-xl border border-amber-500/30">
                                <span className="text-amber-400 font-bold text-sm">{myOrders.length}</span>
                                <span className="text-amber-400/60 text-xs">activos</span>
                            </div>
                        )}

                        {/* Refresh button */}
                        <button
                            onClick={() => void fetchDeliveries()}
                            disabled={loadingData}
                            className="p-2.5 bg-zinc-800/60 hover:bg-zinc-700 disabled:opacity-40 rounded-xl border border-zinc-700 transition-colors"
                            title="Actualizar"
                        >
                            <RefreshCw className={`w-4 h-4 text-zinc-400 ${loadingData ? "animate-spin" : ""}`} />
                        </button>

                        {/* Change driver */}
                        <button
                            onClick={handleChangeDriver}
                            className="p-2.5 bg-zinc-800/60 hover:bg-red-900/40 rounded-xl border border-zinc-700 hover:border-red-500/40 transition-colors"
                            title="Cambiar motorizado"
                        >
                            <LogOut className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                        </button>
                    </div>
                </div>

                {/* Last updated */}
                {lastUpdated && (
                    <div className="px-4 pb-2 text-[10px] text-amber-400/40 uppercase tracking-widest">
                        Actualizado {lastUpdated.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                )}
            </header>

            {/* ── Content ── */}
            <div className="p-4 space-y-6 pb-10">

                {/* Loading skeleton */}
                {loadingData && allDeliveries.length === 0 && (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-36 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loadingData && allDeliveries.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                        <Bike className="w-14 h-14 mb-4 opacity-30" />
                        <p className="text-base font-semibold">Sin pedidos activos</p>
                        <p className="text-sm mt-1 opacity-70">Los pedidos nuevos aparecerán aquí</p>
                    </div>
                )}

                {/* ── My active orders ── */}
                {myOrders.length > 0 && (
                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400/80 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            Mis pedidos activos
                            <span className="text-zinc-500 font-normal normal-case tracking-normal">
                                ({myOrders.length})
                            </span>
                        </h2>
                        <div className="space-y-3">
                            {myOrders.map((delivery) => (
                                <DeliveryCard
                                    key={delivery.id}
                                    delivery={delivery}
                                    driverId={driver.id}
                                    onAction={() => void fetchDeliveries()}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Pending orders ── */}
                {pendingOrders.length > 0 && (
                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400/80 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-zinc-500" />
                            Pedidos pendientes
                            <span className="text-zinc-600 font-normal normal-case tracking-normal">
                                ({pendingOrders.length})
                            </span>
                        </h2>
                        <div className="space-y-3">
                            {pendingOrders.map((delivery) => (
                                <DeliveryCard
                                    key={delivery.id}
                                    delivery={delivery}
                                    driverId={driver.id}
                                    onAction={() => void fetchDeliveries()}
                                />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
