import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { get } from '../lib/api.js';

const P = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  dumbbell: 'M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  menu: 'M4 7h16M4 12h16M4 17h16',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  database: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  play: 'M7 4.5v15l12-7.5z',
  check: 'M5 12.5 10 17 19 7',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M9 2h6',
  flame: 'M12 21c4 0 7-2.7 7-6.5 0-3.9-3-5.5-4-9.5-2 1.5-3 3.5-3 5.5-1-1-1.5-2-1.5-3.5C8 9 5 11.5 5 14.5 5 18.3 8 21 12 21z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  alert: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  skip: 'M5 5l10 7-10 7zM19 5v14',
  wifiOff: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.7M19 13a10 10 0 0 0-2.3-1.6M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5M12 20h.01',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
};
export function Icon({ name, size = 20, stroke = 2, className = '' }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] || P.info} />
    </svg>
  );
}

export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    try { setState({ data: await get(path), error: null, loading: false }); }
    catch (e) { setState((s) => ({ ...s, error: e, loading: false })); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status">{items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}

export function Page({ title, subtitle, actions, children, back }) {
  return (
    <div className="page fade-in">
      <header className="page-head">
        <div className="page-title">
          {back && <button className="icon-btn" onClick={back} aria-label="Retour"><Icon name="left" /></button>}
          <div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Card({ title, action, children, className = '', icon }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && <div className="card-head">{title && <h2>{icon && <Icon name={icon} size={16} />}{title}</h2>}{action}</div>}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, hint, icon, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <div className="stat-label">{icon && <Icon name={icon} size={14} />}{label}</div>
      <div className="stat-value">{value}{unit && <span className="unit"> {unit}</span>}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer }) {
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey); document.body.classList.add('no-scroll');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        <div className="sheet-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="x" /></button></div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function Chips({ value = [], onChange, options, single }) {
  const toggle = (v) => onChange(single ? v : value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="chips">
      {options.map(([v, l]) => {
        const on = single ? value === v : value.includes(v);
        return <button key={v} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(v)}>{l}</button>;
      })}
    </div>
  );
}

// Dégradés partagés (anneaux, barres) : [début, fin]
export const GRADS = { fire: ['#ffb03a', '#ff4d8d'], aqua: ['#2ee6c5', '#3b82f6'], violet: ['#a78bfa', '#e14bd0'] };
let gid = 0;
export function Ring({ value = 0, size = 64, stroke = 7, label, color, grad = 'fire' }) {
  const [id] = useState(() => `rg${++gid}`);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r; const g = GRADS[grad] || GRADS.fire;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={g[0]} /><stop offset="1" stopColor={g[1]} /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color || `url(#${id})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.001, Math.min(1, value)))} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      {label != null && <span className="ring-label">{label}</span>}
    </div>
  );
}

// Anneaux d'activité concentriques : [{ value, grad, label, text }]
export function ActivityRings({ rings, size = 150, stroke = 13, gap = 4, center }) {
  const [ids] = useState(() => rings.map(() => `ar${++gid}`));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>{rings.map((rg, i) => { const g = GRADS[rg.grad]; return <linearGradient key={i} id={ids[i]} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={g[0]} /><stop offset="1" stopColor={g[1]} /></linearGradient>; })}</defs>
        {rings.map((rg, i) => {
          const r = size / 2 - stroke / 2 - i * (stroke + gap); const c = 2 * Math.PI * r;
          return (
            <g key={i}>
              <circle cx={size / 2} cy={size / 2} r={r} stroke={GRADS[rg.grad][0]} strokeOpacity=".14" strokeWidth={stroke} fill="none" />
              <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${ids[i]})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.001, Math.min(1, rg.value)))} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </g>
          );
        })}
      </svg>
      {center && <span className="ring-label">{center}</span>}
    </div>
  );
}

export const Loading = () => <div className="loading"><div className="spinner" /></div>;
export const ErrorBox = ({ error, retry }) => (
  <div className="empty"><Icon name="alert" size={28} /><p>{error?.message || 'Erreur'}</p>{retry && <button className="btn" onClick={retry}>Réessayer</button>}</div>
);
export const Empty = ({ icon = 'info', title, children }) => (
  <div className="empty"><Icon name={icon} size={28} /><p className="empty-title">{title}</p>{children}</div>
);

export function Confirm({ open, title, text, confirmLabel = 'Confirmer', danger, onConfirm, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button></>}>
      <p>{text}</p>
    </Sheet>
  );
}

// Champ numérique pratique sur iPhone (clavier décimal)
export function NumInput({ value, onChange, step = 1, min = 0, placeholder, className = '', ...rest }) {
  return (
    <input className={`num ${className}`} type="text" inputMode="decimal" placeholder={placeholder} value={value ?? ''}
      onChange={(e) => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) onChange(v === '' ? null : v); }}
      onBlur={(e) => { const v = e.target.value.replace(',', '.'); if (v !== '' && !Number.isNaN(Number(v))) onChange(Math.max(min, Number(v))); }}
      data-step={step} {...rest} />
  );
}
