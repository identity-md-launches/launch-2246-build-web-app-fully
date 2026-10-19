import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  publicDir: 'web/public',
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1600 },
  test: { include: ['web/tests/**/*.test.ts'], environment: 'node', pool: 'forks', poolOptions: { forks: { singleFork: true } } },
});
