import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Relative base path ensures styles & scripts load on GitHub Pages subpaths & local servers
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
