// Coach GymTrack : moteur d'analyse à base de règles issues de la pratique du coaching
// (volume par groupe musculaire, récupération 48 h, progression double, prise en compte des douleurs).
// Il ne modifie JAMAIS le programme : il produit des propositions que l'utilisateur valide.
import { MUSCLES, EXERCISES } from './seed.js';
import { USER_ID, getProgram, getProfile, lastPerformance, periodStats, exerciseRow } from './services.js';
import { addDays, weekStart, dayKey, diffDays, DAY_KEYS } from './util.js';

export const PAIN_AREAS = {
  epaule: { label: 'Épaule', patterns: ['press_incline', 'press_horizontal', 'dip', 'press_vertical', 'lateral_raise', 'front_raise', 'chest_fly', 'triceps_extension'] },
  coude: { label: 'Coude', patterns: ['triceps_extension', 'triceps_pushdown', 'curl', 'curl_hammer', 'dip'] },
  poignet: { label: 'Poignet', patterns: ['curl', 'curl_hammer', 'press_horizontal', 'press_incline', 'triceps_extension'] },
  bas_du_dos: { label: 'Bas du dos', patterns: ['hinge', 'squat', 'horizontal_row', 'hip_extension', 'leg_press', 'shrug'] },
  genou: { label: 'Genou', patterns: ['squat', 'leg_press', 'knee_extension', 'lunge'] },
  hanche: { label: 'Hanche', patterns: ['hip_abduction', 'hip_adduction', 'squat', 'hip_extension', 'leg_press'] },
  cheville: { label: 'Cheville / mollet', patterns: ['calf', 'squat', 'lunge'] },
  nuque: { label: 'Nuque / cervicales', patterns: ['shrug', 'press_vertical', 'face_pull'] },
  pectoral: { label: 'Pectoral', patterns: ['press_incline', 'press_horizontal', 'dip', 'chest_fly'] },
};

const SMALL = new Set(['avant_bras', 'trapezes', 'abducteurs', 'adducteurs', 'epaules_ant', 'mollets']);
const LOWER = new Set(['quadriceps', 'ischios', 'fessiers', 'adducteurs', 'abducteurs', 'mollets']);
const RANGES = { debutant: [6, 8, 14], intermediaire: [8, 10, 18], avance: [10, 12, 22] };
const DAY_FR = { mon: 'lundi', tue: 'mardi', wed: 'mercredi', thu: 'jeudi', fri: 'vendredi', sat: 'samedi', sun: 'dimanche' };
const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function dayMuscles(day) {
  const m = {};
  for (const pe of day.exercises) for (const [k, c] of Object.entries(pe.muscles)) m[k] = (m[k] || 0) + c * pe.sets;
  return m;
}
const isLowerDay = (dm) => {
  const tot = Object.values(dm).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(dm).filter(([k]) => LOWER.has(k)).reduce((a, [, v]) => a + v, 0) / tot > 0.5;
};

export function recoveryScore(db, profile, today) {
  let score = 85; const factors = [];
  const pains = db.all('SELECT * FROM pain_reports WHERE user_id = ? AND resolved = 0 AND date >= ?', USER_ID, addDays(today, -21));
  if (pains.length) {
    const pen = Math.min(30, pains.reduce((a, p) => a + p.intensity * 2, 0));
    score -= pen; factors.push({ impact: -pen, text: `${pains.length} douleur(s) active(s) signalée(s)` });
  }
  const last7 = periodStats(db, addDays(today, -6), today);
  const rpe = last7.avg_rpe;
  if (rpe >= 9) { score -= 15; factors.push({ impact: -15, text: `Effort ressenti très élevé cette semaine (RPE moyen ${rpe})` }); }
  else if (rpe >= 8) { score -= 8; factors.push({ impact: -8, text: `Effort ressenti élevé (RPE moyen ${rpe})` }); }
  const activeDays = db.one(`SELECT COUNT(DISTINCT d) n FROM (SELECT date d FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ? UNION SELECT date FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?)`,
    USER_ID, addDays(today, -6), today, USER_ID, addDays(today, -6), today).n;
  if (activeDays >= 7) { score -= 15; factors.push({ impact: -15, text: 'Aucun jour de repos sur les 7 derniers jours' }); }
  else if (activeDays === 6) { score -= 5; factors.push({ impact: -5, text: 'Un seul jour de repos sur les 7 derniers jours' }); }
  const prev = periodStats(db, addDays(today, -27), addDays(today, -7));
  const prevWeekly = prev.volume_lbs / 3;
  if (prevWeekly > 0 && last7.volume_lbs > prevWeekly * 1.3) {
    score -= 10; factors.push({ impact: -10, text: `Volume en hausse de ${Math.round((last7.volume_lbs / prevWeekly - 1) * 100)} % par rapport aux 3 semaines précédentes` });
  }
  if (profile.sleep_hours != null) {
    if (profile.sleep_hours < 6) { score -= 10; factors.push({ impact: -10, text: `Sommeil court (${profile.sleep_hours} h)` }); }
    else if (profile.sleep_hours < 7) { score -= 5; factors.push({ impact: -5, text: `Sommeil un peu court (${profile.sleep_hours} h)` }); }
    else factors.push({ impact: 0, text: `Sommeil correct (${profile.sleep_hours} h)` });
  }
  const hiit = db.one('SELECT COALESCE(SUM(duration_min),0) m FROM cardio_sessions WHERE user_id = ? AND rpe >= 8 AND date BETWEEN ? AND ?', USER_ID, addDays(today, -6), today).m;
  if (hiit > 60) { score -= 5; factors.push({ impact: -5, text: `${Math.round(hiit)} min de cardio intense cette semaine` }); }
  if (!factors.length) factors.push({ impact: 0, text: 'Aucun signal de fatigue détecté' });
  score = Math.max(0, Math.min(100, score));
  return { score, label: score >= 75 ? 'Bonne' : score >= 55 ? 'Correcte' : 'À surveiller', factors, pains };
}

function scheduleIssues(days, schedule) {
  const byCode = Object.fromEntries(days.map((d) => [d.code, d]));
  const issues = []; let penalty = 0;
  for (let i = 0; i < 7; i++) {
    const a = byCode[schedule[WEEK[i]]]; const b = byCode[schedule[WEEK[(i + 1) % 7]]];
    if (a && b) {
      const ma = dayMuscles(a), mb = dayMuscles(b);
      const shared = Object.keys(ma).filter((k) => ma[k] >= 3 && (mb[k] || 0) >= 3);
      if (shared.length) {
        penalty += shared.length * 3;
        issues.push(`${a.name} (${DAY_FR[WEEK[i]]}) puis ${b.name} (${DAY_FR[WEEK[(i + 1) % 7]]}) : moins de 48 h de récupération pour ${shared.map((k) => MUSCLES[k].toLowerCase()).join(', ')}.`);
      }
      if (isLowerDay(ma) && isLowerDay(mb)) { penalty += 4; issues.push(`Deux séances jambes consécutives (${DAY_FR[WEEK[i]]} et ${DAY_FR[WEEK[(i + 1) % 7]]}).`); }
    }
  }
  let streak = 0, maxStreak = 0;
  for (let i = 0; i < 14; i++) { if (byCode[schedule[WEEK[i % 7]]]) { streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0; }
  maxStreak = Math.min(maxStreak, 7);
  if (maxStreak > 3) { penalty += (maxStreak - 3) * 4; issues.push(`${maxStreak} jours d’entraînement d’affilée : prévoir un jour de repos pour mieux récupérer.`); }
  const missing = days.filter((d) => !Object.values(schedule).includes(d.code));
  if (missing.length) { penalty += missing.length; issues.push(`Non planifié(s) dans la semaine : ${missing.map((d) => d.name).join(', ')}.`); }
  return { issues, penalty };
}

function bestSchedule(days, available) {
  const codes = days.map((d) => d.code);
  const slots = WEEK.filter((d) => available.includes(d));
  const n = Math.min(codes.length, slots.length);
  if (!n) return null;
  let best = null;
  const choose = (start, acc, out) => { if (acc.length === n) { out.push([...acc]); return; } for (let i = start; i < slots.length; i++) { acc.push(slots[i]); choose(i + 1, acc, out); acc.pop(); } };
  const combos = []; choose(0, [], combos);
  const perms = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
  const codePerms = perms(codes).filter((p) => p.length >= n);
  for (const combo of combos) {
    for (const p of codePerms) {
      const sched = Object.fromEntries(WEEK.map((d) => [d, 'rest']));
      combo.forEach((d, i) => { sched[d] = p[i]; });
      const { penalty } = scheduleIssues(days, sched);
      const order = p.slice(0, n).reduce((a, c, i) => a + (c === codes[i] ? 0 : 0.2), 0); // garder l'ordre du programme si possible
      const total = penalty + order;
      if (!best || total < best.total) best = { total, schedule: sched };
    }
  }
  return best;
}

// Progression double : on ne propose une hausse que si TOUTES les séries prévues ont été réussies.
function progressionFor(db, pe, painPatterns, recovery) {
  const last = lastPerformance(db, pe.exercise_id);
  const base = { program_exercise_id: pe.id, exercise_id: pe.exercise_id, exercise: pe.name, day_id: pe.day_id };
  if (!last) {
    if (pe.kind !== 'bodyweight' && pe.target_weight == null) return { ...base, key: `prog:${pe.id}:setup`, type: 'info', title: `${pe.name} : charge à définir`, reason: 'Aucune charge enregistrée. Choisis une charge qui laisse 2 répétitions en réserve à la dernière série ; elle sera mémorisée pour la prochaine séance.' };
    return null;
  }
  const done = last.sets.filter((s) => s.completed);
  const target = pe.reps;
  const allHit = done.length >= pe.sets && (!target || done.every((s) => (s.reps || 0) >= target));
  const weights = done.map((s) => s.weight).filter((w) => w != null);
  const lastW = weights.length ? (pe.kind === 'assisted' ? Math.min(...weights) : Math.max(...weights)) : null;
  const unit = pe.weight_unit;
  if (pe.kind === 'weighted' && lastW == null) {
    return { ...base, key: `prog:${pe.id}:setup`, type: 'info', title: `${pe.name} : charge à définir`, reason: 'Aucune charge saisie lors de la dernière séance. Renseigne la charge utilisée pour que le coach puisse suivre ta progression.' };
  }
  if (painPatterns.has(pe.pattern)) {
    return { ...base, key: `prog:${pe.id}:pain`, type: 'hold', title: `${pe.name} : ne pas augmenter`, reason: 'Une douleur active concerne cet exercice. Garde la charge (ou baisse-la), réduis l’amplitude si besoin et privilégie une technique parfaite. Si la douleur persiste, consulte un professionnel de santé.' };
  }
  if (allHit && recovery.score < 55) {
    return { ...base, key: `prog:${pe.id}:recovery`, type: 'hold', title: `${pe.name} : objectif atteint, progression en pause`, reason: `Toutes les séries sont réussies, mais ta récupération est « ${recovery.label.toLowerCase()} » (${recovery.score}/100). On consolide avant d’augmenter.` };
  }
  if (allHit) {
    if (pe.kind === 'assisted' && lastW != null) {
      const proposed = Math.max(0, lastW - (unit === 'kg' ? 5 : 10));
      return { ...base, key: `prog:${pe.id}:inc:${proposed}`, type: 'increase', title: `${pe.name} : réduire l’assistance`, current: `${lastW} ${unit}`, proposed_label: `${proposed} ${unit} d’assistance`, patch: { target_weight: proposed, target_weight_max: null }, reason: `Les ${pe.sets} × ${target} ont été réussies le ${last.date} avec ${lastW} ${unit} d’assistance.` };
    }
    if (lastW != null && pe.kind !== 'bodyweight') {
      let proposed = lastW + (unit === 'kg' ? 2.5 : 5);
      if (pe.target_weight_max && lastW < pe.target_weight_max) proposed = pe.target_weight_max;
      return { ...base, key: `prog:${pe.id}:inc:${proposed}`, type: 'increase', title: `${pe.name} : passer à ${proposed} ${unit}`, current: `${lastW} ${unit}`, proposed_label: `${proposed} ${unit}${pe.weight_note ? ' ' + pe.weight_note : ''}`, patch: { target_weight: proposed, target_weight_max: null }, reason: `Toutes les séries (${pe.sets} × ${target ?? '?'}) réussies le ${last.date}. Petite hausse, à condition que la technique reste propre.` };
    }
    if (target && target < 15) {
      const proposed = Math.min(15, target + 2);
      return { ...base, key: `prog:${pe.id}:reps:${proposed}`, type: 'increase', title: `${pe.name} : viser ${proposed} répétitions`, current: `${target} reps`, proposed_label: `${pe.sets} × ${proposed}`, patch: { reps: proposed }, reason: `Toutes les séries réussies le ${last.date}. Au poids du corps, on progresse d’abord en répétitions (ou en ajoutant du lest au-delà de 15).` };
    }
    return null;
  }
  // Échecs répétés : proposer de consolider ou baisser légèrement
  if (target && lastW != null) {
    const prevWorkout = db.one(`SELECT w.id, w.date FROM workouts w JOIN workout_sets s ON s.workout_id = w.id WHERE w.user_id = ? AND s.exercise_id = ? AND w.id <> ? AND w.date <= ? ORDER BY w.date DESC, w.id DESC LIMIT 1`, USER_ID, pe.exercise_id, last.workout_id, last.date);
    const missBy = (sets) => sets.length ? sets.reduce((a, s) => a + Math.max(0, target - (s.reps || 0)), 0) / sets.length : 0;
    const prevSets = prevWorkout ? db.all('SELECT * FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND completed = 1', prevWorkout.id, pe.exercise_id) : [];
    if (missBy(done) >= 2 && prevSets.length && missBy(prevSets) >= 2) {
      const proposed = pe.kind === 'assisted' ? lastW + (unit === 'kg' ? 5 : 10) : Math.max(0, Math.round(lastW * 0.9 / 5) * 5);
      return { ...base, key: `prog:${pe.id}:dec:${proposed}`, type: 'decrease', title: `${pe.name} : consolider à ${proposed} ${unit}`, current: `${lastW} ${unit}`, proposed_label: `${proposed} ${unit}${pe.kind === 'assisted' ? ' d’assistance' : ''}`, patch: { target_weight: proposed, target_weight_max: null }, reason: `Répétitions manquées sur les deux dernières séances (${prevWorkout.date} et ${last.date}). Une baisse d’environ 10 % permet de retrouver une technique propre et de repartir.` };
    }
  }
  return null;
}

// Progression d'un bloc cardio du programme : +5 min, puis +1 % d'inclinaison ou +0,3 km/h. Jamais appliquée sans validation.
function cardioProgressionFor(db, c, recovery, today) {
  const sessions = db.all('SELECT * FROM cardio_sessions WHERE program_cardio_id = ? AND date >= ? ORDER BY date DESC, id DESC LIMIT 2', c.id, addDays(today, -28));
  if (sessions.length < 2) return null;
  const base = { cardio_id: c.id, exercise: c.label, day_id: c.day_id };
  const allDone = sessions.every((s) => s.duration_min >= c.duration_min - 0.5);
  const hard = sessions.some((s) => s.rpe != null && s.rpe >= 9);
  if (!allDone || hard) return null;
  if (recovery.score < 55) return { ...base, key: `cardio:${c.id}:recovery`, type: 'hold', title: `${c.label} : on garde ${c.duration_min} min`, reason: `Les deux dernières séances sont réussies, mais ta récupération est « ${recovery.label.toLowerCase()} » (${recovery.score}/100). On consolide.` };
  const dates = sessions.map((s) => s.date).reverse().join(' et ');
  const cap = c.activity === 'marche' || c.activity === 'marche_inclinee' ? 45 : 40;
  if (c.duration_min < cap) {
    const proposed = Math.min(cap, c.duration_min + 5);
    return { ...base, key: `cardio:${c.id}:min:${proposed}`, type: 'increase', title: `${c.label} : passer à ${proposed} min`, current: `${c.duration_min} min`, proposed_label: `${proposed} min`, patch: { duration_min: proposed }, reason: `${c.duration_min} min tenues le ${dates}. +5 min, à une intensité qui te laisse parler, pour ne pas gêner la récupération musculaire.` };
  }
  if (c.activity === 'marche_inclinee' && (c.incline_pct ?? 0) < 12) {
    const proposed = (c.incline_pct ?? 0) + 1;
    return { ...base, key: `cardio:${c.id}:inc:${proposed}`, type: 'increase', title: `${c.label} : inclinaison ${proposed} %`, current: `${c.incline_pct ?? 0} %`, proposed_label: `${proposed} % d’inclinaison`, patch: { incline_pct: proposed }, reason: `Durée maximale atteinte (${c.duration_min} min, le ${dates}). On progresse maintenant par l’inclinaison.` };
  }
  if (c.speed_kmh) {
    const proposed = Math.round((c.speed_kmh + 0.3) * 10) / 10;
    return { ...base, key: `cardio:${c.id}:speed:${proposed}`, type: 'increase', title: `${c.label} : ${proposed} km/h`, current: `${c.speed_kmh} km/h`, proposed_label: `${proposed} km/h`, patch: { speed_kmh: proposed }, reason: `Durée maximale atteinte (${c.duration_min} min, le ${dates}). Légère hausse de vitesse.` };
  }
  return null;
}

export function analyse(db, today) {
  const profile = getProfile(db);
  const { days } = getProgram(db, { withLast: false });
  const level = profile.level || 'intermediaire';
  const [minS, optLow, optHigh] = RANGES[level] || RANGES.intermediaire;
  const recovery = recoveryScore(db, profile, today);
  const findings = [];
  const add = (category, severity, title, detail) => findings.push({ id: `${category}:${findings.length}`, category, severity, title, detail });

  // 1. Volume hebdomadaire par groupe musculaire (séries directes = 1, synergistes = 0,5)
  const weekly = {}; const direct = {};
  for (const d of days) for (const pe of d.exercises) for (const [k, c] of Object.entries(pe.muscles)) {
    weekly[k] = (weekly[k] || 0) + c * pe.sets; if (c >= 1) direct[k] = (direct[k] || 0) + pe.sets;
  }
  const muscles = Object.keys(MUSCLES).map((k) => {
    const f = SMALL.has(k) ? 0.5 : 1;
    const sets = Math.round((weekly[k] || 0) * 10) / 10;
    const min = Math.round(minS * f), lo = Math.round(optLow * f), hi = Math.round(optHigh * f * (SMALL.has(k) ? 1.4 : 1));
    const status = sets === 0 ? 'absent' : sets < min ? 'faible' : sets < lo ? 'limite' : sets > hi ? 'eleve' : 'optimal';
    return { key: k, label: MUSCLES[k], sets, direct_sets: direct[k] || 0, min, opt_low: lo, opt_high: hi, status };
  });
  const absent = muscles.filter((m) => m.status === 'absent');
  const low = muscles.filter((m) => m.status === 'faible');
  if (absent.length) add('volume', 'important', `Aucun travail direct : ${absent.map((m) => m.label).join(', ')}`, 'Ces groupes ne sont sollicités par aucun exercice du programme. Le gainage en particulier protège le bas du dos sur le squat et le RDL.');
  if (low.length) add('volume', 'attention', `Volume faible : ${low.map((m) => `${m.label} (${m.sets} séries)`).join(', ')}`, `Pour un niveau ${level}, viser au moins ${minS} séries effectives par semaine sur les grands groupes (la moitié pour les petits). Avec 2 séries par exercice, le volume reste modeste : ajouter une 3e série sur les exercices principaux est l’option la plus simple quand la récupération le permet.`);
  const high = muscles.filter((m) => m.status === 'eleve');
  if (high.length) add('volume', 'info', `Volume élevé : ${high.map((m) => m.label).join(', ')}`, 'Surveille la récupération de ces muscles ; ce n’est pas un problème si les performances progressent.');

  // 2. Redondances (même schéma moteur dans la même séance)
  for (const d of days) {
    const byPattern = {};
    for (const pe of d.exercises) (byPattern[pe.pattern] ||= []).push(pe);
    for (const [pattern, list] of Object.entries(byPattern)) {
      if (list.length < 2 || pattern === 'calf') continue;
      const names = list.map((p) => p.name).join(', ');
      if (pattern === 'horizontal_row') add('redondance', 'attention', `${d.name} : ${list.length} tirages horizontaux (${names})`, 'Ces exercices travaillent quasiment les mêmes fibres. Remplacer l’un d’eux par un tirage vertical (lat pulldown) ou un pull-over équilibrerait largeur et épaisseur du dos.');
      else add('redondance', 'info', `${d.name} : exercices proches (${names})`, 'Même schéma de mouvement : garde-les si tu aimes la variété, sinon remplace l’un par un exercice qui cible un angle différent.');
    }
  }

  // 3. Déséquilibres
  const w = (k) => weekly[k] || 0;
  const push = w('pectoraux') + w('epaules_ant'); const pull = w('dos_largeur') + w('dos_epaisseur') + w('epaules_post');
  if (pull && push / pull > 1.25) add('desequilibre', 'attention', `Plus de poussée que de tirage (ratio ${(push / pull).toFixed(2)})`, 'Un excès de poussée favorise l’enroulement des épaules. Vise un ratio proche de 1:1 en ajoutant du tirage ou du travail d’arrière d’épaule.');
  else if (push && pull / push > 1.4) add('desequilibre', 'info', 'Plus de tirage que de poussée', 'Pas problématique en soi, souvent même bénéfique pour la posture.');
  else add('desequilibre', 'ok', `Poussée / tirage équilibrés (${push.toFixed(1)} / ${pull.toFixed(1)} séries)`, 'Bon équilibre entre la face avant et la face arrière du haut du corps.');
  if (w('ischios') && w('quadriceps') / w('ischios') > 1.6) add('desequilibre', 'attention', 'Quadriceps dominants par rapport aux ischios', 'Ajoute du travail d’ischios (leg curl, RDL) pour protéger les genoux.');
  if (w('quadriceps') && w('ischios') / w('quadriceps') > 1.5) add('desequilibre', 'info', `Ischios plus travaillés que les quadriceps (${w('ischios')} vs ${w('quadriceps')} séries)`, 'Si l’objectif est des cuisses équilibrées, une série de plus en leg press ou leg extension compenserait.');
  const vert = days.flatMap((d) => d.exercises).filter((p) => p.pattern === 'vertical_pull').reduce((a, p) => a + p.sets, 0);
  const horiz = days.flatMap((d) => d.exercises).filter((p) => p.pattern === 'horizontal_row').reduce((a, p) => a + p.sets, 0);
  if (horiz > vert * 1.8) add('desequilibre', 'info', `Tirage horizontal ${horiz} séries vs vertical ${vert}`, 'Le grand dorsal (largeur du dos) gagnerait à recevoir un peu plus de tirage vertical.');
  if (w('lombaires') < 2) add('desequilibre', 'info', 'Chaîne postérieure basse peu renforcée', 'Quelques séries d’extensions lombaires renforcent le dos pour le squat et le RDL.');

  // 4. Répartition des séances et durée
  const sched = scheduleIssues(days, profile.schedule);
  const best = bestSchedule(days, profile.available_days);
  const proposal = best && best.total < sched.penalty - 0.5 ? best.schedule : null;
  for (const t of sched.issues) add('repartition', 'attention', 'Répartition à revoir', t);
  if (!sched.issues.length) add('repartition', 'ok', 'Répartition hebdomadaire cohérente', 'Chaque groupe musculaire dispose d’au moins 48 h entre deux sollicitations importantes.');
  const perDay = days.map((d) => {
    const sets = d.exercises.reduce((a, p) => a + p.sets, 0);
    const minutes = Math.round(d.exercises.reduce((a, p) => a + p.sets * (45 + (p.rest_seconds || profile.default_rest_seconds)), 0) / 60) + 8;
    return { day_id: d.id, code: d.code, name: d.name, focus: d.focus, sets, est_minutes: minutes, lower: isLowerDay(dayMuscles(d)) };
  });
  const tooLong = perDay.filter((p) => p.est_minutes > (profile.session_minutes || 60));
  if (tooLong.length) add('repartition', 'info', `Séance(s) plus longue(s) que ta disponibilité (${profile.session_minutes} min)`, tooLong.map((p) => `${p.name} ≈ ${p.est_minutes} min`).join(' · '));

  // 5. Douleurs actives
  const painPatterns = new Set();
  for (const p of recovery.pains) {
    const area = PAIN_AREAS[p.area]; if (!area) continue;
    area.patterns.forEach((x) => painPatterns.add(x));
    const affected = days.flatMap((d) => d.exercises).filter((pe) => area.patterns.includes(pe.pattern)).map((pe) => pe.name);
    add('douleur', p.intensity >= 6 ? 'important' : 'attention', `Douleur ${area.label.toLowerCase()} (${p.intensity}/10) signalée le ${p.date}`,
      `Exercices concernés : ${[...new Set(affected)].join(', ') || 'aucun'}. Aucune hausse de charge ne sera proposée sur ces exercices. Réduis la charge ou l’amplitude, échauffe-toi davantage et arrête tout exercice qui provoque une douleur vive.${p.intensity >= 6 ? ' Au-delà de quelques jours, consulte un professionnel de santé.' : ''}`);
  }

  // 6. Historique : évolution du volume
  const last4 = periodStats(db, addDays(today, -27), today);
  const prev4 = periodStats(db, addDays(today, -55), addDays(today, -28));
  const history = { last4, prev4, volume_change_pct: prev4.volume_lbs ? Math.round((last4.volume_lbs / prev4.volume_lbs - 1) * 100) : null };
  if (last4.workouts === 0) add('historique', 'info', 'Pas encore de séance enregistrée', 'L’analyse des performances et les propositions de progression apparaîtront après tes premières séances.');
  else {
    const target = profile.sessions_per_week || days.length;
    if (last4.workouts_per_week < target * 0.6) add('historique', 'attention', `Régularité : ${last4.workouts_per_week} séance(s)/semaine sur 4 semaines`, `Ton objectif est ${target} séances/semaine. Si c’est difficile à tenir, un programme sur ${Math.max(3, target - 1)} jours serait plus réaliste.`);
    if (history.volume_change_pct != null && history.volume_change_pct > 25) add('historique', 'attention', `Volume en forte hausse (+${history.volume_change_pct} %)`, 'Une hausse de plus de 20-25 % en un mois augmente le risque de fatigue. Stabilise quelques semaines.');
    const weeksSinceStart = db.one('SELECT MIN(date) d FROM workouts WHERE user_id = ?', USER_ID).d;
    if (weeksSinceStart && diffDays(weeksSinceStart, today) >= 42 && recovery.score < 70) add('recuperation', 'attention', 'Semaine allégée conseillée', 'Après 6 semaines d’entraînement avec des signes de fatigue, une semaine à -40 % de volume (même charges, moins de séries) aide à repartir.');
  }
  if (recovery.score < 55) add('recuperation', 'important', `Récupération à surveiller (${recovery.score}/100)`, 'Privilégie le sommeil, ajoute un jour de repos et garde le cardio léger (zone 2) cette semaine.');

  // 7. Suggestions d'exercices complémentaires
  const inProgram = new Set(days.flatMap((d) => d.exercises.map((p) => p.exercise_id)));
  const library = db.all('SELECT * FROM exercises').map(exerciseRow);
  const suggestions = [];
  const weakKeys = [...absent, ...low].map((m) => m.key);
  if (w('lombaires') < 2 && !weakKeys.includes('lombaires')) weakKeys.push('lombaires');
  if (horiz > vert * 1.8) weakKeys.push('dos_largeur');
  for (const k of [...new Set(weakKeys)]) {
    const cands = library.filter((e) => !inProgram.has(e.id) && (e.muscles[k] || 0) >= 1 && !painPatterns.has(e.pattern)).slice(0, 2);
    // jour cible : celui qui travaille déjà le muscle (synergie), sinon la séance la plus courte
    const scored = perDay.map((p) => ({ p, s: dayMuscles(days.find((d) => d.id === p.day_id))[k] || 0 }));
    const target = scored.sort((a, b) => b.s - a.s || a.p.sets - b.p.sets)[0];
    const day = target?.s > 0 ? target.p : [...perDay].sort((a, b) => a.sets - b.sets)[0];
    for (const e of cands) {
      suggestions.push({ key: `add:${e.id}:${day.day_id}`, muscle: MUSCLES[k], exercise_id: e.id, exercise: e.name, technique: e.technique, day_id: day.day_id, day_name: `${day.name} — ${day.focus}`, sets: 2, reps: e.pattern.startsWith('core_anti') ? 30 : 12, reason: `${MUSCLES[k]} : ${Math.round(w(k) * 10) / 10} série(s) par semaine actuellement.` });
    }
  }

  // 8. Progression (validation obligatoire)
  const progression = [];
  for (const d of days) for (const pe of d.exercises) { const p = progressionFor(db, pe, painPatterns, recovery); if (p) progression.push({ ...p, day_name: d.name }); }
  for (const d of days) for (const c of d.cardio || []) { const p = cardioProgressionFor(db, c, recovery, today); if (p) progression.push({ ...p, day_name: d.name }); }

  // Filtrer ce qui a déjà été validé ou ignoré récemment
  const log = db.all('SELECT rec_key, status, created_at FROM recommendation_log WHERE user_id = ? AND created_at >= ?', USER_ID, addDays(today, -21));
  const hidden = new Set(log.map((l) => l.rec_key));
  const filter = (list) => list.filter((x) => !hidden.has(x.key));

  const order = { important: 0, attention: 1, info: 2, ok: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    generated_at: new Date().toISOString(), today, level,
    recovery: { score: recovery.score, label: recovery.label, factors: recovery.factors },
    volume: { muscles, per_day: perDay, total_sets: perDay.reduce((a, p) => a + p.sets, 0) },
    findings, history,
    schedule: { current: profile.schedule, issues: sched.issues, proposed: proposal, available_days: profile.available_days },
    suggestions: filter(suggestions),
    progression: filter(progression),
    cardio: cardioPlan(db, profile, today, recovery, days),
  };
}

// Plan cardio progressif : part du niveau, avance seulement si la semaine précédente a été tenue
// et si la récupération le permet ; jamais d'intensité la veille d'une séance jambes.
export function cardioPlan(db, profile, today, recovery, days) {
  const level = profile.cardio_level || 'debutant';
  const startMin = { debutant: 15, intermediaire: 20, avance: 25 }[level] || 15;
  const targetMin = Math.max(startMin, profile.cardio_minutes_target || 30);
  const targetSessions = Math.max(1, Math.min(6, profile.cardio_sessions_target || 3));
  const goal = profile.cardio_goal || 'sante_cardio';
  const steps = []; let sessions = Math.min(2, targetSessions), minutes = startMin;
  while (steps.length < 12) {
    steps.push({ sessions, minutes });
    if (sessions >= targetSessions && minutes >= targetMin) break;
    if (minutes < targetMin && (minutes - startMin) / 5 < (sessions - 1) * 2) minutes = Math.min(targetMin, minutes + 5);
    else if (sessions < targetSessions) sessions += 1;
    else minutes = Math.min(targetMin, minutes + 5);
  }
  const ws = weekStart(today);
  const lastWeek = db.one('SELECT COALESCE(SUM(duration_min),0) m, COUNT(*) n FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, addDays(ws, -7), addDays(ws, -1));
  const thisWeek = db.one('SELECT COALESCE(SUM(duration_min),0) m, COUNT(*) n FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, ws, addDays(ws, 6));
  let idx = steps.findIndex((s) => s.sessions * s.minutes > lastWeek.m * 1.0);
  if (idx === -1) idx = steps.length - 1;
  const rationale = [];
  if (lastWeek.m > 0) rationale.push(`Semaine dernière : ${Math.round(lastWeek.m)} min de cardio en ${lastWeek.n} séance(s).`);
  else rationale.push(`Point de départ adapté à un niveau ${level.replace('debutant', 'débutant').replace('intermediaire', 'intermédiaire').replace('avance', 'avancé')}.`);
  if (recovery.score < 55 && idx > 0) { idx -= 1; rationale.push('Récupération à surveiller : le plan reste au palier précédent et en intensité légère.'); }
  else if (recovery.score < 55) rationale.push('Récupération à surveiller : intensité légère uniquement.');
  const allowIntervals = level !== 'debutant' && ['endurance', 'perte_de_poids'].includes(goal) && recovery.score >= 70;
  const weeks = steps.slice(idx, idx + 6).map((s, i) => ({ week: i + 1, start: addDays(ws, i * 7), sessions: s.sessions, minutes: s.minutes, total: s.sessions * s.minutes, intensity: allowIntervals && i >= 1 ? '1 séance fractionnée + zone 2' : 'Zone 2 (RPE 3-4, tu peux parler)' }));
  rationale.push(`Objectif : ${targetSessions} × ${targetMin} min/semaine. Progression d’environ 5 min ou 1 séance par semaine, uniquement si la semaine précédente a été tenue.`);
  rationale.push('Cardio placé de préférence après les séances haut du corps ou les jours de repos ; jamais d’effort intense la veille d’une séance jambes.');

  // Placement de la semaine en cours
  const byCode = Object.fromEntries(days.map((d) => [d.code, d]));
  const lowerCode = (c) => byCode[c] && isLowerDay(dayMuscles(byCode[c]));
  const prefs = profile.cardio_preferred?.length ? profile.cardio_preferred : ['marche_inclinee', 'velo'];
  const cur = weeks[0];
  const candidates = WEEK.map((k, i) => {
    const code = profile.schedule[k]; const next = profile.schedule[WEEK[(i + 1) % 7]];
    let score = 0;
    if (code === 'rest') score += 3; else if (!lowerCode(code)) score += 2; else score -= 2;
    if (lowerCode(next)) score -= 1.5;
    return { day: k, date: addDays(ws, i), score, beforeLegs: lowerCode(next), code };
  }).filter((c) => c.date >= today).sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  const chosen = candidates.slice(0, Math.max(0, cur.sessions - thisWeek.n)).sort((a, b) => a.date.localeCompare(b.date));
  let intervalsUsed = false;
  const this_week = chosen.map((c, i) => {
    const intervals = allowIntervals && !intervalsUsed && !c.beforeLegs && !lowerCode(c.code) && cur.intensity.includes('fractionnée');
    if (intervals) intervalsUsed = true;
    const activity = intervals ? (prefs.find((p) => ['velo', 'rameur', 'elliptique'].includes(p)) || 'velo') : (c.beforeLegs ? (prefs.find((p) => p !== 'course') || 'marche_inclinee') : prefs[i % prefs.length]);
    return { date: c.date, day: c.day, activity, minutes: cur.minutes, intensity: intervals ? 'Fractionné : 6 × (1 min soutenu / 2 min facile)' : 'Zone 2 — RPE 3-4',
      note: c.code === 'rest' ? 'Jour de repos : cardio léger qui favorise la récupération.' : lowerCode(c.code) ? 'Après les jambes : rester très léger.' : 'Après la musculation (pas avant), pour ne pas entamer ta force.' };
  });
  return { goal, level, weeks, this_week, rationale, done_this_week: { minutes: Math.round(thisWeek.m), sessions: thisWeek.n } };
}

export { DAY_FR, WEEK, DAY_KEYS };
