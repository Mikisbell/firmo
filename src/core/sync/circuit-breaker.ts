/**
 * Circuit Breaker para Sync
 * 
 * Evita reintentos infinitos cuando el servidor está caído.
 * Estados: CLOSED (normal) → OPEN (bloqueado) → HALF_OPEN (probando)
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failures = 0;
    private lastFailure: Date | null = null;
    private successCount = 0;

    constructor(
        private threshold = 5,        // Fallos para abrir
        private timeout = 60000,      // 60s antes de reintentar
        private halfOpenAttempts = 3  // Intentos en HALF_OPEN
    ) {}

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (this.shouldAttemptReset()) {
                this.state = 'HALF_OPEN';
                this.successCount = 0;
                console.log('[CircuitBreaker] Transitioning to HALF_OPEN');
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private shouldAttemptReset(): boolean {
        if (!this.lastFailure) return false;
        return Date.now() - this.lastFailure.getTime() > this.timeout;
    }

    private onSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.halfOpenAttempts) {
                console.log('[CircuitBreaker] Closing circuit after successful attempts');
                this.state = 'CLOSED';
                this.failures = 0;
                this.successCount = 0;
            }
        } else {
            this.failures = 0;
        }
    }

    private onFailure() {
        this.failures++;
        this.lastFailure = new Date();
        this.successCount = 0;

        if (this.state === 'HALF_OPEN' || this.failures >= this.threshold) {
            console.warn(`[CircuitBreaker] Opening circuit after ${this.failures} failures`);
            this.state = 'OPEN';
        }
    }

    getState(): CircuitState {
        return this.state;
    }

    isOpen(): boolean {
        return this.state === 'OPEN' && !this.shouldAttemptReset();
    }

    reset() {
        this.state = 'CLOSED';
        this.failures = 0;
        this.lastFailure = null;
        this.successCount = 0;
    }

    getStats() {
        return {
            state: this.state,
            failures: this.failures,
            lastFailure: this.lastFailure,
            successCount: this.successCount,
        };
    }
}

// Singleton para uso global
export const syncCircuitBreaker = new CircuitBreaker();
