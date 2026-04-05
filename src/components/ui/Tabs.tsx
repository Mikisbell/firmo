'use client';

/**
 * Tabs horizontal para navegacion entre vistas.
 * Incluye icono opcional a la izquierda y badge opcional a la derecha.
 * TabsContent renderiza condicionalmente segun el valor activo.
 */

import { useRef } from 'react';
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
  const tablistRef = useRef<HTMLDivElement>(null);

  // a11y: ArrowLeft/Right para navegar, Home/End para primer/ultimo.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();

    const currentIndex = tabs.findIndex((t) => t.value === value);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (e.key === 'ArrowLeft') {
      nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    } else if (e.key === 'ArrowRight') {
      nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    const nextTab = tabs[nextIndex];
    if (nextTab) {
      onChange(nextTab.value);
      // Enfocar el nuevo tab
      const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <div
      ref={tablistRef}
      role="tablist"
      onKeyDown={handleKeyDown}
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
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              'px-4 py-3 flex items-center gap-2 cursor-pointer text-sm transition-colors -mb-px',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-park-brand-500 focus-visible:rounded',
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
