import { Router } from 'express';
import { USER_ID, getProfile, getProgram } from '../services.js';
import { deloadStatus } from '../analysis.js';
import { num, str, date, oneOf, bad, notFound, patchRow, addDays, dayKey } from '../util.js';

export default function calendarRoutes(db) {
  const r = Router();
  const get = (id) => { const e = db.one('SELECT * FROM calendar_events WHERE id = ? AND user_id = ?', id, USER_ID); if (!e) throw notFound('Événement introuvable'); return e; };
  const withDay = (id) => db.one('SELECT ce.*, pd.name day_name, pd.focus, pd.code FROM calendar_events ce LEFT JOIN program_days pd ON pd.id = ce.program_day_id WHERE ce.id = ?', id);

  r.get('/calendar', (req, res) => {
    const from = date(req.query.from, 'from'), to = date(req.query.to, 'to');
    res.json({
      events: db.all('SELECT ce.*, pd.name day_name, pd.focus, pd.code FROM calendar_events ce LEFT JOIN program_days pd ON pd.id = ce.program_day_id WHERE ce.user_id = ? AND ce.date BETWEEN ? AND ? ORDER BY ce.date, ce.id', USER_ID, from, to),
      workouts: db.all('SELECT w.id, w.date, w.name, w.duration_sec, pd.focus FROM workouts w LEFT JOIN program_days pd ON pd.id = w.program_day_id WHERE w.user_id = ? AND w.date BETWEEN ? AND ? ORDER BY w.date', USER_ID, from, to),
      cardio: db.all('SELECT id, date, activity, custom_name, duration_min FROM cardio_sessions WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date', USER_ID, from, to),
    });
  });
  r.post('/calendar', (req, res) => {
    const b = req.body;
    const type = oneOf(b.type, 'type', ['workout', 'rest', 'cardio'], { required: true });
    const dayId = num(b.program_day_id, 'jour', { int: true });
    if (type === 'workout' && (!dayId || !db.one('SELECT id FROM program_days WHERE id = ?', dayId))) throw bad('Choisis la séance du programme');
    const info = db.run('INSERT INTO calendar_events (user_id, date, type, program_day_id, cardio_activity, planned_minutes, title, notes) VALUES (?,?,?,?,?,?,?,?)',
      USER_ID, date(b.date), type, type === 'workout' ? dayId : null, type === 'cardio' ? str(b.cardio_activity, 'activité', { max: 40 }) : null,
      num(b.planned_minutes, 'minutes', { min: 1, max: 600, int: true }), str(b.title, 'titre', { max: 80 }), str(b.notes, 'notes', { max: 500 }));
    res.status(201).json(withDay(info.lastInsertRowid));
  });
  r.patch('/calendar/:id', (req, res) => {
    const e = get(req.params.id);
    patchRow(db, 'calendar_events', e.id, req.body, {
      date: (v) => date(v), status: (v) => oneOf(v, 'statut', ['planned', 'done', 'skipped'], { required: true }), notes: (v) => str(v, 'notes', { max: 500 }),
      title: (v) => str(v, 'titre', { max: 80 }), planned_minutes: (v) => num(v, 'minutes', { min: 1, max: 600, int: true }), cardio_activity: (v) => str(v, 'activité', { max: 40 }),
      program_day_id: (v) => { const n = num(v, 'jour', { int: true }); if (n && !db.one('SELECT id FROM program_days WHERE id = ?', n)) throw bad('Jour inconnu'); return n; },
    });
    res.json(withDay(e.id));
  });
  r.delete('/calendar/:id', (req, res) => { const e = get(req.params.id); db.run('DELETE FROM calendar_events WHERE id = ?', e.id); res.json({ ok: true }); });

  // Planifie N semaines à partir du modèle hebdomadaire du profil (n'écrase pas les jours déjà planifiés)
  r.post('/calendar/plan', (req, res) => {
    const from = date(req.body.from, 'from'); const weeks = num(req.body.weeks, 'semaines', { min: 1, max: 12, int: true }) || 4;
    const { schedule } = getProfile(db);
    const byCode = Object.fromEntries(getProgram(db, { withLast: false }).days.map((d) => [d.code, d]));
    let created = 0, skipped = 0;
    db.tx(() => {
      for (let i = 0; i < weeks * 7; i++) {
        const d = addDays(from, i); const code = schedule[dayKey(d)];
        if (!code) continue;
        if (db.one("SELECT id FROM calendar_events WHERE user_id = ? AND date = ? AND type IN ('workout','rest')", USER_ID, d)) { skipped++; continue; }
        if (code === 'rest') db.run("INSERT INTO calendar_events (user_id, date, type, title) VALUES (?,?, 'rest', 'Repos')", USER_ID, d);
        else if (byCode[code]) db.run("INSERT INTO calendar_events (user_id, date, type, program_day_id) VALUES (?,?, 'workout', ?)", USER_ID, d, byCode[code].id);
        else continue;
        created++;
      }
    });
    res.json({ created, skipped });
  });
  // Recaler le programme : « je reprends le <from> avec <jour> ». Les jours de repos du planning type restent à leur place,
  // les jours d'entraînement suivent l'ordre du programme à partir du jour choisi. Seuls les événements à venir non faits sont remplacés.
  r.post('/calendar/reflow', (req, res) => {
    const from = date(req.body.from, 'from'); const weeks = num(req.body.weeks, 'semaines', { min: 1, max: 12, int: true }) || 4;
    const days = getProgram(db, { withLast: false }).days;
    const startIdx = days.findIndex((d) => d.id === Number(req.body.program_day_id));
    if (startIdx === -1) throw bad('Choisis la séance par laquelle tu reprends');
    const { schedule } = getProfile(db);
    const training = Object.values(schedule).filter((c) => c && c !== 'rest').length;
    if (!training) throw bad('Ton planning type n’a aucun jour d’entraînement (Profil)');
    const to = addDays(from, weeks * 7 - 1);
    let k = startIdx, created = 0;
    db.tx(() => {
      const deloadDays = new Set(db.all("SELECT date FROM calendar_events WHERE user_id = ? AND deload = 1 AND date BETWEEN ? AND ?", USER_ID, from, to).map((e) => e.date));
      db.run("DELETE FROM calendar_events WHERE user_id = ? AND date BETWEEN ? AND ? AND status = 'planned' AND type IN ('workout','rest')", USER_ID, from, to);
      for (let i = 0; i < weeks * 7; i++) {
        const d = addDays(from, i); const code = schedule[dayKey(d)];
        if (!code) continue;
        if (db.one("SELECT id FROM calendar_events WHERE user_id = ? AND date = ? AND type = 'workout'", USER_ID, d)) continue; // déjà faite / sautée
        // Le jour de reprise compte toujours comme un jour d'entraînement
        if (code === 'rest' && i > 0) { db.run("INSERT INTO calendar_events (user_id, date, type, title, deload) VALUES (?,?, 'rest', 'Repos', ?)", USER_ID, d, deloadDays.has(d) ? 1 : 0); created++; continue; }
        const day = days[k % days.length]; k++;
        db.run("INSERT INTO calendar_events (user_id, date, type, program_day_id, deload) VALUES (?,?, 'workout', ?, ?)", USER_ID, d, day.id, deloadDays.has(d) ? 1 : 0);
        created++;
      }
    });
    res.json({ created, from, to });
  });

  // Semaine de deload
  r.get('/deload', (req, res) => res.json(deloadStatus(db, req.today)));
  r.post('/deload', (req, res) => {
    const start = date(req.body.start, 'début'); const length = num(req.body.days, 'jours', { min: 4, max: 10, int: true }) || 7;
    const end = addDays(start, length - 1);
    db.tx(() => {
      db.run('UPDATE calendar_events SET deload = 1 WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, start, end);
      // repère même sans séance planifiée ce jour-là
      for (let i = 0; i < length; i++) {
        const d = addDays(start, i);
        if (!db.one('SELECT id FROM calendar_events WHERE user_id = ? AND date = ?', USER_ID, d)) db.run("INSERT INTO calendar_events (user_id, date, type, title, deload) VALUES (?,?, 'rest', 'Deload', 1)", USER_ID, d);
      }
    });
    res.json({ start, end });
  });
  r.delete('/deload', (req, res) => {
    const start = date(req.query.start, 'début'); const end = addDays(start, 9);
    db.tx(() => {
      db.run("DELETE FROM calendar_events WHERE user_id = ? AND deload = 1 AND title = 'Deload' AND type = 'rest' AND date BETWEEN ? AND ?", USER_ID, start, end);
      db.run('UPDATE calendar_events SET deload = 0 WHERE user_id = ? AND date BETWEEN ? AND ?', USER_ID, start, end);
    });
    res.json({ ok: true });
  });
  return r;
}
