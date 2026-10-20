import { defineConfig } from 'vite'

const VENDOR_CHUNKS: ReadonlyArray<readonly [chunk: string, packages: readonly string[]]> = [
  ['three', ['three']],
  ['physics', ['@dimforge/rapier3d-compat']],
  ['navigation', ['@recast-navigation/']],
  ['postfx', ['postprocessing', 'n8ao']],
  ['net', ['@colyseus/', '@colyseus/sdk']],
]

function vendorChunk(id: string): string | undefined {
  // Rollup helpers (vite's preload helper among them) would otherwise land in whichever vendor chunk saw them first.
  if (id.startsWith('\0')) return 'runtime'
  const at = id.lastIndexOf('/node_modules/')
  if (at < 0) return undefined
  const path = id.slice(at + '/node_modules/'.length)
  for (const [chunk, packages] of VENDOR_CHUNKS) {
    if (packages.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(`${p}/`)))) {
      return `vendor-${chunk}`
    }
  }
  return 'vendor'
}

export default defineConfig({
  build: {
    target: 'es2022',
    // rapier3d-compat inlines its wasm as base64: its chunk alone is ~2.2 MB.
    chunkSizeWarningLimit: 2300,
    rollupOptions: { output: { manualChunks: vendorChunk } },
  },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
})
