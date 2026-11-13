import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get, postOrQueue, uid, today } from '../lib/api.js';
import { Page, Card, Icon, Loading, ErrorBox, Field, NumInput, useToast } from '../components/ui.jsx';
import { thumb } from '../lib/exlib.js';
import { fmtDay } from '../lib/format.js';

// Séance oubliée : on part du jour de programme, tu confirmes ce que tu as vraiment fait (exercices, séries, charges),
// la date et la durée. Rien n'est marqué « fait » avant que tu enregistres.
export default function LogPast() {
  const { dayId } = useParams(); const [sp] = useSearchParams(); const nav = useNavigate(); const toast = useToast();
  const [f, setF] = useState(null); const [error, setError] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => {
    get('/program').then((prog) => {
      const day = prog.days.find((d) => String(d.id) === String(dayId)); if (!day) throw new Error('Jour de programme introuvable');
      const items = day.exercises.map((pe) => {
        const last = pe.last?.sets || [];
        return { pe_id: pe.id, exercise_id: pe.exercise_id, name: pe.name, unit: pe.weight_unit, kind: pe.kind, lib_id: pe.lib_id, target: pe.reps, on: true,
          sets: Array.from({ length: pe.sets }, (_, i) => { const l = last[i] || last.at(-1); const w = l?.weight ?? pe.target_weight ?? null; return { weight: w != null ? Math.round(w * 10) / 10 : null, reps: pe.reps ?? l?.reps ?? null }; }) };
      });
      const cardio = (day.cardio || []).map((c) => ({ pc_id: c.id, activity: c.activity, custom_name: c.custom_name, label: c.label, duration_min: c.duration_min, speed_kmh: c.speed_kmh, incline_pct: c.incline_pct, on: true }));
      const rest = 90; const est = Math.round(items.reduce((a, it) => a + it.sets.length * (40 + rest), 0) / 60 + cardio.reduce((a, c) => a + (c.duration_min || 0), 0));
      setF({ day, items, cardio, date: sp.get('date') || today(), minutes: est, rpe: null, notes: '' });
    }).catch(setError);
  }, [dayId]);
  if (error) return <ErrorBox error={error} />;
  if (!f) return <Loading />;
  const up = (fn) => setF((x) => { const y = structuredClone(x); fn(y); return y; });
  const nSets = f.items.filter((it) => it.on).reduce((a, it) => a + it.sets.length, 0);
  const nCardio = f.cardio.filter((c) => c.on).length;
  const future = f.date > today();
  const save = async () => {
    if (!nSets && !nCardio) { toast('Coche au moins un exercice ou ton cardio', 'err'); return; }
    if (!f.minutes || Number(f.minutes) <= 0) { toast('Indique combien de temps la séance a duré', 'err'); return; }
    setSaving(true);
    try {
      const cid = uid(); let wid = null;
      if (nSets) {
        const sets = []; f.items.forEach((it, pos) => it.on && it.sets.forEach((x, i) => sets.push({ exercise_id: it.exercise_id, program_exercise_id: it.pe_id, position: pos, set_index: i + 1, weight: x.weight == null || x.weight === '' ? null : Number(x.weight), weight_unit: it.unit, reps: x.reps == null || x.reps === '' ? null : Math.round(Number(x.reps)), target_reps: it.target, completed: true })));
        const r = await postOrQueue('/workouts', { client_id: cid, program_day_id: f.day.id, name: f.day.name, date: f.date, duration_sec: Math.round(Number(f.minutes) * 60), rpe: f.rpe, notes: [f.notes, 'Enregistrée après coup'].filter(Boolean).join(' · '), sets });
        wid = r.data?.id;
      }
      for (const c of f.cardio.filter((x) => x.on)) await postOrQueue('/cardio', { client_id: `${cid}-c${c.pc_id}`, activity: c.activity, custom_name: c.custom_name, date: f.date, duration_min: Number(c.duration_min), speed_kmh: c.speed_kmh, incline_pct: c.incline_pct, program_cardio_id: c.pc_id });
      toast('Séance enregistrée et marquée comme faite');
      nav(wid ? `/historique/${wid}?debrief=1` : '/', { replace: true });
    } catch (e) { toast(e.message, 'err'); setSaving(false); }
  };
  return (
    <Page title="Séance oubliée" subtitle={`${f.day.name}${f.day.focus ? ` · ${f.day.focus}` : ''}`} back={() => nav(-1)}>
      <Card className="lp-head">
        <p className="small">Coche ce que tu as vraiment fait et corrige les charges ou les répétitions si besoin. La séance n’est marquée comme faite qu’une fois enregistrée.</p>
        <div className="grid2">
          <Field label="Date"><input type="date" value={f.date} max={today()} onChange={(e) => e.target.value && up((y) => { y.date = e.target.value; })} /></Field>
          <Field label="Durée (min)"><NumInput value={f.minutes} onChange={(v) => up((y) => { y.minutes = v; })} /></Field>
        </div>
        {future && <p className="warn-text small">Cette date est dans le futur.</p>}
        <p className="muted small">{fmtDay(f.date)} · {nSets} série{nSets > 1 ? 's' : ''}{nCardio ? ` · ${nCardio} cardio` : ''}</p>
      </Card>
      {f.items.map((it, ii) => (
        <section key={ii} className={`card lp-ex ${it.on ? '' : 'off'}`}>
          <button className="lp-top" onClick={() => up((y) => { y.items[ii].on = !y.items[ii].on; })}>
            <span className={`lp-chk ${it.on ? 'on' : ''}`}>{it.on && <Icon name="check" size={14} stroke={3} />}</span>
            {thumb(it.lib_id) ? <img src={thumb(it.lib_id)} alt="" loading="lazy" /> : null}
            <span className="grow"><b>{it.name}</b><br /><span className="muted small">{it.on ? `${it.sets.length} série${it.sets.length > 1 ? 's' : ''}` : 'Pas fait'}</span></span>
          </button>
          {it.on && <>
            <div className="lp-sets">
              {it.sets.map((x, si) => (
                <div key={si} className="lp-set"><span className="muted small">{si + 1}</span>
                  <NumInput value={x.weight} onChange={(v) => up((y) => { y.items[ii].sets[si].weight = v; })} placeholder={it.kind === 'bodyweight' ? 'PDC' : it.unit} aria-label="Charge" />
                  <span className="muted small">×</span>
                  <NumInput value={x.reps} onChange={(v) => up((y) => { y.items[ii].sets[si].reps = v; })} placeholder="reps" aria-label="Répétitions" />
                </div>
              ))}
            </div>
            <div className="row gap-s mt-s">
              <button className="btn xs ghost" onClick={() => up((y) => { const s = y.items[ii].sets; s.push({ ...s.at(-1) }); })}><Icon name="plus" size={14} />Série</button>
              {it.sets.length > 1 && <button className="btn xs ghost" onClick={() => up((y) => { y.items[ii].sets.pop(); })}>Retirer une série</button>}
            </div>
          </>}
        </section>
      ))}
      {f.cardio.map((c, ci) => (
        <section key={`c${ci}`} className={`card lp-ex ${c.on ? '' : 'off'}`}>
          <button className="lp-top" onClick={() => up((y) => { y.cardio[ci].on = !y.cardio[ci].on; })}>
            <span className={`lp-chk ${c.on ? 'on' : ''}`}>{c.on && <Icon name="check" size={14} stroke={3} />}</span>
            <span className="grow"><b>{c.label}</b><br /><span className="muted small">{c.on ? 'Cardio' : 'Pas fait'}</span></span>
          </button>
          {c.on && <div className="lp-set cardio"><NumInput value={c.duration_min} onChange={(v) => up((y) => { y.cardio[ci].duration_min = v; })} aria-label="Minutes" /><span className="muted small">min</span></div>}
        </section>
      ))}
      <Card>
        <Field label={`Effort ressenti : ${f.rpe ?? '—'}/10`}><input type="range" min="1" max="10" value={f.rpe ?? 7} onChange={(e) => up((y) => { y.rpe = Number(e.target.value); })} /></Field>
        <Field label="Notes"><textarea rows={2} value={f.notes} onChange={(e) => up((y) => { y.notes = e.target.value; })} /></Field>
      </Card>
      <button className="btn primary lg block" disabled={saving} onClick={save}><Icon name="check" size={18} />{saving ? 'Enregistrement…' : 'Confirmer et marquer comme faite'}</button>
    </Page>
  );
}
