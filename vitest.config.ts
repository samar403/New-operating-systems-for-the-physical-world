import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@core': fileURLToPath(new URL('./core', import.meta.url)) } },
  test: { include: ['core/**/*.test.ts', 'server/**/*.test.ts'] },
});
