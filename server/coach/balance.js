// Équilibre musculaire : force (1RM estimé sur les charges réellement soulevées) et volume (séries) entre muscles opposés.
// Calcul déterministe. Les fourchettes sont des repères d'entraînement usuels, pas des normes médicales :
// elles servent à repérer un déséquilibre marqué, jamais à changer le programme sans ton accord.
import { USER_ID } from '../services.js';
import { MUSCLES } from '../seed.js';
import { e1rm, toLbs, r1 } from '../formulas.js';
import { addDays } from '../util.js';

// Paires comparées en force : même famille de mouvement de chaque côté, idéalement même matériel.
// ratio = côté B / côté A ; target = fourchette de repère.
const STRENGTH = [
  { id: 'cuisses', a: 'quadriceps', b: 'ischios', pa: ['knee_extension'], pb: ['knee_flexion'], target: [0.6, 0.9],
    hint: 'Leg curl ÷ leg extension : les ischios devraient peser 60 à 90 % des quadriceps (repère sur machine).' },
  { id: 'chaine', a: 'quadriceps', b: 'ischios', label: 'Chaîne avant / arrière', pa: ['squat', 'leg_press'], pb: ['hinge'], target: [0.9, 1.4], sameEquip: true,
    hint: 'Soulevé de terre roumain ÷ squat : la chaîne arrière (ischios, fessiers) porte en général autant ou un peu plus.' },
  { id: 'torse', a: 'pectoraux', b: 'dos_epaisseur', label: 'Pectoraux / dos', pa: ['press_horizontal'], pb: ['horizontal_row'], target: [0.9, 1.3],
    hint: 'Rowing ÷ développé couché : tirer devrait être au moins aussi fort que pousser, pour des épaules saines.' },
  { id: 'bras', a: 'biceps', b: 'triceps', pa: ['curl'], pb: ['triceps_pushdown', 'triceps_extension'], target: [1, 1.6],
    hint: 'Triceps ÷ biceps : le triceps est le plus gros muscle du bras, il soulève en général autant ou plus.' },
  { id: 'hanches', a: 'adducteurs', b: 'abducteurs', pa: ['hip_adduction'], pb: ['hip_abduction'], target: [0.8, 1.25],
    hint: 'Abduction ÷ adduction (machines) : un écart marqué fragilise le genou et l’aine.' },
];
// Paires comparées en volume (séries des 4 dernières semaines). ratio = B / A.
const VOLUME = [
  { a: 'quadriceps', b: 'ischios', target: [0.6, 1.25] },
  { a: 'pectoraux', b: ['dos_largeur', 'dos_epaisseur'], label_b: 'Dos', target: [1, 2] },
  { a: 'biceps', b: 'triceps', target: [0.8, 1.5] },
  { a: 'epaules_ant', b: 'epaules_post', target: [0.5, 1.5] },
  { a: 'abdominaux', b: 'lombaires', target: [0.5, 1.5] },
  { a: 'adducteurs', b: 'abducteurs', target: [0.6, 1.6] },
];

const FIX = { quadriceps: 'leg extension ou squat', ischios: 'leg curl ou soulevé de terre roumain', pectoraux: 'développé couché ou pompes', dos_epaisseur: 'rowing',
  dos_largeur: 'tirage vertical', biceps: 'curl', triceps: 'extension triceps', adducteurs: 'machine adducteurs', abducteurs: 'machine abducteurs',
  epaules_ant: 'développé militaire', epaules_post: 'face pull ou oiseau', abdominaux: 'gainage ou crunch', lombaires: 'extension lombaire', Dos: 'rowing ou tirage' };

const verdictOf = (ratio, [lo, hi]) => (ratio == null ? 'unknown' : ratio < lo ? 'low' : ratio > hi ? 'high' : 'ok');
const SHORT = { epaules_ant: 'Épaules avant', epaules_post: 'Épaules arrière', epaules_lat: 'Épaules côté', ischios: 'Ischios', abdominaux: 'Abdos', dos_epaisseur: 'Dos', dos_largeur: 'Grand dorsal', Dos: 'Dos' };
const short = (k) => (Array.isArray(k) ? 'Dos' : SHORT[k] || (MUSCLES[k] || k).replace(/ \(.*\)/, ''));
const fr = (x) => Number(x).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function muscleBalance(db, today, weeks = 8) {
  const from = addDays(today, -7 * weeks + 1);
  // Meilleur 1RM estimé de chaque exercice sur la période (séries validées, charges réelles, 1 à 15 répétitions)
  const rows = db.all(`SELECT e.id, e.name, e.pattern, e.equipment, e.kind, e.muscles, s.weight, s.weight_unit unit, s.reps, w.date
    FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ? AND s.weight > 0 AND s.reps BETWEEN 1 AND 15`, USER_ID, from, today);
  const best = new Map();
  for (const r of rows) {
    if (r.kind !== 'weighted') continue;
    const v = e1rm(toLbs(r.weight, r.unit), r.reps); if (!v) continue;
    const cur = best.get(r.id);
    if (!cur || v > cur.e1rm) best.set(r.id, { id: r.id, name: r.name, pattern: r.pattern, equipment: r.equipment || '', e1rm: v, date: r.date, weight: r.weight, unit: r.unit, reps: r.reps });
  }
  const list = [...best.values()];
  // Matériel : « Haltères / barre » compte pour les deux
  const eqSet = (s) => new Set([/barre|smith/i.test(s) && 'barre', /halt/i.test(s) && 'haltères', /poulie|câble/i.test(s) && 'poulie', /machine/i.test(s) && 'machine'].filter(Boolean));
  const sameEq = (x, y) => { const A = eqSet(x); return [...eqSet(y)].some((k) => A.has(k)); };
  const eqKey = (s) => [...eqSet(s)].join(' / ') || 'autre';

  const strength = STRENGTH.map((p) => {
    const A = list.filter((x) => p.pa.includes(x.pattern)).sort((x, y) => y.e1rm - x.e1rm);
    const B = list.filter((x) => p.pb.includes(x.pattern)).sort((x, y) => y.e1rm - x.e1rm);
    const base = { id: p.id, a: p.a, b: p.b, label: p.label || `${short(p.a)} / ${short(p.b)}`, target: p.target, hint: p.hint };
    if (!A.length || !B.length) {
      const miss = !A.length ? p.a : p.b;
      return { ...base, verdict: 'unknown', text: `Pas encore de charge enregistrée en ${!A.length ? 'côté ' + short(p.a).toLowerCase() : 'côté ' + short(p.b).toLowerCase()} sur ${weeks} semaines (${FIX[miss]}).` };
    }
    // Même matériel des deux côtés si possible : la comparaison est plus juste
    let a = A[0]; let b = B[0]; let same = sameEq(a.equipment, b.equipment);
    if (!same) for (const x of A) { const y = B.find((z) => sameEq(z.equipment, x.equipment)); if (y) { a = x; b = y; same = true; break; } }
    const ratio = Math.round((b.e1rm / a.e1rm) * 100) / 100;
    const verdict = verdictOf(ratio, p.target);
    const weak = verdict === 'low' ? p.b : verdict === 'high' ? p.a : null;
    const pct = (x) => `${Math.round(x * 100)} %`;
    const rel = `${short(p.b)} ÷ ${short(p.a).toLowerCase()} = ${pct(ratio)} (repère ${Math.round(p.target[0] * 100)} à ${pct(p.target[1])})`;
    const text = verdict === 'ok' ? `Équilibré. ${rel}.` : `${short(weak)} en retard. ${rel}. Priorise ${FIX[weak]} en début de séance, sans baisser l’autre côté.`;
    const side = (x) => ({ exercise: x.name, e1rm_lbs: Math.round(x.e1rm), best: `${r1(x.weight)} ${x.unit} × ${x.reps}`, date: x.date, equipment: eqKey(x.equipment) });
    return { ...base, ratio, verdict, weak, text, same_equipment: same, sides: { a: side(a), b: side(b) } };
  });

  // Volume : séries par muscle sur 4 semaines (principal = 1, secondaire = 0,5)
  const vfrom = addDays(today, -27);
  const sets = {};
  for (const r of db.all(`SELECT e.muscles FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
      WHERE w.user_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ?`, USER_ID, vfrom, today)) {
    let m = {}; try { m = JSON.parse(r.muscles || '{}'); } catch { /* */ }
    for (const [k, c] of Object.entries(m)) sets[k] = (sets[k] || 0) + (c >= 1 ? 1 : c >= 0.5 ? 0.5 : 0);
  }
  const sum = (k) => (Array.isArray(k) ? k.reduce((t, x) => t + (sets[x] || 0), 0) : sets[k] || 0);
  const volume = VOLUME.map((p) => {
    const a = sum(p.a); const b = sum(p.b);
    const ratio = a > 0 ? Math.round((b / a) * 100) / 100 : null;
    const verdict = a === 0 && b === 0 ? 'unknown' : a === 0 ? 'high' : verdictOf(ratio, p.target);
    const weak = verdict === 'low' ? (Array.isArray(p.b) ? 'Dos' : p.b) : verdict === 'high' ? p.a : null;
    const la = short(p.a); const lb = p.label_b || short(p.b);
    const text = verdict === 'unknown' ? 'Aucune série sur 4 semaines.'
      : verdict === 'ok' ? `Volume équilibré : ${fr(a / 4)} séries par semaine pour ${la.toLowerCase()}, ${fr(b / 4)} pour ${lb.toLowerCase()}.`
        : `${short(weak)} à renforcer : ${fr(a / 4)} séries par semaine pour ${la.toLowerCase()}, ${fr(b / 4)} pour ${lb.toLowerCase()}. Ajoute 2 séries de ${FIX[weak]} par semaine.`;
    return { a: p.a, b: Array.isArray(p.b) ? 'dos' : p.b, label: `${la} / ${lb}`, sets_a: r1(a / 4), sets_b: r1(b / 4), ratio, target: p.target, verdict, weak, text };
  });

  // Par muscle : ce qui le concerne, pour l'afficher quand on le touche sur la carte
  const byMuscle = {};
  const add = (k, x) => { (byMuscle[k] ||= []).push(x); };
  for (const s of strength) { add(s.a, { kind: 'force', ...s }); add(s.b, { kind: 'force', ...s }); }
  for (const v of volume) { add(v.a, { kind: 'volume', ...v }); for (const k of v.b === 'dos' ? ['dos_largeur', 'dos_epaisseur'] : [v.b]) add(k, { kind: 'volume', ...v }); }
  const issues = [...strength, ...volume].filter((x) => x.verdict === 'low' || x.verdict === 'high').length;
  return { weeks, strength, volume, by_muscle: byMuscle, issues,
    note: '1RM estimé d’après tes meilleures séries (formules Epley et Brzycki), comparé dans la même famille de mouvement. Les fourchettes sont des repères d’entraînement : elles signalent un écart marqué, rien ne change sans ton accord.' };
}
