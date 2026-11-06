import * as tsdown from 'tsdown'

const configuration = tsdown.defineConfig({
  entry: ['src/index.ts', 'src/types.ts'],
  format: ['esm'],
  target: 'es2022',
  dts: true,
  clean: true,
  sourcemap: true
})

export default configuration
