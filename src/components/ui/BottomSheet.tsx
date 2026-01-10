'use client';

/**
 * BottomSheet Component
 * Mobile-native bottom sheet with snap points and drag gestures
 * 
 * Task 2.1, 2.2 - Mobile Responsive Spec
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, useAnimation, PanInfo, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

export type SnapPoint = 'collapsed' | 'half' | 'full';

export interface BottomSheetProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  
  // Snap configuration
  snapPoints?: SnapPoint[];
  defaultSnap?: SnapPoint;
  onSnapChange?: (snap: SnapPoint) => void;
  
  // Heights
  collapsedHeight?: number;  // default: 80px
  halfHeight?: string;       // default: '50vh'
  
  // Customization
  showHandle?: boolean;
  showBackdrop?: boolean;
  backdropClose?: boolean;
  className?: string;
  
  // Header content (always visible)
  header?: React.ReactNode;
}

const SNAP_HEIGHTS: Record<SnapPoint, string | number> = {
  collapsed: 80,
  half: '50vh',
  full: '90vh',
};

const VELOCITY_THRESHOLD = 500; // px/s to trigger snap
const DRAG_THRESHOLD = 50; // px to trigger snap change

export function BottomSheet({
  children,
  isOpen,
  onClose,
  snapPoints = ['collapsed', 'half', 'full'],
  defaultSnap = 'half',
  onSnapChange,
  collapsedHeight = 80,
  halfHeight = '50vh',
  showHandle = true,
  showBackdrop = true,
  backdropClose = true,
  className = '',
  header,
}: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>(defaultSnap);
  const [mounted, setMounted] = useState(false);
  const controls = useAnimation();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get height for snap point
  const getSnapHeight = useCallback((snap: SnapPoint): string | number => {
    if (snap === 'collapsed') return collapsedHeight;
    if (snap === 'half') return halfHeight;
    return SNAP_HEIGHTS[snap];
  }, [collapsedHeight, halfHeight]);

  // Animate to snap point
  const animateToSnap = useCallback(async (snap: SnapPoint) => {
    const height = getSnapHeight(snap);
    await controls.start({
      height,
      transition: { type: 'spring', damping: 30, stiffness: 400 },
    });
    setCurrentSnap(snap);
    onSnapChange?.(snap);
  }, [controls, getSnapHeight, onSnapChange]);

  // Handle drag end
  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { velocity, offset } = info;
    const currentIndex = snapPoints.indexOf(currentSnap);
    
    // Fast swipe detection
    if (Math.abs(velocity.y) > VELOCITY_THRESHOLD) {
      if (velocity.y > 0) {
        // Swiping down
        if (currentIndex > 0) {
          animateToSnap(snapPoints[currentIndex - 1]);
        } else if (backdropClose) {
          onClose();
        }
      } else {
        // Swiping up
        if (currentIndex < snapPoints.length - 1) {
          animateToSnap(snapPoints[currentIndex + 1]);
        }
      }
      return;
    }

    // Slow drag - use threshold
    if (offset.y > DRAG_THRESHOLD && currentIndex > 0) {
      animateToSnap(snapPoints[currentIndex - 1]);
    } else if (offset.y < -DRAG_THRESHOLD && currentIndex < snapPoints.length - 1) {
      animateToSnap(snapPoints[currentIndex + 1]);
    } else {
      // Return to current snap
      animateToSnap(currentSnap);
    }
  }, [currentSnap, snapPoints, animateToSnap, onClose, backdropClose]);

  // Handle handle tap (toggle between collapsed and half)
  const handleHandleTap = useCallback(() => {
    if (currentSnap === 'collapsed') {
      animateToSnap('half');
    } else {
      animateToSnap('collapsed');
    }
  }, [currentSnap, animateToSnap]);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      animateToSnap(defaultSnap);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, defaultSnap, animateToSnap]);

  // Reset snap when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentSnap(defaultSnap);
    }
  }, [isOpen, defaultSnap]);

  if (!mounted) return null;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          {showBackdrop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              style={{ zIndex: 'var(--z-bottom-sheet, 350)' }}
              onClick={backdropClose ? onClose : undefined}
            />
          )}

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ height: 0 }}
            animate={controls}
            exit={{ height: 0 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            className={`
              fixed bottom-0 left-0 right-0
              bg-zinc-900 rounded-t-2xl
              shadow-[0_-4px_20px_rgba(0,0,0,0.3)]
              flex flex-col
              safe-area-inset-bottom
              ${className}
            `}
            style={{ 
              zIndex: 'var(--z-bottom-sheet, 350)',
              touchAction: 'none',
            }}
          >
            {/* Handle */}
            {showHandle && (
              <div 
                className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
                onClick={handleHandleTap}
              >
                <div className="w-10 h-1 bg-zinc-600 rounded-full" />
              </div>
            )}

            {/* Header (always visible) */}
            {header && (
              <div className="px-4 pb-2 border-b border-zinc-800">
                {header}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Render in portal
  return createPortal(content, document.body);
}

export default BottomSheet;
