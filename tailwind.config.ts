import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Semantic Color System
                park: {
                    black: "#09090b", // Zinc 950
                    surface: "#18181b", // Zinc 900
                    border: "#27272a", // Zinc 800
                    text: "#e4e4e7", // Zinc 200
                    muted: "#a1a1aa", // Zinc 400

                    // Brand Identity (Deep Emerald/Tech)
                    brand: {
                        50: "#ecfdf5",
                        500: "#10b981",
                        600: "#059669",
                        900: "#064e3b",
                        glow: "rgba(16, 185, 129, 0.5)"
                    }
                }
            },
            fontFamily: {
                sans: ["var(--font-inter)"], // Use Variable font
            },
            animation: {
                "in": "fadeIn 0.2s ease-out",
                "out": "fadeOut 0.2s ease-in",
                "slide-up": "slideUp 0.3s ease-out",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0", transform: "scale(0.95)" },
                    "100%": { opacity: "1", transform: "scale(1)" },
                },
                fadeOut: {
                    "0%": { opacity: "1", transform: "scale(1)" },
                    "100%": { opacity: "0", transform: "scale(0.95)" },
                },
                slideUp: {
                    "0%": { transform: "translateY(10px)", opacity: "0" },
                    "100%": { transform: "translateY(0)", opacity: "1" },
                },
            },
        },
    },
    plugins: [],
};
export default config;
