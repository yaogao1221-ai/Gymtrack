import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Segmented, Icon } from './ui.jsx';
import { ExerciseInfo } from './ExerciseDemo.jsx';
import { loadLib, thumb } from '../lib/exlib.js';
import { post } from '../lib/api.js';
import { fmtDate, n1 } from '../lib/format.js';
import { AREAS } from '../data/rehab.js';

// Silhouettes vectorielles de face et de dos (viewBox 100 × 186). Muscles du côté gauche, la droite est dessinée en miroir ; c = au centre.
const P = (d, c) => ({ d, c });
const DELT_LAT = P('M25.2 37.5 C23.6 41 23.2 45 23.6 48.6 C25.3 47.2 26.6 44.6 26.9 41.4 C26.8 39.8 26.2 38.4 25.2 37.5 Z');
const FOREARM = P('M20.6 69.5 C19 77 18.2 85 18.3 92 L21.6 93 C23.4 85.5 25.4 78.5 26.6 71.5 C25.2 68.6 22.4 68 20.6 69.5 Z');
const UPPER_ARM = P('M24.9 47.8 C23.4 53 23.3 59.5 24.7 65.4 C26 67.6 28 67.3 28.7 64.2 C29.8 59 30.2 53.4 29.7 48.6 C28.2 46.6 26.2 46.5 24.9 47.8 Z');
const FRONT = {
  pectoraux: [P('M49.6 33.6 C44 32.8 37.6 33.4 34.2 36.8 C32.4 40.6 33 45.4 35.6 47.8 C40 50.2 45.6 49.8 49.6 47.2 Z')],
  epaules_ant: [P('M35.6 31.2 C30.4 31.6 26.4 34.6 25.6 39.6 C26.4 42.8 28.8 44.6 31.6 44.2 C32 40 33.6 36.4 36.4 33.2 Z')],
  epaules_lat: [DELT_LAT], biceps: [UPPER_ARM], avant_bras: [FOREARM],
  abdominaux: [P('M44.2 51 H55.8 C57 51 57.8 51.8 57.8 53 V77 C57.8 82 54 86.6 50 88.6 C46 86.6 42.2 82 42.2 77 V53 C42.2 51.8 43 51 44.2 51 Z', 1),
    P('M41 53.4 C37.8 56.6 36.4 62.6 36.9 69.6 C37.3 75.6 39.2 80 41 82.2 Z')],
  abducteurs: [P('M34.6 87.6 C33.5 93.5 33.9 99.5 35 103.8 C36.6 100 37.6 95 37.6 90 Z')],
  quadriceps: [P('M37.2 95.6 C35 106 35.4 120 37.6 132 C39.6 135.2 42.2 135.2 44.2 133 C45.6 124 46.4 112 45.6 104 C42.2 100 39.6 97 37.2 95.6 Z')],
  adducteurs: [P('M46.2 100.4 C45.2 106 45.6 114 46.6 120 C47.9 114 48.8 106.4 49.1 101.2 Z')],
  mollets: [P('M37.4 144 C36.4 151 36.9 159.6 38.4 166.6 L41 166.8 C41.5 159.8 41.4 151 40.4 144.8 Z'), P('M42.6 145.2 C42.1 152 42.5 159.6 43.6 165.8 C44.6 160 45.1 152.2 44.6 146 Z')],
};
const BACK = {
  trapezes: [P('M50 22 C47 25.5 42 28.4 36.6 31 C41 32.6 45.6 35.6 50 41 C54.4 35.6 59 32.6 63.4 31 C58 28.4 53 25.5 50 22 Z', 1)],
  epaules_post: [P('M36 31.4 C30.6 31.8 26.2 34.8 25.6 39.8 C27 42.8 30 44 33 42.2 C33.6 38.2 35 34.4 37.6 32.6 Z')],
  epaules_lat: [DELT_LAT], triceps: [UPPER_ARM], avant_bras: [FOREARM],
  dos_epaisseur: [P('M42.6 35.2 C46 37.6 48.6 40.2 50 43.2 C51.4 40.2 54 37.6 57.4 35.2 C58 43 57 51 55 57 C52 59 48 59 45 57 C43 51 42 43 42.6 35.2 Z', 1)],
  dos_largeur: [P('M34.2 40.2 C32.6 50 33.6 62 38.6 72 C42 70.2 45.4 66 46.8 60.4 L44.4 57.6 C42.6 51 41.8 44.4 41.6 38.4 C39 38.4 36.4 39 34.2 40.2 Z')],
  lombaires: [P('M45 62.6 H55 C56.6 68.4 56.6 74.4 55 79.8 C51.6 81.8 48.4 81.8 45 79.8 C43.4 74.4 43.4 68.4 45 62.6 Z', 1)],
  fessiers: [P('M49.6 85.6 C44 84.8 37.6 86.8 35 92 C33.4 98 35 104 39 107 C43 108.6 47 107.6 49.6 105 Z')],
  ischios: [P('M36.6 110 C35.6 118 36 127 38 134 C40.6 136.2 43.6 136.2 45.6 133 C46.6 125 47 117 46.6 109 C43 108 39.6 108.4 36.6 110 Z')],
  mollets: [P('M37 143 C35.4 149 36 157 38.6 163 C40 164.6 41.6 164 42 162 V145 C40.6 143 38.6 142.4 37 143 Z'), P('M42.6 145 V162 C43.6 164 45 163.6 45.6 161 C46.6 155 46 149 44.6 144.6 C43.8 144 43 144.2 42.6 145 Z')],
};
// Silhouette : tête, cou, tronc, bras, mains, jambes, pieds (moitié gauche, l'autre en miroir)
const BODY = 'M50 24.6 H45.6 C44 27.8 40 29.4 35 30.4 C29 31.6 25.4 34 24.4 39 C23.4 44 23 48 22.5 53 C21.5 60 20 66 19 72 C17.6 80 16.6 88 16.5 94 C16 97 15.5 101 17 104 C18.5 106 20.5 104 21 101 C21.5 98 21.6 96 22 94 C23.6 86 26 78 27 71 C28 64 29 58 30 54 L31 50 C32 58 32.6 66 33 74 C33.6 80 32.6 86 33.6 92 C34 100 34.6 110 35.6 122 C36 130 36 136 36.6 142 C35.6 150 35.6 160 37 170 C37 174 35 178 36.6 180 H45 C45.6 176 44.6 172 44.6 169 C45 160 46 150 45 142 C45.6 136 46.6 130 47 122 C47.6 112 48.6 104 50 100 Z';
const COLORS_LOAD = { 0: 'var(--map-0)', bas: 'var(--map-1)', correct: 'var(--map-2)', optimal: 'var(--map-3)', haut: 'var(--map-4)' };
const COLORS_REC = { fatigue: '#E5484D', recup: '#F5A524', pret: '#2BB56B', oublie: 'var(--map-0)' };
const REC_LABEL = { fatigue: 'Encore fatigué', recup: 'En récupération', pret: 'Prêt', oublie: 'Pas travaillé depuis 10 jours' };

const MIRROR = 'translate(100 0) scale(-1 1)';
function Shape({ s, fill, onClick, mirror, active }) {
  return <path d={s.d} fill={fill} onClick={onClick} className={`bm-m ${active ? 'on' : ''}`} transform={mirror ? MIRROR : undefined} />;
}

function Figure({ map, data, color, sel, onSel, label }) {
  return (
    <figure className="bm-fig">
      <svg viewBox="8 0 84 186" role="img" aria-label={label}>
        <g className="bm-body">
          <ellipse cx="50" cy="12.4" rx="7.4" ry="9" className="bm-base edge" />
          <path d={BODY} className="bm-base edge" /><path d={BODY} className="bm-base edge" transform={MIRROR} />
          <ellipse cx="50" cy="12.4" rx="7.4" ry="9" className="bm-base fillonly" />
          <path d={BODY} className="bm-base fillonly" /><path d={BODY} className="bm-base fillonly" transform={MIRROR} />
          <rect x="45.4" y="18" width="9.2" height="9" className="bm-base fillonly" /><rect x="48" y="24" width="4" height="76" className="bm-base fillonly" />
        </g>
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
      <Figure map={BACK} back data={data.muscles} color={(x) => (!x ? 'var(--map-0)' : COLORS_REC[x.status])} onSel={() => {}} label="Dos" />
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
        <Figure map={BACK} back data={m} color={color} sel={sel} onSel={setSel} label="Dos" />
      </div>
      <div className="bm-legend small">
        {mode === 'rec' ? Object.entries(REC_LABEL).map(([k, l]) => <span key={k}><i style={{ background: COLORS_REC[k] }} />{l}</span>)
          : [['bas', 'Peu'], ['correct', 'Entretien'], ['optimal', 'Idéal'], ['haut', 'Beaucoup']].map(([k, l]) => <span key={k}><i style={{ background: COLORS_LOAD[k] }} />{l}</span>)}
      </div>
      {!cur ? <p className="muted small center">Touche un muscle pour voir sa charge, ses exercices et ses étirements.</p> : (
        <div className="bm-panel">
          <div className="row-between"><b>{cur.label}</b><span className="bm-pill" style={{ background: COLORS_REC[cur.status] }}>{REC_LABEL[cur.status]}</span></div>
          <button className={`btn sm ${cur.sore ? 'primary' : ''} mt-s`} onClick={() => post('/soreness', { muscle: sel, on: !cur.sore }).catch(() => {})}>{cur.sore ? 'Courbatures signalées (toucher pour retirer)' : 'J’ai des courbatures ici'}</button>
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
