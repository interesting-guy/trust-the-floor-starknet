import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
