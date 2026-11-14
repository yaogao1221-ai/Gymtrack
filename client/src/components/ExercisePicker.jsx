import { ExThumb } from './MoveFigure.jsx';
import { useEffect, useMemo, useState } from 'react';
import { get, post } from '../lib/api.js';
import { Sheet, Loading, Icon, useToast } from './ui.jsx';
import { loadLib, thumb, toExercise, norm, CATS, MUSCLES_APP } from '../lib/exlib.js';
import { ExerciseInfo } from './ExerciseDemo.jsx';

// Recherche dans tes exercices + la bibliothèque illustrée (900 exercices : muscu, crossfit, mobilité, cardio)
export function ExerciseBrowser({ like, onPick, mine: mineGiven }) {
  const [mine, setMine] = useState(mineGiven || null); const [lib, setLib] = useState(null);
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [mus, setMus] = useState(''); const [more, setMore] = useState(1);
  const [info, setInfo] = useState(null); const [busy, setBusy] = useState(null); const toast = useToast();
  useEffect(() => { if (!mineGiven) get('/exercises').then((r) => setMine(r.exercises)).catch(() => setMine([])); loadLib().then(setLib).catch(() => setLib([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mineGiven) setMine(mineGiven); }, [mineGiven]);
  useEffect(() => setMore(1), [q, cat, mus]);
  const list = useMemo(() => {
    if (!mine) return [];
    const nq = norm(q); const words = nq.split(/\s+/).filter(Boolean);
    const libById = new Map((lib || []).map((x) => [x.id, x]));
    const own = mine.map((e) => ({ key: `m${e.id}`, e, x: e.lib_id ? libById.get(e.lib_id) : null, name: e.name, sub: e.equipment, muscles: e.muscles || {}, pattern: e.pattern, c: e.lib_id ? libById.get(e.lib_id)?.c || 'muscu' : 'muscu', mine: true }));
    const used = new Set(mine.map((e) => e.lib_id).filter(Boolean));
    const fromLib = (lib || []).filter((x) => !used.has(x.id)).map((x) => ({ key: x.id, x, name: x.n, sub: x.q, en: x.en, muscles: x.c === 'mobilite' ? Object.fromEntries((x.t || []).map((m) => [m, 1])) : x.m, pattern: x.pt, c: x.c }));
    const score = (it) => {
      if (!like) return it.mine ? 1 : 0;
      if (it.e && it.e.id === like.exercise_id) return -1;
      let sc = it.pattern && it.pattern === like.pattern ? 10 : 0;
      for (const [m, w] of Object.entries(it.muscles || {})) sc += (like.muscles?.[m] || 0) * w * 3;
      return sc + (it.mine ? 2 : 0);
    };
    return [...own, ...fromLib]
      .filter((it) => (!cat || it.c === cat) && (!mus || (it.muscles?.[mus] || 0) >= 0.5))
      .filter((it) => !words.length || words.every((w) => norm(`${it.name} ${it.sub} ${it.en || ''}`).includes(w)))
      .map((it) => ({ it, s: score(it) })).filter((y) => y.s >= 0)
      .sort((a, b) => b.s - a.s || a.it.name.localeCompare(b.it.name)).map((y) => y.it);
  }, [mine, lib, q, cat, mus, like]);
  const choose = async (it) => {
    if (it.e) return onPick(it.e);
    setBusy(it.key);
    try { const e = await post('/exercises', toExercise(it.x)); onPick(e); } catch (err) { toast(err.message, 'err'); } finally { setBusy(null); }
  };
  return (<>
    <div className="search-row"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher : squat, poulie, étirement, burpee…" /></div>
    <div className="chips scroll mt-s">
      <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>Tout</button>
      {Object.entries(CATS).map(([k, l]) => <button key={k} className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(cat === k ? '' : k)}>{l}</button>)}
    </div>
    <select className="mt-s" value={mus} onChange={(e) => setMus(e.target.value)}><option value="">Tous les muscles</option>{Object.entries(MUSCLES_APP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    {!mine || !lib ? <Loading /> : (<>
      <p className="muted small mt-s">{list.length} exercice{list.length > 1 ? 's' : ''}</p>
      <ul className="pick-list lib">
        {list.slice(0, 50 * more).map((it, i) => {
          const src = thumb(it.x?.id || it.e?.lib_id);
          return (
            <li key={it.key}>
              <button className="pick-photo" onClick={() => (it.x ? setInfo(it.x) : choose(it))} aria-label={it.x ? 'Voir la démo' : 'Choisir'}>
                <ExThumb src={src} x={it.x || it.e || { n: it.name }} />
                {it.x?.img > 0 && <span className="pick-play"><Icon name="play" size={12} /></span>}
              </button>
              <button className="pick-main" onClick={() => choose(it)} disabled={busy === it.key}>
                <span className="grow"><b className="small">{it.name}</b><span className="muted small">{[it.sub, CATS[it.c]].filter(Boolean).join(' · ')}{it.mine ? ' · dans tes exercices' : ''}{like && i < 5 && !q ? ' · mêmes muscles' : ''}</span></span>
                <Icon name="plus" size={18} />
              </button>
            </li>
          );
        })}
        {!list.length && <li className="muted small">Aucun exercice trouvé.</li>}
      </ul>
      {list.length > 50 * more && <button className="btn block ghost mt-s" onClick={() => setMore(more + 1)}>Afficher plus</button>}
    </>)}
    <ExerciseInfo open={!!info} x={info} onClose={() => setInfo(null)}
      footer={info && <button className="btn primary" onClick={async () => { const it = list.find((y) => y.x === info); setInfo(null); if (it) await choose(it); }}>Choisir cet exercice</button>} />
  </>);
}

// Choix d'un exercice (séance), avec en tête ceux qui travaillent les mêmes muscles
export default function ExercisePicker({ open, onClose, title, like, onPick }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open && <ExerciseBrowser like={like} onPick={onPick} />}
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
