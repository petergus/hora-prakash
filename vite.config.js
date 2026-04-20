// vite.config.js
export default {
  base: '/hora-prakash/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep swisseph (WASM wrapper) in its own chunk
          if (id.includes('swisseph-wasm')) return 'swisseph'
          // Group small core utilities together
          if (id.includes('/src/core/') || id.includes('/src/utils/') || id.includes('/src/state')) return 'core'
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['swisseph-wasm'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
}
