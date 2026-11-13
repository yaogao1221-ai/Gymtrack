// Schéma et helpers partagés entre le serveur Node (node:sqlite) et la version autonome (sql.js dans le navigateur)
import { seed, SEED_LIB } from './seed.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Athlète',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Profil : objectifs, niveau, disponibilités, préférences, historique sportif, objectifs cardio
CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  onboarded INTEGER NOT NULL DEFAULT 0,
  goal TEXT,                    -- hypertrophie | force | perte_de_gras | recomposition | sante
  goals_text TEXT,
  level TEXT,                   -- debutant | intermediaire | avance
  sessions_per_week INTEGER DEFAULT 5,
  session_minutes INTEGER DEFAULT 60,
  available_days TEXT,          -- JSON ['mon','tue',...]
  schedule TEXT,                -- JSON {mon:'D1',...,sun:'rest'} (code du jour de programme ou 'rest')
  weight_unit TEXT NOT NULL DEFAULT 'lbs',
  default_rest_seconds INTEGER NOT NULL DEFAULT 90,
  preferences TEXT,
  sport_history TEXT,
  birth_year INTEGER,
  sex TEXT,
  height_cm REAL,
  body_weight_kg REAL,
  sleep_hours REAL,
  cardio_goal TEXT,             -- perte_de_poids | endurance | sante_cardio | recuperation
  cardio_level TEXT,            -- debutant | intermediaire | avance
  cardio_sessions_target INTEGER DEFAULT 3,
  cardio_minutes_target INTEGER DEFAULT 30,
  cardio_preferred TEXT,        -- JSON ['marche_inclinee', ...]
  limitations TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  pattern TEXT,                 -- schéma moteur (détection de redondances)
  muscles TEXT NOT NULL DEFAULT '{}', -- JSON {groupe: coefficient}
  equipment TEXT,
  kind TEXT NOT NULL DEFAULT 'weighted', -- weighted | bodyweight | assisted
  default_unit TEXT NOT NULL DEFAULT 'lbs',
  technique TEXT,
  in_library_only INTEGER NOT NULL DEFAULT 0,
  lib_id TEXT,                  -- exercice de la bibliothèque (photos de démo)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS program_days (
  id INTEGER PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,           -- D1..D5 (référencé par le planning)
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  focus TEXT,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS program_exercises (
  id INTEGER PRIMARY KEY,
  day_id INTEGER NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  sets INTEGER NOT NULL DEFAULT 2,
  reps INTEGER,                 -- NULL = à définir
  reps_note TEXT,               -- ex. « par bras »
  target_weight REAL,           -- NULL = charge inconnue (modifiable)
  target_weight_max REAL,       -- fourchette ex. 50–55
  weight_unit TEXT NOT NULL DEFAULT 'lbs',
  weight_note TEXT,             -- ex. « de chaque côté », « assistance »
  rest_seconds INTEGER,
  superset_group TEXT,
  notes TEXT
);

-- Blocs cardio prévus dans un jour de programme (ex. 15 min de marche inclinée en fin de séance)
CREATE TABLE IF NOT EXISTS program_cardio (
  id INTEGER PRIMARY KEY,
  day_id INTEGER NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  activity TEXT NOT NULL,
  custom_name TEXT,
  duration_min REAL NOT NULL,
  speed_kmh REAL,
  incline_pct REAL,
  placement TEXT NOT NULL DEFAULT 'fin',   -- debut | fin
  notes TEXT
);

-- Séances de musculation
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT UNIQUE,        -- idempotence de la synchro hors ligne
  program_day_id INTEGER REFERENCES program_days(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  date TEXT NOT NULL,           -- YYYY-MM-DD
  started_at TEXT,
  ended_at TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  rpe REAL,                     -- effort ressenti global 1-10
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Séries (charges + répétitions)
CREATE TABLE IF NOT EXISTS workout_sets (
  id INTEGER PRIMARY KEY,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  program_exercise_id INTEGER REFERENCES program_exercises(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  set_index INTEGER NOT NULL,
  weight REAL,
  weight_unit TEXT NOT NULL DEFAULT 'lbs',
  reps INTEGER,
  target_reps INTEGER,
  completed INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cardio_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT UNIQUE,
  activity TEXT NOT NULL,       -- marche | marche_inclinee | course | velo | elliptique | rameur | autre
  custom_name TEXT,
  date TEXT NOT NULL,
  duration_min REAL NOT NULL,
  distance_km REAL,
  speed_kmh REAL,
  incline_pct REAL,
  calories REAL,
  calories_estimated INTEGER NOT NULL DEFAULT 1,
  avg_hr INTEGER,
  max_hr INTEGER,
  rpe REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- charge | seances_semaine | cardio_minutes_semaine | cardio_km_semaine | poids_corporel | tour_de_taille | libre
  title TEXT NOT NULL,
  exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
  start_value REAL,
  target_value REAL,
  current_value REAL,           -- pour les objectifs libres
  unit TEXT,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'actif', -- actif | atteint | abandonne
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL,           -- workout | rest | cardio
  program_day_id INTEGER REFERENCES program_days(id) ON DELETE CASCADE,
  cardio_activity TEXT,
  planned_minutes INTEGER,
  title TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- planned | done | skipped
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  cardio_id INTEGER REFERENCES cardio_sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS body_metrics (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  weight_kg REAL,
  body_fat_pct REAL,
  waist_cm REAL,
  notes TEXT
);

-- Cures nutritionnelles : sèche, prise de masse, recomposition
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,            -- seche | masse | recompo
  start_date TEXT NOT NULL,
  weeks INTEGER NOT NULL,
  rate_pct REAL NOT NULL,        -- vitesse visée en % du poids par semaine
  start_weight_kg REAL NOT NULL,
  start_tdee REAL,
  kcal_base REAL,
  kcal_adjust REAL NOT NULL DEFAULT 0,
  last_adjust TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active | stopped | done
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Douleurs / gênes : prises en compte par le coach
CREATE TABLE IF NOT EXISTS pain_reports (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  area TEXT NOT NULL,
  intensity INTEGER NOT NULL,   -- 1..10
  notes TEXT,
  resolved INTEGER NOT NULL DEFAULT 0
);

-- Journal alimentaire : valeurs figées au moment de la saisie (table Ciqual ou aliment perso)
CREATE TABLE IF NOT EXISTS food_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  meal TEXT NOT NULL DEFAULT 'dejeuner',  -- petit_dej | dejeuner | collation | diner
  food_code TEXT,
  name TEXT NOT NULL,
  grams REAL NOT NULL,
  kcal REAL NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0,
  carbs_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  per100 TEXT,                  -- JSON {k,p,g,l} pour recalculer si la quantité change
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_food_logs_date ON food_logs(user_id, date);

-- Historique des recommandations validées / ignorées (aucune modification sans validation)
CREATE TABLE IF NOT EXISTS recommendation_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rec_key TEXT NOT NULL,
  status TEXT NOT NULL,         -- applied | dismissed
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sets_workout ON workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_cardio_date ON cardio_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_program_cardio_day ON program_cardio(day_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON calendar_events(user_id, date);

-- Statistiques : vue par série avec volume (tonnage) normalisé en lbs
CREATE VIEW IF NOT EXISTS v_set_volume AS
SELECT s.*, w.date, w.user_id,
  CASE WHEN e.kind = 'assisted' OR s.weight IS NULL OR s.completed = 0 THEN 0
       ELSE s.weight * COALESCE(s.reps, 0) * (CASE WHEN s.weight_unit = 'kg' THEN 2.20462 ELSE 1 END) END AS volume_lbs
FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id;
`;

// Ajoute des raccourcis à une connexion compatible (prepare().get/all/run + exec) et initialise si vide
export function setupDb(db) {
  db.exec(SCHEMA);
  // Migrations légères pour les bases existantes
  const cols = (t) => new Set(db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name));
  if (!cols('calendar_events').has('deload')) db.exec('ALTER TABLE calendar_events ADD COLUMN deload INTEGER NOT NULL DEFAULT 0');
  for (const c of ['neck_cm', 'hip_cm']) if (!cols('body_metrics').has(c)) db.exec(`ALTER TABLE body_metrics ADD COLUMN ${c} REAL`);
  if (!cols('goals').has('nutrition_plan_id')) db.exec('ALTER TABLE goals ADD COLUMN nutrition_plan_id INTEGER REFERENCES nutrition_plans(id) ON DELETE SET NULL');
  if (!cols('profiles').has('body_target')) db.exec('ALTER TABLE profiles ADD COLUMN body_target TEXT');
  if (!cols('profiles').has('activity_pal')) db.exec('ALTER TABLE profiles ADD COLUMN activity_pal REAL');
  if (!cols('cardio_sessions').has('program_cardio_id')) db.exec('ALTER TABLE cardio_sessions ADD COLUMN program_cardio_id INTEGER REFERENCES program_cardio(id) ON DELETE SET NULL');
  if (!cols('exercises').has('lib_id')) db.exec('ALTER TABLE exercises ADD COLUMN lib_id TEXT');
  // Transactions imbriquables : seule la plus externe ouvre et valide (une action composée reste atomique)
  let depth = 0;
  db.tx = (fn) => {
    if (depth) { depth++; try { return fn(); } finally { depth--; } }
    db.exec('BEGIN'); depth = 1;
    try { const r = fn(); depth = 0; db.exec('COMMIT'); return r; }
    catch (e) { depth = 0; db.exec('ROLLBACK'); throw e; }
  };
  db.one = (sql, ...p) => db.prepare(sql).get(...p);
  db.all = (sql, ...p) => db.prepare(sql).all(...p);
  db.run = (sql, ...p) => db.prepare(sql).run(...p);
  if (!db.one('SELECT id FROM users LIMIT 1')) db.tx(() => seed(db));
  // Photos de démo pour les exercices de base
  for (const [slug, lib] of Object.entries(SEED_LIB)) db.run('UPDATE exercises SET lib_id = ? WHERE slug = ? AND lib_id IS NULL', lib, slug);
  return db;
}

export const toJSON = (v, d = null) => { try { return v == null ? d : JSON.parse(v); } catch { return d; } };
