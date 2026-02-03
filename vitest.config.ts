import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    test: {
        environment: "node",
        exclude: ['**/node_modules/**', '**/e2e/**'],
        testTimeout: 30000, // 30 seconds for async property tests with DB operations
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
    },
});
