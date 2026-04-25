// vite.config.js
import { VitePWA } from 'vite-plugin-pwa'

export default {
  base: '/hora-prakash/',
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      includeAssets: ['favicon.ico', 'icon.svg', 'wasm/*.wasm', 'wasm/*.data'],
      manifest: {
        name: 'Hora Prakash - Vedic Astrology',
        short_name: 'HoraPrakash',
        description: 'Static Vedic Astrology web app for calculations and charts.',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,svg,wasm}'],
        globIgnores: ['**/*.data'],  // 12MB ephemeris — cached at runtime on first use
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      }
    })
  ],
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
