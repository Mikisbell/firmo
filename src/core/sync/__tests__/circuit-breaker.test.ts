import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker';

describe('CircuitBreaker', () => {
    let cb: CircuitBreaker;

    beforeEach(() => {
        cb = new CircuitBreaker(3, 100, 2); // 3 fallos, 100ms timeout, 2 éxitos para cerrar
    });

    it('starts in CLOSED state', () => {
        expect(cb.getState()).toBe('CLOSED');
    });

    it('stays CLOSED on successful calls', async () => {
        await cb.execute(() => Promise.resolve('ok'));
        await cb.execute(() => Promise.resolve('ok'));
        expect(cb.getState()).toBe('CLOSED');
    });

    it('opens after threshold failures', async () => {
        const failingFn = () => Promise.reject(new Error('fail'));

        for (let i = 0; i < 3; i++) {
            try {
                await cb.execute(failingFn);
            } catch { /* expected */ }
        }

        expect(cb.getState()).toBe('OPEN');
    });

    it('rejects calls when OPEN', async () => {
        // Force open
        const failingFn = () => Promise.reject(new Error('fail'));
        for (let i = 0; i < 3; i++) {
            try { await cb.execute(failingFn); } catch { /* expected */ }
        }

        expect(cb.getState()).toBe('OPEN');

        // Should reject immediately
        await expect(cb.execute(() => Promise.resolve('ok')))
            .rejects.toThrow('Circuit breaker is OPEN');
    });

    it('transitions to HALF_OPEN after timeout', async () => {
        const failingFn = () => Promise.reject(new Error('fail'));
        for (let i = 0; i < 3; i++) {
            try { await cb.execute(failingFn); } catch { /* expected */ }
        }

        expect(cb.getState()).toBe('OPEN');

        // Wait for timeout
        await new Promise(r => setTimeout(r, 150));

        // Next call should transition to HALF_OPEN and execute
        const result = await cb.execute(() => Promise.resolve('recovered'));
        expect(result).toBe('recovered');
        expect(cb.getState()).toBe('HALF_OPEN');
    });

    it('closes after successful attempts in HALF_OPEN', async () => {
        const failingFn = () => Promise.reject(new Error('fail'));
        for (let i = 0; i < 3; i++) {
            try { await cb.execute(failingFn); } catch { /* expected */ }
        }

        // Wait for timeout
        await new Promise(r => setTimeout(r, 150));

        // 2 successful calls should close it
        await cb.execute(() => Promise.resolve('ok'));
        expect(cb.getState()).toBe('HALF_OPEN');
        
        await cb.execute(() => Promise.resolve('ok'));
        expect(cb.getState()).toBe('CLOSED');
    });

    it('reopens on failure in HALF_OPEN', async () => {
        const failingFn = () => Promise.reject(new Error('fail'));
        for (let i = 0; i < 3; i++) {
            try { await cb.execute(failingFn); } catch { /* expected */ }
        }

        // Wait for timeout
        await new Promise(r => setTimeout(r, 150));

        // First call succeeds, transitions to HALF_OPEN
        await cb.execute(() => Promise.resolve('ok'));
        expect(cb.getState()).toBe('HALF_OPEN');

        // Second call fails, should reopen
        try {
            await cb.execute(() => Promise.reject(new Error('fail again')));
        } catch { /* expected */ }

        expect(cb.getState()).toBe('OPEN');
    });

    it('reset() returns to CLOSED', async () => {
        const failingFn = () => Promise.reject(new Error('fail'));
        for (let i = 0; i < 3; i++) {
            try { await cb.execute(failingFn); } catch { /* expected */ }
        }

        expect(cb.getState()).toBe('OPEN');
        
        cb.reset();
        
        expect(cb.getState()).toBe('CLOSED');
        expect(cb.getStats().failures).toBe(0);
    });

    it('isOpen() returns correct value', async () => {
        expect(cb.isOpen()).toBe(false);

        const failingFn = () => Promise.reject(new Error('fail'));
        for (let i = 0; i < 3; i++) {
            try { await cb.execute(failingFn); } catch { /* expected */ }
        }

        expect(cb.isOpen()).toBe(true);

        // After timeout, isOpen should return false (ready to try)
        await new Promise(r => setTimeout(r, 150));
        expect(cb.isOpen()).toBe(false);
    });
});
