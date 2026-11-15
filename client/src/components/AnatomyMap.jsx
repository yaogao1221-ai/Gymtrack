import { useMemo, useState } from 'react';
import { Icon } from './ui.jsx';
import { FRONT, BACK, SIDE, TENDONS, SKIN, FRAMES } from './anatomy.js';
import { MUSCLE_BY_ID, PAIN_FINE } from '../../../server/body/muscles.js';

// Planche anatomique 2D vectorielle (SVG, dessin original) : face, dos, profil droit, profil gauche, avec cadrages de zoom.
// Chaque muscle fin se touche séparément, côté gauche ou droit compris.
const ANGLES = [...new Set([...FRONT, ...BACK, ...SIDE].map((m) => m.a))];
const fid = (a) => `af${String(a).replace('-', 'm')}`;
const MIRROR = 'translate(100 0) scale(-1 1)';
export const VIEWS = [['fb', 'Face et dos'], ['front', 'Face'], ['back', 'Dos'], ['left', 'Profil gauche'], ['right', 'Profil droit']];
export const ZOOMS = [['all', 'Corps entier'], ['haut', 'Haut du corps'], ['tronc', 'Tronc'], ['jambes', 'Jambes']];
const VIEW_LABEL = { front: 'Face', back: 'Dos', left: 'Profil gauche', right: 'Profil droit' };

// Côté du corps de la pièce dessinée : sur la face, la moitié gauche de l'image est le côté droit de la personne
const sideOf = (view, mirrored) => (view === 'front' ? (mirrored ? 'gauche' : 'droite') : view === 'back' ? (mirrored ? 'droite' : 'gauche') : view === 'left' ? 'gauche' : 'droite');

export function AtlasDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {ANGLES.map((a) => <pattern key={a} id={fid(a)} width="1.1" height="1.1" patternUnits="userSpaceOnUse" patternTransform={`rotate(${a})`}><line x1="0" y1="0" x2="0" y2="1.1" className="bm-fib" /></pattern>)}
        {ANGLES.map((a) => (
          <linearGradient key={a} id={`${fid(a)}g`} gradientTransform={`rotate(${a + 90} .5 .5)`}>
            <stop offset="0" stopColor="var(--bm-tendon)" stopOpacity=".55" /><stop offset=".16" stopColor="var(--bm-tendon)" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".16" />
            <stop offset=".84" stopColor="var(--bm-tendon)" stopOpacity="0" /><stop offset="1" stopColor="var(--bm-tendon)" stopOpacity=".55" />
          </linearGradient>
        ))}
        <radialGradient id="afsh" cx=".42" cy=".38" r=".72"><stop offset="0" stopColor="#fff" stopOpacity=".22" /><stop offset=".55" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" /></radialGradient>
      </defs>
    </svg>
  );
}

// Une silhouette : view = front | back | left | right ; colorOf(id, côté) → couleur ou null (couleur naturelle du muscle)
export function AtlasFigure({ view, zoom = 'all', colorOf, sel, onPick, label, children }) {
  const side = view === 'left' || view === 'right';
  const map = view === 'front' ? FRONT : view === 'back' ? BACK : SIDE;
  const art = view === 'front' ? 'front' : view === 'back' ? 'back' : 'side';
  const fr = FRAMES[zoom]?.[side ? 'side' : 'front'] || FRAMES.all.front;
  const box = view === 'left' ? [100 - fr[0] - fr[2], fr[1], fr[2], fr[3]] : fr;
  const skin = SKIN[art];
  // Pièce dessinée une fois (centrale ou profil) ou deux fois (moitié gauche + miroir)
  const pieces = (s, render) => (s.c ? [render(false, undefined)] : [render(false, undefined), render(true, MIRROR)]);
  const body = (
    <>
      <g className="bm-ol">{[...skin.under, ...map, ...skin.over].map((t, i) => pieces(t, (m, tr) => <path key={`${i}${m}`} d={t.d} transform={tr} />))}</g>
      <g className="bm-fascia">{[...skin.under, ...map, ...skin.over].map((t, i) => pieces(t, (m, tr) => <path key={`${i}${m}`} d={t.d} transform={tr} />))}</g>
      {[...map.filter((m) => !m.arm), ...(side ? [{ armLine: true }] : []), ...map.filter((m) => m.arm)].map((m, i) => (m.armLine
        ? <g key="armline" className="at-armline">{map.filter((a) => a.arm).map((a, j) => <path key={j} d={a.d} />)}</g>
        : pieces(m, (mir, tr) => {
        const sd = m.c && !side ? 'centre' : sideOf(view, mir);
        const c = m.id ? colorOf(m.id, sd) : null; const on = m.id && sel?.id === m.id && (!sel.side || sel.side === sd || sd === 'centre');
        return (
          <g key={`${i}${mir}`} className={`bm-g ${m.id ? 'tap' : 'deco'} ${on ? 'on' : ''}`} transform={tr} onClick={m.id ? () => onPick(m.id, sd) : undefined}>
            <path d={m.d} className="bm-m" style={{ fill: c || undefined }} />
            <path d={m.d} className="bm-tex" fill={`url(#${fid(m.a)})`} />
            <path d={m.d} className="bm-tex" fill={`url(#${fid(m.a)}g)`} />
            <path d={m.d} className="bm-tex" fill="url(#afsh)" />
          </g>
        );
      })))}
      {TENDONS[art].map((t, i) => pieces(t, (m, tr) => <path key={`t${i}${m}`} d={t.d} transform={tr} className="bm-tendon" />))}
      {skin.over.map((t, i) => pieces(t, (m, tr) => <path key={`o${i}${m}`} d={t.d} transform={tr} className="bm-skin" />))}
      {sel && map.map((m, i) => m.id === sel.id && pieces(m, (mir, tr) => {
        const sd = m.c && !side ? 'centre' : sideOf(view, mir);
        return (!sel.side || sel.side === sd || sd === 'centre') ? <path key={`s${i}${mir}`} d={m.d} transform={tr} className="bm-sel" /> : null;
      }))}
      {children}
    </>
  );
  return (
    <figure className={`bm-fig at-fig ${side ? 'side' : ''}`}>
      <svg viewBox={box.join(' ')} role="img" aria-label={label || VIEW_LABEL[view]}>
        {view === 'left' ? <g transform={MIRROR}>{body}</g> : body}
      </svg>
      <figcaption className="muted xs">{label || VIEW_LABEL[view]}</figcaption>
    </figure>
  );
}

// Couleurs des modes (vert = bon, orange = à surveiller, rouge = élevé, gris = pas de données)
export const MODES = {
  rec: { label: 'Récupération', legend: [['faible', '#2BB56B', 'Fatigue estimée faible'], ['moderee', '#F5A524', 'Fatigue estimée modérée'], ['elevee', '#E5484D', 'Fatigue estimée élevée'], ['aucune', 'var(--bm-nodata)', 'Pas de travail récent']] },
  vol: { label: 'Volume', legend: [['absent', 'var(--bm-nodata)', 'Rien'], ['sous', '#F5A524', 'Sous la zone'], ['zone', '#2BB56B', 'Zone efficace'], ['au_dessus', '#3B82F6', 'Au-dessus']] },
  force: { label: 'Force', legend: [['record', '#2BB56B', 'À ton record'], ['proche', '#8BCF6A', 'Proche (90 à 98 %)'], ['sous', '#F5A524', 'Sous ton record'], ['insuffisant', 'var(--bm-nodata)', 'Pas assez de données']] },
  prog: { label: 'Progression', legend: [['progres', '#2BB56B', 'En progrès'], ['stagne', '#F5A524', 'Stable'], ['baisse', '#E5484D', 'En baisse'], ['insuffisant', 'var(--bm-nodata)', 'Pas assez de données']] },
  pain: { label: 'Douleurs', legend: [['1', '#F7D154', 'Légère (1 à 3)'], ['4', '#F5A524', 'Modérée (4 à 6)'], ['7', '#E5484D', 'Forte (7 à 10)']] },
};
const C = (mode, k) => MODES[mode].legend.find(([x]) => x === k)?.[1] || null;
export const volVerdict = (m, period, kind) => {
  const v = m.volume[period]; const n = kind === 'direct' ? v.direct : v.total; const z = m.volume.zone;
  return n <= 0 ? 'absent' : n < z.low ? 'sous' : n <= z.high ? 'zone' : 'au_dessus';
};
export const painOn = (m, side) => (m?.pain || []).filter((p) => !p.side || p.side === 'deux' || side === 'centre' || p.side === side);
export function colorFor(state, mode, opts) {
  return (id, side) => {
    const m = state?.muscles?.[id]; if (!m) return null;
    if (mode === 'rec') return C('rec', m.recovery.level);
    if (mode === 'vol') return C('vol', volVerdict(m, opts.period, opts.kind));
    if (mode === 'force') return C('force', m.strength.verdict);
    if (mode === 'prog') return C('prog', m.progression[opts.weeks].verdict);
    if (mode === 'pain') { const p = painOn(m, side)[0]; return p ? C('pain', p.intensity >= 7 ? '7' : p.intensity >= 4 ? '4' : '1') : null; }
    return null;
  };
}

// Ce que le mode affiche pour le muscle choisi, en une ligne
export function modeLine(m, mode, opts, side) {
  if (!m) return '';
  const fr = (x) => String(x).replace('.', ',');
  if (mode === 'rec') return `${m.recovery.label}${m.recovery.ready_in_h > 0 ? ` · repasse sous le seuil modéré dans environ ${m.recovery.ready_in_h} h` : ''}`;
  if (mode === 'vol') { const v = m.volume[opts.period]; return `${fr(v.direct)} séries directes + ${fr(v.indirect)} indirectes par semaine (${opts.period === 1 ? '7 derniers jours' : `moyenne sur ${v.weeks} sem.`}) · zone efficace ${m.volume.zone.low} à ${m.volume.zone.high}`; }
  if (mode === 'force') return m.strength.text;
  if (mode === 'prog') return m.progression[opts.weeks].text;
  if (mode === 'pain') { const p = painOn(m, side); return p.length ? p.map((x) => `${x.label}${x.side && x.side !== 'deux' ? ` (${x.side})` : ''} : ${x.intensity}/10`).join(' · ') : 'Aucune douleur signalée ici. Touche « Signaler » si ça fait mal.'; }
  return '';
}

// Carte complète : modes, vues, zoom, légende et muscle choisi
export default function AnatomyMap({ state, onOpen, onPain, initialMode = 'rec', compact }) {
  const [mode, setMode] = useState(initialMode); const [view, setView] = useState('fb'); const [zoom, setZoom] = useState('all');
  const [period, setPeriod] = useState(1); const [kind, setKind] = useState('total'); const [weeks, setWeeks] = useState(8);
  const [sel, setSel] = useState(null);
  const opts = { period, kind, weeks };
  const colorOf = useMemo(() => colorFor(state, mode, opts), [state, mode, period, kind, weeks]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (id, side) => setSel(sel?.id === id && sel?.side === side ? null : { id, side });
  const m = sel ? state?.muscles?.[sel.id] : null; const info = sel ? MUSCLE_BY_ID[sel.id] : null;
  const views = view === 'fb' ? ['front', 'back'] : [view];
  const area = sel ? Object.entries(PAIN_FINE).find(([, l]) => l.includes(sel.id))?.[0] : null;
  return (
    <div className="atlas">
      <AtlasDefs />
      <div className="chips scroll at-modes">{Object.entries(MODES).map(([k, x]) => <button key={k} className={`chip ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>{x.label}</button>)}</div>
      {mode === 'vol' && <div className="chips scroll at-sub">
        {[[1, '7 jours'], [4, '4 sem.'], [8, '8 sem.'], [12, '12 sem.']].map(([k, l]) => <button key={k} className={`chip sm ${period === k ? 'on' : ''}`} onClick={() => setPeriod(k)}>{l}</button>)}
        <span className="at-sep" />
        {[['total', 'Toutes'], ['direct', 'Directes']].map(([k, l]) => <button key={k} className={`chip sm ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>)}
      </div>}
      {mode === 'prog' && <div className="chips scroll at-sub">{[[8, '8 semaines'], [12, '12 semaines'], [26, '6 mois']].map(([k, l]) => <button key={k} className={`chip sm ${weeks === k ? 'on' : ''}`} onClick={() => setWeeks(k)}>{l}</button>)}</div>}
      {!compact && <div className="at-controls">
        <select aria-label="Vue" value={view} onChange={(e) => setView(e.target.value)}>{VIEWS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <div className="at-zoom" role="group" aria-label="Zoom">{ZOOMS.map(([k, l]) => <button key={k} className={zoom === k ? 'on' : ''} onClick={() => setZoom(k)} aria-pressed={zoom === k}>{l}</button>)}</div>
      </div>}
      <div className={`bm-figs at-figs n${views.length} z-${zoom}`}>{views.map((v) => <AtlasFigure key={v} view={v} zoom={zoom} colorOf={colorOf} sel={sel} onPick={pick} />)}</div>
      <div className="bm-legend small">{MODES[mode].legend.map(([k, c, l]) => <span key={k}><i style={{ background: c }} />{l}</span>)}</div>
      {!sel ? <p className="muted small center">{mode === 'pain' ? 'Touche l’endroit qui fait mal pour le signaler ou voir son suivi.' : 'Touche un muscle : son nom, son état et ses exercices.'}</p> : (
        <div className="at-pick">
          <div className="row-between"><b>{info?.name}{sel.side && sel.side !== 'centre' ? <span className="muted small"> · côté {sel.side}</span> : null}</b>
            <button className="icon-btn" onClick={() => setSel(null)} aria-label="Fermer"><Icon name="x" size={16} /></button></div>
          {m ? <p className="small">{modeLine(m, mode, opts, sel.side)}</p> : <p className="muted small">Pas de données pour ce muscle.</p>}
          <div className="row gap-s wrap mt-s">
            <button className="btn sm primary" onClick={() => onOpen?.(sel.id, sel.side)}><Icon name="info" size={14} />Fiche du muscle</button>
            {area && <button className="btn sm" onClick={() => onPain?.(area, sel.side === 'centre' ? null : sel.side, sel.id)}><Icon name="heal" size={14} />Signaler une douleur</button>}
          </div>
        </div>
      )}
    </div>
  );
}
