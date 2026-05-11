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
        // 'prompt' 模式才會 fire onNeedRefresh → 觸發 banner。
        // 'autoUpdate' 模式 plugin 內部直接 window.location.reload(),
        // 永遠不會呼叫 onNeedRefresh,banner 會變 dead code。
        registerType: 'prompt',
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
            // 之前舊 manifest reference icon-192.png / icon-512.png 但檔案
            // 實際不存在 → Chrome 抓不到 icon → 不認證為可安裝 PWA,
            // 「新增至主螢幕」降級成 bookmark-only(通用 G icon)。
            // 改用 favicon.svg + sizes:'any' 一條搞定所有尺寸。
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg}'],
          // - models/**:ML 模型 JSON 太大(2+ MB),走 runtime CacheFirst
          // - data/**:每日 cron 更新,走 runtime NetworkFirst 才會撈新資料;
          //   若放 precache 會被 precache route 攔截,NetworkFirst 規則形同虛設
          globIgnores: ['**/models/**', '**/data/**'],
          navigateFallback: `${BASE}index.html`,
          // 不設 clientsClaim / skipWaiting — 配合 'prompt' 模式由 user 點
          // 「重新載入」才觸發 skipWaiting,避免使用者操作到一半被自動切版
          // 造成已 lazy-load 的 chunk 404。
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'data-cache',
                networkTimeoutSeconds: 3,
                // refresh() 帶 ?t=Date.now() bust cache,沒 ignoreSearch 會
                // 讓每次 refresh 都長出新 cache entry,日積月累爆量;設了
                // ignoreSearch 後同一支 URL 共用一個 cache key
                matchOptions: { ignoreSearch: true },
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
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
