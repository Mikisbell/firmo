'use client';

/**
 * Alerta / banner inline del Design System.
 * Variantes: info, success, warning, critical.
 * Soporta icono custom, dismiss y slot de accion.
 */

import { forwardRef } from 'react';
import {
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type AlertVariant = 'info' | 'success' | 'warning' | 'critical';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  description?: string | React.ReactNode;
  /** Icono custom — si no se provee, se elige segun variant */
  icon?: React.ReactNode;
  /** Muestra boton de cerrar */
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Slot para boton / accion */
  action?: React.ReactNode;
  className?: string;
}

const variantContainerStyles: Record<AlertVariant, string> = {
  info: 'bg-blue-500/10 border-l-blue-500',
  success: 'bg-green-500/10 border-l-green-500',
  warning: 'bg-amber-500/10 border-l-amber-500',
  critical: 'bg-red-500/10 border-l-red-500',
};

const variantIconStyles: Record<AlertVariant, string> = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
};

const defaultIcons: Record<AlertVariant, React.ReactNode> = {
  info: <Info className="h-5 w-5" aria-hidden="true" />,
  success: <CheckCircle className="h-5 w-5" aria-hidden="true" />,
  warning: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
  critical: <AlertCircle className="h-5 w-5" aria-hidden="true" />,
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'info',
      title,
      description,
      icon,
      dismissible = false,
      onDismiss,
      action,
      className,
    },
    ref,
  ) => {
    const iconNode = icon ?? defaultIcons[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative rounded-lg border-l-4 p-4 flex gap-3',
          variantContainerStyles[variant],
          className,
        )}
      >
        <div className={cn('shrink-0', variantIconStyles[variant])}>
          {iconNode}
        </div>

        <div className="flex-1 min-w-0">
          {title && (
            <div className="font-semibold text-white">{title}</div>
          )}
          {description && (
            <div
              className={cn(
                'text-sm text-park-gray-300',
                title && 'mt-1',
              )}
            >
              {description}
            </div>
          )}
          {action && <div className="mt-3">{action}</div>}
        </div>

        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar alerta"
            className="absolute top-2 right-2 p-1 rounded hover:bg-park-gray-800 text-park-gray-400 hover:text-park-gray-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);

Alert.displayName = 'Alert';
