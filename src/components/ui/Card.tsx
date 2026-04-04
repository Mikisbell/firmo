'use client';

/**
 * Card contenedora con sub-componentes Header, Content y Footer.
 * Base del layout de tarjetas en el panel admin.
 */

import { cn } from '@/src/lib/utils';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: CardPadding;
  /** Agrega efecto hover en el borde */
  hover?: boolean;
}

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  className,
  padding = 'md',
  hover = false,
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-park-gray-900 border border-park-gray-800 rounded-xl',
        paddingStyles[padding],
        hover && 'hover:border-park-gray-700 transition-colors cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
}

/** Encabezado de la tarjeta con borde inferior */
export function CardHeader({ children, className }: CardSectionProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between pb-4 border-b border-park-gray-800',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Contenido principal de la tarjeta */
export function CardContent({ children, className }: CardSectionProps) {
  return <div className={cn(className)}>{children}</div>;
}

/** Pie de la tarjeta con borde superior */
export function CardFooter({ children, className }: CardSectionProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 pt-4 border-t border-park-gray-800',
        className,
      )}
    >
      {children}
    </div>
  );
}
