import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Note: no secrets are injected into the client bundle. The Gemini key is only
// read by the API server (server/), which Vite proxies to in development.
export default defineConfig({
  server: {
    port: 3000,
    host: '127.0.0.1',
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.API_PORT || 8787}`, changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
  },
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          charts: ['recharts'],
          maps: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
});
