// Cerveau musculaire : UN état par muscle, calculé une seule fois, lu par la carte du corps, la séance, le programme, l'accueil et le coach.
// Tout vient des séances réellement enregistrées (séries validées, charges, cardio, douleurs, courbatures). Aucune valeur inventée :
// quand les données manquent, le verdict est « insuffisant ». Les propositions ne s'appliquent qu'après validation.
import { MUSCLES } from '../seed.js';
import { USER_ID, getProfile, activeProgram } from '../services.js';
import { RANGES, PAIN_AREAS } from '../analysis.js';
import { bodyStatus, dailyLoads } from '../routes/insights.js';
import { muscleBalance } from './balance.js';
import { e1rm, toLbs, r1 } from '../formulas.js';
import { addDays, diffDays, weekStart, dayKey } from '../util.js';
import { toJSON } from '../schema.js';

export const MAJOR = ['pectoraux', 'dos_largeur', 'dos_epaisseur', 'epaules_lat', 'epaules_post', 'biceps', 'triceps', 'quadriceps', 'ischios', 'fessiers', 'mollets', 'abdominaux'];
const SMALL = new Set(['avant_bras', 'trapezes', 'abducteurs', 'adducteurs', 'epaules_ant', 'lombaires']);
// Zones douloureuses (Soins) → muscles concernés
const PAIN_MUSCLES = { epaule: ['epaules_ant', 'epaules_lat', 'epaules_post'], coude: ['biceps', 'triceps', 'avant_bras'], poignet: ['avant_bras'], bas_du_dos: ['lombaires'],
  genou: ['quadriceps', 'ischios'], hanche: ['fessiers', 'adducteurs', 'abducteurs'], cheville: ['mollets'], nuque: ['trapezes'], pectoral: ['pectoraux'] };
const fr = (x) => String(r1(x)).replace('.', ',');
const plural = (n, s, p = `${s}s`) => (n > 1 || n === 0 ? p : s);
const lc = (k) => (MUSCLES[k] || k).replace(/ \(.*\)/, '').toLowerCase();

// Zone de volume conseillée (séries par semaine) selon le niveau ; plus basse pour les petits muscles souvent travaillés en secondaire
export function volumeZone(level, k) {
  const [min, low, high] = RANGES[level] || RANGES.intermediaire;
  return SMALL.has(k) ? { min: Math.round(min / 2), low: Math.round(low / 2), high: Math.round(high * 0.6) } : { min, low, high };
}

// Meilleur 1RM estimé par exercice et par séance (charges réelles, 1 à 15 répétitions)
function strengthSessions(db, from, to) {
  const rows = db.all(`SELECT e.id, e.name, e.muscles, w.date, s.weight, s.weight_unit unit, s.reps FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND e.kind = 'weighted' AND s.weight > 0 AND s.reps BETWEEN 1 AND 15 AND w.date BETWEEN ? AND ?`, USER_ID, from, to);
  const ex = new Map();
  for (const r of rows) {
    const v = e1rm(toLbs(r.weight, r.unit), r.reps); if (!v) continue;
    let x = ex.get(r.id); if (!x) { x = { id: r.id, name: r.name, muscles: toJSON(r.muscles, {}), days: new Map() }; ex.set(r.id, x); }
    if (!x.days.has(r.date) || v > x.days.get(r.date)) x.days.set(r.date, v);
  }
  return [...ex.values()].map((x) => ({ ...x, series: [...x.days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, v: Math.round(v) })) }));
}

// Progression d'un muscle sur 8 semaines : exercices où il est principal, au moins 3 séances, début (2 premières) contre fin (2 dernières)
function progressionOf(k, exs) {
  const mine = exs.filter((x) => (x.muscles[k] || 0) >= 1 && x.series.length >= 3);
  if (!mine.length) {
    const some = exs.filter((x) => (x.muscles[k] || 0) >= 1).reduce((a, x) => a + x.series.length, 0);
    return { verdict: 'insuffisant', text: some ? `${some} ${plural(some, 'séance')} avec charge en 8 semaines : il en faut 3 sur un même exercice pour juger.` : 'Aucune charge enregistrée sur ce muscle en 8 semaines.', exercises: [] };
  }
  const list = mine.map((x) => {
    const a = Math.max(...x.series.slice(0, 2).map((p) => p.v)); const b = Math.max(...x.series.slice(-2).map((p) => p.v));
    return { id: x.id, name: x.name, sessions: x.series.length, change_pct: r1(((b - a) / a) * 100), series: x.series, best: Math.max(...x.series.map((p) => p.v)), last: x.series.at(-1).date };
  }).sort((a, b) => b.sessions - a.sessions);
  const n = list.reduce((t, x) => t + x.sessions, 0);
  const change = r1(list.reduce((t, x) => t + x.change_pct * x.sessions, 0) / n);
  const verdict = change > 2 ? 'progres' : change < -3 ? 'baisse' : 'stagne';
  const main = list[0];
  const text = `${verdict === 'progres' ? 'En progrès' : verdict === 'baisse' ? 'En baisse' : 'Stagne'} : 1RM estimé ${change > 0 ? '+' : ''}${fr(change)} % sur 8 semaines (${list.length > 1 ? `${list.length} exercices, surtout ` : ''}${main.name}).`;
  return { verdict, change_pct: change, text, main: { id: main.id, name: main.name, series: main.series, best: main.best }, exercises: list.map(({ series, ...x }) => x) };
}

// Signature des données : l'état n'est recalculé que si une séance, une douleur, une courbature, une priorité ou le jour change
const cache = new Map();
function signature(db, today) {
  const q = (sql) => JSON.stringify(db.one(sql, USER_ID));
  return [today, q('SELECT COUNT(*) n, MAX(id) m, SUM(completed) c FROM workout_sets WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = ?)'),
    q('SELECT COUNT(*) n, MAX(id) m, SUM(resolved) r FROM pain_reports WHERE user_id = ?'), q('SELECT COUNT(*) n, MAX(id) m FROM muscle_soreness WHERE user_id = ?'),
    q('SELECT COUNT(*) n, MAX(id) m FROM cardio_sessions WHERE user_id = ?'), q('SELECT priority_muscles p, level l FROM profiles WHERE user_id = ?'),
    q('SELECT COUNT(*) n, MAX(id) m FROM muscle_adjustments WHERE user_id = ?'), q('SELECT COUNT(*) n, MAX(id) m FROM mobility_logs WHERE user_id = ?'),
    q('SELECT GROUP_CONCAT(intensity) i FROM pain_reports WHERE user_id = ? AND resolved = 0'),
    q("SELECT COUNT(*) n, SUM(sets) s, MAX(id) m FROM program_exercises WHERE day_id IN (SELECT id FROM program_days WHERE program_id IN (SELECT id FROM programs WHERE user_id = ? AND active = 1))")].join('|');
}
export function muscleState(db, today) {
  const sig = signature(db, today); const hit = cache.get(db);
  if (hit && hit.sig === sig) return hit.value;
  const value = computeState(db, today); cache.set(db, { sig, value });
  return value;
}

function computeState(db, today) {
  const profile = getProfile(db); const level = profile.level || 'intermediaire';
  const priority = toJSON(profile.priority_muscles, []).filter((k) => MUSCLES[k]).slice(0, 3);
  const body = bodyStatus(db, today);
  const loads = dailyLoads(db, addDays(today, -27), today);
  const first = db.one('SELECT MIN(date) d FROM workouts WHERE user_id = ?', USER_ID)?.d;
  // Moyenne sur les semaines réellement couvertes (1 à 4) : pas de dilution pour qui débute
  const weeks = first ? Math.min(4, Math.max(1, Math.ceil((diffDays(first, today) + 1) / 7))) : 1;
  const sum28 = {}; const days28 = {};
  for (const day of Object.values(loads)) for (const [m, v] of Object.entries(day)) { sum28[m] = (sum28[m] || 0) + v; if (v >= 1.5) days28[m] = (days28[m] || 0) + 1; }
  const exs = strengthSessions(db, addDays(today, -55), today);
  const bal = muscleBalance(db, today);
  const pains = db.all('SELECT id, area, intensity, date FROM pain_reports WHERE user_id = ? AND resolved = 0', USER_ID);

  const muscles = {};
  for (const [k, label] of Object.entries(MUSCLES)) {
    const b = body.muscles[k]; const z = volumeZone(level, k);
    const avg = r1((sum28[k] || 0) / weeks); const week = b.sets;
    const vz = avg <= 0 ? 'absent' : avg < z.low ? 'sous' : avg <= z.high ? 'zone' : 'au_dessus';
    const freq = r1((days28[k] || 0) / weeks);
    const prog = progressionOf(k, exs);
    const bItems = bal.by_muscle?.[k] || [];
    const weakItem = bItems.find((x) => x.weak === k || (x.weak === 'Dos' && k.startsWith('dos')));
    const balance = !bItems.length ? null : weakItem ? { verdict: 'retard', text: weakItem.text } : bItems.some((x) => x.verdict === 'ok') ? { verdict: 'ok', text: 'Équilibré avec le muscle opposé.' } : null;
    const pain = pains.filter((p) => (PAIN_MUSCLES[p.area] || []).includes(k)).map((p) => ({ id: p.id, area: p.area, label: PAIN_AREAS[p.area]?.label || p.area, intensity: p.intensity, date: p.date }))[0] || null;
    const prio = priority.includes(k); const major = MAJOR.includes(k);
    // Besoins : ce qui manque, avec le chiffre qui le justifie (rien pour un muscle douloureux : la priorité est de guérir)
    const needs = [];
    if (!pain) {
      if (b.status === 'oublie' && (major || prio)) needs.push({ k: 'oublie', w: 3, text: b.last ? `Pas travaillé depuis ${b.days} jours.` : 'Jamais travaillé dans tes séances enregistrées.' });
      else if (vz === 'sous' || (vz === 'absent' && (major || prio))) needs.push({ k: 'volume', w: 3, text: `${fr(avg)} ${plural(avg, 'série')} par semaine en moyenne, zone efficace ${z.low} à ${z.high}.` });
      if (prog.verdict === 'baisse') needs.push({ k: 'baisse', w: 3, text: prog.text });
      else if (prog.verdict === 'stagne') needs.push({ k: 'stagne', w: 2, text: prog.text });
      if (balance?.verdict === 'retard') needs.push({ k: 'equilibre', w: 2, text: balance.text });
      if (major && avg >= z.low && freq > 0 && freq < 1.5) needs.push({ k: 'frequence', w: 1, text: `Travaillé ${fr(freq)} fois par semaine : réparti sur 2 séances, le même volume donne en général de meilleurs résultats.` });
      if (prio && vz === 'zone' && avg < z.high) needs.push({ k: 'priorite', w: 1, text: `Muscle prioritaire : il reste de la marge jusqu’à ${z.high} séries par semaine.` });
    }
    const score = needs.reduce((t, n) => t + n.w, 0) + (prio && needs.length ? 2 : 0);
    const caution = pain ? `Douleur ${pain.label.toLowerCase()} ${pain.intensity}/10 : pas de hausse, amplitude confortable.` : vz === 'au_dessus' ? `Volume élevé (${fr(avg)} séries par semaine, au-delà de ${z.high}) : surveille la récupération.` : null;
    muscles[k] = {
      key: k, label, major, priority: prio,
      recovery: { status: b.status, last: b.last, days: b.days, sore: b.sore },
      volume: { week, avg, weeks, zone: z, verdict: vz }, frequency: freq,
      progression: prog, balance, pain, needs: needs.sort((a, c) => c.w - a.w), need_score: score, caution,
    };
  }

  // Score d'équilibre global sur 100 : écarts de force et de volume entre muscles opposés, muscles majeurs oubliés
  const totalSets = Object.values(sum28).reduce((a, v) => a + v, 0);
  let global = null;
  if (totalSets >= 20) {
    const pen = [];
    for (const s of bal.strength) if (s.verdict === 'low' || s.verdict === 'high') pen.push({ p: 12, text: `${s.label} : ${s.text}` });
    for (const v of bal.volume) if (v.verdict === 'low' || v.verdict === 'high') pen.push({ p: 8, text: `${v.label} : ${v.text}` });
    const forgot = MAJOR.filter((k) => muscles[k].volume.verdict === 'absent');
    if (forgot.length) pen.push({ p: Math.min(20, forgot.length * 5), text: `Muscles majeurs non travaillés en 4 semaines : ${forgot.map(lc).join(', ')}.` });
    const value = Math.max(0, 100 - pen.reduce((a, x) => a + x.p, 0));
    global = { value, label: value >= 85 ? 'Très équilibré' : value >= 65 ? 'Plutôt équilibré' : 'Déséquilibré', causes: pen.sort((a, b) => b.p - a.p).slice(0, 3).map((x) => x.text) };
  }

  const joints = jointState(db, today, pains);
  const todayPlan = planToday(db, today, muscles, profile);
  todayPlan.mobility = mobilityFor(todayPlan, joints);
  const proposals = adjustProposals(db, muscles);
  const adjustments = adjustmentResults(db, today, exs);
  return { today, level, priority, muscles, joints, global, today_plan: todayPlan, proposals, adjustments, balance: bal,
    note: 'Calculé sur tes séances enregistrées : séries validées (muscle principal = 1, secondaire = 0,5), cardio, 1RM estimé sur tes charges réelles. Rien ne change sans ton accord.' };
}

// ---------- Séance du jour : muscles récupérés × ce qui leur manque ----------
function planToday(db, today, muscles, profile = {}) {
  const done = db.one('SELECT COUNT(*) n FROM workout_sets s JOIN workouts w ON w.id = s.workout_id WHERE w.user_id = ? AND w.date = ? AND s.completed = 1', USER_ID, today).n;
  const tired = Object.values(muscles).filter((m) => m.recovery.status === 'fatigue' || m.recovery.status === 'recup' || m.pain);
  const ready = Object.values(muscles).filter((m) => (m.recovery.status === 'pret' || m.recovery.status === 'oublie') && !m.pain && (m.major || m.priority))
    .map((m) => ({ ...m, s: m.need_score + (m.recovery.days == null || m.recovery.days >= 4 ? 1 : 0) })).sort((a, b) => b.s - a.s);
  const prog = activeProgram(db);
  const days = prog ? db.all('SELECT id, name, focus, code FROM program_days WHERE program_id = ? AND archived = 0 ORDER BY position', prog.id) : [];
  // Même séance prévue que l'accueil et le coach : événement du calendrier, sinon semaine type
  const ev = db.one("SELECT ce.program_day_id day_id FROM calendar_events ce WHERE ce.user_id = ? AND ce.date = ? AND ce.type = 'workout' ORDER BY ce.id LIMIT 1", USER_ID, today);
  const code = profile.schedule?.[dayKey(today)];
  const planned = ev?.day_id ? ev : code && code !== 'rest' ? { day_id: days.find((d) => d.code === code)?.id } : null;
  const restDay = !ev && code === 'rest';
  const fitOf = (d) => {
    const ex = db.all('SELECT pe.id, e.name, e.muscles FROM program_exercises pe JOIN exercises e ON e.id = pe.exercise_id WHERE pe.day_id = ? ORDER BY pe.position', d.id).map((x) => ({ ...x, muscles: toJSON(x.muscles, {}) }));
    const prim = new Set(ex.flatMap((x) => Object.entries(x.muscles).filter(([, c]) => c >= 1).map(([k]) => k)));
    let fit = 0; for (const k of prim) { const m = muscles[k]; if (!m) continue; if (m.pain || m.recovery.status === 'fatigue') fit -= 4; else if (m.recovery.status === 'recup') fit -= 2; else fit += 1 + m.need_score; }
    const helps = ready.filter((m) => prim.has(m.key) && m.need_score > 0).slice(0, 3).map((m) => m.label);
    const clash = [...prim].filter((k) => muscles[k] && (muscles[k].pain || muscles[k].recovery.status === 'fatigue')).map((k) => muscles[k].label);
    return { id: d.id, name: d.name, focus: d.focus, fit, helps, clash, exercises: ex.filter((x) => Object.entries(x.muscles).some(([k, c]) => c >= 1 && ready.slice(0, 5).some((m) => m.key === k))).slice(0, 4).map((x) => x.name) };
  };
  const scored = days.map(fitOf).sort((a, b) => b.fit - a.fit);
  const best = scored[0] || null; const plannedDay = planned ? scored.find((d) => d.id === planned.day_id) : null;
  const focus = ready.slice(0, 4).map((m) => ({ key: m.key, label: m.label, why: m.needs[0]?.text || (m.recovery.days != null ? `Récupéré, dernière fois il y a ${m.recovery.days} jours.` : 'Récupéré.') }));
  const avoid = tired.slice(0, 5).map((m) => ({ key: m.key, label: m.label, why: m.pain ? `Douleur ${m.pain.label.toLowerCase()}` : m.recovery.status === 'fatigue' ? 'Encore fatigué' : 'En récupération' }));
  if (done) return { done: true, text: 'Séance faite aujourd’hui : la suite se joue sur la récupération (sommeil, protéines).', focus: [], avoid, day: null, planned: null };
  if (!ready.length) return { done: false, rest: true, text: 'Aucun muscle majeur n’est encore récupéré : repos ou cardio léger aujourd’hui.', focus: [], avoid, day: null, planned: null };
  let text;
  if (plannedDay && plannedDay.clash.length === 0) text = `Prévu aujourd’hui : ${plannedDay.name}. Ça tombe bien${plannedDay.helps.length ? ` : ${plannedDay.helps.map((x) => x.toLowerCase()).join(', ')} en ${plural(plannedDay.helps.length, 'a', 'ont')} besoin` : ''}.`;
  else if (plannedDay) text = `Prévu aujourd’hui : ${plannedDay.name}, mais ${plannedDay.clash.map((x) => x.toLowerCase()).join(', ')} ${plural(plannedDay.clash.length, 'n’est', 'ne sont')} pas prêt${plannedDay.clash.length > 1 ? 's' : ''}.${best && best.id !== plannedDay.id && best.fit > plannedDay.fit ? ` ${best.name} conviendrait mieux.` : ' Allège les exercices concernés.'}`;
  else if (restDay) text = `Repos prévu aujourd’hui dans ta semaine type.${best && best.fit > 0 ? ` Si tu veux quand même t’entraîner, ${best.name} est la séance qui convient le mieux.` : ''}`;
  else if (best && best.fit > 0) text = `${best.name} est la séance de ton programme qui convient le mieux : ${best.helps.length ? `elle travaille ${best.helps.map((x) => x.toLowerCase()).join(', ')}` : 'ses muscles sont récupérés'}.`;
  else text = `Muscles prêts et qui en ont le plus besoin : ${focus.map((f) => f.label.toLowerCase()).join(', ')}.`;
  return { done: false, text, focus, avoid, day: best && best.fit > 0 ? best : null, planned: plannedDay };
}

// ---------- Propositions concrètes : séries en plus sur un exercice déjà au programme (jamais un doublon) ----------
function adjustProposals(db, muscles) {
  const prog = activeProgram(db); if (!prog) return [];
  const items = db.all(`SELECT pe.id pe_id, pe.sets, pd.id day_id, pd.name day_name, e.name, e.muscles FROM program_exercises pe JOIN program_days pd ON pd.id = pe.day_id JOIN exercises e ON e.id = pe.exercise_id
    WHERE pd.program_id = ? AND pd.archived = 0`, prog.id).map((x) => ({ ...x, muscles: toJSON(x.muscles, {}) }));
  const used = new Set(); const out = [];
  const cands = Object.values(muscles).filter((m) => !m.pain && m.recovery.status !== 'fatigue' && m.volume.verdict !== 'au_dessus' && (m.needs.some((n) => n.k === 'volume' || n.k === 'priorite') || (m.priority && m.needs.length)))
    .sort((a, b) => b.need_score - a.need_score);
  for (const m of cands) {
    const own = items.filter((x) => (x.muscles[m.key] || 0) >= 1 && x.sets < 5 && !used.has(x.pe_id)).sort((a, b) => a.sets - b.sets)[0];
    if (!own) continue;
    const gap = m.volume.zone.low - m.volume.avg;
    const add = gap >= 4 && own.sets <= 3 ? 2 : 1;
    used.add(own.pe_id);
    out.push({ key: `madj:${own.pe_id}:${own.sets + add}`, muscle: m.key, label: m.label, pe_id: own.pe_id, exercise: own.name, day: { id: own.day_id, name: own.day_name }, from: own.sets, to: own.sets + add,
      title: `+${add} ${plural(add, 'série')} de ${own.name} (${own.day_name})`, reason: `${m.label}${m.priority ? ' (prioritaire)' : ''} : ${m.needs[0].text}` });
    if (out.length >= 3) break;
  }
  return out;
}

// ---------- Est-ce que ça a marché ? Vérification 4 semaines après chaque ajustement validé ----------
function bestE1rmOf(db, exerciseId, from, to) {
  const rows = db.all(`SELECT s.weight, s.weight_unit unit, s.reps FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
    WHERE w.user_id = ? AND s.exercise_id = ? AND s.completed = 1 AND s.weight > 0 AND s.reps BETWEEN 1 AND 15 AND w.date BETWEEN ? AND ?`, USER_ID, exerciseId, from, to);
  const v = Math.max(0, ...rows.map((r) => e1rm(toLbs(r.weight, r.unit), r.reps) || 0));
  return v ? Math.round(v) : null;
}
export function baselineFor(db, today, muscle) {
  const exs = strengthSessions(db, addDays(today, -55), today);
  const p = progressionOf(muscle, exs);
  const ex = p.main || (() => { const x = exs.filter((e) => (e.muscles[muscle] || 0) >= 1).sort((a, b) => b.series.length - a.series.length)[0]; return x ? { id: x.id, name: x.name } : null; })();
  const loads = dailyLoads(db, addDays(today, -27), today); let s = 0; for (const d of Object.values(loads)) s += d[muscle] || 0;
  return { exercise_id: ex?.id ?? null, exercise: ex?.name ?? null, e1rm: ex ? bestE1rmOf(db, ex.id, addDays(today, -27), today) : null, sets_week: r1(s / 4) };
}
function adjustmentResults(db, today) {
  return db.all('SELECT * FROM muscle_adjustments WHERE user_id = ? AND date >= ? ORDER BY date DESC, id DESC', USER_ID, addDays(today, -120)).map((a) => {
    const base = toJSON(a.baseline, {}); const det = toJSON(a.details, {}); const age = diffDays(a.date, today);
    const out = { id: a.id, muscle: a.muscle, label: MUSCLES[a.muscle] || a.muscle, kind: a.kind, date: a.date, details: det, baseline: base, check_on: addDays(a.date, 28) };
    if (age < 28) return { ...out, status: 'en_cours', text: `Vérification le ${addDays(a.date, 28).slice(8, 10)}/${addDays(a.date, 28).slice(5, 7)} : on comparera ta force sur ${base.exercise || 'le muscle'} à celle du départ.` };
    const now = base.exercise_id ? bestE1rmOf(db, base.exercise_id, addDays(today, -27), today) : null;
    if (!base.e1rm || !now) return { ...out, status: 'insuffisant', text: `Pas assez de séances avec charge sur ${base.exercise || 'ce muscle'} pour juger l’effet.` };
    const ch = r1(((now - base.e1rm) / base.e1rm) * 100);
    const status = ch >= 2 ? 'marche' : ch <= -2 ? 'non' : 'neutre';
    const text = status === 'marche' ? `Ça a marché : ${base.exercise} ${base.e1rm} → ${now} lbs (1RM estimé, +${fr(ch)} %).`
      : status === 'neutre' ? `Effet faible : ${base.exercise} ${base.e1rm} → ${now} lbs (${ch > 0 ? '+' : ''}${fr(ch)} %). On essaie autre chose : changer la plage de répétitions (ex. 6-8 au lieu de 10-12) ou de variante.`
        : `Pas d’effet : ${base.exercise} ${base.e1rm} → ${now} lbs (${fr(ch)} %). Ce volume en plus ne t’aide pas : reviens au volume d’avant et vérifie sommeil et récupération, ou change de variante.`;
    return { ...out, status, change_pct: ch, now, text };
  });
}

// ---------- Bilan musculaire de la semaine (dimanche) ----------
export function sundayReview(db, today) {
  const st = muscleState(db, today); const ws = weekStart(today);
  const list = Object.values(st.muscles).filter((m) => m.major || m.priority);
  const under = list.filter((m) => m.volume.week < m.volume.zone.low); const inZone = list.filter((m) => m.volume.week >= m.volume.zone.low && m.volume.week <= m.volume.zone.high);
  const up = list.filter((m) => m.progression.verdict === 'progres').map((m) => ({ key: m.key, label: m.label, text: m.progression.text }));
  const stuck = list.filter((m) => m.progression.verdict === 'stagne' || m.progression.verdict === 'baisse').map((m) => ({ key: m.key, label: m.label, text: m.progression.text }));
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  return { from: ws, to: today, is_sunday: day === 0 || day === 1, in_zone: inZone.length, under: under.map((m) => ({ key: m.key, label: m.label, sets: m.volume.week, low: m.volume.zone.low })),
    tracked: list.length, up, stuck, proposals: st.proposals, results: st.adjustments.filter((a) => a.status !== 'en_cours').slice(0, 3), global: st.global };
}

// ---------- Articulations : douleur, charge mécanique (hausse brutale = risque de tendinopathie), mobilité faite ----------
export const JOINTS = { epaule: 'Épaule', coude: 'Coude', poignet: 'Poignet', bas_du_dos: 'Bas du dos', hanche: 'Hanche', genou: 'Genou', cheville: 'Cheville', nuque: 'Nuque', pectoral: 'Pectoral' };
// Routine de mobilité la plus utile pour chaque articulation (clés de Soins)
const JOINT_ROUTINE = { epaule: 'haut', coude: 'haut', poignet: 'haut', pectoral: 'haut', nuque: 'dos', bas_du_dos: 'dos', hanche: 'bas', genou: 'bas', cheville: 'bas' };
function jointState(db, today, pains) {
  const from = addDays(today, -27); const wk = addDays(today, -6);
  const rows = db.all(`SELECT w.date, e.pattern, COUNT(*) n FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ? GROUP BY w.date, e.pattern`, USER_ID, from, today);
  const first = db.one('SELECT MIN(date) d FROM workouts WHERE user_id = ?', USER_ID)?.d;
  const weeks = first ? Math.min(4, Math.max(1, Math.ceil((diffDays(first, today) + 1) / 7))) : 1;
  const mob = db.all('SELECT date, routine, area FROM mobility_logs WHERE user_id = ? AND date >= ? ORDER BY date DESC', USER_ID, from);
  const painLog = Object.fromEntries(pains.map((p) => [p.area, p]));
  const out = {};
  for (const [k, label] of Object.entries(JOINTS)) {
    const pats = new Set(PAIN_AREAS[k]?.patterns || []);
    let acute = 0; let chronic = 0;
    for (const r of rows) if (pats.has(r.pattern)) { chronic += r.n; if (r.date >= wk) acute += r.n; }
    const avg = chronic / weeks; const ratio = avg >= 3 ? r1(acute / avg) : null;
    const routine = JOINT_ROUTINE[k];
    const done = mob.filter((m) => m.area === k || m.routine === routine || m.routine === `soin:${k}`);
    const lastMob = done[0]?.date || null;
    const pain = painLog[k] ? { id: painLog[k].id, intensity: painLog[k].intensity, since: painLog[k].date } : null;
    const status = pain ? 'douleur' : ratio != null && ratio >= 1.5 && acute >= 8 ? 'surcharge' : acute + chronic === 0 ? 'repos' : 'ok';
    const text = pain ? `Douleur ${pain.intensity}/10 : suis le protocole de soin, pas de hausse de charge sur les mouvements concernés.`
      : status === 'surcharge' ? `Charge en hausse rapide : ${acute} séries cette semaine contre ${fr(avg)} en moyenne (×${fr(ratio)}). Une hausse brutale est la première cause de douleur de tendon : garde ce niveau la semaine prochaine.`
        : status === 'repos' ? 'Peu sollicitée ces 4 semaines.' : `Charge stable : ${acute} séries cette semaine, ${fr(avg)} en moyenne.`;
    out[k] = { key: k, label, status, pain, load: { week: acute, avg: r1(avg), ratio }, routine, mobility: { last: lastMob, days: lastMob ? diffDays(lastMob, today) : null, week: done.filter((m) => m.date >= wk).length }, text };
  }
  return out;
}
// Mobilité conseillée aujourd'hui : soin d'une articulation douloureuse d'abord, sinon la routine qui prépare les muscles du jour
function mobilityFor(plan, joints) {
  const sore = Object.values(joints).filter((j) => j.pain).sort((a, b) => b.pain.intensity - a.pain.intensity)[0];
  if (sore) return { routine: `soin:${sore.key}`, area: sore.key, title: `Soin ${sore.label.toLowerCase()}`, why: `Douleur ${sore.pain.intensity}/10 : 5 à 10 min d’exercices de soin, tous les jours, guérissent plus vite que le repos complet.` };
  const lower = (plan.focus || []).some((f) => ['quadriceps', 'ischios', 'fessiers', 'mollets', 'adducteurs', 'abducteurs'].includes(f.key));
  const over = Object.values(joints).find((j) => j.status === 'surcharge');
  if (plan.done || plan.rest) return { routine: 'apres', title: 'Étirements doux', why: plan.done ? 'Après la séance : 5 min pour revenir au calme.' : 'Jour de repos : bouger en douceur aide la récupération.' };
  return { routine: lower ? 'bas' : 'haut', title: lower ? 'Mobilité avant les jambes' : 'Mobilité avant le haut du corps', why: over ? `${over.label} très sollicitée cette semaine : prépare-la bien.` : '5 à 8 min avant la séance pour préparer les articulations du jour.' };
}
