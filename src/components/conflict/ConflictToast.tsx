// src/components/conflict/ConflictToast.tsx
// Toast component for conflict notifications

'use client';

import { useState } from 'react';
import { useConflictHandler, type ConflictDetail } from '@/src/hooks/useConflictHandler';

interface ToastMessage {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  conflict?: ConflictDetail;
}

export function ConflictToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'info' | 'warning' | 'error') => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const { dismissConflict } = useConflictHandler({
    showToast,
    onPaymentConflict: (conflict) => {
      // Payment conflicts need manual attention
      const id = `conflict-${conflict.event_id}`;
      setToasts(prev => [...prev, {
        id,
        type: 'error',
        message: 'Conflicto de pago: La orden fue modificada. Verifica antes de continuar.',
        conflict,
      }]);
    },
  });

  const dismissToast = (id: string, conflict?: ConflictDetail) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    if (conflict) {
      dismissConflict(conflict.event_id);
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            p-4 rounded-lg shadow-lg flex items-start gap-3 animate-slide-in
            ${toast.type === 'error' ? 'bg-red-600 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-yellow-500 text-black' : ''}
            ${toast.type === 'info' ? 'bg-blue-600 text-white' : ''}
          `}
        >
          {/* Icon */}
          <span className="text-xl">
            {toast.type === 'error' && '⚠️'}
            {toast.type === 'warning' && '🔄'}
            {toast.type === 'info' && 'ℹ️'}
          </span>
          
          {/* Content */}
          <div className="flex-1">
            <p className="text-sm font-medium">{toast.message}</p>
            {toast.conflict && (
              <p className="text-xs opacity-80 mt-1">
                Orden: {toast.conflict.aggregate_id?.slice(0, 8)}...
              </p>
            )}
          </div>
          
          {/* Dismiss button */}
          <button
            onClick={() => dismissToast(toast.id, toast.conflict)}
            className="text-lg opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// CSS animation (add to globals.css or use Tailwind plugin)
// @keyframes slide-in {
//   from { transform: translateX(100%); opacity: 0; }
//   to { transform: translateX(0); opacity: 1; }
// }
// .animate-slide-in { animation: slide-in 0.3s ease-out; }
