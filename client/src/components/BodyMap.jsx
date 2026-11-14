import { ExThumb } from './MoveFigure.jsx';
import { BalanceRow } from './Balance.jsx';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Segmented, Icon } from './ui.jsx';
import { ExerciseInfo } from './ExerciseDemo.jsx';
import { loadLib, thumb } from '../lib/exlib.js';
import { post, get } from '../lib/api.js';
import { fmtDate, n1 } from '../lib/format.js';
import { AREAS } from '../data/rehab.js';
import { MuscleStats, JointPanel, VOL_COLORS, VOL_LABEL, PROG_COLORS, PROG_LABEL, JOINT_COLORS, JOINT_LABEL } from './MuscleBrain.jsx';

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

// Articulations (mode Articulations) : x, y dans le repère de la silhouette ; c = au centre (pas de miroir)
const JOINT_POS = {
  front: [['epaule', 27.5, 35], ['coude', 25, 67], ['poignet', 19.6, 93], ['pectoral', 41, 41], ['hanche', 36.5, 92], ['genou', 40.5, 138], ['cheville', 41, 170]],
  back: [['nuque', 50, 25, 1], ['epaule', 27.5, 35], ['coude', 25, 67], ['bas_du_dos', 50, 74, 1], ['hanche', 37, 96], ['genou', 40.5, 138], ['cheville', 41, 170]],
};
function Figure({ map, data, color, sel, onSel, label, joints, side, selJ, onJoint }) {
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
        {joints && JOINT_POS[side].map(([k, x, y, c]) => joints[k] && [x, ...(c ? [] : [100 - x])].map((xx) => (
          <circle key={`${k}${xx}`} cx={xx} cy={y} r={selJ === k ? 4.6 : 3.6} className={`bm-joint ${selJ === k ? 'on' : ''}`} style={{ fill: JOINT_COLORS[joints[k].status] }} onClick={() => onJoint(k)} />)))}
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

// Muscles travaillés par un exercice : principal en plein, secondaire en clair
export function MuscleFigures({ muscles }) {
  const c = (k) => { const v = muscles?.[k] || 0; return v >= 1 ? 'var(--accent)' : v > 0 ? 'var(--accent-line)' : 'var(--map-0)'; };
  const data = Object.fromEntries(Object.keys(MUSCLES_KEYS).map((k) => [k, { k }]));
  return (
    <div className="bm-figs ex-figs">
      <Figure map={FRONT} data={data} color={(x) => c(x?.k)} onSel={() => {}} label="Face" />
      <Figure map={BACK} back data={data} color={(x) => c(x?.k)} onSel={() => {}} label="Dos" />
    </div>
  );
}
const MUSCLES_KEYS = { ...Object.fromEntries(Object.keys({ ...FRONT, ...BACK }).map((k) => [k, 1])) };

// Carte du corps : séries de la semaine ou récupération, muscle sélectionné avec exercices et étirements illustrés
export default function BodyMap({ data, balance, state, onChange }) {
  const [mode, setMode] = useState('rec'); const [selJ, setSelJ] = useState(null); const [sel, setSel] = useState(null); const [lib, setLib] = useState(null); const [info, setInfo] = useState(null);
  const [prog, setProg] = useState(null); const [role, setRole] = useState('main'); const [all, setAll] = useState(false); const [eq, setEq] = useState(''); const [more, setMore] = useState(false);
  useEffect(() => { loadLib().then(setLib).catch(() => setLib([])); get('/program').then(setProg).catch(() => setProg({ days: [] })); }, []);
  useEffect(() => { setAll(false); setEq(''); }, [sel, role]);
  const m = useMemo(() => Object.fromEntries(Object.entries(data.muscles).map(([k, v]) => [k, { ...v, key: k }])), [data.muscles]);
  // Mode Équilibre : muscle en retard (orange), équilibré (vert), sans données (gris)
  const balOf = (k) => { const l = balance?.by_muscle?.[k]; if (!l) return null; if (l.some((x) => x.weak === k || (x.weak === 'Dos' && k.startsWith('dos')))) return 'weak'; if (l.some((x) => x.verdict === 'ok')) return 'ok'; return 'none'; };
  const COLORS_BAL = { weak: 'var(--orange)', ok: 'var(--green)', none: 'var(--map-0)' };
  const S = state?.muscles;
  const color = (x) => {
    if (!x) return 'var(--map-0)';
    if (mode === 'joint') return 'var(--map-0)';
    if (mode === 'bal') return COLORS_BAL[balOf(x.key)] || 'var(--map-0)';
    if (mode === 'rec') return COLORS_REC[x.status];
    if (mode === 'vol') return S ? VOL_COLORS[S[x.key]?.volume.verdict] || 'var(--map-0)' : x.sets <= 0 ? COLORS_LOAD[0] : COLORS_LOAD[x.zone];
    if (mode === 'prog') return PROG_COLORS[S?.[x.key]?.progression.verdict] || 'var(--map-0)';
    return 'var(--map-0)';
  };
  const cur = sel ? m[sel] : null; const brainCur = sel && S ? S[sel] : null;
  const pickMuscle = (k) => { setSel(k); setSelJ(null); }; const pickJoint = (k) => { setSelJ(k); setSel(null); };
  const modes = S ? [['rec', 'Récup.'], ['vol', 'Volume'], ['prog', 'Force'], ['bal', 'Équilibre'], ['joint', 'Articul.']]
    : [['rec', 'Récupération'], ['vol', 'Séries (7 j)'], ...(balance ? [['bal', 'Équilibre']] : [])];
  const picks = useMemo(() => {
    if (!sel || !lib) return null;
    const strength = lib.filter((x) => x.c !== 'mobilite' && (x.m[sel] || 0) >= 1 && x.img).sort((a, b) => (a.l === 'b' ? -1 : 0) - (b.l === 'b' ? -1 : 0)).slice(0, 4);
    const stretch = lib.filter((x) => x.c === 'mobilite' && (x.t || []).includes(sel)).slice(0, 4);
    // Tous les exercices de la bibliothèque qui travaillent ce muscle : en principal (coefficient 1) ou en secondaire
    const work = lib.filter((x) => x.c !== 'mobilite' && x.c !== 'cardio' && (x.m[sel] || 0) > 0);
    const byImg = (a, b) => (b.img ? 1 : 0) - (a.img ? 1 : 0) || (a.l === 'b' ? -1 : 0) - (b.l === 'b' ? -1 : 0);
    const main = work.filter((x) => x.m[sel] >= 1).sort(byImg); const second = work.filter((x) => x.m[sel] < 1).sort(byImg);
    return { strength, stretch, main, second };
  }, [sel, lib]);
  // Exercices de TON programme qui travaillent ce muscle
  const mine = useMemo(() => {
    if (!sel || !prog) return [];
    return prog.days.flatMap((d) => d.exercises.filter((e) => (e.muscles?.[sel] || 0) > 0).map((e) => ({ ...e, day: d.name, role: e.muscles[sel] >= 1 ? 'Principal' : 'Secondaire' })))
      .sort((a, b) => (b.muscles[sel] || 0) - (a.muscles[sel] || 0));
  }, [sel, prog]);
  // Les 3 meilleurs choix : exercices principaux hors programme, avec le matériel que tu utilises déjà, une photo, niveau accessible
  const best = useMemo(() => {
    if (!picks || !lib) return [];
    const inProg = new Set(mine.map((e) => e.lib_id));
    const myEq = new Set((prog?.days || []).flatMap((d) => d.exercises).map((e) => lib.find((l) => l.id === e.lib_id)?.q).filter(Boolean));
    const score = (x) => (myEq.has(x.q) ? 4 : 0) + (x.img ? 2 : 0) + (x.l === 'b' ? 1 : x.l === 'i' ? 0.5 : 0);
    return picks.main.filter((x) => !inProg.has(x.id)).map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s).slice(0, 3).map((o) => o.x);
  }, [picks, lib, mine, prog]);
  const area = sel ? Object.entries(AREAS).find(([, a]) => a.muscles.includes(sel)) : null;
  return (
    <div className="bodymap">
      <Segmented value={mode} onChange={(v) => { setMode(v); if (v === 'joint') setSel(null); else setSelJ(null); }} options={modes} />
      {mode === 'bal' && state?.global && <div className="bm-score"><b>{state.global.value}</b><span className="small"><b>{state.global.label}</b>{state.global.causes[0] ? <><br /><span className="muted xs">{state.global.causes[0]}</span></> : <><br /><span className="muted xs">Aucun écart marqué entre muscles opposés.</span></>}</span></div>}
      <div className="bm-figs">
        <Figure map={FRONT} side="front" data={m} color={color} sel={sel} onSel={mode === 'joint' ? () => {} : pickMuscle} label="Face" joints={mode === 'joint' ? state?.joints : null} selJ={selJ} onJoint={pickJoint} />
        <Figure map={BACK} side="back" back data={m} color={color} sel={sel} onSel={mode === 'joint' ? () => {} : pickMuscle} label="Dos" joints={mode === 'joint' ? state?.joints : null} selJ={selJ} onJoint={pickJoint} />
      </div>
      <div className="bm-legend small">
        {mode === 'joint' ? Object.entries(JOINT_LABEL).map(([k, l]) => <span key={k}><i style={{ background: JOINT_COLORS[k] }} />{l}</span>)
          : mode === 'prog' ? Object.entries(PROG_LABEL).map(([k, l]) => <span key={k}><i style={{ background: PROG_COLORS[k] }} />{l}</span>)
          : mode === 'vol' && S ? Object.entries(VOL_LABEL).map(([k, l]) => <span key={k}><i style={{ background: VOL_COLORS[k] }} />{l}</span>)
          : mode === 'bal' ? [['weak', 'En retard'], ['ok', 'Équilibré'], ['none', 'Pas de données']].map(([k, l]) => <span key={k}><i style={{ background: COLORS_BAL[k] }} />{l}</span>)
          : mode === 'rec' ? Object.entries(REC_LABEL).map(([k, l]) => <span key={k}><i style={{ background: COLORS_REC[k] }} />{l}</span>)
          : [['bas', 'Peu'], ['correct', 'Entretien'], ['optimal', 'Idéal'], ['haut', 'Beaucoup']].map(([k, l]) => <span key={k}><i style={{ background: COLORS_LOAD[k] }} />{l}</span>)}
      </div>
      {mode === 'joint' && !selJ && <p className="muted small center">Touche une articulation pour voir sa charge, ta mobilité et les exercices de soin.</p>}
      {selJ && state?.joints?.[selJ] && <JointPanel j={state.joints[selJ]} onOpen={setInfo} onChange={onChange} />}
      {mode === 'joint' ? null : !cur ? <p className="muted small center">Touche un muscle pour voir son volume, sa force, ce qui lui manque et ses exercices.</p> : (
        <div className="bm-panel">
          <div className="row-between"><b>{cur.label}</b><span className="bm-pill" style={{ background: COLORS_REC[cur.status] }}>{REC_LABEL[cur.status]}</span></div>
          {brainCur && <MuscleStats m={brainCur} state={state} onChange={onChange} />}
          <button className={`btn sm ${cur.sore ? 'primary' : ''} mt-s`} onClick={() => post('/soreness', { muscle: sel, on: !cur.sore }).catch(() => {})}>{cur.sore ? 'Courbatures signalées (toucher pour retirer)' : 'J’ai des courbatures ici'}</button>
          {balance?.by_muscle?.[sel]?.length > 0 && <><h4 className="h-sub">Équilibre avec le muscle opposé</h4><ul className="bal-list">{balance.by_muscle[sel].map((x, i) => <BalanceRow key={i} x={x} compact={x.kind === 'volume'} />)}</ul></>}
          {!brainCur && <p className="small">{n1(cur.sets)} série{cur.sets > 1 ? 's' : ''} sur 7 jours · {cur.last ? `dernière fois ${cur.days === 0 ? 'aujourd’hui' : cur.days === 1 ? 'hier' : `le ${fmtDate(cur.last, { day: 'numeric', month: 'short' })}`}` : 'pas travaillé récemment'}</p>}
          {picks && (<>
            {picks.stretch.length > 0 && <><h4 className="h-sub">Étirements et mobilité</h4><Thumbs list={picks.stretch} onOpen={setInfo} /></>}
            <h4 className="h-sub">Dans ton programme</h4>
            {mine.length ? <ul className="bm-mine">{mine.map((e) => (
              <li key={e.id}><button onClick={() => { const x = lib.find((l) => l.id === e.lib_id); if (x) setInfo(x); }}>
                <ExThumb src={thumb(e.lib_id)} x={lib.find((l) => l.id === e.lib_id) || e} />
                <span className="grow"><b>{e.name}</b><span className="muted small">{e.day} · {e.sets} × {e.reps ?? '?'}</span></span>
                <span className={`tag ${e.role === 'Principal' ? 'good' : ''}`}>{e.role}</span></button></li>))}</ul>
              : <p className="muted small">Aucun exercice de ton programme ne travaille ce muscle.</p>}
            {best.length > 0 && <><h4 className="h-sub">Les 3 meilleurs choix pour toi</h4>
              <p className="muted xs">Ciblent ce muscle en principal, avec le matériel que tu utilises déjà quand c’est possible.</p>
              <Thumbs list={best} onOpen={setInfo} /></>}
            <button className="btn sm block mt-s" onClick={() => setMore(!more)}>{more ? 'Masquer la liste complète' : `Voir tous les exercices (${picks.main.length + picks.second.length})`}</button>
            {more && <><h4 className="h-sub">Tous les exercices qui le travaillent</h4>
            <Segmented value={role} onChange={setRole} options={[['main', `Principal (${picks.main.length})`], ['second', `Secondaire (${picks.second.length})`]]} />
            {(() => {
              const src = role === 'main' ? picks.main : picks.second;
              const eqs = [...new Set(src.map((x) => x.q).filter(Boolean))].slice(0, 8);
              const list = eq ? src.filter((x) => x.q === eq) : src;
              return (<>
                {eqs.length > 1 && <div className="chips scroll mt-s"><button className={`chip ${!eq ? 'on' : ''}`} onClick={() => setEq('')}>Tout</button>{eqs.map((q) => <button key={q} className={`chip ${eq === q ? 'on' : ''}`} onClick={() => setEq(q)}>{q}</button>)}</div>}
                <p className="muted xs mt-s">{role === 'main' ? 'Ce muscle fait l’essentiel du travail.' : 'Ce muscle aide, sans être la cible principale.'} Touche un exercice pour la démo et tous les muscles qu’il travaille.</p>
                <Thumbs list={all ? list : list.slice(0, 9)} onOpen={setInfo} />
                {list.length > 9 && <button className="btn sm block mt-s" onClick={() => setAll(!all)}>{all ? 'Réduire' : `Voir les ${list.length} exercices`}</button>}
              </>);
            })()}</>}
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
        <ExThumb src={thumb(x.id)} x={x} />
        <span className="small">{x.n}</span>{doses?.[i] && <span className="muted xs">{doses[i]}</span>}
      </button></li>
    ))}</ul>
  );
}
