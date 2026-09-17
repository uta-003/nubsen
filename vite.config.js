import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = 'http://localhost:9091'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 9090,
    // Proxy API & uploads ke backend Express — frontend cukup memanggil '/api/...'
    proxy: {
      '/api': backend,
      '/uploads': backend,
    },
  },
  // `npm run preview` mewarisi server.proxy, di-set eksplisit agar jelas.
  preview: {
    port: 9090,
    proxy: {
      '/api': backend,
      '/uploads': backend,
    },
  },
})
