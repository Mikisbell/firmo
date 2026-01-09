"use client";

import { db } from '../db/schema';
import { logger } from '@/src/core/observability/logger';

// Mapa de productos simple para MVP
const PRODUCT_IDS = ['p1', 'p2', 'p3', 'p4'];
const PRODUCT_MAP: Record<string, number> = {
    'p1': 0, 'p2': 1, 'p3': 2, 'p4': 3
};
const ID_MAP: Record<number, string> = {
    0: 'p1', 1: 'p2', 2: 'p3', 3: 'p4'
};
const NUM_PRODUCTS = PRODUCT_IDS.length;

export class RecommendationEngine {
    private model: any = null;
    private isTrained = false;
    private tf: typeof import('@tensorflow/tfjs') | null = null;

    // Cargar TensorFlow solo en cliente
    private async loadTF() {
        if (typeof window === 'undefined') return null;
        if (!this.tf) {
            this.tf = await import('@tensorflow/tfjs');
            logger.info('AI_TENSORFLOW_LOADED', 'TensorFlow.js loaded');
        }
        return this.tf;
    }

    // Obtener historial de compras
    private async getPurchaseHistory(): Promise<number[][]> {
        const events = await db.events.toArray();
        const sales = events.filter(e => e.event_type === 'SALE_CONFIRMED');

        if (sales.length < 5) {
            logger.debug('AI_SYNTHETIC_DATA', 'Using synthetic data for demo - insufficient history');
            return [
                [1, 1, 0, 0], // Café + Croissant
                [1, 0, 1, 0], // Café + Jugo
                [0, 1, 0, 1], // Croissant + Sandwich
                [1, 1, 0, 0],
                [1, 1, 1, 0],
                [0, 0, 1, 1]
            ];
        }

        return [];
    }

    // Entrenar modelo
    async train() {
        const tf = await this.loadTF();
        if (!tf) {
            logger.debug('AI_TENSORFLOW_UNAVAILABLE', 'TensorFlow not available (SSR)');
            return;
        }

        logger.info('AI_TRAINING_START', 'Training recommendation model');
        const data = await this.getPurchaseHistory();
        if (data.length === 0) return;

        const tensorData = tf.tensor2d(data);

        this.model = tf.sequential();
        this.model.add(tf.layers.dense({
            units: 8,
            inputShape: [NUM_PRODUCTS],
            activation: 'relu'
        }));
        this.model.add(tf.layers.dense({
            units: NUM_PRODUCTS,
            activation: 'sigmoid'
        }));

        this.model.compile({ optimizer: 'adam', loss: 'binaryCrossentropy' });

        await this.model.fit(tensorData, tensorData, {
            epochs: 50,
            shuffle: true,
            verbose: 0
        });

        this.isTrained = true;
        logger.info('AI_TRAINING_COMPLETE', 'Model trained successfully');
    }

    // Predecir productos recomendados
    predict(currentCartIds: string[]): { id: string, score: number }[] {
        if (!this.model || !this.isTrained || !this.tf) {
            return [];
        }

        const inputVector = new Array(NUM_PRODUCTS).fill(0);
        currentCartIds.forEach(id => {
            if (PRODUCT_MAP[id] !== undefined) {
                inputVector[PRODUCT_MAP[id]] = 1;
            }
        });

        const inputTensor = this.tf.tensor2d([inputVector]);
        const prediction = this.model.predict(inputTensor) as any;
        const probabilities = prediction.dataSync() as Float32Array;

        const results = Array.from(probabilities).map((score, index) => ({
            id: ID_MAP[index],
            score: score as number
        }));

        // Filtrar productos ya en el carrito
        const filtered = results.filter(r => !currentCartIds.includes(r.id));

        // Ordenar por probabilidad descendente
        return filtered.sort((a, b) => b.score - a.score);
    }
}

export const recommender = new RecommendationEngine();
