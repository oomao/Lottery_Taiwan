import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';
import { initTheme } from './lib/theme';
import { registerSW } from './lib/register-sw';

initTheme();
registerSW();

// 用 HashRouter 因為 GitHub Pages 對 BrowserRouter 的 fallback 路由支援不佳
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
