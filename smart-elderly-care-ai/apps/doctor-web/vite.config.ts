import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // node_modules là symlink dùng chung với apps/web -> tách cache Vite riêng, tránh 2 dev server ghi đè
  // deps của nhau (gây 2 bản React, lỗi "Invalid hook call" và trang trắng)
  cacheDir: '.vite-cache',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});

