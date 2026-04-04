'use client';

/**
 * Encabezado de pagina para el panel admin.
 * Titulo, descripcion opcional, acciones alineadas a la derecha y link de retorno.
 */

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Nodo de acciones (botones) alineados a la derecha */
  actions?: React.ReactNode;
  /** Muestra un link "Volver" encima del titulo */
  backHref?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-park-gray-400 hover:text-park-gray-200 transition-colors mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver
        </Link>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          {description && (
            <p className="text-sm text-park-gray-400 mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
