// Cerveau du coach : récupération estimée / observée, stagnations, analyse du programme, bilan de la semaine,
// boîte « À valider » et réponses aux 10 questions. Tout est déterministe et calculé sur les données du téléphone.
// Chaque réponse cite les chiffres utilisés. Rien n'est modifié sans validation.
import { MUSCLES } from '../seed.js';
import { USER_ID, getProfile, getProgram, periodStats, allRecords, exerciseRow } from '../services.js';
import { analyse, RANGES, PAIN_AREAS } from '../analysis.js';
import { bodyStatus, programGaps } from '../routes/insights.js';
import { e1rm, toLbs } from '../formulas.js';
import { addDays, weekStart, diffDays } from '../util.js';
import { toJSON } from '../schema.js';
import { coachContext } from './context.js';
import { decide, history } from './progression.js';

const pct = (x) => `${x > 0 ? '+' : ''}${Math.round(x * 10) / 10} %`.replace('.', ',');
const frDate = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');
const r1 = (x) => Math.round(x * 10) / 10;
const fmt = (n) => String(r1(n)).replace('.', ',');

// Performance d'une séance sur un exercice : 1RM estimé (charges), répétitions totales (poids du corps), assistance inversée
function perf(sess, kind) {
  const done = sess.sets.filter((s) => s.completed);
  if (!done.length) return null;
  if (kind === 'bodyweight' || done.every((s) => s.weight == null)) return { v: done.reduce((a, s) => a + (s.reps || 0), 0), how: 'reps' };
  if (kind === 'assisted') { const w = Math.min(...done.map((s) => toLbs(s.weight ?? 0, s.weight_unit))); return { v: -w, how: 'assist' }; }
  const best = Math.max(...done.map((s) => e1rm(toLbs(s.weight, s.weight_unit), s.reps) || 0));
  return best ? { v: best, how: 'e1rm' } : null;
}
const change = (a, b, how) => (how === 'assist' ? (a - b) / Math.max(1, Math.abs(b)) * 100 : (a - b) / Math.max(1, Math.abs(b)) * 100);

// ---------- Récupération : estimée (modèle) contre observée (performances réelles) ----------
export function recoveryView(db, today) {
  const ctx = coachContext(db, today); const bm = bodyStatus(db, today);
  // Observée : chaque exercice refait dans les 14 derniers jours est comparé à sa séance précédente
  const recent = db.all(`SELECT DISTINCT s.exercise_id, e.name, e.kind, e.muscles FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND w.date BETWEEN ? AND ?`, USER_ID, addDays(today, -13), today);
  const obs = []; const byMuscle = {};
  for (const ex of recent) {
    const h = history(db, ex.exercise_id, 2);
    if (h.length < 2 || h[0].date < addDays(today, -13)) continue;
    const a = perf(h[0], ex.kind); const b = perf(h[1], ex.kind); if (!a || !b) continue;
    const d = change(a.v, b.v, a.how); const gap = diffDays(h[1].date, h[0].date);
    const o = { exercise: ex.name, date: h[0].date, prev: h[1].date, gap_days: gap, change_pct: r1(d), trend: d > 1.5 ? 'mieux' : d < -3 ? 'baisse' : 'stable' };
    obs.push(o);
    for (const [m, c] of Object.entries(toJSON(ex.muscles, {}))) if (c >= 1) (byMuscle[m] ||= []).push(o);
  }
  const better = obs.filter((o) => o.trend === 'mieux').length; const worse = obs.filter((o) => o.trend === 'baisse').length;
  const observed = obs.length < 3 ? { enough: false, n: obs.length, label: 'Pas assez de séances comparables', text: 'Il faut au moins 3 exercices refaits dans les 14 derniers jours pour juger la récupération réelle.' }
    : { enough: true, n: obs.length, better, worse, same: obs.length - better - worse, score: Math.round(((better + (obs.length - better - worse) * 0.6) / obs.length) * 100),
      label: worse / obs.length >= 0.4 ? 'En baisse' : better / obs.length >= 0.4 ? 'Bonne' : 'Stable',
      text: `${better} exercice${better > 1 ? 's' : ''} en progrès, ${obs.length - better - worse} stable${obs.length - better - worse > 1 ? 's' : ''}, ${worse} en baisse par rapport à la séance précédente.` };
  const est = ctx.recovery;
  let verdict;
  if (!observed.enough) verdict = `Estimation seule (${est.score}/100) : ${observed.text}`;
  else if (est.score >= 70 && observed.label === 'En baisse') verdict = 'Le modèle te dit reposé, mais tes performances baissent : ta récupération réelle est plus lente que prévu. Dors plus ou allège une séance avant d’augmenter les charges.';
  else if (est.score < 60 && observed.label === 'Bonne') verdict = 'Le modèle voit des signes de fatigue, mais tes performances montent : tu récupères mieux que prévu. Continue, en restant attentif.';
  else if (observed.label === 'En baisse') verdict = 'Estimation et performances concordent : tu es fatigué. Garde les charges, coupe une série par exercice cette semaine.';
  else verdict = 'Estimation et performances concordent : ta récupération suit le rythme de ton programme.';
  const muscles = Object.entries(bm.muscles).filter(([, m]) => m.days != null && m.days <= 9).map(([k, m]) => {
    const o = byMuscle[k] || []; const w = o.filter((x) => x.trend === 'baisse').length; const b = o.filter((x) => x.trend === 'mieux').length;
    return { key: k, label: m.label, status: m.status, days: m.days, sore: !!m.sore, observed: o.length ? (w > b ? 'baisse' : b > w ? 'mieux' : 'stable') : null };
  });
  return { estimated: { score: est.score, label: est.label, factors: est.factors }, observed, verdict, muscles, exercises: obs,
    note: 'Récupération estimée à partir du volume, de l’effort, du repos, du sommeil et des douleurs. Ce n’est pas une mesure médicale.' };
}

// ---------- Stagnation : 4 dernières séances de chaque exercice du programme ----------
export function stagnationReport(db, today, onlyExerciseId = null) {
  const ctx = coachContext(db, today);
  const { days } = getProgram(db, { withLast: false });
  const pes = days.flatMap((d) => d.exercises.map((e) => ({ ...e, day_name: d.name })));
  const lib = db.all('SELECT * FROM exercises').map(exerciseRow);
  const out = []; const seen = new Set();
  for (const pe of pes) {
    if (seen.has(pe.exercise_id)) continue; seen.add(pe.exercise_id);
    if (onlyExerciseId && pe.exercise_id !== onlyExerciseId) continue;
    const h = history(db, pe.exercise_id, 4).filter((x) => x.date >= addDays(today, -70));
    if (h.length < 3) { if (onlyExerciseId) out.push({ exercise: pe.name, exercise_id: pe.exercise_id, status: 'insuffisant', sessions: h.length, causes: [], actions: [], text: `Seulement ${h.length} séance${h.length > 1 ? 's' : ''} en 10 semaines : il en faut 3 pour parler de stagnation.` }); continue; }
    const ps = h.map((x) => perf(x, pe.kind)).reverse(); if (ps.some((p) => !p)) continue;
    const hh = [...h].reverse();
    const first = Math.max(...ps.slice(0, 2).map((p) => p.v)); const last = Math.max(...ps.slice(-2).map((p) => p.v));
    const d = change(last, first, ps[0].how);
    const status = d > 2 ? 'progresse' : d < -3 ? 'regresse' : 'stagne';
    const causes = [];
    const weights = hh.map((x) => { const w = x.sets.filter((s) => s.completed).map((s) => s.weight).filter((v) => v != null); return w.length ? Math.max(...w) : null; });
    if (weights.every((w) => w != null && w === weights[0])) causes.push({ k: 'charge', text: `Même charge (${fmt(weights[0])} ${pe.weight_unit}) sur les ${h.length} dernières séances.` });
    const hitAll = hh.map((x) => { const d = x.sets.filter((s) => s.completed); return d.length >= pe.sets && (!pe.reps || d.every((s) => (s.reps || 0) >= pe.reps)); });
    const easier = weights.every((w) => w != null) && (pe.kind === 'assisted' ? weights.at(-1) > weights[0] : weights.at(-1) < weights[0]);
    if (easier && hitAll.every(Boolean)) causes.push({ k: 'allege', text: `${pe.kind === 'assisted' ? 'Assistance augmentée' : 'Charge baissée'} de ${fmt(weights[0])} à ${fmt(weights.at(-1))} ${pe.weight_unit} alors que toutes tes séries étaient réussies.` });
    else if (hitAll.slice(-2).every(Boolean) && status !== 'progresse') causes.push({ k: 'objectif', text: `${pe.reps ? `Objectif ${pe.sets} × ${pe.reps}` : 'Toutes les séries'} atteint à chaque séance sans que la charge ou les répétitions montent : c’est le programme qui te freine, pas toi.` });
    const missed = hh.map((x) => x.sets.filter((s) => s.completed && pe.reps && (s.reps || 0) < pe.reps).length);
    if (pe.reps && missed.slice(-2).every((m) => m > 0)) causes.push({ k: 'reps', text: `Objectif de ${pe.reps} répétitions manqué sur ${missed.slice(-2).join(' puis ')} série(s) aux deux dernières séances.` });
    const sets = hh.map((x) => x.sets.filter((s) => s.completed).length);
    if (sets.slice(-2).some((n) => n < pe.sets)) causes.push({ k: 'volume', text: `Séries faites : ${sets.join(', ')} pour ${pe.sets} prévues.` });
    const span = diffDays(hh[0].date, hh.at(-1).date); const perWeek = span ? (h.length - 1) / span * 7 : 0;
    if (perWeek < 0.75) causes.push({ k: 'frequence', text: `Fréquence basse : ${fmt(perWeek)} séance par semaine sur cet exercice (${frDate(hh[0].date)} → ${frDate(hh.at(-1).date)}).` });
    const rpes = hh.map((x) => x.rpe).filter((v) => v != null); const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    if (avgRpe != null && avgRpe >= 8.5) causes.push({ k: 'fatigue', text: `Effort ressenti moyen de ${fmt(avgRpe)}/10 sur ces séances : tu t’entraînes près de la limite.` });
    if (ctx.painPatterns.has(pe.pattern)) causes.push({ k: 'douleur', text: 'Une douleur active touche ce mouvement : la stagnation est normale, la priorité est de guérir.' });
    if (ctx.recovery.score < 65) causes.push({ k: 'recuperation', text: `Récupération estimée ${ctx.recovery.score}/100 (${ctx.recovery.factors.filter((f) => f.impact < 0).map((f) => f.text.toLowerCase()).slice(0, 2).join(', ') || 'plusieurs signaux'}).` });
    const actions = [];
    if (status !== 'progresse') {
      const pain = causes.some((c) => c.k === 'douleur');
      if (!pain && causes.some((c) => c.k === 'allege')) actions.push(`Revenir à ${fmt(weights[0])} ${pe.weight_unit}${pe.kind === 'assisted' ? ' d’assistance' : ''} : tu la tenais.`);
      if (!pain && causes.some((c) => c.k === 'objectif' || c.k === 'allege')) actions.push('Valider la hausse proposée dans « À valider ».');
      if (causes.some((c) => c.k === 'douleur')) actions.push('Garder la charge et soigner la douleur (voir Soins).');
      else if (causes.some((c) => c.k === 'fatigue' || c.k === 'recuperation')) actions.push('Alléger : une série de moins sur cet exercice pendant une semaine, puis reprendre.');
      if (causes.some((c) => c.k === 'charge') && !causes.some((c) => c.k === 'reps')) actions.push(`Progresser en répétitions : viser ${pe.reps ? pe.reps + 2 : 12} avant d’augmenter.`);
      if (causes.some((c) => c.k === 'reps')) actions.push('Baisser d’environ 10 % et remonter en 2 à 3 séances avec une technique propre.');
      if (causes.some((c) => c.k === 'frequence')) actions.push('Le faire au moins une fois par semaine sans sauter de séance.');
      if (h.length >= 4 && status === 'stagne' && !causes.some((c) => c.k === 'objectif')) {
        const alt = lib.filter((e) => e.pattern === pe.pattern && e.id !== pe.exercise_id).slice(0, 2).map((e) => e.name);
        if (alt.length) actions.push(`Changer de variante 4 à 6 semaines : ${alt.join(' ou ')}.`);
      }
      if (!actions.length && !causes.some((c) => c.k === 'objectif' || c.k === 'allege')) actions.push('Ajouter une série si ta récupération le permet, ou changer la plage de répétitions (ex. 6-8 au lieu de 10-12).');
    }
    const unitTxt = ps[0].how === 'e1rm' ? '1RM estimé' : ps[0].how === 'reps' ? 'répétitions totales' : 'assistance';
    out.push({ exercise: pe.name, exercise_id: pe.exercise_id, program_exercise_id: pe.id, day_name: pe.day_name, status, change_pct: r1(d), sessions: h.length,
      series: hh.map((x, i) => ({ date: x.date, value: ps[i].how === 'assist' ? -r1(ps[i].v) : r1(ps[i].v) })), measure: unitTxt,
      causes, actions, text: `${unitTxt[0].toUpperCase() + unitTxt.slice(1)} ${pct(d)} entre le début et la fin des ${h.length} dernières séances.` });
  }
  const rank = { regresse: 0, stagne: 1, insuffisant: 2, progresse: 3 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || a.change_pct - b.change_pct);
}

// ---------- Programme : équilibre, excès, fréquence ----------
export function programReview(db, today) {
  const a = analyse(db, today); const { days } = getProgram(db, { withLast: false });
  const freq = {};
  for (const d of days) { const hit = new Set(); for (const pe of d.exercises) for (const [m, c] of Object.entries(pe.muscles)) if (c >= 1) hit.add(m); hit.forEach((m) => { freq[m] = (freq[m] || 0) + 1; }); }
  const w = Object.fromEntries(a.volume.muscles.map((m) => [m.key, m.sets]));
  const push = (w.pectoraux || 0) + (w.epaules_ant || 0); const pull = (w.dos_largeur || 0) + (w.dos_epaisseur || 0) + (w.epaules_post || 0);
  const ratios = [
    { key: 'push_pull', label: 'Poussée / tirage', value: pull ? r1(push / pull) : null, ideal: '0,8 à 1,2', ok: pull ? push / pull <= 1.25 && push / pull >= 0.7 : false, detail: `${fmt(push)} séries de poussée pour ${fmt(pull)} de tirage` },
    { key: 'quad_ham', label: 'Quadriceps / ischios', value: w.ischios ? r1((w.quadriceps || 0) / w.ischios) : null, ideal: '0,8 à 1,6', ok: w.ischios ? (w.quadriceps || 0) / w.ischios <= 1.6 && (w.quadriceps || 0) / w.ischios >= 0.6 : false, detail: `${fmt(w.quadriceps || 0)} séries de quadriceps pour ${fmt(w.ischios || 0)} d’ischios` },
  ];
  const muscles = a.volume.muscles.map((m) => ({ ...m, freq: freq[m.key] || 0 }));
  const excess = muscles.filter((m) => m.status === 'eleve');
  const under = muscles.filter((m) => m.status === 'absent' || m.status === 'faible');
  const lowFreq = muscles.filter((m) => m.sets >= m.min && (freq[m.key] || 0) === 1 && !['avant_bras', 'trapezes', 'abducteurs', 'adducteurs', 'lombaires', 'epaules_ant'].includes(m.key));
  const issues = a.findings.filter((f) => f.severity !== 'ok');
  return { level: a.level, ratios, muscles, excess, under, low_freq: lowFreq, findings: a.findings, issues, per_day: a.volume.per_day, total_sets: a.volume.total_sets,
    balanced: ratios.every((r) => r.ok) && !under.some((m) => m.status === 'absent') };
}

// ---------- Bilan de la semaine ----------
export function weeklyReview(db, today) {
  const profile = getProfile(db); const ws = weekStart(today); const prevS = addDays(ws, -7);
  const cur = periodStats(db, ws, today); const prev = periodStats(db, prevS, addDays(ws, -1));
  const target = profile.sessions_per_week || 4;
  const recs = allRecords(db); const recCur = recs.filter((r) => r.date >= ws && r.date <= today); const recPrev = recs.filter((r) => r.date >= prevS && r.date < ws);
  const pains = db.all('SELECT area, intensity FROM pain_reports WHERE user_id = ? AND resolved = 0', USER_ID);
  const planned = db.one("SELECT COUNT(*) n FROM calendar_events WHERE user_id = ? AND type = 'workout' AND date BETWEEN ? AND ?", USER_ID, ws, addDays(ws, 6)).n;
  const missed = db.one("SELECT COUNT(*) n FROM calendar_events WHERE user_id = ? AND type = 'workout' AND status = 'planned' AND date BETWEEN ? AND ?", USER_ID, ws, addDays(today, -1)).n;
  const left = Math.max(0, target - cur.workouts);
  const wins = []; const watch = [];
  if (recCur.length) wins.push(`${recCur.length} record${recCur.length > 1 ? 's' : ''} : ${recCur.slice(0, 3).map((r) => `${r.name} ${fmt(r.weight)} ${r.unit}`).join(', ')}${recCur.length > 3 ? '…' : ''}`);
  if (cur.workouts >= target) wins.push(`Objectif de ${target} séances atteint.`);
  if (prev.volume_lbs && cur.volume_lbs > prev.volume_lbs) wins.push(`Volume déjà au-dessus de la semaine dernière (${Math.round(cur.volume_lbs).toLocaleString('fr-FR')} contre ${Math.round(prev.volume_lbs).toLocaleString('fr-FR')} lbs).`);
  if (missed) watch.push(`${missed} séance${missed > 1 ? 's' : ''} prévue${missed > 1 ? 's' : ''} non faite${missed > 1 ? 's' : ''} : note-la si tu l’as faite, sinon décale-la.`);
  if (cur.avg_rpe != null && cur.avg_rpe >= 8.5) watch.push(`Effort moyen élevé (${fmt(cur.avg_rpe)}/10) : garde 1 à 2 répétitions en réserve.`);
  if (pains.length) watch.push(`Douleur suivie : ${pains.map((p) => `${PAIN_AREAS[p.area]?.label || p.area} ${p.intensity}/10`).join(', ')}.`);
  const day = diffDays(ws, today) + 1;
  const focus = left === 0 ? 'Semaine bouclée : récupère bien, la suite se joue sur le sommeil.' : left > 7 - day + 1 ? `Il reste ${left} séance${left > 1 ? 's' : ''} pour ${8 - day} jour${8 - day > 1 ? 's' : ''} : ne force pas pour rattraper, garde la régularité.` : `Encore ${left} séance${left > 1 ? 's' : ''} pour tenir ton objectif.`;
  return { from: ws, to: today, target, planned, cur: { ...cur, records: recCur.length }, prev: { ...prev, records: recPrev.length }, wins, watch, focus };
}

// ---------- Boîte « À valider » : toutes les propositions au même endroit ----------
export function inbox(db, today) {
  const a = analyse(db, today); const gaps = programGaps(db, today);
  const items = [];
  for (const p of a.progression) {
    if (p.type === 'increase' || p.type === 'decrease') items.push({ key: p.key, kind: p.type === 'increase' ? 'charge' : 'baisse', state: p.state, state_label: p.state_label, title: p.title, reason: p.reason, evidence: p.evidence || [], day: p.day_name, current: p.current, proposed: p.proposed_label, accept: { type: 'analysis', key: p.key } });
  }
  for (const s of a.suggestions.slice(0, 4)) items.push({ key: s.key, kind: 'exercice', state: 'suggeree', state_label: 'Suggestion', title: `Ajouter ${s.exercise}`, reason: `${s.reason} Proposé dans ${s.day_name}, ${s.sets} × ${s.reps}.`, evidence: [], accept: { type: 'analysis', key: s.key } });
  for (const g of [...(gaps.gaps || []), ...(gaps.low || [])]) if (g.bump) items.push({ key: `bump:${g.bump.pe_id}:${g.bump.to}`, kind: 'serie', state: 'suggeree', state_label: 'Suggestion', title: `${g.bump.name} : ${g.bump.from} → ${g.bump.to} séries`, reason: `${g.label} ${g.forgotten ? 'oublié' : 'peu travaillé'} (${fmt(g.planned)} série${g.planned > 1 ? 's' : ''} prévue${g.planned > 1 ? 's' : ''} par semaine) : des séries en plus sur un exercice déjà dans ${g.bump.day.name}, plutôt qu’un doublon.`, evidence: [], accept: { type: 'bump', pe_id: g.bump.pe_id, sets: g.bump.to } });
  const dl = a.deload;
  if (dl?.due) items.push({ key: `deload:${today.slice(0, 7)}`, kind: 'programme', state: 'a_valider', state_label: 'À valider', title: 'Planifier une semaine allégée', reason: `${dl.why || 'Plusieurs semaines d’entraînement soutenu.'} Une semaine à volume réduit aide à repartir.`, evidence: [], accept: { type: 'link', to: '/progres?v=bilan' } });
  if (a.schedule.proposed) items.push({ key: 'schedule', kind: 'programme', state: 'a_valider', state_label: 'À valider', title: 'Réorganiser les jours de séance', reason: a.schedule.issues.join(' '), evidence: [], accept: { type: 'link', to: '/progres?v=analyse' } });
  // Ce que tu as déjà validé ou refusé ces 21 derniers jours ne revient pas
  const hidden = new Set(db.all('SELECT rec_key FROM recommendation_log WHERE user_id = ? AND created_at >= ?', USER_ID, addDays(today, -21)).map((l) => l.rec_key));
  for (let i = items.length - 1; i >= 0; i--) if (hidden.has(items[i].key)) items.splice(i, 1);
  const order = { confirmee: 0, a_valider: 1, suggeree: 2 };
  items.sort((x, y) => (order[x.state] ?? 3) - (order[y.state] ?? 3));
  const setup = a.progression.filter((p) => p.type === 'info').map((p) => ({ title: p.title, reason: p.reason }));
  const holds = a.progression.filter((p) => p.type === 'hold').map((p) => ({ title: p.title, reason: p.reason }));
  return { items, setup, holds };
}

// ---------- Les 10 questions ----------
export const QUESTIONS = [
  { id: 'today', q: 'Que dois-je entraîner aujourd’hui ?' },
  { id: 'recovered', q: 'Suis-je récupéré ?' },
  { id: 'increase', q: 'Dois-je augmenter la charge ?' },
  { id: 'stagnate', q: 'Pourquoi je stagne ?' },
  { id: 'balanced', q: 'Mon programme est-il équilibré ?' },
  { id: 'undertrained', q: 'Quel muscle est sous-entraîné ?' },
  { id: 'volume', q: 'Mon volume est-il adapté ?' },
  { id: 'change', q: 'Dois-je modifier mon programme ?' },
  { id: 'perform', q: 'Comment mieux performer ?' },
  { id: 'regress', q: 'Pourquoi un exercice régresse ?' },
];

export function ask(db, today, id, opts = {}) {
  const Q = QUESTIONS.find((x) => x.id === id); if (!Q) return null;
  const res = { id, q: Q.q, headline: '', points: [], evidence: [], actions: [] };
  const P = (text, tone = '') => res.points.push({ text, tone });
  const E = (label, value) => res.evidence.push({ label, value: String(value) });
  if (id === 'today') {
    const ctx = coachContext(db, today); const bm = bodyStatus(db, today);
    const { days } = getProgram(db, { withLast: false }); const profile = getProfile(db);
    const doneToday = db.one('SELECT name FROM workouts WHERE user_id = ? AND date = ? LIMIT 1', USER_ID, today);
    const ev = db.one("SELECT program_day_id FROM calendar_events WHERE user_id = ? AND date = ? AND type = 'workout' AND status = 'planned' LIMIT 1", USER_ID, today);
    const code = profile.schedule?.[['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(today + 'T12:00:00').getDay()]];
    const planned = days.find((d) => d.id === ev?.program_day_id) || days.find((d) => d.code === code);
    const ready = (d) => { const m = new Set(); for (const pe of d.exercises) for (const [k, c] of Object.entries(pe.muscles)) if (c >= 1) m.add(k); const tired = [...m].filter((k) => bm.muscles[k]?.status === 'fatigue'); return { tired, n: m.size }; };
    E('Récupération estimée', `${ctx.recovery.score}/100`);
    if (doneToday) { res.headline = `Séance faite : ${doneToday.name}. Récupère.`; P('Marche légère ou mobilité si tu veux bouger, rien d’intense.'); res.actions.push({ label: 'Mon débrief', to: '/historique' }); return res; }
    if (!days.length) { res.headline = 'Crée d’abord ton programme.'; res.actions.push({ label: 'Créer mon programme', to: '/programme/creer' }); return res; }
    // Séance la plus adaptée : prévue si elle est prête, sinon celle dont les muscles sont les plus reposés
    const scored = days.map((d) => ({ d, ...ready(d), last: db.one('SELECT MAX(date) d FROM workouts WHERE user_id = ? AND program_day_id = ?', USER_ID, d.id).d }));
    const pick = planned && ready(planned).tired.length === 0 ? scored.find((s) => s.d.id === planned.id)
      : [...scored].sort((a, b) => a.tired.length - b.tired.length || (a.last || '') .localeCompare(b.last || ''))[0];
    if (ctx.recovery.score < 45) { res.headline = 'Repos ou cardio léger aujourd’hui.'; P(`Récupération estimée basse (${ctx.recovery.score}/100) : ${ctx.recovery.factors.filter((f) => f.impact < 0).map((f) => f.text.toLowerCase()).join(', ')}.`, 'warn'); res.actions.push({ label: 'Voir Soins et mobilité', to: '/soins' }); return res; }
    res.headline = `${pick.d.name}${pick.d.focus ? ` · ${pick.d.focus}` : ''}`;
    if (planned && pick.d.id === planned.id) P('C’est la séance prévue aujourd’hui et ses muscles sont prêts.', 'good');
    else if (planned) P(`La séance prévue (${planned.name}) sollicite des muscles encore fatigués : ${ready(planned).tired.map((k) => MUSCLES[k]).join(', ')}. ${pick.d.name} est plus adaptée.`, 'warn');
    else P(`Pas de séance prévue aujourd’hui. Si tu veux t’entraîner, ${pick.d.name} est celle dont les muscles sont les plus reposés${pick.last ? ` (faite le ${frDate(pick.last)})` : ''}.`);
    if (pick.tired.length) P(`Encore fatigués : ${pick.tired.map((k) => MUSCLES[k]).join(', ')}. Échauffe-toi plus longtemps.`, 'warn');
    E('Muscles travaillés', pick.n); E('Dernière fois', pick.last ? frDate(pick.last) : 'jamais');
    res.actions.push({ label: 'Briefing et go', to: `/seance/${pick.d.id}` });
    return res;
  }
  if (id === 'recovered') {
    const r = recoveryView(db, today);
    res.headline = `Estimée ${r.estimated.score}/100 (${r.estimated.label.toLowerCase()}) · observée : ${r.observed.enough ? r.observed.label.toLowerCase() : 'pas assez de données'}.`;
    P(r.verdict, r.observed.label === 'En baisse' ? 'warn' : '');
    r.estimated.factors.filter((f) => f.impact < 0).forEach((f) => P(f.text, 'warn'));
    const tired = r.muscles.filter((m) => m.status === 'fatigue' || m.status === 'recup');
    if (tired.length) P(`En récupération : ${tired.map((m) => `${m.label} (${m.days === 0 ? 'aujourd’hui' : `il y a ${m.days} j`})`).join(', ')}.`);
    if (r.observed.enough) { E('Exercices comparés', r.observed.n); E('En progrès', r.observed.better); E('En baisse', r.observed.worse); }
    P(r.note, 'muted');
    res.actions.push({ label: 'Carte du corps', to: '/corps' });
    return res;
  }
  if (id === 'increase') {
    const box = inbox(db, today); const ups = box.items.filter((i) => i.kind === 'charge');
    const conf = ups.filter((u) => u.state === 'confirmee');
    res.headline = !ups.length ? 'Pas de hausse justifiée pour l’instant.' : conf.length ? `Oui sur ${conf.length} exercice${conf.length > 1 ? 's' : ''} (confirmé), ${ups.length - conf.length} autre${ups.length - conf.length > 1 ? 's' : ''} à juger.` : `Possible sur ${ups.length} exercice${ups.length > 1 ? 's' : ''}, mais sur une seule séance : à toi de juger.`;
    ups.slice(0, 6).forEach((u) => P(`${u.title} — ${u.state_label.toLowerCase()} : ${u.reason}`, u.state === 'confirmee' ? 'good' : ''));
    box.holds.slice(0, 4).forEach((h) => P(`${h.title} : ${h.reason}`, 'warn'));
    if (box.setup.length) P(`${box.setup.length} exercice${box.setup.length > 1 ? 's' : ''} sans données suffisantes (charge à définir).`, 'muted');
    E('Hausses confirmées', conf.length); E('Hausses suggérées', ups.length - conf.length); E('Maintiens', box.holds.length);
    if (ups.length) res.actions.push({ label: 'Valider dans « À valider »', to: '/coach#valider' });
    return res;
  }
  if (id === 'stagnate' || id === 'regress') {
    const list = stagnationReport(db, today, opts.exercise_id ? Number(opts.exercise_id) : null);
    const bad = list.filter((x) => (id === 'regress' ? x.status === 'regresse' : x.status === 'stagne' || x.status === 'regresse'));
    if (!list.length || list.every((x) => x.status === 'insuffisant')) { res.headline = 'Pas encore assez de séances pour juger.'; P('Il faut au moins 3 séances du même exercice sur les 10 dernières semaines.'); return res; }
    if (!bad.length) { res.headline = id === 'regress' ? 'Aucun exercice ne régresse.' : 'Tu ne stagnes pas : tes exercices progressent.'; list.filter((x) => x.status === 'progresse').slice(0, 4).forEach((x) => P(`${x.exercise} : ${x.text}`, 'good')); return res; }
    res.headline = `${bad.length} exercice${bad.length > 1 ? 's' : ''} ${id === 'regress' ? 'en baisse' : 'à l’arrêt ou en baisse'} : ${bad.slice(0, 3).map((x) => x.exercise).join(', ')}.`;
    res.items = bad.slice(0, 5);
    for (const x of bad.slice(0, 3)) {
      P(`${x.exercise} : ${x.text}`, 'warn');
      x.causes.forEach((c) => P(`· ${c.text}`, 'muted'));
      x.actions.slice(0, 2).forEach((a) => P(`→ ${a}`));
    }
    E('Exercices analysés', list.length); E('En progrès', list.filter((x) => x.status === 'progresse').length);
    return res;
  }
  if (id === 'balanced' || id === 'undertrained' || id === 'volume' || id === 'change') {
    const pr = programReview(db, today);
    const [minS, lo, hi] = RANGES[pr.level] || RANGES.intermediaire;
    if (!pr.per_day.length) { res.headline = 'Pas encore de programme.'; res.actions.push({ label: 'Créer mon programme', to: '/programme/creer' }); return res; }
    if (id === 'balanced') {
      res.headline = pr.balanced ? 'Oui, ton programme est équilibré.' : 'Pas tout à fait : voici les écarts.';
      pr.ratios.forEach((r) => { P(`${r.label} : ${r.value != null ? fmt(r.value) : '—'} (repère ${r.ideal}). ${r.detail}.`, r.ok ? 'good' : 'warn'); E(r.label, r.value != null ? fmt(r.value) : '—'); });
      pr.under.filter((m) => m.status === 'absent').forEach((m) => P(`Aucun travail pour ${m.label}.`, 'warn'));
    }
    if (id === 'undertrained') {
      const list = pr.under; const gaps = programGaps(db, today);
      res.headline = list.length ? `${list.slice(0, 3).map((m) => m.label).join(', ')}${list.length > 3 ? '…' : ''}` : 'Aucun muscle sous-entraîné dans ton programme.';
      list.slice(0, 6).forEach((m) => P(`${m.label} : ${fmt(m.sets)} série${m.sets > 1 ? 's' : ''} par semaine, minimum conseillé ${m.min}.`, 'warn'));
      (gaps.gaps || []).slice(0, 3).forEach((g) => P(`Oublié en pratique (moins d’une série en 4 semaines) : ${g.label}${g.bump ? ` → ${g.bump.name} ${g.bump.from} → ${g.bump.to} séries` : ''}.`));
      if (list.length) res.actions.push({ label: 'Voir les propositions', to: '/coach#valider' });
    }
    if (id === 'volume') {
      const ok = pr.muscles.filter((m) => m.status === 'optimal').length;
      res.headline = `${ok} muscle${ok > 1 ? 's' : ''} sur ${pr.muscles.length} dans la plage idéale (${lo} à ${hi} séries par semaine, niveau ${pr.level}).`;
      if (pr.excess.length) P(`Trop de volume : ${pr.excess.map((m) => `${m.label} ${fmt(m.sets)}`).join(', ')}. Pas grave si tu progresses, sinon retire une série.`, 'warn');
      if (pr.under.length) P(`Trop peu : ${pr.under.map((m) => `${m.label} ${fmt(m.sets)}`).join(', ')}.`, 'warn');
      if (pr.low_freq.length) P(`Travaillés une seule fois par semaine : ${pr.low_freq.map((m) => m.label).join(', ')}. Répartir sur 2 séances aide à progresser.`);
      E('Séries par semaine', pr.total_sets); E('Plage idéale', `${lo}-${hi}`); E('Minimum', minS);
      res.actions.push({ label: 'Volume par muscle', to: '/progres?v=analyse' });
    }
    if (id === 'change') {
      const stag = stagnationReport(db, today).filter((x) => x.status !== 'progresse' && x.status !== 'insuffisant');
      const first = db.one('SELECT MIN(date) d FROM workouts WHERE user_id = ? AND program_day_id IN (SELECT pd.id FROM program_days pd JOIN programs p ON p.id = pd.program_id WHERE p.active = 1)', USER_ID).d;
      const weeks = first ? Math.floor(diffDays(first, today) / 7) : 0;
      const reasons = [];
      if (stag.length >= 3) reasons.push(`${stag.length} exercices stagnent (${stag.slice(0, 3).map((x) => x.exercise).join(', ')}).`);
      if (!pr.balanced) reasons.push('Déséquilibre poussée/tirage ou quadriceps/ischios.');
      if (pr.under.some((m) => m.status === 'absent')) reasons.push('Un groupe musculaire n’est pas travaillé du tout.');
      if (weeks >= 10) reasons.push(`Programme suivi depuis ${weeks} semaines.`);
      res.headline = reasons.length >= 2 ? 'Oui, un ajustement serait utile.' : reasons.length ? 'Un petit ajustement suffit, pas besoin de tout changer.' : 'Non : garde ce programme, il fonctionne.';
      reasons.forEach((r) => P(r, 'warn'));
      if (!reasons.length) P('Tes exercices progressent et le programme est équilibré. Changer maintenant te ferait perdre des repères.', 'good');
      if (reasons.length) P('Toute modification passe par ta validation : je propose, tu choisis.');
      E('Semaines sur ce programme', weeks); E('Exercices qui stagnent', stag.length);
      res.actions.push({ label: reasons.length >= 2 ? 'Voir les propositions' : 'Mon programme', to: reasons.length >= 2 ? '/coach#valider' : '/programme' });
    }
    return res;
  }
  if (id === 'perform') {
    const wk = weeklyReview(db, today); const r = recoveryView(db, today); const pr = programReview(db, today);
    const profile = getProfile(db); const four = periodStats(db, addDays(today, -27), today);
    res.headline = 'Trois leviers, du plus rentable au moins rentable.';
    const tips = [];
    if (four.workouts_per_week < (profile.sessions_per_week || 4) * 0.8) tips.push([`Régularité : ${fmt(four.workouts_per_week)} séances par semaine sur 4 semaines pour ${profile.sessions_per_week || 4} prévues. C’est le premier levier.`, 'warn']);
    if (profile.sleep_hours != null && profile.sleep_hours < 7) tips.push([`Sommeil : ${fmt(profile.sleep_hours)} h. Passer à 7 h ou plus améliore la récupération et la force.`, 'warn']);
    if (r.observed.enough && r.observed.label === 'En baisse') tips.push(['Fatigue : tes performances baissent. Une semaine allégée te fera repartir plus fort.', 'warn']);
    if (four.avg_rpe != null && four.avg_rpe < 7) tips.push([`Intensité : effort moyen ${fmt(four.avg_rpe)}/10. Tu as de la marge : finis tes séries à 1 ou 2 répétitions de l’échec.`, '']);
    if (pr.under.length) tips.push([`Volume : ${pr.under.slice(0, 3).map((m) => m.label).join(', ')} sous le minimum.`, '']);
    const nut = db.one('SELECT id FROM nutrition_plans WHERE user_id = ? ORDER BY id DESC LIMIT 1', USER_ID);
    if (!nut) tips.push(['Nutrition : sans objectif calorique, difficile de savoir si tu manges assez pour progresser. Vise environ 1,6 à 2 g de protéines par kg.', '']);
    tips.push(['Technique : filme une série lourde par séance sur ton exercice principal, et garde la même amplitude d’une fois sur l’autre.', 'muted']);
    tips.slice(0, 4).forEach(([t, tone]) => P(t, tone));
    E('Séances / semaine', fmt(four.workouts_per_week)); E('Effort moyen', four.avg_rpe != null ? `${fmt(four.avg_rpe)}/10` : '—'); E('Records cette semaine', wk.cur.records);
    return res;
  }
  return res;
}

// Décision du jour en une ligne, pour l'en-tête de l'espace Coach
export function coachHub(db, today) {
  const box = inbox(db, today); const wk = weeklyReview(db, today); const r = recoveryView(db, today);
  const stag = stagnationReport(db, today).filter((x) => x.status === 'stagne' || x.status === 'regresse');
  return { inbox: box, week: wk, recovery: { estimated: r.estimated, observed: r.observed, verdict: r.verdict, note: r.note }, stagnation: stag.slice(0, 5), questions: QUESTIONS };
}
