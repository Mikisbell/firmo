import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Config SOLO para los spikes exploratorios (tests/simulation, tests/solutions).
 * Estos NO corren en el gate de CI (estan excluidos en vitest.config.ts) porque son
 * simulaciones autocontenidas que no importan codigo de produccion y no protegen nada.
 * Se corren on-demand con `bun run test:sim` cuando quieras revisar/actualizar un modelo.
 */
export default defineConfig({
    test: {
        environment: "node",
        include: ['tests/simulation/**/*.test.ts', 'tests/solutions/**/*.test.ts'],
        testTimeout: 30000,
        pool: 'forks',
        env: {
            JWT_SECRET: "test-jwt-secret-for-vitest-only-not-for-production",
            PIN_SALT: "PARK_POS_2026_",
            DEFAULT_TENANT_ID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
    },
});
