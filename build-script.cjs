const { build } = require('tsup');
build({
  entry: ['index.ts'],
  outDir: 'dist',
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  external: ['openclaw', 'openclaw/*'],
  tsconfig: 'tsconfig.json',
}).then(() => {
  console.log('Build complete!');
}).catch(e => {
  console.error('Build failed:', e);
  process.exit(1);
});
