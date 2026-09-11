import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';

// ─── AUTO-UPDATE ───────────────────────────────────────────────
// Check for a new build every time the app is opened or brought back
// to the foreground (and hourly while open). With registerType
// 'autoUpdate', a new service worker activates immediately and the
// helper below reloads the page, so one launch is enough to get the
// latest version — no more stale builds stuck on the home screen.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('focus', check);
    setInterval(check, 60 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
