'use client';

import React from 'react';
import { usePosStore } from '@/src/core/store/usePosStore';

/**
 * SyncStatusBadge (La Campana SRE)
 * 
 * Componente visual que expone el estado interno del sincronizador maestro.
 * Muestra eventos pendientes y lanza alertas rojas si el Web Worker
 * detecta una "Píldora Envenenada" (HTTP 400).
 */
export function SyncStatusBadge() {
  const unpushedCount = usePosStore((state) => state.unpushedEventsCount);
  const poisonPillsByAggregate = usePosStore((state) => state.poisonPillsByAggregate);
  const discardPoisonPill = usePosStore((state) => state.discardPoisonPill);

  // Aplanar el diccionario de Poison Pills para iterarlo fácilmente
  const poisonPills = Object.entries(poisonPillsByAggregate).flatMap(([aggregateId, pills]) => 
    pills.map(pill => ({ aggregateId, ...pill }))
  );

  const hasPoisonPills = poisonPills.length > 0;
  const isSyncing = unpushedCount > 0 && !hasPoisonPills;

  if (unpushedCount === 0 && !hasPoisonPills) {
    // Estado ideal: Todo sincronizado. No mostramos nada o un pequeño check verde.
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-medium">
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        Sincronizado
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
        hasPoisonPills 
          ? 'bg-red-500/10 text-red-600 border-red-500/20' 
          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      }`}>
        {hasPoisonPills ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Error de Sincronización
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            Sincronizando ({unpushedCount})
          </>
        )}
      </div>

      {/* Flyout con detalles de la Píldora Envenenada (Solo visible al hacer hover si hay errores) */}
      {hasPoisonPills && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900 rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-semibold text-red-700 dark:text-red-400">Píldora Envenenada Detectada</h3>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            El servidor ha rechazado un evento. Esto está bloqueando la sincronización de {poisonPills.length} mesa(s). Debes descartarlo para continuar.
          </p>
          
          <div className="space-y-3">
            {poisonPills.map((pill, idx) => (
              <div key={`${pill.aggregateId}-${pill.eventId}`} className="bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-100 dark:border-red-900/50">
                <p className="text-xs font-mono text-red-800 dark:text-red-300 mb-2 truncate">
                  Error: {pill.error}
                </p>
                <button
                  onClick={() => discardPoisonPill(pill.aggregateId, pill.eventId)}
                  className="w-full text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded transition-colors font-medium"
                >
                  Descartar Evento Problemático
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
