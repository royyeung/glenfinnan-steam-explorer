import { defineConfig } from 'vite';

export default defineConfig({
  base: '/glenfinnan/',
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 2500, sourcemap: false },
  server: { host: true },
  test: { include: ['tests/**/*.test.ts'] },
} as import('vite').UserConfig);
