import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, Page, Card, Stat, Icon, Sheet, Field, NumInput, Chips, Loading, Empty, Confirm, useToast } from '../components/ui.jsx';
import { BarChart, COLORS } from '../components/charts.jsx';
import { post, put, del, postOrQueue, uid, today } from '../lib/api.js';
import { CARDIO, CARDIO_ICON, fmtDate, mins, n1, n0, DAY_LONG, weekStart, addDays } from '../lib/format.js';

const EMPTY = () => ({ activity: 'marche_inclinee', date: today(), duration_min: null, distance_km: null, speed_kmh: null, incline_pct: null, calories: null, avg_hr: null, max_hr: null, rpe: 4, notes: '', custom_name: '' });

export default function Cardio() {
  const list = useApi('/cardio?limit=60');
  const prog = useApi('/program');
  const stats = useApi('/stats/overview?weeks=8');
  const [form, setForm] = useState(null); const [confirm, setConfirm] = useState(null); const toast = useToast();
  const ws = weekStart(today());
  const week = (list.data || []).filter((c) => c.date >= ws && c.date <= addDays(ws, 6));
  const [sp, setSp] = useSearchParams();
  useEffect(() => { if (sp.get('ajout')) { setForm(EMPTY()); setSp({}, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const reloadAll = () => { list.reload(); stats.reload(); };
  const WDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const planned = prog.data ? WDS.flatMap((wd) => { const day = prog.data.days.find((d) => d.code === prog.data.schedule?.[wd]); return day ? day.cardio.map((c) => ({ wd, day, c })) : []; }) : [];
  const plannedMin = planned.reduce((a, x) => a + x.c.duration_min, 0);
  return (
    <Page back="/programme" title="Cardio" actions={<button className="btn primary sm" onClick={() => setForm(EMPTY())}><Icon name="plus" size={16} />Ajouter</button>}>
      <div className="stats-grid">
        <Stat icon="timer" label="Cette semaine" value={mins(week.reduce((a, c) => a + c.duration_min, 0))} hint={`${week.length} séance(s)`} tone="mint" />
        <Stat icon="flame" label={week.every((c) => !c.calories_estimated) && week.length ? 'Calories (montre)' : week.some((c) => !c.calories_estimated) ? 'Calories (en partie estimées)' : 'Calories (estimées)'} value={`${week.some((c) => c.calories_estimated) ? '≈ ' : ''}${n0(week.reduce((a, c) => a + (c.calories || 0), 0))}`} unit="kcal" tone="orange" />
        <Stat icon="right" label="Distance" value={n1(week.reduce((a, c) => a + (c.distance_km || 0), 0))} unit="km" />
        <Stat icon="target" label="Prévu / semaine" value={prog.data ? mins(plannedMin) : '—'} hint={planned.length ? `${planned.length} séance(s) du programme` : 'aucun cardio prévu'} />
      </div>

      {prog.data && (planned.length ? (
        <Card title="Prévu dans ton programme" icon="calendar" action={<Link className="link" to="/programme">Programme</Link>}>
          <ul className="plan-list">{planned.map((x, i) => (
            <li key={i}><span className="plan-ic">{CARDIO_ICON[x.c.activity]}</span><div><b>{DAY_LONG[x.wd]} · {x.c.label} {x.c.duration_min} min</b><span className="muted small">{x.day.exercises.length ? `après ${x.day.name}` : x.day.name}{x.c.notes ? ` · ${x.c.notes}` : ''}</span></div></li>
          ))}</ul>
          <p className="muted small">Le cardio fait partie de tes séances : il se valide pendant la séance, comme un exercice.</p>
        </Card>
      ) : <Card title="Pas de cardio dans ton programme" icon="heart"><p className="small">Le créateur de programme peut l’intégrer à tes séances selon ton objectif.</p><Link className="btn sm" to="/programme/creer">Ajouter du cardio au programme</Link></Card>)}

      {stats.data && <Card title="Minutes de cardio par semaine" icon="chart">
        <BarChart height={160} labels={stats.data.weekly.map((w) => fmtDate(w.week, { day: 'numeric', month: 'short' }))} series={[{ label: 'Minutes', data: stats.data.weekly.map((w) => w.cardio_minutes), color: COLORS.mint }]} />
      </Card>}

      <Card title="Historique" icon="heart">
        {!list.data ? <Loading /> : list.data.length ? (
          <ul className="cardio-list">{list.data.map((c) => (
            <li key={c.id} onClick={() => setForm({ ...c })}>
              <span className="plan-ic">{CARDIO_ICON[c.activity]}</span>
              <div className="grow"><b>{c.custom_name || CARDIO[c.activity]}</b>
                <span className="muted small">{fmtDate(c.date)} · {mins(c.duration_min)}{c.distance_km ? ` · ${n1(c.distance_km)} km` : ''}{c.speed_kmh ? ` · ${n1(c.speed_kmh)} km/h` : ''}{c.incline_pct ? ` · ${c.incline_pct} %` : ''}{c.avg_hr ? ` · ${c.avg_hr} bpm` : ''}</span></div>
              <span className="kcal" title={c.calories_estimated ? 'Estimation (formules ACSM / MET), ±20 %' : 'Valeur saisie (montre, machine)'}>{c.calories_estimated ? '≈ ' : ''}{n0(c.calories)}<small> kcal</small></span>
            </li>
          ))}</ul>
        ) : <Empty icon="heart" title="Aucune séance cardio">Ajoute ta première séance avec le bouton « Ajouter ».</Empty>}
      </Card>

      <CardioForm value={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reloadAll(); }} onDelete={(c) => setConfirm(c)} />
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger title="Supprimer cette séance cardio ?" confirmLabel="Supprimer" text="Elle sera retirée de l’historique et des statistiques."
        onConfirm={async () => { try { await del(`/cardio/${confirm.id}`); setForm(null); reloadAll(); toast('Séance supprimée'); } catch (e) { toast(e.message, 'err'); } }} />
    </Page>
  );
}

// Cardio dans la page Programme : ce qui est prévu cette semaine, ce qui est fait (tout cardio noté compte), et ajout au programme
export function CardioWeek({ prog, day, onChanged }) {
  const ws = weekStart(today()); const t = today();
  const recent = useApi(`/cardio?from=${addDays(t, -35)}`);
  const [form, setForm] = useState(null); const [confirm, setConfirm] = useState(null); const toast = useToast();
  if (!recent.data) return null;
  const WDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const week = recent.data.filter((c) => c.date >= ws && c.date <= addDays(ws, 6));
  const planned = WDS.flatMap((wd, i) => { const d = prog.days.find((x) => x.code === prog.schedule?.[wd]); const date = addDays(ws, i); return d ? d.cardio.map((c) => ({ date, wd, d, c, done: week.some((s) => s.date === date) })) : []; });
  const plannedMin = planned.reduce((a, x) => a + x.c.duration_min, 0); const doneMin = week.reduce((a, c) => a + c.duration_min, 0);
  // Suggestion à partir de ce que tu fais déjà (activité la plus fréquente, durée moyenne)
  const freq = {}; recent.data.forEach((c) => { (freq[c.activity] ||= []).push(c); });
  const top = Object.entries(freq).filter(([a]) => a !== 'autre').sort((a, b) => b[1].length - a[1].length)[0];
  const sugg = top ? { activity: top[0], duration_min: Math.max(10, Math.round(top[1].reduce((a, c) => a + c.duration_min, 0) / top[1].length / 5) * 5),
    speed_kmh: top[1][0].speed_kmh ?? null, incline_pct: top[1][0].incline_pct ?? null, placement: 'fin' } : null;
  const addToDay = async () => { try { await post(`/program/days/${day.id}/cardio`, sugg); toast(`${CARDIO[sugg.activity]} ${sugg.duration_min} min ajoutée à ${day.name}`); onChanged?.(); } catch (e) { toast(e.message, 'err'); } };
  const reload = () => { recent.reload(); onChanged?.(); };
  return (
    <section className="card cw">
      <div className="card-head"><h2><Icon name="heart" size={16} />Cardio de la semaine</h2><button className="btn sm primary" onClick={() => setForm(EMPTY())}><Icon name="plus" size={14} />Noter</button></div>
      <div className="cw-bar"><div className="cw-fill" style={{ width: `${plannedMin ? Math.min(100, doneMin / plannedMin * 100) : doneMin ? 100 : 0}%` }} /></div>
      <p className="small"><b>{mins(doneMin)}</b> faites{plannedMin ? <> sur <b>{mins(plannedMin)}</b> prévues</> : ''} · {week.length} séance{week.length > 1 ? 's' : ''}{week.some((c) => c.calories) ? ` · ≈ ${n0(week.reduce((a, c) => a + (c.calories || 0), 0))} kcal` : ''}</p>
      {(planned.length > 0 || week.length > 0) && <ul className="cw-list">
        {planned.map((x, i) => <li key={`p${i}`} className={x.done ? 'done' : x.date < t ? 'missed' : ''}><span className="cw-ic">{x.done ? <Icon name="check" size={14} /> : CARDIO_ICON[x.c.activity]}</span>
          <span className="grow"><b>{DAY_LONG[x.wd]}</b> · {x.c.label} {x.c.duration_min} min<span className="muted xs"> · {x.d.exercises.length ? `après ${x.d.name}` : x.d.name}</span></span></li>)}
        {week.filter((c) => !planned.some((x) => x.date === c.date)).map((c) => <li key={c.id} className="done extra" onClick={() => setForm({ ...c })}><span className="cw-ic"><Icon name="check" size={14} /></span>
          <span className="grow"><b>{DAY_LONG[WDS[(new Date(`${c.date}T12:00:00`).getDay() + 6) % 7]]}</b> · {c.custom_name || CARDIO[c.activity]} {mins(c.duration_min)}<span className="muted xs"> · hors programme, compté</span></span></li>)}
      </ul>}
      {!planned.length && sugg && day && <button className="btn block mt-s" onClick={addToDay}><Icon name="plus" size={14} />Mettre {CARDIO[sugg.activity].toLowerCase()} {sugg.duration_min} min dans {day.name}</button>}
      <Link className="link small" to="/cardio">Historique et statistiques cardio</Link>
      <CardioForm value={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} onDelete={(c) => setConfirm(c)} />
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger title="Supprimer cette séance cardio ?" confirmLabel="Supprimer" text="Elle sera retirée de l’historique et des statistiques."
        onConfirm={async () => { try { await del(`/cardio/${confirm.id}`); setForm(null); reload(); toast('Séance supprimée'); } catch (e) { toast(e.message, 'err'); } }} />
    </section>
  );
}

function CardioForm({ value, onClose, onSaved, onDelete }) {
  const [f, setF] = useState(null); const [est, setEst] = useState(null); const [busy, setBusy] = useState(false); const toast = useToast();
  useEffect(() => { setF(value ? { ...value, calories: value.id && value.calories_estimated ? null : value.calories } : null); }, [value]);
  useEffect(() => {
    if (!f?.duration_min) { setEst(null); return; }
    const t = setTimeout(() => {
      const speed = f.speed_kmh ?? (f.distance_km && f.duration_min ? f.distance_km / (f.duration_min / 60) : null);
      post('/cardio/estimate', { activity: f.activity, duration_min: f.duration_min, speed_kmh: speed, incline_pct: f.incline_pct, rpe: f.rpe }).then(setEst).catch(() => setEst(null));
    }, 300);
    return () => clearTimeout(t);
  }, [f?.activity, f?.duration_min, f?.speed_kmh, f?.distance_km, f?.incline_pct, f?.rpe]);
  if (!f) return null;
  const set = (x) => setF({ ...f, ...x });
  const showIncline = ['marche', 'marche_inclinee', 'course', 'autre'].includes(f.activity);
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f }; delete body.id;
      if (f.id) await put(`/cardio/${f.id}`, body);
      else { const r = await postOrQueue('/cardio', { ...body, client_id: uid() }); if (r.queued) toast('Hors ligne : séance gardée pour synchronisation', 'warn'); }
      toast('Séance cardio enregistrée'); onSaved();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={f.id ? 'Modifier la séance' : 'Nouvelle séance cardio'}
      footer={<>{f.id && <button className="btn ghost danger-text" onClick={() => onDelete(f)}><Icon name="trash" size={16} /></button>}<button className="btn primary" disabled={busy || !f.duration_min} onClick={save}>{busy ? '…' : 'Enregistrer'}</button></>}>
      <Field label="Activité"><Chips single value={f.activity} onChange={(v) => set({ activity: v })} options={Object.entries(CARDIO).map(([k, l]) => [k, l])} /></Field>
      {f.activity === 'autre' && <Field label="Nom de l’activité"><input value={f.custom_name || ''} onChange={(e) => set({ custom_name: e.target.value })} placeholder="Natation, corde à sauter…" /></Field>}
      <div className="grid2">
        <Field label="Date"><input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Durée (min) *"><NumInput value={f.duration_min} onChange={(v) => set({ duration_min: v })} /></Field>
        <Field label="Distance (km)"><NumInput value={f.distance_km} onChange={(v) => set({ distance_km: v })} /></Field>
        <Field label="Vitesse (km/h)"><NumInput value={f.speed_kmh} onChange={(v) => set({ speed_kmh: v })} placeholder={f.distance_km && f.duration_min ? n1(f.distance_km / (f.duration_min / 60)) : ''} /></Field>
        {showIncline && <Field label="Inclinaison (%)"><NumInput value={f.incline_pct} onChange={(v) => set({ incline_pct: v })} /></Field>}
        <Field label="Calories" hint={est ? `Estimation : ${est.calories} kcal${est.default_weight_used ? ' (poids par défaut 75 kg — renseigne ton poids dans le profil)' : ''}` : 'Laisse vide pour une estimation automatique'}>
          <NumInput value={f.calories} onChange={(v) => set({ calories: v })} placeholder={est ? String(est.calories) : 'auto'} /></Field>
        <Field label="FC moyenne (bpm)"><NumInput value={f.avg_hr} onChange={(v) => set({ avg_hr: v })} placeholder="si dispo" /></Field>
        <Field label="FC max (bpm)"><NumInput value={f.max_hr} onChange={(v) => set({ max_hr: v })} placeholder="si dispo" /></Field>
      </div>
      <Field label={`Intensité ressentie : ${f.rpe ?? '—'}/10`} hint="3-4 : tu peux parler (zone 2) · 6-7 : soutenu · 9-10 : maximal">
        <input type="range" min="1" max="10" value={f.rpe ?? 4} onChange={(e) => set({ rpe: Number(e.target.value) })} />
      </Field>
      <Field label="Notes"><textarea rows={2} value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
    </Sheet>
  );
}
