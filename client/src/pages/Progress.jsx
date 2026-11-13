import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, Page, Card, Segmented, Field, Loading, Empty, Icon } from '../components/ui.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';
import { LineChart, BarChart, COLORS } from '../components/charts.jsx';
import { Badge3D } from '../components/Art3D.jsx';
import { get, today } from '../lib/api.js';
import { fmtDate, n0, n1, mins, dur, addDays, CARDIO, CARDIO_ICON } from '../lib/format.js';

export default function Progress() {
  const [tab, setTab] = useState('overview');
  return (
    <Page tabs={<SectionTabs group="progress" />} title="Progrès">
      <Segmented value={tab} onChange={setTab} options={[['overview', 'Vue globale'], ['exercise', 'Exercices'], ['compare', 'Comparer'], ['history', 'Historique']]} />
      <div className="mt">
        {tab === 'overview' && <Overview />}
        {tab === 'exercise' && <ExerciseTab />}
        {tab === 'compare' && <Compare />}
        {tab === 'history' && <History />}
      </div>
    </Page>
  );
}

const LIFT_COLORS = [COLORS.lime, COLORS.blue, COLORS.mint, COLORS.violet, COLORS.pink];
const ZONE = { bas: 'Trop peu', correct: 'Entretien', optimal: 'Idéal', haut: 'Beaucoup' };
const BADGE_LOOK = { first: ['first', 'mint'], s10: ['w10', 'coral'], s50: ['w10', 'violet'], s100: ['w10', 'gold'], w4: ['streak', 'coral'], w12: ['streak', 'gold'], pr1: ['record', 'gold'], pr25: ['record', 'violet'],
  t100k: ['bolt', 'cyan'], t1m: ['bolt', 'gold'], c20: ['km42', 'cyan'], c1000: ['km42', 'violet'], weigh30: ['bolt', 'mint'], early: ['bolt', 'coral'], goal: ['first', 'gold'] };

function Overview() {
  const [weeks, setWeeks] = useState(12);
  const { data } = useApi(`/stats/progress?weeks=${weeks}`);
  const old = useApi('/stats/overview?weeks=4&months=6');
  const badges = useApi('/badges');
  if (!data) return <Loading />;
  const wl = data.weeks.map((w) => fmtDate(w, { day: 'numeric', month: 'short' }));
  const k = data.kpi;
  return (<>
    <div className="kpis">
      <div className="kpi"><b>{k.streak_weeks}</b><span>semaine{k.streak_weeks > 1 ? 's' : ''} d’affilée</span></div>
      <div className="kpi"><b>{n1(k.sessions_per_week)}{k.target_per_week ? <small>/{k.target_per_week}</small> : null}</b><span>séances / sem. (4 sem.)</span></div>
      <div className="kpi"><b>{k.records_30d}</b><span>records en 30 j</span></div>
      <div className="kpi"><b>{k.workouts}</b><span>séances au total</span></div>
    </div>
    <div className="row-between mt"><span className="muted small">Période</span><Segmented value={weeks} onChange={setWeeks} options={[[8, '8 sem.'], [12, '12 sem.'], [26, '6 mois']]} /></div>

    <Card title="Ta force progresse-t-elle ?" icon="up">
      {data.lifts.length ? (<>
        <p className="muted small">1RM estimé de tes exercices les plus pratiqués, en % par rapport au début de la période. Une courbe qui monte = tu deviens plus fort.</p>
        <LineChart labels={wl} series={data.lifts.map((l, i) => ({ label: l.name, data: l.pct, color: LIFT_COLORS[i] }))} yTitle="%" />
        <ul className="lift-list">{data.lifts.map((l, i) => (
          <li key={l.id}><i style={{ background: LIFT_COLORS[i] }} /><span className="grow">{l.name}</span>
            <span className="muted small">1RM ≈ {n0(l.now)} lbs</span><b className={l.gain_pct > 0 ? 'pos' : l.gain_pct < 0 ? 'neg' : ''}>{l.gain_pct == null ? '—' : `${l.gain_pct > 0 ? '+' : ''}${l.gain_pct} %`}</b></li>
        ))}</ul>
      </>) : <Empty icon="chart" title="Pas encore assez de séances">La courbe apparaît dès 2 séances sur un même exercice avec charge.</Empty>}
    </Card>

    <Card title="Séries par muscle et par semaine" icon="body">
      <p className="muted small">Moyenne des 4 dernières semaines. La bande verte est la zone idéale pour ton niveau ({data.range.low} à {data.range.high} séries).</p>
      <ul className="mbars">{[...data.muscles].sort((a, b) => b.sets - a.sets).map((m) => {
        const max = Math.max(data.range.high + 4, ...data.muscles.map((x) => x.sets));
        return (
          <li key={m.key}><span className="mb-l">{m.label}</span>
            <span className="mb-track"><span className="mb-band" style={{ left: `${data.range.low / max * 100}%`, width: `${(data.range.high - data.range.low) / max * 100}%` }} />
              <span className={`mb-bar ${m.zone}`} style={{ width: `${Math.min(100, m.sets / max * 100)}%` }} /></span>
            <span className="mb-v">{n1(m.sets)}</span><span className={`mb-z ${m.zone}`}>{ZONE[m.zone]}</span></li>
        );
      })}</ul>
    </Card>

    <Card title="Régularité (6 mois)" icon="calendar">
      <Heat heat={data.heat} />
      <p className="muted small mt-s"><span className="hl l1" /> cardio <span className="hl l2" /> muscu <span className="hl l3" /> muscu + cardio</p>
    </Card>

    <div className="grid-2col">
      <Card title="Volume par semaine (lbs × reps)" icon="flame"><BarChart labels={wl} series={[{ label: 'Volume', data: data.weekly.map((w) => w.volume_lbs), color: COLORS.orange }]} /></Card>
      <Card title="Séances et records" icon="dumbbell"><BarChart labels={wl} series={[{ label: 'Séances', data: data.weekly.map((w) => w.workouts), color: COLORS.lime }, { label: 'Records', data: data.records_by_week, color: COLORS.orange }]} /></Card>
    </div>

    {badges.data && <Card title={`Trophées · ${badges.data.list.filter((b) => b.earned).length}/${badges.data.list.length}`} icon="trophy">
      <div className="badge-grid">{badges.data.list.map((b) => {
        const [glyph, tone] = BADGE_LOOK[b.id] || ['record', 'violet'];
        return (
          <div key={b.id} className={`badge-cell ${b.earned ? '' : 'locked'}`} title={b.text}>
            <Badge3D unlocked={b.earned} glyph={glyph} tone={tone} size={64} label={b.label} />
            <b className="small">{b.label}</b>
            {!b.earned && <span className="badge-prog"><span style={{ width: `${b.value / b.target * 100}%` }} /></span>}
            <span className="muted xs">{b.earned ? b.text : `${n0(b.value)} / ${n0(b.target)}`}</span>
          </div>
        );
      })}</div>
    </Card>}

    {old.data?.records.length > 0 && <Card title="Records récents" icon="trophy"><ul className="records">{old.data.records.map((r, i) => <li key={i}><Icon name="trophy" size={14} className="gold" /><span><b>{r.name}</b> : {r.previous} → {r.weight} {r.unit}</span><span className="muted small">{fmtDate(r.date)}</span></li>)}</ul></Card>}
  </>);
}

// Carte de chaleur : une colonne par semaine, une case par jour
function Heat({ heat }) {
  const cols = []; let d = heat.from;
  while (d <= heat.to) { const col = []; for (let i = 0; i < 7; i++) { col.push(d); d = addDays(d, 1); } cols.push(col); }
  return (
    <div className="heat">{cols.map((c, i) => <div key={i} className="heat-col">{c.map((x) => {
      const v = heat.days[x] || 0; const lvl = x > heat.to ? 'future' : v >= 3 ? 'l3' : v >= 2 ? 'l2' : v >= 1 ? 'l1' : '';
      return <span key={x} className={`heat-cell ${lvl}`} title={`${fmtDate(x)}${v ? '' : ' · repos'}`} />;
    })}</div>)}</div>
  );
}

function ExerciseTab() {
  const ov = useApi('/stats/overview?weeks=4');
  const program = useApi('/program');
  const [id, setId] = useState(null); const [data, setData] = useState(null);
  const options = (() => {
    const seen = new Map();
    for (const e of ov.data?.exercises || []) seen.set(e.id, `${e.name} (${e.sessions} séance${e.sessions > 1 ? 's' : ''})`);
    for (const d of program.data?.days || []) for (const e of d.exercises) if (!seen.has(e.exercise_id)) seen.set(e.exercise_id, e.name);
    return [...seen.entries()];
  })();
  useEffect(() => { if (!id && options.length) setId(options[0][0]); }, [options.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (id) { setData(null); get(`/stats/exercise/${id}`).then(setData); } }, [id]);
  if (!ov.data || !program.data) return <Loading />;
  const pts = data?.points || []; const labels = pts.map((p) => fmtDate(p.date, { day: 'numeric', month: 'short' }));
  const assisted = data?.exercise.kind === 'assisted';
  return (<>
    <Field label="Exercice"><select value={id || ''} onChange={(e) => setId(Number(e.target.value))}>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
    {!data ? <Loading /> : !pts.length ? <Empty icon="chart" title="Pas encore de données pour cet exercice">Elles apparaîtront après ta première séance.</Empty> : (<>
      {assisted && <p className="tip"><Icon name="info" size={14} />Exercice assisté : une courbe qui descend = tu progresses (moins d’assistance).</p>}
      <div className="grid-2col">
        <Card title={assisted ? 'Assistance utilisée' : 'Évolution des charges'} icon="up">
          <LineChart labels={labels} series={[{ label: `${assisted ? 'Assistance' : 'Meilleure charge'} (${pts[0].unit})`, data: pts.map((p) => p.top_weight), color: COLORS.lime, fill: true },
            ...(pts.some((p) => p.e1rm) ? [{ label: '1RM estimé', data: pts.map((p) => p.e1rm), color: COLORS.violet }] : [])]} />
        </Card>
        <Card title="Évolution des répétitions" icon="chart">
          <LineChart labels={labels} beginAtZero series={[{ label: 'Meilleure série', data: pts.map((p) => p.best_reps), color: COLORS.blue }, { label: 'Moyenne / série', data: pts.map((p) => p.avg_reps), color: COLORS.pink }]} />
        </Card>
      </div>
      <Card title="Détail par séance">
        <table className="sets-table"><thead><tr><th>Date</th><th>{assisted ? 'Assist.' : 'Charge'}</th><th>Reps tot.</th><th>Volume</th></tr></thead>
          <tbody>{[...pts].reverse().map((p, i) => <tr key={i}><td>{fmtDate(p.date)}</td><td>{p.top_weight ?? 'PDC'} {p.top_weight != null ? p.unit : ''}</td><td>{p.total_reps}</td><td>{n0(p.volume)}</td></tr>)}</tbody></table>
      </Card>
    </>)}
  </>);
}

const presets = (t) => {
  const d = new Date(t + 'T12:00:00');
  const mStart = t.slice(0, 8) + '01';
  const pm = new Date(d.getFullYear(), d.getMonth() - 1, 1); const pmEnd = new Date(d.getFullYear(), d.getMonth(), 0);
  const isoD = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return {
    m: { label: 'Ce mois vs mois dernier', a: [isoD(pm), isoD(pmEnd)], b: [mStart, t] },
    w4: { label: '4 dernières sem. vs 4 précédentes', a: [addDays(t, -55), addDays(t, -28)], b: [addDays(t, -27), t] },
    w1: { label: 'Cette semaine vs précédente', a: [addDays(t, -13), addDays(t, -7)], b: [addDays(t, -6), t] },
  };
};

function Compare() {
  const t = today(); const P = presets(t);
  const [range, setRange] = useState({ a: P.w4.a, b: P.w4.b }); const [data, setData] = useState(null);
  useEffect(() => { setData(null); get(`/stats/compare?aFrom=${range.a[0]}&aTo=${range.a[1]}&bFrom=${range.b[0]}&bTo=${range.b[1]}`).then(setData).catch(() => setData({ error: true })); }, [range]);
  const rows = [['Séances muscu', 'workouts', n0], ['Séances / semaine', 'workouts_per_week', n1], ['Temps de muscu', 'training_minutes', (v) => dur(v * 60)], ['Séries validées', 'sets', n0], ['Répétitions', 'reps', n0], ['Volume (lbs)', 'volume_lbs', n0], ['RPE moyen', 'avg_rpe', n1], ['Séances cardio', 'cardio_sessions', n0], ['Minutes cardio', 'cardio_minutes', mins], ['Distance cardio (km)', 'cardio_km', n1]];
  const delta = (a, b) => (a == null || b == null ? null : a === 0 ? (b > 0 ? 100 : 0) : Math.round(((b - a) / a) * 100));
  return (<>
    <div className="chips">{Object.entries(P).map(([k, p]) => <button key={k} className={`chip ${range.a[0] === p.a[0] && range.b[0] === p.b[0] ? 'on' : ''}`} onClick={() => setRange({ a: p.a, b: p.b })}>{p.label}</button>)}</div>
    <div className="grid2 mt-s">
      <Card title="Période A"><div className="grid2"><input type="date" value={range.a[0]} onChange={(e) => setRange({ ...range, a: [e.target.value, range.a[1]] })} /><input type="date" value={range.a[1]} onChange={(e) => setRange({ ...range, a: [range.a[0], e.target.value] })} /></div></Card>
      <Card title="Période B"><div className="grid2"><input type="date" value={range.b[0]} onChange={(e) => setRange({ ...range, b: [e.target.value, range.b[1]] })} /><input type="date" value={range.b[1]} onChange={(e) => setRange({ ...range, b: [range.b[0], e.target.value] })} /></div></Card>
    </div>
    {!data ? <Loading /> : data.error ? <p className="error">Dates invalides</p> : (<>
      <Card title="Comparaison globale">
        <table className="cmp-table"><thead><tr><th /><th>A</th><th>B</th><th>Évol.</th></tr></thead>
          <tbody>{rows.map(([l, k, f]) => { const d = delta(data.a[k], data.b[k]); return <tr key={k}><td>{l}</td><td>{f(data.a[k])}</td><td><b>{f(data.b[k])}</b></td><td className={d > 0 ? 'pos' : d < 0 ? 'neg' : ''}>{d == null ? '—' : `${d > 0 ? '+' : ''}${d} %`}</td></tr>; })}</tbody></table>
      </Card>
      <Card title="Par exercice (meilleure charge)">
        {data.exercises.length ? <table className="cmp-table"><thead><tr><th>Exercice</th><th>A</th><th>B</th><th>Évol.</th></tr></thead>
          <tbody>{data.exercises.map((e) => {
            const a = e.a?.max_weight, b = e.b?.max_weight; const d = a != null && b != null ? Math.round((b - a) * 10) / 10 : null;
            const assisted = (e.a || e.b).kind === 'assisted'; const good = d != null && (assisted ? d < 0 : d > 0);
            return <tr key={e.exercise_id}><td>{e.name}</td><td>{a ?? '—'}</td><td><b>{b ?? '—'}</b></td><td className={good ? 'pos' : d ? 'neg' : ''}>{d == null ? '—' : `${d > 0 ? '+' : ''}${d}`}</td></tr>;
          })}</tbody></table> : <p className="muted">Aucune séance sur ces périodes.</p>}
      </Card>
    </>)}
  </>);
}

function History() {
  const w = useApi('/workouts?limit=500'); const c = useApi('/cardio?limit=500');
  const [filter, setFilter] = useState('all');
  if (!w.data || !c.data) return <Loading />;
  const items = [...(filter !== 'cardio' ? w.data.map((x) => ({ ...x, t: 'w' })) : []), ...(filter !== 'muscu' ? c.data.map((x) => ({ ...x, t: 'c' })) : [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return (<>
    <Segmented value={filter} onChange={setFilter} options={[['all', 'Tout'], ['muscu', 'Muscu'], ['cardio', 'Cardio']]} />
    <p className="muted small mt-s">{w.data.length} séance(s) de muscu · {c.data.length} séance(s) de cardio</p>
    {items.length ? <ul className="history full">{items.map((x) => x.t === 'w' ? (
      <li key={`w${x.id}`}><Link to={`/historique/${x.id}`}><span><i className="act">MU</i><b>{x.name}</b> <span className="muted">{x.focus}</span></span><span className="muted small">{fmtDate(x.date)} · {dur(x.duration_sec)} · {x.sets_done} séries · {n0(x.volume_lbs)} lbs</span></Link></li>
    ) : (
      <li key={`c${x.id}`}><Link to="/cardio"><span><i className="act">{CARDIO_ICON[x.activity]}</i><b>{x.custom_name || CARDIO[x.activity]}</b></span><span className="muted small">{fmtDate(x.date)} · {mins(x.duration_min)}{x.distance_km ? ` · ${n1(x.distance_km)} km` : ''} · {n0(x.calories)} kcal</span></Link></li>
    ))}</ul> : <Empty icon="chart" title="Historique vide" />}
  </>);
}
