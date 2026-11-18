import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/** Pure-TypeScript tests only: game math, species search, badges, awards, transfer framing. */
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
