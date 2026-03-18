'use client';

/**
 * Admin Feedback Page
 * Shows all customer opinions (quejas, sugerencias, elogios) received via QR menu.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/src/lib/swr-config';
import { MessageSquare, ThumbsUp, Lightbulb, AlertCircle, Star } from 'lucide-react';

interface FeedbackItem {
  id: string;
  type: 'QUEJA' | 'SUGERENCIA' | 'ELOGIO';
  message: string;
  customer_name: string | null;
  rating: number | null;
  table_number: string | null;
  created_at: string;
}

interface FeedbackResponse {
  items: FeedbackItem[];
  total: number;
  page: number;
  totalPages: number;
}

const TYPE_CONFIG = {
  ELOGIO:    { label: 'Elogio',     icon: ThumbsUp,     bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20' },
  SUGERENCIA:{ label: 'Sugerencia', icon: Lightbulb,    bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20'  },
  QUEJA:     { label: 'Queja',      icon: AlertCircle,  bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20'   },
};

export default function FeedbackPage() {
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (typeFilter) params.set('type', typeFilter);

  const { data, isLoading } = useSWR<FeedbackResponse>(
    `/api/admin/feedback?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  };

  // Summary counts (from current page, approximation until we add server-side counts)
  const counts = { ELOGIO: 0, SUGERENCIA: 0, QUEJA: 0 };
  items.forEach(i => counts[i.type]++);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Opiniones de Clientes</h1>
        <p className="text-zinc-400 mt-1">
          Feedback recibido a través del menú QR — {data?.total ?? 0} opiniones en total
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(TYPE_CONFIG) as [keyof typeof TYPE_CONFIG, typeof TYPE_CONFIG[keyof typeof TYPE_CONFIG]][]).map(([type, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={type}
              onClick={() => { setTypeFilter(typeFilter === type ? '' : type); setPage(1); }}
              className={`p-4 rounded-xl border transition-all text-left ${
                typeFilter === type
                  ? `${cfg.bg} ${cfg.border} border`
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <Icon className={`w-5 h-5 mb-2 ${cfg.text}`} />
              <div className="text-lg font-bold">{typeFilter === type ? (data?.total ?? '—') : '—'}</div>
              <div className="text-xs text-zinc-400">{cfg.label}s</div>
            </button>
          );
        })}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setTypeFilter(''); setPage(1); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !typeFilter ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          Todos
        </button>
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
          <button
            key={type}
            onClick={() => { setTypeFilter(type); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              typeFilter === type ? `${cfg.bg} ${cfg.text}` : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {cfg.label}s
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500">
          <span className="animate-pulse">Cargando...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
          <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Aún no hay opiniones</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cfg = TYPE_CONFIG[item.type];
            const Icon = cfg.icon;
            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border ${cfg.border} ${cfg.bg} space-y-2`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.text}`} />
                    <span className={`text-xs font-bold uppercase ${cfg.text}`}>{cfg.label}</span>
                    {item.table_number && (
                      <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                        Mesa {item.table_number}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 whitespace-nowrap">{formatDate(item.created_at)}</span>
                </div>

                {item.rating !== null && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3.5 h-3.5 ${s <= item.rating! ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'}`} />
                    ))}
                  </div>
                )}

                <p className="text-sm text-zinc-200 leading-relaxed">{item.message}</p>

                {item.customer_name && (
                  <p className="text-xs text-zinc-500">— {item.customer_name}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-zinc-800 rounded-lg text-sm disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-zinc-400">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-zinc-800 rounded-lg text-sm disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
