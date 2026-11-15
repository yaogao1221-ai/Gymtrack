import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet, Icon, Loading, useApi, useToast } from './ui.jsx';
import { BarChart, LineChart, COLORS } from './charts.jsx';
import { AtlasFigure, MODES, volVerdict } from './AnatomyMap.jsx';
import { ExerciseInfo } from './ExerciseDemo.jsx';
import { Thumbs } from './BodyMap.jsx';
import { BalanceRow } from './Balance.jsx';
import { get, post } from '../lib/api.js';
import { loadLib } from '../lib/exlib.js';
import { loadMorpho } from '../lib/morpho.js';
import { fmtDate } from '../lib/format.js';
import { MUSCLE_BY_ID, REGIONS, fineLoads } from '../../../server/body/muscles.js';
import { rateExercise } from '../../../server/morpho.js';

const GROUP_LABEL = { pectoraux: 'Pectoraux', epaules_ant: 'Épaules avant', epaules_lat: 'Épaules côté', epaules_post: 'Épaules arrière', biceps: 'Biceps', triceps: 'Triceps', avant_bras: 'Avant-bras', abdominaux: 'Abdominaux',
  quadriceps: 'Quadriceps', ischios: 'Ischio-jambiers', fessiers: 'Fessiers', adducteurs: 'Adducteurs', abducteurs: 'Abducteurs', mollets: 'Mollets', trapezes: 'Trapèzes', dos_epaisseur: 'Dos (épaisseur)', dos_largeur: 'Dos (largeur)', lombaires: 'Lombaires' };
const fr = (x) => (x == null ? '—' : String(Math.round(x * 10) / 10).replace('.', ','));
const TABS = [['info', 'Infos'], ['train', 'Entraînement'], ['prog', 'Progression'], ['rec', 'Récupération'], ['bal', 'Équilibre']];
const viewOf = (info) => (info.views.includes('f') ? 'front' : info.views.includes('b') ? 'back' : 'right');
const dot = (mode, k) => MODES[mode].legend.find(([x]) => x === k);

// Fiche d'un muscle fin : informations, entraînement, progression, récupération, équilibre. Données réelles seulement.
export default function MuscleSheet({ id, side, open, onClose, onChange }) {
  const [tab, setTab] = useState('info'); const [d, setD] = useState(null); const [lib, setLib] = useState(null); const [mo, setMo] = useState(null); const [x, setX] = useState(null);
  const prog = useApi('/program'); const bal = useApi('/bodymap/balance'); const toast = useToast();
  const info = MUSCLE_BY_ID[id];
  useEffect(() => { setTab('info'); setD(null); if (open && id) get(`/body/muscle/${id}?h=${new Date().getHours()}`).then(setD).catch(() => setD(false)); }, [id, open]);
  useEffect(() => { if (open && !lib) { loadLib().then(setLib).catch(() => setLib([])); loadMorpho().then(setMo).catch(() => {}); } }, [open, lib]);
  // Exercices de ton programme qui travaillent ce muscle (répartition estimée par type de mouvement)
  const mine = useMemo(() => (prog.data?.days || []).flatMap((day) => day.exercises.map((e) => ({ e, day, f: fineLoads(e).find((l) => l.id === id) })).filter((o) => o.f && o.f.w > 0.2))
    .sort((a, b) => b.f.w - a.f.w), [prog.data, id]);
  // Meilleurs choix de la bibliothèque : le muscle en cible principale, adaptés à ta morphologie, photo de préférence
  const best = useMemo(() => {
    if (!lib) return [];
    const inProg = new Set(mine.map((o) => o.e.lib_id));
    return lib.filter((l) => l.c !== 'mobilite' && l.c !== 'cardio' && !inProg.has(l.id)).map((l) => ({ l, f: fineLoads({ name: l.n, en: l.en, lib_id: l.id, pattern: l.pt, muscles: l.m }).find((y) => y.id === id) }))
      .filter((o) => o.f && o.f.direct).map((o) => ({ ...o, r: mo ? rateExercise(o.l, mo.morpho, mo.pains) : { score: 0, verdict: 'neutre' } }))
      .filter((o) => o.r.verdict !== 'conflit').sort((a, b) => b.f.w - a.f.w || b.r.score - a.r.score || (b.l.img ? 1 : 0) - (a.l.img ? 1 : 0)).slice(0, 6).map((o) => o.l);
  }, [lib, mine, mo, id]);
  const stretch = useMemo(() => (lib && info?.group ? lib.filter((l) => l.c === 'mobilite' && (l.t || []).includes(info.group)).slice(0, 4) : []), [lib, info]);
  if (!info) return null;
  const sore = async () => { try { await post('/soreness', { muscle: info.group, on: true }); toast('Courbatures notées : la fatigue estimée en tient compte'); const n = await get(`/body/muscle/${id}?h=${new Date().getHours()}`); setD(n); onChange?.(); } catch (e) { toast(e.message, 'err'); } };
  const balItems = info.group ? bal.data?.by_muscle?.[info.group] || [] : [];
  return (
    <Sheet open={open} onClose={onClose} title={info.name}>
      <div className="ms-head">
        {!info.deep && <div className="ms-fig"><AtlasFigure view={viewOf(info)} zoom={['cuisses', 'jambes', 'hanches'].includes(info.region) ? 'jambes' : info.region === 'tronc' ? 'tronc' : 'haut'} colorOf={(mid, sd) => (mid === id && (!side || side === 'centre' || sd === side || sd === 'centre') ? 'var(--accent)' : null)} sel={null} onPick={() => {}} label=" " /></div>}
        <div className="grow">
          <span className="muted small">{REGIONS[info.region]}{side && side !== 'centre' ? ` · côté ${side}` : ''}</span>
          {d && <div className="ms-pills">
            <span className="ms-pill" style={{ '--c': dot('rec', d.recovery.level)[1] }}>{d.recovery.label}</span>
            <span className="ms-pill" style={{ '--c': dot('vol', volVerdict(d, 4, 'total'))[1] }}>{fr(d.volume[4].total)} séries / sem.</span>
            {d.pain.length > 0 && <span className="ms-pill" style={{ '--c': '#E5484D' }}>Douleur {d.pain[0].intensity}/10</span>}
          </div>}
        </div>
      </div>
      <div className="chips scroll ms-tabs">{TABS.map(([k, l]) => <button key={k} className={`chip sm ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      {d === null ? <Loading /> : d === false ? <p className="muted">Données indisponibles.</p> : <>
        {tab === 'info' && <div className="ms-body">
          <p>{info.fn}</p>
          <dl className="ms-dl">
            <dt>Région</dt><dd>{REGIONS[info.region]}</dd>
            <dt>Groupe dans tes séances</dt><dd>{info.group ? GROUP_LABEL[info.group] : 'Aucun : seulement les exercices qui le visent par leur nom'}</dd>
            <dt>Visible sur</dt><dd>{info.deep ? 'Muscle profond, caché sous d’autres muscles : pas dessiné sur la carte' : info.views.map((v) => ({ f: 'face', b: 'dos', s: 'profils' })[v]).join(', ')}</dd>
          </dl>
          <p className="muted xs">Tes séances enregistrent des groupes musculaires. La part de ce muscle dans chaque exercice est estimée selon le type de mouvement (par exemple, un développé incliné compte davantage pour le pectoral supérieur).</p>
          {stretch.length > 0 && <><h4 className="h-sub">Étirements et mobilité</h4><Thumbs list={stretch} onOpen={setX} /></>}
        </div>}
        {tab === 'train' && <div className="ms-body">
          <table className="ms-table"><thead><tr><th /><th>Directes</th><th>Indirectes</th><th>Total</th></tr></thead>
            <tbody>{[[1, '7 jours'], [4, '4 semaines'], [8, '8 semaines'], [12, '12 semaines']].map(([k, l]) => <tr key={k}><td>{l}</td><td>{fr(d.volume[k].direct)}</td><td>{fr(d.volume[k].indirect)}</td><td><b>{fr(d.volume[k].total)}</b></td></tr>)}</tbody></table>
          <p className="muted xs">Séries par semaine (moyenne sur les semaines où tu t’entraînais déjà). Zone efficace pour ton niveau : {d.volume.zone.low} à {d.volume.zone.high}.</p>
          {d.weeks.some((w) => w.direct + w.indirect > 0)
            ? <BarChart stacked height={170} labels={d.weeks.map((w) => fmtDate(w.start, { day: 'numeric', month: 'short' }))} series={[{ label: 'Directes', data: d.weeks.map((w) => w.direct), color: COLORS.lime }, { label: 'Indirectes', data: d.weeks.map((w) => w.indirect), color: COLORS.blue }]} />
            : <p className="muted small">Aucune série enregistrée sur ce muscle depuis 12 semaines.</p>}
          <h4 className="h-sub">Dans ton programme</h4>
          {mine.length ? <ul className="ms-list">{mine.map(({ e, day, f }) => <li key={e.id}><span className="grow"><b>{e.name}</b><span className="muted xs block">{day.name} · {e.sets} séries</span></span><span className={`tag ${f.direct ? 'good' : ''}`}>{f.direct ? 'Principal' : 'Secondaire'}</span></li>)}</ul>
            : <p className="muted small">Aucun exercice de ton programme ne le travaille.</p>}
          {d.exercises.length > 0 && <><h4 className="h-sub">Ce que tu as fait (6 mois)</h4><ul className="ms-list">{d.exercises.map((e) => <li key={e.id}><span className="grow"><b>{e.name}</b><span className="muted xs block">{e.sets} séries · {e.sets4} ces 4 semaines · dernière fois {fmtDate(e.last, { day: 'numeric', month: 'short' })}</span></span><span className={`tag ${e.direct ? 'good' : ''}`}>{e.direct ? 'Principal' : 'Secondaire'}</span></li>)}</ul></>}
          {best.length > 0 && <><h4 className="h-sub">Bons choix pour le cibler</h4><p className="muted xs">Le ciblent en principal, adaptés à ta morphologie quand tu l’as renseignée.</p><Thumbs list={best} onOpen={setX} /></>}
        </div>}
        {tab === 'prog' && <div className="ms-body">
          <p className="small"><b>Force :</b> {d.strength.text}</p>
          {d.strength.series?.length >= 2 && <LineChart height={170} labels={d.strength.series.map((p) => fmtDate(p.date, { day: 'numeric', month: 'short' }))} series={[{ label: `${d.strength.exercise} (1RM estimé, lbs)`, data: d.strength.series.map((p) => p.v), color: COLORS.lime, fill: true }]} />}
          {[8, 12, 26].map((w) => <p key={w} className="small"><span className="ms-dot" style={{ background: dot('prog', d.progression[w].verdict)[1] }} /><b>{w === 26 ? '6 mois' : `${w} semaines`} :</b> {d.progression[w].text}</p>)}
          <p className="muted xs">1RM estimé à partir de tes charges et répétitions réelles (formule d’Epley), sur les exercices qui le ciblent en principal.</p>
        </div>}
        {tab === 'rec' && <div className="ms-body">
          <p><span className="ms-dot" style={{ background: dot('rec', d.recovery.level)[1] }} /><b>{d.recovery.label}</b>{d.recovery.ready_in_h > 0 ? ` : environ ${d.recovery.ready_in_h} h avant de repasser sous le seuil modéré.` : '.'}</p>
          <ul className="small tips-list">{d.recovery.factors.length ? d.recovery.factors.map((t, i) => <li key={i}>{t}</li>) : <li>Aucune série sur ce muscle ces 10 derniers jours.</li>}</ul>
          <p className="muted xs">Estimation calculée, pas une mesure de ton corps : écoute aussi tes sensations. Le calcul se règle dans Corps, onglet Récupération.</p>
          {info.group && <button className="btn sm" onClick={sore}>J’ai des courbatures ici</button>}
          <h4 className="h-sub">Douleurs</h4>
          {d.pain.length ? d.pain.map((p) => <p key={p.id} className="small"><b>{p.label}</b>{p.side && p.side !== 'deux' ? ` (${p.side})` : ''} : {p.intensity}/10 depuis le {fmtDate(p.date, { day: 'numeric', month: 'long' })}. <Link to={`/soins?zone=${p.area}`}>Que faire ?</Link></p>)
            : <p className="muted small">Aucune douleur signalée sur cette zone. Une douleur n’est pas de la fatigue : signale-la à part si elle apparaît.</p>}
        </div>}
        {tab === 'bal' && <div className="ms-body">
          <p className="muted small">Comparaison de tes séries et de tes charges avec le muscle opposé. C’est un repère d’entraînement, pas un diagnostic de déséquilibre physique.</p>
          {balItems.length ? <ul className="bal-list">{balItems.map((b, i) => <BalanceRow key={i} x={b} compact={b.kind === 'volume'} />)}</ul> : <p className="muted small">Pas de comparaison possible pour ce muscle avec tes données actuelles.</p>}
        </div>}
      </>}
      <ExerciseInfo open={!!x} x={x} onClose={() => setX(null)} />
    </Sheet>
  );
}
