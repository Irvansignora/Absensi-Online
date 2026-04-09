const withPWA = require('next-pwa')({
  dest: 'public',
  register: false,
  skipWaiting: true,
  sw: 'sw.js',
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com/,
      handler: 'CacheFirst',
      options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com/,
      handler: 'CacheFirst',
      options: { cacheName: 'google-fonts-static', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 } },
    },
    // Cache MediaPipe model & WASM agar tidak diunduh ulang setiap sesi
    {
      urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe/,
      handler: 'CacheFirst',
      options: { cacheName: 'mediapipe-cdn', expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 } },
    },
    {
      urlPattern: /^https:\/\/storage\.googleapis\.com\/mediapipe-models/,
      handler: 'CacheFirst',
      options: { cacheName: 'mediapipe-models', expiration: { maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 } },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false, stream: false }
    return config
  },
}

module.exports = withPWA(nextConfig)
