import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastProvider } from './components/ui.jsx';
import { STANDALONE } from './lib/api.js';
import './styles.css';

const Router = STANDALONE ? MemoryRouter : BrowserRouter;

// Quand la sauvegarde en ligne (plus récente) remplace les données locales, on recharge l'interface
function Root() {
  const [gen, setGen] = useState(0);
  useEffect(() => { const f = () => setGen((g) => g + 1); window.addEventListener('gt-data-replaced', f); return () => window.removeEventListener('gt-data-replaced', f); }, []);
  return <Router key={gen}><ToastProvider><App /></ToastProvider></Router>;
}

createRoot(document.getElementById('root')).render(<StrictMode><Root /></StrictMode>);

if (!STANDALONE && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
