import { describe, it, expect } from 'vitest';
import {
    validateAddItem,
    validateAddPayment,
    validateDiscount,
    validateTip,
    validateVoidReason,
    validateSplitBill,
} from '../client-validation';
import { LIMITS } from '@/src/core/constants/limits';

describe('Client Validation', () => {
    describe('validateAddItem', () => {
        it('accepts valid item', () => {
            const result = validateAddItem({
                currentItemCount: 0,
                currentOrderTotal: 0,
                unitPriceCents: 2500, // S/25
                quantity: 2,
            });
            expect(result.valid).toBe(true);
        });

        it('rejects quantity <= 0', () => {
            const result = validateAddItem({
                currentItemCount: 0,
                currentOrderTotal: 0,
                unitPriceCents: 2500,
                quantity: 0,
            });
            expect(result.valid).toBe(false);
            expect(result.field).toBe('quantity');
        });

        it('rejects quantity > MAX', () => {
            const result = validateAddItem({
                currentItemCount: 0,
                currentOrderTotal: 0,
                unitPriceCents: 100,
                quantity: LIMITS.MAX_QUANTITY_PER_LINE + 1,
            });
            expect(result.valid).toBe(false);
            expect(result.field).toBe('quantity');
        });

        it('rejects negative price', () => {
            const result = validateAddItem({
                currentItemCount: 0,
                currentOrderTotal: 0,
                unitPriceCents: -100,
                quantity: 1,
            });
            expect(result.valid).toBe(false);
            expect(result.field).toBe('price');
        });

        it('rejects item price too high', () => {
            const result = validateAddItem({
                currentItemCount: 0,
                currentOrderTotal: 0,
                unitPriceCents: LIMITS.MAX_SINGLE_ITEM_CENTS + 100,
                quantity: 1,
            });
            expect(result.valid).toBe(false);
            expect(result.field).toBe('price');
        });

        it('rejects when max items exceeded', () => {
            const result = validateAddItem({
                currentItemCount: LIMITS.MAX_ITEMS_PER_ORDER,
                currentOrderTotal: 0,
                unitPriceCents: 100,
                quantity: 1,
            });
            expect(result.valid).toBe(false);
            expect(result.field).toBe('items');
        });

        it('rejects when order total would exceed max', () => {
            const result = validateAddItem({
                currentItemCount: 0,
                currentOrderTotal: LIMITS.MAX_ORDER_TOTAL_CENTS - 100,
                unitPriceCents: 200,
                quantity: 1,
            });
            expect(result.valid).toBe(false);
            expect(result.field).toBe('total');
        });
    });

    describe('validateAddPayment', () => {
        it('accepts valid payment', () => {
            const result = validateAddPayment({
                amountCents: 5000,
                currentPaymentCount: 0,
                method: 'CASH',
            });
            expect(result.valid).toBe(true);
        });

        it('rejects zero amount', () => {
            const result = validateAddPayment({
                amountCents: 0,
                currentPaymentCount: 0,
                method: 'CASH',
            });
            expect(result.valid).toBe(false);
            expect(result.field).toBe('amount');
        });

        it('rejects amount too high', () => {
            const result = validateAddPayment({
                amountCents: LIMITS.MAX_PAYMENT_AMOUNT_CENTS + 1,
                currentPaymentCount: 0,
                method: 'CASH',
            });
            expect(result.valid).toBe(false);
            expect(result.field).toBe('amount');
        });

        it('rejects when max payments exceeded', () => {
            const result = validateAddPayment({
                amountCents: 1000,
                currentPaymentCount: LIMITS.MAX_PAYMENTS_PER_CHECK,
                method: 'CASH',
            });
            expect(result.valid).toBe(false);
            expect(result.field).toBe('payments');
        });

        it('rejects invalid method', () => {
            const result = validateAddPayment({
                amountCents: 1000,
                currentPaymentCount: 0,
                method: 'BITCOIN',
            });
            expect(result.valid).toBe(false);
            expect(result.field).toBe('method');
        });

        it('accepts all valid methods', () => {
            const methods = ['CASH', 'CARD', 'YAPE', 'PLIN', 'TRANSFER', 'CREDIT'];
            for (const method of methods) {
                const result = validateAddPayment({
                    amountCents: 1000,
                    currentPaymentCount: 0,
                    method,
                });
                expect(result.valid).toBe(true);
            }
        });
    });

    describe('validateDiscount', () => {
        it('accepts valid percent discount', () => {
            const result = validateDiscount({
                type: 'PERCENT',
                value: 10,
                orderTotalCents: 10000,
            });
            expect(result.valid).toBe(true);
        });

        it('accepts valid fixed discount', () => {
            const result = validateDiscount({
                type: 'FIXED',
                value: 500,
                orderTotalCents: 10000,
            });
            expect(result.valid).toBe(true);
        });

        it('rejects percent > 100', () => {
            const result = validateDiscount({
                type: 'PERCENT',
                value: 101,
                orderTotalCents: 10000,
            });
            expect(result.valid).toBe(false);
        });

        it('rejects fixed discount > order total', () => {
            const result = validateDiscount({
                type: 'FIXED',
                value: 15000,
                orderTotalCents: 10000,
            });
            expect(result.valid).toBe(false);
        });

        it('rejects negative discount', () => {
            const result = validateDiscount({
                type: 'FIXED',
                value: -100,
                orderTotalCents: 10000,
            });
            expect(result.valid).toBe(false);
        });
    });

    describe('validateTip', () => {
        it('accepts valid tip', () => {
            const result = validateTip({
                amountCents: 500,
                orderTotalCents: 5000,
            });
            expect(result.valid).toBe(true);
        });

        it('rejects negative tip', () => {
            const result = validateTip({
                amountCents: -100,
                orderTotalCents: 5000,
            });
            expect(result.valid).toBe(false);
        });

        it('rejects tip > max amount', () => {
            const result = validateTip({
                amountCents: LIMITS.MAX_TIP_AMOUNT_CENTS + 1,
                orderTotalCents: 100000000,
            });
            expect(result.valid).toBe(false);
        });

        it('rejects tip > max percent', () => {
            const result = validateTip({
                amountCents: 6000, // 60% of 10000
                orderTotalCents: 10000,
            });
            expect(result.valid).toBe(false);
        });
    });

    describe('validateVoidReason', () => {
        it('accepts valid reason', () => {
            const result = validateVoidReason('Cliente cambió de opinión');
            expect(result.valid).toBe(true);
        });

        it('rejects empty reason', () => {
            const result = validateVoidReason('');
            expect(result.valid).toBe(false);
        });

        it('rejects too short reason', () => {
            const result = validateVoidReason('ab');
            expect(result.valid).toBe(false);
        });
    });

    describe('validateSplitBill', () => {
        it('accepts when under limit', () => {
            const result = validateSplitBill({ currentCheckCount: 0 });
            expect(result.valid).toBe(true);
        });

        it('rejects when at limit', () => {
            const result = validateSplitBill({ 
                currentCheckCount: LIMITS.MAX_CHECKS_PER_ORDER 
            });
            expect(result.valid).toBe(false);
        });
    });
});
