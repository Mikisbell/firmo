"use client";

import { db } from '../db/schema';
import { logger } from '@/src/core/observability/logger';

/**
 * Lightweight product recommendation engine based on co-occurrence frequency.
 * Replaces TensorFlow.js (~4MB) with a zero-dependency frequency counter.
 * Same API: train() + predict(cartIds).
 */

const PRODUCT_IDS = ['p1', 'p2', 'p3', 'p4'];

type CoMatrix = Record<string, Record<string, number>>;

export class RecommendationEngine {
    private coMatrix: CoMatrix = {};
    private isTrained = false;

    private initMatrix(): CoMatrix {
        const m: CoMatrix = {};
        for (const a of PRODUCT_IDS) {
            m[a] = {};
            for (const b of PRODUCT_IDS) {
                m[a][b] = 0;
            }
        }
        return m;
    }

    private async getPurchaseHistory(): Promise<string[][]> {
        if (typeof window === 'undefined') return [];

        const events = await db.events.toArray();
        const sales = events.filter(e => e.event_type === 'SALE_CONFIRMED');

        if (sales.length < 5) {
            logger.debug('AI_SYNTHETIC_DATA', 'Using synthetic data for demo - insufficient history');
            return [
                ['p1', 'p2'],
                ['p1', 'p3'],
                ['p2', 'p4'],
                ['p1', 'p2'],
                ['p1', 'p2', 'p3'],
                ['p3', 'p4'],
            ];
        }

        return [];
    }

    async train() {
        if (typeof window === 'undefined') {
            logger.debug('AI_SSR_SKIP', 'Recommendation engine skipped (SSR)');
            return;
        }

        logger.info('AI_TRAINING_START', 'Training co-occurrence model');
        const baskets = await this.getPurchaseHistory();
        if (baskets.length === 0) return;

        this.coMatrix = this.initMatrix();

        for (const basket of baskets) {
            for (const a of basket) {
                for (const b of basket) {
                    if (a !== b && this.coMatrix[a]?.[b] !== undefined) {
                        this.coMatrix[a][b]++;
                    }
                }
            }
        }

        this.isTrained = true;
        logger.info('AI_TRAINING_COMPLETE', 'Co-occurrence model trained');
    }

    predict(currentCartIds: string[]): { id: string; score: number }[] {
        if (!this.isTrained || currentCartIds.length === 0) {
            return [];
        }

        const scores: Record<string, number> = {};

        for (const cartId of currentCartIds) {
            const row = this.coMatrix[cartId];
            if (!row) continue;
            for (const [productId, count] of Object.entries(row)) {
                if (!currentCartIds.includes(productId)) {
                    scores[productId] = (scores[productId] ?? 0) + count;
                }
            }
        }

        return Object.entries(scores)
            .map(([id, score]) => ({ id, score }))
            .sort((a, b) => b.score - a.score);
    }
}

export const recommender = new RecommendationEngine();
