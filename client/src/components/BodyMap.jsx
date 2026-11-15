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
import { FRONT as AFRONT, BACK as ABACK, TENDONS, SKIN } from './anatomy.js';
import { loadMorpho } from '../lib/morpho.js';
import { rateExercise } from '../../../server/morpho.js';
import { MuscleStats, JointPanel, VOL_COLORS, VOL_LABEL, PROG_COLORS, PROG_LABEL, JOINT_COLORS, JOINT_LABEL } from './MuscleBrain.jsx';

// Planche d'anatomie vectorielle (dessin original) : muscles détaillés avec fibres, tendons et peau, voir anatomy.js
const FRONT = AFRONT; const BACK = ABACK;
const ANGLES = [...new Set([...AFRONT, ...ABACK].map((m) => m.a))];
const fid = (a) => `bmf${String(a).replace('-', 'm')}`;
const COLORS_LOAD = { 0: 'var(--map-0)', bas: 'var(--map-1)', correct: 'var(--map-2)', optimal: 'var(--map-3)', haut: 'var(--map-4)' };
const COLORS_REC = { fatigue: '#E5484D', recup: '#F5A524', pret: '#2BB56B', oublie: 'var(--map-0)' };
const REC_LABEL = { fatigue: 'Encore fatigué', recup: 'En récupération', pret: 'Prêt', oublie: 'Pas travaillé depuis 10 jours' };

const MIRROR = 'translate(100 0) scale(-1 1)';
// Une pièce dessinée sur la moitié gauche et en miroir (sauf pièce centrale)
function Both({ s, ...props }) {
  return <>{<path d={s.d} {...props} />}{!s.c && <path d={s.d} {...props} transform={MIRROR} />}</>;
}

// Articulations (mode Articulations) : x, y dans le repère de la silhouette ; c = au centre (pas de miroir)
const JOINT_POS = {
  front: [['epaule', 27.5, 35], ['coude', 25, 67], ['poignet', 19.6, 93], ['pectoral', 41, 41], ['hanche', 36.5, 92], ['genou', 40.5, 138], ['cheville', 41, 170]],
  back: [['nuque', 50, 25, 1], ['epaule', 27.5, 35], ['coude', 25, 67], ['bas_du_dos', 50, 74, 1], ['hanche', 37, 96], ['genou', 40.5, 138], ['cheville', 41, 170]],
};
function Figure({ map, data, color, sel, onSel, label, joints, side: sd, back, selJ, onJoint }) {
  const side = sd || (back ? 'back' : 'front');
  return (
    <figure className="bm-fig">
      <svg viewBox="12 0 76 186" role="img" aria-label={label}>
        <defs>
          {ANGLES.map((a) => <pattern key={a} id={fid(a)} width="1.1" height="1.1" patternUnits="userSpaceOnUse" patternTransform={`rotate(${a})`}><line x1="0" y1="0" x2="0" y2="1.1" className="bm-fib" /></pattern>)}
          {ANGLES.map((a) => (
            <linearGradient key={a} id={`${fid(a)}g`} gradientTransform={`rotate(${a + 90} .5 .5)`}>
              <stop offset="0" stopColor="var(--bm-tendon)" stopOpacity=".55" /><stop offset=".16" stopColor="var(--bm-tendon)" stopOpacity="0" />
              <stop offset=".5" stopColor="#fff" stopOpacity=".16" />
              <stop offset=".84" stopColor="var(--bm-tendon)" stopOpacity="0" /><stop offset="1" stopColor="var(--bm-tendon)" stopOpacity=".55" />
            </linearGradient>
          ))}
          <radialGradient id="bmsh" cx=".42" cy=".38" r=".72"><stop offset="0" stopColor="#fff" stopOpacity=".22" /><stop offset=".55" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" /></radialGradient>
        </defs>
        {/* Contour du corps : union de toutes les pièces, épaissie (le trait extérieur dessine la silhouette) */}
        <g className="bm-ol">{[...SKIN[side].under, ...map, ...SKIN[side].over].map((t, i) => <Both key={i} s={t} />)}</g>
        <g className="bm-fascia">{[...SKIN[side].under, ...map, ...SKIN[side].over].map((t, i) => <Both key={i} s={t} />)}</g>
        {map.map((m, i) => {
          const on = m.k && sel === m.k; const pick = m.k ? () => onSel(m.k) : undefined;
          const c = m.k ? color(data[m.k]) : null;
          return (
            <g key={i} className={`bm-g ${m.k ? 'tap' : 'deco'} ${on ? 'on' : ''}`} onClick={pick}>
              <Both s={m} className="bm-m" style={{ fill: c && c !== 'var(--map-0)' ? c : undefined }} />
              <Both s={m} className="bm-tex" fill={`url(#${fid(m.a)})`} />
              <Both s={m} className="bm-tex" fill={`url(#${fid(m.a)}g)`} />
              <Both s={m} className="bm-tex" fill="url(#bmsh)" />
            </g>
          );
        })}
        {TENDONS[side].map((t, i) => <Both key={`t${i}`} s={t} className="bm-tendon" />)}
        {SKIN[side].over.map((t, i) => <Both key={`o${i}`} s={t} className="bm-skin" />)}
        {sel && map.filter((m) => m.k === sel).map((m, i) => <Both key={`s${i}`} s={m} className="bm-sel" />)}
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
const MUSCLES_KEYS = Object.fromEntries([...FRONT, ...BACK].filter((m) => m.k).map((m) => [m.k, 1]));

// Carte du corps : séries de la semaine ou récupération, muscle sélectionné avec exercices et étirements illustrés
export default function BodyMap({ data, balance, state, onChange }) {
  const [mode, setMode] = useState('rec'); const [selJ, setSelJ] = useState(null); const [sel, setSel] = useState(null); const [lib, setLib] = useState(null); const [info, setInfo] = useState(null);
  const [prog, setProg] = useState(null); const [role, setRole] = useState('main'); const [all, setAll] = useState(false); const [eq, setEq] = useState(''); const [more, setMore] = useState(false);
  const [mo, setMo] = useState(null);
  useEffect(() => { loadLib().then(setLib).catch(() => setLib([])); get('/program').then(setProg).catch(() => setProg({ days: [] })); loadMorpho().then(setMo); }, []);
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
    // Morphologie : les exercices adaptés à tes leviers passent devant, les conflits articulaires sont écartés
    const fit = (x) => (mo ? rateExercise(x, mo.morpho, mo.pains) : { score: 0, verdict: 'neutre' });
    const score = (x) => (myEq.has(x.q) ? 4 : 0) + (x.img ? 2 : 0) + (x.l === 'b' ? 1 : x.l === 'i' ? 0.5 : 0) + fit(x).score * 3;
    return picks.main.filter((x) => !inProg.has(x.id) && fit(x).verdict !== 'conflit').map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s).slice(0, 3).map((o) => o.x);
  }, [picks, lib, mine, prog, mo]);
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
