import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'popup/popup': resolve(__dirname, 'src/popup/popup.html'),
        'options/options': resolve(__dirname, 'src/options/options.html'),
        'content/core': resolve(__dirname, 'src/content/core/detector.ts'),
        'content/providers/linkedin': resolve(__dirname, 'src/content/providers/linkedin/detector.ts'),
        'content/providers/hh': resolve(__dirname, 'src/content/providers/hh/detector.ts'),
        'content/providers/greenhouse': resolve(__dirname, 'src/content/providers/greenhouse/detector.ts'),
        'content/providers/lever': resolve(__dirname, 'src/content/providers/lever/detector.ts'),
        'content/providers/ashby': resolve(__dirname, 'src/content/providers/ashby/detector.ts'),
        'content/providers/workday': resolve(__dirname, 'src/content/providers/workday/detector.ts'),
        'content/providers/teamtailor': resolve(__dirname, 'src/content/providers/teamtailor/detector.ts'),
        'content/providers/smartrecruiters': resolve(__dirname, 'src/content/providers/smartrecruiters/detector.ts'),
        'content/providers/recruitee': resolve(__dirname, 'src/content/providers/recruitee/detector.ts'),
        'content/providers/generic': resolve(__dirname, 'src/content/providers/generic/jsonld.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
