import * as vite from 'vite'
import react from '@vitejs/plugin-react'
import * as url from 'node:url'

const libraryEntry = url.fileURLToPath(
  new URL('../src/index.ts', import.meta.url)
)
const scalerEntry = url.fileURLToPath(
  new URL('../src/scaler.ts', import.meta.url)
)
const typesEntry = url.fileURLToPath(
  new URL('../src/types.ts', import.meta.url)
)
const catalogEntry = url.fileURLToPath(new URL('../src/scalerCatalog.ts', import.meta.url))
const configuration = vite.defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@tasteee/scaled/catalog', replacement: catalogEntry },
      { find: '@tasteee/scaled/scaler', replacement: scalerEntry },
      { find: '@tasteee/scaled/types', replacement: typesEntry },
      { find: '@tasteee/scaled', replacement: libraryEntry }
    ]
  }
})

export default configuration
