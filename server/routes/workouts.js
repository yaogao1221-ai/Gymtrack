import { Router } from 'express';
import { USER_ID, workoutSummary, exerciseBests } from '../services.js';
import { e1rm, toLbs, r1 } from '../formulas.js';
import { num, str, date, bad, notFound, patchRow } from '../util.js';

export default function workoutRoutes(db) {
  const r = Router();
  const get = (id) => { const w = db.one('SELECT * FROM workouts WHERE id = ? AND user_id = ?', id, USER_ID); if (!w) throw notFound('Séance introuvable'); return w; };
  const full = (w) => {
    const sets = db.all(`SELECT s.*, e.name exercise_name, e.kind FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id WHERE s.workout_id = ? ORDER BY s.position, s.set_index`, w.id);
    const exercises = [];
    for (const s of sets) {
      let g = exercises.find((x) => x.position === s.position && x.exercise_id === s.exercise_id);
      if (!g) { g = { exercise_id: s.exercise_id, name: s.exercise_name, kind: s.kind, position: s.position, sets: [] }; exercises.push(g); }
      g.sets.push(s);
    }
    return { ...workoutSummary(db, w), exercises, review: review(w, exercises) };
  };
  // Bilan de séance : records battus et comparaison avec la dernière fois que ce jour du programme a été fait
  const review = (w, exercises) => {
    const bests = exerciseBests(db, { date: w.date, id: w.id });
    const records = [];
    for (const ex of exercises) {
      const b = bests.get(ex.exercise_id); if (!b) continue;
      const done = ex.sets.filter((x) => x.completed && x.weight > 0);
      if (!done.length) continue;
      const vals = done.map((x) => toLbs(x.weight, x.weight_unit));
      const top = ex.kind === 'assisted' ? Math.min(...vals) : Math.max(...vals);
      const best1 = ex.kind === 'assisted' ? null : Math.max(...done.map((x) => e1rm(toLbs(x.weight, x.weight_unit), x.reps) || 0));
      const topSet = done[vals.indexOf(top)];
      if (ex.kind === 'assisted' ? top < b.top_lbs - 1e-9 : top > b.top_lbs + 1e-9) records.push({ name: ex.name, type: ex.kind === 'assisted' ? 'assistance' : 'charge', value: topSet.weight, unit: topSet.weight_unit, reps: topSet.reps });
      else if (best1 && b.e1rm_lbs && best1 > b.e1rm_lbs + 0.5) records.push({ name: ex.name, type: '1rm', value: r1(topSet.weight_unit === 'kg' ? best1 / 2.20462 : best1), unit: topSet.weight_unit });
    }
    const prev = w.program_day_id ? db.one('SELECT * FROM workouts WHERE user_id = ? AND program_day_id = ? AND (date < ? OR (date = ? AND id < ?)) ORDER BY date DESC, id DESC LIMIT 1', USER_ID, w.program_day_id, w.date, w.date, w.id) : null;
    let compare = null;
    if (prev) {
      const a = workoutSummary(db, w); const p = workoutSummary(db, prev);
      compare = { date: prev.date, volume_lbs: p.volume_lbs, volume_delta: a.volume_lbs - p.volume_lbs, sets_delta: a.sets_done - p.sets_done, duration_delta: (a.duration_sec || 0) - (p.duration_sec || 0) };
    }
    return { records, compare, first_time: !prev && !!w.program_day_id };
  };

  // Marque l'événement planifié du jour comme fait (de préférence celui du même jour de programme)
  const linkEvent = (wid, d, dayId) => {
    const ev = db.one(`SELECT id FROM calendar_events WHERE user_id = ? AND type = 'workout' AND status = 'planned' AND date = ? ORDER BY (program_day_id = ?) DESC LIMIT 1`, USER_ID, d, dayId);
    if (ev) db.run("UPDATE calendar_events SET status = 'done', workout_id = ? WHERE id = ?", wid, ev.id);
  };

  r.get('/workouts', (req, res) => {
    const from = req.query.from || '0000-01-01', to = req.query.to || '9999-12-31';
    const limit = Math.min(500, Number(req.query.limit) || 100);
    const rows = db.all(`SELECT w.*, pd.focus FROM workouts w LEFT JOIN program_days pd ON pd.id = w.program_day_id WHERE w.user_id = ? AND w.date BETWEEN ? AND ? ORDER BY w.date DESC, w.id DESC LIMIT ?`, USER_ID, from, to, limit);
    res.json(rows.map((w) => workoutSummary(db, w)));
  });
  r.get('/workouts/:id', (req, res) => res.json(full(get(req.params.id))));

  // Enregistrement d'une séance terminée (idempotent via client_id pour la synchro hors ligne)
  r.post('/workouts', (req, res) => {
    const b = req.body;
    if (b.client_id) { const ex = db.one('SELECT * FROM workouts WHERE client_id = ?', String(b.client_id)); if (ex) return res.json(full(ex)); }
    if (!Array.isArray(b.sets) || !b.sets.length) throw bad('La séance ne contient aucune série');
    const d = date(b.date);
    const dayId = num(b.program_day_id, 'jour', { int: true });
    if (dayId && !db.one('SELECT id FROM program_days WHERE id = ?', dayId)) throw bad('Jour de programme inconnu');
    const id = db.tx(() => {
      const wid = Number(db.run(`INSERT INTO workouts (user_id, client_id, program_day_id, name, date, started_at, ended_at, duration_sec, rpe, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        USER_ID, b.client_id ? String(b.client_id).slice(0, 64) : null, dayId, str(b.name, 'nom', { required: true, max: 80 }), d, str(b.started_at, 'début', { max: 40 }), str(b.ended_at, 'fin', { max: 40 }),
        num(b.duration_sec, 'durée', { min: 0, max: 86400, int: true }) || 0, num(b.rpe, 'RPE', { min: 1, max: 10 }), str(b.notes, 'notes', { max: 2000 })).lastInsertRowid);
      const ins = db.prepare(`INSERT INTO workout_sets (workout_id, exercise_id, program_exercise_id, position, set_index, weight, weight_unit, reps, target_reps, completed) VALUES (?,?,?,?,?,?,?,?,?,?)`);
      for (const s of b.sets) {
        const exId = num(s.exercise_id, 'exercice', { int: true });
        if (!exId || !db.one('SELECT id FROM exercises WHERE id = ?', exId)) throw bad('Exercice inconnu dans la séance');
        const peId = num(s.program_exercise_id, 'exercice programme', { int: true });
        ins.run(wid, exId, peId && db.one('SELECT id FROM program_exercises WHERE id = ?', peId) ? peId : null, num(s.position, 'position', { int: true, min: 0 }) || 0,
          num(s.set_index, 'série', { int: true, min: 1, max: 50 }) || 1, num(s.weight, 'charge', { min: 0, max: 2000 }), s.weight_unit === 'kg' ? 'kg' : 'lbs',
          num(s.reps, 'répétitions', { int: true, min: 0, max: 500 }), num(s.target_reps, 'objectif', { int: true, min: 0, max: 500 }), s.completed === false ? 0 : 1);
      }
      linkEvent(wid, d, dayId);
      return wid;
    });
    res.status(201).json(full(get(id)));
  });

  r.patch('/workouts/:id', (req, res) => {
    const w = get(req.params.id);
    if (req.body.date !== undefined && date(req.body.date) !== w.date) {
      // Séance déplacée : l'ancien jour du calendrier redevient « prévu », le nouveau est marqué fait
      db.tx(() => { db.run("UPDATE calendar_events SET status = 'planned', workout_id = NULL WHERE workout_id = ?", w.id); db.run('UPDATE workouts SET date = ? WHERE id = ?', date(req.body.date), w.id); linkEvent(w.id, date(req.body.date), w.program_day_id); });
    }
    patchRow(db, 'workouts', w.id, req.body, { name: (v) => str(v, 'nom', { required: true, max: 80 }), notes: (v) => str(v, 'notes', { max: 2000 }), rpe: (v) => num(v, 'RPE', { min: 1, max: 10 }), date: (v) => date(v), duration_sec: (v) => num(v, 'durée', { min: 0, max: 86400, int: true }) || 0 });
    res.json(full(get(w.id)));
  });
  r.patch('/workouts/:id/sets/:setId', (req, res) => {
    const w = get(req.params.id);
    const s = db.one('SELECT id FROM workout_sets WHERE id = ? AND workout_id = ?', req.params.setId, w.id); if (!s) throw notFound('Série introuvable');
    patchRow(db, 'workout_sets', s.id, req.body, { weight: (v) => num(v, 'charge', { min: 0, max: 2000 }), reps: (v) => num(v, 'répétitions', { int: true, min: 0, max: 500 }), completed: (v) => (v ? 1 : 0) });
    res.json(full(get(w.id)));
  });
  r.delete('/workouts/:id', (req, res) => {
    const w = get(req.params.id);
    db.tx(() => { db.run("UPDATE calendar_events SET status = 'planned', workout_id = NULL WHERE workout_id = ?", w.id); db.run('DELETE FROM workouts WHERE id = ?', w.id); });
    res.json({ ok: true });
  });
  return r;
}
