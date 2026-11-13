import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, Card, Icon, ActivityRings, GRADS, Loading, ErrorBox, Empty, Sheet, Field, NumInput, useToast } from '../components/ui.jsx';
import { post, today } from '../lib/api.js';
import { Spark, COLORS } from '../components/charts.jsx';
import { IconStrength } from '../components/Art3D.jsx';
import { BodyFigures } from '../components/BodyMap.jsx';
import { fmtDate, fmtDay, relDay, n0 } from '../lib/format.js';

export default function Dashboard() {
  const { data: d, error, reload } = useApi('/dashboard');
  const nav = useNavigate(); const toast = useToast();
  const [weigh, setWeigh] = useState(null);
  if (error && !d) return <ErrorBox error={error} retry={reload} />;
  if (!d) return <Loading />;
  const hour = new Date().getHours();
  const hello = hour < 6 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';
  const target = d.week.target || 5;
  const rings = [
    { label: 'Séances', grad: 'fire', value: d.week.workouts / target, text: `${d.week.workouts} / ${target}` },
    { label: 'Cardio', grad: 'aqua', value: d.week.cardio_target ? d.week.cardio_minutes / d.week.cardio_target : 0, text: `${d.week.cardio_minutes} / ${d.week.cardio_target || '—'} min` },
    { label: 'Séries', grad: 'violet', value: d.week.sets_target ? d.week.sets / d.week.sets_target : 0, text: `${d.week.sets} / ${d.week.sets_target}` },
  ];
  return (
    <div className="page fade-in">
      <header className="page-head">
        <div><p className="eyebrow">{fmtDay(d.today)}</p><h1>{hello}{d.name && d.name !== 'Athlète' ? `, ${d.name}` : ''}</h1></div>
        <div className="row gap-s"><Link to="/coach" className={`pill recovery ${d.recovery.score >= 75 ? 'good' : d.recovery.score >= 55 ? 'mid' : 'low'}`} title="Récupération estimée"><Icon name="bolt" size={14} />Récup. {d.recovery.score}</Link>
          <Link to="/plus" className="icon-btn" aria-label="Réglages et autres outils"><Icon name="menu" /></Link></div>
      </header>

      <section className="hero card">
        <div className="hero-glow" />
        {d.next && <IconStrength size={84} className="hero-art" />}
        <p className="eyebrow">Prochaine séance{d.next?.date ? ` · ${relDay(d.next.date, d.today)}` : ''}</p>
        {d.next ? (<>
          <h2 className="hero-title">{d.next.name} <span className="muted">—</span> {d.next.focus}</h2>
          <p className="muted small">{d.next.date ? fmtDay(d.next.date) : 'Suivante dans ta rotation'}{d.next.deload ? ' · semaine de deload (charges −10 %, moitié des séries)' : ''}</p>
          {d.next.cardio?.length > 0 && <p className="small hero-cardio"><Icon name="heart" size={14} />{d.next.cardio.map((c) => `${c.label} ${Math.round(c.duration_min)} min ${c.placement === 'debut' ? 'en début' : 'en fin'} de séance`).join(' · ')}</p>}
          <div className="row gap mt">
            <button className="btn primary lg" onClick={() => nav(`/seance/${d.next.program_day_id}`)}><Icon name="play" size={18} />Commencer</button>
            <Link className="btn ghost" to="/programme">Voir le programme</Link>
          </div>
        </>) : <p>Aucune séance au programme.</p>}
      </section>

      {d.day && <MyDay day={d.day} onWeigh={() => setWeigh({ date: d.today, weight_kg: d.body?.last ?? null })} />}
      <MiniMap />
      {d.pending?.length > 0 && (
        <section className="pending">
          <p className="eyebrow">À valider</p>
          {d.pending.map((x) => (
            <div key={x.key} className="pending-row"><span className="small grow">{x.text}</span>
              {x.to ? <Link className="btn xs" to={x.to}>{x.action}</Link> : <button className="btn xs" onClick={() => setWeigh({ date: d.today, weight_kg: d.body?.last ?? null })}>{x.action}</button>}</div>
          ))}
        </section>
      )}

      <Sheet open={!!weigh} onClose={() => setWeigh(null)} title="Pesée du jour"
        footer={<button className="btn primary block" disabled={!weigh?.weight_kg} onClick={async () => {
          try { await post('/body-metrics', { date: weigh.date || today(), weight_kg: Number(weigh.weight_kg) }); setWeigh(null); toast('Pesée enregistrée : poids, objectifs et calories mis à jour'); } catch (e) { toast(e.message, 'err'); }
        }}>Enregistrer</button>}>
        {weigh && <Field label="Poids (kg)" hint="Idéalement le matin, à jeun : la moyenne sur 7 jours lisse les variations d’eau."><NumInput value={weigh.weight_kg} onChange={(v) => setWeigh({ ...weigh, weight_kg: v })} step={0.1} autoFocus /></Field>}
      </Sheet>

      <section className="card week-rings">
        <ActivityRings size={120} rings={rings.map((r) => ({ value: r.value, grad: r.grad }))} />
        <ul className="ring-legend">
          <li className="ring-total"><span>Ma semaine</span><b>{Math.round(rings.reduce((a, r) => a + Math.min(1, r.value), 0) / rings.length * 100)} %</b></li>
          {rings.map((r) => (
            <li key={r.label}>
              <i style={{ background: `linear-gradient(135deg, ${GRADS[r.grad][0]}, ${GRADS[r.grad][1]})` }} />
              <span>{r.label}</span>
              <b>{r.text}</b>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid-2col">
        <BodyCard body={d.body} nutrition={d.nutrition} />
        <Card title="Objectifs" icon="target" action={<Link className="link" to="/objectifs">Gérer</Link>}>
          {d.goals.length ? (
            <ul className="goals">{d.goals.slice(0, 3).map((g) => (
              <li key={g.id}>
                <div className="row-between"><b>{g.title}</b><span className={`small ${g.reached ? 'ok-text' : 'muted'}`}>{g.reached ? 'Atteint' : `${g.current_value == null ? '—' : Number(g.current_value).toLocaleString('fr-FR')} / ${Number(g.target_value).toLocaleString('fr-FR')} ${g.unit || ''}`}</span></div>
                <div className={`bar ${g.reached ? 'done' : ''}`}><span style={{ width: `${Math.round((g.progress || 0) * 100)}%` }} /></div>
              </li>
            ))}</ul>
          ) : <Empty icon="target" title="Aucun objectif"><Link className="btn sm" to="/objectifs">Créer un objectif</Link></Empty>}
        </Card>
      </div>

      {d.last_workout && (
        <Link to={`/historique/${d.last_workout.id}`} className="recap-link card"><Icon name="dumbbell" size={18} /><span className="grow"><b className="small">Dernière séance : {d.last_workout.name}{d.last_workout.focus ? ` — ${d.last_workout.focus}` : ''}</b><span className="muted small">{relDay(d.last_workout.date, d.today)} · {d.last_workout.sets_done} séries · {n0(d.last_workout.volume_lbs)} lbs</span></span><Icon name="right" size={18} /></Link>
      )}
    </div>
  );
}

// Corps : poids lissé (source : pesées), variation sur 4 semaines, cure en cours
export function BodyCard({ body, nutrition }) {
  const f1 = (v) => (v == null ? '—' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }));
  return (
    <Card title="Corps" icon="scale" action={<Link className="link" to="/nutrition?v=poids">{body ? 'Détails' : 'Ajouter'}</Link>}>
      {body ? (<>
        <div className="body-line">
          <div><b className="big">{f1(body.weight)}<small> kg</small></b>
            <span className="muted small">{body.source === 'pesee' ? `moyenne 7 jours · dernière pesée ${f1(body.last)} kg${body.days_ago ? `, il y a ${body.days_ago} j` : ', aujourd’hui'}` : 'poids du profil, ajoute une pesée'}</span></div>
          {body.change_28d != null && <span className={`delta ${body.change_28d === 0 ? '' : body.change_28d > 0 ? 'up' : 'down'}`}>{body.change_28d > 0 ? '+' : ''}{f1(body.change_28d)} kg <small>en 4 sem.</small></span>}
        </div>
        {body.points.length > 1 && <div className="spark wide"><Spark points={body.points} color={COLORS.mint} /></div>}
        {body.waist && <p className="muted small">Tour de taille : {f1(body.waist.value)} cm ({fmtDate(body.waist.date, { day: 'numeric', month: 'short' })})</p>}
      </>) : <Empty icon="user" title="Pas encore de pesée">Ta pesée alimente l’objectif de poids, les calories et l’analyse corporelle.</Empty>}
      {nutrition && <Link to="/nutrition?v=poids" className="nut-inline"><Icon name="flame" size={16} /><span className="grow"><b className="small">{nutrition.label} · semaine {nutrition.week}/{nutrition.weeks}</b><span className="muted small">{nutrition.kcal.toLocaleString('fr-FR')} kcal · {nutrition.protein_g} g de protéines{nutrition.check !== 'ok' && nutrition.check !== 'data' ? ' · ajustement proposé' : ''}</span></span><Icon name="right" size={16} /></Link>}
    </Card>
  );
}

// Ma journée : ce qui est prévu aujourd'hui, coché automatiquement dès que c'est enregistré
function MyDay({ day, onWeigh }) {
  const items = [];
  if (day.workout?.done) items.push({ k: 'w', done: day.workout.done, icon: 'dumbbell', text: day.workout.extra ? 'Séance faite' : `${day.workout.name} — ${day.workout.focus}${day.workout.deload ? ' (deload)' : ''}`,
    to: day.workout.done ? (day.workout.workout_id ? `/historique/${day.workout.workout_id}` : null) : `/seance/${day.workout.program_day_id}`, cta: 'Go' });
  else if (day.rest) items.push({ k: 'r', done: true, icon: 'moon', text: 'Repos : la récupération fait partie du programme' });
  if (day.cardio) items.push({ k: 'c', done: day.cardio.done && day.cardio.done_minutes >= day.cardio.minutes * 0.8, icon: 'heart', text: day.cardio.minutes ? `${day.cardio.minutes} min de cardio${day.cardio.done_minutes ? ` (${day.cardio.done_minutes} faites)` : ''}` : `${day.cardio.done_minutes} min de cardio faites`, to: '/cardio?ajout=1', cta: '+' });
  items.push({ k: 'p', done: day.weighed, icon: 'scale', text: day.weighed ? 'Pesée du matin faite' : 'Pesée du matin, à jeun', onClick: day.weighed ? null : onWeigh, cta: 'Peser' });
  const n = items.filter((x) => x.done).length;
  return (
    <section className="card my-day">
      <div className="card-head"><h2><Icon name="check" size={16} />Ma journée</h2><span className="mono small">{n}/{items.length}</span></div>
      <ul>{items.map((x) => (
        <li key={x.k} className={x.done ? 'done' : ''}>
          <span className="chk">{x.done ? <Icon name="check" size={14} /> : null}</span>
          <Icon name={x.icon} size={16} /><span className="grow small">{x.text}</span>
          {!x.done && x.to && <Link className="btn xs primary" to={x.to}>{x.cta}</Link>}
          {!x.done && x.onClick && <button className="btn xs primary" onClick={x.onClick}>{x.cta}</button>}
          {x.done && x.to && <Link className="link small" to={x.to}>Voir</Link>}
        </li>
      ))}</ul>
      {day.kcal ? <p className="day-targets small"><Link to="/repas"><b>{Number(day.eaten_kcal || 0).toLocaleString('fr-FR')} / {Number(day.kcal).toLocaleString('fr-FR')} kcal</b> mangées</Link> · <b>{day.protein_g} g</b> de protéines · <b>{Number(day.steps).toLocaleString('fr-FR')}</b> pas <Link className="link" to="/repas">noter un repas</Link></p>
        : <p className="day-targets small muted">Pas encore de cibles de calories : <Link className="link" to="/plan">calcule ton plan</Link></p>}
    </section>
  );
}

// Aperçu de la carte du corps sur l'accueil : un coup d'œil sur ce qui est prêt ou fatigué
function MiniMap() {
  const { data } = useApi('/bodymap');
  if (!data) return null;
  const m = Object.values(data.muscles);
  const ready = m.filter((x) => x.status === 'pret').length; const tired = m.filter((x) => x.status === 'fatigue' || x.status === 'recup');
  return (
    <Link to="/corps" className="card minimap">
      <BodyFigures data={data} small />
      <div className="grow">
        <h2 className="small-h"><Icon name="body" size={16} />Mon corps</h2>
        <p className="small">{tired.length ? <><b>{tired.length} muscle{tired.length > 1 ? 's' : ''} en récupération</b> : {tired.slice(0, 3).map((x) => x.label.toLowerCase()).join(', ')}</> : <b>Tout est récupéré</b>}</p>
        <p className="muted small">{ready} prêts{data.pains.length ? ` · ${data.pains.length} douleur${data.pains.length > 1 ? 's' : ''} suivie${data.pains.length > 1 ? 's' : ''}` : ''}</p>
        <span className="link small">Voir la carte <Icon name="right" size={12} /></span>
      </div>
    </Link>
  );
}
