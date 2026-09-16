import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: "default-src 'self' 'unsafe-eval' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' wss://*.gate.io wss://*.binance.com https://*.gate.io https://*.binance.com https://api.binance.com wss://stream.bybit.com wss://advanced-trade-ws.coinbase.com https://api.gateio.ws wss://fx-ws.gateio.ws;" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // `npm run build` is a release gate: type errors must fail the build.
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Public landing page: revalidate in browser on fresh session, but allow Cloudflare Edge
        // to cache the prerendered static shell (s-maxage) without invoking the Worker repeatedly.
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/terminal",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Static marketing and brand media assets.
        source: "/(landing|brand)/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // A historic Vite PWA used this scope. Keep the retirement script fresh
        // so browsers with that old controller promptly receive the cleanup.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
