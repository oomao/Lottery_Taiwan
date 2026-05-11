import { useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import Layout from './components/layout/Layout';
import Home from './routes/Home';
import Lottery539 from './routes/Lottery539';
import Lotto649 from './routes/Lotto649';
import SuperLotto from './routes/SuperLotto';
import NotFound from './routes/NotFound';

export default function App() {
  // PWA 三層自動更新檢查:
  // 1) registerType: 'prompt' (vite.config) — 偵測到新版觸發 onNeedRefresh → banner
  // 2) hourly poll — 久開分頁也能拿到新版
  // 3) visibilitychange — 切回分頁瞬間檢查
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      swRegistrationRef.current = registration;
    },
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      swRegistrationRef.current?.update().catch(() => {});
    }, 60 * 60 * 1000);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        swRegistrationRef.current?.update().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const applyUpdate = () => {
    updateServiceWorker(true);
  };
  const dismissUpdate = () => {
    setNeedRefresh(false);
  };

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/539" element={<Lottery539 />} />
        <Route path="/lotto649" element={<Lotto649 />} />
        <Route path="/superlotto" element={<SuperLotto />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      {needRefresh && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 px-4 pb-3 pt-3 sm:pb-4"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-md mx-auto bg-slate-900 text-slate-100 border border-amber-400 shadow-lg flex items-center gap-3 px-4 py-3 text-sm">
            <span className="text-amber-400">●</span>
            <span className="flex-1">新版本已就緒</span>
            <button
              type="button"
              onClick={dismissUpdate}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
            >
              稍後
            </button>
            <button
              type="button"
              onClick={applyUpdate}
              className="text-xs font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 px-3 py-1.5"
            >
              重新載入
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
