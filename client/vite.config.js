import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Liste des fichiers générés, précachés par le service worker (fonctionnement hors ligne dès la 1re visite)
const precache = () => ({
  name: 'precache-manifest',
  generateBundle(_, bundle) {
    this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(Object.keys(bundle).filter((f) => f.startsWith('assets/')).map((f) => '/' + f)) });
  },
});
const standalone = !!process.env.VITE_STANDALONE;
// Version autonome : un seul fichier HTML, sans manifeste ni icônes externes
const stripPwa = () => ({ name: 'strip-pwa', transformIndexHtml: (html) => html.replace(/\s*<link rel="(manifest|apple-touch-icon|icon)"[^>]*>/g, '') });

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: standalone ? [react(), stripPwa(), viteSingleFile()] : [react(), precache()],
  resolve: { alias: { express: path.resolve(import.meta.dirname, 'src/local/expressShim.js') } },
  build: { assetsInlineLimit: standalone ? 100000000 : 4096, copyPublicDir: !standalone, outDir: path.resolve(import.meta.dirname, standalone ? '../dist-standalone' : '../dist'), emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
