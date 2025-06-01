const nextConfig = {
    webpack: (config) => {
        config.resolve.fallback = Object.assign(Object.assign({}, config.resolve.fallback), { "bcryptjs": require.resolve("bcryptjs") });
        return config;
    },
};
export default nextConfig;
