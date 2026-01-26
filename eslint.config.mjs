import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            ".next/**",
            "node_modules/**",
            "prisma/migrations/**",
            "scripts/**",
            "*.config.*",
        ],
    },
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": "off", // Disabled to avoid build errors
            "@typescript-eslint/no-require-imports": "off",
            // Next.js specific rules
            "@next/next/no-html-link-for-pages": "off",
        },
    },
);
