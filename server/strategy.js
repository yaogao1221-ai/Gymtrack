// Plan selon l'objectif : à partir de l'objectif de poids ou de composition, de l'état actuel (poids lissé, % de gras,
// tendance, assiduité, progression des charges, récupération) et du programme, propose une fréquence d'entraînement,
// des calories et macros, un type de cure et des réglages du programme. Rien n'est appliqué sans validation.
import { USER_ID, getProfile, getProgram, goalsWithProgress } from './services.js';
import { nutritionState, targets, PLAN_TYPES } from './nutrition.js';
import { analyse, recoveryScore } from './analysis.js';
import { addDays, weekStart } from './util.js';
import { e1rm, toLbs, r1 } from './formulas.js';

export const MODES = {
  seche: 'Sèche', masse: 'Prise de masse', recompo: 'Recomposition', maintien: 'Maintien',
};
const fr = (x) => String(x).replace('.', ',');
const LEVELS = { debutant: 'débutant', intermediaire: 'intermédiaire', avance: 'avancé' };
const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// Jours d'entraînement bien répartis selon la fréquence (au moins un jour de repos entre les blocs)
const PATTERNS = { 1: ['wed'], 2: ['mon', 'thu'], 3: ['mon', 'wed', 'fri'], 4: ['mon', 'tue', 'thu', 'fri'], 5: ['mon', 'tue', 'wed', 'fri', 'sat'], 6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], 7: WEEK };
// Repères de % de gras (hommes / femmes) : au-dessus de « haut », perdre du gras d'abord ; en dessous de « bas », la prise de masse est la voie logique
const BF = { homme: { low: 12, high: 20, min: 8 }, femme: { low: 21, high: 30, min: 15 } };

// Assiduité : séances réalisées par semaine sur les 4 dernières semaines complètes
function adherence(db, today, planned) {
  const to = addDays(weekStart(today), -1); const from = addDays(to, -27);
  const n = db.one('SELECT COUNT(*) n FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, from, to).n;
  const first = db.one('SELECT MIN(date) d FROM workouts WHERE user_id = ?', USER_ID).d;
  const weeks = first ? Math.max(1, Math.min(4, Math.ceil((new Date(`${to}T00:00:00Z`) - new Date(`${first > from ? first : from}T00:00:00Z`)) / 864e5 / 7))) : 0;
  const perWeek = weeks ? r1(n / weeks) : null;
  return { per_week: perWeek, weeks, planned, ratio: perWeek != null && planned ? Math.min(1.5, perWeek / planned) : null };
}

// Progression des charges : meilleur 1RM estimé des 3 dernières semaines contre les 3 précédentes, exercice par exercice
function strengthTrend(db, today) {
  const rows = db.all(`SELECT s.exercise_id id, w.date, s.weight, s.weight_unit, s.reps, e.kind FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND s.weight > 0 AND w.date BETWEEN ? AND ?`, USER_ID, addDays(today, -41), today);
  const mid = addDays(today, -20); const best = {};
  for (const r of rows) {
    if (r.kind === 'assisted') continue;
    const v = e1rm(toLbs(r.weight, r.weight_unit), r.reps); if (!v) continue;
    const b = (best[r.id] ||= { a: 0, b: 0 }); if (r.date < mid) b.a = Math.max(b.a, v); else b.b = Math.max(b.b, v);
  }
  const ch = Object.values(best).filter((x) => x.a && x.b).map((x) => (x.b - x.a) / x.a * 100);
  if (ch.length < 2) return { pct: null, exercises: ch.length };
  return { pct: r1(ch.reduce((a, b) => a + b, 0) / ch.length), exercises: ch.length };
}

// Tendance du tour de taille sur 4 semaines (cm)
function waistTrend(db, today) {
  const rows = db.all('SELECT date, waist_cm v FROM body_metrics WHERE user_id = ? AND waist_cm IS NOT NULL AND date >= ? ORDER BY date, id', USER_ID, addDays(today, -35));
  if (rows.length < 2) return null;
  return { change: r1(rows.at(-1).v - rows[0].v), from: rows[0].date, to: rows.at(-1).date, last: rows.at(-1).v };
}

export function spreadSchedule(freq, codes, available) {
  const avail = WEEK.filter((d) => (available?.length ? available : WEEK).includes(d));
  let days = PATTERNS[freq].every((d) => avail.includes(d)) ? PATTERNS[freq] : null;
  if (!days) { // répartit au mieux sur les jours disponibles
    const step = avail.length / freq; days = Array.from({ length: Math.min(freq, avail.length) }, (_, i) => avail[Math.floor(i * step)]);
  }
  const out = {}; let k = 0;
  for (const d of WEEK) out[d] = days.includes(d) && codes.length ? codes[k++ % codes.length] : 'rest';
  return out;
}

// Choix du mode à partir de l'objectif et de l'état actuel
function chooseMode({ sex, bf, kg, lbm, level, target_kg, target_bf, mode }) {
  const ref = BF[sex] || BF.homme;
  let goalKg = target_kg ?? null; const why = [];
  if (target_bf != null && lbm) {
    // À masse maigre constante : poids qui correspond au % visé
    const kgAtBf = r1(lbm / (1 - target_bf / 100));
    if (goalKg == null) { goalKg = kgAtBf; why.push(`À masse maigre égale (${fr(r1(lbm))} kg), ${fr(target_bf)} % de gras correspond à environ ${fr(kgAtBf)} kg.`); }
  }
  if (mode && MODES[mode]) return { mode, goalKg, why: [...why, 'Mode choisi par toi.'] };
  const gap = goalKg != null && kg ? goalKg - kg : null;
  if (gap != null) {
    if (Math.abs(gap) < kg * 0.015) {
      if (target_bf != null && bf != null && target_bf < bf - 1) return { mode: 'recompo', goalKg, why: [...why, 'Poids visé proche du poids actuel mais moins de gras : recomposition, calories proches du maintien.'] };
      return { mode: 'maintien', goalKg, why: [...why, 'Tu es déjà proche de ton poids visé : on garde les calories de maintien et on progresse sur les charges.'] };
    }
    if (gap < 0) return { mode: 'seche', goalKg, why: [...why, `Il reste ${String(r1(-gap)).replace('.', ',')} kg à perdre : sèche.`] };
    if (bf != null && bf > ref.high) return { mode: 'recompo', goalKg, why: [...why, `Ton % de gras (${fr(bf)} %) est encore élevé pour une prise de masse : la recomposition fait monter le muscle sans ajouter de gras. La prise de masse viendra ensuite.`] };
    return { mode: 'masse', goalKg, why: [...why, `Il reste ${String(r1(gap)).replace('.', ',')} kg à prendre : prise de masse progressive.`] };
  }
  // Sans objectif chiffré : on part du % de gras
  if (bf == null) return { mode: 'maintien', goalKg, why: ['Sans objectif chiffré ni mesure du tour de taille et du cou, on ne peut pas trancher : maintien en attendant. Renseigne un objectif ou tes mensurations.'] };
  if (bf > ref.high) return { mode: 'seche', goalKg, why: [`${fr(bf)} % de gras : au-dessus de ${ref.high} %, perdre du gras d’abord est la priorité.`] };
  if (bf < ref.low) return { mode: 'masse', goalKg, why: [`${fr(bf)} % de gras : en dessous de ${ref.low} %, c’est le bon moment pour une prise de masse.`] };
  return { mode: level === 'avance' ? 'maintien' : 'recompo', goalKg, why: [`${fr(bf)} % de gras : zone intermédiaire, la recomposition est la voie la plus simple${level === 'avance' ? ' (pour un niveau avancé, alterner sèche et masse est plus efficace)' : ''}.`] };
}

export function strategy(db, today, input = {}) {
  const p = getProfile(db);
  const st = nutritionState(db, today);
  const saved = (() => { try { return JSON.parse(p.body_target || 'null') || {}; } catch { return {}; } })();
  const goals = goalsWithProgress(db, today).filter((g) => g.status === 'actif');
  const weightGoal = goals.find((g) => g.type === 'poids_corporel');
  const inp = { mode: input.mode ?? saved.mode ?? null, target_kg: input.target_kg ?? saved.target_kg ?? weightGoal?.target_value ?? null, target_bf: input.target_bf ?? saved.target_bf ?? null, weeks: input.weeks ?? saved.weeks ?? null };
  const kg = st.weight_kg; const bf = st.body_fat?.value ?? null; const lbm = st.lbm_kg; const level = p.level || 'intermediaire';
  const missing = [...st.missing];
  const base = { input: inp, saved: !!Object.keys(saved).length, state: { kg, bf, bf_source: st.body_fat?.source || null, lbm, trend_pct: st.trend.rate_pct, tdee: st.tdee, level, sex: p.sex }, missing };
  if (!kg || !st.tdee) return { ...base, ready: false };

  const choice = chooseMode({ sex: p.sex, bf, kg, lbm, level, ...inp });
  const mode = choice.mode; const why = [...choice.why]; const warnings = [];
  const prog = getProgram(db, { withLast: false });
  const codes = prog.days.map((d) => d.code);
  const planned = Object.values(p.schedule || {}).filter((v) => v && v !== 'rest').length || p.sessions_per_week || 3;
  const adh = adherence(db, today, planned);
  const str = strengthTrend(db, today);
  const waist = waistTrend(db, today);
  const recovery = recoveryScore(db, p, today);

  // 1. Vitesse et durée
  const T = PLAN_TYPES[mode];
  let rate = T ? (mode === 'masse' ? { debutant: 0.5, intermediaire: 0.35, avance: 0.25 }[level] ?? T.rate.def : T.rate.def) : 0;
  const gapKg = choice.goalKg != null ? r1(choice.goalKg - kg) : null;
  let weeks = inp.weeks || null;
  if (T && mode !== 'recompo' && gapKg) {
    const need = weeks ? Math.abs(gapKg) / kg * 100 / weeks : null;
    if (need != null) {
      if (need > T.rate.max) { warnings.push(`Atteindre ${String(choice.goalKg).replace('.', ',')} kg en ${weeks} semaines demande ${String(r1(need)).replace('.', ',')} % par semaine : au-dessus de ${String(T.rate.max).replace('.', ',')} %, ${mode === 'seche' ? 'tu perdrais du muscle' : 'tu prendrais surtout du gras'}. On propose une durée plus longue.`); rate = T.rate.max; weeks = null; }
      else rate = Math.max(T.rate.min, need);
    }
    if (!weeks) weeks = Math.ceil(Math.abs(gapKg) / (kg * rate / 100));
  }
  if (T && !weeks) weeks = T.weeks[2];
  if (T) {
    if (mode === 'seche' && weeks > 16) { warnings.push(`Objectif atteignable en environ ${weeks} semaines : on le découpe en une première sèche de 16 semaines, puis 2 à 4 semaines au maintien avant de reprendre.`); weeks = 16; }
    weeks = Math.max(4, Math.min(52, weeks));
    // Vitesse recalée pour arriver pile sur l'objectif à la fin de la durée retenue (dans les bornes sûres)
    if (mode !== 'recompo' && gapKg && !warnings.length) rate = Math.max(T.rate.min, Math.min(T.rate.max, Math.abs(gapKg) / kg * 100 / weeks));
  }

  // 2. Ajustements selon l'état actuel et la progression
  // Sèche qui fait baisser les charges : perte trop rapide, on ralentit
  if (mode === 'seche' && str.pct != null && str.pct < -4) { rate = Math.max(T.rate.min, rate - 0.2); why.push(`Tes charges baissent (${String(str.pct).replace('.', ',')} % sur 3 semaines) : vitesse ralentie pour protéger le muscle.`); }
  if (mode === 'masse' && waist && waist.change > 2 && (str.pct == null || str.pct < 2)) { rate = Math.max(T.rate.min, rate - 0.1); why.push(`Le tour de taille monte (+${String(waist.change).replace('.', ',')} cm) plus vite que les charges : surplus réduit.`); }
  if (mode === 'recompo' && waist && waist.change > 1) why.push(`Le tour de taille monte (+${String(waist.change).replace('.', ',')} cm) : reste au maintien ou légèrement en dessous.`);
  rate = r1(rate * 100) / 100;

  // 3. Calories et macros (mêmes formules que la cure)
  const t = T ? targets(mode, { kg, tdee: st.tdee, bf, level, rate: mode === 'recompo' ? undefined : rate }) : (() => {
    const kcal = Math.round(st.tdee / 10) * 10; const protein = Math.round(kg * 1.8); const fat = Math.round(Math.max(kg * 0.8, kcal * 0.25 / 9));
    return { rate_pct: 0, kcal, delta: 0, protein_g: protein, fat_g: fat, carbs_g: Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)), fiber_g: Math.round(kcal / 1000 * 14), water_l: r1(kg * 0.035) };
  })();
  // Tendance réelle déjà dans le bon sens et à bonne vitesse : on le dit (rien à changer)
  if (st.trend.rate_pct != null && T && mode !== 'recompo') {
    const target = T.rate.sign * rate;
    if (Math.sign(st.trend.rate_pct) === Math.sign(target) && Math.abs(st.trend.rate_pct) >= Math.abs(target) * 0.6 && Math.abs(st.trend.rate_pct) <= Math.abs(target) * 1.5) why.push(`Ton poids évolue déjà au bon rythme (${st.trend.rate_pct > 0 ? '+' : ''}${String(st.trend.rate_pct).replace('.', ',')} % par semaine).`);
  }

  // 4. Fréquence d'entraînement
  const avail = (p.available_days || WEEK).length;
  const BASE = { seche: [3, 4], masse: [4, 5], recompo: [3, 4], maintien: [3, 4] }[mode];
  let freq = level === 'debutant' ? BASE[0] : level === 'avance' ? BASE[1] + (mode === 'masse' ? 1 : 0) : BASE[1];
  const freqWhy = [`${MODES[mode]}, niveau ${LEVELS[level] || level} : ${freq} séances de muscu par semaine, chaque muscle travaillé 2 fois.`];
  // Assiduité basse : viser juste au-dessus de ce qui est réellement tenu, plutôt qu'un plan qu'on ne suit pas
  if (adh.per_week != null && adh.weeks >= 2 && adh.per_week + 1 < freq) { freq = Math.max(2, Math.ceil(adh.per_week) + 1); freqWhy.push(`Ces dernières semaines tu fais ${String(adh.per_week).replace('.', ',')} séance(s) par semaine : on vise ${freq}, réaliste, plutôt qu’un plan difficile à tenir.`); }
  if (recovery.score < 55 && freq > 3) { freq -= 1; freqWhy.push(`Récupération à surveiller (${recovery.score}/100) : une séance de moins.`); }
  if (freq > avail) { freq = avail; freqWhy.push(`Limité à tes ${avail} jours disponibles.`); }
  freq = Math.max(1, Math.min(6, freq));
  const schedule = spreadSchedule(freq, codes, p.available_days);
  const scheduleChanged = WEEK.some((d) => (p.schedule?.[d] || 'rest') !== schedule[d]);
  const dropped = prog.days.filter((d) => !Object.values(schedule).includes(d.code));

  // 5. Cardio et pas (le cardio doux aide la sèche sans gêner la récupération ; en masse, juste pour la santé)
  const cardio = { seche: { min: 180, steps: 10000, text: '3 à 4 séances de cardio doux (marche inclinée, vélo) de 45 min, en zone 2 : on peut parler en faisant l’effort.' },
    masse: { min: 90, steps: 7000, text: '2 séances de 45 min pour le cœur et la récupération, pas plus : le surplus doit servir au muscle.' },
    recompo: { min: 120, steps: 8000, text: '2 à 3 séances de 40 à 45 min en zone 2.' },
    maintien: { min: 150, steps: 8000, text: '150 min par semaine : le repère santé de l’OMS.' } }[mode];

  // 6. Réglages du programme : volume par muscle selon la phase
  const report = analyse(db, today);
  const program = [];
  const low = report.volume.muscles.filter((m) => ['absent', 'faible'].includes(m.status));
  const high = report.volume.muscles.filter((m) => m.status === 'eleve');
  if (mode === 'seche') {
    program.push('Garde les mêmes charges et le même nombre de séries : c’est ce qui protège le muscle. Ne cherche pas à battre des records chaque semaine.');
    if (high.length) program.push(`Volume élevé sur ${high.map((m) => m.label.toLowerCase()).join(', ')} : retire 1 série par exercice si la récupération baisse en fin de sèche.`);
  } else if (mode === 'masse') {
    program.push('Ajoute 1 série sur les exercices principaux toutes les 2 à 3 semaines, jusqu’à 12 à 20 séries par muscle et par semaine, à 1 à 3 répétitions de l’échec.');
    if (low.length) program.push(`À renforcer en priorité : ${low.map((m) => `${m.label.toLowerCase()} (${m.sets} séries)`).join(', ')}. L’écran Analyse propose les exercices à ajouter.`);
  } else {
    program.push('Surcharge progressive : ajoute une répétition ou un peu de charge dès que toutes les séries sont réussies.');
    if (low.length) program.push(`Volume faible : ${low.map((m) => m.label.toLowerCase()).join(', ')}. Voir l’écran Analyse.`);
  }
  if (report.deload?.due) program.push('Une semaine de deload est due : place-la avant de changer de phase.');

  // 7. Projection
  const end = T ? addDays(today, weeks * 7 - 1) : null;
  const endKg = T && mode !== 'recompo' ? r1(kg * (1 + T.rate.sign * rate / 100 * weeks)) : null;
  const curPlan = st.plan;
  const samePlan = curPlan && curPlan.type === mode;
  return {
    ...base, ready: true, mode, label: MODES[mode], why, warnings,
    goal: { kg: choice.goalKg, gap_kg: gapKg, bf: inp.target_bf },
    rate_pct: T ? rate : 0, weeks: T ? weeks : null, end_date: end, end_kg: endKg,
    nutrition: { ...t, tdee: st.tdee, note: 'Calories estimées (formule + tes séances réelles) : la balance dira dans 2 semaines si elles sont justes, le contrôle hebdomadaire ajustera.' },
    frequency: { sessions: freq, current: planned, done_per_week: adh.per_week, why: freqWhy, schedule, schedule_changed: scheduleChanged, dropped: dropped.map((d) => d.name), recovery: recovery.score },
    cardio: { ...cardio, current_target: goals.find((g) => g.type === 'cardio_minutes_semaine')?.target_value ?? null },
    program, strength: str, waist,
    current_plan: curPlan ? { id: curPlan.id, type: curPlan.type, label: curPlan.label, week: curPlan.week, weeks: curPlan.weeks, kcal: curPlan.kcal, check: curPlan.check } : null,
    // Ce que « Appliquer » peut changer : chaque élément est coché ou non par l'utilisateur
    actions: [
      T && !samePlan && { key: 'cure', label: `Démarrer : ${MODES[mode]} de ${weeks} semaines à ${t.kcal} kcal par jour`, detail: curPlan ? `Remplace la cure en cours (${curPlan.label}).` : 'Crée aussi l’objectif de fin de cure.' },
      samePlan && curPlan.check?.delta ? { key: 'adjust', label: `Ajuster la cure en cours de ${curPlan.check.delta > 0 ? '+' : ''}${curPlan.check.delta} kcal`, detail: curPlan.check.text } : null,
      scheduleChanged && codes.length && { key: 'frequence', label: `Passer à ${freq} séances par semaine`, detail: `Met à jour ta semaine type et le calendrier à venir (les séances passées ne bougent pas).${dropped.length ? ` ${dropped.map((d) => `${d.name} (${d.focus})`).join(', ')} ne ${dropped.length > 1 ? 'seront' : 'sera'} plus planifié${dropped.length > 1 ? 's' : ''} : déplace ses exercices dans un autre jour (Programme > Modifier) pour garder tout le volume.` : ''}` },
      { key: 'cardio', label: `Objectif cardio : ${cardio.min} min par semaine`, detail: 'Crée ou met à jour l’objectif, l’anneau cardio de l’accueil suit.' },
      choice.goalKg != null && mode !== 'maintien' && !(T && !samePlan) && !weightGoal && { key: 'objectif', label: `Objectif de poids : ${String(choice.goalKg).replace('.', ',')} kg`, detail: 'Suivi sur ton poids moyen de la semaine.' },
    ].filter(Boolean),
  };
}

// Application des éléments cochés : chaque changement passe par les mêmes règles que les écrans concernés
export function applyStrategy(db, today, s, keys, helpers) {
  const done = [];
  const has = (k) => keys.includes(k) && s.actions.some((a) => a.key === k);
  db.tx(() => {
    if (has('cure')) { helpers.startPlan({ type: s.mode, weeks: s.weeks, rate_pct: s.mode === 'recompo' ? undefined : s.rate_pct }); done.push('cure'); }
    if (has('adjust') && s.current_plan) { db.run("UPDATE nutrition_plans SET kcal_adjust = kcal_adjust + ?, last_adjust = ? WHERE id = ? AND status = 'active'", s.current_plan.check.delta, today, s.current_plan.id); done.push('adjust'); }
    if (has('frequence')) { helpers.setSchedule(s.frequency.schedule, s.frequency.sessions); done.push('frequence'); }
    if (has('cardio')) {
      const g = db.one("SELECT id FROM goals WHERE user_id = ? AND type = 'cardio_minutes_semaine' AND status = 'actif' ORDER BY id DESC LIMIT 1", USER_ID);
      if (g) db.run('UPDATE goals SET target_value = ?, title = ? WHERE id = ?', s.cardio.min, `${s.cardio.min} min de cardio par semaine`, g.id);
      else db.run("INSERT INTO goals (user_id, type, title, target_value, unit, status) VALUES (?, 'cardio_minutes_semaine', ?, ?, 'min', 'actif')", USER_ID, `${s.cardio.min} min de cardio par semaine`, s.cardio.min);
      done.push('cardio');
    }
    if (has('objectif')) {
      db.run("INSERT INTO goals (user_id, type, title, start_value, target_value, unit, status) VALUES (?, 'poids_corporel', ?, ?, ?, 'kg', 'actif')", USER_ID, `Poids : ${String(s.goal.kg).replace('.', ',')} kg`, s.state.kg, s.goal.kg);
      done.push('objectif');
    }
  });
  return done;
}

