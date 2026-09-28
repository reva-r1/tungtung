import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/world': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/simulation': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/providers': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
