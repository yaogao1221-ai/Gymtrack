import { Link, useNavigate } from 'react-router-dom';
import { useApi, Card, Icon, ActivityRings, GRADS, Loading, ErrorBox, Empty } from '../components/ui.jsx';
import { Spark, COLORS } from '../components/charts.jsx';
import { fmtDate, fmtDay, relDay, dur, mins, n0, addDays, CARDIO, CARDIO_ICON } from '../lib/format.js';

export default function Dashboard() {
  const { data: d, error, reload } = useApi('/dashboard');
  const nav = useNavigate();
  if (error && !d) return <ErrorBox error={error} retry={reload} />;
  if (!d) return <Loading />;
  const hour = new Date().getHours();
  const hello = hour < 6 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';
  const days = Array.from({ length: 14 }, (_, i) => addDays(d.calendar.from, i));
  const target = d.week.target || 5;
  const rings = [
    { label: d.week.target_from_goal ? 'Séances muscu (objectif)' : 'Séances muscu', grad: 'fire', value: d.week.workouts / target, text: `${d.week.workouts} / ${target}` },
    { label: d.week.cardio_from_goal ? 'Minutes de cardio (objectif)' : 'Minutes de cardio', grad: 'aqua', value: d.week.cardio_target ? d.week.cardio_minutes / d.week.cardio_target : 0, text: `${d.week.cardio_minutes} / ${d.week.cardio_target || '—'} min` },
    { label: 'Séries validées', grad: 'violet', value: d.week.sets_target ? d.week.sets / d.week.sets_target : 0, text: `${d.week.sets} / ${d.week.sets_target}` },
  ];
  return (
    <div className="page fade-in">
      <header className="page-head">
        <div><p className="eyebrow">{fmtDay(d.today)}</p><h1>{hello}{d.name && d.name !== 'Athlète' ? `, ${d.name}` : ''}</h1></div>
        <Link to="/coach" className={`pill recovery ${d.recovery.score >= 75 ? 'good' : d.recovery.score >= 55 ? 'mid' : 'low'}`} title="Récupération estimée"><Icon name="bolt" size={14} />Récup. {d.recovery.score}</Link>
      </header>

      <section className="hero card">
        <div className="hero-glow" />
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

      <section className="card week-rings">
        <ActivityRings size={156} rings={rings.map((r) => ({ value: r.value, grad: r.grad }))}
          center={<><b>{Math.round(rings.reduce((a, r) => a + Math.min(1, r.value), 0) / rings.length * 100)}%</b><small>semaine</small></>} />
        <ul className="ring-legend">
          {rings.map((r) => (
            <li key={r.label}>
              <i style={{ background: `linear-gradient(135deg, ${GRADS[r.grad][0]}, ${GRADS[r.grad][1]})` }} />
              <span>{r.label}</span>
              <b>{r.text}</b>
            </li>
          ))}
        </ul>
        <p className="muted small week-line">{n0(d.week.volume_lbs)} lbs soulevées · {dur(d.week.training_minutes * 60)} de muscu{d.week.cardio_sessions ? ` · ${d.week.cardio_sessions} cardio` : ''}{d.week.cardio_kcal ? ` · ≈ ${n0(d.week.cardio_kcal)} kcal en cardio` : ''}</p>
      </section>

      <div className="grid-2col">
        <BodyCard body={d.body} nutrition={d.nutrition} />
        <Card title="Objectifs" icon="target" action={<Link className="link" to="/objectifs">Gérer</Link>}>
          {d.goals.length ? (
            <ul className="goals">{d.goals.map((g) => (
              <li key={g.id}>
                <div className="row-between"><b>{g.title}</b><span className={`small ${g.reached ? 'ok-text' : 'muted'}`}>{g.reached ? 'Atteint' : `${g.current_value == null ? '—' : Number(g.current_value).toLocaleString('fr-FR')} / ${Number(g.target_value).toLocaleString('fr-FR')} ${g.unit || ''}`}</span></div>
                <div className={`bar ${g.reached ? 'done' : ''}`}><span style={{ width: `${Math.round((g.progress || 0) * 100)}%` }} /></div>
              </li>
            ))}</ul>
          ) : <Empty icon="target" title="Aucun objectif"><Link className="btn sm" to="/objectifs">Créer un objectif</Link></Empty>}
        </Card>
      </div>

      <div className="grid-2col">
        <Card title="Dernière séance" icon="dumbbell" action={d.last_workout && <Link className="link" to={`/historique/${d.last_workout.id}`}>Détails</Link>}>
          {d.last_workout ? (
            <div className="last">
              <h3>{d.last_workout.name}{d.last_workout.focus ? ` — ${d.last_workout.focus}` : ''}</h3>
              <p className="muted small">{fmtDay(d.last_workout.date)} · {relDay(d.last_workout.date, d.today)}</p>
              <div className="kv"><span>{dur(d.last_workout.duration_sec)}</span><span>{d.last_workout.sets_done} séries</span><span>{n0(d.last_workout.volume_lbs)} lbs</span>{d.last_workout.rpe && <span>RPE {d.last_workout.rpe}</span>}</div>
            </div>
          ) : <Empty icon="dumbbell" title="Aucune séance pour l’instant">Lance ta première séance, elle apparaîtra ici.</Empty>}
          {d.last_cardio && <p className="muted small mt">Dernier cardio : {d.last_cardio.custom_name || CARDIO[d.last_cardio.activity]}, {mins(d.last_cardio.duration_min)} · {fmtDate(d.last_cardio.date)}</p>}
        </Card>

        <Card title="Calendrier" icon="calendar" action={<Link className="link" to="/calendrier">Ouvrir</Link>}>
          <div className="strip">
            {days.map((day) => {
              const ev = d.calendar.events.filter((e) => e.date === day);
              const done = d.calendar.done.filter((x) => x.date === day);
              const w = ev.find((e) => e.type === 'workout'); const rest = ev.find((e) => e.type === 'rest'); const c = ev.find((e) => e.type === 'cardio');
              return (
                <Link to={`/calendrier?d=${day}`} key={day} className={`strip-day ${day === d.today ? 'today' : ''} ${day < d.today ? 'past' : ''}`}>
                  <span className="dow">{fmtDate(day, { weekday: 'narrow' })}</span>
                  <span className="dom">{Number(day.slice(8))}</span>
                  <span className="dots">
                    {done.some((x) => x.t === 'workout') ? <i className="dot lime" /> : w ? <i className="dot ring-lime" title={w.day_name} /> : null}
                    {done.some((x) => x.t === 'cardio') ? <i className="dot mint" /> : c ? <i className="dot ring-mint" /> : null}
                    {rest && !w && <i className="dot grey" />}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="legend small muted"><span><i className="dot lime" />Muscu faite</span><span><i className="dot ring-lime" />Prévue</span><span><i className="dot mint" />Cardio</span><span><i className="dot grey" />Repos</span></div>
        </Card>
      </div>

      <Link to="/bilan" className="recap-link card"><Icon name="chart" size={20} /><span className="grow"><b>Bilan de la semaine</b><span className="muted small">Séances, volume, records, à partager en story</span></span><Icon name="right" size={18} /></Link>
      <div className="grid-2col">
        <Card title="Progression des charges" icon="up" action={<Link className="link" to="/progres">Graphiques</Link>}>
          {d.progression.length ? (
            <ul className="prog-list">
              {d.progression.map((p) => {
                const delta = p.last - p.first; const good = p.assisted ? delta < 0 : delta > 0;
                return (
                  <li key={p.exercise_id}>
                    <div><b>{p.name}</b><span className="muted small">{p.first} → {p.last} {p.unit}{p.assisted ? ' (assist.)' : ''}</span></div>
                    <div className="spark"><Spark points={p.points} color={good ? COLORS.lime : COLORS.blue} /></div>
                    <span className={`delta ${good ? 'pos' : delta === 0 ? '' : 'neg'}`}>{delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10}</span>
                  </li>
                );
              })}
            </ul>
          ) : <Empty icon="chart" title="Pas encore de données">Tes courbes apparaîtront après quelques séances.</Empty>}
        </Card>

        <Card title="Historique des performances" icon="trophy">
          {d.records.length > 0 && (
            <ul className="records">{d.records.map((r, i) => <li key={i}><Icon name="trophy" size={14} className="gold" /><span><b>{r.name}</b> : {r.previous} → {r.weight} {r.unit}{r.assisted ? ' d’assistance' : ''}</span><span className="muted small">{fmtDate(r.date)}</span></li>)}</ul>
          )}
          {d.recent_workouts.length ? (
            <ul className="history">{d.recent_workouts.map((w) => (
              <li key={w.id}><Link to={`/historique/${w.id}`}><span><b>{w.name}</b> <span className="muted">{w.focus}</span></span><span className="muted small">{fmtDate(w.date)} · {w.sets_done} séries · {n0(w.volume_lbs)} lbs</span></Link></li>
            ))}</ul>
          ) : <p className="muted small">Ton historique s’affichera ici.</p>}
        </Card>
      </div>

    </div>
  );
}

// Corps : poids lissé (source : pesées), variation sur 4 semaines, cure en cours
function BodyCard({ body, nutrition }) {
  const f1 = (v) => (v == null ? '—' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }));
  return (
    <Card title="Corps" icon="scale" action={<Link className="link" to="/corps">{body ? 'Détails' : 'Ajouter'}</Link>}>
      {body ? (<>
        <div className="body-line">
          <div><b className="big">{f1(body.weight)}<small> kg</small></b>
            <span className="muted small">{body.source === 'pesee' ? `moyenne 7 jours · dernière pesée ${f1(body.last)} kg${body.days_ago ? `, il y a ${body.days_ago} j` : ', aujourd’hui'}` : 'poids du profil, ajoute une pesée'}</span></div>
          {body.change_28d != null && <span className={`delta ${body.change_28d === 0 ? '' : body.change_28d > 0 ? 'up' : 'down'}`}>{body.change_28d > 0 ? '+' : ''}{f1(body.change_28d)} kg <small>en 4 sem.</small></span>}
        </div>
        {body.points.length > 1 && <div className="spark wide"><Spark points={body.points} color={COLORS.mint} /></div>}
        {body.waist && <p className="muted small">Tour de taille : {f1(body.waist.value)} cm ({fmtDate(body.waist.date, { day: 'numeric', month: 'short' })})</p>}
      </>) : <Empty icon="user" title="Pas encore de pesée">Ta pesée alimente l’objectif de poids, les calories et l’analyse corporelle.</Empty>}
      {nutrition && <Link to="/corps" className="nut-inline"><Icon name="flame" size={16} /><span className="grow"><b className="small">{nutrition.label} · semaine {nutrition.week}/{nutrition.weeks}</b><span className="muted small">{nutrition.kcal.toLocaleString('fr-FR')} kcal · {nutrition.protein_g} g de protéines{nutrition.check !== 'ok' && nutrition.check !== 'data' ? ' · ajustement proposé' : ''}</span></span><Icon name="right" size={16} /></Link>}
    </Card>
  );
}
