import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    // Same-origin path to the backend so the app works on any dev port
    // (used when VITE_API_URL is set to empty — see .env.local-proxy).
    proxy: {
      '/api': { target: 'http://localhost:4000' },
    },
  },
})
