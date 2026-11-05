import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      // Apercu des liens partages : adresse absolue de l'image (VITE_SITE_URL), sinon adresse relative
      name: 'site-url',
      transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', (process.env.VITE_SITE_URL ?? '').replace(/\/$/, '')),
    },
  ],
  server: {
    // En dev, /api part vers l'API (docker compose ou npm run dev dans server/)
    proxy: { '/api': 'http://localhost:3001' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:3001' },
  },
})
