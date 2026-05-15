import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const appVersion = typeof pkg.version === 'string' ? pkg.version : '0.0.0'
const appCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? ''

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(appCommit),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      /** Auto-register the service worker; Workbox-generated. */
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'apple-touch-icon-180x180.png',
        'pwa-source.svg',
      ],
      manifest: {
        name: 'Invisible Workload',
        short_name: 'Capture',
        description:
          'One-tap capture of workflow interruptions and compensations. Anonymous, fast, offline-friendly.',
        theme_color: '#5b52d6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/capture',
        scope: '/',
        lang: 'en',
        categories: ['health', 'productivity', 'medical'],
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        /** Precache the entire app shell so the page boots offline. */
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
        /** Don't try to satisfy /api/* from cache — see runtimeCaching below. */
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          /**
           * POST /api/events: network-only (no Background Sync — Safari/iOS).
           * Offline captures are queued in IndexedDB in the app and replayed from there.
           */
          {
            urlPattern: ({ url, request }) =>
              request.method === 'POST' && url.pathname === '/api/events',
            handler: 'NetworkOnly',
            method: 'POST',
          },
          /**
           * Auth and analytics: always go to the network. We don't want stale
           * dashboards or cached auth answers.
           */
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          /** Google Fonts (woff2 etc) — long-cache as immutable assets. */
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.gstatic.com' || url.origin === 'https://fonts.googleapis.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        /** Enable the SW in `vite dev` so we can test offline behavior locally. */
        enabled: false,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Keep heavy charting code out of the initial app chunk.
         * This pairs with route-level lazy loading in App routes.
         */
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'recharts-vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      // Browser calls same origin: /api/... → Vite forwards to Express (no CORS hassle in dev)
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        // /api/health → http://127.0.0.1:5000/health (Express mounts routes without /api prefix)
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
