import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
    swSrc: "src/sw.ts",
    swDest: "public/sw.js",
    // Desactivar en desarrollo para evitar problemas de cache
    disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,

    // Optimizar fuentes de Google
    optimizeFonts: true,

    // Exclude heavy server-only packages from serverless bundles (reduces cold start)
    serverExternalPackages: ['@prisma/client', 'prisma', 'pino', 'pino-pretty', '@logtail/pino', '@opentelemetry/sdk-node', '@opentelemetry/sdk-trace-node', '@vercel/otel'],

    // Code Splitting Optimization
    experimental: {
        // Enable optimized package imports for better code splitting
        optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui/react-icons', 'framer-motion', 'sonner'],
    },
    
    // Webpack configuration for code splitting
    webpack: (config, { isServer }) => {
        if (!isServer) {
            // Suppress Zustand deprecation warning
            config.ignoreWarnings = [
                ...(config.ignoreWarnings || []),
                {
                    module: /node_modules\/zustand/,
                    message: /Default export is deprecated/,
                },
            ];
            
            // Optimize chunk splitting for better caching
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    chunks: 'all',
                    cacheGroups: {
                        // Vendor chunk for node_modules
                        vendor: {
                            test: /[\\/]node_modules[\\/]/,
                            name: 'vendors',
                            priority: 10,
                            reuseExistingChunk: true,
                        },
                        // Separate chunk for large UI libraries
                        ui: {
                            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|recharts)[\\/]/,
                            name: 'ui-libs',
                            priority: 20,
                            reuseExistingChunk: true,
                        },
                        // Common chunk for shared code
                        common: {
                            minChunks: 2,
                            priority: 5,
                            reuseExistingChunk: true,
                            name: 'common',
                        },
                    },
                },
            };
        }
        return config;
    },
    
    // Security Headers Configuration
    async headers() {
        return [
            {
                // Cache static assets (Vercel handles MIME types automatically)
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            {
                // Apply CORS headers to all API routes
                source: '/api/:path*',
                headers: [
                    {
                        key: 'Access-Control-Allow-Credentials',
                        value: 'true',
                    },
                    {
                        key: 'Access-Control-Allow-Methods',
                        value: 'GET,POST,PUT,DELETE,OPTIONS',
                    },
                    {
                        key: 'Access-Control-Allow-Headers',
                        value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Api-Secret',
                    },
                    {
                        key: 'Access-Control-Max-Age',
                        value: '3600', // Reduced to 1 hour for security
                    },
                ],
            },
            {
                // Apply security headers to all routes
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains; preload',
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.app; style-src 'self' 'unsafe-inline' https://vercel.live https://*.vercel.app; img-src 'self' data: https: blob:; font-src 'self' data: https://vercel.live https://*.vercel.app; connect-src 'self' https://api.push.apple.com https://updates.push.services.mozilla.com https://vercel.live https://*.vercel.app wss://*.vercel.app; frame-src 'self' https://vercel.live https://*.vercel.app; frame-ancestors 'none'; media-src 'self' blob:;",
                    },
                ],
            },
        ];
    },
    
    // Permanent redirects (301)
    async redirects() {
        return [
            {
                source: '/admin/inventario',
                destination: '/inventario',
                permanent: true,
            },
        ];
    },

    // Turbopack configuration (empty to silence warning)
    turbopack: {},
};

export default withSerwist(nextConfig);
