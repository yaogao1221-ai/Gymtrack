// Progrès détaillés, carte du corps, trophées et journal alimentaire
import { Router } from 'express';
import { USER_ID, getProfile, allRecords, activeProgram, getProgram, nextSession, periodStats } from '../services.js';
import { toJSON } from '../schema.js';
import { MUSCLES } from '../seed.js';
import { muscleBalance } from '../coach/balance.js';
import { RANGES, PAIN_AREAS, analyse, recoveryScore } from '../analysis.js';
import { e1rm, toLbs, r1 } from '../formulas.js';
import { nutritionState } from '../nutrition.js';
import { num, str, oneOf, date, bad, notFound, addDays, weekStart, diffDays, dayKey } from '../util.js';

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

// Charge par muscle et par jour : séries de muscu + cardio (marche inclinée, course… sollicitent mollets et jambes)
const CARDIO_LOAD = { marche_inclinee: { mollets: 0.15, fessiers: 0.08, ischios: 0.05 }, course: { mollets: 0.15, quadriceps: 0.1, ischios: 0.05 }, marche: { mollets: 0.05 },
  velo: { quadriceps: 0.12, fessiers: 0.04 }, elliptique: { quadriceps: 0.06, fessiers: 0.05, mollets: 0.04 }, rameur: { dos_largeur: 0.08, quadriceps: 0.06, dos_epaisseur: 0.05 } };
export function dailyLoads(db, from, to) {
  const out = {}; const add = (d, m, v) => { (out[d] ||= {})[m] = (out[d][m] || 0) + v; };
  for (const r of db.all(`SELECT w.date, e.muscles, COUNT(*) n FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ? GROUP BY w.date, e.id`, USER_ID, from, to)) for (const [m, c] of Object.entries(toJSON(r.muscles, {}))) add(r.date, m, r.n * c);
  // Cardio : ≈ 1 série équivalente par 7 à 10 min sur le muscle principal, plafonné à 4 (marche inclinée 30 min ≈ 3-4 séries de mollets)
  for (const c of db.all('SELECT date, activity, duration_min, incline_pct FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, from, to)) {
    const k = CARDIO_LOAD[c.activity]; if (!k) continue;
    const boost = c.activity === 'marche' && c.incline_pct >= 5 ? CARDIO_LOAD.marche_inclinee : k;
    for (const [m, per] of Object.entries(boost)) add(c.date, m, Math.min(4, per * (c.duration_min || 0)));
  }
  return out;
}
// Muscles à ne pas oublier : exercice proposé et priorité (1 = muscle majeur, 2 = secondaire)
const GAP_FILL = { pectoraux: ['dev_couche', 1], dos_largeur: ['tirage_vertical', 1], dos_epaisseur: ['row', 1], quadriceps: ['leg_press', 1], ischios: ['leg_curl_couche', 1], fessiers: ['hip_thrust', 1],
  epaules_lat: ['elev_laterales', 1], epaules_post: ['face_pull', 1], biceps: ['curl_classique', 1], triceps: ['ext_triceps_corde', 1], mollets: ['mollets_machine', 1], abdominaux: ['planche', 1],
  lombaires: ['hyperextension', 2], trapezes: ['shrugs', 2], avant_bras: ['curl_marteau', 2], adducteurs: ['adduct_abduct', 2], abducteurs: ['abduction', 2] };
const LOWER_M = new Set(['quadriceps', 'ischios', 'fessiers', 'mollets', 'adducteurs', 'abducteurs', 'lombaires']);
const BIG = new Set(['quadriceps', 'ischios', 'fessiers', 'adducteurs', 'pectoraux', 'dos_largeur', 'lombaires']);

export function bodyStatus(db, today) {
    const { sets, last } = muscleSets(db, addDays(today, -6), today);
    const older = muscleSets(db, addDays(today, -13), today).last;
    const level = getProfile(db).level || 'intermediaire'; const [minS, optLow, optHigh] = RANGES[level] || RANGES.intermediaire;
    const loads = dailyLoads(db, addDays(today, -6), today);
    const sore = db.all('SELECT muscle, MAX(date) date FROM muscle_soreness WHERE user_id = ? AND date >= ? GROUP BY muscle', USER_ID, addDays(today, -3));
    const muscles = Object.fromEntries(Object.entries(MUSCLES).map(([k, label]) => {
      const s = r1(sets[k] || 0);
      // Dernier jour où le muscle a vraiment travaillé (≥ 1,5 série, cardio compris) et charge de ce jour-là
      const lastLoad = Object.keys(loads).filter((d) => loads[d][k] >= 1.5).sort().at(-1) || null;
      const l = [last[k], lastLoad, older[k]].filter(Boolean).sort().at(-1) || null; const days = l ? diffDays(l, today) : null;
      const dose = lastLoad ? loads[lastLoad][k] : 0; const dDose = lastLoad ? diffDays(lastLoad, today) : 99;
      // Récupération : 48 h pour les petits muscles, 72 h pour les gros, plus quand la séance était chargée (courbatures maximales à 24-72 h : Cheung et al., 2003)
      const need = (BIG.has(k) ? 3 : 2) + (dose >= 6 ? 1 : 0);
      let status = days == null || days > 9 ? 'oublie' : dDose <= 1 && dose >= 2 ? 'fatigue' : dDose < need ? 'recup' : 'pret';
      const so = sore.find((x) => x.muscle === k); const soreDays = so ? diffDays(so.date, today) : null;
      if (so && soreDays <= 1) status = 'fatigue'; else if (so && soreDays <= 2 && status !== 'fatigue') status = 'recup';
      return [k, { label, sets: s, last: l, days, status, sore: so ? so.date : null, zone: s < minS / 2 ? 'bas' : s < optLow ? 'correct' : s <= optHigh ? 'optimal' : 'haut' }];
    }));
    return { muscles, range: { min: minS, low: optLow, high: optHigh } };
}

export function programGaps(db, today) {
    const prog = activeProgram(db); if (!prog) return ({ gaps: [], low: [] });
    const items = db.all(`SELECT pe.id pe_id, pe.exercise_id, pd.id day_id, pd.name day_name, pe.sets, e.name, e.muscles FROM program_exercises pe JOIN program_days pd ON pd.id = pe.day_id JOIN exercises e ON e.id = pe.exercise_id
      WHERE pd.program_id = ? AND pd.archived = 0`, prog.id).map((x) => ({ ...x, muscles: toJSON(x.muscles, {}) }));
    if (!items.length) return ({ gaps: [], low: [], empty: true });
    const planned = {}; for (const x of items) for (const [m, c] of Object.entries(x.muscles)) planned[m] = (planned[m] || 0) + c * (x.sets || 0);
    // Travail direct = exercices où le muscle est principal (coefficient 1). Un RDL ne remplace pas un exercice de lombaires.
    const direct = {}; const via = {};
    for (const x of items) for (const [m, c] of Object.entries(x.muscles)) { if (c >= 1) direct[m] = (direct[m] || 0) + (x.sets || 0); else (via[m] ||= new Set()).add(x.name); }
    const from = addDays(today, -27);
    const done = {}; for (const day of Object.values(dailyLoads(db, from, today))) for (const [m, v] of Object.entries(day)) done[m] = (done[m] || 0) + v;
    const doneDirect = {};
    for (const r of db.all(`SELECT e.muscles, COUNT(*) n FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
      WHERE w.user_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ? GROUP BY e.id`, USER_ID, from, today)) for (const [m, c] of Object.entries(toJSON(r.muscles, {}))) if (c >= 1) doneDirect[m] = (doneDirect[m] || 0) + r.n;
    // Le cardio compte comme travail direct (marche inclinée → mollets)
    for (const c of db.all('SELECT activity, duration_min, incline_pct FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, from, today)) {
      const k = c.activity === 'marche' && c.incline_pct >= 5 ? CARDIO_LOAD.marche_inclinee : CARDIO_LOAD[c.activity]; if (!k) continue;
      for (const [m, per] of Object.entries(k)) doneDirect[m] = (doneDirect[m] || 0) + Math.min(4, per * (c.duration_min || 0));
    }
    const days = db.all('SELECT id, name FROM program_days WHERE program_id = ? AND archived = 0 ORDER BY position', prog.id);
    const lib = db.all('SELECT id, slug, name, pattern, muscles, lib_id FROM exercises').map((e) => ({ ...e, muscles: toJSON(e.muscles, {}) }));
    const gaps = []; const low = [];
    for (const [m, [slug, prio]] of Object.entries(GAP_FILL)) {
      const pl = planned[m] || 0; const dn = done[m] || 0;
      const forgotten = (direct[m] || 0) < 1 && (doneDirect[m] || 0) < 1;
      // Peu travaillé : muscle majeur prévu à moins de 4 séries par semaine et moins de 4 séries par semaine faites en moyenne
      const weak = !forgotten && prio === 1 && pl < 4 && dn / 4 < 4;
      if (!forgotten && !weak) continue;
      // Le muscle a déjà un exercice dans le programme : on propose des séries en plus, jamais un doublon
      const own = items.filter((x) => (x.muscles[m] || 0) >= 1).sort((a, b) => a.sets - b.sets)[0];
      if (own && own.sets < 4) {
        const need = Math.max(1, Math.min(4 - own.sets, Math.ceil((prio === 1 ? 6 : 3) - pl)));
        (forgotten ? gaps : low).push({ forgotten, muscle: m, label: MUSCLES[m], prio, planned: r1(pl), done: r1(dn), indirect: [],
          bump: { pe_id: own.pe_id, name: own.name, day: { id: own.day_id, name: own.day_name }, from: own.sets, to: own.sets + need } });
        continue;
      }
      if (own) continue;
      const inProg = new Set(items.map((x) => x.exercise_id));
      const cands = [lib.find((e) => e.slug === slug), ...lib.filter((e) => (e.muscles[m] || 0) >= 1)].filter((e) => e && !inProg.has(e.id));
      const main = cands[0]; if (!main) continue;
      const alts = [...new Map(cands.slice(1).map((e) => [e.id, e])).values()].filter((e) => e.id !== main.id).slice(0, 3);
      // Jour conseillé : celui qui travaille déjà la même zone (haut / bas du corps), sinon le moins chargé
      const lower = LOWER_M.has(m);
      const score = (d) => { const its = items.filter((x) => x.day_id === d.id); return its.reduce((a, x) => a + Object.keys(x.muscles).filter((k) => LOWER_M.has(k) === lower).length, 0) * 10 - its.length; };
      const host = [...days].sort((a, b) => score(b) - score(a))[0];
      const core = /core|plank/.test(main.pattern || '');
      (forgotten ? gaps : low).push({ forgotten, muscle: m, label: MUSCLES[m], prio, indirect: [...(via[m] || [])].slice(0, 2), done: r1(dn), done_week: r1(dn / 4), planned: r1(pl),
        exercise: { id: main.id, name: main.name, lib_id: main.lib_id }, alternatives: alts.map((e) => ({ id: e.id, name: e.name, lib_id: e.lib_id })),
        day: host ? { id: host.id, name: host.name } : null, sets: prio === 1 ? 3 : 2, reps: core ? 30 : 12, rest_seconds: core ? 45 : 75 });
    }
    gaps.sort((a, b) => a.prio - b.prio); low.sort((a, b) => a.planned - b.planned);
    return { gaps, low: low.slice(0, 3) };
}



// Coach commun : une consigne par espace (Corps, Progrès, Nutrition, Soins, Programme), chacune tient compte des autres
const PHASES = ['calmer', 'recharger', 'reprendre'];
const phaseOf = (days) => (days <= 7 ? 0 : days <= 42 ? 1 : 2);
const fmtD = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export function coachBrief(db, today) {
  const profile = getProfile(db);
  const prog = getProgram(db, { withLast: false });
  const allEx = prog.days.flatMap((d) => d.exercises.map((e) => ({ ...e, day_name: d.name, day_id: d.id })));
  const next = nextSession(db, today); const nextDay = next ? prog.days.find((d) => d.id === next.program_day_id) : null;
  const nextLbl = next ? `${next.name}${next.focus ? ` (${next.focus})` : ''}${next.date === today ? ' aujourd’hui' : next.date ? ` le ${fmtD(next.date)}` : ''}` : null;
  const st = bodyStatus(db, today).muscles;
  // Douleurs suivies
  const pains = db.all('SELECT * FROM pain_reports WHERE user_id = ? AND resolved = 0 ORDER BY intensity DESC, date DESC', USER_ID).map((p) => {
    const area = PAIN_AREAS[p.area] || { label: p.area, patterns: [] };
    const log = (() => { try { return JSON.parse(p.log || '[]'); } catch { return []; } })();
    const first = log[0]?.intensity ?? p.intensity; const days = diffDays(p.date, today) + 1;
    const affected = allEx.filter((e) => area.patterns.includes(e.pattern));
    return { id: p.id, area: p.area, label: area.label, intensity: p.intensity, first, days, phase: phaseOf(days), phase_label: PHASES[phaseOf(days)],
      checked_today: log.some((x) => x.date === today), trend: log.length > 1 ? Math.sign(p.intensity - first) : 0,
      affected: [...new Set(affected.map((e) => e.name))], next_affected: nextDay ? [...new Set(nextDay.exercises.filter((e) => area.patterns.includes(e.pattern)).map((e) => e.name))] : [] };
  });
  const painLine = (p) => `${p.label} ${p.intensity}/10, jour ${p.days}${p.trend < 0 ? ` (en baisse depuis ${p.first}/10)` : p.trend > 0 ? ` (en hausse depuis ${p.first}/10)` : ''}`;
  // Muscles
  const nextMus = nextDay ? [...new Set(nextDay.exercises.flatMap((e) => Object.entries(e.muscles || {}).filter(([, c]) => c >= 1).map(([k]) => k)))] : [];
  const tiredNext = nextMus.filter((k) => st[k]?.status === 'fatigue').map((k) => MUSCLES[k]);
  const tired = Object.entries(st).filter(([, m]) => m.status === 'fatigue' || m.status === 'recup');
  const gaps = (() => { try { return programGaps(db, today); } catch { return { gaps: [], low: [] }; } })();
  let ana = null; try { ana = analyse(db, today); } catch { /* historique insuffisant */ }
  const increases = (ana?.progression || []).filter((p) => p.type === 'increase');
  const out = {};

  // SOINS
  if (pains.length) {
    const p = pains[0];
    const lines = [{ icon: 'heal', text: `Aujourd’hui : phase « ${p.phase_label} ». ${p.phase === 0 ? 'Isométriques sans douleur, 5 min, 1 à 2 fois.' : p.phase === 1 ? 'Renforcement lent 3 × 12-15, douleur ≤ 3/10.' : 'Reprise progressive : 50 % de ta charge, +10 % par semaine.'}` }];
    if (p.next_affected.length) lines.push({ icon: 'dumbbell', tone: 'warn', text: `Dans ta prochaine séance${nextLbl ? ` ${nextLbl}` : ''} : ${p.next_affected.join(', ')} à adapter. Aucune hausse de charge n’y sera proposée.` });
    else if (p.affected.length) lines.push({ icon: 'dumbbell', text: `Exercices de ton programme concernés : ${p.affected.slice(0, 4).join(', ')}.` });
    if (!p.checked_today) lines.push({ icon: 'chat', text: 'Dis-moi comment ça va aujourd’hui pour suivre l’évolution.' });
    if (p.days > 21 && p.trend >= 0) lines.push({ icon: 'alert', tone: 'warn', text: 'Plus de 3 semaines sans amélioration : un avis de kiné ou de médecin est conseillé.' });
    out.care = { headline: pains.length > 1 ? `${pains.length} douleurs suivies · ${painLine(p)}` : painLine(p), lines, action: { label: 'Mon protocole', to: `/soins?zone=${p.area}` }, tone: p.intensity >= 6 ? 'warn' : 'mid' };
  } else {
    const upper = nextDay ? nextMus.some((k) => !LOWER_M.has(k)) && !nextMus.some((k) => ['quadriceps', 'ischios', 'fessiers'].includes(k)) : true;
    out.care = { headline: 'Aucune douleur suivie', lines: [{ icon: 'body', text: nextLbl ? `Avant ${nextLbl} : routine mobilité « ${upper ? 'haut du corps' : 'jambes'} », 5 min.` : '5 min de mobilité par jour gardent les articulations souples.' }, ...(tired.length ? [{ icon: 'moon', text: `Après la séance : étirements doux sur ${tired.slice(0, 3).map(([, m]) => m.label.toLowerCase()).join(', ')}.` }] : [])],
      action: { label: 'Mobilité', to: '/soins' }, tone: 'good' };
  }

  // CORPS
  {
    const lines = [];
    if (tiredNext.length) lines.push({ icon: 'alert', tone: 'warn', text: `${tiredNext.join(', ')} encore fatigué${tiredNext.length > 1 ? 's' : ''} pour ${nextLbl} : échauffe-toi plus et ne cherche pas de record.` });
    else if (nextLbl) lines.push({ icon: 'check', tone: 'good', text: `Les muscles de ${nextLbl} sont récupérés.` });
    if (gaps.gaps.length) lines.push({ icon: 'target', text: `${gaps.gaps.length} muscle${gaps.gaps.length > 1 ? 's' : ''} sans exercice dédié : ${gaps.gaps.slice(0, 3).map((g) => g.label.toLowerCase()).join(', ')}.` });
    for (const p of pains.slice(0, 1)) lines.push({ icon: 'heal', text: `Douleur ${p.label.toLowerCase()} suivie : les muscles autour sont ménagés dans les conseils.` });
    out.body = { headline: tired.length ? `${tired.length} muscle${tired.length > 1 ? 's' : ''} en récupération` : 'Tout est récupéré', lines, action: gaps.gaps.length ? { label: 'Muscles oubliés', to: '/corps#oublies' } : null, tone: tiredNext.length ? 'warn' : 'good' };
  }

  // PROGRÈS
  {
    const recs = allRecords(db).filter((r) => r.date >= addDays(today, -29));
    const wk = periodStats(db, weekStart(today), addDays(weekStart(today), 6)); const target = profile.sessions_per_week || null;
    // Stagnation : même charge max sur les 3 dernières séances d'un exercice du programme
    const stag = [];
    for (const e of allEx) {
      const rows = db.all(`SELECT w.date, MAX(s.weight) top FROM workout_sets s JOIN workouts w ON w.id = s.workout_id WHERE w.user_id = ? AND s.exercise_id = ? AND s.completed = 1 AND s.weight IS NOT NULL GROUP BY w.id ORDER BY w.date DESC LIMIT 3`, USER_ID, e.exercise_id);
      if (rows.length === 3 && rows.every((r) => r.top === rows[0].top) && !pains.some((p) => p.affected.includes(e.name))) stag.push(e.name);
    }
    const lines = [];
    if (target) lines.push({ icon: 'calendar', tone: wk.workouts >= target ? 'good' : '', text: `${wk.workouts}/${target} séances cette semaine${wk.workouts >= target ? ' : objectif atteint' : ''}.` });
    if (increases.length) lines.push({ icon: 'up', tone: 'good', text: `${increases.length} hausse${increases.length > 1 ? 's' : ''} de charge prête${increases.length > 1 ? 's' : ''} : tu les valides dans le briefing ou le débrief.` });
    if (stag.length) lines.push({ icon: 'alert', text: `${[...new Set(stag)].slice(0, 2).join(', ')} : même charge depuis 3 séances. Vise +1 répétition par série avant de monter.` });
    if (pains.length) lines.push({ icon: 'heal', text: `Pas de hausse sur les exercices touchés par ta douleur ${pains[0].label.toLowerCase()} : c’est voulu.` });
    const nRec = new Set(recs.map((r) => r.exercise_id ?? r.name)).size;
    out.progress = { headline: recs.length ? `Records sur ${nRec} exercice${nRec > 1 ? 's' : ''} en 30 jours` : 'Pas de record ce mois-ci, la régularité paie', lines, action: { label: 'Analyse', to: '/progres?v=analyse' }, tone: recs.length ? 'good' : 'mid' };
  }

  // NUTRITION
  {
    let ns = null; try { ns = nutritionState(db, today); } catch { /* données incomplètes */ }
    const eat = db.one('SELECT COALESCE(SUM(kcal),0) k, COALESCE(SUM(protein_g),0) p FROM food_logs WHERE user_id = ? AND date = ?', USER_ID, today);
    const code = profile.schedule?.[dayKey(today)];
    const trainToday = !!db.one('SELECT id FROM workouts WHERE user_id = ? AND date = ?', USER_ID, today) || !!db.one("SELECT id FROM calendar_events WHERE user_id = ? AND date = ? AND type = 'workout' AND status <> 'skipped'", USER_ID, today) || (!!code && code !== 'rest');
    const lines = [];
    if (ns?.plan) {
      const kcal = ns.plan.in_break ? ns.tdee : ns.plan.kcal; const prot = ns.plan.protein_g;
      lines.push({ icon: 'flame', text: `Reste ${Math.max(0, Math.round(kcal - eat.k)).toLocaleString('fr-FR')} kcal et ${Math.max(0, Math.round(prot - eat.p))} g de protéines aujourd’hui.` });
      out.nutrition_head = `${ns.plan.label} · semaine ${ns.plan.week}/${ns.plan.weeks}`;
    } else lines.push({ icon: 'target', text: 'Pas encore de cible : choisis un objectif dans le créateur, les calories suivent.' });
    lines.push({ icon: 'dumbbell', text: trainToday ? 'Jour d’entraînement : glucides et protéines dans le repas avant et après la séance.' : 'Jour sans séance : garde les protéines, un peu moins de glucides.' });
    if (pains.length) lines.push({ icon: 'heal', text: 'Douleur en cours : 1,6 à 2,2 g de protéines par kg et 7 à 9 h de sommeil aident la réparation.' });
    out.nutrition = { headline: out.nutrition_head || 'Nutrition', lines, action: ns?.plan ? { label: 'Noter un repas', to: '/repas' } : { label: 'Choisir un objectif', to: '/programme/creer' }, tone: 'mid' };
    delete out.nutrition_head;
  }

  // PROGRAMME
  {
    const lines = [];
    const hit = pains.filter((p) => p.affected.length);
    if (hit.length) lines.push({ icon: 'heal', tone: 'warn', text: `Douleur ${hit[0].label.toLowerCase()} : ${hit[0].affected.slice(0, 3).join(', ')} marqué${hit[0].affected.length > 1 ? 's' : ''} « à adapter » ci-dessous.` });
    if (increases.length) lines.push({ icon: 'up', tone: 'good', text: `${increases.length} hausse${increases.length > 1 ? 's' : ''} de charge prête${increases.length > 1 ? 's' : ''}.` });
    if (gaps.gaps.length) lines.push({ icon: 'target', text: `${gaps.gaps.map((g) => g.label.toLowerCase()).slice(0, 3).join(', ')} sans exercice dédié : suggestion plus bas.` });
    if (tiredNext.length) lines.push({ icon: 'alert', text: `${tiredNext.join(', ')} encore fatigué${tiredNext.length > 1 ? 's' : ''} pour la prochaine séance.` });
    out.program = { headline: nextLbl ? `Prochaine : ${nextLbl}` : 'Ton programme', lines, action: next ? { label: 'Briefing', to: `/seance/${next.program_day_id}` } : null, tone: hit.length ? 'warn' : 'good' };
  }
  out.pains = pains.map((p) => ({ id: p.id, area: p.area, label: p.label, intensity: p.intensity, first: p.first, days: p.days, phase: p.phase, checked_today: p.checked_today, trend: p.trend, affected: p.affected, next_affected: p.next_affected }));
  out.pain_patterns = Object.fromEntries(pains.map((p) => [p.area, { label: p.label, patterns: (PAIN_AREAS[p.area] || {}).patterns || [] }]));
  return out;
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
    const { muscles, range } = bodyStatus(db, req.today);
    const pains = db.all('SELECT * FROM pain_reports WHERE user_id = ? AND resolved = 0 ORDER BY date DESC', USER_ID).map((p) => ({ ...p, label: PAIN_AREAS[p.area]?.label || p.area }));
    res.json({ muscles, pains, range });
  });

  // Équilibre musculaire : force et volume entre muscles opposés
  r.get('/bodymap/balance', (req, res) => res.json(muscleBalance(db, req.today)));

  // Coach du jour : une consigne claire (séance, repos actif, séance faite), avec ce qui compte pour aujourd'hui
  r.get('/coach/today', (req, res) => {
    const today = req.today; const profile = getProfile(db);
    const prog = getProgram(db, { withLast: false });
    const rest = profile.default_rest_seconds || 90;
    const doneW = db.one('SELECT id, program_day_id, name, duration_sec FROM workouts WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1', USER_ID, today);
    const ev = db.one("SELECT * FROM calendar_events WHERE user_id = ? AND date = ? AND type = 'workout' ORDER BY id LIMIT 1", USER_ID, today);
    const code = profile.schedule?.[dayKey(today)];
    const dayId = ev?.program_day_id ?? (code && code !== 'rest' ? prog.days.find((d) => d.code === code)?.id : null);
    const status = bodyStatus(db, today).muscles;
    let ana = null; try { ana = analyse(db, today); } catch { /* historique insuffisant */ }
    const rec = recoveryScore(db, profile, today);
    const describe = (id) => {
      const d = prog.days.find((x) => x.id === id); if (!d) return null;
      const mus = {}; for (const e of d.exercises) for (const [k, c] of Object.entries(e.muscles || {})) if (c >= 1) mus[k] = (mus[k] || 0) + (e.sets || 0);
      const main = Object.entries(mus).sort((a, b) => b[1] - a[1]).map(([k]) => k);
      const tired = main.filter((k) => status[k]?.status === 'fatigue').map((k) => MUSCLES[k]);
      const cardio = d.cardio.reduce((a, c) => a + (c.duration_min || 0), 0);
      return { id: d.id, name: d.name, focus: d.focus, n_ex: d.exercises.length, sets: d.exercises.reduce((a, e) => a + (e.sets || 0), 0), cardio_min: Math.round(cardio),
        est_minutes: Math.round(d.exercises.reduce((a, e) => a + (e.sets || 0) * (40 + (e.rest_seconds || rest)), 0) / 60 + cardio),
        muscles: main.slice(0, 3).map((k) => MUSCLES[k]), tired,
        increases: (ana?.progression || []).filter((p) => p.day_id === d.id && p.type === 'increase').length };
    };
    const cardioToday = db.one('SELECT COALESCE(SUM(duration_min),0) m FROM cardio_sessions WHERE user_id = ? AND date = ?', USER_ID, today).m;
    const cardioPlanned = db.one("SELECT COALESCE(SUM(planned_minutes),0) m FROM calendar_events WHERE user_id = ? AND date = ? AND type = 'cardio'", USER_ID, today).m;
    const nextOf = (from) => { const n = nextSession(db, from); return n ? { ...n, day: describe(n.program_day_id) } : null; };
    const lines = [];
    let out;
    if (doneW) {
      const n = nextOf(addDays(today, 1));
      lines.push({ icon: 'flame', text: 'Récupération : protéines à chaque repas et 7 à 9 h de sommeil, c’est là que le muscle se construit.' });
      if (n) lines.push({ icon: 'calendar', text: `Prochaine séance : ${n.name}${n.focus ? ` (${n.focus})` : ''}${n.date ? `, ${n.date === addDays(today, 1) ? 'demain' : 'le ' + n.date.slice(8) + '/' + n.date.slice(5, 7)}` : ''}.` });
      out = { kind: 'done', headline: 'Séance faite, bravo', sub: doneW.name, workout_id: doneW.id, next: n };
    } else if (dayId) {
      const d = describe(dayId);
      if (d.tired.length) lines.push({ icon: 'alert', tone: 'warn', text: `${d.tired.join(', ')} encore fatigué${d.tired.length > 1 ? 's' : ''} : échauffement plus long, garde tes charges et arrête-toi à 2 répétitions de l’échec.` });
      else if (rec.score < 55) lines.push({ icon: 'alert', tone: 'warn', text: `Récupération ${rec.label.toLowerCase()} (${rec.score}/100) : séance normale mais sans chercher de record.` });
      const dayEx = prog.days.find((x) => x.id === dayId)?.exercises || [];
      for (const p of db.all('SELECT area, intensity FROM pain_reports WHERE user_id = ? AND resolved = 0', USER_ID)) {
        const hit = [...new Set(dayEx.filter((e) => (PAIN_AREAS[p.area]?.patterns || []).includes(e.pattern)).map((e) => e.name))];
        if (hit.length) lines.push({ icon: 'heal', tone: 'warn', text: `Douleur ${(PAIN_AREAS[p.area]?.label || p.area).toLowerCase()} (${p.intensity}/10) : ${hit.slice(0, 3).join(', ')} à adapter, sans hausse de charge.` });
      }
      if (d.increases) lines.push({ icon: 'up', tone: 'good', text: 'Des hausses de charge sont prêtes : tu choisis de les appliquer dans le briefing.' });
      if (ev?.deload) lines.push({ icon: 'moon', text: 'Semaine de deload : moitié des séries, charges −10 %, déjà calculées.' });
      if (d.cardio_min) lines.push({ icon: 'heart', text: `${d.cardio_min} min de cardio inclus dans la séance.` });
      out = { kind: 'workout', headline: `${d.name}${d.focus ? ` · ${d.focus}` : ''}`, sub: `≈ ${d.est_minutes} min · ${d.n_ex} exercices · ${d.sets} séries`, day: d, deload: !!ev?.deload, recovery: rec };
    } else if (!ev && code === 'rest') {
      const n = nextOf(addDays(today, 1));
      const left = Math.max(0, Math.round(cardioPlanned - cardioToday));
      lines.push({ icon: 'heart', text: cardioPlanned ? (left ? `${left} min de cardio prévues aujourd’hui.` : 'Cardio du jour fait.') : '20 à 30 min de marche ou de vélo facile aident à récupérer sans fatiguer.' });
      lines.push({ icon: 'body', text: '10 min de mobilité sur les muscles encore fatigués (onglet Corps).' });
      if (n) lines.push({ icon: 'calendar', text: `Prochaine séance : ${n.name}${n.focus ? ` (${n.focus})` : ''}.` });
      out = { kind: 'rest', headline: 'Repos actif', sub: 'Le muscle se construit pendant la récupération.', next: n, cardio_left: left };
    } else {
      const n = nextOf(today);
      if (rec.score < 55) lines.push({ icon: 'moon', text: `Récupération ${rec.label.toLowerCase()} (${rec.score}/100) : une journée de repos actif serait plus utile.` });
      if (n?.day?.tired.length) lines.push({ icon: 'alert', tone: 'warn', text: `${n.day.tired.join(', ')} encore fatigué${n.day.tired.length > 1 ? 's' : ''}.` });
      if (n?.day?.increases) lines.push({ icon: 'up', tone: 'good', text: 'Des hausses de charge sont prêtes pour cette séance.' });
      out = n ? { kind: 'free', headline: `${n.name}${n.focus ? ` · ${n.focus}` : ''}`, sub: n.day ? `Séance conseillée · ≈ ${n.day.est_minutes} min · ${n.day.n_ex} exercices` : 'Séance conseillée', day: n.day, recovery: rec }
        : { kind: 'empty', headline: 'Crée ton programme', sub: 'Choisis un objectif, le créateur te propose un programme.' };
    }
    res.json({ ...out, lines, recovery: rec ? { score: rec.score, label: rec.label } : null });
  });

  // Muscles oubliés : ni travaillés depuis 4 semaines (muscu + cardio) ni prévus dans le programme actif → exercice suggéré + jour conseillé
  r.get('/program/gaps', (req, res) => res.json(programGaps(db, req.today)));
  r.get('/coach/brief', (req, res) => res.json(coachBrief(db, req.today)));

  // Courbatures signalées par l'utilisateur (toggle du jour)
  r.post('/soreness', (req, res) => {
    const m = String(req.body.muscle || ''); if (!MUSCLES[m]) throw bad('Muscle inconnu');
    const ex = db.one('SELECT id FROM muscle_soreness WHERE user_id = ? AND muscle = ? AND date = ?', USER_ID, m, req.today);
    if (req.body.on === false) db.run('DELETE FROM muscle_soreness WHERE user_id = ? AND muscle = ? AND date >= ?', USER_ID, m, addDays(req.today, -3));
    else if (!ex) db.run('INSERT INTO muscle_soreness (user_id, date, muscle) VALUES (?,?,?)', USER_ID, req.today, m);
    res.json({ ok: true });
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
