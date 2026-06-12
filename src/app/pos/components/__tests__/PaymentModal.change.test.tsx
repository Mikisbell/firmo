// @vitest-environment jsdom
/**
 * Tests for PaymentModal — changeCents (vuelto) propagation via onConfirm
 *
 * Verifies the 4th argument of onConfirm:
 * - CASH with overpayment → changeCents = tendered - due
 * - CASH exact amount → changeCents = 0
 * - Quick pay (Efectivo exacto) → changeCents = 0
 * - CARD with overpayment → changeCents = 0 (card charges exact)
 * - Digital (YAPE) → changeCents = 0
 *
 * @module app/pos/components/__tests__/PaymentModal.change.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, initial, animate, exit, transition, layoutId, ...props }: any) =>
          React.createElement(tag, props, children),
    },
  ),
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('@/src/hooks/usePaymentQR', () => ({
  usePaymentQR: () => ({
    qrData: null,
    isLoading: false,
    error: null,
    generateQR: vi.fn(),
    clearQR: vi.fn(),
  }),
}));

import { PaymentModal } from '../PaymentModal';

// ============================================================================
// Helpers
// ============================================================================

function renderModal(onConfirm = vi.fn()) {
  const utils = render(
    <PaymentModal
      totalDueCents={4500}
      remainingCents={4500}
      orderNumber={42}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />,
  );
  return { ...utils, onConfirm };
}

function getAmountInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="number"]');
  if (!input) throw new Error('Amount input not found');
  return input as HTMLInputElement;
}

function clickButtonByText(getAllByText: any, text: RegExp | string) {
  const nodes = getAllByText(text);
  const button = (nodes[0] as HTMLElement).closest('button');
  if (!button) throw new Error(`Button with text ${text} not found`);
  fireEvent.click(button);
}

describe('PaymentModal — changeCents propagation', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('CASH con sobrepago: onConfirm recibe changeCents = entregado - pendiente', () => {
    const { container, getAllByText, onConfirm } = renderModal();

    // Cuenta S/ 45.00, cliente entrega S/ 50.00 → vuelto S/ 5.00
    fireEvent.change(getAmountInput(container), { target: { value: '50' } });
    clickButtonByText(getAllByText, /Confirmar Pago/);

    expect(onConfirm).toHaveBeenCalledWith('CASH', 5000, undefined, 500);
  });

  it('CASH monto exacto: changeCents = 0', () => {
    const { getAllByText, onConfirm } = renderModal();

    // El input ya viene pre-cargado con el monto exacto (45.00)
    clickButtonByText(getAllByText, /Confirmar Pago/);

    expect(onConfirm).toHaveBeenCalledWith('CASH', 4500, undefined, 0);
  });

  it('Quick Pay "Efectivo exacto": changeCents = 0', () => {
    const { getAllByText, onConfirm } = renderModal();

    clickButtonByText(getAllByText, /^Efectivo S\//);

    expect(onConfirm).toHaveBeenCalledWith('CASH', 4500, undefined, 0);
  });

  it('Redondear + confirmar: changeCents = redondeo - pendiente', () => {
    const { getAllByText, onConfirm } = renderModal();

    // S/ 45.00 → redondea a S/ 50.00
    clickButtonByText(getAllByText, /^Redondear S\//);
    clickButtonByText(getAllByText, /Confirmar Pago/);

    expect(onConfirm).toHaveBeenCalledWith('CASH', 5000, undefined, 500);
  });

  it('CARD con sobrepago: changeCents = 0 (tarjeta cobra exacto)', () => {
    const { container, getAllByText, onConfirm } = renderModal();

    // Seleccionar método Tarjeta (segundo botón "Tarjeta": el primero es quick-pay)
    const cardNodes = getAllByText('Tarjeta');
    const methodButton = (cardNodes[cardNodes.length - 1] as HTMLElement).closest('button');
    fireEvent.click(methodButton!);

    fireEvent.change(getAmountInput(container), { target: { value: '50' } });
    clickButtonByText(getAllByText, /Confirmar Pago/);

    expect(onConfirm).toHaveBeenCalledWith('CARD', 5000, undefined, 0);
  });

  it('YAPE (digital): changeCents = 0 y propaga referencia', () => {
    const { getAllByText, getByPlaceholderText, onConfirm } = renderModal();

    // Seleccionar método Yape
    clickButtonByText(getAllByText, 'Yape');

    fireEvent.change(getByPlaceholderText('Ingrese el número de operación'), {
      target: { value: 'OP-12345' },
    });
    clickButtonByText(getAllByText, /Pago Recibido/);

    expect(onConfirm).toHaveBeenCalledWith('YAPE', 4500, 'OP-12345', 0);
  });
});
