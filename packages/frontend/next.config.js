/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["patchpool-shared"],
  webpack(config) {
    // Coinbase's Base connector pulls in optional x402 peer imports through
    // Wagmi's connector barrel. PatchPool doesn't use those payment APIs.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core": false,
      "@x402/evm": false,
      "@x402/extensions": false,
      "@x402/svm": false,
    };
    return config;
  },
};

module.exports = nextConfig;
