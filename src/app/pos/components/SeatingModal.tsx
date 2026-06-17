"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Minus, Plus } from "lucide-react";

interface SeatingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (pax: number) => void;
    tableName: string;
}

export function SeatingModal({ isOpen, onClose, onConfirm, tableName }: SeatingModalProps) {
    const [pax, setPax] = useState(1);

    const handleClose = () => {
        setPax(1);
        onClose();
    };

    const handleConfirm = () => {
        onConfirm(pax);
        handleClose();
    };

    const handleIncrement = () => {
        if (pax < 20) setPax(prev => prev + 1);
    };

    const handleDecrement = () => {
        if (pax > 1) setPax(prev => prev - 1);
    };

    if (!isOpen) return null;

    const quickPax = [1, 2, 3, 4, 5, 6];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-zinc-800"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                                <Users size={20} />
                            </div>
                            <h2 className="text-lg font-bold text-white">Mesa {tableName}</h2>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        <div className="text-center space-y-2">
                            <p className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
                                Cantidad de Comensales
                            </p>
                            
                            <div className="flex items-center justify-center gap-6 py-4">
                                <button
                                    onClick={handleDecrement}
                                    disabled={pax <= 1}
                                    className="p-3 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Minus size={24} />
                                </button>
                                
                                <span className="text-5xl font-bold text-white w-16 text-center">
                                    {pax}
                                </span>
                                
                                <button
                                    onClick={handleIncrement}
                                    disabled={pax >= 20}
                                    className="p-3 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Quick select */}
                        <div className="grid grid-cols-3 gap-2">
                            {quickPax.map(num => (
                                <button
                                    key={num}
                                    onClick={() => setPax(num)}
                                    className={`py-2 rounded-xl text-lg font-medium transition-all ${
                                        pax === num 
                                            ? "bg-indigo-600 text-white" 
                                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                                    }`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 p-4 border-t border-zinc-800 bg-zinc-900/50">
                        <button
                            onClick={handleClose}
                            className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all"
                        >
                            Abrir Mesa
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
