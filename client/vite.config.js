import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
