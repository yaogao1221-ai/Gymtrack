import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Segmented, Icon } from './ui.jsx';
import { ExerciseInfo } from './ExerciseDemo.jsx';
import { loadLib, thumb } from '../lib/exlib.js';
import { fmtDate, n1 } from '../lib/format.js';
import { AREAS } from '../data/rehab.js';

// Silhouettes de face et de dos (viewBox 100 × 200). Formes de gauche, la droite est dessinée en miroir.
const E = (cx, cy, rx, ry, rot = 0) => ({ e: [cx, cy, rx, ry, rot] });
const FRONT = {
  epaules_ant: [E(31, 38, 6.5, 5.5, -20)], epaules_lat: [E(25.5, 42, 3.4, 6.5, 10)], pectoraux: [{ d: 'M49 33 L37 33 Q31 37 33.5 47 Q41 52 49 49 Z' }],
  biceps: [E(26, 56, 4.3, 9, 8)], avant_bras: [E(22.5, 77, 3.8, 10.5, 10)], abdominaux: [{ d: 'M43.5 52 h13 a2 2 0 0 1 2 2 v27 q-8.5 6 -17 0 v-27 a2 2 0 0 1 2 -2 Z', c: 1 }, { d: 'M38 54 L42 54 L41.5 80 L37 75 Q35 64 38 54 Z' }],
  abducteurs: [E(34, 91, 3.6, 7, 10)], quadriceps: [E(39.5, 114, 6.8, 19, 4)], adducteurs: [E(46.5, 106, 2.8, 12, -4)], mollets: [E(39.5, 154, 4.6, 13, 2)],
};
const BACK = {
  trapezes: [{ d: 'M50 24 L39 33 Q44 37 50 47 Q56 37 61 33 Z', c: 1 }], epaules_post: [E(31, 38, 6.5, 5.5, 20)], epaules_lat: [E(25.5, 42, 3.4, 6.5, 10)],
  triceps: [E(26, 56, 4.3, 9, 8)], avant_bras: [E(22.5, 77, 3.8, 10.5, 10)], dos_largeur: [{ d: 'M37.5 43 Q33 56 41 72 L47.5 66 L47.5 49 Z' }],
  dos_epaisseur: [{ d: 'M44.5 40 h11 v17 q-5.5 4 -11 0 Z', c: 1 }], lombaires: [{ d: 'M44 66 h12 v15 q-6 3 -12 0 Z', c: 1 }],
  fessiers: [E(42, 96, 8, 8.5, 0)], ischios: [E(41, 120, 6.3, 16, 3)], mollets: [E(40.5, 152, 5.3, 12.5, 2)],
};
const BASE = [ // silhouette neutre
  { circle: [50, 13, 8.5] }, { d: 'M46 21 h8 v7 h-8 Z', c: 1 }, { d: 'M50 28 Q36 28 30 33 Q23 37 22 50 L18 88 Q17 94 20 95 L24 92 L29 62 L33 52 L35 84 Q33 100 34 128 L35 166 Q34 176 36 180 L44 180 L45 170 L47 132 L50 112 Z' },
];
const COLORS_LOAD = { 0: 'var(--map-0)', bas: 'var(--map-1)', correct: 'var(--map-2)', optimal: 'var(--map-3)', haut: 'var(--map-4)' };
const COLORS_REC = { fatigue: '#E5484D', recup: '#F5A524', pret: '#2BB56B', oublie: 'var(--map-0)' };
const REC_LABEL = { fatigue: 'Encore fatigué', recup: 'En récupération', pret: 'Prêt', oublie: 'Pas travaillé depuis 10 jours' };

function Shape({ s, fill, onClick, mirror, active }) {
  const props = { fill, onClick, className: `bm-m ${active ? 'on' : ''}`, transform: mirror ? 'translate(100 0) scale(-1 1)' : undefined };
  if (s.e) { const [cx, cy, rx, ry, rot] = s.e; return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...props} transform={`${props.transform || ''} rotate(${rot} ${cx} ${cy})`} />; }
  return <path d={s.d} {...props} />;
}

function Figure({ map, data, color, sel, onSel, label }) {
  return (
    <figure className="bm-fig">
      <svg viewBox="0 0 100 186" role="img" aria-label={label}>
        {BASE.map((b, i) => (b.circle ? <circle key={i} cx={b.circle[0]} cy={b.circle[1]} r={b.circle[2]} className="bm-base" />
          : <g key={i}><path d={b.d} className="bm-base" />{!b.c && <path d={b.d} className="bm-base" transform="translate(100 0) scale(-1 1)" />}</g>))}
        {Object.entries(map).map(([k, shapes]) => shapes.map((s, i) => (
          <g key={`${k}${i}`}>
            <Shape s={s} fill={color(data[k])} onClick={() => onSel(k)} active={sel === k} />
            {!s.c && <Shape s={s} fill={color(data[k])} onClick={() => onSel(k)} active={sel === k} mirror />}
          </g>
        )))}
      </svg>
      <figcaption className="muted xs">{label}</figcaption>
    </figure>
  );
}

// Les deux silhouettes seules (aperçu de l'accueil)
export function BodyFigures({ data, small }) {
  return (
    <div className={`bm-figs ${small ? 'small' : ''}`}>
      <Figure map={FRONT} data={data.muscles} color={(x) => (!x ? 'var(--map-0)' : COLORS_REC[x.status])} onSel={() => {}} label="Face" />
      <Figure map={BACK} data={data.muscles} color={(x) => (!x ? 'var(--map-0)' : COLORS_REC[x.status])} onSel={() => {}} label="Dos" />
    </div>
  );
}

// Carte du corps : séries de la semaine ou récupération, muscle sélectionné avec exercices et étirements illustrés
export default function BodyMap({ data }) {
  const [mode, setMode] = useState('rec'); const [sel, setSel] = useState(null); const [lib, setLib] = useState(null); const [info, setInfo] = useState(null);
  useEffect(() => { loadLib().then(setLib).catch(() => setLib([])); }, []);
  const m = data.muscles;
  const color = (x) => (!x ? 'var(--map-0)' : mode === 'rec' ? COLORS_REC[x.status] : x.sets <= 0 ? COLORS_LOAD[0] : COLORS_LOAD[x.zone]);
  const cur = sel ? m[sel] : null;
  const picks = useMemo(() => {
    if (!sel || !lib) return null;
    const strength = lib.filter((x) => x.c !== 'mobilite' && (x.m[sel] || 0) >= 1 && x.img).sort((a, b) => (a.l === 'b' ? -1 : 0) - (b.l === 'b' ? -1 : 0)).slice(0, 4);
    const stretch = lib.filter((x) => x.c === 'mobilite' && (x.t || []).includes(sel)).slice(0, 4);
    return { strength, stretch };
  }, [sel, lib]);
  const area = sel ? Object.entries(AREAS).find(([, a]) => a.muscles.includes(sel)) : null;
  return (
    <div className="bodymap">
      <Segmented value={mode} onChange={setMode} options={[['rec', 'Récupération'], ['load', 'Séries (7 j)']]} />
      <div className="bm-figs">
        <Figure map={FRONT} data={m} color={color} sel={sel} onSel={setSel} label="Face" />
        <Figure map={BACK} data={m} color={color} sel={sel} onSel={setSel} label="Dos" />
      </div>
      <div className="bm-legend small">
        {mode === 'rec' ? Object.entries(REC_LABEL).map(([k, l]) => <span key={k}><i style={{ background: COLORS_REC[k] }} />{l}</span>)
          : [['bas', 'Peu'], ['correct', 'Entretien'], ['optimal', 'Idéal'], ['haut', 'Beaucoup']].map(([k, l]) => <span key={k}><i style={{ background: COLORS_LOAD[k] }} />{l}</span>)}
      </div>
      {!cur ? <p className="muted small center">Touche un muscle pour voir sa charge, ses exercices et ses étirements.</p> : (
        <div className="bm-panel">
          <div className="row-between"><b>{cur.label}</b><span className="bm-pill" style={{ background: COLORS_REC[cur.status] }}>{REC_LABEL[cur.status]}</span></div>
          <p className="small">{n1(cur.sets)} série{cur.sets > 1 ? 's' : ''} sur 7 jours · {cur.last ? `dernière fois ${cur.days === 0 ? 'aujourd’hui' : cur.days === 1 ? 'hier' : `le ${fmtDate(cur.last, { day: 'numeric', month: 'short' })}`}` : 'pas travaillé récemment'}</p>
          {picks && (<>
            {picks.stretch.length > 0 && <><h4 className="h-sub">Étirements et mobilité</h4><Thumbs list={picks.stretch} onOpen={setInfo} /></>}
            <h4 className="h-sub">Exercices pour ce muscle</h4><Thumbs list={picks.strength} onOpen={setInfo} />
          </>)}
          {area && <Link className="btn sm ghost mt-s" to={`/soins?zone=${area[0]}`}><Icon name="heal" size={14} />Douleur {area[1].label.toLowerCase()} : que faire ?</Link>}
        </div>
      )}
      <ExerciseInfo open={!!info} x={info} onClose={() => setInfo(null)} />
    </div>
  );
}

export function Thumbs({ list, onOpen, doses }) {
  return (
    <ul className="thumbs">{list.map((x, i) => (
      <li key={x.id}><button onClick={() => onOpen(x)}>
        {thumb(x.id) ? <img src={thumb(x.id)} alt="" loading="lazy" onError={(ev) => { ev.currentTarget.style.visibility = 'hidden'; }} /> : <span className="pick-thumb empty"><Icon name="body" size={18} /></span>}
        <span className="small">{x.n}</span>{doses?.[i] && <span className="muted xs">{doses[i]}</span>}
      </button></li>
    ))}</ul>
  );
}
