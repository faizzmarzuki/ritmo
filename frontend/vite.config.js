import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv (not bare process.env) so API_PROXY_TARGET / PORT can also come
  // from .env files for the active mode; actual process env still wins.
  const env = loadEnv(mode, __dirname, '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: Number(env.PORT) || 5173,
      // Same-origin path to the backend so the app works on any dev port
      // (used when VITE_API_URL is set to empty — see .env.local-proxy).
      proxy: {
        '/api': { target: env.API_PROXY_TARGET || 'http://localhost:4000' },
      },
    },
  }
})
