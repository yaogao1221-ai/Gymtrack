import { Router } from 'express';
import { analyse, cardioPlan, recoveryScore } from '../analysis.js';
import { USER_ID, getProfile, getProgram } from '../services.js';
import { bad, str } from '../util.js';

export default function analysisRoutes(db) {
  const r = Router();
  r.get('/analysis', (req, res) => res.json(analyse(db, req.today)));

  // Validation explicite d'une recommandation : seule voie qui modifie le programme
  r.post('/analysis/apply', (req, res) => {
    const key = str(req.body.key, 'clé', { required: true, max: 120 });
    const report = analyse(db, req.today);
    const prog = report.progression.find((p) => p.key === key);
    const sug = report.suggestions.find((s) => s.key === key);
    db.tx(() => {
      if (prog) {
        if (!prog.patch) throw bad('Cette recommandation est informative');
        const cols = Object.keys(prog.patch);
        if (prog.cardio_id) db.run(`UPDATE program_cardio SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...cols.map((c) => prog.patch[c]), prog.cardio_id);
        else db.run(`UPDATE program_exercises SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...cols.map((c) => prog.patch[c]), prog.program_exercise_id);
      } else if (sug) {
        const pos = (db.one('SELECT MAX(position) m FROM program_exercises WHERE day_id = ?', sug.day_id).m || 0) + 1;
        const ex = db.one('SELECT default_unit FROM exercises WHERE id = ?', sug.exercise_id);
        db.run('INSERT INTO program_exercises (day_id, exercise_id, position, sets, reps, weight_unit) VALUES (?,?,?,?,?,?)', sug.day_id, sug.exercise_id, pos, sug.sets, sug.reps, ex.default_unit);
        db.run('UPDATE exercises SET in_library_only = 0 WHERE id = ?', sug.exercise_id);
      } else throw bad('Recommandation introuvable ou déjà traitée');
      db.run("INSERT INTO recommendation_log (user_id, rec_key, status, details) VALUES (?,?, 'applied', ?)", USER_ID, key, JSON.stringify(prog || sug));
    });
    res.json({ ok: true });
  });
  r.post('/analysis/dismiss', (req, res) => {
    const key = str(req.body.key, 'clé', { required: true, max: 120 });
    db.run("INSERT INTO recommendation_log (user_id, rec_key, status) VALUES (?,?, 'dismissed')", USER_ID, key);
    res.json({ ok: true });
  });
  r.get('/analysis/log', (req, res) => res.json(db.all('SELECT * FROM recommendation_log WHERE user_id = ? ORDER BY id DESC LIMIT 100', USER_ID)));

  r.get('/analysis/cardio-plan', (req, res) => {
    const profile = getProfile(db);
    res.json(cardioPlan(db, profile, req.today, recoveryScore(db, profile, req.today), getProgram(db, { withLast: false }).days));
  });
  r.post('/analysis/cardio-plan/schedule', (req, res) => {
    const profile = getProfile(db);
    const plan = cardioPlan(db, profile, req.today, recoveryScore(db, profile, req.today), getProgram(db, { withLast: false }).days);
    let created = 0;
    db.tx(() => {
      for (const s of plan.this_week) {
        if (db.one("SELECT id FROM calendar_events WHERE user_id = ? AND date = ? AND type = 'cardio'", USER_ID, s.date)) continue;
        db.run("INSERT INTO calendar_events (user_id, date, type, cardio_activity, planned_minutes, title, notes) VALUES (?,?, 'cardio', ?,?,?,?)", USER_ID, s.date, s.activity, s.minutes, 'Cardio', s.intensity);
        created++;
      }
    });
    res.json({ created });
  });
  return r;
}
