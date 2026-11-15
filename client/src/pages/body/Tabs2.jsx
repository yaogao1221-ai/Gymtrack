import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Icon, Loading, Segmented, Field, Fold, EmbedCtx, useApi, useToast } from '../../components/ui.jsx';
import { LineChart, BarChart, COLORS } from '../../components/charts.jsx';
import { post, today } from '../../lib/api.js';
import { fmtDate, addDays, n0 } from '../../lib/format.js';

const Photos = lazy(() => import('../Photos.jsx'));
const Meals = lazy(() => import('../Meals.jsx'));
const fr = (x, d = 1) => (x == null ? '—' : Number(x).toLocaleString('fr-FR', { maximumFractionDigits: d }));
const short = (d) => fmtDate(d, { day: 'numeric', month: 'short' });
const delta = (a, b, unit = '', d = 1) => (a == null || b == null ? null : `${a - b >= 0 ? '+' : ''}${fr(a - b, d)}${unit}`);

// ---------- Comparaison de deux périodes et records ----------
export function CompareCard() {
  const [w, setW] = useState(4); const t = today();
  const bTo = t; const bFrom = addDays(t, -(w * 7 - 1)); const aTo = addDays(bFrom, -1); const aFrom = addDays(aTo, -(w * 7 - 1));
  const { data } = useApi(`/stats/compare?aFrom=${aFrom}&aTo=${aTo}&bFrom=${bFrom}&bTo=${bTo}`, [w]);
  const ov = useApi('/stats/overview?weeks=12');
  const rows = data ? [['Séances', 'workouts', 0], ['Séries validées', 'sets', 0], ['Tonnage (lbs)', 'volume_lbs', 0], ['Effort ressenti moyen', 'avg_rpe', 1], ['Cardio (min)', 'cardio_minutes', 0]] : [];
  const ex = (data?.exercises || []).filter((e) => e.a && e.b && e.a.max_weight && e.b.max_weight).map((e) => ({ ...e, ch: ((e.b.max_weight - e.a.max_weight) / e.a.max_weight) * 100 * (e.b.kind === 'assisted' ? -1 : 1) })).sort((a, b) => b.ch - a.ch);
  return (<>
    <Card title="Comparer deux périodes" icon="chart">
      <Segmented value={w} onChange={setW} options={[[4, '4 sem.'], [8, '8 sem.'], [12, '12 sem.']]} />
      {!data ? <Loading /> : <>
        <table className="ms-table mt-s"><thead><tr><th /><th>{short(aFrom)} – {short(aTo)}</th><th>{short(bFrom)} – {short(bTo)}</th></tr></thead>
          <tbody>{rows.map(([l, k, d]) => <tr key={k}><td>{l}</td><td>{fr(data.a[k], d)}</td><td><b>{fr(data.b[k], d)}</b></td></tr>)}</tbody></table>
        {ex.length > 0 ? <><h4 className="h-sub">Charge maximale par exercice</h4><ul className="ms-list">{ex.slice(0, 8).map((e) => (
          <li key={e.exercise_id}><span className="grow small"><b>{e.name}</b><span className="muted xs block">{fr(e.a.max_weight)} → {fr(e.b.max_weight)} {e.b.unit}{e.b.kind === 'assisted' ? ' d’assistance' : ''}</span></span><b className={`small ${e.ch > 0 ? 'good' : e.ch < 0 ? 'warn' : ''}`}>{e.ch > 0 ? '+' : ''}{fr(e.ch)} %</b></li>))}</ul></>
          : <p className="muted small mt-s">Aucun exercice fait sur les deux périodes : rien à comparer.</p>}
      </>}
    </Card>
    <Card title="Records récents" icon="trophy" action={<Link className="link small" to="/progres">Tous</Link>}>
      {!ov.data ? <Loading /> : ov.data.records.length ? <ul className="ms-list">{ov.data.records.map((r, i) => <li key={i}><span className="grow small"><b>{r.name}</b><span className="muted xs block">{fmtDate(r.date, { day: 'numeric', month: 'long' })}{r.previous ? ` · avant ${fr(r.previous)} ${r.unit}` : ''}</span></span><b className="small">{fr(r.weight)} {r.unit}</b></li>)}</ul>
        : <p className="muted small">Pas encore de record : ils apparaissent dès que tu dépasses ta meilleure charge sur un exercice.</p>}
    </Card>
  </>);
}

// ---------- Mensurations : saisie, courbe par mesure, photos privées ----------
const FIELDS = [['weight_kg', 'Poids', 'kg'], ['waist_cm', 'Taille', 'cm'], ['chest_cm', 'Poitrine', 'cm'], ['arm_cm', 'Bras', 'cm'], ['thigh_cm', 'Cuisse', 'cm'], ['calf_cm', 'Mollet', 'cm'], ['hip_cm', 'Hanches', 'cm']];
export function MeasuresTab() {
  const { data, reload } = useApi('/body/measures'); const toast = useToast();
  const [f, setF] = useState({ date: today() }); const [open, setOpen] = useState(false);
  const save = async () => {
    const body = { date: f.date }; for (const [k] of FIELDS) if (f[k] !== undefined && f[k] !== '') body[k] = Number(String(f[k]).replace(',', '.'));
    try { await post('/body-metrics', body); toast('Mesures enregistrées'); setF({ date: today() }); setOpen(false); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  const withData = (data || []).filter((m) => m.points.length); const without = (data || []).filter((m) => !m.points.length && m.key !== 'body_fat_pct' && m.key !== 'neck_cm');
  return (<>
    <Card title="Nouvelle mesure" icon="scale" action={<button className="btn xs" onClick={() => setOpen(!open)}>{open ? 'Fermer' : <><Icon name="plus" size={14} />Mesurer</>}</button>}>
      {open ? <>
        <Field label="Date"><input type="date" value={f.date} max={today()} onChange={(e) => e.target.value && setF({ ...f, date: e.target.value })} /></Field>
        <div className="meas-grid">{FIELDS.map(([k, l, u]) => <Field key={k} label={`${l} (${u})`}><input inputMode="decimal" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder="—" /></Field>)}</div>
        <p className="muted xs">Remplis seulement ce que tu as mesuré. Mètre ruban le matin, au même endroit à chaque fois (bras contracté au plus large, cuisse à mi-hauteur).</p>
        <button className="btn primary block" onClick={save}>Enregistrer</button>
      </> : <p className="muted small">Une mesure toutes les 2 à 4 semaines suffit pour voir la tendance.</p>}
    </Card>
    {!data ? <Loading /> : withData.map((m) => (
      <Card key={m.key} title={m.label} icon="chart" action={<span className="small"><b>{fr(m.last.v)} {m.unit}</b>{m.points.length > 1 && <span className="muted xs"> · {delta(m.last.v, m.first.v, ` ${m.unit}`)} depuis le {short(m.first.date)}</span>}</span>}>
        {m.points.length > 1 ? <LineChart height={150} labels={m.points.map((p) => short(p.date))} series={[{ label: m.label, data: m.points.map((p) => p.v), color: COLORS.lime, fill: true }]} />
          : <p className="muted small">Une seule mesure ({short(m.last.date)}) : la courbe apparaît à la deuxième.</p>}
        {m.key === 'body_fat_pct' && <p className="muted xs">Pourcentage saisi ou estimé par formule : c’est un ordre de grandeur, pas une mesure précise. Suis plutôt sa tendance.</p>}
      </Card>))}
    {data && without.length > 0 && <p className="muted small center">Pas encore de mesure : {without.map((m) => m.label.toLowerCase()).join(', ')}.</p>}
    <Fold title="Photos de progression" icon="camera" hint="restent sur ce téléphone"><EmbedCtx.Provider value><Suspense fallback={<Loading />}><Photos /></Suspense></EmbedCtx.Provider></Fold>
  </>);
}

// ---------- Nutrition : moyennes réelles, tendance de poids, repas du jour ----------
export function NutritionTab() {
  const { data } = useApi('/body/nutrition'); const d = useApi('/dashboard');
  const days = data?.days || []; const last7 = days.filter((x) => x.date >= addDays(today(), -6));
  const avg = (k) => (last7.length ? Math.round(last7.reduce((t, x) => t + x[k], 0) / last7.length) : null);
  const target = d.data?.day?.kcal; const prot = d.data?.nutrition?.protein_g;
  const low = avg('kcal') != null && last7.length >= 3 && (avg('kcal') < 1200 || (target && avg('kcal') < target * 0.75));
  return (<>
    <Card title="Ces 7 derniers jours" icon="food" action={<Link className="link small" to="/nutrition">Tout</Link>}>
      {!data ? <Loading /> : !last7.length ? <p className="muted small">Aucun repas noté cette semaine : les moyennes apparaissent dès que tu notes tes repas.</p> : <>
        <div className="ov-stats n3">
          <div><b>{n0(avg('kcal'))}</b><span className="muted xs">kcal / jour{target ? ` (objectif ${n0(target)})` : ''}</span></div>
          <div><b>{n0(avg('protein'))} g</b><span className="muted xs">protéines{prot ? ` (objectif ${prot} g)` : ''}</span></div>
          <div><b>{last7.length}/7</b><span className="muted xs">jours notés</span></div>
        </div>
        <p className="muted xs">Glucides {n0(avg('carbs'))} g · lipides {n0(avg('fat'))} g par jour en moyenne, sur les jours notés seulement.</p>
        {low && <p className="brief-warn"><Icon name="alert" size={15} />Apport très bas sur les jours notés. Une restriction forte fait perdre du muscle et de la force : vise une baisse modérée (300 à 500 kcal sous ta maintenance) et garde tes protéines.</p>}
      </>}
      {days.length > 1 && <BarChart height={150} labels={days.map((x) => short(x.date))} series={[{ label: 'kcal', data: days.map((x) => x.kcal), color: COLORS.orange }]} />}
    </Card>
    {data?.weight_weeks?.length > 1 && <Card title="Poids moyen par semaine" icon="scale">
      <LineChart height={150} labels={data.weight_weeks.map((w) => short(w.start))} series={[{ label: 'kg', data: data.weight_weeks.map((w) => w.avg), color: COLORS.lime, fill: true }]} />
      <p className="muted xs">Moyenne des pesées de chaque semaine : elle lisse les variations d’eau d’un jour à l’autre.</p>
    </Card>}
    <EmbedCtx.Provider value><Suspense fallback={<Loading />}><Meals /></Suspense></EmbedCtx.Provider>
  </>);
}

// ---------- Historique et rapports : semaine ou mois, avec la période précédente ----------
export function ReportTab() {
  const [period, setPeriod] = useState('week'); const [off, setOff] = useState(0);
  const { data } = useApi(`/body/report?period=${period}&offset=${off}`, [period, off]);
  const title = data ? (period === 'month' ? fmtDate(data.from, { month: 'long', year: 'numeric' }) : `Semaine du ${fmtDate(data.from, { day: 'numeric', month: 'long' })}`) : '';
  const c = data?.cur; const p = data?.prev;
  return (<>
    <section className="card">
      <Segmented value={period} onChange={(v) => { setPeriod(v); setOff(0); }} options={[['week', 'Semaine'], ['month', 'Mois']]} />
      <div className="row-between mt-s"><button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="Période précédente"><Icon name="left" /></button>
        <b>{title}{data?.partial ? ' (en cours)' : ''}</b>
        <button className="icon-btn" disabled={off === 0} onClick={() => setOff(Math.max(0, off - 1))} aria-label="Période suivante"><Icon name="right" /></button></div>
      {!data ? <Loading /> : data.empty ? <p className="muted mt-s">Rien d’enregistré sur cette période.</p> : <>
        <ul className="small tips-list">{data.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
        <table className="ms-table"><thead><tr><th /><th>Avant</th><th>Cette période</th></tr></thead><tbody>
          {[['Séances', 'workouts'], ['Séries', 'sets'], ['Tonnage (lbs)', 'volume_lbs'], ['Cardio (min)', 'cardio_minutes']].map(([l, k]) => <tr key={k}><td>{l}</td><td>{fr(p[k], 0)}</td><td><b>{fr(c[k], 0)}</b></td></tr>)}
        </tbody></table>
      </>}
    </section>
    {data && !data.empty && <>
      {data.regions.length > 0 && <Card title="Séries par région" icon="body">
        <BarChart height={180} labels={data.regions.map((r) => r.label)} series={[{ label: 'Cette période', data: data.regions.map((r) => r.sets), color: COLORS.lime }, { label: 'Avant', data: data.regions.map((r) => data.prev_regions.find((x) => x.region === r.region)?.sets || 0), color: COLORS.blue }]} />
        <p className="muted xs">Séries où un muscle de la région est la cible principale.</p>
      </Card>}
      <Card title="Corps et habitudes" icon="heart">
        <ul className="small tips-list">
          <li>Poids : {data.body.weight_avg != null ? `${fr(data.body.weight_avg)} kg en moyenne (${data.body.weigh_ins} pesée${data.body.weigh_ins > 1 ? 's' : ''})${data.body.weight_prev != null ? `, ${delta(data.body.weight_avg, data.body.weight_prev, ' kg')}` : ''}` : 'aucune pesée'}.</li>
          {data.body.waist != null && <li>Tour de taille : {fr(data.body.waist)} cm.</li>}
          <li>Repas notés : {data.nutrition.days_logged} jour{data.nutrition.days_logged > 1 ? 's' : ''}{data.nutrition.kcal_avg != null ? `, ${n0(data.nutrition.kcal_avg)} kcal et ${n0(data.nutrition.protein_avg)} g de protéines par jour noté` : ''}.</li>
          <li>Routines de mobilité : {data.mobility}.</li>
          {data.pains.map((x, i) => <li key={i}>Douleur {x.label.toLowerCase()}{x.side && x.side !== 'deux' ? ` (${x.side})` : ''} {x.intensity}/10 {x.resolved ? '· résolue' : x.isNew ? '· nouvelle' : '· toujours active'}.</li>)}
        </ul>
      </Card>
      {data.records.length > 0 && <Card title={`Records (${data.records.length})`} icon="trophy"><ul className="ms-list">{data.records.slice(0, 10).map((r, i) => <li key={i}><span className="grow small"><b>{r.name}</b><span className="muted xs block">{short(r.date)}{r.previous ? ` · avant ${fr(r.previous)} ${r.unit}` : ''}</span></span><b className="small">{fr(r.weight)} {r.unit}</b></li>)}</ul>
        {data.records.length > 10 && <p className="muted xs">Et {data.records.length - 10} autres.</p>}</Card>}
    </>}
    <Link to="/progres?v=bilan" className="card row gap embed-more"><span className="grow small">Bilan de la semaine à partager</span><Icon name="right" size={16} /></Link>
  </>);
}
