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
