import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  define: {
    // starknet.js needs globalThis.global
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // some starknet deps need buffer
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
})
