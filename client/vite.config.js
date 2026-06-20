import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
    // Proxy /socket.io traffic to the backend in dev so VITE_SERVER_URL
    // isn't needed locally — just works out of the box.
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true
      }
    }
  },

  build: {
    sourcemap: false,      // No sourcemaps in production bundles
    chunkSizeWarningLimit: 600
  }
})
