'use client';

/**
 * SwipeableItem Component
 * Swipe-to-reveal actions for list items (mobile pattern)
 * 
 * Task 3.1 - Mobile Responsive Spec
 */

import { useRef, useState, useCallback } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';

export interface SwipeableItemProps {
  children: React.ReactNode;
  
  // Actions
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  
  // Action content
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  
  // Configuration
  threshold?: number;        // Pixels to trigger action (default: 80)
  actionWidth?: number;      // Width of action area (default: 80)
  disabled?: boolean;
  
  // Styling
  className?: string;
  leftActionClassName?: string;
  rightActionClassName?: string;
}

const DEFAULT_THRESHOLD = 80;
const DEFAULT_ACTION_WIDTH = 80;
const VELOCITY_THRESHOLD = 300;

export function SwipeableItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  threshold = DEFAULT_THRESHOLD,
  actionWidth = DEFAULT_ACTION_WIDTH,
  disabled = false,
  className = '',
  leftActionClassName = '',
  rightActionClassName = '',
}: SwipeableItemProps) {
  const [isRevealed, setIsRevealed] = useState<'left' | 'right' | null>(null);
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle drag end
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (disabled) return;

      const { velocity, offset } = info;
      
      // Fast swipe detection
      if (Math.abs(velocity.x) > VELOCITY_THRESHOLD) {
        if (velocity.x < 0 && rightAction) {
          // Fast swipe left - reveal right action
          controls.start({ x: -actionWidth });
          setIsRevealed('right');
          return;
        }
        if (velocity.x > 0 && leftAction) {
          // Fast swipe right - reveal left action
          controls.start({ x: actionWidth });
          setIsRevealed('left');
          return;
        }
      }

      // Slow drag - use threshold
      if (offset.x < -threshold && rightAction) {
        controls.start({ x: -actionWidth });
        setIsRevealed('right');
      } else if (offset.x > threshold && leftAction) {
        controls.start({ x: actionWidth });
        setIsRevealed('left');
      } else {
        // Return to center
        controls.start({ x: 0 });
        setIsRevealed(null);
      }
    },
    [disabled, rightAction, leftAction, threshold, actionWidth, controls]
  );

  // Close revealed action
  const handleClose = useCallback(() => {
    controls.start({ x: 0 });
    setIsRevealed(null);
  }, [controls]);

  // Execute action and close
  const handleLeftAction = useCallback(() => {
    onSwipeRight?.();
    handleClose();
  }, [onSwipeRight, handleClose]);

  const handleRightAction = useCallback(() => {
    onSwipeLeft?.();
    handleClose();
  }, [onSwipeLeft, handleClose]);

  // Tap on content closes revealed action
  const handleContentTap = useCallback(() => {
    if (isRevealed) {
      handleClose();
    }
  }, [isRevealed, handleClose]);

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Left Action (revealed on swipe right) */}
      {leftAction && (
        <div
          className={`
            absolute left-0 top-0 bottom-0
            flex items-center justify-center
            bg-green-600 text-white
            ${leftActionClassName}
          `}
          style={{ width: actionWidth }}
          onClick={handleLeftAction}
        >
          {leftAction}
        </div>
      )}

      {/* Right Action (revealed on swipe left) */}
      {rightAction && (
        <div
          className={`
            absolute right-0 top-0 bottom-0
            flex items-center justify-center
            bg-red-600 text-white
            ${rightActionClassName}
          `}
          style={{ width: actionWidth }}
          onClick={handleRightAction}
        >
          {rightAction}
        </div>
      )}

      {/* Main Content */}
      <motion.div
        animate={controls}
        drag={disabled ? false : 'x'}
        dragConstraints={{ 
          left: rightAction ? -actionWidth : 0, 
          right: leftAction ? actionWidth : 0 
        }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onClick={handleContentTap}
        className="relative bg-zinc-900"
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default SwipeableItem;
