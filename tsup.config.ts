import { defineConfig } from 'tsup';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  entry: ['index.ts', 'src/**/*.ts', 'skills/migpt-smart-home/index.ts', 'skills/migpt-speaker-control/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: !isProd,
  clean: true,
  bundle: false,
  external: ['openclaw/plugin-sdk', 'node-fetch'],
  noExternal: [],
  // 生产构建：压缩代码，移除 console.log/debug（保留 error/warn）
  minify: isProd,
  esbuildOptions(options) {
    if (isProd) {
      options.pure = ['console.log', 'console.debug'];
    }
  },
});
