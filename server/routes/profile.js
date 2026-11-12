import { Router } from 'express';
import { USER_ID, getProfile, goalsWithProgress } from '../services.js';
import { PAIN_AREAS } from '../analysis.js';
import { num, str, date, oneOf, bad, notFound, patchRow } from '../util.js';
import { DAY_KEYS } from '../util.js';

export default function profileRoutes(db) {
  const r = Router();
  r.get('/profile', (req, res) => res.json(getProfile(db)));
  r.put('/profile', (req, res) => {
    const b = req.body;
    if (b.name !== undefined) db.run('UPDATE users SET name = ? WHERE id = ?', str(b.name, 'prénom', { max: 60 }) || 'Athlète', USER_ID);
    const codes = new Set(db.all('SELECT code FROM program_days WHERE archived = 0').map((d) => d.code));
    const json = (fn) => (v) => JSON.stringify(fn(v));
    const fields = {
      onboarded: (v) => (v ? 1 : 0),
      goal: (v) => oneOf(v, 'objectif', ['hypertrophie', 'force', 'perte_de_gras', 'recomposition', 'sante']),
      goals_text: (v) => str(v, 'objectifs', { max: 1000 }),
      level: (v) => oneOf(v, 'niveau', ['debutant', 'intermediaire', 'avance']),
      sessions_per_week: (v) => num(v, 'séances', { min: 1, max: 7, int: true }),
      session_minutes: (v) => num(v, 'durée', { min: 15, max: 240, int: true }),
      available_days: json((v) => { if (!Array.isArray(v) || !v.every((d) => DAY_KEYS.includes(d))) throw bad('Jours invalides'); return v; }),
      schedule: json((v) => {
        if (!v || typeof v !== 'object') throw bad('Planning invalide');
        const out = {}; for (const k of DAY_KEYS) { const c = v[k] || 'rest'; if (c !== 'rest' && !codes.has(c)) throw bad(`Séance inconnue : ${c}`); out[k] = c; } return out;
      }),
      weight_unit: (v) => oneOf(v, 'unité', ['lbs', 'kg'], { required: true }),
      default_rest_seconds: (v) => num(v, 'repos', { min: 15, max: 600, int: true }) ?? 90,
      preferences: (v) => str(v, 'préférences', { max: 1000 }),
      sport_history: (v) => str(v, 'historique', { max: 2000 }),
      birth_year: (v) => num(v, 'année de naissance', { min: 1920, max: 2020, int: true }),
      sex: (v) => oneOf(v, 'sexe', ['homme', 'femme', 'autre']),
      height_cm: (v) => num(v, 'taille', { min: 100, max: 250 }),
      body_weight_kg: (v) => num(v, 'poids', { min: 30, max: 300 }),
      sleep_hours: (v) => num(v, 'sommeil', { min: 0, max: 14 }),
      cardio_goal: (v) => oneOf(v, 'objectif cardio', ['perte_de_poids', 'endurance', 'sante_cardio', 'recuperation']),
      cardio_level: (v) => oneOf(v, 'niveau cardio', ['debutant', 'intermediaire', 'avance']),
      cardio_sessions_target: (v) => num(v, 'séances cardio', { min: 0, max: 7, int: true }),
      cardio_minutes_target: (v) => num(v, 'minutes cardio', { min: 5, max: 180, int: true }),
      cardio_preferred: json((v) => { if (!Array.isArray(v)) throw bad('Activités invalides'); return v.slice(0, 7).map(String); }),
      limitations: (v) => str(v, 'limitations', { max: 1000 }),
    };
    const sets = []; const vals = [];
    for (const [k, fn] of Object.entries(fields)) if (Object.prototype.hasOwnProperty.call(b, k)) { sets.push(`${k} = ?`); vals.push(fn(b[k])); }
    if (sets.length) db.run(`UPDATE profiles SET ${sets.join(', ')}, updated_at = datetime('now') WHERE user_id = ?`, ...vals, USER_ID);
    res.json(getProfile(db));
  });

  // Mesures corporelles (facultatives)
  r.get('/body-metrics', (req, res) => res.json(db.all('SELECT * FROM body_metrics WHERE user_id = ? ORDER BY date DESC, id DESC', USER_ID)));
  r.post('/body-metrics', (req, res) => {
    const b = req.body;
    const w = num(b.weight_kg, 'poids', { min: 30, max: 300 }), bf = num(b.body_fat_pct, 'masse grasse', { min: 2, max: 70 }), wc = num(b.waist_cm, 'tour de taille', { min: 40, max: 250 }); const nk = num(b.neck_cm, 'tour de cou', { min: 20, max: 80 }), hp = num(b.hip_cm, 'tour de hanches', { min: 50, max: 250 });
    if (w == null && bf == null && wc == null && nk == null && hp == null) throw bad('Renseigne au moins une mesure');
    const info = db.run('INSERT INTO body_metrics (user_id, date, weight_kg, body_fat_pct, waist_cm, neck_cm, hip_cm, notes) VALUES (?,?,?,?,?,?,?,?)', USER_ID, date(b.date), w, bf, wc, nk, hp, str(b.notes, 'notes', { max: 300 }));
    res.status(201).json(db.one('SELECT * FROM body_metrics WHERE id = ?', info.lastInsertRowid));
  });
  r.delete('/body-metrics/:id', (req, res) => {
    if (!db.run('DELETE FROM body_metrics WHERE id = ? AND user_id = ?', req.params.id, USER_ID).changes) throw notFound(); res.json({ ok: true });
  });

  // Douleurs
  r.get('/pains', (req, res) => res.json({ areas: Object.fromEntries(Object.entries(PAIN_AREAS).map(([k, v]) => [k, v.label])), reports: db.all('SELECT * FROM pain_reports WHERE user_id = ? ORDER BY resolved, date DESC', USER_ID) }));
  r.post('/pains', (req, res) => {
    const b = req.body;
    const info = db.run('INSERT INTO pain_reports (user_id, date, area, intensity, notes) VALUES (?,?,?,?,?)', USER_ID, date(b.date), oneOf(b.area, 'zone', Object.keys(PAIN_AREAS), { required: true }),
      num(b.intensity, 'intensité', { min: 1, max: 10, int: true }) ?? (() => { throw bad('Intensité requise'); })(), str(b.notes, 'notes', { max: 500 }));
    res.status(201).json(db.one('SELECT * FROM pain_reports WHERE id = ?', info.lastInsertRowid));
  });
  r.patch('/pains/:id', (req, res) => {
    const p = db.one('SELECT id FROM pain_reports WHERE id = ? AND user_id = ?', req.params.id, USER_ID); if (!p) throw notFound();
    patchRow(db, 'pain_reports', p.id, req.body, { resolved: (v) => (v ? 1 : 0), intensity: (v) => num(v, 'intensité', { min: 1, max: 10, int: true }), notes: (v) => str(v, 'notes', { max: 500 }) });
    res.json(db.one('SELECT * FROM pain_reports WHERE id = ?', p.id));
  });
  r.delete('/pains/:id', (req, res) => { if (!db.run('DELETE FROM pain_reports WHERE id = ? AND user_id = ?', req.params.id, USER_ID).changes) throw notFound(); res.json({ ok: true }); });

  // Objectifs
  const goalFields = {
    type: (v) => oneOf(v, 'type', ['charge', 'seances_semaine', 'cardio_minutes_semaine', 'poids_corporel', 'libre'], { required: true }),
    title: (v) => str(v, 'titre', { required: true, max: 100 }),
    exercise_id: (v) => num(v, 'exercice', { int: true }),
    start_value: (v) => num(v, 'valeur de départ'), target_value: (v) => num(v, 'cible'), current_value: (v) => num(v, 'valeur actuelle'),
    unit: (v) => str(v, 'unité', { max: 20 }), deadline: (v) => date(v, 'échéance', { required: false }),
    status: (v) => oneOf(v, 'statut', ['actif', 'atteint', 'abandonne'], { required: true }),
  };
  r.get('/goals', (req, res) => res.json(goalsWithProgress(db, req.today)));
  r.post('/goals', (req, res) => {
    const b = { status: 'actif', ...req.body };
    if (b.type === 'charge' && !b.exercise_id) throw bad('Choisis l’exercice concerné');
    const keys = Object.keys(goalFields).filter((k) => b[k] !== undefined);
    const info = db.run(`INSERT INTO goals (user_id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`, USER_ID, ...keys.map((k) => goalFields[k](b[k])));
    res.status(201).json(goalsWithProgress(db, req.today).find((g) => g.id === Number(info.lastInsertRowid)));
  });
  r.patch('/goals/:id', (req, res) => {
    const g = db.one('SELECT id FROM goals WHERE id = ? AND user_id = ?', req.params.id, USER_ID); if (!g) throw notFound();
    patchRow(db, 'goals', g.id, req.body, goalFields);
    res.json(goalsWithProgress(db, req.today).find((x) => x.id === g.id));
  });
  r.delete('/goals/:id', (req, res) => { if (!db.run('DELETE FROM goals WHERE id = ? AND user_id = ?', req.params.id, USER_ID).changes) throw notFound(); res.json({ ok: true }); });
  return r;
}
