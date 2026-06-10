import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
      ],
      manifest: {
        name: '8FM Pickleball',
        short_name: '8FM',
        description: '8FM Pickleball — CLB cộng đồng. Check-in, đổi quà, đăng ký giải.',
        theme_color: '#1D9E75',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'vi',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // Drop precache entries from previous SW versions so a user's
        // device doesn't accumulate stale chunks across deploys
        cleanupOutdatedCaches: true,
        // Allow bigger chunks (AdminPage ~64 KB)
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Cache Supabase GETs (selects). POSTs (RPCs / mutations)
            // intentionally NOT cached — always hit network
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
            },
          },
          {
            // Cache images from Supabase Storage
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            method: 'GET',
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
