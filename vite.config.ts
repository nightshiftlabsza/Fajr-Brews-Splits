import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

// Vite's built-in ?inline does not inline .ttf, and jsPDF needs the font bytes as base64.
function inlineTtfPlugin(): Plugin {
  return {
    name: 'inline-ttf',
    enforce: 'pre',
    load(id) {
      if (!/\.ttf\?inline$/.test(id)) return;
      const base64 = fs.readFileSync(id.replace(/\?inline$/, '')).toString('base64');
      return `export default "data:font/ttf;base64,${base64}";`;
    },
  };
}

export default defineConfig({
  plugins: [inlineTtfPlugin(), react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
