import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, postOrQueue, store, uid, today } from '../lib/api.js';
import { Icon, Loading, Sheet, Field, NumInput, Confirm, useToast, ErrorBox } from '../components/ui.jsx';
import { clock, weightLabel, repsLabel, fmtDate, CARDIO_ICON } from '../lib/format.js';
import ExercisePicker, { platesFor, warmupFor } from '../components/ExercisePicker.jsx';
import { ExerciseInfo } from '../components/ExerciseDemo.jsx';
import { e1rm, toLbs } from '../../../server/formulas.js';
import { suggestNext } from '../lib/progression.js';

const isRecord = (it, set) => {
  const b = it.best; const w = Number(set.weight); if (!b || !w) return false;
  const v = toLbs(w, it.unit);
  if (it.kind === 'assisted') return b.top_lbs != null && v < b.top_lbs - 1e-9;
  if (b.top_lbs != null && v > b.top_lbs + 1e-9) return true;
  const e = e1rm(v, Number(set.reps)); return !!(e && b.e1rm_lbs && e > b.e1rm_lbs + 0.5);
};

// Coach pendant la séance : une consigne après chaque série, selon les répétitions faites par rapport à l'objectif
export function coachCue(it, si) {
  const set = it.sets[si]; const target = Number(it.target.reps) || null; const reps = Number(set.reps);
  if (!target || !Number.isFinite(reps)) return set.pr ? { tone: 'gold', text: 'Record ! Garde cette technique.' } : null;
  const remaining = it.sets.filter((x) => !x.done).length;
  const step = it.unit === 'kg' ? 2.5 : 5; const w = Number(set.weight) || null;
  const assisted = it.kind === 'assisted'; const bw = it.kind === 'bodyweight' || w == null;
  const prev = si > 0 ? it.sets[si - 1] : null; const drop = prev?.done ? (Number(prev.reps) || 0) - reps : 0;
  const pre = set.pr && reps >= target - 1 ? 'Record ! ' : '';
  const fmt = (x) => `${x.toLocaleString('fr-FR')} ${it.unit}${assisted ? ' d’assistance' : ''}`;
  if (reps >= target + 3 && remaining > 0) {
    if (bw) return { tone: 'good', text: `${pre}${reps} reps pour ${target} : trop facile, ralentis la descente ou ajoute du lest.` };
    const g = step / 2; const nw = Math.round((assisted ? Math.max(0, w - step) : w + step) / g) * g;
    return { tone: 'good', text: `${pre}${reps} reps pour ${target} : trop facile. Passe à ${fmt(nw)} pour la prochaine série.`, action: { type: 'set', weight: nw, label: `Mettre ${fmt(nw)}` } };
  }
  if (reps >= target) {
    if (remaining > 0) return { tone: 'good', text: `${pre}Objectif atteint (${reps}/${target}). Garde ${bw ? 'le rythme' : fmt(w)}, même technique.` };
    const all = it.sets.every((x) => x.done && Number(x.reps) >= target);
    return { tone: 'good', text: `${pre}${all ? 'Toutes les séries réussies : je te proposerai une hausse au débrief.' : 'Exercice terminé.'}` };
  }
  if (reps === target - 1) return { tone: 'mid', text: `${pre}Presque (${reps}/${target}). Garde la charge, prends tout ton repos et vise ${target}.` };
  // Répétitions manquées
  if (remaining === 0) return { tone: 'warn', text: `${pre}${target - reps} reps manquées sur la dernière série : on garde cette charge la prochaine fois.` };
  if (drop >= 3) return { tone: 'warn', text: `${pre}Tu as perdu ${drop} reps par rapport à la série d’avant : allonge ton repos de 30 s.`, action: { type: 'rest', label: 'Repos +30 s' } };
  if (bw) return { tone: 'warn', text: `${pre}${reps}/${target} : fais ce que tu peux en gardant une technique propre.` };
  const nw = assisted ? w + step : Math.max(0, Math.round((w * 0.92) / step) * step);
  return { tone: 'warn', text: `${pre}${reps}/${target} : trop lourd aujourd’hui. Passe à ${fmt(nw)} pour rester dans ta plage.`, action: { type: 'set', weight: nw, label: `Mettre ${fmt(nw)}` } };
}

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
      pattern: pe.pattern, muscles: pe.muscles, equipment: pe.equipment, wnote: pe.weight_note, lib_id: pe.lib_id,
      target: { sets: pe.sets, reps: pe.reps, label: `${repsLabel(pe)} · ${weightLabel(pe)}` }, rest: pe.rest_seconds || profile.default_rest_seconds || 90,
      last: pe.last ? { date: pe.last.date, text: lastSets.map((s) => `${s.weight != null ? Math.round(s.weight * 10) / 10 : 'PDC'}×${s.reps ?? '?'}`).join(' · ') } : null,
      best: pe.best || null, sugg: deload ? null : suggestNext(pe),
      // Deload : moitié des séries, charge ~-10 % (assistance +10 %), arrondie au pas de 5 lbs / 2,5 kg
      sets: Array.from({ length: deload ? Math.max(1, Math.floor(pe.sets / 2)) : pe.sets }, (_, i) => {
        const ls = lastSets[i] || lastSets.at(-1);
        let w = ls?.weight ?? pe.target_weight ?? null; if (w != null) w = Math.round(w * 10) / 10;
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
  return { briefed: false, dayId: day.id, name: day.name, focus: day.focus, startedAt: new Date().toISOString(), date: today(), clientId: uid(), items, blocks, cardio, deload, current: 0, rest: null, notes: '', rpe: null };
}

export default function Workout() {
  const { dayId } = useParams(); const nav = useNavigate(); const toast = useToast();
  const [s, setS] = useState(() => { const a = store.get(KEY); return a && String(a.dayId) === String(dayId) ? a : null; });
  const [error, setError] = useState(null); const [conflict, setConflict] = useState(null);
  const [finishing, setFinishing] = useState(false); const [cancel, setCancel] = useState(false); const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now()); const [tips, setTips] = useState({}); const [warm, setWarm] = useState({}); const [picker, setPicker] = useState(null); const [rmIt, setRmIt] = useState(null); const [demo, setDemo] = useState(null);
  const blockRefs = useRef([]); const [bm, setBm] = useState(null);
  useEffect(() => { get('/bodymap').then(setBm).catch(() => {}); }, []);

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

  const total = s.items.reduce((a, it) => a + (it.removed ? 0 : it.sets.length), 0);
  const done = s.items.filter((it) => !it.removed).reduce((a, it) => a + it.sets.filter((x) => x.done).length, 0);
  const elapsed = (now - new Date(s.startedAt).getTime()) / 1000;
  const blockDone = (b) => b.items.every((i) => s.items[i].removed || s.items[i].sets.every((x) => x.done));
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
    // Record : comparé aux meilleures perfs d'avant la séance et aux séries déjà validées aujourd'hui
    const cur = s.items[ii]; const cs = cur.sets[si];
    if (!cs.done) {
      const probe = { ...cs, reps: cs.reps ?? cur.target.reps };
      const today = { ...cur, best: cur.best ? { ...cur.best } : null };
      for (const x of cur.sets) if (x.done && x.pr && Number(x.weight)) { const v = toLbs(Number(x.weight), cur.unit); if (today.best) { if (cur.kind === 'assisted') today.best.top_lbs = Math.min(today.best.top_lbs, v); else { today.best.top_lbs = Math.max(today.best.top_lbs ?? 0, v); today.best.e1rm_lbs = Math.max(today.best.e1rm_lbs ?? 0, e1rm(v, Number(x.reps)) || 0); } } }
      if (isRecord(today, probe)) { setTimeout(() => toast(`Record sur ${cur.name} : ${Number(cs.weight).toLocaleString('fr-FR')} ${cur.unit} × ${probe.reps}`, 'ok'), 50); if (navigator.vibrate) navigator.vibrate([60, 40, 120]); }
    }
    update((y) => {
      const it = y.items[ii]; const set = it.sets[si];
      set.done = !set.done;
      if (!set.done) { set.pr = false; if (y.cue?.ii === ii) y.cue = null; return; }
      if (set.reps == null && it.target.reps) set.reps = it.target.reps;
      const prev = { ...it, best: it.best ? { ...it.best } : null };
      for (const x of it.sets) if (x !== set && x.done && x.pr && Number(x.weight) && prev.best) { const v = toLbs(Number(x.weight), it.unit); if (it.kind === 'assisted') prev.best.top_lbs = Math.min(prev.best.top_lbs, v); else { prev.best.top_lbs = Math.max(prev.best.top_lbs ?? 0, v); prev.best.e1rm_lbs = Math.max(prev.best.e1rm_lbs ?? 0, e1rm(v, Number(x.reps)) || 0); } }
      set.pr = isRecord(prev, set);
      const cue = coachCue(it, si); y.cue = cue ? { ...cue, ii, name: it.name } : null;
      const block = y.blocks[bi];
      // En superset, le repos démarre quand le tour est complet
      const roundDone = block.items.every((k) => y.items[k].removed || !y.items[k].sets[si] || y.items[k].sets[si].done);
      const allDone = block.items.every((k) => y.items[k].removed || y.items[k].sets.every((x) => x.done));
      if (roundDone) {
        const rest = Math.max(...block.items.filter((k) => !y.items[k].removed).map((k) => y.items[k].rest));
        y.rest = { endsAt: Date.now() + rest * 1000, duration: rest };
      }
      if (allDone) {
        const next = y.blocks.findIndex((b, k) => k > bi && !b.items.every((m) => y.items[m].removed || y.items[m].sets.every((x) => x.done)));
        const any = next === -1 ? y.blocks.findIndex((b) => !b.items.every((m) => y.items[m].removed || y.items[m].sets.every((x) => x.done))) : next;
        if (any !== -1) { y.current = any; setTimeout(() => blockRefs.current[any]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350); }
        else y.rest = null;
      }
    });
  };
  const applyCue = () => update((y) => {
    const c = y.cue; if (!c?.action) return; const it = y.items[c.ii];
    if (c.action.type === 'set') it.sets.forEach((x) => { if (!x.done) x.weight = c.action.weight; });
    if (c.action.type === 'rest') { it.rest += 30; if (y.rest) { y.rest.endsAt += 30000; y.rest.duration += 30; } }
    y.cue = { ...c, action: null, text: c.action.type === 'rest' ? 'Repos allongé de 30 s pour cet exercice.' : `C’est noté : ${c.action.label.replace('Mettre ', '')} sur les séries restantes.` };
  });
  const setVal = (ii, si, k, v) => update((y) => { y.items[ii].sets[si][k] = v; });
  const bump = (ii, si, k, d) => update((y) => { const set = y.items[ii].sets[si]; const cur = Number(set[k]) || 0; set[k] = Math.max(0, Math.round((cur + d) * 10) / 10); });
  const addSet = (ii) => update((y) => { const l = y.items[ii].sets.at(-1); y.items[ii].sets.push({ weight: l?.weight ?? null, reps: l?.reps ?? y.items[ii].target.reps, done: false }); });
  const removeSet = (ii) => update((y) => { if (y.items[ii].sets.length > 1) y.items[ii].sets.pop(); });
  // Exercice hors programme : machine prise, envie d'ajouter un exercice…
  const fromLib = (e, base) => ({
    pe_id: null, exercise_id: e.id, name: e.name, kind: e.kind, unit: e.default_unit || base?.unit || 'lbs', technique: e.technique, superset: null,
    pattern: e.pattern, muscles: e.muscles, equipment: e.equipment, lib_id: e.lib_id, wnote: null, extra: true, replaced: base?.name || null,
    target: { sets: base?.target.sets || 3, reps: base?.target.reps || 10, label: `${base?.target.sets || 3} × ${base?.target.reps || 10} · hors programme` }, rest: base?.rest || 90, last: null,
    sets: Array.from({ length: base?.sets.length || 3 }, () => ({ weight: null, reps: base?.target.reps || 10, done: false })),
  });
  const pick = (e) => {
    const p = picker; setPicker(null);
    if (p.ii != null) {
      const started = s.items[p.ii].sets.some((x) => x.done);
      // Séries déjà faites : on garde charges et reps, seul le nom de l'exercice change (erreur de saisie, machine différente…)
      update((y) => { const old = y.items[p.ii]; const n = fromLib(e, old); if (started) { n.sets = old.sets.map((x) => ({ ...x, pr: false })); n.unit = old.unit; } y.items[p.ii] = n; });
      toast(started ? `Séries déjà faites gardées, rangées sous ${e.name}` : `${e.name} remplace l’exercice pour aujourd’hui`); return;
    }
    update((y) => { y.items.push(fromLib(e)); y.blocks.push({ items: [y.items.length - 1] }); y.current = y.blocks.length - 1; });
    setTimeout(() => blockRefs.current[blockRefs.current.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  };
  const isBar = (it) => /barre|barbell|smith/i.test(it.equipment || '') && !/haltère/i.test(it.wnote || '');
  const barW = (it) => (/ez/i.test(it.equipment || '') ? (it.unit === 'kg' ? 10 : 25) : (it.unit === 'kg' ? 20 : 45));
  const plateText = (it, w) => {
    if (!isBar(it) || w == null) return null;
    const perSide = /côté/i.test(it.wnote || '');
    const r = perSide ? platesFor(w * 2 + barW(it), it.unit, barW(it)) : platesFor(w, it.unit, barW(it));
    if (!r) return null;
    return r.plates.length ? `${r.plates.map((x) => x.toLocaleString('fr-FR')).join(' + ')} par côté${r.rest ? ` (+${r.rest} à compléter)` : ''}` : 'barre seule';
  };

  const save = async () => {
    setSaving(true);
    const sets = [];
    s.items.forEach((it, pos) => !it.removed && it.sets.forEach((x, i) => { if (x.done) sets.push({ exercise_id: it.exercise_id, program_exercise_id: it.pe_id, position: pos, set_index: i + 1, weight: x.weight === '' ? null : x.weight, weight_unit: it.unit, reps: x.reps, target_reps: it.target.reps, completed: true }); }));
    if (!sets.length && cardioDone) { store.del(KEY); toast('Séance cardio enregistrée'); nav('/cardio', { replace: true }); return; }
    if (!sets.length) { toast(cardio.length ? 'Valide au moins une série ou ton cardio avant d’enregistrer' : 'Valide au moins une série avant d’enregistrer', 'err'); setSaving(false); return; }
    const body = { client_id: s.clientId, program_day_id: s.dayId, name: s.name, date: s.date, started_at: s.startedAt, ended_at: new Date().toISOString(), duration_sec: Math.round(elapsed), rpe: s.rpe, notes: s.notes, sets };
    try {
      const r = await postOrQueue('/workouts', body);
      store.del(KEY);
      toast(r.queued ? 'Hors ligne : séance gardée, elle sera synchronisée automatiquement' : 'Séance enregistrée', r.queued ? 'warn' : 'ok');
      nav(r.queued ? '/' : `/historique/${r.data.id}?debrief=1`, { replace: true });
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
      {!s.briefed && done === 0 ? <Briefing s={s} bm={bm} onApply={(list) => update((y) => { list.forEach((ii) => { const it = y.items[ii]; it.sets.forEach((x) => { if (it.sugg.weight != null) x.weight = it.sugg.weight; if (it.sugg.reps != null) x.reps = it.sugg.reps; }); it.applied = true; }); })} onGo={() => update((y) => { y.briefed = true; })} />
        : done === 0 && <button className="link small brief-reopen" onClick={() => update((y) => { y.briefed = false; })}>Revoir le briefing</button>}
      {s.deload && <div className="deload-banner"><Icon name="moon" size={16} /><span><b>Semaine de deload</b> : moitié des séries et charges −10 % déjà appliquées. Arrête chaque série à 3 ou 4 répétitions de l’échec, cardio facile.</span></div>}
      {cardio.map((c, ci) => (c.placement === 'debut' ? cardioCard(c, ci) : null))}

      {s.blocks.map((b, bi) => {
        if (b.items.every((i) => s.items[i].removed)) return null;
        const open = bi === s.current; const finished = blockDone(b);
        return (
          <section key={bi} ref={(el) => { blockRefs.current[bi] = el; }} className={`wk-block card ${open ? 'open' : ''} ${finished ? 'finished' : ''}`}>
            {b.items.length > 1 && <p className="eyebrow">Superset · {b.items.length} exercices en alternance</p>}
            {b.items.filter((ii) => !s.items[ii].removed).map((ii) => {
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
                      {it.lib_id && <button className="link small" onClick={() => setDemo(it.lib_id)}>Démo</button>}
                    </div>
                    {it.sugg && !it.applied && !it.sets.some((x) => x.done) && (
                      <div className="sugg"><Icon name="up" size={16} /><span className="grow"><b>Aujourd’hui : {it.sugg.text}</b><br />{it.sugg.why}</span>
                        <button className="btn xs" onClick={() => update((y) => { y.items[ii].sets.forEach((x) => { if (!x.done) { if (it.sugg.weight != null) x.weight = it.sugg.weight; if (it.sugg.reps != null) x.reps = it.sugg.reps; } }); })}>Appliquer</button></div>
                    )}
                    {it.replaced && <p className="muted small">Remplace {it.replaced} aujourd’hui (ton programme ne change pas).</p>}
                    {tips[ii] && <p className="tip"><Icon name="info" size={14} />{it.technique}</p>}
                    {warm[ii] && (() => {
                      const top = Math.max(0, ...it.sets.map((x) => Number(x.weight) || 0)); const wu = warmupFor(top, it.unit, it.kind); const pt = plateText(it, top);
                      return <div className="tip warm"><Icon name="flame" size={14} /><div>
                        {wu.length ? <><b>Échauffement avant {top.toLocaleString('fr-FR')} {it.unit}</b><ul>{wu.map((x, k) => <li key={k}>{x.w.toLocaleString('fr-FR')} {it.unit} × {x.reps}{plateText(it, x.w) ? ` · ${plateText(it, x.w)}` : ''}</li>)}</ul></> : <span>Charge légère : une série à vide ou à mi-charge suffit.</span>}
                        {pt && <p className="small">Séries de travail : {pt} (barre {barW(it)} {it.unit}).</p>}
                        <p className="muted small">Ces séries ne comptent pas dans la séance.</p>
                      </div></div>;
                    })()}
                    <div className="set-head"><span>Série</span><span>{it.kind === 'assisted' ? `Assistance (${it.unit})` : `Charge (${it.unit})`}</span><span>Reps</span><span /></div>
                    {it.sets.map((x, si) => (
                      <div key={si} className={`set-row ${x.done ? 'done' : ''} ${x.pr ? 'pr' : ''}`}>
                        <span className="set-idx" title={x.pr ? 'Record' : undefined}>{x.pr ? <Icon name="trophy" size={14} /> : si + 1}</span>
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
                    {!s.rest && s.cue?.ii === ii && <div className={`coach-cue inline ${s.cue.tone}`}><Icon name="chat" size={15} /><span className="grow">{s.cue.text}</span>{s.cue.action && <button className="btn xs" onClick={applyCue}>{s.cue.action.label}</button>}</div>}
                    <div className="row gap-s wrap mt-s"><button className="btn xs ghost" onClick={() => addSet(ii)}><Icon name="plus" size={14} />Série</button>{it.sets.length > 1 && <button className="btn xs ghost" onClick={() => removeSet(ii)}>Retirer une série</button>}
                      {it.kind === 'weighted' && <button className={`btn xs ghost ${warm[ii] ? 'on' : ''}`} onClick={() => setWarm({ ...warm, [ii]: !warm[ii] })}><Icon name="flame" size={14} />Échauffement</button>}
                      <button className="btn xs ghost" onClick={() => setPicker({ ii, like: it, title: it.sets.some((x) => x.done) ? `Changer ${it.name} (séries gardées)` : `Remplacer ${it.name}` })}><Icon name="skip" size={14} />{it.sets.some((x) => x.done) ? 'Changer' : 'Remplacer'}</button>
                      <button className="btn xs ghost danger-text" onClick={() => setRmIt(ii)}>Retirer</button></div>
                  </>)}
                </div>
              );
            })}
          </section>
        );
      })}
      <button className="btn block dashed mt" onClick={() => setPicker({ title: 'Ajouter un exercice' })}><Icon name="plus" size={16} />Ajouter un exercice</button>
      {cardio.map((c, ci) => (c.placement !== 'debut' ? cardioCard(c, ci) : null))}
      <button className="btn ghost danger-text block mt" onClick={() => setCancel(true)}>Abandonner la séance</button>

      {s.rest && (
        <div className={`rest-bar ${restLeft <= 0 ? 'over' : ''}`}>
          <div className="rest-fill" style={{ width: `${Math.max(0, Math.min(100, (restLeft / s.rest.duration) * 100))}%` }} />
          {s.cue && <div className={`coach-cue ${s.cue.tone}`}><Icon name="chat" size={15} /><span className="grow">{s.cue.text}</span>{s.cue.action && <button className="btn xs" onClick={applyCue}>{s.cue.action.label}</button>}</div>}
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
          <div><b>{s.items.filter((it) => !it.removed && it.sets.some((x) => x.done)).length}</b><span>exercices</span></div></div>
        {done < total && <p className="warn-text small">{total - done} série(s) non validée(s) : elles ne seront pas enregistrées.</p>}
        {cardio.some((c) => !c.done) && <p className="warn-text small">Cardio pas encore validé : touche « Cardio fait » avant de terminer pour qu’il compte.</p>}
        <Field label={`Effort ressenti global : ${s.rpe ?? '—'}/10`} hint="1 = très facile · 10 = effort maximal. Sert au calcul de ta récupération.">
          <input type="range" min="1" max="10" value={s.rpe ?? 7} onChange={(e) => update((y) => { y.rpe = Number(e.target.value); })} />
        </Field>
        <Field label="Notes (sensations, douleurs, technique…)"><textarea rows={3} value={s.notes} onChange={(e) => update((y) => { y.notes = e.target.value; })} /></Field>
        <p className="muted small">Les charges de ton programme ne changent pas automatiquement : l’onglet Analyse te proposera une progression que tu pourras valider.</p>
      </Sheet>
      <ExerciseInfo open={!!demo} libId={demo} onClose={() => setDemo(null)} />
      <ExercisePicker open={!!picker} onClose={() => setPicker(null)} title={picker?.title} like={picker?.like} onPick={pick} />
      <Confirm open={rmIt != null} onClose={() => setRmIt(null)} danger title={`Retirer ${rmIt != null ? s.items[rmIt].name : ''} ?`} confirmLabel="Retirer"
        text="Il sort de la séance d’aujourd’hui, ses séries ne seront pas enregistrées. Ton programme ne change pas."
        onConfirm={() => update((y) => { y.items[rmIt].removed = true; const bi = y.blocks.findIndex((b) => b.items.includes(rmIt)); if (bi === y.current) { const nx = y.blocks.findIndex((b) => b.items.some((k) => !y.items[k].removed && !y.items[k].sets.every((x) => x.done))); if (nx !== -1) y.current = nx; } })} />
      <Confirm open={cancel} onClose={() => setCancel(false)} danger title="Abandonner la séance ?" confirmLabel="Abandonner" text="Les séries saisies seront perdues."
        onConfirm={() => { store.del(KEY); nav('/'); }} />
    </div>
  );
}

// Briefing avant la séance : durée, échauffement, charges du jour (hausses à valider), muscles encore fatigués
function Briefing({ s, bm, onApply, onGo }) {
  const items = s.items.filter((it) => !it.removed);
  const cardioMin = (s.cardio || []).reduce((a, c) => a + (Number(c.duration_min) || 0), 0);
  const est = Math.round(items.reduce((a, it) => a + it.sets.length * (40 + it.rest), 0) / 60 + cardioMin);
  const ups = items.map((it) => s.items.indexOf(it)).filter((ii) => { const it = s.items[ii]; return it.sugg && !it.applied && it.sets.some((x) => (it.sugg.weight != null && Number(x.weight) !== it.sugg.weight) || (it.sugg.reps != null && Number(x.reps) !== it.sugg.reps)); });
  const mus = new Set(items.flatMap((it) => Object.entries(it.muscles || {}).filter(([, c]) => c >= 1).map(([k]) => k)));
  const tired = bm ? [...mus].filter((k) => bm.muscles[k]?.status === 'fatigue').map((k) => bm.muscles[k].label) : [];
  const first = items.find((it) => it.kind === 'weighted' && it.sets.some((x) => Number(x.weight) > 0));
  const top = first ? Math.max(...first.sets.map((x) => Number(x.weight) || 0)) : 0;
  const wu = first ? warmupFor(top, first.unit, first.kind) : [];
  const debut = (s.cardio || []).find((c) => c.placement === 'debut');
  const lastTxt = (it) => (it.last ? ` (dernière fois ${it.last.text})` : '');
  const setsText = (it) => { const w = it.sets[0]?.weight; const r = it.sets[0]?.reps; return `${it.sets.length} × ${r ?? '?'}${w != null && w !== '' ? ` à ${Number(w).toLocaleString('fr-FR')} ${it.unit}` : it.kind === 'bodyweight' ? ' au poids du corps' : ' · charge à choisir'}`; };
  return (
    <section className="card briefing">
      <p className="eyebrow">Briefing</p>
      <h2>{s.name}{s.focus ? ` · ${s.focus}` : ''}</h2>
      <div className="brief-kpi"><span><b>≈ {est}</b> min</span><span><b>{items.length}</b> exercices</span><span><b>{items.reduce((a, it) => a + it.sets.length, 0)}</b> séries</span>{cardioMin > 0 && <span><b>{Math.round(cardioMin)}</b> min cardio</span>}</div>
      {tired.length > 0 && <p className="brief-warn"><Icon name="alert" size={15} />{tired.join(', ')} encore fatigué{tired.length > 1 ? 's' : ''} : échauffe-toi plus longtemps et arrête chaque série à 2 reps de l’échec.</p>}
      <h3>1. Échauffement</h3>
      <ul className="brief-list">
        <li>{debut ? `${debut.label} ${debut.duration_min} min (prévu dans ta séance)` : '5 min de cardio léger pour monter en température'}</li>
        {first && wu.length > 0 && <li>Montée en charge sur {first.name} : {wu.map((x) => `${x.w.toLocaleString('fr-FR')} × ${x.reps}`).join(' · ')} ({first.unit})</li>}
      </ul>
      <h3>2. Charges du jour</h3>
      <ul className="brief-list ex">
        {items.map((it) => { const ii = s.items.indexOf(it); const up = ups.includes(ii); return (
          <li key={ii} className={up ? 'up' : ''}><span className="grow"><b>{it.name}</b><br /><span className="muted small">{up ? `Proposé : ${it.sugg.text}${lastTxt(it)}` : `${setsText(it)}${lastTxt(it)}`}</span></span>{up && <Icon name="up" size={16} />}</li>
        ); })}
      </ul>
      {ups.length > 0 && <button className="btn block" onClick={() => onApply(ups)}><Icon name="up" size={16} />Appliquer {ups.length > 1 ? `les ${ups.length} hausses` : 'la hausse'} pour aujourd’hui</button>}
      <h3>3. Objectif</h3>
      <p className="small">{ups.length ? 'Réussir les hausses avec une technique propre. Si une série casse de plus de 2 reps, je te dirai de baisser.' : 'Toutes les séries dans ta plage, en gardant 1 à 2 répétitions en réserve. Je te guide après chaque série.'}</p>
      <button className="btn primary lg block mt" onClick={onGo}><Icon name="play" size={18} />C’est parti</button>
    </section>
  );
}
