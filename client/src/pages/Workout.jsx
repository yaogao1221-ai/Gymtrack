import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, postOrQueue, store, uid, today } from '../lib/api.js';
import { Icon, Loading, Sheet, Field, NumInput, Confirm, useToast, ErrorBox } from '../components/ui.jsx';
import { clock, weightLabel, repsLabel, fmtDate, CARDIO_ICON } from '../lib/format.js';

const KEY = 'gt_active_workout';
let audioCtx;
const unlockAudio = () => { try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch { /* */ } };
const beep = () => {
  try {
    unlockAudio(); const t = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach((d, i) => { const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.frequency.value = i === 2 ? 1320 : 880; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.3, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18); o.start(t + d); o.stop(t + d + 0.2); });
  } catch { /* */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
};

// Construit la séance à partir du jour de programme (dernière charge utilisée en priorité)
function buildSession(day, profile, deload = false) {
  const items = day.exercises.map((pe) => {
    const lastSets = pe.last?.sets || [];
    return {
      pe_id: pe.id, exercise_id: pe.exercise_id, name: pe.name, kind: pe.kind, unit: pe.weight_unit, technique: pe.technique, superset: pe.superset_group,
      target: { sets: pe.sets, reps: pe.reps, label: `${repsLabel(pe)} · ${weightLabel(pe)}` }, rest: pe.rest_seconds || profile.default_rest_seconds || 90,
      last: pe.last ? { date: pe.last.date, text: lastSets.map((s) => `${s.weight ?? 'PDC'}×${s.reps ?? '?'}`).join(' · ') } : null,
      // Deload : moitié des séries, charge ~-10 % (assistance +10 %), arrondie au pas de 5 lbs / 2,5 kg
      sets: Array.from({ length: deload ? Math.max(1, Math.floor(pe.sets / 2)) : pe.sets }, (_, i) => {
        const ls = lastSets[i] || lastSets.at(-1);
        let w = ls?.weight ?? pe.target_weight ?? null;
        if (deload && w != null && pe.kind !== 'bodyweight') { const step = pe.weight_unit === 'kg' ? 2.5 : 5; w = Math.round((pe.kind === 'assisted' ? w * 1.1 : w * 0.9) / step) * step; }
        return { weight: w, reps: pe.reps ?? ls?.reps ?? null, done: false };
      }),
    };
  });
  const blocks = [];
  items.forEach((it, i) => {
    const prev = blocks.at(-1);
    if (it.superset && prev && items[prev.items[0]].superset === it.superset) prev.items.push(i); else blocks.push({ items: [i] });
  });
  const cardio = (day.cardio || []).map((c) => ({ pc_id: c.id, activity: c.activity, custom_name: c.custom_name, label: c.label, placement: c.placement,
    duration_min: c.duration_min, speed_kmh: c.speed_kmh, incline_pct: c.incline_pct, last: c.last, done: false }));
  return { dayId: day.id, name: day.name, focus: day.focus, startedAt: new Date().toISOString(), date: today(), clientId: uid(), items, blocks, cardio, deload, current: 0, rest: null, notes: '', rpe: null };
}

export default function Workout() {
  const { dayId } = useParams(); const nav = useNavigate(); const toast = useToast();
  const [s, setS] = useState(() => { const a = store.get(KEY); return a && String(a.dayId) === String(dayId) ? a : null; });
  const [error, setError] = useState(null); const [conflict, setConflict] = useState(null);
  const [finishing, setFinishing] = useState(false); const [cancel, setCancel] = useState(false); const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now()); const [tips, setTips] = useState({});
  const blockRefs = useRef([]);

  useEffect(() => {
    if (s) return;
    const other = store.get(KEY);
    if (other && String(other.dayId) !== String(dayId)) { setConflict(other); return; }
    Promise.all([get('/program'), get('/profile'), get('/deload').catch(() => null)]).then(([prog, profile, dl]) => {
      const day = prog.days.find((d) => String(d.id) === String(dayId));
      if (!day) throw new Error('Séance introuvable dans le programme');
      setS(buildSession(day, profile, !!dl?.active));
    }).catch(setError);
  }, [dayId, s]);
  useEffect(() => { if (s) store.set(KEY, s); }, [s]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  // Garder l'écran allumé pendant la séance (si supporté)
  useEffect(() => {
    let lock; const req = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { /* */ } };
    req(); const vis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); lock?.release?.(); };
  }, []);
  // Fin du repos
  const restLeft = s?.rest ? (s.rest.endsAt - now) / 1000 : 0;
  const firedRef = useRef(null);
  useEffect(() => {
    if (s?.rest && restLeft <= 0 && firedRef.current !== s.rest.endsAt) { firedRef.current = s.rest.endsAt; beep(); }
  }, [restLeft, s?.rest]);

  const update = useCallback((fn) => setS((x) => { const y = structuredClone(x); fn(y); return y; }), []);

  if (conflict) return (
    <div className="page"><div className="card"><h2>Une autre séance est en cours</h2><p className="muted">{conflict.name} — {conflict.focus}, commencée le {fmtDate(conflict.date)}.</p>
      <div className="row gap mt"><button className="btn primary" onClick={() => nav(`/seance/${conflict.dayId}`)}>Reprendre</button>
        <button className="btn ghost danger-text" onClick={() => { store.del(KEY); setConflict(null); }}>L’abandonner</button></div></div></div>
  );
  if (error) return <ErrorBox error={error} />;
  if (!s) return <Loading />;

  const total = s.items.reduce((a, it) => a + it.sets.length, 0);
  const done = s.items.reduce((a, it) => a + it.sets.filter((x) => x.done).length, 0);
  const elapsed = (now - new Date(s.startedAt).getTime()) / 1000;
  const blockDone = (b) => b.items.every((i) => s.items[i].sets.every((x) => x.done));
  const cardio = s.cardio || [];
  const cardioDone = cardio.filter((c) => c.done).length;
  const saveCardio = async (ci) => {
    const c = cardio[ci];
    const body = { client_id: `${s.clientId}-c${c.pc_id}`, activity: c.activity, custom_name: c.custom_name, date: s.date, duration_min: c.duration_min, speed_kmh: c.speed_kmh, incline_pct: c.incline_pct, program_cardio_id: c.pc_id };
    try {
      const r = await postOrQueue('/cardio', body);
      update((y) => { y.cardio[ci].done = true; });
      toast(r.queued ? 'Hors ligne : cardio gardé, synchronisé plus tard' : `${c.label} : ${c.duration_min} min enregistrées`, r.queued ? 'warn' : 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
  const cardioCard = (c, ci) => (
    <section key={`c${ci}`} className={`wk-block card cardio-wk ${c.done ? 'finished' : ''}`}>
      <div className="wk-ex-head static">
        <i className="act">{CARDIO_ICON[c.activity] || '··'}</i>
        <div className="grow"><div className="ex-name">{c.label}</div><div className="muted small">{c.placement === 'debut' ? 'Échauffement cardio' : 'Cardio de fin de séance'}{c.last ? ` · dernière fois ${c.last.duration_min} min` : ''}</div></div>
        {c.done && <Icon name="check" size={18} />}
      </div>
      {!c.done && <>
        <div className="grid3 mt-s">
          <Field label="Minutes"><NumInput value={c.duration_min} onChange={(v) => update((y) => { y.cardio[ci].duration_min = v; })} /></Field>
          <Field label="km/h"><NumInput value={c.speed_kmh} onChange={(v) => update((y) => { y.cardio[ci].speed_kmh = v; })} placeholder="—" /></Field>
          <Field label="Incl. %"><NumInput value={c.incline_pct} onChange={(v) => update((y) => { y.cardio[ci].incline_pct = v; })} placeholder="—" /></Field>
        </div>
        <button className="btn primary block" disabled={!c.duration_min} onClick={() => saveCardio(ci)}><Icon name="check" size={16} />Cardio fait</button>
      </>}
    </section>
  );

  const toggleSet = (bi, ii, si) => {
    unlockAudio();
    update((y) => {
      const it = y.items[ii]; const set = it.sets[si];
      set.done = !set.done;
      if (!set.done) return;
      if (set.reps == null && it.target.reps) set.reps = it.target.reps;
      const block = y.blocks[bi];
      // En superset, le repos démarre quand le tour est complet
      const roundDone = block.items.every((k) => !y.items[k].sets[si] || y.items[k].sets[si].done);
      const allDone = block.items.every((k) => y.items[k].sets.every((x) => x.done));
      if (roundDone) {
        const rest = Math.max(...block.items.map((k) => y.items[k].rest));
        y.rest = { endsAt: Date.now() + rest * 1000, duration: rest };
      }
      if (allDone) {
        const next = y.blocks.findIndex((b, k) => k > bi && !b.items.every((m) => y.items[m].sets.every((x) => x.done)));
        const any = next === -1 ? y.blocks.findIndex((b) => !b.items.every((m) => y.items[m].sets.every((x) => x.done))) : next;
        if (any !== -1) { y.current = any; setTimeout(() => blockRefs.current[any]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350); }
        else y.rest = null;
      }
    });
  };
  const setVal = (ii, si, k, v) => update((y) => { y.items[ii].sets[si][k] = v; });
  const bump = (ii, si, k, d) => update((y) => { const set = y.items[ii].sets[si]; const cur = Number(set[k]) || 0; set[k] = Math.max(0, Math.round((cur + d) * 10) / 10); });
  const addSet = (ii) => update((y) => { const l = y.items[ii].sets.at(-1); y.items[ii].sets.push({ weight: l?.weight ?? null, reps: l?.reps ?? y.items[ii].target.reps, done: false }); });
  const removeSet = (ii) => update((y) => { if (y.items[ii].sets.length > 1) y.items[ii].sets.pop(); });

  const save = async () => {
    setSaving(true);
    const sets = [];
    s.items.forEach((it, pos) => it.sets.forEach((x, i) => { if (x.done) sets.push({ exercise_id: it.exercise_id, program_exercise_id: it.pe_id, position: pos, set_index: i + 1, weight: x.weight === '' ? null : x.weight, weight_unit: it.unit, reps: x.reps, target_reps: it.target.reps, completed: true }); }));
    if (!sets.length && cardioDone) { store.del(KEY); toast('Séance cardio enregistrée'); nav('/cardio', { replace: true }); return; }
    if (!sets.length) { toast(cardio.length ? 'Valide au moins une série ou ton cardio avant d’enregistrer' : 'Valide au moins une série avant d’enregistrer', 'err'); setSaving(false); return; }
    const body = { client_id: s.clientId, program_day_id: s.dayId, name: s.name, date: s.date, started_at: s.startedAt, ended_at: new Date().toISOString(), duration_sec: Math.round(elapsed), rpe: s.rpe, notes: s.notes, sets };
    try {
      const r = await postOrQueue('/workouts', body);
      store.del(KEY);
      toast(r.queued ? 'Hors ligne : séance gardée, elle sera synchronisée automatiquement' : 'Séance enregistrée', r.queued ? 'warn' : 'ok');
      nav(r.queued ? '/' : `/historique/${r.data.id}`, { replace: true });
    } catch (e) { toast(e.message, 'err'); setSaving(false); }
  };

  return (
    <div className="workout fade-in">
      <header className="wk-head">
        <button className="icon-btn" onClick={() => nav('/')} aria-label="Réduire (la séance reste en cours)"><Icon name="left" /></button>
        <div className="wk-title"><b>{s.name}</b><span>{s.focus}</span></div>
        <div className="wk-clock"><Icon name="timer" size={14} />{clock(elapsed)}</div>
        <button className="btn primary sm" onClick={() => setFinishing(true)}>Terminer</button>
      </header>
      <div className="wk-progress"><span style={{ width: `${total ? (done / total) * 100 : (cardio.length ? (cardioDone / cardio.length) * 100 : 0)}%` }} /></div>
      <p className="muted small center">{total ? `${done} / ${total} séries validées` : ''}{cardio.length ? `${total ? ' · ' : ''}cardio ${cardioDone}/${cardio.length}` : ''}</p>
      {s.deload && <div className="deload-banner"><Icon name="moon" size={16} /><span><b>Semaine de deload</b> : moitié des séries et charges −10 % déjà appliquées. Arrête chaque série à 3 ou 4 répétitions de l’échec, cardio facile.</span></div>}
      {cardio.map((c, ci) => (c.placement === 'debut' ? cardioCard(c, ci) : null))}

      {s.blocks.map((b, bi) => {
        const open = bi === s.current; const finished = blockDone(b);
        return (
          <section key={bi} ref={(el) => { blockRefs.current[bi] = el; }} className={`wk-block card ${open ? 'open' : ''} ${finished ? 'finished' : ''}`}>
            {b.items.length > 1 && <p className="eyebrow">Superset · {b.items.length} exercices en alternance</p>}
            {b.items.map((ii) => {
              const it = s.items[ii];
              return (
                <div key={ii} className="wk-ex">
                  <button className="wk-ex-head" onClick={() => update((y) => { y.current = bi; })}>
                    <span className="ex-num">{finished ? <Icon name="check" size={14} /> : ii + 1}</span>
                    <div><div className="ex-name">{it.name}</div><div className="muted small">{it.target.label}</div></div>
                    <span className="muted small">{it.sets.filter((x) => x.done).length}/{it.sets.length}</span>
                  </button>
                  {open && (<>
                    <div className="wk-last">
                      {it.last ? <>Dernière fois ({fmtDate(it.last.date, { day: 'numeric', month: 'short' })}) : <b>{it.last.text}</b></> : 'Première fois : choisis une charge confortable.'}
                      {it.technique && <button className="link small" onClick={() => setTips({ ...tips, [ii]: !tips[ii] })}>Technique</button>}
                    </div>
                    {tips[ii] && <p className="tip"><Icon name="info" size={14} />{it.technique}</p>}
                    <div className="set-head"><span>Série</span><span>{it.kind === 'assisted' ? `Assistance (${it.unit})` : `Charge (${it.unit})`}</span><span>Reps</span><span /></div>
                    {it.sets.map((x, si) => (
                      <div key={si} className={`set-row ${x.done ? 'done' : ''}`}>
                        <span className="set-idx">{si + 1}</span>
                        <div className="stepper">
                          <button onClick={() => bump(ii, si, 'weight', -(it.unit === 'kg' ? 2.5 : 5))} aria-label="Moins">−</button>
                          <NumInput value={x.weight} onChange={(v) => setVal(ii, si, 'weight', v)} placeholder={it.kind === 'bodyweight' ? 'PDC' : '—'} aria-label="Charge" />
                          <button onClick={() => bump(ii, si, 'weight', it.unit === 'kg' ? 2.5 : 5)} aria-label="Plus">+</button>
                        </div>
                        <div className="stepper">
                          <button onClick={() => bump(ii, si, 'reps', -1)} aria-label="Moins">−</button>
                          <NumInput value={x.reps} onChange={(v) => setVal(ii, si, 'reps', v)} placeholder="?" aria-label="Répétitions" />
                          <button onClick={() => bump(ii, si, 'reps', 1)} aria-label="Plus">+</button>
                        </div>
                        <button className={`check-btn ${x.done ? 'on' : ''}`} onClick={() => toggleSet(bi, ii, si)} aria-label={x.done ? 'Annuler la série' : 'Valider la série'}><Icon name="check" size={20} stroke={3} /></button>
                      </div>
                    ))}
                    <div className="row gap-s mt-s"><button className="btn xs ghost" onClick={() => addSet(ii)}><Icon name="plus" size={14} />Série</button>{it.sets.length > 1 && <button className="btn xs ghost" onClick={() => removeSet(ii)}>Retirer une série</button>}</div>
                  </>)}
                </div>
              );
            })}
          </section>
        );
      })}
      {cardio.map((c, ci) => (c.placement !== 'debut' ? cardioCard(c, ci) : null))}
      <button className="btn ghost danger-text block mt" onClick={() => setCancel(true)}>Abandonner la séance</button>

      {s.rest && (
        <div className={`rest-bar ${restLeft <= 0 ? 'over' : ''}`}>
          <div className="rest-fill" style={{ width: `${Math.max(0, Math.min(100, (restLeft / s.rest.duration) * 100))}%` }} />
          <div className="rest-content">
            <div><span className="muted small">{restLeft > 0 ? 'Repos' : 'C’est reparti !'}</span><b className="rest-time">{restLeft > 0 ? clock(restLeft) : `+${clock(-restLeft)}`}</b></div>
            <div className="row gap-s">
              <button className="btn xs" onClick={() => update((y) => { y.rest.endsAt -= 15000; })}>−15 s</button>
              <button className="btn xs" onClick={() => update((y) => { y.rest.endsAt += 15000; y.rest.duration += 15; })}>+15 s</button>
              <button className="btn xs primary" onClick={() => update((y) => { y.rest = null; })}><Icon name="skip" size={14} />{restLeft > 0 ? 'Passer' : 'OK'}</button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Terminer la séance"
        footer={<><button className="btn ghost" onClick={() => setFinishing(false)}>Continuer</button><button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer la séance'}</button></>}>
        <div className="summary"><div><b>{clock(elapsed)}</b><span>durée</span></div><div><b>{done}/{total}</b><span>séries</span></div>
          <div><b>{s.items.filter((it) => it.sets.some((x) => x.done)).length}</b><span>exercices</span></div></div>
        {done < total && <p className="warn-text small">{total - done} série(s) non validée(s) : elles ne seront pas enregistrées.</p>}
        {cardio.some((c) => !c.done) && <p className="warn-text small">Cardio pas encore validé : touche « Cardio fait » avant de terminer pour qu’il compte.</p>}
        <Field label={`Effort ressenti global : ${s.rpe ?? '—'}/10`} hint="1 = très facile · 10 = effort maximal. Sert au calcul de ta récupération.">
          <input type="range" min="1" max="10" value={s.rpe ?? 7} onChange={(e) => update((y) => { y.rpe = Number(e.target.value); })} />
        </Field>
        <Field label="Notes (sensations, douleurs, technique…)"><textarea rows={3} value={s.notes} onChange={(e) => update((y) => { y.notes = e.target.value; })} /></Field>
        <p className="muted small">Les charges de ton programme ne changent pas automatiquement : l’onglet Analyse te proposera une progression que tu pourras valider.</p>
      </Sheet>
      <Confirm open={cancel} onClose={() => setCancel(false)} danger title="Abandonner la séance ?" confirmLabel="Abandonner" text="Les séries saisies seront perdues."
        onConfirm={() => { store.del(KEY); nav('/'); }} />
    </div>
  );
}
