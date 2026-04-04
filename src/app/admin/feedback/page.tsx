'use client';

/**
 * Admin Feedback Page
 * Shows all customer opinions (quejas, sugerencias, elogios) received via QR menu.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/src/lib/swr-config';
import { MessageSquare, ThumbsUp, Lightbulb, AlertCircle, Star } from 'lucide-react';
import { Badge, Card, PageHeader, EmptyState, Button } from '@/src/components/ui';

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
  ELOGIO:    { label: 'Elogio',     icon: ThumbsUp,     variant: 'success' as const },
  SUGERENCIA:{ label: 'Sugerencia', icon: Lightbulb,    variant: 'info' as const },
  QUEJA:     { label: 'Queja',      icon: AlertCircle,  variant: 'critical' as const },
};

const TYPE_BORDER = {
  ELOGIO: 'border-green-500/20',
  SUGERENCIA: 'border-blue-500/20',
  QUEJA: 'border-red-500/20',
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

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Opiniones"
        description={`Feedback recibido a traves del menu QR — ${data?.total ?? 0} opiniones en total`}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(TYPE_CONFIG) as [keyof typeof TYPE_CONFIG, typeof TYPE_CONFIG[keyof typeof TYPE_CONFIG]][]).map(([type, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card
              key={type}
              hover
              padding="sm"
              className={typeFilter === type ? 'border-park-brand-500' : ''}
            >
              <button
                onClick={() => { setTypeFilter(typeFilter === type ? '' : type); setPage(1); }}
                className="w-full text-left"
              >
                <Icon className={`w-5 h-5 mb-2 ${
                  cfg.variant === 'success' ? 'text-green-400' :
                  cfg.variant === 'info' ? 'text-blue-400' : 'text-red-400'
                }`} />
                <div className="text-lg font-bold">{typeFilter === type ? (data?.total ?? '\u2014') : '\u2014'}</div>
                <div className="text-xs text-park-gray-400">{cfg.label}s</div>
              </button>
            </Card>
          );
        })}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={!typeFilter ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => { setTypeFilter(''); setPage(1); }}
        >
          Todos
        </Button>
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
          <Button
            key={type}
            variant={typeFilter === type ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => { setTypeFilter(type); setPage(1); }}
          >
            {cfg.label}s
          </Button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="h-16 bg-park-gray-800 rounded animate-pulse" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<MessageSquare />}
            title="Aun no hay opiniones"
            description="Las opiniones apareceran cuando los clientes usen el menu QR"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cfg = TYPE_CONFIG[item.type];
            const Icon = cfg.icon;
            return (
              <Card
                key={item.id}
                className={`border ${TYPE_BORDER[item.type]}`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
                      {item.table_number && (
                        <span className="text-xs text-park-gray-500 bg-park-gray-800 px-2 py-0.5 rounded-full">
                          Mesa {item.table_number}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-park-gray-500 whitespace-nowrap">{formatDate(item.created_at)}</span>
                  </div>

                  {item.rating !== null && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= item.rating! ? 'fill-amber-400 text-amber-400' : 'text-park-gray-700'}`} />
                      ))}
                    </div>
                  )}

                  <p className="text-sm text-park-gray-200 leading-relaxed">{item.message}</p>

                  {item.customer_name && (
                    <p className="text-xs text-park-gray-500">— {item.customer_name}</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-park-gray-400">{page} / {totalPages}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
