import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → sitio web (dist/) para GitHub Pages.
// `npm run build:single` → un solo HTML (dist-single/) para usar sin internet.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
}));
