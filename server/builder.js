// Créateur de programme : un objectif → un programme complet (muscu, cardio ou les deux), la cure et les objectifs qui vont avec.
// Règles tirées des méta-analyses récentes (références dans WHY). Rien n'est appliqué sans validation.
import { USER_ID, getProfile } from './services.js';
import { TEMPLATES } from './templates.js';
import { spreadSchedule, strategy } from './strategy.js';
import { replanFuture } from './planning.js';
import { bad, oneOf, num } from './util.js';

export const OBJECTIVES = {
  perte_de_gras: { label: 'Perdre du gras', type: 'mixte', mode: 'seche', style: 'hyper', cardio: { debutant: 120, intermediaire: 150, avance: 180 }, cardio_goal: 'perte_de_poids' },
  hypertrophie: { label: 'Prendre du muscle', type: 'muscu', mode: 'masse', style: 'hyper', cardio: { debutant: 60, intermediaire: 75, avance: 90 }, cardio_goal: 'sante_cardio' },
  force: { label: 'Gagner en force', type: 'muscu', mode: 'maintien', style: 'force', cardio: { debutant: 60, intermediaire: 60, avance: 75 }, cardio_goal: 'sante_cardio' },
  recomposition: { label: 'Recomposition', type: 'mixte', mode: 'recompo', style: 'hyper', cardio: { debutant: 100, intermediaire: 120, avance: 135 }, cardio_goal: 'perte_de_poids' },
  endurance: { label: 'Endurance / cardio', type: 'cardio', mode: 'maintien', style: 'sante', cardio: { debutant: 120, intermediaire: 180, avance: 240 }, cardio_goal: 'endurance' },
  sante: { label: 'Forme et santé', type: 'mixte', mode: 'maintien', style: 'sante', cardio: { debutant: 120, intermediaire: 150, avance: 150 }, cardio_goal: 'sante_cardio' },
};
export const TYPES = { muscu: 'Muscu', mixte: 'Muscu + cardio', cardio: 'Cardio' };
const ACT = { marche_inclinee: { speed_kmh: 5, incline_pct: 8 }, marche: { speed_kmh: 5.5, incline_pct: 0 }, course: { speed_kmh: 8.5, incline_pct: 1 }, velo: {}, elliptique: {}, rameur: {} };
const ACT_FR = { marche_inclinee: 'Marche inclinée', marche: 'Marche', course: 'Course', velo: 'Vélo', elliptique: 'Elliptique', rameur: 'Rameur' };

const WHY = {
  freq: 'Chaque muscle travaillé environ 2 fois par semaine : à volume égal, c’est au moins aussi efficace qu’une seule fois (Schoenfeld et al., 2016 et 2019).',
  volume: 'Environ 10 à 20 séries par muscle et par semaine : les gains augmentent avec le volume puis plafonnent (Schoenfeld et al., 2017 ; Pelland et al., 2024).',
  hyper: 'Séries de 6 à 15 répétitions arrêtées à 1 à 3 répétitions de l’échec : l’effort compte plus que la charge exacte (Schoenfeld et al., 2021 ; Refalo et al., 2023).',
  force: 'Exercices principaux lourds, 4 × 5 avec 3 min de repos : la force progresse surtout avec des charges lourdes (Lopez et al., 2021).',
  rest: 'Repos de 2 à 3 min sur les gros exercices, plus courts sur l’isolation (Schoenfeld et al., 2016 ; Singer et al., 2024).',
  seche: 'En sèche, on garde l’entraînement lourd pour protéger le muscle, avec une perte de 0,5 à 1 % du poids par semaine et 1,6 à 2,2 g de protéines par kg (Helms et al., 2014 ; Morton et al., 2018).',
  concurrent: 'Muscu et cardio se combinent bien : l’interférence reste faible avec un cardio modéré (marche, vélo), placé loin des séances jambes (Wilson et al., 2012 ; Schumann et al., 2022).',
  who: 'Repère santé : 150 à 300 min d’activité modérée par semaine et 2 séances de renforcement (OMS, 2020).',
  polar: 'Environ 80 % du cardio en endurance facile (tu peux parler) et 20 % plus intense : c’est ce qui fait le plus progresser (Seiler, 2010 ; Stöggl et Sperlich, 2014).',
  beginner: 'Débutant : full body, peu d’exercices, technique d’abord ; la progression est rapide au début (ACSM, 2009).',
};

const legDay = (name, focus) => /bas|legs|jambe|quadri/i.test(`${name} ${focus}`);
const round5 = (x) => Math.round(x / 5) * 5;

function strengthDays(n) {
  if (n <= 0) return [];
  if (n === 1) return [TEMPLATES.fullbody2.days[0]];
  if (n === 2) return TEMPLATES.fullbody2.days;
  if (n === 3) return TEMPLATES.fullbody3.days;
  if (n === 4) return TEMPLATES.upperlower4.days;
  if (n === 5) { const ul = TEMPLATES.upperlower4.days; const ppl = TEMPLATES.ppl3.days; return [ul[0], ul[1], ppl[0], ppl[1], ppl[2]]; }
  return TEMPLATES.ppl6.days;
}

// Amélioration d'un programme enregistré : on garde tes exercices et tes charges, on ajuste séries / reps / repos à l'objectif,
// on augmente d'abord les séries de tes exercices sur les muscles en manque, puis on ajoute un exercice seulement si besoin.
const COMPOUND = new Set(['squat', 'hinge', 'press_horizontal', 'press_vertical', 'press_incline', 'vertical_pull', 'horizontal_row', 'leg_press', 'lunge', 'hip_extension', 'dip']);
const KEY = { pectoraux: ['dev_couche', 10], dos_largeur: ['tirage_vertical', 10], dos_epaisseur: ['row', 8], quadriceps: ['leg_press', 10], ischios: ['leg_curl_couche', 8], fessiers: ['hip_thrust', 8],
  epaules_lat: ['elev_laterales', 6], epaules_post: ['face_pull', 6], biceps: ['curl_classique', 6], triceps: ['ext_triceps_corde', 6], mollets: ['mollets_machine', 6], abdominaux: ['planche', 4] };
const LOWER = new Set(['quadriceps', 'ischios', 'fessiers', 'mollets', 'adducteurs', 'abducteurs']);
const MLABEL = { pectoraux: 'pectoraux', dos_largeur: 'grand dorsal', dos_epaisseur: 'milieu du dos', quadriceps: 'quadriceps', ischios: 'ischios', fessiers: 'fessiers', epaules_lat: 'deltoïdes latéraux', epaules_post: 'deltoïdes arrière', biceps: 'biceps', triceps: 'triceps', mollets: 'mollets', abdominaux: 'abdos' };
function improveDays(db, baseId, style, level) {
  const prog = db.one('SELECT * FROM programs WHERE id = ? AND user_id = ?', baseId, USER_ID); if (!prog) throw bad('Programme introuvable');
  const changes = [];
  const days = db.all('SELECT * FROM program_days WHERE program_id = ? AND archived = 0 ORDER BY position', baseId).map((d) => ({
    name: d.name, focus: d.focus,
    cardio: db.all('SELECT activity, custom_name, duration_min, speed_kmh, incline_pct, placement, notes FROM program_cardio WHERE day_id = ?', d.id),
    items: db.all(`SELECT pe.*, e.slug, e.name ex_name, e.pattern, e.muscles FROM program_exercises pe JOIN exercises e ON e.id = pe.exercise_id WHERE pe.day_id = ? ORDER BY pe.position`, d.id).map((e) => ({
      exercise_id: e.exercise_id, slug: e.slug, name: e.ex_name, pattern: e.pattern, muscles: JSON.parse(e.muscles || '{}'), sets: e.sets, reps: e.reps, rest: e.rest_seconds,
      keep: { reps_note: e.reps_note, target_weight: e.target_weight, target_weight_max: e.target_weight_max, weight_unit: e.weight_unit, weight_note: e.weight_note, superset_group: e.superset_group, notes: e.notes } })),
  }));
  // 1. Séries / reps / repos selon l'objectif
  for (const d of days) {
    let heavy = 0;
    for (const e of d.items) {
      const before = `${e.sets}×${e.reps ?? '?'}`; const comp = COMPOUND.has(e.pattern);
      if (style === 'force' && comp && heavy < 2 && e.reps != null) { heavy++; e.sets = level === 'debutant' ? 3 : 4; e.reps = 5; e.rest = 180; }
      else if (style === 'sante') { e.sets = Math.min(e.sets, 3); if (e.reps != null && e.reps < 10) e.reps = 12; e.rest = 60; }
      else { if (e.reps != null && e.reps < 6 && style !== 'force') e.reps = 6; if (e.reps != null && e.reps > 20 && !/core/.test(e.pattern || '')) e.reps = 15; e.rest = e.rest || (comp ? 120 : 75); }
      if (`${e.sets}×${e.reps ?? '?'}` !== before) changes.push(`${e.name} (${d.name}) : ${before} → ${e.sets}×${e.reps}`);
    }
  }
  // 2. Volume par muscle et par semaine
  const vol = () => { const v = {}; days.forEach((d) => d.items.forEach((e) => Object.entries(e.muscles).forEach(([m, c]) => { v[m] = (v[m] || 0) + e.sets * c; }))); return v; };
  const factor = style === 'sante' ? 0.6 : 1;
  for (const [m, [fill, min0]] of Object.entries(KEY)) {
    const min = Math.round(min0 * factor); let v = vol()[m] || 0;
    if (v >= min - 1) continue;
    const label = MLABEL[m];
    // a) plus de séries sur tes exercices qui travaillent déjà ce muscle (max 4 séries par exercice)
    const mine = days.flatMap((d) => d.items.filter((e) => (e.muscles[m] || 0) >= 0.75).map((e) => ({ d, e })));
    for (const { d, e } of mine) { while (v < min - 1 && e.sets < 4) { e.sets++; v += e.muscles[m]; e.bumped = true; } if (e.bumped) { changes.push(`${e.name} (${d.name}) : ${e.sets} séries (${label})`); delete e.bumped; } }
    // b) sinon, on ajoute un exercice dans le jour le plus adapté
    if (v < min - 2) {
      const ex = db.one('SELECT id, slug, name, pattern, muscles FROM exercises WHERE slug = ?', fill); if (!ex) continue;
      const lower = LOWER.has(m);
      const score = (d) => d.items.reduce((a, e) => a + Object.keys(e.muscles).filter((k) => LOWER.has(k) === lower).length, 0) * 10 - d.items.length;
      const host = [...days].filter((d) => d.items.length).sort((a, b) => score(b) - score(a))[0]; if (!host) continue;
      const core = /core/.test(ex.pattern || '');
      const sets = Math.min(core ? 3 : 4, Math.max(2, Math.ceil(min - v)));
      host.items.push({ exercise_id: ex.id, slug: ex.slug, name: ex.name, pattern: ex.pattern, muscles: JSON.parse(ex.muscles || '{}'), sets, reps: core ? 30 : style === 'force' ? 8 : 12, rest: core ? 45 : 75, keep: {}, added: true });
      changes.push(`Ajouté : ${ex.name} dans ${host.name} (${sets} séries) : ${label} à seulement ${String(Math.round(v * 10) / 10).replace('.', ',')} séries par semaine`);
    }
  }
  const v = vol(); const high = Object.keys(KEY).filter((m) => (v[m] || 0) > 22);
  if (high.length) changes.push(`Volume très élevé sur ${high.map((m) => MLABEL[m]).join(', ')} (plus de 22 séries par semaine) : garde-le seulement si tu récupères bien.`);
  return { name: prog.name, days, changes };
}

// Séries / reps / repos selon l'objectif, le niveau et le temps disponible
function shape(items, style, level, minutes) {
  const keep = minutes <= 45 ? 4 : minutes <= 60 ? 5 : 7;
  return items.slice(0, keep).map(([slug, sets, reps, rest], j) => {
    if (style === 'force') return j < 2 ? [slug, level === 'debutant' ? 3 : 4, 5, 180] : [slug, 3, 8, 90];
    if (style === 'sante') return [slug, 2, slug === 'planche' ? 30 : 12, 60];
    return [slug, level === 'debutant' ? Math.min(3, sets) : level === 'avance' && j < 2 ? sets + 1 : sets, reps, rest];
  });
}

function cardioBlock(activity, minutes, extra = {}) {
  return { activity, duration_min: minutes, ...ACT[activity], placement: 'fin', ...extra };
}

export function buildPlan(db, today, input = {}) {
  const p = getProfile(db);
  const objective = oneOf(input.objective || p.goal || 'hypertrophie', 'objectif', Object.keys(OBJECTIVES), { required: true });
  const O = OBJECTIVES[objective];
  const type0 = oneOf(input.type || O.type, 'type', Object.keys(TYPES), { required: true });
  const level = oneOf(input.level || p.level || 'intermediaire', 'niveau', ['debutant', 'intermediaire', 'avance'], { required: true });
  const n0 = num(input.days, 'jours', { int: true, min: 1, max: 7 }) ?? Math.min(6, Math.max(2, p.sessions_per_week || 3));
  const minutes = num(input.minutes, 'durée', { int: true, min: 30, max: 120 }) ?? p.session_minutes ?? 60;
  const prefs = (() => { try { return JSON.parse(p.cardio_preferred || '[]'); } catch { return []; } })();
  const activity = ACT[input.activity] ? input.activity : prefs.find((a) => ACT[a]) || 'marche_inclinee';
  const targetKg = num(input.target_kg, 'poids visé', { min: 30, max: 250 });
  const baseId = num(input.base_id, 'programme de départ', { int: true });
  const improved = baseId ? improveDays(db, baseId, O.style, level) : null;
  const type = improved && type0 === 'cardio' ? 'mixte' : type0;

  // 1. Répartition muscu / cardio
  const n = improved ? improved.days.length : n0;
  const S = improved ? n : type === 'cardio' ? 0 : type === 'muscu' ? n : n <= 3 ? n : n === 6 ? 4 : n - 1;
  const C = n - S;
  const W = type === 'muscu' ? 0 : O.cardio[level];
  const why = [];
  const days = improved ? improved.days : strengthDays(S).map(([name, focus, items]) => ({ name, focus, items: shape(items, O.style, level, minutes).map(([slug, sets, reps, rest]) => ({ slug, sets, reps, rest })), cardio: [] }));

  // 2. Cardio : séances dédiées puis fin de séance des jours haut du corps / full body
  const base = { debutant: 25, intermediaire: 35, avance: 45 }[level];
  const cardioDays = [];
  for (let i = 0; i < C; i++) {
    const hard = type === 'cardio' && level !== 'debutant' && n >= 3 && i === 1;
    const long = type === 'cardio' && n >= 3 && i === C - 1 && !hard;
    const act = hard ? (['velo', 'rameur', 'course'].includes(activity) ? activity : 'velo') : activity;
    const dur = long ? round5(base * 1.5) : type === 'cardio' ? base : Math.max(30, Math.min(45, round5(W / Math.max(1, C + 1))));
    cardioDays.push({
      name: hard ? 'Cardio intervalles' : long ? 'Cardio long' : 'Cardio zone 2', focus: hard ? '20 % intense' : 'Endurance facile, tu peux parler', items: [],
      cardio: [cardioBlock(act, dur, { notes: hard ? '10 min facile, puis 6 × 1 min soutenu / 2 min facile, 5 min de retour au calme' : 'Zone 2 : respiration plus rapide mais tu peux tenir une conversation' })],
    });
  }
  if (W && S && !(improved && days.some((d) => d.cardio.length))) {
    const left = W - cardioDays.reduce((a, d) => a + d.cardio[0].duration_min, 0);
    const host = days.filter((d) => !legDay(d.name, d.focus));
    if (left > 0 && host.length) {
      const per = Math.max(10, Math.min(30, round5(left / host.length)));
      host.forEach((d) => d.cardio.push(cardioBlock(activity === 'course' ? 'marche_inclinee' : activity, per, { notes: 'Après la muscu, intensité modérée' })));
    }
  }
  // Ordre : jours de cardio intercalés entre les séances de muscu
  const all = [...days];
  cardioDays.forEach((d, i) => all.splice(Math.min(all.length, Math.round(((i + 1) * all.length) / (C + 1)) + i), 0, d));
  const codes = all.map((_, i) => `D${i + 1}`);
  const schedule = spreadSchedule(Math.min(7, all.length), codes, p.available_days);
  const cardioWeek = all.reduce((a, d) => a + d.cardio.reduce((b, c) => b + c.duration_min, 0), 0);

  // 3. Pourquoi
  if (improved) why.push(`Basé sur « ${improved.name} » : tes exercices et tes charges sont gardés.`, ...(improved.changes.length ? improved.changes : ['Ton programme respecte déjà les repères de volume pour cet objectif : seules les séries / reps ont été vérifiées.']));
  if (S) {
    if (level === 'debutant' && S <= 3) why.push(WHY.beginner);
    why.push(WHY.freq, WHY.volume, O.style === 'force' ? WHY.force : WHY.hyper, WHY.rest);
  }
  if (O.mode === 'seche') why.push(WHY.seche);
  if (S && cardioWeek) why.push(WHY.concurrent);
  if (cardioWeek) why.push(type === 'cardio' ? WHY.polar : WHY.who);
  if (type === 'cardio') why.push('Sans muscu, ajoute si possible 2 courtes séances de renforcement par semaine (OMS, 2020) : choisis « Muscu + cardio » pour les intégrer.');
  if (type === 'muscu' && O.cardio[level]) why.push(`${WHY.who} Tu peux choisir « Muscu + cardio » pour l’intégrer au programme.`);

  // 4. Calories (cure) avec les mêmes calculs que la cure
  const st = strategy(db, today, { mode: O.mode, target_kg: targetKg ?? undefined });
  const cure = st.ready ? { ready: true, mode: st.mode, label: st.label, weeks: st.weeks, kcal: st.nutrition.kcal, protein_g: st.nutrition.protein_g, delta: st.nutrition.delta, end_kg: st.end_kg, current: st.current_plan?.label || null }
    : { ready: false, missing: st.missing };

  const goals = [`${n} séance${n > 1 ? 's' : ''} par semaine`];
  if (cardioWeek) goals.push(`${cardioWeek} min de cardio par semaine`);
  if (cure.ready && cure.mode !== 'maintien' && cure.mode !== 'recompo' && cure.end_kg) goals.push(`Poids : ${String(cure.end_kg).replace('.', ',')} kg en fin de cure`);

  const exName = (slug) => db.one('SELECT name FROM exercises WHERE slug = ?', slug)?.name || slug;
  return {
    base: improved ? { id: baseId, name: improved.name, changes: improved.changes.length } : null,
    objective, objective_label: O.label, type, type_label: TYPES[type], level, days_per_week: n, minutes, activity,
    sessions: { muscu: S, cardio: C }, cardio_week: cardioWeek, schedule,
    days: all.map((d, i) => ({ code: codes[i], name: d.name, focus: d.focus,
      exercises: d.items.map((e) => ({ slug: e.slug, exercise_id: e.exercise_id || null, name: e.name || exName(e.slug), sets: e.sets, reps: e.reps, rest: e.rest, keep: e.keep || null, added: !!e.added })),
      cardio: d.cardio.map((c) => ({ ...c, label: c.custom_name || ACT_FR[c.activity] || c.activity })) })),
    why, cure, goals,
  };
}

// Crée le programme (l'ancien reste enregistré), met à jour profil, semaine type, calendrier, objectifs et éventuellement la cure
export function applyPlan(db, today, input, { startPlan }) {
  const plan = input.custom ? null : buildPlan(db, today, input);
  const opts = { cure: input.cure !== false, goals: input.goals !== false };
  return db.tx(() => {
    db.run('UPDATE programs SET active = 0 WHERE user_id = ?', USER_ID);
    let pid; let codes = []; let n; let cardioWeek = 0;
    if (!plan) {
      n = num(input.days, 'jours', { int: true, min: 1, max: 7 }) || 3;
      const name = String(input.name || 'Mon programme').slice(0, 60);
      pid = Number(db.run('INSERT INTO programs (user_id, name, active) VALUES (?,?,1)', USER_ID, name).lastInsertRowid);
      for (let i = 0; i < n; i++) { codes.push(`D${i + 1}`); db.run('INSERT INTO program_days (program_id, code, position, name, focus) VALUES (?,?,?,?,?)', pid, `D${i + 1}`, i + 1, `Jour ${i + 1}`, 'À composer'); }
    } else {
      n = plan.days.length; cardioWeek = plan.cardio_week;
      const pname = String(input.name || '').trim().slice(0, 60) || (plan.base ? `${plan.base.name} (amélioré)` : `${plan.objective_label} · ${plan.type_label} · ${n} j`);
      pid = Number(db.run('INSERT INTO programs (user_id, name, active) VALUES (?,?,1)', USER_ID, pname).lastInsertRowid);
      plan.days.forEach((d, i) => {
        codes.push(d.code);
        const did = Number(db.run('INSERT INTO program_days (program_id, code, position, name, focus) VALUES (?,?,?,?,?)', pid, d.code, i + 1, d.name, d.focus).lastInsertRowid);
        d.exercises.forEach((e, j) => {
          const ex = e.exercise_id ? db.one('SELECT id, default_unit FROM exercises WHERE id = ?', e.exercise_id) : db.one('SELECT id, default_unit FROM exercises WHERE slug = ?', e.slug); if (!ex) return;
          const k = e.keep || {};
          db.run(`INSERT INTO program_exercises (day_id, exercise_id, position, sets, reps, reps_note, target_weight, target_weight_max, weight_unit, weight_note, rest_seconds, superset_group, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            did, ex.id, j + 1, e.sets, e.reps, k.reps_note ?? null, k.target_weight ?? null, k.target_weight_max ?? null, k.weight_unit || ex.default_unit, k.weight_note ?? null, e.rest, k.superset_group ?? null, k.notes ?? null);
        });
        d.cardio.forEach((c) => db.run('INSERT INTO program_cardio (day_id, activity, custom_name, duration_min, speed_kmh, incline_pct, placement, notes) VALUES (?,?,?,?,?,?,?,?)', did, c.activity, c.custom_name ?? null, c.duration_min, c.speed_kmh ?? null, c.incline_pct ?? null, c.placement, c.notes || null));
      });
      const cardioSessions = plan.days.filter((d) => d.cardio.length).length;
      db.run(`UPDATE profiles SET goal = ?, level = ?, session_minutes = ?, cardio_goal = ?, cardio_sessions_target = ?, cardio_minutes_target = ?, body_target = ? WHERE user_id = ?`,
        plan.objective, plan.level, plan.minutes, OBJECTIVES[plan.objective].cardio_goal, cardioSessions || null, cardioSessions ? Math.round(cardioWeek / cardioSessions) : null,
        JSON.stringify({ mode: plan.cure.mode || OBJECTIVES[plan.objective].mode, target_kg: input.target_kg ?? null }), USER_ID);
    }
    const p = getProfile(db);
    const schedule = spreadSchedule(Math.min(7, n), codes, p.available_days);
    db.run('UPDATE profiles SET schedule = ?, sessions_per_week = ? WHERE user_id = ?', JSON.stringify(schedule), n, USER_ID);
    replanFuture(db, today);
    const done = ['programme'];
    if (opts.goals) {
      const upsert = (type, value, title, unit) => {
        const g = db.one("SELECT id FROM goals WHERE user_id = ? AND type = ? AND status = 'actif' ORDER BY id DESC LIMIT 1", USER_ID, type);
        if (g) db.run('UPDATE goals SET target_value = ?, title = ? WHERE id = ?', value, title, g.id);
        else db.run("INSERT INTO goals (user_id, type, title, target_value, unit, status) VALUES (?,?,?,?,?, 'actif')", USER_ID, type, title, value, unit);
      };
      upsert('seances_semaine', n, `${n} séances par semaine`, 'séances');
      if (cardioWeek) upsert('cardio_minutes_semaine', cardioWeek, `${cardioWeek} min de cardio par semaine`, 'min');
      done.push('objectifs');
    }
    if (plan && opts.cure && plan.cure.ready) {
      const cur = db.one("SELECT type FROM nutrition_plans WHERE user_id = ? AND status = 'active'", USER_ID);
      if (plan.cure.mode !== 'maintien' && cur?.type !== plan.cure.mode) { startPlan({ type: plan.cure.mode, weeks: plan.cure.weeks }); done.push('cure'); }
    }
    return { program_id: pid, applied: done };
  });
}

export function assertObjective(v) { if (!OBJECTIVES[v]) throw bad('Objectif inconnu'); }
