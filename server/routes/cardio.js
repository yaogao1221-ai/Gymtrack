import { Router } from 'express';
import { USER_ID, CARDIO_TYPES, estimateCalories, currentBodyWeight } from '../services.js';
import { num, str, date, oneOf, bad, notFound } from '../util.js';

export default function cardioRoutes(db) {
  const r = Router();
  const norm = (b) => {
    const x = {
      activity: oneOf(b.activity, 'activité', Object.keys(CARDIO_TYPES), { required: true }),
      custom_name: str(b.custom_name, 'nom', { max: 60 }),
      date: date(b.date),
      duration_min: num(b.duration_min, 'durée', { min: 1, max: 600 }),
      distance_km: num(b.distance_km, 'distance', { min: 0, max: 500 }),
      speed_kmh: num(b.speed_kmh, 'vitesse', { min: 0, max: 80 }),
      incline_pct: num(b.incline_pct, 'inclinaison', { min: -10, max: 40 }),
      calories: num(b.calories, 'calories', { min: 0, max: 10000 }),
      avg_hr: num(b.avg_hr, 'FC moyenne', { min: 30, max: 240, int: true }),
      max_hr: num(b.max_hr, 'FC max', { min: 30, max: 240, int: true }),
      rpe: num(b.rpe, 'intensité', { min: 1, max: 10 }),
      notes: str(b.notes, 'notes', { max: 1000 }),
    };
    if (!x.duration_min) throw bad('La durée est requise');
    if (x.activity === 'autre' && !x.custom_name) throw bad('Donne un nom à l’activité personnalisée');
    if (x.speed_kmh == null && x.distance_km) x.speed_kmh = Math.round(x.distance_km / (x.duration_min / 60) * 10) / 10;
    if (x.distance_km == null && x.speed_kmh) x.distance_km = Math.round(x.speed_kmh * x.duration_min / 60 * 100) / 100;
    x.calories_estimated = x.calories == null ? 1 : 0;
    if (x.calories == null) x.calories = estimateCalories(x, currentBodyWeight(db));
    return x;
  };
  const get = (id) => { const c = db.one('SELECT * FROM cardio_sessions WHERE id = ? AND user_id = ?', id, USER_ID); if (!c) throw notFound('Séance cardio introuvable'); return c; };

  r.get('/cardio/types', (req, res) => res.json(CARDIO_TYPES));
  r.post('/cardio/estimate', (req, res) => {
    const bw = currentBodyWeight(db);
    res.json({ calories: estimateCalories(req.body, bw), body_weight_kg: bw, default_weight_used: !bw });
  });
  r.get('/cardio', (req, res) => {
    res.json(db.all('SELECT * FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, id DESC LIMIT ?', USER_ID, req.query.from || '0000-01-01', req.query.to || '9999-12-31', Math.min(500, Number(req.query.limit) || 100)));
  });
  r.post('/cardio', (req, res) => {
    if (req.body.client_id) { const ex = db.one('SELECT * FROM cardio_sessions WHERE client_id = ?', String(req.body.client_id)); if (ex) return res.json(ex); }
    const x = norm(req.body);
    const id = db.tx(() => {
      const cid = Number(db.run(`INSERT INTO cardio_sessions (user_id, client_id, activity, custom_name, date, duration_min, distance_km, speed_kmh, incline_pct, calories, calories_estimated, avg_hr, max_hr, rpe, notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, USER_ID, req.body.client_id ? String(req.body.client_id).slice(0, 64) : null, x.activity, x.custom_name, x.date, x.duration_min, x.distance_km, x.speed_kmh, x.incline_pct, x.calories, x.calories_estimated, x.avg_hr, x.max_hr, x.rpe, x.notes).lastInsertRowid);
      const ev = db.one("SELECT id FROM calendar_events WHERE user_id = ? AND type = 'cardio' AND status = 'planned' AND date = ? LIMIT 1", USER_ID, x.date);
      if (ev) db.run("UPDATE calendar_events SET status = 'done', cardio_id = ? WHERE id = ?", cid, ev.id);
      return cid;
    });
    res.status(201).json(get(id));
  });
  r.put('/cardio/:id', (req, res) => {
    const c = get(req.params.id); const x = norm(req.body);
    db.run(`UPDATE cardio_sessions SET activity=?, custom_name=?, date=?, duration_min=?, distance_km=?, speed_kmh=?, incline_pct=?, calories=?, calories_estimated=?, avg_hr=?, max_hr=?, rpe=?, notes=? WHERE id = ?`,
      x.activity, x.custom_name, x.date, x.duration_min, x.distance_km, x.speed_kmh, x.incline_pct, x.calories, x.calories_estimated, x.avg_hr, x.max_hr, x.rpe, x.notes, c.id);
    res.json(get(c.id));
  });
  r.delete('/cardio/:id', (req, res) => {
    const c = get(req.params.id);
    db.tx(() => { db.run("UPDATE calendar_events SET status = 'planned', cardio_id = NULL WHERE cardio_id = ?", c.id); db.run('DELETE FROM cardio_sessions WHERE id = ?', c.id); });
    res.json({ ok: true });
  });
  return r;
}
