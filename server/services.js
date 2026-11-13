import { toJSON } from './schema.js';
import { addDays, weekStart, monthStart, diffDays } from './util.js';
import { DEFAULT_SCHEDULE } from './seed.js';
import { e1rm, toLbs, smoothedWeight, goalProgress, goalReached, r1 } from './formulas.js';

export const USER_ID = 1; // application personnelle mono-utilisateur (la table users permet d'évoluer)

export function exerciseRow(e) {
  return e && { ...e, muscles: toJSON(e.muscles, {}), in_library_only: !!e.in_library_only };
}

export function getProfile(db) {
  const p = db.one('SELECT p.*, u.name FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?', USER_ID);
  // Le poids affiché partout est celui de la dernière pesée (le champ du profil sert de repli)
  const lastW = db.one('SELECT weight_kg FROM body_metrics WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1', USER_ID);
  return { ...p, body_weight_kg: lastW?.weight_kg ?? p.body_weight_kg, onboarded: !!p.onboarded, schedule: toJSON(p.schedule, DEFAULT_SCHEDULE), available_days: toJSON(p.available_days, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']), cardio_preferred: toJSON(p.cardio_preferred, []) };
}

export function activeProgram(db) {
  return db.one('SELECT * FROM programs WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1', USER_ID);
}

// Dernière performance enregistrée sur un exercice (toutes séances confondues)
export function lastPerformance(db, exerciseId, beforeDate = '9999-12-31') {
  const w = db.one(`SELECT w.id, w.date FROM workouts w JOIN workout_sets s ON s.workout_id = w.id
    WHERE w.user_id = ? AND s.exercise_id = ? AND w.date <= ? ORDER BY w.date DESC, w.id DESC LIMIT 1`, USER_ID, exerciseId, beforeDate);
  if (!w) return null;
  const sets = db.all(`SELECT set_index, weight, weight_unit, reps, target_reps, completed FROM workout_sets
    WHERE workout_id = ? AND exercise_id = ? ORDER BY set_index`, w.id, exerciseId);
  return { workout_id: w.id, date: w.date, sets };
}

export function getProgram(db, { withLast = true, includeArchived = false } = {}) {
  const program = activeProgram(db);
  if (!program) return { program: null, days: [] };
  const days = db.all(`SELECT * FROM program_days WHERE program_id = ? ${includeArchived ? '' : 'AND archived = 0'} ORDER BY position`, program.id);
  const exStmt = db.prepare(`SELECT pe.*, e.name, e.slug, e.pattern, e.muscles, e.kind, e.equipment, e.technique, e.lib_id
    FROM program_exercises pe JOIN exercises e ON e.id = pe.exercise_id WHERE pe.day_id = ? ORDER BY pe.position`);
  for (const d of days) {
    d.exercises = exStmt.all(d.id).map((pe) => ({
      ...pe, muscles: toJSON(pe.muscles, {}),
      last: withLast ? lastPerformance(db, pe.exercise_id) : undefined,
    }));
    d.cardio = db.all('SELECT * FROM program_cardio WHERE day_id = ? ORDER BY placement, id', d.id).map((c) => ({
      ...c, label: c.custom_name || CARDIO_TYPES[c.activity]?.label || c.activity,
      last: withLast ? db.one('SELECT date, duration_min, speed_kmh, incline_pct, distance_km FROM cardio_sessions WHERE program_cardio_id = ? ORDER BY date DESC, id DESC LIMIT 1', c.id) || null : undefined,
    }));
  }
  return { program, days };
}

export function workoutSummary(db, w) {
  const agg = db.one(`SELECT COUNT(*) sets, SUM(completed) done, COALESCE(SUM(volume_lbs),0) volume, COUNT(DISTINCT exercise_id) exercises
    FROM v_set_volume WHERE workout_id = ?`, w.id);
  return { ...w, sets: agg.sets, sets_done: agg.done || 0, volume_lbs: Math.round(agg.volume), exercises: agg.exercises };
}

// Prochaine séance : 1) événement planifié à venir, 2) sinon jour suivant dans la rotation
export function nextSession(db, today) {
  const n = nextSessionCore(db, today);
  if (!n) return n;
  // Le cardio prévu dans ce jour de programme fait partie de la séance
  const cardio = db.all('SELECT id, activity, custom_name, duration_min, speed_kmh, incline_pct, placement FROM program_cardio WHERE day_id = ? ORDER BY placement, id', n.program_day_id)
    .map((c) => ({ ...c, label: c.custom_name || CARDIO_TYPES[c.activity]?.label || c.activity }));
  const deload = n.event_id ? !!db.one('SELECT deload FROM calendar_events WHERE id = ?', n.event_id)?.deload : false;
  return { ...n, cardio, deload };
}
function nextSessionCore(db, today) {
  const ev = db.one(`SELECT ce.*, pd.name day_name, pd.focus, pd.code FROM calendar_events ce
    LEFT JOIN program_days pd ON pd.id = ce.program_day_id
    WHERE ce.user_id = ? AND ce.type = 'workout' AND ce.status = 'planned' AND ce.date >= ? ORDER BY ce.date, ce.id LIMIT 1`, USER_ID, today);
  if (ev) return { source: 'calendar', date: ev.date, event_id: ev.id, program_day_id: ev.program_day_id, name: ev.day_name, focus: ev.focus, code: ev.code };
  const { days } = getProgram(db, { withLast: false });
  if (!days.length) return null;
  const last = db.one('SELECT program_day_id FROM workouts WHERE user_id = ? AND program_day_id IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1', USER_ID);
  const idx = last ? days.findIndex((d) => d.id === last.program_day_id) : -1;
  const d = days[(idx + 1) % days.length];
  return { source: 'rotation', date: null, program_day_id: d.id, name: d.name, focus: d.focus, code: d.code };
}

// --- Cardio : estimation des calories (formules ACSM pour marche/course, MET sinon) ---
export const CARDIO_TYPES = {
  marche: { label: 'Marche', met: 3.5 },
  marche_inclinee: { label: 'Marche inclinée (tapis)', met: 5.5 },
  course: { label: 'Course', met: 9.0 },
  velo: { label: 'Vélo', met: 6.8 },
  elliptique: { label: 'Vélo elliptique', met: 5.0 },
  rameur: { label: 'Rameur', met: 7.0 },
  autre: { label: 'Autre activité', met: 5.0 },
};

export function estimateCalories({ activity, duration_min, speed_kmh, incline_pct, rpe }, weightKg) {
  const kg = weightKg || 75;
  const min = Number(duration_min) || 0;
  if (!min) return 0;
  const grade = (Number(incline_pct) || 0) / 100;
  const v = (Number(speed_kmh) || 0) * 1000 / 60; // m/min
  let kcalMin;
  if ((activity === 'marche' || activity === 'marche_inclinee') && v > 0 && v <= 133) {
    kcalMin = (0.1 * v + 1.8 * v * grade + 3.5) * kg / 1000 * 5;
  } else if (activity === 'course' && v > 0) {
    kcalMin = (0.2 * v + 0.9 * v * grade + 3.5) * kg / 1000 * 5;
  } else {
    let met = (CARDIO_TYPES[activity] || CARDIO_TYPES.autre).met;
    if (rpe) met *= 0.6 + 0.08 * Number(rpe); // ajustement selon l'intensité ressentie (RPE 5 ≈ valeur de base)
    kcalMin = met * 3.5 * kg / 200;
  }
  return Math.round(kcalMin * min);
}

export function currentBodyWeight(db) {
  const m = db.one('SELECT weight_kg FROM body_metrics WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1', USER_ID);
  return m?.weight_kg || getProfile(db).body_weight_kg || null;
}

// --- Statistiques ---
export function periodStats(db, from, to) {
  const w = db.one(`SELECT COUNT(*) n, COALESCE(SUM(duration_sec),0) dur, AVG(rpe) rpe FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ?`, USER_ID, from, to);
  const s = db.one(`SELECT COUNT(*) sets, COALESCE(SUM(volume_lbs),0) vol, COALESCE(SUM(reps),0) reps FROM v_set_volume WHERE user_id = ? AND completed = 1 AND date BETWEEN ? AND ?`, USER_ID, from, to);
  const c = db.one(`SELECT COUNT(*) n, COALESCE(SUM(duration_min),0) min, COALESCE(SUM(distance_km),0) km, COALESCE(SUM(calories),0) kcal FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?`, USER_ID, from, to);
  const days = diffDays(from, to) + 1;
  return {
    from, to, days,
    workouts: w.n, training_minutes: Math.round(w.dur / 60), avg_rpe: w.rpe ? Math.round(w.rpe * 10) / 10 : null,
    sets: s.sets, reps: s.reps, volume_lbs: Math.round(s.vol),
    cardio_sessions: c.n, cardio_minutes: Math.round(c.min), cardio_km: Math.round(c.km * 10) / 10, cardio_kcal: Math.round(c.kcal),
    workouts_per_week: Math.round((w.n / days) * 7 * 10) / 10,
  };
}

export function exercisePeriodBest(db, from, to) {
  return db.all(`SELECT e.id exercise_id, e.name, e.kind, MAX(s.weight) max_weight, s.weight_unit unit, MAX(s.reps) max_reps, COUNT(*) sets,
      ROUND(SUM(CASE WHEN e.kind='assisted' OR s.weight IS NULL THEN 0 ELSE s.weight * COALESCE(s.reps,0) END)) volume
    FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ? GROUP BY e.id ORDER BY e.name`, USER_ID, from, to)
    .map((r) => (r.kind === 'assisted'
      ? { ...r, max_weight: db.one(`SELECT MIN(s.weight) m FROM workout_sets s JOIN workouts w ON w.id = s.workout_id WHERE s.exercise_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ?`, r.exercise_id, from, to).m }
      : r));
}

export function weeklySeries(db, today, weeks = 12) {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  const out = [];
  for (let i = 0; i < weeks; i++) {
    const from = addDays(start, i * 7); const to = addDays(from, 6);
    const p = periodStats(db, from, to);
    out.push({ week: from, workouts: p.workouts, volume_lbs: p.volume_lbs, cardio_minutes: p.cardio_minutes, training_minutes: p.training_minutes, sets: p.sets });
  }
  return out;
}

export function monthlySeries(db, today, months = 6) {
  const out = []; let m = monthStart(today);
  const list = [];
  for (let i = 0; i < months; i++) { list.unshift(m); const d = new Date(m + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); m = d.toISOString().slice(0, 10); }
  for (const from of list) {
    const d = new Date(from + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
    const to = d.toISOString().slice(0, 10);
    const p = periodStats(db, from, to);
    out.push({ month: from.slice(0, 7), workouts: p.workouts, volume_lbs: p.volume_lbs, cardio_minutes: p.cardio_minutes, sets: p.sets, training_minutes: p.training_minutes });
  }
  return out;
}

// Série temporelle d'un exercice : meilleure charge, reps, volume, 1RM estimé (Epley)
export function exerciseSeries(db, exerciseId) {
  const ex = exerciseRow(db.one('SELECT * FROM exercises WHERE id = ?', exerciseId));
  if (!ex) return null;
  const rows = db.all(`SELECT w.id workout_id, w.date, s.set_index, s.weight, s.weight_unit, s.reps, s.completed
    FROM workout_sets s JOIN workouts w ON w.id = s.workout_id WHERE w.user_id = ? AND s.exercise_id = ? ORDER BY w.date, w.id, s.set_index`, USER_ID, exerciseId);
  const by = new Map();
  for (const r of rows) { if (!by.has(r.workout_id)) by.set(r.workout_id, { date: r.date, sets: [] }); by.get(r.workout_id).sets.push(r); }
  const points = [...by.values()].map(({ date, sets }) => {
    const done = sets.filter((s) => s.completed);
    const ws = done.filter((s) => s.weight != null);
    const top = ex.kind === 'assisted' ? (ws.length ? Math.min(...ws.map((s) => s.weight)) : null) : (ws.length ? Math.max(...ws.map((s) => s.weight)) : null);
    const reps = done.map((s) => s.reps || 0);
    const vol = ex.kind === 'assisted' ? 0 : ws.reduce((a, s) => a + s.weight * (s.reps || 0), 0);
    const est = ex.kind === 'weighted' ? ws.map((s) => e1rm(s.weight, s.reps)).filter((v) => v != null) : [];
    const e1 = est.length ? r1(Math.max(...est)) : null;
    return { date, top_weight: top, unit: sets[0].weight_unit, total_reps: reps.reduce((a, b) => a + b, 0), best_reps: reps.length ? Math.max(...reps) : 0, avg_reps: reps.length ? Math.round(reps.reduce((a, b) => a + b, 0) / reps.length * 10) / 10 : 0, volume: Math.round(vol), e1rm: e1, sets: sets.length };
  });
  return { exercise: ex, points };
}

// Records personnels récents (meilleure charge battue)
export function recentRecords(db, limit = 6) { return allRecords(db).reverse().slice(0, limit); }

// Tous les records battus (charge max, ou assistance plus faible), dans l'ordre chronologique.
// Les charges sont comparées en lbs pour qu'un changement d'unité (kg ↔ lbs) ne crée pas de faux record.
export function allRecords(db) {
  const rows = db.all(`SELECT s.exercise_id, e.name, e.kind, w.date, w.id wid, s.weight, s.weight_unit unit
    FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND s.weight IS NOT NULL ORDER BY w.date, w.id`, USER_ID);
  // Meilleure série de chaque séance pour chaque exercice
  const per = new Map();
  for (const r of rows) {
    const k = `${r.exercise_id}|${r.wid}`; const v = toLbs(r.weight, r.unit); const cur = per.get(k);
    const better = !cur || (r.kind === 'assisted' ? v < cur.v : v > cur.v);
    if (better) per.set(k, { ...r, v });
  }
  const best = new Map(); const records = [];
  for (const r of per.values()) {
    const prev = best.get(r.exercise_id);
    const better = prev != null && (r.kind === 'assisted' ? r.v < prev.v - 1e-9 : r.v > prev.v + 1e-9);
    if (better) records.push({ exercise_id: r.exercise_id, name: r.name, date: r.date, weight: r1(r.weight), previous: r1(prev.unit === r.unit ? prev.weight : (r.unit === 'kg' ? prev.v / 2.20462 : prev.v)), unit: r.unit, assisted: r.kind === 'assisted' });
    if (prev == null || better) best.set(r.exercise_id, r);
  }
  return records;
}

// Poids corporel : la dernière pesée est la source de vérité, le poids du profil n'est qu'un repli
export function bodyWeightInfo(db) {
  const rows = db.all('SELECT id, date, weight_kg FROM body_metrics WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY date, id', USER_ID);
  const sm = smoothedWeight(rows);
  return sm ? { ...sm, source: 'pesee' } : (getProfile(db).body_weight_kg ? { value: getProfile(db).body_weight_kg, last: getProfile(db).body_weight_kg, n: 0, date: null, source: 'profil' } : null);
}

// Le poids du profil suit la dernière pesée (un seul chiffre affiché partout)
export function syncProfileWeight(db) {
  const m = db.one('SELECT weight_kg FROM body_metrics WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1', USER_ID);
  if (m) db.run("UPDATE profiles SET body_weight_kg = ?, updated_at = datetime('now') WHERE user_id = ?", m.weight_kg, USER_ID);
}

// Avec `draft`, calcule la valeur actuelle d'un objectif pas encore enregistré (point de départ à la création)
export function goalsWithProgress(db, today, draft = null) {
  const goals = draft
    ? [{ ...draft, start_value: null, current_value: null, created_at: today, exercise_kind: draft.exercise_id ? db.one('SELECT kind FROM exercises WHERE id = ?', draft.exercise_id)?.kind : null }]
    : db.all('SELECT g.*, e.name exercise_name, e.kind exercise_kind FROM goals g LEFT JOIN exercises e ON e.id = g.exercise_id WHERE g.user_id = ? ORDER BY g.status, g.created_at DESC', USER_ID);
  const ws = weekStart(today);
  const bw = goals.some((g) => g.type === 'poids_corporel') ? bodyWeightInfo(db) : null;
  const out = goals.map((g) => {
    let current = g.current_value; let start = g.start_value; let lower = null; let basis = null;
    if (g.type === 'charge' && g.exercise_id) {
      // Meilleure charge, convertie dans l'unité de l'objectif
      const assisted = g.exercise_kind === 'assisted'; lower = assisted;
      const sets = db.all('SELECT s.weight, s.weight_unit FROM workout_sets s JOIN workouts w ON w.id = s.workout_id WHERE w.user_id = ? AND s.exercise_id = ? AND s.completed = 1 AND s.weight IS NOT NULL', USER_ID, g.exercise_id);
      const vals = sets.map((x) => toLbs(x.weight, x.weight_unit));
      const bestLbs = vals.length ? (assisted ? Math.min(...vals) : Math.max(...vals)) : null;
      current = bestLbs == null ? null : r1(g.unit === 'kg' ? bestLbs / 2.20462 : bestLbs);
      basis = 'Meilleure charge validée';
    } else if (g.type === 'seances_semaine') {
      current = db.one('SELECT COUNT(*) n FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, ws, addDays(ws, 6)).n;
      start = 0; basis = 'Séances de la semaine en cours';
    } else if (g.type === 'cardio_minutes_semaine') {
      current = Math.round(db.one('SELECT COALESCE(SUM(duration_min),0) m FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, ws, addDays(ws, 6)).m);
      start = 0; basis = 'Minutes de cardio de la semaine en cours';
    } else if (g.type === 'cardio_km_semaine') {
      current = Math.round(db.one('SELECT COALESCE(SUM(distance_km),0) k FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, ws, addDays(ws, 6)).k * 10) / 10;
      start = 0; basis = 'Kilomètres de cardio de la semaine en cours';
    } else if (g.type === 'tour_de_taille') {
      current = db.one('SELECT waist_cm v FROM body_metrics WHERE user_id = ? AND waist_cm IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1', USER_ID)?.v ?? null;
      basis = 'Dernier tour de taille mesuré';
    } else if (g.type === 'poids_corporel') {
      current = bw?.value ?? null;
      basis = bw?.source === 'pesee' ? `Moyenne des pesées sur 7 jours (${bw.n})` : 'Poids du profil';
      // Départ : valeur saisie, sinon première pesée depuis la création de l'objectif
      if (start == null) {
        const first = db.one('SELECT weight_kg FROM body_metrics WHERE user_id = ? AND weight_kg IS NOT NULL AND date <= ? ORDER BY date DESC, id DESC LIMIT 1', USER_ID, String(g.created_at).slice(0, 10))
          || db.one('SELECT weight_kg FROM body_metrics WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY date, id LIMIT 1', USER_ID);
        start = first?.weight_kg ?? null;
      }
    }
    if (lower == null && start != null && g.target_value != null) lower = g.target_value < start;
    const reached = goalReached(start, current, g.target_value, lower ?? undefined);
    let progress = goalProgress(start, current, g.target_value);
    if (progress == null && current != null && g.target_value) progress = reached ? 1 : (lower ? null : Math.max(0, Math.min(1, current / g.target_value)));
    return { ...g, current_value: current, start_used: start, progress, reached, lower_is_better: !!lower, basis };
  });
  return draft ? out[0] : out;
}

// Meilleures performances par exercice (charge max ou assistance min, 1RM estimé), en lbs.
// `before` : ne compte que les séances antérieures à { date, id } (pour juger un record a posteriori).
export function exerciseBests(db, before = null) {
  const rows = db.all(`SELECT s.exercise_id id, e.kind, s.weight, s.weight_unit unit, s.reps, w.date, w.id wid FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND s.weight IS NOT NULL AND s.weight > 0`, USER_ID);
  const out = new Map();
  for (const r of rows) {
    if (before && (r.date > before.date || (r.date === before.date && r.wid >= before.id))) continue;
    const v = toLbs(r.weight, r.unit); const b = out.get(r.id) || { kind: r.kind, top_lbs: null, e1rm_lbs: null };
    if (b.top_lbs == null || (r.kind === 'assisted' ? v < b.top_lbs : v > b.top_lbs)) b.top_lbs = v;
    if (r.kind !== 'assisted') { const e = e1rm(v, r.reps); if (e && (b.e1rm_lbs == null || e > b.e1rm_lbs)) b.e1rm_lbs = e; }
    out.set(r.id, b);
  }
  return out;
}
