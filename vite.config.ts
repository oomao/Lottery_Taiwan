import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// GitHub Pages 部署在 https://<user>.github.io/<repo>/,所以 base 要設成 repo 名
// 開發時 (dev) base 用 /,build 時用 /lottery/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/lottery/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
}));
