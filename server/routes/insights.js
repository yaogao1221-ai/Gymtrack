// Progrès détaillés, carte du corps, trophées et journal alimentaire
import { Router } from 'express';
import { USER_ID, getProfile, allRecords } from '../services.js';
import { toJSON } from '../schema.js';
import { MUSCLES } from '../seed.js';
import { RANGES, PAIN_AREAS } from '../analysis.js';
import { e1rm, toLbs, r1 } from '../formulas.js';
import { nutritionState } from '../nutrition.js';
import { num, str, oneOf, date, bad, notFound, addDays, weekStart, diffDays } from '../util.js';

const r0 = (x) => (x == null ? null : Math.round(x));
const MEALS = ['petit_dej', 'dejeuner', 'collation', 'diner'];

// Séries validées par muscle (coefficient : 1 = muscle principal, 0,5 = secondaire)
function muscleSets(db, from, to) {
  const rows = db.all(`SELECT w.date, e.muscles, COUNT(*) n FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ? GROUP BY w.date, e.id`, USER_ID, from, to);
  const sets = {}; const last = {};
  for (const r of rows) {
    for (const [m, c] of Object.entries(toJSON(r.muscles, {}))) {
      sets[m] = (sets[m] || 0) + r.n * c;
      if (c >= 0.5 && (!last[m] || r.date > last[m])) last[m] = r.date;
    }
  }
  return { sets, last };
}

// Trophées : calculés à partir des données, rien n'est stocké
function badges(db, today) {
  const ws = db.all('SELECT date FROM workouts WHERE user_id = ? ORDER BY date', USER_ID).map((w) => w.date);
  const n = ws.length;
  const weeks = new Set(ws.map(weekStart));
  let streak = 0; for (let w = weekStart(today); weeks.has(w) || (w === weekStart(today) && streak === 0); w = addDays(w, -7)) { if (weeks.has(w)) streak++; else if (w !== weekStart(today)) break; if (streak > 200) break; }
  let best = 0, cur = 0, prev = null;
  for (const w of [...weeks].sort()) { cur = prev && diffDays(prev, w) === 7 ? cur + 1 : 1; best = Math.max(best, cur); prev = w; }
  const recs = allRecords(db);
  const vol = db.one('SELECT COALESCE(SUM(volume_lbs),0) v FROM v_set_volume WHERE user_id = ?', USER_ID).v;
  const cardio = db.one('SELECT COUNT(*) n, COALESCE(SUM(duration_min),0) m FROM cardio_sessions WHERE user_id = ?', USER_ID);
  const weighs = db.one('SELECT COUNT(*) n FROM body_metrics WHERE user_id = ? AND weight_kg IS NOT NULL', USER_ID).n;
  const early = db.one("SELECT COUNT(*) n FROM workouts WHERE user_id = ? AND started_at IS NOT NULL AND CAST(strftime('%H', started_at) AS INTEGER) < 8", USER_ID).n;
  const reached = db.one("SELECT COUNT(*) n FROM goals WHERE user_id = ? AND status = 'atteint'", USER_ID).n;
  const B = (id, art, label, text, value, target) => ({ id, art, label, text, value: Math.min(value, target), target, earned: value >= target });
  return {
    streak_weeks: streak, best_streak_weeks: best, workouts: n,
    list: [
      B('first', 'medal', 'Première séance', 'Enregistrer une séance', n, 1),
      B('s10', 'dumbbell', '10 séances', 'La régularité commence ici', n, 10),
      B('s50', 'dumbbell', '50 séances', 'Habitude installée', n, 50),
      B('s100', 'trophy', '100 séances', 'Club des 100', n, 100),
      B('w4', 'flame', '4 semaines d’affilée', 'Au moins une séance chaque semaine pendant 4 semaines', best, 4),
      B('w12', 'flame', '12 semaines d’affilée', 'Un trimestre sans lâcher', best, 12),
      B('pr1', 'star', 'Premier record', 'Battre une de tes meilleures charges', recs.length, 1),
      B('pr25', 'star', '25 records', 'Progression continue', recs.length, 25),
      B('t100k', 'chart', '100 000 lbs soulevées', 'Volume total cumulé', Math.round(vol), 100000),
      B('t1m', 'chart', '1 million de lbs', 'Volume total cumulé', Math.round(vol), 1000000),
      B('c20', 'heart', '20 séances de cardio', 'Le cœur suit', cardio.n, 20),
      B('c1000', 'heart', '1 000 min de cardio', 'Endurance', Math.round(cardio.m), 1000),
      B('weigh30', 'scale', '30 pesées', 'Le suivi qui rend la cure fiable', weighs, 30),
      B('early', 'sun', 'Lève-tôt', '5 séances commencées avant 8 h', early, 5),
      B('goal', 'target', 'Objectif atteint', 'Atteindre un de tes objectifs', reached, 1),
    ],
  };
}

export default function insightsRoutes(db) {
  const r = Router();

  // Progrès : force relative des exercices principaux, séries par muscle, régularité
  r.get('/stats/progress', (req, res) => {
    const today = req.today; const weeks = Math.max(4, Math.min(52, Number(req.query.weeks) || 12));
    const from = addDays(weekStart(today), -7 * (weeks - 1));
    const wkeys = Array.from({ length: weeks }, (_, i) => addDays(from, 7 * i));
    // Exercices principaux : les plus pratiqués avec charge
    const main = db.all(`SELECT e.id, e.name, COUNT(DISTINCT w.id) n FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
      WHERE w.user_id = ? AND s.completed = 1 AND s.weight > 0 AND e.kind = 'weighted' AND w.date >= ? GROUP BY e.id ORDER BY n DESC LIMIT 5`, USER_ID, from);
    const lifts = main.map((ex) => {
      const rows = db.all(`SELECT w.date, s.weight, s.weight_unit u, s.reps FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
        WHERE w.user_id = ? AND s.exercise_id = ? AND s.completed = 1 AND s.weight > 0 AND w.date >= ?`, USER_ID, ex.id, from);
      const per = {}; for (const x of rows) { const k = weekStart(x.date); const v = e1rm(toLbs(x.weight, x.u), x.reps); if (v && (!per[k] || v > per[k])) per[k] = v; }
      const series = wkeys.map((k) => (per[k] ? r1(per[k]) : null));
      const first = series.find((v) => v != null); const lastV = [...series].reverse().find((v) => v != null);
      return { id: ex.id, name: ex.name, sessions: ex.n, e1rm: series, pct: series.map((v) => (v && first ? r1((v / first - 1) * 100) : null)), gain_pct: first && lastV ? r1((lastV / first - 1) * 100) : null, now: lastV };
    });
    // Séries par muscle : moyenne hebdo sur 4 semaines vs fourchette conseillée
    const level = getProfile(db).level || 'intermediaire'; const [minS, optLow, optHigh] = RANGES[level] || RANGES.intermediaire;
    const m4 = muscleSets(db, addDays(today, -27), today).sets;
    const muscles = Object.entries(MUSCLES).map(([k, label]) => ({ key: k, label, sets: r1((m4[k] || 0) / 4) }))
      .map((m) => ({ ...m, zone: m.sets < minS ? 'bas' : m.sets < optLow ? 'correct' : m.sets <= optHigh ? 'optimal' : 'haut' }));
    // Régularité : jours d'entraînement (carte de chaleur) et séances par semaine
    const hfrom = addDays(weekStart(today), -7 * 25);
    const days = {};
    for (const w of db.all('SELECT date, COUNT(*) n FROM workouts WHERE user_id = ? AND date >= ? GROUP BY date', USER_ID, hfrom)) days[w.date] = (days[w.date] || 0) + 2 * w.n;
    for (const c of db.all('SELECT date, COUNT(*) n FROM cardio_sessions WHERE user_id = ? AND date >= ? GROUP BY date', USER_ID, hfrom)) days[c.date] = (days[c.date] || 0) + c.n;
    const weekly = wkeys.map((k) => {
      const a = db.one('SELECT COUNT(*) n, COALESCE(SUM(duration_sec),0) d FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, k, addDays(k, 6));
      const v = db.one('SELECT COALESCE(SUM(volume_lbs),0) v, COUNT(*) s FROM v_set_volume WHERE user_id = ? AND completed = 1 AND date BETWEEN ? AND ?', USER_ID, k, addDays(k, 6));
      return { week: k, workouts: a.n, minutes: Math.round(a.d / 60), volume_lbs: Math.round(v.v), sets: v.s };
    });
    const recs = allRecords(db);
    const recByWeek = wkeys.map((k) => recs.filter((x) => x.date >= k && x.date <= addDays(k, 6)).length);
    const b = badges(db, today);
    res.json({ weeks: wkeys, lifts, muscles, range: { min: minS, low: optLow, high: optHigh, level }, heat: { from: hfrom, to: today, days }, weekly, records_by_week: recByWeek,
      kpi: { streak_weeks: b.streak_weeks, records_30d: recs.filter((x) => x.date >= addDays(today, -29)).length, workouts: b.workouts,
        sessions_per_week: r1(weekly.slice(-4).reduce((a, w) => a + w.workouts, 0) / 4), target_per_week: getProfile(db).sessions_per_week || null } });
  });

  // Carte du corps : charge de la semaine et récupération estimée de chaque muscle
  r.get('/bodymap', (req, res) => {
    const today = req.today; const { sets, last } = muscleSets(db, addDays(today, -6), today);
    const older = muscleSets(db, addDays(today, -13), today).last;
    const level = getProfile(db).level || 'intermediaire'; const [minS, optLow, optHigh] = RANGES[level] || RANGES.intermediaire;
    const muscles = Object.fromEntries(Object.entries(MUSCLES).map(([k, label]) => {
      const s = r1(sets[k] || 0); const l = last[k] || older[k] || null; const days = l ? diffDays(l, today) : null;
      // Muscle chargé hier ou aujourd'hui avec un vrai volume = encore en récupération (48 à 72 h selon le volume)
      const status = days == null || days > 9 ? 'oublie' : days <= 1 && s >= 3 ? 'fatigue' : days <= 2 && s >= 6 ? 'recup' : 'pret';
      return [k, { label, sets: s, last: l, days, status, zone: s < minS / 2 ? 'bas' : s < optLow ? 'correct' : s <= optHigh ? 'optimal' : 'haut' }];
    }));
    const pains = db.all('SELECT * FROM pain_reports WHERE user_id = ? AND resolved = 0 ORDER BY date DESC', USER_ID).map((p) => ({ ...p, label: PAIN_AREAS[p.area]?.label || p.area }));
    res.json({ muscles, pains, range: { min: minS, low: optLow, high: optHigh } });
  });

  r.get('/badges', (req, res) => res.json(badges(db, req.today)));

  // Journal alimentaire
  const foodDay = (d) => {
    const logs = db.all('SELECT * FROM food_logs WHERE user_id = ? AND date = ? ORDER BY id', USER_ID, d).map((x) => ({ ...x, per100: toJSON(x.per100, null) }));
    const t = logs.reduce((a, x) => ({ kcal: a.kcal + x.kcal, protein_g: a.protein_g + x.protein_g, carbs_g: a.carbs_g + x.carbs_g, fat_g: a.fat_g + x.fat_g }), { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    let target = null;
    try {
      const ns = nutritionState(db, d);
      if (ns.plan) target = { kcal: ns.plan.in_break ? ns.tdee : ns.plan.kcal, protein_g: ns.plan.protein_g, carbs_g: ns.plan.carbs_g, fat_g: ns.plan.fat_g, source: ns.plan.label };
      else if (ns.tdee) target = { kcal: ns.tdee, protein_g: ns.weight_kg ? Math.round(ns.weight_kg * 1.8) : null, carbs_g: null, fat_g: null, source: 'Maintien (dépense estimée)' };
    } catch { /* profil incomplet */ }
    return { date: d, logs, totals: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, r0(v)])), target };
  };
  r.get('/food', (req, res) => {
    const d = req.query.date ? date(req.query.date) : req.today;
    const recent = db.all(`SELECT name, food_code, per100, grams, MAX(id) last FROM food_logs WHERE user_id = ? AND per100 IS NOT NULL GROUP BY name ORDER BY last DESC LIMIT 12`, USER_ID)
      .map((x) => ({ name: x.name, food_code: x.food_code, per100: toJSON(x.per100, null), grams: x.grams }));
    const week = Array.from({ length: 7 }, (_, i) => addDays(d, i - 6)).map((x) => ({ date: x, kcal: r0(db.one('SELECT COALESCE(SUM(kcal),0) k FROM food_logs WHERE user_id = ? AND date = ?', USER_ID, x).k) }));
    res.json({ ...foodDay(d), recent, week });
  });
  const per100 = (p) => {
    if (!p || typeof p !== 'object') throw bad('Valeurs nutritionnelles manquantes');
    const v = (x, f) => num(x ?? 0, f, { min: 0, max: f === 'kcal' ? 950 : 100 }) || 0;
    return { k: v(p.k, 'kcal'), p: v(p.p, 'protéines'), g: v(p.g, 'glucides'), l: v(p.l, 'lipides') };
  };
  const calc = (p, g) => ({ kcal: r1(p.k * g / 100), protein_g: r1(p.p * g / 100), carbs_g: r1(p.g * g / 100), fat_g: r1(p.l * g / 100) });
  r.post('/food', (req, res) => {
    const b = req.body; const p = per100(b.per100);
    const g = num(b.grams, 'quantité', { min: 1, max: 5000 }); if (!g) throw bad('Quantité en grammes requise');
    const v = calc(p, g);
    const info = db.run('INSERT INTO food_logs (user_id, date, meal, food_code, name, grams, kcal, protein_g, carbs_g, fat_g, per100) VALUES (?,?,?,?,?,?,?,?,?,?,?)', USER_ID,
      b.date ? date(b.date) : req.today, oneOf(b.meal, 'repas', MEALS) || 'dejeuner', str(b.food_code, 'code', { max: 20 }), str(b.name, 'aliment', { required: true, max: 120 }),
      g, v.kcal, v.protein_g, v.carbs_g, v.fat_g, JSON.stringify(p));
    res.status(201).json(db.one('SELECT * FROM food_logs WHERE id = ?', info.lastInsertRowid));
  });
  r.patch('/food/:id', (req, res) => {
    const x = db.one('SELECT * FROM food_logs WHERE id = ? AND user_id = ?', req.params.id, USER_ID); if (!x) throw notFound();
    const g = req.body.grams != null ? num(req.body.grams, 'quantité', { min: 1, max: 5000 }) : x.grams;
    const meal = req.body.meal != null ? oneOf(req.body.meal, 'repas', MEALS, { required: true }) : x.meal;
    const p = toJSON(x.per100, null); const v = p ? calc(p, g) : { kcal: x.kcal * g / x.grams, protein_g: x.protein_g * g / x.grams, carbs_g: x.carbs_g * g / x.grams, fat_g: x.fat_g * g / x.grams };
    db.run('UPDATE food_logs SET grams = ?, meal = ?, kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ? WHERE id = ?', g, meal, v.kcal, v.protein_g, v.carbs_g, v.fat_g, x.id);
    res.json(db.one('SELECT * FROM food_logs WHERE id = ?', x.id));
  });
  r.delete('/food/:id', (req, res) => { if (!db.run('DELETE FROM food_logs WHERE id = ? AND user_id = ?', req.params.id, USER_ID).changes) throw notFound(); res.json({ ok: true }); });

  return r;
}
