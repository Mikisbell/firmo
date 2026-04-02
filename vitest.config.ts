import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    test: {
        environment: "node",
        exclude: ['**/node_modules/**', '**/e2e/**', '**/.claude/worktrees/**'],
        testTimeout: 30000, // 30 seconds for async property tests with DB operations
        retry: 2, // Retry flaky property tests (delivery assignment under high concurrency)
        pool: 'forks', // Use forks instead of threads to reduce resource contention
        poolOptions: { forks: { maxForks: 4 } }, // Limit parallel workers
        env: {
            // Variables de entorno necesarias para tests
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
