import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static export for IPFS gateways: every asset URL is relative and the
// production files land in the repository-root dist/ folder.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
