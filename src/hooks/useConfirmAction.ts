'use client';

/**
 * useConfirmAction Hook
 * Hook para manejar confirmaciones de acciones destructivas
 * 
 * Task 15.5 - Mobile Responsive Spec
 */

import { useState, useCallback } from 'react';

export interface ConfirmActionState {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm?: () => void;
}

export interface UseConfirmActionReturn {
  state: ConfirmActionState;
  confirm: (options: Omit<ConfirmActionState, 'isOpen'> & { onConfirm: () => void }) => void;
  cancel: () => void;
  handleConfirm: () => void;
}

const initialState: ConfirmActionState = {
  isOpen: false,
};

export function useConfirmAction(): UseConfirmActionReturn {
  const [state, setState] = useState<ConfirmActionState>(initialState);

  const confirm = useCallback((options: Omit<ConfirmActionState, 'isOpen'> & { onConfirm: () => void }) => {
    setState({
      isOpen: true,
      ...options,
    });
  }, []);

  const cancel = useCallback(() => {
    setState(initialState);
  }, []);

  const handleConfirm = useCallback(() => {
    if (state.onConfirm) {
      state.onConfirm();
    }
    setState(initialState);
  }, [state]);

  return {
    state,
    confirm,
    cancel,
    handleConfirm,
  };
}

export default useConfirmAction;
