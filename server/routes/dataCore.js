// Export / import des données : commun au serveur et à la version autonome (navigateur)
import { USER_ID } from '../services.js';
import { bad } from '../util.js';

export const TABLES = ['users', 'profiles', 'exercises', 'programs', 'program_days', 'program_exercises', 'program_cardio', 'workouts', 'workout_sets', 'cardio_sessions', 'goals', 'calendar_events', 'body_metrics', 'nutrition_plans', 'pain_reports', 'recommendation_log'];

const csv = (rows) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => (v == null ? '' : /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return '\uFEFF' + [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
};

export function addDataCoreRoutes(r, db, { beforeImport = () => null } = {}) {
  r.get('/data/export', (req, res) => {
    const data = Object.fromEntries(TABLES.map((t) => [t, db.all(`SELECT * FROM ${t}`)]));
    res.setHeader('Content-Disposition', `attachment; filename="gymtrack-export-${req.today}.json"`);
    res.json({ app: 'gymtrack-ai', version: 1, exported_at: new Date().toISOString(), data });
  });
  r.get('/data/export.csv', (req, res) => {
    const type = req.query.type;
    let rows;
    if (type === 'cardio') rows = db.all('SELECT date, activity, custom_name, duration_min, distance_km, speed_kmh, incline_pct, calories, avg_hr, max_hr, rpe, notes FROM cardio_sessions WHERE user_id = ? ORDER BY date', USER_ID);
    else if (type === 'workouts') rows = db.all('SELECT id, date, name, duration_sec, rpe, notes FROM workouts WHERE user_id = ? ORDER BY date', USER_ID);
    else rows = db.all(`SELECT w.date, w.name seance, e.name exercice, s.set_index serie, s.weight charge, s.weight_unit unite, s.reps repetitions, s.target_reps objectif, s.completed validee
      FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id WHERE w.user_id = ? ORDER BY w.date, w.id, s.position, s.set_index`, USER_ID);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gymtrack-${type || 'series'}-${req.today}.csv"`);
    res.send(csv(rows));
  });
  // Restauration complète depuis un export JSON (une sauvegarde automatique est faite avant)
  r.post('/data/import', (req, res) => {
    const body = req.body;
    if (body?.app !== 'gymtrack-ai' || !body.data || typeof body.data !== 'object') throw bad('Fichier non reconnu : utilise un export GymTrack AI (.json)');
    const before = beforeImport();
    db.exec('PRAGMA foreign_keys = OFF');
    try {
      db.tx(() => {
        for (const t of [...TABLES].reverse()) db.exec(`DELETE FROM ${t}`);
        for (const t of TABLES) {
          const rows = body.data[t]; if (!Array.isArray(rows)) continue;
          const cols = db.all(`PRAGMA table_info(${t})`).map((c) => c.name);
          for (const row of rows) {
            const keys = Object.keys(row).filter((k) => cols.includes(k)); if (!keys.length) continue;
            db.run(`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, ...keys.map((k) => (row[k] !== null && typeof row[k] === 'object' ? JSON.stringify(row[k]) : row[k])));
          }
        }
        if (!db.one('SELECT id FROM users WHERE id = ?', USER_ID)) throw bad('Export invalide : utilisateur manquant');
        const fk = db.all('PRAGMA foreign_key_check'); if (fk.length) throw bad('Export incohérent (références cassées)');
      });
    } finally { db.exec('PRAGMA foreign_keys = ON'); }
    res.json({ ok: true, backup_before_import: before });
  });
}
