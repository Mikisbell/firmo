'use client';

/**
 * FAB (Floating Action Button) Component
 * Mobile-native floating button with badge support
 * 
 * Task 6.1 - Mobile Responsive Spec
 */

import { motion } from 'framer-motion';

export interface FABProps {
  icon: React.ReactNode;
  onClick: () => void;
  
  // Badge
  badge?: number | string;
  
  // Extended mode (with label)
  label?: string;
  extended?: boolean;
  
  // Position
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  
  // Styling
  variant?: 'primary' | 'secondary' | 'success';
  size?: 'default' | 'large';
  className?: string;
  
  // State
  disabled?: boolean;
}

const FAB_SIZE = 56;
const FAB_SIZE_LARGE = 64;

const POSITION_CLASSES = {
  'bottom-right': 'right-4 bottom-20 md:bottom-4',
  'bottom-center': 'left-1/2 -translate-x-1/2 bottom-20 md:bottom-4',
  'bottom-left': 'left-4 bottom-20 md:bottom-4',
};

const VARIANT_CLASSES = {
  primary: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white',
  secondary: 'bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800 text-white',
  success: 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white',
};

export function FAB({
  icon,
  onClick,
  badge,
  label,
  extended = false,
  position = 'bottom-right',
  variant = 'primary',
  size = 'default',
  className = '',
  disabled = false,
}: FABProps) {
  const fabSize = size === 'large' ? FAB_SIZE_LARGE : FAB_SIZE;
  const showExtended = extended && label;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
      className={`
        fixed
        ${POSITION_CLASSES[position]}
        ${VARIANT_CLASSES[variant]}
        ${showExtended ? 'px-4 rounded-full' : 'rounded-full'}
        shadow-lg shadow-black/30
        flex items-center justify-center gap-2
        transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      style={{
        height: fabSize,
        minWidth: showExtended ? 'auto' : fabSize,
        zIndex: 'var(--z-fab, 90)',
      }}
    >
      {/* Icon */}
      <div className="w-6 h-6 flex items-center justify-center">
        {icon}
      </div>

      {/* Extended Label */}
      {showExtended && (
        <span className="font-medium pr-1">{label}</span>
      )}

      {/* Badge */}
      {badge !== undefined && (
        <span className="
          absolute -top-1 -right-1
          min-w-[22px] h-[22px]
          flex items-center justify-center
          px-1.5
          text-xs font-bold
          bg-red-500 text-white
          rounded-full
          shadow-md
        ">
          {typeof badge === 'number' && badge > 99 ? '99+' : badge}
        </span>
      )}
    </motion.button>
  );
}

/**
 * FAB with order total display
 * Specialized for POS use case
 */
export interface OrderFABProps {
  itemCount: number;
  totalCents: number;
  onClick: () => void;
  disabled?: boolean;
}

export function OrderFAB({
  itemCount,
  totalCents,
  onClick,
  disabled = false,
}: OrderFABProps) {
  const formattedTotal = (totalCents / 100).toFixed(2);

  if (itemCount === 0) return null;

  return (
    <FAB
      icon={
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
          />
        </svg>
      }
      onClick={onClick}
      badge={itemCount}
      label={`S/ ${formattedTotal}`}
      extended
      disabled={disabled}
    />
  );
}

export default FAB;
