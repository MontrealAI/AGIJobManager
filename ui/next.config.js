/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: async () => "agijobmanager-ipfs-v1",
  outputFileTracingRoot: __dirname,
  transpilePackages: ['@base-org/account'],
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Wallet connectors use the SDK's published browser entry. Its Node
      // entry also exports server-only CDP payment APIs and optional x402 peers.
      '@base-org/account$': require.resolve('@base-org/account/browser'),
      // Use the official AsyncStorage browser implementation, with real
      // localStorage semantics, for the SDK's optional native-package import.
      '@react-native-async-storage/async-storage$': require.resolve('@agijobmanager/async-storage-browser'),
      encoding: false,
      'pino-pretty': false
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' }
        ]
      }
    ]
  }
}

module.exports = nextConfig
