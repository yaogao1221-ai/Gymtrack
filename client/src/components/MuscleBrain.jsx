// Cerveau musculaire côté écran : séance du jour, fiche muscle, fiche articulation, bilan du dimanche.
// Tout vient de GET /muscles/state (un seul calcul pour toute l'appli) ; chaque action passe par une validation.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, useToast } from './ui.jsx';
import { Spark } from './charts.jsx';
import { post } from '../lib/api.js';
import { loadLib, thumb } from '../lib/exlib.js';
import { ExThumb } from './MoveFigure.jsx';
import { AREAS, ROUTINES } from '../data/rehab.js';
import { fmtDate, n1 } from '../lib/format.js';

export const VOL_COLORS = { absent: 'var(--map-0)', sous: '#F5A524', zone: '#2BB56B', au_dessus: '#3B82F6' };
export const VOL_LABEL = { absent: 'Rien', sous: 'Pas assez', zone: 'Zone efficace', au_dessus: 'Beaucoup' };
export const PROG_COLORS = { progres: '#2BB56B', stagne: '#F5A524', baisse: '#E5484D', insuffisant: 'var(--map-0)' };
export const PROG_LABEL = { progres: 'En progrès', stagne: 'Stagne', baisse: 'En baisse', insuffisant: 'Pas assez de données' };
export const JOINT_COLORS = { douleur: '#E5484D', surcharge: '#F5A524', ok: '#2BB56B', repos: 'var(--map-0)' };
export const JOINT_LABEL = { douleur: 'Douleur', surcharge: 'Charge en hausse rapide', ok: 'Charge stable', repos: 'Peu sollicitée' };
const REC_LABEL = { fatigue: 'Encore fatigué', recup: 'En récupération', pret: 'Prêt', oublie: 'Pas travaillé depuis 10 jours' };
const ago = (d) => (d == null ? null : d === 0 ? 'aujourd’hui' : d === 1 ? 'hier' : `il y a ${d} jours`);
const routineOf = (key) => ROUTINES.find((r) => r.key === key);

// Bouton « fait » d'une routine de mobilité ou de soin (une fois par jour)
export function MobilityDone({ routine, area, done: init, onDone, label = 'Faite aujourd’hui' }) {
  const [done, setDone] = useState(!!init); const toast = useToast();
  useEffect(() => setDone(!!init), [init]);
  const toggle = async () => {
    try { await post('/mobility', { routine, area, on: !done }); setDone(!done); toast(!done ? 'Noté : bravo, tes articulations te remercient' : 'Retiré'); onDone?.(); } catch (e) { toast(e.message, 'err'); }
  };
  return <button className={`btn sm ${done ? 'primary' : ''}`} onClick={toggle}><Icon name="check" size={14} />{done ? label : 'Je l’ai faite'}</button>;
}

// ---------- Séance du jour ----------
export function TodayCard({ state, compact, onChange }) {
  const nav = useNavigate();
  if (!state?.today_plan) return null;
  const p = state.today_plan; const mob = p.mobility;
  const mobDone = mob && Object.values(state.joints || {}).some((j) => j.mobility.days === 0 && (mob.area ? j.key === mob.area : j.routine === mob.routine));
  return (
    <section className={`card today-plan ${compact ? 'compact' : ''}`}>
      <div className="card-head"><h2><Icon name="target" size={16} />Séance du jour</h2>{compact && <Link className="link small" to="/corps">Carte</Link>}</div>
      <p className="small">{p.text}</p>
      {p.focus?.length > 0 && <ul className="tp-focus">{p.focus.slice(0, compact ? 3 : 4).map((f) => <li key={f.key}><b>{f.label}</b>{!compact && <span className="muted xs">{f.why}</span>}</li>)}</ul>}
      {p.avoid?.length > 0 && !compact && <p className="xs muted"><Icon name="alert" size={12} /> À ménager : {Object.entries(p.avoid.reduce((g, a) => ({ ...g, [a.why]: [...(g[a.why] || []), a.label.toLowerCase()] }), {})).map(([why, l]) => `${l.join(', ')} (${why.toLowerCase()})`).join(' ; ')}.</p>}
      {(p.day || p.planned) && !p.done && (() => {
        const main = p.planned && (!p.planned.clash.length || !p.day || p.day.id === p.planned.id) ? p.planned : p.day;
        const alt = p.planned && main.id !== p.planned.id ? p.planned : null;
        return <div className="row gap-s mt-s wrap"><button className="btn primary sm" onClick={() => nav(`/seance/${main.id}`)}><Icon name="play" size={14} />Commencer {main.name}</button>
          {alt && !compact && <button className="btn sm ghost" onClick={() => nav(`/seance/${alt.id}`)}>Garder {alt.name} (allégé)</button>}</div>;
      })()}
      {mob && !compact && (
        <div className="tp-mob">
          <span className="grow"><b className="small">{mob.title}</b><span className="muted xs">{mob.why}</span></span>
          <Link className="btn sm ghost" to={mob.area ? `/soins?zone=${mob.area}` : '/soins'}>Voir</Link>
          <MobilityDone routine={mob.routine} area={mob.area} done={mobDone} onDone={onChange} />
        </div>
      )}
    </section>
  );
}

// ---------- Fiche muscle : chiffres, ce qui manque, priorité ----------
export function MuscleStats({ m, state, onChange }) {
  const toast = useToast(); const [busy, setBusy] = useState(false);
  const prio = state.priority || [];
  const togglePrio = async () => {
    const next = m.priority ? prio.filter((k) => k !== m.key) : [...prio, m.key];
    if (next.length > 3) { toast('3 muscles prioritaires au plus : retire-en un d’abord', 'err'); return; }
    setBusy(true);
    try { await post('/muscles/priority', { muscles: next }); toast(m.priority ? 'Muscle retiré des priorités' : 'Muscle prioritaire : le coach te proposera plus de volume, à valider'); onChange?.(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const v = m.volume; const pr = m.progression;
  const pts = (pr.main?.series || []).map((x) => ({ value: x.v }));
  const adj = (state.adjustments || []).filter((a) => a.muscle === m.key).slice(0, 2);
  return (
    <>
      <div className="ms-grid">
        <div className="ms"><span className="xs muted">Volume (moy. {v.weeks} sem.)</span><b>{n1(v.avg)} <small>séries/sem.</small></b><span className="ms-tag" style={{ background: VOL_COLORS[v.verdict] }}>{VOL_LABEL[v.verdict]}</span><span className="xs muted">zone {v.zone.low} à {v.zone.high} · cette semaine {n1(v.week)}</span><span className="xs muted">{m.frequency > 0 ? `${n1(m.frequency)} fois par semaine${m.frequency < 1.5 ? ' (2 conseillé)' : ''}` : 'pas travaillé'}</span></div>
        <div className="ms"><span className="xs muted">Récupération</span><b className="small">{REC_LABEL[m.recovery.status]}</b><span className="xs muted">{m.recovery.last ? `dernière fois ${ago(m.recovery.days)}` : 'jamais travaillé'}</span></div>
        <div className="ms wide"><span className="xs muted">Force sur 8 semaines</span><b>{pr.change_pct != null ? `${pr.change_pct > 0 ? '+' : ''}${n1(pr.change_pct)} %` : '—'}</b><span className="ms-tag" style={{ background: PROG_COLORS[pr.verdict] }}>{PROG_LABEL[pr.verdict]}</span>
          {pts.length > 1 && <Spark points={pts} color={PROG_COLORS[pr.verdict]} height={34} />}
          <span className="xs muted">{pr.main ? `${pr.main.name} · 1RM estimé, meilleur ${pr.main.best} lbs` : pr.text}</span></div>
      </div>
      {m.caution && <p className="brief-warn"><Icon name={m.pain ? 'heal' : 'alert'} size={15} />{m.caution}</p>}
      {m.needs.length > 0 ? (<><h4 className="h-sub">Ce qui lui manque</h4><ul className="ms-needs">{m.needs.map((n) => <li key={n.k} className="small">{n.text}</li>)}</ul></>)
        : !m.pain && <p className="small mt-s"><Icon name="check" size={13} /> Rien à corriger sur ce muscle pour l’instant.</p>}
      {adj.map((a) => <p key={a.id} className={`ms-adj ${a.status}`}><Icon name={a.status === 'marche' ? 'check' : a.status === 'en_cours' ? 'clock' : 'alert'} size={13} /><span className="small">{a.kind === 'priorite' ? 'Prioritaire depuis' : `${a.details.exercise} ${a.details.from} → ${a.details.to} séries depuis`} le {fmtDate(a.date, { day: 'numeric', month: 'short' })} : {a.text}</span></p>)}
      <button className={`btn sm mt-s ${m.priority ? 'primary' : ''}`} disabled={busy} onClick={togglePrio}><Icon name="star" size={14} />{m.priority ? 'Muscle prioritaire' : 'En faire un muscle prioritaire'}</button>
    </>
  );
}

// ---------- Fiche articulation : douleur, charge, mobilité et soin ----------
export function JointPanel({ j, onOpen, onChange }) {
  const [lib, setLib] = useState(null);
  useEffect(() => { loadLib().then(setLib).catch(() => setLib([])); }, []);
  const area = AREAS[j.key];
  const plan = useMemo(() => {
    if (j.pain && area) { const ph = area.phases[j.pain.intensity >= 5 ? 0 : 1]; return { t: ph.t, d: ph.d, ex: ph.ex, routine: `soin:${j.key}` }; }
    const r = routineOf(j.routine); return r ? { t: r.t, d: `${r.d} · 5 à 8 min`, ex: r.ex, routine: r.key } : null;
  }, [j, area]);
  const byId = useMemo(() => new Map((lib || []).map((x) => [x.id, x])), [lib]);
  const list = plan ? plan.ex.map(([id, dose]) => ({ x: byId.get(id), dose })).filter((y) => y.x) : [];
  return (
    <div className="bm-panel">
      <div className="row-between"><b>{j.label}</b><span className="bm-pill" style={{ background: JOINT_COLORS[j.status] }}>{JOINT_LABEL[j.status]}</span></div>
      <p className="small mt-s">{j.text}</p>
      <p className="xs muted">Séries qui sollicitent cette articulation : {j.load.week} cette semaine, {n1(j.load.avg)} en moyenne par semaine. Mobilité : {j.mobility.last ? `faite ${ago(j.mobility.days)}` : 'pas encore notée'}{j.mobility.week ? ` · ${j.mobility.week} fois cette semaine` : ''}.</p>
      {plan && (<>
        <h4 className="h-sub">{j.pain ? `Soin du jour : ${plan.t.replace(/^\d\. /, '')}` : `Mobilité : ${plan.t.toLowerCase()}`}</h4>
        <p className="xs muted">{plan.d}</p>
        <ul className="thumbs">{list.map(({ x, dose }) => <li key={x.id}><button onClick={() => onOpen(x)}><ExThumb src={thumb(x.id)} x={x} /><span className="small">{x.n}</span><span className="muted xs">{dose}</span></button></li>)}</ul>
        <div className="row gap-s mt-s"><MobilityDone routine={plan.routine} area={j.key} done={j.mobility.days === 0} onDone={onChange} /><Link className="btn sm ghost" to={`/soins${area ? `?zone=${j.key}` : ''}`}>{j.pain ? 'Mon protocole' : 'Soins et mobilité'}</Link></div>
      </>)}
    </div>
  );
}

// ---------- Bilan musculaire du dimanche ----------
export function SundayCard({ data }) {
  if (!data) return null;
  return (
    <section className={`card sunday ${data.is_sunday ? 'rec' : ''}`}>
      <div className="card-head"><h2><Icon name="body" size={16} />Bilan musculaire de la semaine</h2><Link className="link small" to="/corps">Carte</Link></div>
      <p className="small"><b>{data.in_zone} muscle{data.in_zone > 1 ? 's' : ''} sur {data.tracked}</b> dans leur zone de volume cette semaine.{data.global ? ` Équilibre global : ${data.global.value}/100 (${data.global.label.toLowerCase()}).` : ''}</p>
      {data.up.length > 0 && <p className="small"><Icon name="up" size={13} /> En progrès : {data.up.map((x) => x.label.toLowerCase()).join(', ')}.</p>}
      {data.stuck.length > 0 && <p className="small"><Icon name="alert" size={13} /> Bloqués : {data.stuck.map((x) => x.label.toLowerCase()).join(', ')}.</p>}
      {data.under.length > 0 && <p className="xs muted">Sous la zone cette semaine : {data.under.slice(0, 6).map((x) => `${x.label.toLowerCase()} (${n1(x.sets)}/${x.low})`).join(', ')}.</p>}
      {data.results.length > 0 && <><h4 className="h-sub">Tes ajustements ont-ils marché ?</h4><ul className="ms-needs">{data.results.map((r) => <li key={r.id} className={`small ${r.status}`}>{r.label} : {r.text}</li>)}</ul></>}
      {data.proposals.length > 0 && <p className="small mt-s"><Icon name="check" size={13} /> <a href="#valider" className="link">{data.proposals.length} ajustement{data.proposals.length > 1 ? 's' : ''} à valider</a> : {data.proposals.map((p) => p.title).join(' · ')}. Chaque ajustement validé est vérifié 4 semaines plus tard sur ta force réelle.</p>}
    </section>
  );
}
