// Corps et nutrition : métabolisme, composition corporelle, cures (sèche, prise de masse, recomposition)
// Repères tirés des revues et consensus récents, cités dans PLAN_TYPES.
import { USER_ID, getProfile } from './services.js';
import { addDays, weekStart, diffDays } from './util.js';

const r0 = (x) => (x == null ? null : Math.round(x));
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// Niveau d'activité hors entraînement (NEAT), l'entraînement est ajouté à part à partir des séances réelles
export const LIFESTYLE = {
  1.2: 'Sédentaire : assis la plupart du temps, moins de 5 000 pas',
  1.35: 'Peu actif : 5 000 à 7 500 pas par jour',
  1.5: 'Actif : debout souvent, 7 500 à 10 000 pas',
  1.7: 'Très actif : métier physique ou plus de 12 000 pas',
};

export const PLAN_TYPES = {
  seche: {
    label: 'Sèche', verb: 'perdre du gras en gardant le muscle', weeks: [8, 16, 12],
    rate: { min: 0.5, max: 1.0, def: 0.7, sign: -1 },
    protein: 2.3, fat: 0.8,
    rules: [
      'Perte visée : 0,5 à 1 % du poids par semaine. Plus lent = plus de muscle conservé (Helms 2014, Garthe 2011).',
      'Protéines hautes : 2,3 à 3,1 g par kg de masse maigre, environ 2,2 à 2,6 g/kg de poids (Helms 2014).',
      'Lipides au moins 0,6 à 0,8 g/kg (20 à 30 % des calories) pour les hormones ; le reste en glucides pour l’entraînement.',
      'Garde les charges lourdes et le même volume : c’est le signal qui protège le muscle. Ne cherche pas la congestion.',
      'Pas quotidiens 8 000 à 12 000 et cardio doux plutôt que beaucoup de HIIT, pour ne pas gêner la récupération.',
      'Au-delà de 8 semaines, une semaine aux calories de maintien peut aider à tenir et limiter l’adaptation (Byrne 2018, MATADOR).',
    ],
  },
  masse: {
    label: 'Prise de masse', verb: 'prendre du muscle en limitant le gras', weeks: [12, 24, 16],
    rate: { min: 0.25, max: 0.5, def: 0.35, sign: 1 },
    protein: 1.8, fat: 0.9,
    rules: [
      'Prise visée : 0,25 à 0,5 % du poids par semaine (environ 1 à 2 % par mois). Débutant vers le haut, avancé vers le bas (Iraki 2019).',
      'Un surplus modéré (+5 à 15 %) suffit : au-delà on stocke surtout du gras sans plus de muscle.',
      'Protéines 1,6 à 2,2 g/kg : au-dessus de 1,6 g/kg le gain supplémentaire est faible (Morton 2018).',
      'Monte progressivement le volume (10 à 20 séries par muscle et par semaine) en restant à 1 à 3 répétitions de l’échec.',
      'Surveille le tour de taille : s’il grimpe plus vite que les charges, réduis le surplus.',
    ],
  },
  recompo: {
    label: 'Recomposition', verb: 'perdre du gras et prendre du muscle en même temps', weeks: [12, 24, 12],
    rate: { min: 0, max: 0.25, def: 0.1, sign: -1 },
    protein: 2.2, fat: 0.8,
    rules: [
      'Fonctionne surtout pour les débutants, les reprises après pause et les personnes avec plus de gras (Barakat 2020).',
      'Calories proches du maintien (0 à −10 %), le poids bouge peu : juge sur le tour de taille, les photos et les charges.',
      'Protéines hautes : 2 à 2,4 g/kg, réparties sur la journée.',
      'Entraînement en surcharge progressive obligatoire : c’est lui qui fait la recomposition.',
      'Sommeil 7 à 9 h : moins de sommeil fait perdre plus de muscle et moins de gras à calories égales (Nedeltcheva 2010).',
    ],
  },
};

export const GENERAL_TIPS = [
  'Répartis les protéines en 3 à 5 repas d’environ 0,4 g/kg chacun (Schoenfeld & Aragon 2018).',
  'Créatine monohydrate 3 à 5 g par jour, tous les jours : le complément le plus étudié pour la force et le muscle (ISSN 2017).',
  'Fibres : environ 14 g pour 1 000 kcal. Eau : environ 35 ml par kg de poids, plus pendant l’effort.',
  'Pèse-toi 3 à 7 fois par semaine, le matin à jeun : seule la moyenne de la semaine compte.',
];

export function age(p, today) { return p.birth_year ? Number(today.slice(0, 4)) - p.birth_year : null; }

export function navyBodyFat({ sex, height_cm: h, waist_cm: w, neck_cm: n, hip_cm: hip }) {
  if (!h || !w || !n) return null;
  if (sex === 'femme') { if (!hip || w + hip - n <= 0) return null; return r1(495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450); }
  if (w - n <= 0) return null;
  return r1(495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450);
}

export function bmiInfo(kg, cm) {
  if (!kg || !cm) return null;
  const v = kg / (cm / 100) ** 2;
  const cat = v < 18.5 ? 'Insuffisance pondérale' : v < 25 ? 'Corpulence normale' : v < 30 ? 'Surpoids' : 'Obésité';
  return { value: r1(v), category: cat };
}

export function bmr({ sex, kg, cm, years, bf }) {
  if (!kg) return null;
  if (bf != null) return { value: r0(370 + 21.6 * kg * (1 - bf / 100)), formula: 'Katch-McArdle (avec ta masse maigre)' };
  if (!cm || !years) return null;
  return { value: r0(10 * kg + 6.25 * cm - 5 * years + (sex === 'femme' ? -161 : 5)), formula: 'Mifflin-St Jeor' };
}

// Moyennes hebdomadaires du poids (8 dernières semaines)
export function weightTrend(rows, today) {
  const out = [];
  for (let i = 7; i >= 0; i--) {
    const from = addDays(weekStart(today), -7 * i); const to = addDays(from, 6);
    const ws = rows.filter((r) => r.weight_kg && r.date >= from && r.date <= to).map((r) => r.weight_kg);
    out.push({ week: from, avg: ws.length ? r1(ws.reduce((a, b) => a + b, 0) / ws.length) : null, n: ws.length });
  }
  const pts = out.filter((x) => x.avg != null);
  let rate = null;
  if (pts.length >= 2) { const a = pts.at(-2); const b = pts.at(-1); const weeks = Math.max(1, diffDays(a.week, b.week) / 7); rate = r1((((b.avg - a.avg) / a.avg) * 100) / weeks * 10) / 10; }
  return { weeks: out, rate_pct: rate };
}

// Dépense liée à l'entraînement, moyenne par jour sur 28 jours (muscu ≈ 5 MET, cardio : calories calculées)
export function exerciseKcal(db, kg, today) {
  const from = addDays(today, -27);
  const w = db.one('SELECT COALESCE(SUM(duration_sec),0) s, COUNT(*) n FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, from, today);
  const c = db.one('SELECT COALESCE(SUM(calories),0) k, COUNT(*) n FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, from, today);
  const p = getProfile(db);
  const muscuMin = w.s > 0 ? w.s / 60 : w.n * (p.session_minutes || 60);
  const estimated = !w.n && !c.n;
  const muscu = estimated ? (p.sessions_per_week || 3) * 4 * (p.session_minutes || 60) * 5 * kg / 60 : muscuMin * 5 * kg / 60;
  return { per_day: r0((muscu + c.k) / 28), estimated, workouts: w.n, cardio: c.n };
}

export function targets(type, { kg, tdee, bf, level, rate }) {
  const t = PLAN_TYPES[type];
  const r = rate ?? (type === 'masse' ? { debutant: 0.5, intermediaire: 0.35, avance: 0.25 }[level] ?? t.rate.def : t.rate.def);
  let delta = (t.rate.sign * r / 100) * kg * 7700 / 7;
  if (type === 'recompo') delta = -Math.round(tdee * 0.05);
  const kcal = Math.round((tdee + delta) / 10) * 10;
  const lbm = bf != null ? kg * (1 - bf / 100) : null;
  const protein = Math.round(type === 'seche' && lbm && bf > 25 ? lbm * 2.7 : kg * t.protein);
  const fat = Math.round(Math.max(kg * t.fat, (kcal * 0.22) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { rate_pct: r, kcal, delta: Math.round(delta), protein_g: protein, fat_g: fat, carbs_g: carbs, fiber_g: Math.round(kcal / 1000 * 14), water_l: r1(kg * 0.035) };
}

// Contrôle de la semaine : compare la vitesse réelle à la vitesse visée et propose un ajustement (jamais appliqué sans validation)
export function weeklyCheck(plan, trend) {
  const pts = trend.weeks.filter((w) => w.avg != null && w.week >= weekStart(plan.start_date));
  if (pts.length < 2) return { status: 'data', text: 'Pèse-toi au moins 3 matins par semaine : il faut deux semaines de moyennes pour juger la vitesse.', delta: 0 };
  const a = pts.at(-2); const b = pts.at(-1);
  const actual = ((b.avg - a.avg) / a.avg) * 100;
  const t = PLAN_TYPES[plan.type]; const target = t.rate.sign * plan.rate_pct;
  const fmt = (x) => `${x > 0 ? '+' : ''}${(Math.round(x * 100) / 100).toLocaleString('fr-FR')} %`;
  const base = `Cette semaine ${fmt(actual)} (visé ${fmt(target)}).`;
  if (plan.type === 'seche') {
    if (actual > target * 0.5) return { status: 'slow', text: `${base} La perte ralentit : enlève environ 150 kcal par jour ou ajoute 2 000 pas.`, delta: -150, actual: r1(actual) };
    if (actual < target * 1.6) return { status: 'fast', text: `${base} Ça descend trop vite, risque de perdre du muscle : rajoute environ 150 kcal.`, delta: 150, actual: r1(actual) };
  } else if (plan.type === 'masse') {
    if (actual < target * 0.5) return { status: 'slow', text: `${base} La prise est trop lente : ajoute environ 150 kcal par jour.`, delta: 150, actual: r1(actual) };
    if (actual > target * 1.6) return { status: 'fast', text: `${base} Ça monte trop vite (surtout du gras) : enlève environ 100 kcal.`, delta: -100, actual: r1(actual) };
  } else {
    if (actual > 0.25) return { status: 'fast', text: `${base} Le poids monte : enlève environ 150 kcal, sauf si ton tour de taille baisse.`, delta: -150, actual: r1(actual) };
    if (actual < -0.6) return { status: 'slow', text: `${base} Tu perds trop vite pour une recomposition : rajoute environ 150 kcal.`, delta: 150, actual: r1(actual) };
  }
  return { status: 'ok', text: `${base} Dans la cible, ne change rien.`, delta: 0, actual: r1(actual) };
}

export function nutritionState(db, today) {
  const p = getProfile(db);
  const rows = db.all('SELECT * FROM body_metrics WHERE user_id = ? ORDER BY date, id', USER_ID);
  const lastW = [...rows].reverse().find((r) => r.weight_kg);
  const kg = lastW?.weight_kg ?? p.body_weight_kg ?? null;
  const lastWaist = [...rows].reverse().find((r) => r.waist_cm);
  const lastNeck = [...rows].reverse().find((r) => r.neck_cm);
  const lastHip = [...rows].reverse().find((r) => r.hip_cm);
  const lastBf = [...rows].reverse().find((r) => r.body_fat_pct);
  const navy = navyBodyFat({ sex: p.sex, height_cm: p.height_cm, waist_cm: lastWaist?.waist_cm, neck_cm: lastNeck?.neck_cm, hip_cm: lastHip?.hip_cm });
  const bf = lastBf?.body_fat_pct ?? navy;
  const years = age(p, today);
  const h = p.height_cm ? p.height_cm / 100 : null;
  const lbm = kg && bf != null ? kg * (1 - bf / 100) : null;
  const ffmi = lbm && h ? { value: r1(lbm / h ** 2), normalized: r1(lbm / h ** 2 + 6.1 * (1.8 - h)) } : null;
  const b = bmr({ sex: p.sex, kg, cm: p.height_cm, years, bf });
  const pal = Number(p.activity_pal) || 1.35;
  const ex = kg ? exerciseKcal(db, kg, today) : null;
  const tdee = b ? r0(b.value * pal + (ex?.per_day || 0)) : null;
  const trend = weightTrend(rows, today);
  const plan = db.one("SELECT * FROM nutrition_plans WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", USER_ID);
  let active = null;
  if (plan) {
    const t = targets(plan.type, { kg: plan.start_weight_kg, tdee: tdee || plan.start_tdee, bf, level: p.level, rate: plan.rate_pct });
    const week = Math.min(plan.weeks, Math.floor(diffDays(plan.start_date, today) / 7) + 1);
    const kcal = (plan.kcal_base || t.kcal) + (plan.kcal_adjust || 0);
    const carbs = Math.max(0, Math.round((kcal - t.protein_g * 4 - t.fat_g * 9) / 4));
    const end_weight = r1(plan.start_weight_kg * (1 + PLAN_TYPES[plan.type].rate.sign * plan.rate_pct / 100 * plan.weeks));
    const brk = plan.type === 'seche' && plan.weeks > 8 ? Math.ceil(plan.weeks / 2) : null;
    active = { ...plan, ...t, kcal, carbs_g: carbs, week, end_weight, end_date: addDays(plan.start_date, plan.weeks * 7 - 1), diet_break_week: brk,
      in_break: brk && week === brk, check: weeklyCheck(plan, trend), label: PLAN_TYPES[plan.type].label };
  }
  const missing = [!kg && 'poids', !p.height_cm && 'taille', !years && 'année de naissance', !p.sex && 'sexe'].filter(Boolean);
  return {
    profile: { sex: p.sex, height_cm: p.height_cm, birth_year: p.birth_year, age: years, level: p.level, activity_pal: pal },
    weight_kg: kg, body_fat: bf != null ? { value: r1(bf), source: lastBf?.body_fat_pct ? 'mesure' : 'Méthode US Navy (tour de taille et de cou)' } : null,
    lbm_kg: r1(lbm), bmi: bmiInfo(kg, p.height_cm), ffmi, bmr: b, exercise: ex, tdee, trend, plan: active, missing,
    lifestyle: LIFESTYLE, types: Object.fromEntries(Object.entries(PLAN_TYPES).map(([k, v]) => [k, { label: v.label, verb: v.verb, weeks: v.weeks, rate: v.rate, rules: v.rules,
      preview: kg && tdee ? targets(k, { kg, tdee, bf, level: p.level }) : null }])),
    tips: GENERAL_TIPS,
    history: db.all("SELECT id, type, start_date, weeks, status FROM nutrition_plans WHERE user_id = ? AND status <> 'active' ORDER BY id DESC LIMIT 10", USER_ID),
  };
}
