'use client';

/**
 * ExportButton - Reusable export dropdown for admin pages
 *
 * Supports xlsx, csv, pdf formats.
 * Downloads file automatically.
 *
 * @module app/admin/components/ExportButton
 */

import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, File } from 'lucide-react';
import { toast } from 'sonner';

interface ExportButtonProps {
  entity: string;
  filters?: Record<string, string>;
  label?: string;
}

const FORMAT_OPTIONS = [
  { key: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
  { key: 'csv', label: 'CSV (.csv)', icon: FileText },
  { key: 'pdf', label: 'PDF (.html)', icon: File },
] as const;

export function ExportButton({ entity, filters, label = 'Exportar' }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleExport = async (format: string) => {
    setLoading(true);
    setOpen(false);

    try {
      const params = new URLSearchParams({ entity, format });
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });
      }

      const res = await fetch(`/api/admin/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al exportar');
      }

      // Download file
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || `${entity}.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Archivo descargado');
    } catch (err: any) {
      toast.error(err.message || 'Error al exportar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm min-h-[40px] disabled:opacity-50"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {label}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleExport(opt.key)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white"
            >
              <opt.icon className="w-4 h-4" />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
