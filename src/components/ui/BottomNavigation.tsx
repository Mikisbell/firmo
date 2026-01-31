'use client';

/**
 * BottomNavigation Component
 * Mobile-only bottom navigation bar
 * 
 * Task 5.1 - Mobile Responsive Spec
 */

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

export function BottomNavigation({
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
        style={{ height: NAV_HEIGHT }} 
      />
      
      {/* Navigation */}
      <nav
        className={`
          fixed bottom-0 left-0 right-0
          md:hidden
          bg-zinc-900 border-t border-zinc-800
          safe-area-inset-bottom
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
                  min-w-[64px] min-h-[48px]
                  px-3 py-1
                  rounded-lg
                  transition-colors
                  ${isActive 
                    ? 'text-amber-500' 
                    : 'text-zinc-400 hover:text-zinc-200 active:bg-zinc-800'
                  }
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-amber-500 rounded-full" />
                )}
                
                {/* Icon with badge */}
                <div className="relative">
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
                      text-xs font-bold
                      bg-red-500 text-white
                      rounded-full
                    ">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                
                {/* Label */}
                <span className={`
                  text-xs mt-1
                  ${isActive ? 'font-medium' : ''}
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
}

/**
 * Hook to check if bottom navigation is visible
 */
export function useBottomNavVisible(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

export default BottomNavigation;
