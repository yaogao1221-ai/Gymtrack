import { Router } from 'express';
import { periodStats, allRecords, getProgram, exerciseSeries, workoutSummary, getProfile, USER_ID } from '../services.js';
import { addDays, weekStart } from '../util.js';

// Barème de la ligue : identique pour tout le monde, calculé sur chaque téléphone
export const POINTS = { workout: 10, km: 5, record: 15, steps1000: 1 };

const monthStart = (d) => d.slice(0, 8) + '01';
const monthEnd = (d) => { const [y, m] = d.split('-').map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return `${d.slice(0, 8)}${String(last).padStart(2, '0')}`; };
const prevMonth = (d) => { const [y, m] = d.split('-').map(Number); return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`; };
const isoWeekKey = (monday) => {
  const d = new Date(monday + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 3); // jeudi de la semaine
  const y = d.getUTCFullYear(); const w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `W${y}-${String(w).padStart(2, '0')}`;
};

export function leaguePeriods(today) {
  const ws = weekStart(today); const pws = addDays(ws, -7); const ms = monthStart(today); const pms = prevMonth(today);
  return [
    { key: isoWeekKey(ws), kind: 'week', from: ws, to: addDays(ws, 6), current: true },
    { key: isoWeekKey(pws), kind: 'week', from: pws, to: addDays(pws, 6), current: false },
    { key: 'M' + ms.slice(0, 7), kind: 'month', from: ms, to: monthEnd(ms), current: true },
    { key: 'M' + pms.slice(0, 7), kind: 'month', from: pms, to: monthEnd(pms), current: false },
  ];
}

export default function leagueRoutes(db) {
  const r = Router();
  // Bilan à partager avec la ligue : uniquement des totaux, jamais le détail des séances
  r.get('/league/summary', (req, res) => {
    const records = allRecords(db);
    const periods = leaguePeriods(req.today).map((p) => {
      const s = periodStats(db, p.from, p.to);
      const prs = records.filter((x) => x.date >= p.from && x.date <= p.to).length;
      const stats = { km: s.cardio_km, cardio_min: s.cardio_minutes, cardio_n: s.cardio_sessions, workouts: s.workouts, sets: s.sets, prs };
      return { ...p, stats };
    });
    // Badges personnels (cumul depuis le début)
    const all = periodStats(db, '0000-01-01', req.today);
    let streak = 0; // semaines d'affilée avec au moins une séance (muscu ou cardio)
    for (let ws = weekStart(req.today), i = 0; i < 104; i++, ws = addDays(ws, -7)) {
      const s = periodStats(db, ws, addDays(ws, 6));
      if (s.workouts + s.cardio_sessions > 0) streak++; else if (i > 0) break;
    }
    const badges = [
      { id: 'first', label: 'Première séance', got: all.workouts >= 1 },
      { id: 'w10', label: '10 séances muscu', got: all.workouts >= 10 },
      { id: 'w50', label: '50 séances muscu', got: all.workouts >= 50 },
      { id: 'km42', label: 'Marathon cumulé (42 km)', got: all.cardio_km >= 42.2 },
      { id: 'km100', label: '100 km de cardio', got: all.cardio_km >= 100 },
      { id: 'pr5', label: '5 records battus', got: records.length >= 5 },
      { id: 'pr20', label: '20 records battus', got: records.length >= 20 },
      { id: 'streak4', label: '4 semaines d’affilée', got: streak >= 4 },
      { id: 'streak12', label: '12 semaines d’affilée', got: streak >= 12 },
    ];
    res.json({ periods, streak, badges, points: POINTS });
  });

  // Programme complet + progression, partagé seulement si la personne l’active dans la ligue
  r.get('/league/share', (req, res) => res.json(sharePayload(db, req.today)));
  return r;
}

export function sharePayload(db, today) {
  const profile = getProfile(db) || {};
  const { program, days } = getProgram(db, { withLast: false });
  const exIds = new Set();
  const outDays = days.map((d) => ({
    code: d.code, name: d.name, focus: d.focus,
    exercises: d.exercises.map((e) => {
      exIds.add(e.exercise_id);
      return { id: e.exercise_id, name: e.name, kind: e.kind, sets: e.sets, reps: e.reps, reps_note: e.reps_note, w: e.target_weight, wmax: e.target_weight_max, unit: e.weight_unit, wnote: e.weight_note, rest: e.rest_seconds, ss: e.superset_group, notes: e.notes };
    }),
    cardio: d.cardio.map((c) => ({ label: c.label, min: c.duration_min, kmh: c.speed_kmh, incl: c.incline_pct, at: c.placement })),
  }));
  const progress = [...exIds].map((id) => {
    const s = exerciseSeries(db, id); if (!s) return null;
    const pts = s.points.filter((p) => p.top_weight != null || p.best_reps);
    if (!pts.length) return null;
    const first = pts[0]; const last = pts.at(-1);
    return {
      id, name: s.exercise.name, kind: s.exercise.kind, unit: last.unit, sessions: pts.length,
      first: { date: first.date, top: first.top_weight, reps: first.best_reps },
      last: { date: last.date, top: last.top_weight, reps: last.best_reps, e1rm: last.e1rm },
      points: pts.slice(-12).map((p) => [p.date, p.top_weight, p.best_reps]),
    };
  }).filter(Boolean);
  const setsOf = db.prepare(`SELECT e.name, s.weight, s.weight_unit unit, s.reps FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id
    WHERE s.workout_id = ? AND s.completed = 1 ORDER BY s.position, s.set_index`);
  const recent = db.all('SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 6', USER_ID).map((w) => {
    const sm = workoutSummary(db, w);
    const ex = [];
    for (const x of setsOf.all(w.id)) {
      let g = ex.at(-1);
      if (!g || g.name !== x.name) { g = { name: x.name, unit: x.unit, sets: [] }; ex.push(g); }
      g.sets.push([x.weight, x.reps]);
    }
    return { date: w.date, name: w.name, min: Math.round((w.duration_sec || 0) / 60), rpe: w.rpe, volume: sm.volume_lbs, ex };
  });
  const records = allRecords(db).slice(-10).reverse().map((x) => ({ name: x.name, date: x.date, w: x.weight, prev: x.previous, unit: x.unit, assisted: x.assisted }));
  return {
    v: 1, date: today, level: profile.level || null, goal: profile.goal || null, per_week: profile.sessions_per_week || null,
    program: program ? { name: program.name, days: outDays } : null, progress, recent, records,
  };
}
