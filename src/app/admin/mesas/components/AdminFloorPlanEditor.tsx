"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, RefreshCw, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button, PremiumTable } from "@/src/components/ui";
import type { TableStatus } from "@/src/components/ui/table-theme";

interface Table {
  id: string;
  number: string;
  display_name: string | null;
  capacity: number;
  shape: string;
  status: string;
  is_active: boolean;
  zone_id: string | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  rotation: number;
}

interface Zone {
  id: string;
  name: string;
}

export function AdminFloorPlanEditor({ 
  tables, 
  zones,
  onSaved
}: { 
  tables: Table[], 
  zones: Zone[],
  onSaved: () => void 
}) {
  const [localTables, setLocalTables] = useState<Table[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedZone, setSelectedZone] = useState<string | 'ALL'>('ALL');

  useEffect(() => {
    // Initialize auto layout for tables with 0,0 position
    const initTables = tables.map((t, index) => {
      const autoLayout = t.position_x === 0 && t.position_y === 0;
      return {
        ...t,
        position_x: autoLayout ? (index % 5) * 120 + 20 : t.position_x,
        position_y: autoLayout ? Math.floor(index / 5) * 120 + 20 : t.position_y,
      };
    });
    setLocalTables(initTables);
    setHasChanges(false);
  }, [tables]);

  const handleDragEnd = (tableId: string, info: any) => {
    setLocalTables(prev => prev.map(t => {
      if (t.id !== tableId) return t;
      
      // Snapping to grid (10px)
      const snap = 10;
      const newX = Math.max(0, Math.round((t.position_x + info.offset.x) / snap) * snap);
      const newY = Math.max(0, Math.round((t.position_y + info.offset.y) / snap) * snap);
      
      return { ...t, position_x: newX, position_y: newY };
    }));
    setHasChanges(true);
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      const payload = localTables.filter(t => 
        // Solo enviamos los de la zona actual, o todos
        selectedZone === 'ALL' || t.zone_id === selectedZone
      ).map(t => ({
        id: t.id,
        position_x: t.position_x,
        position_y: t.position_y,
      }));

      const res = await fetch('/api/admin/tables/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: payload })
      });

      if (!res.ok) throw new Error('Error al guardar el plano');
      
      toast.success('Plano guardado exitosamente');
      setHasChanges(false);
      onSaved();
    } catch (err) {
      toast.error('Ocurrió un error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const filteredTables = localTables.filter(t => selectedZone === 'ALL' || t.zone_id === selectedZone);

  return (
    <div className="flex flex-col gap-4 h-full min-h-[700px]">
      <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-park-gray-400" />
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setSelectedZone('ALL')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${selectedZone === 'ALL' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Todas las Zonas
            </button>
            {zones.map(z => (
              <button
                key={z.id}
                onClick={() => setSelectedZone(z.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${selectedZone === z.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {z.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && <span className="text-amber-400 text-sm animate-pulse">Cambios sin guardar</span>}
          <Button
            variant={hasChanges ? "primary" : "secondary"}
            icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            onClick={saveLayout}
            disabled={!hasChanges || saving}
          >
            {saving ? 'Guardando...' : 'Guardar Plano'}
          </Button>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="relative w-full flex-1 bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden shadow-inner p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 via-zinc-950 to-zinc-950"
      >
        <div className="absolute inset-0 bg-grid-zinc-900 bg-[length:40px_40px] pointer-events-none" />
        {filteredTables.map((table) => {
          const w = table.width || 100;
          const h = table.height || 100;
          return (
            <PremiumTable
              key={table.id}
              id={table.id}
              number={table.number}
              displayName={table.display_name}
              status={table.is_active ? "FREE" : "UNAVAILABLE"}
              mode="canvas"
              x={table.position_x}
              y={table.position_y}
              width={w}
              height={h}
              rotation={table.rotation}
              shape={table.shape}
              isEditor={true}
              isDraggable={true}
              dragConstraints={containerRef}
              onDragEnd={(e, info) => handleDragEnd(table.id, info)}
            />
          );
        })}
      </div>
    </div>
  );
}
