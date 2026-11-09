import { Router } from 'express';
import { USER_ID, getProgram, activeProgram, exerciseRow } from '../services.js';
import { num, str, oneOf, bad, notFound, patchRow } from '../util.js';
import { MUSCLES } from '../seed.js';

const units = ['lbs', 'kg'];
const peFields = {
  sets: (v) => { const n = num(v, 'séries', { min: 1, max: 12, int: true }); if (n == null) throw bad('Nombre de séries requis'); return n; },
  reps: (v) => num(v, 'répétitions', { min: 1, max: 100, int: true }),
  reps_note: (v) => str(v, 'note', { max: 60 }),
  target_weight: (v) => num(v, 'charge', { min: 0, max: 2000 }),
  target_weight_max: (v) => num(v, 'charge max', { min: 0, max: 2000 }),
  weight_unit: (v) => oneOf(v, 'unité', units, { required: true }),
  weight_note: (v) => str(v, 'note charge', { max: 60 }),
  rest_seconds: (v) => num(v, 'repos', { min: 0, max: 900, int: true }),
  superset_group: (v) => str(v, 'superset', { max: 8 }),
  notes: (v) => str(v, 'notes', { max: 500 }),
  exercise_id: (v) => num(v, 'exercice', { int: true }),
};

export default function programRoutes(db) {
  const r = Router();
  const dayOf = (id) => {
    const d = db.one('SELECT pd.* FROM program_days pd JOIN programs p ON p.id = pd.program_id WHERE pd.id = ? AND p.user_id = ?', id, USER_ID);
    if (!d) throw notFound('Jour de programme introuvable'); return d;
  };
  const peOf = (id) => {
    const pe = db.one('SELECT pe.* FROM program_exercises pe JOIN program_days pd ON pd.id = pe.day_id JOIN programs p ON p.id = pd.program_id WHERE pe.id = ? AND p.user_id = ?', id, USER_ID);
    if (!pe) throw notFound('Exercice de programme introuvable'); return pe;
  };

  r.get('/exercises', (req, res) => res.json({ exercises: db.all('SELECT * FROM exercises ORDER BY name').map(exerciseRow), muscles: MUSCLES }));
  r.post('/exercises', (req, res) => {
    const b = req.body;
    const muscles = b.muscles && typeof b.muscles === 'object' ? Object.fromEntries(Object.entries(b.muscles).filter(([k, v]) => MUSCLES[k] && Number(v) > 0).map(([k, v]) => [k, Math.min(1, Number(v))])) : {};
    const info = db.run('INSERT INTO exercises (name, pattern, muscles, equipment, kind, default_unit, technique) VALUES (?,?,?,?,?,?,?)',
      str(b.name, 'nom', { required: true, max: 80 }), str(b.pattern, 'schéma', { max: 40 }) || 'custom', JSON.stringify(muscles), str(b.equipment, 'matériel', { max: 60 }),
      oneOf(b.kind, 'type', ['weighted', 'bodyweight', 'assisted']) || 'weighted', oneOf(b.default_unit, 'unité', units) || 'lbs', str(b.technique, 'technique', { max: 500 }));
    res.status(201).json(exerciseRow(db.one('SELECT * FROM exercises WHERE id = ?', info.lastInsertRowid)));
  });

  r.get('/program', (req, res) => res.json(getProgram(db)));

  r.post('/program/days', (req, res) => {
    const prog = activeProgram(db);
    const pos = (db.one('SELECT MAX(position) m FROM program_days WHERE program_id = ?', prog.id).m || 0) + 1;
    const codes = new Set(db.all('SELECT code FROM program_days WHERE program_id = ?', prog.id).map((d) => d.code));
    let n = pos; while (codes.has(`D${n}`)) n++;
    const info = db.run('INSERT INTO program_days (program_id, code, position, name, focus) VALUES (?,?,?,?,?)', prog.id, `D${n}`, pos,
      str(req.body.name, 'nom', { max: 60 }) || `Jour ${pos}`, str(req.body.focus, 'focus', { max: 80 }));
    res.status(201).json(db.one('SELECT * FROM program_days WHERE id = ?', info.lastInsertRowid));
  });
  r.patch('/program/days/:id', (req, res) => {
    const d = dayOf(req.params.id);
    patchRow(db, 'program_days', d.id, req.body, { name: (v) => str(v, 'nom', { required: true, max: 60 }), focus: (v) => str(v, 'focus', { max: 80 }) });
    res.json(db.one('SELECT * FROM program_days WHERE id = ?', d.id));
  });
  r.delete('/program/days/:id', (req, res) => {
    const d = dayOf(req.params.id);
    // On archive (les séances passées gardent leur référence) et on retire les planifications futures
    db.tx(() => { db.run('UPDATE program_days SET archived = 1 WHERE id = ?', d.id); db.run("DELETE FROM calendar_events WHERE program_day_id = ? AND status = 'planned'", d.id); });
    res.json({ ok: true });
  });
  r.post('/program/days/:id/order', (req, res) => {
    const d = dayOf(req.params.id);
    const ids = req.body.ids; if (!Array.isArray(ids)) throw bad('Liste attendue');
    const own = new Set(db.all('SELECT id FROM program_exercises WHERE day_id = ?', d.id).map((x) => x.id));
    if (ids.length !== own.size || !ids.every((i) => own.has(Number(i)))) throw bad('Ordre invalide');
    db.tx(() => ids.forEach((id, i) => db.run('UPDATE program_exercises SET position = ? WHERE id = ?', i + 1, id)));
    res.json({ ok: true });
  });
  r.post('/program/days/:id/exercises', (req, res) => {
    const d = dayOf(req.params.id);
    const ex = db.one('SELECT * FROM exercises WHERE id = ?', num(req.body.exercise_id, 'exercice', { int: true }));
    if (!ex) throw bad('Exercice inconnu');
    const pos = (db.one('SELECT MAX(position) m FROM program_exercises WHERE day_id = ?', d.id).m || 0) + 1;
    const b = { sets: 2, reps: 8, weight_unit: ex.default_unit, ...req.body };
    const info = db.run(`INSERT INTO program_exercises (day_id, exercise_id, position, sets, reps, reps_note, target_weight, weight_unit, weight_note, rest_seconds, superset_group, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, d.id, ex.id, pos, peFields.sets(b.sets), peFields.reps(b.reps), peFields.reps_note(b.reps_note), peFields.target_weight(b.target_weight),
      peFields.weight_unit(b.weight_unit), peFields.weight_note(b.weight_note), peFields.rest_seconds(b.rest_seconds), peFields.superset_group(b.superset_group), peFields.notes(b.notes));
    db.run('UPDATE exercises SET in_library_only = 0 WHERE id = ?', ex.id);
    res.status(201).json(db.one('SELECT * FROM program_exercises WHERE id = ?', info.lastInsertRowid));
  });
  r.patch('/program/exercises/:id', (req, res) => {
    const pe = peOf(req.params.id);
    if (req.body.exercise_id != null && !db.one('SELECT id FROM exercises WHERE id = ?', req.body.exercise_id)) throw bad('Exercice inconnu');
    patchRow(db, 'program_exercises', pe.id, req.body, peFields);
    res.json(db.one('SELECT * FROM program_exercises WHERE id = ?', pe.id));
  });
  r.delete('/program/exercises/:id', (req, res) => {
    const pe = peOf(req.params.id);
    db.run('DELETE FROM program_exercises WHERE id = ?', pe.id);
    res.json({ ok: true });
  });
  return r;
}
