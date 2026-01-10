'use client';

/**
 * MobileHeader Component
 * Responsive header with hide-on-scroll behavior
 * 
 * Task 4.1, 4.2 - Mobile Responsive Spec
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';

export interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  
  // Navigation
  leftAction?: React.ReactNode;
  rightActions?: React.ReactNode[];
  showBackButton?: boolean;
  onBack?: () => void;
  
  // Styling
  variant?: 'default' | 'transparent' | 'colored';
  colorClass?: string;  // For 'colored' variant
  className?: string;
  
  // Behavior
  hideOnScroll?: boolean;
  scrollThreshold?: number;  // Pixels to scroll before hiding (default: 50)
}

const HEADER_HEIGHT_MOBILE = 56;
const HEADER_HEIGHT_DESKTOP = 64;
const DEFAULT_SCROLL_THRESHOLD = 50;

export function MobileHeader({
  title,
  subtitle,
  leftAction,
  rightActions = [],
  showBackButton = false,
  onBack,
  variant = 'default',
  colorClass = 'bg-amber-600',
  className = '',
  hideOnScroll = false,
  scrollThreshold = DEFAULT_SCROLL_THRESHOLD,
}: MobileHeaderProps) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const controls = useAnimation();

  // Handle scroll for hide-on-scroll behavior
  const handleScroll = useCallback(() => {
    if (!hideOnScroll) return;

    const currentScrollY = window.scrollY;
    const scrollDelta = currentScrollY - lastScrollY.current;

    if (scrollDelta > scrollThreshold && currentScrollY > HEADER_HEIGHT_MOBILE) {
      // Scrolling down - hide
      setIsVisible(false);
    } else if (scrollDelta < -scrollThreshold || currentScrollY < HEADER_HEIGHT_MOBILE) {
      // Scrolling up or near top - show
      setIsVisible(true);
    }

    lastScrollY.current = currentScrollY;
  }, [hideOnScroll, scrollThreshold]);

  // Animate visibility
  useEffect(() => {
    controls.start({
      y: isVisible ? 0 : -HEADER_HEIGHT_MOBILE,
      transition: { type: 'spring', damping: 30, stiffness: 400 },
    });
  }, [isVisible, controls]);

  // Setup scroll listener
  useEffect(() => {
    if (!hideOnScroll) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hideOnScroll, handleScroll]);

  // Variant styles
  const variantStyles = {
    default: 'bg-zinc-900 border-b border-zinc-800',
    transparent: 'bg-transparent',
    colored: colorClass,
  };

  return (
    <motion.header
      animate={controls}
      className={`
        fixed top-0 left-0 right-0
        h-14 md:h-16
        flex items-center justify-between
        px-4
        ${variantStyles[variant]}
        ${className}
      `}
      style={{ 
        zIndex: 'var(--z-header, 100)',
        minHeight: HEADER_HEIGHT_MOBILE,
      }}
    >
      {/* Left Section */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {showBackButton && (
          <button
            onClick={onBack}
            className="
              -ml-2 p-2
              min-w-[44px] min-h-[44px]
              flex items-center justify-center
              rounded-lg
              hover:bg-white/10 active:bg-white/20
              transition-colors
            "
            aria-label="Volver"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        
        {leftAction && !showBackButton && (
          <div className="min-w-[44px] min-h-[44px] flex items-center">
            {leftAction}
          </div>
        )}

        {/* Title */}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-zinc-400 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right Actions */}
      {rightActions.length > 0 && (
        <div className="flex items-center gap-1">
          {rightActions.map((action, index) => (
            <div 
              key={index}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {action}
            </div>
          ))}
        </div>
      )}
    </motion.header>
  );
}

/**
 * Spacer component to offset content below fixed header
 */
export function HeaderSpacer({ className = '' }: { className?: string }) {
  return (
    <div 
      className={`h-14 md:h-16 ${className}`}
      style={{ minHeight: HEADER_HEIGHT_MOBILE }}
    />
  );
}

export default MobileHeader;
