// 註冊 Service Worker (PWA)
// 開發環境不註冊,免得影響熱重載

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`.replace(/\/+/g, '/');
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW register failed:', err);
    });
  });
}
