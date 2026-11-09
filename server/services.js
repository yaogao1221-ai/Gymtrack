import { toJSON } from './schema.js';
import { addDays, weekStart, monthStart, diffDays } from './util.js';
import { DEFAULT_SCHEDULE } from './seed.js';

export const USER_ID = 1; // application personnelle mono-utilisateur (la table users permet d'évoluer)

export function exerciseRow(e) {
  return e && { ...e, muscles: toJSON(e.muscles, {}), in_library_only: !!e.in_library_only };
}

export function getProfile(db) {
  const p = db.one('SELECT p.*, u.name FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?', USER_ID);
  return { ...p, onboarded: !!p.onboarded, schedule: toJSON(p.schedule, DEFAULT_SCHEDULE), available_days: toJSON(p.available_days, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']), cardio_preferred: toJSON(p.cardio_preferred, []) };
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
  const exStmt = db.prepare(`SELECT pe.*, e.name, e.slug, e.pattern, e.muscles, e.kind, e.equipment, e.technique
    FROM program_exercises pe JOIN exercises e ON e.id = pe.exercise_id WHERE pe.day_id = ? ORDER BY pe.position`);
  for (const d of days) {
    d.exercises = exStmt.all(d.id).map((pe) => ({
      ...pe, muscles: toJSON(pe.muscles, {}),
      last: withLast ? lastPerformance(db, pe.exercise_id) : undefined,
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
    const e1rm = ex.kind === 'weighted' && ws.length ? Math.max(...ws.map((s) => s.weight * (1 + (s.reps || 0) / 30))) : null;
    return { date, top_weight: top, unit: sets[0].weight_unit, total_reps: reps.reduce((a, b) => a + b, 0), best_reps: reps.length ? Math.max(...reps) : 0, avg_reps: reps.length ? Math.round(reps.reduce((a, b) => a + b, 0) / reps.length * 10) / 10 : 0, volume: Math.round(vol), e1rm: e1rm ? Math.round(e1rm * 10) / 10 : null, sets: sets.length };
  });
  return { exercise: ex, points };
}

// Records personnels récents (meilleure charge battue)
export function recentRecords(db, limit = 6) {
  const rows = db.all(`SELECT s.exercise_id, e.name, e.kind, w.date, w.id wid, MAX(s.weight) w, MIN(s.weight) wmin, s.weight_unit unit
    FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND s.weight IS NOT NULL GROUP BY s.exercise_id, w.id ORDER BY w.date, w.id`, USER_ID);
  const best = new Map(); const records = [];
  for (const r of rows) {
    const val = r.kind === 'assisted' ? r.wmin : r.w;
    const prev = best.get(r.exercise_id);
    const better = prev == null ? false : (r.kind === 'assisted' ? val < prev : val > prev);
    if (better) records.push({ exercise_id: r.exercise_id, name: r.name, date: r.date, weight: val, previous: prev, unit: r.unit, assisted: r.kind === 'assisted' });
    if (prev == null || better) best.set(r.exercise_id, val);
  }
  return records.reverse().slice(0, limit);
}

export function goalsWithProgress(db, today) {
  const goals = db.all('SELECT g.*, e.name exercise_name, e.kind exercise_kind FROM goals g LEFT JOIN exercises e ON e.id = g.exercise_id WHERE g.user_id = ? ORDER BY g.status, g.created_at DESC', USER_ID);
  const ws = weekStart(today);
  return goals.map((g) => {
    let current = g.current_value;
    if (g.type === 'charge' && g.exercise_id) {
      const agg = g.exercise_kind === 'assisted' ? 'MIN' : 'MAX';
      current = db.one(`SELECT ${agg}(s.weight) v FROM workout_sets s JOIN workouts w ON w.id = s.workout_id WHERE w.user_id = ? AND s.exercise_id = ? AND s.completed = 1`, USER_ID, g.exercise_id).v;
    } else if (g.type === 'seances_semaine') {
      current = db.one('SELECT COUNT(*) n FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, ws, addDays(ws, 6)).n;
    } else if (g.type === 'cardio_minutes_semaine') {
      current = Math.round(db.one('SELECT COALESCE(SUM(duration_min),0) m FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, ws, addDays(ws, 6)).m);
    } else if (g.type === 'poids_corporel') {
      current = currentBodyWeight(db);
    }
    let progress = null;
    if (current != null && g.target_value != null) {
      const start = g.start_value ?? (g.type === 'seances_semaine' || g.type === 'cardio_minutes_semaine' ? 0 : null);
      if (start != null && start !== g.target_value) progress = (current - start) / (g.target_value - start);
      else if (start == null) progress = g.target_value ? (g.exercise_kind === 'assisted' ? g.target_value / current : current / g.target_value) : null;
      if (progress != null) progress = Math.max(0, Math.min(1, progress));
    }
    return { ...g, current_value: current, progress };
  });
}
