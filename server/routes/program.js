import { Router } from 'express';
import { USER_ID, getProgram, activeProgram, exerciseRow, CARDIO_TYPES, getProfile, exerciseBests } from '../services.js';
import { num, str, oneOf, bad, notFound, patchRow } from '../util.js';
import { MUSCLES } from '../seed.js';
import { templateList, applyTemplate, activateProgram } from '../templates.js';

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

const pcFields = {
  activity: (v) => oneOf(v, 'activité', Object.keys(CARDIO_TYPES), { required: true }),
  custom_name: (v) => str(v, 'nom', { max: 60 }),
  duration_min: (v) => { const n = num(v, 'durée', { min: 1, max: 300 }); if (n == null) throw bad('Durée requise'); return n; },
  speed_kmh: (v) => num(v, 'vitesse', { min: 0, max: 40 }),
  incline_pct: (v) => num(v, 'inclinaison', { min: -5, max: 30 }),
  placement: (v) => oneOf(v, 'moment', ['debut', 'fin'], { required: true }),
  notes: (v) => str(v, 'notes', { max: 300 }),
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
    // Exercice de la bibliothèque illustrée : créé une seule fois puis réutilisé
    const libId = str(b.lib_id, 'bibliothèque', { max: 80 });
    if (libId) { const ex = db.one('SELECT * FROM exercises WHERE lib_id = ? ORDER BY id LIMIT 1', libId); if (ex) return res.json(exerciseRow(ex)); }
    const muscles = b.muscles && typeof b.muscles === 'object' ? Object.fromEntries(Object.entries(b.muscles).filter(([k, v]) => MUSCLES[k] && Number(v) > 0).map(([k, v]) => [k, Math.min(1, Number(v))])) : {};
    const info = db.run('INSERT INTO exercises (name, pattern, muscles, equipment, kind, default_unit, technique, lib_id) VALUES (?,?,?,?,?,?,?,?)',
      str(b.name, 'nom', { required: true, max: 80 }), str(b.pattern, 'schéma', { max: 40 }) || 'custom', JSON.stringify(muscles), str(b.equipment, 'matériel', { max: 60 }),
      oneOf(b.kind, 'type', ['weighted', 'bodyweight', 'assisted']) || 'weighted', oneOf(b.default_unit, 'unité', units) || 'lbs', str(b.technique, 'technique', { max: 500 }), libId || null);
    res.status(201).json(exerciseRow(db.one('SELECT * FROM exercises WHERE id = ?', info.lastInsertRowid)));
  });

  // Modèles de programmes et programmes enregistrés
  r.get('/programs', (req, res) => res.json({
    templates: templateList(),
    programs: db.all('SELECT p.*, (SELECT COUNT(*) FROM program_days d WHERE d.program_id = p.id AND d.archived = 0) days FROM programs p WHERE user_id = ? ORDER BY active DESC, id DESC', USER_ID),
  }));
  r.post('/programs/template', (req, res) => { const id = applyTemplate(db, req.today, str(req.body.key, 'modèle', { required: true, max: 40 })); res.status(201).json({ id }); });
  r.post('/programs/:id/activate', (req, res) => { activateProgram(db, req.today, Number(req.params.id)); res.json({ ok: true }); });

  // Programme + liens avec le calendrier (prochaine date prévue, dernière séance faite) et le planning type
  r.get('/program', (req, res) => {
    const p = getProgram(db); const bests = exerciseBests(db);
    for (const d of p.days) {
      // Meilleures perfs de chaque exercice : la séance détecte les records en direct
      for (const e of d.exercises) { const b = bests.get(e.exercise_id); e.best = b ? { top_lbs: b.top_lbs, e1rm_lbs: b.e1rm_lbs } : null; }
      d.next_date = db.one("SELECT MIN(date) d FROM calendar_events WHERE user_id = ? AND type = 'workout' AND status = 'planned' AND program_day_id = ? AND date >= ?", USER_ID, d.id, req.today).d;
      d.last_date = db.one('SELECT MAX(date) d FROM workouts WHERE user_id = ? AND program_day_id = ?', USER_ID, d.id).d;
      d.total_sets = d.exercises.reduce((a, e) => a + (e.sets || 0), 0);
      // Durée estimée : ~40 s par série + repos prévu, + cardio du jour
      const rest = getProfile(db).default_rest_seconds || 90;
      d.est_minutes = Math.round((d.exercises.reduce((a, e) => a + (e.sets || 0) * (40 + (e.rest_seconds || rest)), 0)) / 60 + d.cardio.reduce((a, c) => a + (c.duration_min || 0), 0));
      const mus = {}; for (const e of d.exercises) for (const [k, v] of Object.entries(e.muscles || {})) mus[k] = (mus[k] || 0) + v * (e.sets || 0);
      d.top_muscles = Object.entries(mus).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => MUSCLES[k] || k);
    }
    res.json({ ...p, schedule: getProfile(db).schedule });
  });

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
  // Blocs cardio d'un jour de programme
  const pcOf = (id) => {
    const pc = db.one('SELECT pc.* FROM program_cardio pc JOIN program_days pd ON pd.id = pc.day_id JOIN programs p ON p.id = pd.program_id WHERE pc.id = ? AND p.user_id = ?', id, USER_ID);
    if (!pc) throw notFound('Bloc cardio introuvable'); return pc;
  };
  r.post('/program/days/:id/cardio', (req, res) => {
    const d = dayOf(req.params.id);
    const b = { placement: 'fin', ...req.body };
    const info = db.run('INSERT INTO program_cardio (day_id, activity, custom_name, duration_min, speed_kmh, incline_pct, placement, notes) VALUES (?,?,?,?,?,?,?,?)',
      d.id, pcFields.activity(b.activity), pcFields.custom_name(b.custom_name), pcFields.duration_min(b.duration_min), pcFields.speed_kmh(b.speed_kmh), pcFields.incline_pct(b.incline_pct), pcFields.placement(b.placement), pcFields.notes(b.notes));
    res.status(201).json(db.one('SELECT * FROM program_cardio WHERE id = ?', info.lastInsertRowid));
  });
  r.patch('/program/cardio/:id', (req, res) => {
    const pc = pcOf(req.params.id);
    patchRow(db, 'program_cardio', pc.id, req.body, pcFields);
    res.json(db.one('SELECT * FROM program_cardio WHERE id = ?', pc.id));
  });
  r.delete('/program/cardio/:id', (req, res) => {
    const pc = pcOf(req.params.id);
    db.run('DELETE FROM program_cardio WHERE id = ?', pc.id);
    res.json({ ok: true });
  });
  return r;
}
