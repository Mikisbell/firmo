import pkg from 'minimatch';
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
    swSrc: "src/sw.ts",
    swDest: "public/sw.js",
    // Desactivar en desarrollo para evitar problemas de cache
    disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    
    // Security Headers Configuration
    async headers() {
        return [
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
                        value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.push.apple.com https://updates.push.services.mozilla.com; frame-ancestors 'none';",
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

    // Suppress Zustand deprecation warning from dependencies
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.ignoreWarnings = [
                ...(config.ignoreWarnings || []),
                {
                    module: /node_modules\/zustand/,
                    message: /Default export is deprecated/,
                },
            ];
        }
        return config;
    },
    
    // Turbopack configuration (empty to silence warning)
    turbopack: {},
};

export default withSerwist(nextConfig);
