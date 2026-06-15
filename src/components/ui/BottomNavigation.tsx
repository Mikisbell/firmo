'use client';

/**
 * BottomNavigation Component
 * Mobile-only bottom navigation bar
 * 
 * Task 5.1 - Mobile Responsive Spec
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BottomNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  href: string;
  badge?: number;
}

export interface BottomNavigationProps {
  items: BottomNavItem[];
  activeId?: string;  // Override auto-detection
  className?: string;
}

const NAV_HEIGHT = 64;
const MAX_ITEMS = 5;

export const BottomNavigation = React.memo(function BottomNavigation({
  items,
  activeId,
  className = '',
}: BottomNavigationProps) {
  const pathname = usePathname();
  
  // Limit to max items
  const displayItems = items.slice(0, MAX_ITEMS);

  // Determine active item
  const getIsActive = (item: BottomNavItem) => {
    if (activeId) return item.id === activeId;
    // Match by href
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <>
      {/* Spacer to prevent content from being hidden behind nav */}
      <div 
        className="md:hidden" 
        style={{ height: NAV_HEIGHT + 16 }} 
      />
      
      {/* Navigation */}
      <nav
        className={`
          fixed bottom-2 left-2 right-2
          md:hidden
          bg-park-gray-900/80 backdrop-blur-xl border border-violet-500/20
          safe-area-inset-bottom rounded-2xl shadow-2xl shadow-black/50
          overflow-hidden
          ${className}
        `}
        style={{ 
          height: NAV_HEIGHT,
          zIndex: 'var(--z-bottom-nav, 100)',
        }}
      >
        <div className="flex items-center justify-around h-full px-2">
          {displayItems.map((item) => {
            const isActive = getIsActive(item);
            
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  relative flex flex-col items-center justify-center
                  min-w-[64px] h-full
                  px-3
                  transition-all active:scale-90
                  ${isActive 
                    ? 'text-violet-400 bg-violet-500/10' 
                    : 'text-park-gray-400 hover:text-white active:bg-park-gray-800'
                  }
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-violet-500 rounded-b-full shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                )}
                
                {/* Icon with badge */}
                <div className="relative mt-1">
                  <div className="w-6 h-6">
                    {item.icon}
                  </div>
                  
                  {/* Badge */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="
                      absolute -top-1 -right-2
                      min-w-[18px] h-[18px]
                      flex items-center justify-center
                      px-1
                      text-[10px] font-bold
                      bg-red-500 text-white
                      rounded-full animate-pulse shadow-lg shadow-red-500/50
                    ">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                
                {/* Label */}
                <span className={`
                  text-[10px] mt-1
                  ${isActive ? 'font-bold' : 'font-medium'}
                `}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
});

/**
 * Hook to check if bottom navigation is visible
 */
export function useBottomNavVisible(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

export default BottomNavigation;
