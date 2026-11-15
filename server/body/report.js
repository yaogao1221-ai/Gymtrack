// Rapports du volet Corps (semaine, mois), tendances de nutrition et de mensurations. Uniquement des données enregistrées :
// une valeur absente reste absente (null), jamais remplacée par une estimation.
import { USER_ID } from '../services.js';
import { periodStats, allRecords } from '../services.js';
import { PAIN_AREAS } from '../analysis.js';
import { MUSCLE_BY_ID, REGIONS, fineLoads } from './muscles.js';
import { addDays, weekStart, monthStart, diffDays } from '../util.js';
import { r1 } from '../formulas.js';

export const MEASURES = [['weight_kg', 'Poids', 'kg'], ['waist_cm', 'Tour de taille', 'cm'], ['chest_cm', 'Poitrine', 'cm'], ['arm_cm', 'Bras', 'cm'], ['thigh_cm', 'Cuisse', 'cm'], ['calf_cm', 'Mollet', 'cm'], ['hip_cm', 'Hanches', 'cm'], ['neck_cm', 'Cou', 'cm'], ['body_fat_pct', 'Masse grasse (estimation)', '%']];

function regionSets(db, from, to) {
  const rows = db.all(`SELECT e.id, e.name, e.pattern, e.muscles, e.lib_id, COUNT(*) n FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ? GROUP BY e.id`, USER_ID, from, to);
  // Par région : séries où un muscle de la région est cible principale (une série compte une fois par région)
  const out = {};
  for (const r of rows) { const regs = new Set(fineLoads(r).filter((f) => f.direct).map((f) => MUSCLE_BY_ID[f.id]?.region).filter(Boolean)); for (const g of regs) out[g] = (out[g] || 0) + r.n; }
  return Object.entries(out).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ region: k, label: REGIONS[k], sets: v }));
}
const avg = (a) => (a.length ? r1(a.reduce((t, x) => t + x, 0) / a.length) : null);

export function bodyReport(db, today, period = 'week', offset = 0) {
  const month = period === 'month';
  const from = month ? (() => { let m = monthStart(today); for (let i = 0; i < offset; i++) m = monthStart(addDays(m, -1)); return m; })() : addDays(weekStart(today), -7 * offset);
  const to = month ? addDays(monthStart(addDays(from, 32)), -1) : addDays(from, 6);
  const end = to > today ? today : to;
  const pFrom = month ? monthStart(addDays(from, -1)) : addDays(from, -7); const pTo = addDays(from, -1);
  const cur = periodStats(db, from, end); const prev = periodStats(db, pFrom, pTo);
  const records = allRecords(db).filter((x) => x.date >= from && x.date <= end).map((x) => ({ name: x.name, weight: x.weight, previous: x.previous, unit: x.unit, date: x.date, assisted: x.assisted }));
  const pains = db.all('SELECT * FROM pain_reports WHERE user_id = ? AND (date BETWEEN ? AND ? OR (resolved = 0 AND date <= ?))', USER_ID, from, end, end)
    .map((p) => ({ label: PAIN_AREAS[p.area]?.label || p.area, side: p.side, intensity: p.intensity, date: p.date, resolved: !!p.resolved, isNew: p.date >= from }));
  const bm = db.all('SELECT date, weight_kg, waist_cm FROM body_metrics WHERE user_id = ? AND date <= ? ORDER BY date, id', USER_ID, end);
  const wIn = bm.filter((x) => x.weight_kg != null && x.date >= from); const wBefore = bm.filter((x) => x.weight_kg != null && x.date < from && x.date >= pFrom);
  const food = db.all('SELECT date, SUM(kcal) k, SUM(protein_g) p FROM food_logs WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date', USER_ID, from, end);
  const mob = db.one('SELECT COUNT(*) n FROM mobility_logs WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, from, end).n;
  const days = diffDays(from, end) + 1;
  const weightAvg = avg(wIn.map((x) => x.weight_kg)); const weightPrev = avg(wBefore.map((x) => x.weight_kg));
  const highlights = [];
  if (cur.workouts) highlights.push(`${cur.workouts} séance${cur.workouts > 1 ? 's' : ''}, ${cur.sets} séries validées${prev.sets ? ` (${cur.sets >= prev.sets ? '+' : ''}${cur.sets - prev.sets} par rapport à la période d’avant)` : ''}.`);
  if (records.length) highlights.push(`${records.length} record${records.length > 1 ? 's' : ''} battu${records.length > 1 ? 's' : ''}.`);
  if (weightAvg != null && weightPrev != null) highlights.push(`Poids moyen ${String(weightAvg).replace('.', ',')} kg (${weightAvg - weightPrev >= 0 ? '+' : ''}${String(r1(weightAvg - weightPrev)).replace('.', ',')} kg).`);
  if (pains.some((p) => p.isNew)) highlights.push(`${pains.filter((p) => p.isNew).length} nouvelle${pains.filter((p) => p.isNew).length > 1 ? 's' : ''} douleur${pains.filter((p) => p.isNew).length > 1 ? 's' : ''} signalée${pains.filter((p) => p.isNew).length > 1 ? 's' : ''}.`);
  return {
    period: month ? 'month' : 'week', offset, from, to, partial: to > today, days, cur, prev, records, regions: regionSets(db, from, end), prev_regions: regionSets(db, pFrom, pTo),
    body: { weight_avg: weightAvg, weight_prev: weightPrev, weigh_ins: wIn.length, waist: bm.filter((x) => x.waist_cm != null && x.date >= from).at(-1)?.waist_cm ?? null },
    nutrition: { days_logged: food.length, kcal_avg: avg(food.map((f) => f.k)), protein_avg: avg(food.map((f) => f.p)) },
    mobility: mob, pains, highlights, empty: !cur.workouts && !cur.cardio_sessions && !wIn.length && !food.length,
  };
}

// Mensurations : séries par mesure (valeurs saisies) ; nutrition : 28 derniers jours et moyennes de poids par semaine
export function measuresTrend(db) {
  const rows = db.all('SELECT * FROM body_metrics WHERE user_id = ? ORDER BY date, id', USER_ID);
  return MEASURES.map(([key, label, unit]) => { const pts = rows.filter((r) => r[key] != null).map((r) => ({ date: r.date, v: r[key] })); return { key, label, unit, points: pts, last: pts.at(-1) || null, first: pts[0] || null }; });
}
export function nutritionTrend(db, today) {
  const from = addDays(today, -27);
  const food = db.all('SELECT date, SUM(kcal) k, SUM(protein_g) p, SUM(carbs_g) g, SUM(fat_g) l FROM food_logs WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date ORDER BY date', USER_ID, from, today);
  const w = db.all('SELECT date, weight_kg FROM body_metrics WHERE user_id = ? AND weight_kg IS NOT NULL AND date >= ? ORDER BY date', USER_ID, addDays(weekStart(today), -77));
  const weeks = {}; for (const x of w) (weeks[weekStart(x.date)] ||= []).push(x.weight_kg);
  return { days: food.map((f) => ({ date: f.date, kcal: Math.round(f.k), protein: Math.round(f.p), carbs: Math.round(f.g), fat: Math.round(f.l) })),
    weight_weeks: Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([start, v]) => ({ start, avg: avg(v), n: v.length })) };
}
