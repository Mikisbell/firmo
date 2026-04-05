'use client';

/**
 * Avatar de usuario con fallback a iniciales.
 * Soporta indicador de estado (online, offline, busy, away) y ring opcional.
 * AvatarGroup apila avatares con overlap y muestra "+N" si supera el max.
 */

import { forwardRef } from 'react';
import { cn } from '@/src/lib/utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps {
  /** URL de imagen */
  src?: string;
  /** Nombre completo — usado para iniciales de fallback */
  name: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  /** Anillo brand alrededor del avatar */
  ring?: boolean;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const statusColors: Record<AvatarStatus, string> = {
  online: 'bg-green-500',
  offline: 'bg-park-gray-600',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
};

/** Extrae iniciales a partir de las primeras 2 palabras del nombre */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (words.length === 0) return '?';
  return words.map((w) => w.charAt(0).toUpperCase()).join('');
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, name, size = 'md', status, ring = false, className }, ref) => {
    const initials = getInitials(name);

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex rounded-full shrink-0',
          sizeStyles[size],
          ring && 'ring-2 ring-park-brand-500',
          className,
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover rounded-full"
          />
        ) : (
          <div
            aria-label={name}
            className={cn(
              'h-full w-full rounded-full bg-park-gray-800 text-park-gray-300 font-medium flex items-center justify-center',
            )}
          >
            {initials}
          </div>
        )}
        {status && (
          <span
            aria-label={`Estado: ${status}`}
            className={cn(
              'absolute bottom-0 right-0 h-1/4 w-1/4 rounded-full border-2 border-park-gray-950',
              statusColors[status],
            )}
          />
        )}
      </div>
    );
  },
);

Avatar.displayName = 'Avatar';

export type AvatarGroupSize = 'sm' | 'md' | 'lg';

export interface AvatarGroupProps {
  avatars: Array<{ name: string; src?: string }>;
  /** Maximo a mostrar; el resto se agrupa como "+N" */
  max?: number;
  size?: AvatarGroupSize;
  className?: string;
}

export function AvatarGroup({
  avatars,
  max = 4,
  size = 'md',
  className,
}: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - visible.length;

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((a, idx) => (
        <div key={`${a.name}-${idx}`} className={idx > 0 ? '-ml-2' : ''}>
          <Avatar
            name={a.name}
            src={a.src}
            size={size}
            className="ring-2 ring-park-gray-950"
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            '-ml-2 rounded-full bg-park-gray-800 text-park-gray-300 font-medium flex items-center justify-center ring-2 ring-park-gray-950',
            sizeStyles[size],
          )}
          aria-label={`${overflow} mas`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
