import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vite build --mode artifact` produces a single-chunk build that scripts/make-artifact.mjs
// turns into one self-contained HTML page for hosting as a Claude artifact.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  build: mode === 'artifact'
    ? { outDir: 'dist-artifact', cssCodeSplit: false, assetsInlineLimit: 100_000_000, rollupOptions: { output: { inlineDynamicImports: true } } }
    : undefined,
  test: { environment: 'node' },
} as any));
