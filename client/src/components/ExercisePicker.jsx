import { useEffect, useMemo, useState } from 'react';
import { get } from '../lib/api.js';
import { Sheet, Loading, Icon } from './ui.jsx';

const norm = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Choix d'un exercice de la bibliothèque, avec en tête ceux qui travaillent les mêmes muscles
export default function ExercisePicker({ open, onClose, title, like, onPick }) {
  const [lib, setLib] = useState(null); const [q, setQ] = useState('');
  useEffect(() => { if (open && !lib) get('/exercises').then((r) => setLib(r.exercises)).catch(() => setLib([])); if (open) setQ(''); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => {
    if (!lib) return [];
    const nq = norm(q);
    const score = (e) => {
      if (!like) return 0;
      if (e.id === like.exercise_id) return -1;
      let s = e.pattern && e.pattern === like.pattern ? 10 : 0;
      for (const [m, w] of Object.entries(e.muscles || {})) s += (like.muscles?.[m] || 0) * w * 3;
      return s;
    };
    return lib.filter((e) => !nq || norm(e.name).includes(nq) || norm(e.equipment).includes(nq))
      .map((e) => ({ e, s: score(e) })).filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name)).map((x) => x.e);
  }, [lib, q, like]);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <input className="mb" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher (nom, machine, haltères…)" />
      {!lib ? <Loading /> : (
        <ul className="pick-list">
          {list.slice(0, 60).map((e, i) => (
            <li key={e.id}>
              <button onClick={() => onPick(e)}>
                <span className="grow"><b className="small">{e.name}</b><span className="muted small">{e.equipment || '—'}{like && i < 5 && !q ? ' · mêmes muscles' : ''}</span></span>
                <Icon name="plus" size={16} />
              </button>
            </li>
          ))}
          {!list.length && <li className="muted small">Aucun exercice trouvé. Tu peux en créer un depuis Programme.</li>}
        </ul>
      )}
    </Sheet>
  );
}

// Échauffement progressif et disques à mettre de chaque côté de la barre
const PLATES = { lbs: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] };
export function platesFor(total, unit, bar) {
  let side = (total - bar) / 2; if (side < 0) return null;
  const out = [];
  for (const p of PLATES[unit] || PLATES.lbs) { while (side >= p - 1e-9) { out.push(p); side -= p; } }
  return { plates: out, rest: Math.round(side * 100) / 100 };
}
export function warmupFor(top, unit, kind) {
  if (kind !== 'weighted' || !top) return [];
  const step = unit === 'kg' ? 2.5 : 5; const min = unit === 'kg' ? 20 : 45;
  if (top < min * 1.2) return [];
  const r = (x) => Math.max(step, Math.round(x / step) * step);
  const ramp = [[0.4, 8], [0.6, 5], [0.8, 3]].map(([p, reps]) => ({ w: r(top * p), reps }));
  return ramp.filter((x, i) => x.w < top && (i === 0 || x.w > ramp[i - 1].w));
}
