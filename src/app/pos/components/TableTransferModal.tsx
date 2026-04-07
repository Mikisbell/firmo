import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, X, Loader2 } from "lucide-react";
import { useTables } from "@/src/hooks/useSWRHooks";

interface TableTransferModalProps {
    currentTable: string;
    onClose: () => void;
    onConfirm: (toTable: string) => Promise<void>;
}

export function TableTransferModal({ currentTable, onClose, onConfirm }: TableTransferModalProps) {
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [isTransferring, setIsTransferring] = useState(false);
    const { data, isLoading } = useTables();

    const tables = (data?.items || []).filter(
        (t: { number: string; status: string }) => t.number !== currentTable
    );

    const handleConfirm = async () => {
        if (!selectedTable || isTransferring) return;
        setIsTransferring(true);
        try {
            await onConfirm(selectedTable);
        } finally {
            setIsTransferring(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                            <ArrowRightLeft className="w-5 h-5 text-amber-700" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-900">Transferir Mesa</h3>
                            <p className="text-sm text-gray-500">
                                Mesa actual: <span className="font-bold text-gray-800">{currentTable || "Sin asignar"}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Table Grid */}
                <div className="p-5 max-h-[400px] overflow-y-auto">
                    <p className="text-sm text-gray-500 mb-3">Selecciona la mesa destino:</p>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                            <span className="ml-2 text-sm text-gray-400">Cargando mesas...</span>
                        </div>
                    ) : tables.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400 text-sm">No hay mesas disponibles</p>
                            <p className="text-gray-300 text-xs mt-1">Configura mesas en Admin &gt; Mesas</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-2">
                            {tables.map((table: { id: string; number: string; display_name?: string | null; status: string; capacity: number }) => {
                                const isSelected = selectedTable === table.number;
                                const isOccupied = table.status === "OCCUPIED";

                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTable(table.number)}
                                        disabled={isOccupied}
                                        className={`
                                            relative p-3 rounded-xl border-2 text-center transition-all
                                            min-h-[64px] touch-manipulation flex flex-col items-center justify-center
                                            ${isSelected
                                                ? "border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-200 shadow-md"
                                                : isOccupied
                                                    ? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed opacity-60"
                                                    : "border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50/50"
                                            }
                                        `}
                                    >
                                        <span className={`font-bold text-lg ${isSelected ? "text-amber-700" : ""}`}>
                                            {table.display_name || table.number}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wider mt-0.5">
                                            {isOccupied ? "Ocupada" : `${table.capacity} pers.`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-200 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors min-h-[48px] touch-manipulation"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedTable || isTransferring}
                        className={`
                            flex-1 py-3 rounded-xl font-bold transition-all min-h-[48px] touch-manipulation
                            flex items-center justify-center gap-2
                            ${selectedTable && !isTransferring
                                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }
                        `}
                    >
                        {isTransferring ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <ArrowRightLeft className="w-4 h-4" />
                                Transferir a {selectedTable || "..."}
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
