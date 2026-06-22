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

    // IMPORTANTE PARA CLOUDFLARE EDGE:
    // No usar output: 'standalone' (eso es para Node/Docker).
    // No usar serverExternalPackages (Cloudflare necesita todo empaquetado, no puede hacer require() en runtime).
    
    allowedDevOrigins: ['192.168.1.167', '172.19.32.1', 'localhost', '0.0.0.0'],

    // Code Splitting Optimization
    experimental: {
        // Enable optimized package imports for better code splitting
        optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui/react-icons', 'framer-motion', 'sonner'],
    },

    // VALIDACION DE TIPOS EN EL BUILD (Vercel):
    // El build NO ignora errores de TypeScript: si tsc falla, el deploy falla. Esto evita
    // que errores de tipos lleguen a produccion invisiblemente (paso obligatorio antes del go-live).
    // El typecheck vive tambien en CI (.github/workflows/ci.yml) como doble red.
    // ESLint NO se configura aqui: Next 16 elimino `next lint`, por lo que la clave `eslint`
    // ya no es valida y el build no corre lint. El gate real de lint es CI (bun run lint).

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
            // NOTA: no seteamos Cache-Control para /_next/static aqui. Next/Vercel ya aplican
            // `public, max-age=31536000, immutable` a esos assets hasheados, y un header custom
            // rompe el comportamiento de dev (HMR). Ver aviso de Next al iniciar el dev server.
            {
                // Prevent caching of sensitive API responses (auth, admin)
                source: '/api/auth/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    },
                    {
                        key: 'Pragma',
                        value: 'no-cache',
                    },
                ],
            },
            {
                source: '/api/admin/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, no-cache, must-revalidate',
                    },
                    {
                        key: 'Pragma',
                        value: 'no-cache',
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
                        // React fast refresh requires unsafe-eval in development mode
                        value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ""} https://vercel.live https://*.vercel.app; style-src 'self' 'unsafe-inline' https://vercel.live https://*.vercel.app; img-src 'self' data: https: blob:; font-src 'self' data: https://vercel.live https://*.vercel.app; connect-src 'self' https://api.push.apple.com https://updates.push.services.mozilla.com https://vercel.live https://*.vercel.app wss://*.vercel.app ${process.env.NODE_ENV === 'development' ? "ws: wss:" : ""}; frame-src 'self' https://vercel.live https://*.vercel.app; frame-ancestors 'none'; media-src 'self' blob:;`,
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
