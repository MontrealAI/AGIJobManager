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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https: wss:; style-src 'self' 'unsafe-inline'; script-src 'self' https://*.walletconnect.com https://*.walletconnect.org;"
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
