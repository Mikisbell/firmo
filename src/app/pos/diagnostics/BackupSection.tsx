"use client";

import { useState, useRef } from "react";
import { db } from "@/src/core/db/schema";
import { decryptData, encryptData } from "@/src/core/security/encryption";
import { ParkEvent } from "@/src/core/domain/events";

export function BackupSection() {
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState<"IDLE" | "PROCESSING" | "SUCCESS" | "ERROR">("IDLE");
    const [message, setMessage] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleBackup = async () => {
        if (!password) return alert("Ingresa una contraseña para cifrar el backup.");

        try {
            setStatus("PROCESSING");
            const events = await db.events.toArray();
            const backupObj = {
                timestamp: new Date().toISOString(),
                count: events.length,
                events,
            };

            const blob = await encryptData(backupObj, password);

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `park_backup_${new Date().toISOString().slice(0, 10)}.enc`;
            a.click();
            URL.revokeObjectURL(url);

            setStatus("SUCCESS");
            setMessage(`Backup descargado (${events.length} eventos).`);
        } catch (e) {
            console.error(e);
            setStatus("ERROR");
            setMessage("Error al generar backup.");
        }
    };

    const onRestoreClick = () => {
        console.log("Restore button clicked. Password len:", password.length);
        if (!password) return alert("Ingresa la contraseña para descifrar.");

        // Reset input value to allow selecting same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log("File input change triggered");
        const file = e.target.files?.[0];
        if (!file) {
            console.log("No file selected");
            return;
        }

        console.log(`File selected: ${file.name}, Size: ${file.size}, Password: ${password}`);

        if (!password) {
            alert("¡Falta la contraseña!");
            return;
        }

        if (!confirm(`⚠️ ESTO SOBREESCRIBIRÁ LA BASE DE DATOS LOCAL.\nArchivo: ${file.name}\n¿Estás seguro?`)) {
            return;
        }

        try {
            setStatus("PROCESSING");
            // Use cast to bypass implicit type checks if schema differs slightly
            const data = await decryptData(file, password) as { events: ParkEvent[] };

            if (!data || !Array.isArray(data.events)) {
                throw new Error("El archivo descifrado no tiene el formato correcto.");
            }

            console.log("Decrypted successfully. Events found:", data.events.length);

            await db.transaction("rw", db.events, db.projections, db.sync_state, async () => {
                await db.events.clear();
                await db.events.bulkAdd(data.events as any);
                await db.projections.clear();
            });

            setStatus("SUCCESS");
            const msg = `✅ ¡ÉXITO!\n\nSe han restaurado ${data.events.length} eventos.\nLa página se recargará ahora.`;
            // setMessage(msg); // Optional
            alert(msg);
            window.location.reload();

        } catch (err: any) {
            console.error("Restore error:", err);
            setStatus("ERROR");
            const errorMsg = err.message || "Error desconocido";
            setMessage(errorMsg);
            alert(`❌ ERROR:\n${errorMsg}`);
        }
    };

    return (
        <div className="p-4 border rounded bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 space-y-4">
            <h3 className="font-bold text-lg">🔒 Backup Cifrado (AC-05)</h3>

            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Contraseña de Cifrado</label>
                <div className="flex gap-2">
                    <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Tu contraseña secreta"
                        className="p-2 border rounded bg-white dark:bg-black w-full max-w-xs"
                    />
                    <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="px-2 py-1 bg-gray-200 dark:bg-zinc-700 rounded text-xs hover:bg-gray-300"
                    >
                        {showPassword ? "Ocultar" : "Mostrar"}
                    </button>
                </div>
            </div>

            <div className="flex gap-4 items-center flex-wrap">
                <button
                    onClick={handleBackup}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    disabled={status === "PROCESSING"}
                >
                    {status === "PROCESSING" ? "Cifrando..." : "Descargar Backup (.enc)"}
                </button>

                <div>
                    <button
                        onClick={onRestoreClick}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        disabled={status === "PROCESSING"}
                    >
                        {status === "PROCESSING" ? "Restaurando..." : "Restaurar Backup"}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".enc"
                        onChange={handleRestore}
                        className="hidden"
                        disabled={status === "PROCESSING"}
                    />
                </div>
            </div>

            {message && (
                <div className={`p-2 rounded text-sm ${status === "ERROR" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                    {message}
                </div>
            )}
        </div>
    );
}
