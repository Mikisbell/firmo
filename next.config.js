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
    
    // CORS Configuration
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
                        value: '86400', // 24 hours
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
};

export default withSerwist(nextConfig);
