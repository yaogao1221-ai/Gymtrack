// Espace Coach : décision du jour (GET /coach/today, dans insights.js), boîte « À valider », bilan, 10 questions
import { Router } from 'express';
import { coachHub, ask, QUESTIONS, recoveryView, stagnationReport, programReview, weeklyReview, inbox } from '../coach/engine.js';
import { notFound, bad, num, oneOf } from '../util.js';
import { muscleState, sundayReview, baselineFor, JOINTS } from '../coach/muscleState.js';
import { MUSCLES } from '../seed.js';
import { USER_ID, activeProgram } from '../services.js';
import { toJSON } from '../schema.js';

export default function coachRoutes(db) {
  const r = Router();
  r.get('/coach/hub', (req, res) => res.json(coachHub(db, req.today)));
  r.get('/coach/questions', (req, res) => res.json(QUESTIONS));
  r.get('/coach/ask/:id', (req, res) => { const a = ask(db, req.today, req.params.id, req.query); if (!a) throw notFound('Question inconnue'); res.json(a); });
  r.get('/coach/inbox', (req, res) => res.json(inbox(db, req.today)));
  r.get('/coach/recovery', (req, res) => res.json(recoveryView(db, req.today)));
  r.get('/coach/stagnation', (req, res) => res.json(stagnationReport(db, req.today)));
  r.get('/coach/program-review', (req, res) => res.json(programReview(db, req.today)));
  r.get('/coach/week', (req, res) => res.json(weeklyReview(db, req.today)));
  // Cerveau musculaire : un état par muscle et par articulation, lu par toute l'appli
  r.get('/muscles/state', (req, res) => res.json(muscleState(db, req.today)));
  r.get('/coach/sunday', (req, res) => res.json(sundayReview(db, req.today)));
  // Muscles prioritaires (3 au plus) : chaque nouveau muscle prioritaire garde son point de départ pour la vérification à 4 semaines
  r.post('/muscles/priority', (req, res) => {
    const list = [...new Set((Array.isArray(req.body?.muscles) ? req.body.muscles : []).filter((k) => MUSCLES[k]))];
    if (list.length > 3) throw bad('3 muscles prioritaires au plus');
    db.tx(() => {
      const before = toJSON(db.one('SELECT priority_muscles p FROM profiles WHERE user_id = ?', USER_ID)?.p, []);
      db.run('UPDATE profiles SET priority_muscles = ? WHERE user_id = ?', JSON.stringify(list), USER_ID);
      for (const k of list.filter((x) => !before.includes(x))) db.run("INSERT INTO muscle_adjustments (user_id, muscle, kind, date, details, baseline) VALUES (?,?, 'priorite', ?, ?, ?)", USER_ID, k, req.today, JSON.stringify({}), JSON.stringify(baselineFor(db, req.today, k)));
    });
    res.json(muscleState(db, req.today));
  });
  // Ajustement validé : séries en plus sur un exercice du programme actif, point de départ enregistré
  r.post('/muscles/adjust', (req, res) => {
    const peId = num(req.body?.pe_id, 'exercice', { int: true, min: 1 }); const sets = num(req.body?.sets, 'séries', { int: true, min: 1, max: 10 });
    const muscle = req.body?.muscle; if (!MUSCLES[muscle]) throw bad('Muscle inconnu');
    const prog = activeProgram(db); if (!prog) throw bad('Aucun programme actif');
    const pe = db.one('SELECT pe.id, pe.sets, e.name, pd.name day FROM program_exercises pe JOIN program_days pd ON pd.id = pe.day_id JOIN exercises e ON e.id = pe.exercise_id WHERE pe.id = ? AND pd.program_id = ?', peId, prog.id);
    if (!pe) throw notFound('Exercice introuvable dans le programme actif');
    db.tx(() => {
      db.run('UPDATE program_exercises SET sets = ? WHERE id = ?', sets, peId);
      db.run("INSERT INTO muscle_adjustments (user_id, muscle, kind, date, details, baseline) VALUES (?,?, 'series', ?, ?, ?)", USER_ID, muscle, req.today, JSON.stringify({ pe_id: peId, exercise: pe.name, day: pe.day, from: pe.sets, to: sets }), JSON.stringify(baselineFor(db, req.today, muscle)));
      if (req.body?.key) db.run("INSERT INTO recommendation_log (user_id, rec_key, status, details) VALUES (?,?, 'applied', ?)", USER_ID, String(req.body.key).slice(0, 80), JSON.stringify({ pe_id: peId, sets }));
    });
    res.json(muscleState(db, req.today));
  });
  // Routine de mobilité ou de soin faite (une par jour et par routine)
  r.post('/mobility', (req, res) => {
    const routine = String(req.body?.routine || ''); if (!/^(haut|bas|apres|dos|soin:[a-z_]+)$/.test(routine)) throw bad('Routine inconnue');
    const area = req.body?.area ? oneOf(req.body.area, 'zone', Object.keys(JOINTS)) : (routine.startsWith('soin:') ? oneOf(routine.slice(5), 'zone', Object.keys(JOINTS)) : null);
    const on = req.body?.on !== false;
    db.run('DELETE FROM mobility_logs WHERE user_id = ? AND date = ? AND routine = ?', USER_ID, req.today, routine);
    if (on) db.run('INSERT INTO mobility_logs (user_id, date, routine, area, minutes) VALUES (?,?,?,?,?)', USER_ID, req.today, routine, area, req.body?.minutes ? num(req.body.minutes, 'minutes', { int: true, min: 1, max: 120 }) : null);
    res.json({ ok: true, done: on });
  });
  r.get('/mobility', (req, res) => res.json(db.all('SELECT date, routine, area FROM mobility_logs WHERE user_id = ? AND date >= date(?, \'-27 days\') ORDER BY date DESC', USER_ID, req.today)));
  return r;
}
