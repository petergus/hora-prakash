// vite.config.js
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

const BUILD_HASH = Date.now().toString(36)

// Replaces __BUILD_HASH__ in public/sw.js → dist/sw.js after build.
// Vite's `define` only processes bundled JS, not files copied from public/.
function swHashPlugin() {
  return {
    name: 'sw-hash',
    closeBundle() {
      const sw = path.resolve('dist/sw.js')
      if (!fs.existsSync(sw)) return
      const src = fs.readFileSync(sw, 'utf8')
      fs.writeFileSync(sw, src.replaceAll('__BUILD_HASH__', BUILD_HASH))
    },
  }
}

export default defineConfig({
  plugins: [swHashPlugin()],
  base: '/hora-prakash/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('swisseph-wasm')) return 'swisseph'
          if (id.includes('/src/core/') || id.includes('/src/utils/') || id.includes('/src/state')) return 'core'
        },
      },
    },
  },
  define: {
    __BUILD_HASH__: JSON.stringify(BUILD_HASH),
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
})
