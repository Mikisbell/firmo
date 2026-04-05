'use client';

/**
 * Tabs horizontal para navegacion entre vistas.
 * Incluye icono opcional a la izquierda y badge opcional a la derecha.
 * TabsContent renderiza condicionalmente segun el valor activo.
 */

import { cn } from '@/src/lib/utils';

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  tabs: TabItem[];
  className?: string;
}

export function Tabs({ value, onChange, tabs, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 border-b border-park-gray-800',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={cn(
              'px-4 py-3 flex items-center gap-2 cursor-pointer text-sm transition-colors -mb-px',
              isActive
                ? 'text-white border-b-2 border-park-brand-500'
                : 'text-park-gray-400 hover:text-park-gray-200 border-b-2 border-transparent',
            )}
          >
            {tab.icon && (
              <span className="flex items-center" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="flex items-center">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface TabsContentProps {
  value: string;
  activeValue: string;
  children: React.ReactNode;
  className?: string;
}

/** Contenedor de contenido que solo se renderiza cuando value === activeValue */
export function TabsContent({
  value,
  activeValue,
  children,
  className,
}: TabsContentProps) {
  if (value !== activeValue) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
