/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["monaco-editor"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        net: false,
        tls: false,
        fs: false,
      };

      // Configure Monaco Editor loader
      config.module.rules.push({
        test: /\.ttf$/,
        type: 'asset/resource',
      });
    }
    return config;
  },
};

export default nextConfig;
