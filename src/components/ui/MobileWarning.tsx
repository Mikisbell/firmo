"use client";

/**
 * MobileWarning Component
 * Shows a warning message when viewing on mobile devices
 * Recommends using tablet or desktop for better experience
 * 
 * Task 13.1 - Mobile Responsive Spec
 * Requirements: 8.2
 */

import { useState, useEffect } from "react";
import { Monitor, X, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MobileWarningProps {
    /** Title of the warning */
    title?: string;
    /** Message to display */
    message?: string;
    /** Whether the warning can be dismissed */
    dismissible?: boolean;
    /** Callback when dismissed */
    onDismiss?: () => void;
    /** Storage key for remembering dismissal */
    storageKey?: string;
    /** Breakpoint below which to show warning (default: 768) */
    breakpoint?: number;
}

export function MobileWarning({
    title = "Pantalla pequeña detectada",
    message = "Esta aplicación está optimizada para tablet o desktop. Algunas funciones pueden ser difíciles de usar en móvil.",
    dismissible = true,
    onDismiss,
    storageKey = "mobile-warning-dismissed",
    breakpoint = 768,
}: MobileWarningProps) {
    const [show, setShow] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        
        // Check if already dismissed
        if (storageKey) {
            const dismissed = localStorage.getItem(storageKey);
            if (dismissed === "true") return;
        }

        // Check viewport width
        const checkWidth = () => {
            setShow(window.innerWidth < breakpoint);
        };

        checkWidth();
        window.addEventListener("resize", checkWidth);
        return () => window.removeEventListener("resize", checkWidth);
    }, [breakpoint, storageKey]);

    const handleDismiss = () => {
        setShow(false);
        if (storageKey) {
            localStorage.setItem(storageKey, "true");
        }
        onDismiss?.();
    };

    if (!mounted) return null;

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="fixed top-0 left-0 right-0 z-50 p-3 bg-amber-500/95 backdrop-blur-sm shadow-lg"
                >
                    <div className="flex items-start gap-3 max-w-lg mx-auto">
                        <div className="flex-shrink-0 p-2 bg-amber-600/50 rounded-lg">
                            <Smartphone className="w-5 h-5 text-amber-100" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-amber-950 text-sm">
                                {title}
                            </h3>
                            <p className="text-amber-900 text-xs mt-0.5">
                                {message}
                            </p>
                            <div className="flex items-center gap-1 mt-1.5 text-amber-800">
                                <Monitor className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">
                                    Recomendado: Tablet o Desktop
                                </span>
                            </div>
                        </div>

                        {dismissible && (
                            <button
                                onClick={handleDismiss}
                                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-amber-600/50 text-amber-900 hover:text-amber-950 transition-colors"
                                aria-label="Cerrar aviso"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default MobileWarning;
