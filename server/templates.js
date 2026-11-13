// Modèles de programmes : structures classiques, à charges vides (l'utilisateur les renseigne à la première séance)
import { USER_ID, getProfile } from './services.js';
import { spreadSchedule } from './strategy.js';
import { replanFuture } from './planning.js';
import { bad } from './util.js';

// [slug, séries, reps, repos]
const PUSH = ['Push', 'Pectoraux / épaules / triceps', [['dev_couche', 3, 8, 150], ['dev_militaire', 3, 8, 120], ['dev_incline', 3, 10, 120], ['elev_laterales', 3, 12, 75], ['ext_triceps_corde', 3, 12, 75]]];
const PULL = ['Pull', 'Dos / biceps / arrière d’épaule', [['tirage_vertical', 3, 8, 120], ['row', 3, 10, 120], ['tirage_assis_serre', 3, 10, 90], ['face_pull', 3, 15, 60], ['curl_classique', 3, 10, 75], ['curl_marteau', 2, 12, 60]]];
const LEGS = ['Legs', 'Quadriceps / ischios / fessiers', [['squat', 3, 6, 180], ['rdl', 3, 8, 150], ['leg_press', 3, 10, 120], ['leg_curl_couche', 3, 12, 75], ['mollets_machine', 3, 12, 60], ['planche', 3, 40, 45]]];

export const TEMPLATES = {
  fullbody2: {
    label: 'Full body · 2 jours', level: 'Débutant', why: 'Chaque muscle travaillé 2 fois par semaine avec peu de séances : idéal pour démarrer ou reprendre.',
    days: [
      ['Full body A', 'Corps complet', [['squat', 3, 8, 150], ['dev_couche', 3, 8, 120], ['tirage_vertical', 3, 10, 120], ['rdl', 2, 10, 120], ['elev_laterales', 2, 12, 60], ['planche', 2, 30, 45]]],
      ['Full body B', 'Corps complet', [['leg_press', 3, 10, 120], ['dev_militaire', 3, 8, 120], ['row', 3, 10, 120], ['hip_thrust', 2, 10, 90], ['curl_classique', 2, 12, 60], ['ext_triceps_corde', 2, 12, 60]]],
    ],
  },
  fullbody3: {
    label: 'Full body · 3 jours', level: 'Débutant / intermédiaire', why: 'Fréquence élevée par muscle, séances complètes : la meilleure base pour progresser en force.',
    days: [
      ['Full body A', 'Squat / développé couché', [['squat', 3, 6, 180], ['dev_couche', 3, 6, 150], ['row', 3, 10, 120], ['leg_curl_couche', 2, 12, 75], ['elev_laterales', 2, 15, 60]]],
      ['Full body B', 'Soulevé / développé militaire', [['rdl', 3, 8, 150], ['dev_militaire', 3, 8, 120], ['tirage_vertical', 3, 10, 120], ['fentes_bulgares', 2, 10, 90], ['face_pull', 2, 15, 60]]],
      ['Full body C', 'Presse / incliné', [['leg_press', 3, 10, 120], ['dev_incline', 3, 10, 120], ['tirage_assis_serre', 3, 10, 90], ['hip_thrust', 2, 10, 90], ['curl_classique', 2, 12, 60], ['ext_triceps_corde', 2, 12, 60]]],
    ],
  },
  upperlower4: {
    label: 'Haut / Bas · 4 jours', level: 'Intermédiaire', why: 'Chaque muscle 2 fois par semaine avec plus de volume par séance que le full body.',
    days: [
      ['Haut A', 'Force haut du corps', [['dev_couche', 4, 6, 150], ['row', 4, 8, 120], ['dev_militaire', 3, 8, 120], ['tirage_vertical', 3, 10, 90], ['curl_classique', 2, 10, 60], ['skull_crushers', 2, 10, 60]]],
      ['Bas A', 'Force bas du corps', [['squat', 4, 6, 180], ['rdl', 3, 8, 150], ['leg_extension', 3, 12, 75], ['mollets_machine', 3, 12, 60], ['planche', 3, 40, 45]]],
      ['Haut B', 'Volume haut du corps', [['dev_incline', 3, 10, 120], ['tirage_assis_serre', 3, 10, 90], ['elev_laterales', 3, 15, 60], ['face_pull', 3, 15, 60], ['curl_marteau', 2, 12, 60], ['ext_triceps_corde', 2, 12, 60]]],
      ['Bas B', 'Volume bas du corps', [['leg_press', 3, 12, 120], ['hip_thrust', 3, 10, 90], ['leg_curl_couche', 3, 12, 75], ['fentes_bulgares', 2, 10, 90], ['mollets_pdc', 3, 15, 45]]],
    ],
  },
  ppl3: { label: 'Push / Pull / Legs · 3 jours', level: 'Intermédiaire', why: 'Un groupe de mouvements par séance. 3 jours = chaque muscle 1 fois par semaine, à doubler quand tu as le temps.', days: [PUSH, PULL, LEGS] },
  ppl6: {
    label: 'Push / Pull / Legs · 6 jours', level: 'Avancé', why: 'Chaque muscle 2 fois par semaine avec beaucoup de volume. Demande une bonne récupération (sommeil, alimentation).',
    days: [PUSH, PULL, LEGS, [PUSH[0] + ' 2', PUSH[1], PUSH[2]], [PULL[0] + ' 2', PULL[1], PULL[2]], [LEGS[0] + ' 2', LEGS[1], LEGS[2]]],
  },
};

export const templateList = () => Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, level: t.level, why: t.why, days: t.days.map(([n, f, ex]) => ({ name: n, focus: f, exercises: ex.length })) }));

// Crée le programme et l'active ; l'ancien reste enregistré et peut être réactivé
export function applyTemplate(db, today, key) {
  const t = TEMPLATES[key]; if (!t) throw bad('Modèle inconnu');
  return db.tx(() => {
    db.run('UPDATE programs SET active = 0 WHERE user_id = ?', USER_ID);
    const pid = Number(db.run('INSERT INTO programs (user_id, name, active) VALUES (?,?,1)', USER_ID, t.label).lastInsertRowid);
    const codes = [];
    t.days.forEach(([name, focus, items], i) => {
      const code = `D${i + 1}`; codes.push(code);
      const did = Number(db.run('INSERT INTO program_days (program_id, code, position, name, focus) VALUES (?,?,?,?,?)', pid, code, i + 1, name, focus).lastInsertRowid);
      items.forEach(([slug, sets, reps, rest], j) => {
        const ex = db.one('SELECT id, default_unit FROM exercises WHERE slug = ?', slug); if (!ex) return;
        db.run('INSERT INTO program_exercises (day_id, exercise_id, position, sets, reps, weight_unit, rest_seconds) VALUES (?,?,?,?,?,?,?)', did, ex.id, j + 1, sets, reps, ex.default_unit, rest);
      });
    });
    const p = getProfile(db);
    const schedule = spreadSchedule(Math.min(7, t.days.length), codes, p.available_days);
    db.run('UPDATE profiles SET schedule = ?, sessions_per_week = ? WHERE user_id = ?', JSON.stringify(schedule), t.days.length, USER_ID);
    replanFuture(db, today);
    return pid;
  });
}

export function activateProgram(db, today, id) {
  const prog = db.one('SELECT * FROM programs WHERE id = ? AND user_id = ?', id, USER_ID); if (!prog) throw bad('Programme introuvable');
  return db.tx(() => {
    db.run('UPDATE programs SET active = 0 WHERE user_id = ?', USER_ID);
    db.run('UPDATE programs SET active = 1 WHERE id = ?', id);
    const codes = db.all('SELECT code FROM program_days WHERE program_id = ? AND archived = 0 ORDER BY position', id).map((d) => d.code);
    const p = getProfile(db);
    const schedule = spreadSchedule(Math.max(1, Math.min(7, codes.length)), codes, p.available_days);
    db.run('UPDATE profiles SET schedule = ?, sessions_per_week = ? WHERE user_id = ?', JSON.stringify(schedule), codes.length, USER_ID);
    replanFuture(db, today);
    return id;
  });
}
