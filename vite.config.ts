import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
})
