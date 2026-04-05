'use client';

/**
 * ConfirmDialog — Modal de confirmacion.
 *
 * Wrappea el Modal base del Design System con:
 * - Titulo + descripcion
 * - Botones Cancelar / Confirmar en el footer
 * - Variante destructive (rojo) o default (brand)
 * - Soporte para onConfirm async con loading spinner
 * - Auto-cierre despues de onConfirm exitoso
 */

import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  /** Controla si el dialog esta abierto */
  open: boolean;
  /** Callback para cerrar el dialog */
  onClose: () => void;
  /** Callback ejecutado al confirmar (puede ser async) */
  onConfirm: () => void | Promise<void>;
  /** Titulo del dialog */
  title: string;
  /** Descripcion / mensaje de confirmacion */
  description: string;
  /** Texto del boton de confirmacion (default "Confirmar") */
  confirmLabel?: string;
  /** Texto del boton de cancelar (default "Cancelar") */
  cancelLabel?: string;
  /** Variante del boton confirm: default (brand) o destructive (rojo) */
  variant?: 'default' | 'destructive';
  /** Estado de carga externo (opcional, se combina con el interno) */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loading || internalLoading;

  const handleConfirm = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
      onClose();
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!isLoading}
      closeOnEscape={!isLoading}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            onClick={handleConfirm}
            loading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-park-gray-300">{description}</p>
    </Modal>
  );
}
