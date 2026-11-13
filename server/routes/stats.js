import { Router } from 'express';
import { USER_ID, getProgram, nextSession, workoutSummary, periodStats, weeklySeries, monthlySeries, exerciseSeries, exercisePeriodBest, recentRecords, goalsWithProgress, getProfile, allRecords, bodyWeightInfo } from '../services.js';
import { smoothedWeight, r1 } from '../formulas.js';
import { recoveryScore, deloadStatus } from '../analysis.js';
import { MUSCLES } from '../seed.js';
import { nutritionState } from '../nutrition.js';
import { date, notFound, addDays, weekStart, diffDays, dayKey } from '../util.js';

export default function statsRoutes(db) {
  const r = Router();
  r.get('/dashboard', (req, res) => {
    const today = req.today; const ws = weekStart(today);
    const profile = getProfile(db);
    const last = db.one('SELECT w.*, pd.focus FROM workouts w LEFT JOIN program_days pd ON pd.id = w.program_day_id WHERE w.user_id = ? ORDER BY w.date DESC, w.id DESC LIMIT 1', USER_ID);
    const lastCardio = db.one('SELECT * FROM cardio_sessions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 1', USER_ID);
    const week = periodStats(db, ws, addDays(ws, 6));
    const all = periodStats(db, '0000-01-01', today);
    // Progression des charges : exercices les plus pratiqués, 1re vs dernière charge
    const top = db.all(`SELECT s.exercise_id, e.name, e.kind, COUNT(DISTINCT s.workout_id) n FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
      WHERE w.user_id = ? AND s.weight IS NOT NULL GROUP BY s.exercise_id ORDER BY n DESC, e.name LIMIT 6`, USER_ID);
    const progression = top.map((t) => {
      const pts = exerciseSeries(db, t.exercise_id).points.filter((p) => p.top_weight != null);
      return { exercise_id: t.exercise_id, name: t.name, assisted: t.kind === 'assisted', unit: pts[0]?.unit, first: pts[0]?.top_weight, last: pts.at(-1)?.top_weight, points: pts.slice(-10).map((p) => ({ date: p.date, value: p.top_weight })) };
    });
    const events = db.all(`SELECT ce.*, pd.name day_name, pd.focus FROM calendar_events ce LEFT JOIN program_days pd ON pd.id = ce.program_day_id WHERE ce.user_id = ? AND ce.date BETWEEN ? AND ? ORDER BY ce.date, ce.id`, USER_ID, ws, addDays(ws, 13));
    const doneDates = db.all(`SELECT date, 'workout' t FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ? UNION ALL SELECT date, 'cardio' FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?`, USER_ID, ws, addDays(ws, 13), USER_ID, ws, addDays(ws, 13));
    let nutrition = null; let ns = null; try { ns = nutritionState(db, today); if (ns.plan) nutrition = { label: ns.plan.label, type: ns.plan.type, kcal: ns.plan.in_break ? ns.tdee : ns.plan.kcal, protein_g: ns.plan.protein_g, week: ns.plan.week, weeks: ns.plan.weeks, check: ns.plan.check.status }; } catch { /* données incomplètes */ }
    // Ma journée : tout ce qui est prévu aujourd'hui, coché dès que c'est fait (séance, cardio, pesée), avec les cibles de la cure
    const todayEv = events.filter((e) => e.date === today);
    // Sans calendrier planifié, la semaine type du profil fait foi
    const schedCode = !todayEv.length ? profile.schedule?.[dayKey(today)] : null;
    const schedDay = schedCode && schedCode !== 'rest' ? db.one('SELECT pd.id program_day_id, pd.name day_name, pd.focus FROM program_days pd JOIN programs p ON p.id = pd.program_id WHERE p.user_id = ? AND p.active = 1 AND pd.code = ? AND pd.archived = 0', USER_ID, schedCode) : null;
    const wEv = todayEv.find((e) => e.type === 'workout') || (schedDay ? { ...schedDay, status: 'planned' } : null);
    if (schedCode === 'rest') todayEv.push({ type: 'rest' }); const cEv = todayEv.find((e) => e.type === 'cardio');
    const doneW = db.one('SELECT id FROM workouts WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1', USER_ID, today);
    const doneC = db.one('SELECT COALESCE(SUM(duration_min),0) m, COUNT(*) n FROM cardio_sessions WHERE user_id = ? AND date = ?', USER_ID, today);
    const progCardio = wEv?.program_day_id ? db.one('SELECT COALESCE(SUM(duration_min),0) m FROM program_cardio WHERE day_id = ?', wEv.program_day_id).m : 0;
    const weighed = !!db.one('SELECT id FROM body_metrics WHERE user_id = ? AND date = ? AND weight_kg IS NOT NULL', USER_ID, today);
    const STEPS = { seche: 10000, masse: 7000, recompo: 8000 };
    const day = {
      workout: wEv ? { name: wEv.day_name, focus: wEv.focus, program_day_id: wEv.program_day_id, deload: !!wEv.deload, done: !!doneW || wEv.status === 'done', workout_id: doneW?.id || wEv.workout_id } : doneW ? { done: true, workout_id: doneW.id, extra: true } : null,
      rest: !wEv && !doneW && todayEv.some((e) => e.type === 'rest'),
      cardio: (cEv || progCardio) ? { minutes: (cEv?.planned_minutes || 0) + Math.round(progCardio), done: doneC.n > 0, done_minutes: Math.round(doneC.m) } : doneC.n ? { minutes: 0, done: true, done_minutes: Math.round(doneC.m) } : null,
      weighed, eaten_kcal: Math.round(db.one('SELECT COALESCE(SUM(kcal),0) k FROM food_logs WHERE user_id = ? AND date = ?', USER_ID, today).k), kcal: nutrition?.kcal ?? null, protein_g: nutrition?.protein_g ?? null, steps: nutrition ? STEPS[nutrition.type] : null,
    };
    // À valider : propositions en attente, jamais appliquées seules
    const pending = [];
    if (ns?.plan?.check?.delta && (!ns.plan.last_adjust || ns.plan.last_adjust < weekStart(today))) pending.push({ key: 'cure', text: ns.plan.check.text, to: '/corps', action: `${ns.plan.check.delta > 0 ? '+' : ''}${ns.plan.check.delta} kcal` });
    try { const dl = deloadStatus(db, today); if (dl.due) pending.push({ key: 'deload', text: `Semaine de deload conseillée après ${dl.weeks_trained} semaines d’entraînement.`, to: '/coach', action: 'Planifier' }); } catch { /* pas assez d'historique */ }
    if (ns?.weight && diffDays(ns.weight.date, today) >= 7) pending.push({ key: 'pesee', text: `Dernière pesée il y a ${diffDays(ns.weight.date, today)} jours : ton plan et tes calories se basent sur ce poids.`, to: null, action: 'Me peser' });
    // Corps : poids lissé, variation sur 4 semaines (même lissage des deux côtés), courbe des 60 derniers jours
    const activeGoals = goalsWithProgress(db, today).filter((g) => g.status === 'actif');
    const goalTarget = (type) => activeGoals.find((g) => g.type === type)?.target_value ?? null;
    const wRows = db.all('SELECT id, date, weight_kg, waist_cm FROM body_metrics WHERE user_id = ? AND date <= ? ORDER BY date, id', USER_ID, today);
    const bwi = bodyWeightInfo(db);
    const then = smoothedWeight(wRows.filter((x) => x.date <= addDays(today, -28)));
    const lastWaist = [...wRows].reverse().find((x) => x.waist_cm);
    const body = bwi ? { weight: bwi.value, last: bwi.last, date: bwi.date, source: bwi.source, days_ago: bwi.date ? diffDays(bwi.date, today) : null,
      change_28d: then && bwi.source === 'pesee' ? r1(bwi.value - then.value) : null,
      points: wRows.filter((x) => x.weight_kg != null && x.date >= addDays(today, -59)).map((x) => ({ date: x.date, value: x.weight_kg })),
      waist: lastWaist ? { value: lastWaist.waist_cm, date: lastWaist.date } : null } : null;
    res.json({ nutrition, body, day, pending,
      today, name: profile.name, onboarded: profile.onboarded,
      next: nextSession(db, today),
      last_workout: last ? { ...workoutSummary(db, last), days_ago: diffDays(last.date, today) } : null,
      last_cardio: lastCardio,
      // Cibles de la semaine : un objectif actif l'emporte sur le profil (une seule cible affichée partout)
      week: { ...week, target: goalTarget('seances_semaine') ?? profile.sessions_per_week,
        cardio_target: goalTarget('cardio_minutes_semaine') ?? (profile.cardio_sessions_target || 0) * (profile.cardio_minutes_target || 0),
        target_from_goal: goalTarget('seances_semaine') != null, cardio_from_goal: goalTarget('cardio_minutes_semaine') != null,
        sets_target: getProgram(db, { withLast: false }).days.reduce((a, d) => a + d.exercises.reduce((b, e) => b + e.sets, 0), 0) },
      totals: { workouts: all.workouts, training_minutes: all.training_minutes, cardio_minutes: all.cardio_minutes, volume_lbs: all.volume_lbs },
      recent_workouts: db.all('SELECT w.*, pd.focus FROM workouts w LEFT JOIN program_days pd ON pd.id = w.program_day_id WHERE w.user_id = ? ORDER BY w.date DESC, w.id DESC LIMIT 5', USER_ID).map((w) => workoutSummary(db, w)),
      records: recentRecords(db, 5),
      progression,
      weekly: weeklySeries(db, today, 8),
      calendar: { from: ws, events, done: doneDates },
      goals: activeGoals.slice(0, 4),
      recovery: (({ score, label }) => ({ score, label }))(recoveryScore(db, profile, today)),
    });
  });

  // Bilan d'une semaine (0 = en cours, 1 = précédente) comparé à la semaine d'avant
  r.get('/recap', (req, res) => {
    const off = Math.min(52, Math.max(0, Number(req.query.offset) || 0));
    const from = addDays(weekStart(req.today), -7 * off); const to = addDays(from, 6);
    const pf = addDays(from, -7); const pt = addDays(from, -1);
    const cur = periodStats(db, from, to); const prev = periodStats(db, pf, pt);
    const recs = allRecords(db).filter((x) => x.date >= from && x.date <= to);
    const muscles = {};
    for (const r of db.all(`SELECT e.muscles FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
      WHERE w.user_id = ? AND s.completed = 1 AND w.date BETWEEN ? AND ?`, USER_ID, from, to)) {
      let m = {}; try { m = JSON.parse(r.muscles || '{}'); } catch { /* */ }
      for (const [k, v] of Object.entries(m)) muscles[k] = (muscles[k] || 0) + v;
    }
    const top = Object.entries(muscles).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => ({ muscle: k, label: MUSCLES[k] || k, sets: Math.round(v * 10) / 10 }));
    const days = db.all('SELECT DISTINCT date FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ? UNION SELECT DISTINCT date FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, from, to, USER_ID, from, to).map((x) => x.date);
    const profile = getProfile(db) || {};
    let streak = 0;
    for (let ws = weekStart(req.today), i = 0; i < 104; i++, ws = addDays(ws, -7)) {
      const st = periodStats(db, ws, addDays(ws, 6));
      if (st.workouts + st.cardio_sessions > 0) streak++; else if (i > 0) break;
    }
    // Corps sur la semaine : poids lissé en fin de semaine vs fin de semaine précédente, tour de taille, cure en cours
    const bRows = db.all('SELECT id, date, weight_kg, waist_cm FROM body_metrics WHERE user_id = ? AND date <= ? ORDER BY date, id', USER_ID, to);
    const wEnd = smoothedWeight(bRows.filter((x) => x.date >= from)); const wPrev = smoothedWeight(bRows.filter((x) => x.date >= pf && x.date <= pt));
    const waistIn = bRows.filter((x) => x.waist_cm != null && x.date >= from).at(-1); const waistBefore = bRows.filter((x) => x.waist_cm != null && x.date < from).at(-1);
    let plan = null; try { const ns = nutritionState(db, to < req.today ? to : req.today); if (ns.plan) plan = { label: ns.plan.label, week: ns.plan.week, weeks: ns.plan.weeks, check: ns.plan.check.text, status: ns.plan.check.status }; } catch { /* profil incomplet */ }
    const body = { weight: wEnd?.value ?? null, weigh_ins: bRows.filter((x) => x.weight_kg != null && x.date >= from).length, weight_change: wEnd && wPrev ? r1(wEnd.value - wPrev.value) : null,
      waist: waistIn?.waist_cm ?? null, waist_change: waistIn && waistBefore ? r1(waistIn.waist_cm - waistBefore.waist_cm) : null, plan };
    const goals = goalsWithProgress(db, req.today).filter((g) => g.status === 'actif' || (g.status === 'atteint'));
    const sessGoal = goals.find((g) => g.status === 'actif' && g.type === 'seances_semaine')?.target_value;
    res.json({ body, goals: off === 0 ? goals.filter((g) => g.status === 'actif').map((g) => ({ title: g.title, progress: g.progress, reached: g.reached })) : [], from, to, cur, prev, records: recs.map((x) => ({ name: x.name, weight: x.weight, previous: x.previous, unit: x.unit, assisted: x.assisted })),
      muscles: top, active_days: days.sort(), target: sessGoal ?? profile.sessions_per_week ?? null, streak, name: profile.name && profile.name !== 'Athlète' ? profile.name : null });
  });

  r.get('/stats/overview', (req, res) => {
    const weeks = Math.min(52, Number(req.query.weeks) || 12);
    res.json({ weekly: weeklySeries(db, req.today, weeks), monthly: monthlySeries(db, req.today, Math.min(24, Number(req.query.months) || 6)), records: recentRecords(db, 10),
      exercises: db.all(`SELECT e.id, e.name, e.kind, COUNT(DISTINCT s.workout_id) sessions FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id WHERE w.user_id = ? GROUP BY e.id ORDER BY sessions DESC, e.name`, USER_ID) });
  });
  r.get('/stats/exercise/:id', (req, res) => { const s = exerciseSeries(db, Number(req.params.id)); if (!s) throw notFound('Exercice introuvable'); res.json(s); });
  r.get('/stats/compare', (req, res) => {
    const a = [date(req.query.aFrom, 'aFrom'), date(req.query.aTo, 'aTo')], b = [date(req.query.bFrom, 'bFrom'), date(req.query.bTo, 'bTo')];
    const A = periodStats(db, ...a), B = periodStats(db, ...b);
    const ea = exercisePeriodBest(db, ...a), eb = exercisePeriodBest(db, ...b);
    const ids = [...new Set([...ea, ...eb].map((x) => x.exercise_id))];
    const exercises = ids.map((id) => ({ exercise_id: id, name: (ea.find((x) => x.exercise_id === id) || eb.find((x) => x.exercise_id === id)).name, a: ea.find((x) => x.exercise_id === id) || null, b: eb.find((x) => x.exercise_id === id) || null })).sort((x, y) => x.name.localeCompare(y.name));
    res.json({ a: A, b: B, exercises });
  });
  return r;
}
