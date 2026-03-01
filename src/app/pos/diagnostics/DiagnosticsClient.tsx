"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/src/core/db/schema";
import { getSyncClient } from "@/src/core/sync/client";
import { useProjections } from "@/src/core/projections/useProjections";
import { BackupSection } from "./BackupSection";
import { DEFAULT_TENANT_ID } from "@/src/core/config/terminal";
import { v4 as uuidv4 } from "uuid";

// Si no tienes esto aún, no pasa nada: lo intentamos igual.
async function tryPersist(): Promise<{ supported: boolean; granted: boolean | null }> {
    const navAny = navigator as any;
    if (!navAny?.storage?.persist) return { supported: false, granted: null };
    try {
        const granted = await navAny.storage.persist();
        return { supported: true, granted };
    } catch {
        return { supported: true, granted: null };
    }
}

export default function DiagnosticsClient() {
    const syncClient = useMemo(() => getSyncClient({ tickMs: 5000, batchSize: 200 }), []);
    const projections = useProjections();
    const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

    const [backlog, setBacklog] = useState<number>(0);
    const [lastAck, setLastAck] = useState<number>(0);
    const [lastAttempt, setLastAttempt] = useState<string | null>(null);
    const [lastOk, setLastOk] = useState<string | null>(null);

    const [persistSupported, setPersistSupported] = useState<boolean>(false);
    const [persistGranted, setPersistGranted] = useState<boolean | null>(null);

    const [syncing, setSyncing] = useState<boolean>(false);
    const [lastSyncResult, setLastSyncResult] = useState<any>(null);

    async function refresh() {
        try {
            const st = await db.sync_state.get("singleton");
            const backlogCount = await db.events.where("synced").equals(0).count();

            setBacklog(backlogCount);
            setLastAck(st?.last_terminal_sequence_acked ?? 0);
            setLastAttempt(st?.last_sync_attempt_at ?? null);
            setLastOk(st?.last_sync_ok_at ?? null);
        } catch (e) {
            console.error("Error refreshing diagnostics:", e);
        }
    }

    async function runSyncOnce() {
        setSyncing(true);
        try {
            const r = await syncClient.syncNow();
            setLastSyncResult(r ?? { note: "no-op (sin backlog o offline)" });
        } catch (e) {
            setLastSyncResult({ error: e });
        } finally {
            setSyncing(false);
            await refresh();
        }
    }

    async function seedFakeEvent() {
        try {
            const st = await db.sync_state.get("singleton");
            const count = await db.events.count();
            const nextSeq = (st?.last_terminal_sequence_acked ?? 0) + count + 1;

            const now = new Date().toISOString();
            const tenant_id = DEFAULT_TENANT_ID;
            const terminal_id = "t1";

            await db.events.add({
                tenant_id,
                terminal_id,
                terminal_sequence: nextSeq,
                event_id: uuidv4(),
                event_type: "ORDER_CREATED", // Use valid event type
                schema_version: 1,
                occurred_at: now,
                aggregate_type: "ORDER",
                aggregate_id: uuidv4(),
                correlation_id: `corr_${nextSeq}`,
                causation_id: null,
                payload: {
                    order_id: uuidv4(),
                    order_number: nextSeq,
                    order_type: "DINE_IN",
                    items: []
                },
                synced: 0,
            } as any);

            await refresh();
        } catch (e) {
            console.error("Error seeding event:", e);
            alert("Error al crear evento de prueba. Revisar consola.");
        }
    }

    async function clearBacklog() {
        try {
            await db.events.where("synced").equals(0).delete();
            await refresh();
            alert("Cola de sincronización limpiada.");
        } catch (e) {
            console.error("Error clearing backlog:", e);
            alert("Error al limpiar backlog");
        }
    }

    useEffect(() => {
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    useEffect(() => {
        (async () => {
            if (typeof navigator !== "undefined") {
                const p = await tryPersist();
                setPersistSupported(p.supported);
                setPersistGranted(p.granted);
            }
            await refresh();
        })();
    }, []);

    return (
        <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
            <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <h2>Estado</h2>
                <div>Internet: <b>{online ? "EN LÍNEA" : "SIN CONEXIÓN"}</b></div>
                <div>Pendientes (synced=0): <b>{backlog}</b></div>
                <div>Última secuencia ACK: <b>{lastAck}</b></div>
                <div>Último intento de sincronización: <b>{lastAttempt ?? "-"}</b></div>
                <div>Última sincronización exitosa: <b>{lastOk ?? "-"}</b></div>
                <div>
                    Almacenamiento persistente:{" "}
                    <b>
                        {persistSupported ? (persistGranted === true ? "CONCEDIDO" : persistGranted === false ? "DENEGADO" : "DESCONOCIDO") : "NO SOPORTADO"}
                    </b>
                </div>
            </section>

            <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <h2>Acciones</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={refresh}>Actualizar</button>
                    <button onClick={runSyncOnce} disabled={syncing}>
                        {syncing ? "Sincronizando..." : "Sincronizar"}
                    </button>
                    <button onClick={() => { syncClient.start(); alert("Sincronización automática iniciada correctamente"); }}>Iniciar sincronización automática</button>
                    <button onClick={() => { syncClient.stop(); alert("Sincronización automática detenida"); }}>Detener sincronización automática</button>
                    <button onClick={seedFakeEvent}>Crear evento de prueba</button>
                    <button onClick={clearBacklog} className="bg-red-100 text-red-800 hover:bg-red-200">Limpiar cola de pendientes</button>
                </div>
            </section>

            <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <h2>Último resultado de sincronización</h2>
                <pre style={{ whiteSpace: "pre-wrap", margin: 0, background: "#f5f5f5", padding: 8, borderRadius: 4, fontSize: "0.85rem" }}>
                    {JSON.stringify(lastSyncResult, null, 2)}
                </pre>
            </section>

            <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <h2>Proyecciones en vivo (Caché + Delta)</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        <h3>Venta activa</h3>
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0, background: "#f0f8ff", padding: 8, borderRadius: 4, fontSize: "0.75rem" }}>
                            {projections?.activeSale ? JSON.stringify(projections.activeSale, null, 2) : "Ninguno"}
                        </pre>
                    </div>
                    <div>
                        <h3>Turno</h3>
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0, background: "#fff0f5", padding: 8, borderRadius: 4, fontSize: "0.75rem" }}>
                            {projections?.shift ? JSON.stringify(projections.shift, null, 2) : "Ninguno"}
                        </pre>
                    </div>
                </div>
            </section>

            <BackupSection />
        </div>
    );
}
