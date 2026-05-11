import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// GitHub Pages 部署在 https://<user>.github.io/<repo>/,所以 base 要設成 repo 名
// 開發時 (dev) base 用 /,build 時用 /Lottery_Taiwan/ (對齊 GitHub repo 名稱)
export default defineConfig(({ command }) => {
  const BASE = command === 'build' ? '/Lottery_Taiwan/' : '/';

  return {
    base: BASE,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: '台灣彩券資訊',
          short_name: '彩券資訊',
          description: '539、大樂透、威力彩 開獎查詢與統計分析',
          lang: 'zh-Hant',
          theme_color: '#dc2626',
          background_color: '#f9fafb',
          display: 'standalone',
          orientation: 'portrait',
          start_url: BASE,
          scope: BASE,
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,json}'],
          // ML 模型 JSON 太大(2+ MB)且只在 ML 面板用到,改走 runtime NetworkFirst,不進 precache
          globIgnores: ['**/models/**'],
          navigateFallback: `${BASE}index.html`,
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'data-cache',
                networkTimeoutSeconds: 3,
                expiration: { maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.pathname.includes('/models/') &&
                (url.pathname.endsWith('.json') || url.pathname.endsWith('.bin')),
              handler: 'CacheFirst',
              options: {
                cacheName: 'models-cache',
                expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});
