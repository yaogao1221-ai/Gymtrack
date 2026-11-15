// État du corps, muscle fin par muscle fin : fatigue estimée, volume (1, 4, 8, 12 semaines), force, progression, douleurs.
// Tout vient des séries réellement validées. Les estimations sont nommées comme telles : l'appli ne mesure ni la
// récupération physiologique ni un déséquilibre réel, elle calcule à partir de ce que tu as enregistré.
import { MUSCLE_LIST, MUSCLE_BY_ID, PAIN_FINE, fineLoads, groupSplit } from './muscles.js';
import { USER_ID, getProfile } from '../services.js';
import { PAIN_AREAS } from '../analysis.js';
import { CARDIO_LOAD } from '../routes/insights.js';
import { e1rm, toLbs, r1 } from '../formulas.js';
import { addDays, diffDays, weekStart } from '../util.js';
import { toJSON } from '../schema.js';
import { volumeZone } from '../coach/muscleState.js';

const BIG = new Set(['quadriceps', 'ischios', 'fessiers', 'adducteurs', 'pectoraux', 'dos_largeur', 'lombaires']);
const COMPOUND = new Set(['squat', 'hinge', 'lunge', 'leg_press', 'press_horizontal', 'press_incline', 'press_vertical', 'vertical_pull', 'horizontal_row', 'dip']);
export const SPEEDS = { rapide: ['Rapide', 0.8], normale: ['Normale', 1], lente: ['Lente', 1.25] };
// Seuils de fatigue estimée (en « séries équivalentes » encore présentes)
export const LEVELS = { faible: 'Fatigue estimée faible', moderee: 'Fatigue estimée modérée', elevee: 'Fatigue estimée élevée', aucune: 'Pas de travail récent' };
const HIGH = 6; const MID = 2.5;

export function bodySettings(db) {
  const s = toJSON(db.one('SELECT body_settings s FROM profiles WHERE user_id = ?', USER_ID)?.s, {}) || {};
  return { speed: SPEEDS[s.speed] ? s.speed : 'normale', cardio: s.cardio !== false, indirect: s.indirect !== false };
}
export function saveBodySettings(db, b = {}) {
  const s = { speed: SPEEDS[b.speed] ? b.speed : 'normale', cardio: b.cardio !== false, indirect: b.indirect !== false };
  db.run('UPDATE profiles SET body_settings = ? WHERE user_id = ?', JSON.stringify(s), USER_ID);
  return s;
}

// Séries validées des 26 dernières semaines, avec la part estimée de chaque muscle fin
function loadSets(db, from, to) {
  const rows = db.all(`SELECT s.id, s.weight, s.weight_unit unit, s.reps, w.id wid, w.date, w.started_at, w.rpe, e.id eid, e.name, e.pattern, e.muscles, e.kind, e.lib_id
    FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ? ORDER BY w.date, s.id`, USER_ID, from, to);
  const fine = new Map(); const best = new Map();
  for (const r of rows) {
    if (!fine.has(r.eid)) fine.set(r.eid, fineLoads(r));
    r.e1 = r.kind === 'weighted' && r.weight > 0 && r.reps >= 1 && r.reps <= 15 ? e1rm(toLbs(r.weight, r.unit), r.reps) : null;
    if (r.e1 && r.e1 > (best.get(r.eid) || 0)) best.set(r.eid, r.e1);
  }
  return { rows, fine, best };
}

// Intensité relative : la série comparée à ton meilleur niveau sur l'exercice (1RM estimé). Le RIR n'étant pas noté
// dans les séances, une série à ton meilleur niveau est comptée comme proche de l'échec.
const relOf = (r, best) => (r.e1 && best ? r.e1 / best : null);
const intensityOf = (rel) => (rel == null ? 1 : rel >= 0.97 ? 1.15 : rel >= 0.9 ? 1 : 0.8);

export function bodyState(db, today, { hour = 12 } = {}) {
  const settings = bodySettings(db); const profile = getProfile(db);
  const from = addDays(today, -181);
  const { rows, fine, best } = loadSets(db, from, today);
  const first = db.one('SELECT MIN(date) d FROM workouts WHERE user_id = ?', USER_ID)?.d;
  const covered = first ? Math.max(1, Math.ceil((diffDays(first, today) + 1) / 7)) : 1;
  const tau0 = SPEEDS[settings.speed][1] * (profile.sleep_hours != null && profile.sleep_hours < 6 ? 1.15 : profile.sleep_hours != null && profile.sleep_hours < 7 ? 1.07 : 1);
  const M = {}; for (const m of MUSCLE_LIST) M[m.id] = { fat: 0, lastDate: null, lastDose: 0, w: { 1: [0, 0], 4: [0, 0], 8: [0, 0], 12: [0, 0] }, weeks: {}, ex: new Map(), rirN: 0, rirS: 0 };
  const hoursAgo = (d, started) => {
    const h = started && /T(\d{2})/.test(started) ? Number(started.match(/T(\d{2})/)[1]) : 18;
    return Math.max(0, diffDays(d, today) * 24 + hour - h);
  };
  const dayDose = {};
  for (const r of rows) {
    const age = diffDays(r.date, today); const rel = relOf(r, best.get(r.eid));
    const inten = intensityOf(rel) * (r.rpe >= 9 ? 1.15 : r.rpe && r.rpe <= 6 ? 0.85 : 1) * (COMPOUND.has(r.pattern) ? 1.1 : 1);
    const wk = weekStart(r.date);
    for (const f of fine.get(r.eid)) {
      const x = M[f.id]; if (!x) continue;
      const g = MUSCLE_BY_ID[f.id].group;
      for (const n of [1, 4, 8, 12]) if (age < n * 7) x.w[n][f.direct ? 0 : 1] += f.w;
      const wkv = (x.weeks[wk] ||= [0, 0]); wkv[f.direct ? 0 : 1] += f.w;
      let e = x.ex.get(r.eid); if (!e) { e = { id: r.eid, name: r.name, lib_id: r.lib_id, w: f.w, direct: f.direct, sets: 0, sets4: 0, last: null, days: new Map() }; x.ex.set(r.eid, e); }
      e.sets += 1; if (age < 28) e.sets4 += 1; e.last = r.date;
      if (r.e1 && (!e.days.has(r.date) || r.e1 > e.days.get(r.date).v)) e.days.set(r.date, { v: r.e1, weight: r.weight, unit: r.unit, reps: r.reps });
      if (!f.direct && !settings.indirect) continue;
      if (age <= 10) {
        const tau = (BIG.has(g) ? 36 : 24) * tau0;
        const dose = f.w * inten;
        x.fat += dose * Math.exp(-hoursAgo(r.date, r.started_at) / tau);
        (dayDose[f.id] ||= {})[r.date] = (dayDose[f.id][r.date] || 0) + f.w;
        if (rel != null && f.direct) { x.rirN += 1; x.rirS += rel; }
      }
    }
  }
  // Cardio : séries équivalentes réparties sur les muscles fins du groupe
  if (settings.cardio) {
    for (const c of db.all('SELECT date, activity, duration_min, incline_pct FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, addDays(today, -83), today)) {
      const k = c.activity === 'marche' && c.incline_pct >= 5 ? CARDIO_LOAD.marche_inclinee : CARDIO_LOAD[c.activity]; if (!k) continue;
      const age = diffDays(c.date, today);
      for (const [g, per] of Object.entries(k)) for (const [id, e] of Object.entries(groupSplit(g))) {
        const v = Math.min(4, per * (c.duration_min || 0)) * e; const x = M[id]; if (!x || !v) continue;
        for (const n of [1, 4, 8, 12]) if (age < n * 7) x.w[n][1] += v;
        const wkv = (x.weeks[weekStart(c.date)] ||= [0, 0]); wkv[1] += v;
        if (age <= 10) x.fat += v * 0.6 * Math.exp(-hoursAgo(c.date, null) / ((BIG.has(g) ? 36 : 24) * tau0));
      }
    }
  }
  const sore = db.all('SELECT muscle, MAX(date) date FROM muscle_soreness WHERE user_id = ? AND date >= ? GROUP BY muscle', USER_ID, addDays(today, -3));
  const pains = db.all('SELECT * FROM pain_reports WHERE user_id = ? AND resolved = 0 ORDER BY intensity DESC', USER_ID);

  const muscles = {};
  for (const m of MUSCLE_LIST) {
    const x = M[m.id]; const g = m.group;
    const dd = dayDose[m.id] || {}; const lastDay = Object.keys(dd).filter((d) => dd[d] >= 1).sort().at(-1) || null;
    const so = g ? sore.find((s) => s.muscle === g) : null; const soreDays = so ? diffDays(so.date, today) : null;
    const fat = r1(x.fat);
    let level = fat >= HIGH ? 'elevee' : fat >= MID ? 'moderee' : lastDay || fat > 0.3 ? 'faible' : 'aucune';
    const factors = [];
    if (lastDay) factors.push(`Dernière séance qui le travaille : ${diffDays(lastDay, today) === 0 ? 'aujourd’hui' : diffDays(lastDay, today) === 1 ? 'hier' : `il y a ${diffDays(lastDay, today)} jours`} (${String(r1(dd[lastDay])).replace('.', ',')} séries effectives).`);
    if (fat > 0) factors.push(`Charge restante estimée : ${String(fat).replace('.', ',')} séries équivalentes (seuils : ${MID.toString().replace('.', ',')} modérée, ${HIGH} élevée).`);
    if (x.rirN) factors.push(`Intensité : séries à ${Math.round((x.rirS / x.rirN) * 100)} % de ton meilleur niveau en moyenne (1RM estimé). Le RIR n’étant pas noté, plus c’est proche de 100 %, plus la série compte.`);
    if (so && soreDays <= 1) { if (level !== 'elevee') level = 'elevee'; factors.push('Courbatures signalées hier ou aujourd’hui.'); }
    else if (so && soreDays <= 2 && (level === 'faible' || level === 'aucune')) { level = 'moderee'; factors.push('Courbatures signalées il y a 2 jours.'); }
    if (tau0 > 1.05 && profile.sleep_hours != null && profile.sleep_hours < 7) factors.push(`Sommeil indiqué dans ton profil : ${String(profile.sleep_hours).replace('.', ',')} h, la récupération est comptée plus lente.`);
    const tau = (g && BIG.has(g) ? 36 : 24) * tau0;
    const readyIn = fat > MID ? Math.round(tau * Math.log(fat / MID)) : 0;
    // Volume : moyenne par semaine sur les semaines réellement couvertes
    const vol = { zone: volumeZone(profile.level || 'intermediaire', g || 'avant_bras') }; for (const n of [1, 4, 8, 12]) { const wks = Math.min(n, covered); vol[n] = { direct: r1(x.w[n][0] / wks), indirect: r1(x.w[n][1] / wks), total: r1((x.w[n][0] + x.w[n][1]) / wks), weeks: wks }; }
    // Force et progression : exercices où le muscle est une cible principale, charges réelles
    const exs = [...x.ex.values()].filter((e) => e.direct && e.days.size).map((e) => ({ ...e, series: [...e.days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v, v: Math.round(v.v) })) }));
    const strength = strengthOf(exs, today);
    const progression = Object.fromEntries([8, 12, 26].map((n) => [n, progressOf(exs, today, n)]));
    const painAreas = Object.entries(PAIN_FINE).filter(([, l]) => l.includes(m.id)).map(([a]) => a);
    const pain = pains.filter((p) => painAreas.includes(p.area)).map((p) => ({ id: p.id, area: p.area, label: PAIN_AREAS[p.area]?.label || p.area, intensity: p.intensity, date: p.date, side: p.side || null, kind: p.kind || null }));
    muscles[m.id] = {
      id: m.id, name: m.name, group: g, region: m.region, deep: !!m.deep,
      recovery: { level, label: LEVELS[level], fatigue: fat, ready_in_h: readyIn, last: lastDay, factors },
      volume: vol, strength, progression, pain,
      exercises: [...x.ex.values()].sort((a, b) => b.sets4 - a.sets4 || b.sets - a.sets).slice(0, 12).map(({ days, ...e }) => e),
    };
  }
  const wk7 = db.one('SELECT COUNT(DISTINCT w.id) n, COUNT(s.id) s FROM workouts w LEFT JOIN workout_sets s ON s.workout_id = w.id AND s.completed = 1 WHERE w.user_id = ? AND w.date BETWEEN ? AND ?', USER_ID, addDays(today, -6), today);
  const wk28 = db.one('SELECT COUNT(*) n FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, addDays(today, -27), today);
  const summary = { sessions_7: wk7.n, sets_7: wk7.s, sessions_28: wk28.n, pains: pains.length, has_data: rows.length > 0 };
  return { today, settings, covered_weeks: covered, summary, muscles, thresholds: { mid: MID, high: HIGH },
    method: 'Estimation à partir de tes séries validées : chaque série compte selon la part estimée du muscle dans l’exercice, l’effort (répétitions en réserve estimées), le type de mouvement et le temps écoulé. Ce n’est pas une mesure physiologique.' };
}

function strengthOf(exs, today) {
  if (!exs.length) return { verdict: 'insuffisant', text: 'Aucune charge enregistrée sur un exercice qui le cible.' };
  const main = [...exs].sort((a, b) => b.series.length - a.series.length)[0];
  const top = Math.max(...main.series.map((p) => p.v)); const rec = main.series.filter((p) => diffDays(p.date, today) < 28);
  if (!rec.length) return { verdict: 'insuffisant', exercise: main.name, best: top, text: `Pas de séance avec charge sur ${main.name} depuis 4 semaines (record estimé : ${top} lbs).` };
  const now = Math.max(...rec.map((p) => p.v)); const pct = Math.round((now / top) * 100);
  const verdict = main.series.length < 2 ? 'insuffisant' : pct >= 98 ? 'record' : pct >= 90 ? 'proche' : 'sous';
  return { verdict, exercise: main.name, exercise_id: main.id, best: top, now, pct, series: main.series.slice(-24),
    text: verdict === 'insuffisant' ? `Une seule séance avec charge sur ${main.name} : il en faut au moins deux.` : `${main.name} : 1RM estimé ${now} lbs ces 4 semaines, ${pct} % de ton meilleur (${top} lbs).` };
}
function progressOf(exs, today, weeks) {
  const from = addDays(today, -(weeks * 7 - 1));
  const list = exs.map((e) => ({ ...e, s: e.series.filter((p) => p.date >= from) })).filter((e) => e.s.length >= 3).map((e) => {
    const a = Math.max(...e.s.slice(0, 2).map((p) => p.v)); const b = Math.max(...e.s.slice(-2).map((p) => p.v));
    return { id: e.id, name: e.name, sessions: e.s.length, change_pct: r1(((b - a) / a) * 100) };
  });
  if (!list.length) return { verdict: 'insuffisant', text: `Il faut au moins 3 séances avec charge sur un même exercice en ${weeks} semaines.` };
  const n = list.reduce((t, x) => t + x.sessions, 0); const change = r1(list.reduce((t, x) => t + x.change_pct * x.sessions, 0) / n);
  const verdict = change > 2 ? 'progres' : change < -3 ? 'baisse' : 'stagne';
  return { verdict, change_pct: change, exercises: list, text: `${verdict === 'progres' ? 'En progrès' : verdict === 'baisse' ? 'En baisse' : 'Stable'} : ${change > 0 ? '+' : ''}${String(change).replace('.', ',')} % de 1RM estimé en ${weeks} semaines (${list.map((x) => x.name).slice(0, 2).join(', ')}).` };
}

// Historique d'un muscle : séries par semaine sur 12 ou 26 semaines (directes et indirectes)
export function muscleHistory(db, today, id, weeks = 12) {
  const st = bodyState(db, today); const m = st.muscles[id]; if (!m) return null;
  const from = addDays(weekStart(today), -(weeks - 1) * 7);
  const { rows, fine } = loadSets(db, from, today);
  const wk = {}; for (let i = 0; i < weeks; i++) wk[addDays(from, i * 7)] = [0, 0];
  for (const r of rows) for (const f of fine.get(r.eid)) if (f.id === id) { const k = weekStart(r.date); if (wk[k]) wk[k][f.direct ? 0 : 1] += f.w; }
  return { ...m, info: MUSCLE_BY_ID[id], weeks: Object.entries(wk).map(([start, [d, i]]) => ({ start, direct: r1(d), indirect: r1(i) })) };
}
