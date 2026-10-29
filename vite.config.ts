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

function cloudflareHeadersPreviewPlugin(): Plugin {
  return {
    name: 'cloudflare-headers-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && /^\/assets\//.test(req.url)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [inlineTtfPlugin(), react(), cloudflareHeadersPreviewPlugin()],
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
  preview: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy-Report-Only': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
    },
  },
})
