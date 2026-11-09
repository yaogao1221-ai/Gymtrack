// Données initiales : bibliothèque d'exercices + programme actuel (5 jours), saisi exactement.

// Groupes musculaires utilisés par l'analyse
export const MUSCLES = {
  pectoraux: 'Pectoraux', epaules_ant: 'Épaules (avant)', epaules_lat: 'Épaules (latéral)',
  epaules_post: 'Épaules (arrière)', triceps: 'Triceps', biceps: 'Biceps', avant_bras: 'Avant-bras',
  dos_largeur: 'Dos (grand dorsal)', dos_epaisseur: 'Dos (milieu / épaisseur)', trapezes: 'Trapèzes',
  lombaires: 'Lombaires', abdominaux: 'Abdominaux / gainage', quadriceps: 'Quadriceps', ischios: 'Ischio-jambiers',
  fessiers: 'Fessiers', adducteurs: 'Adducteurs', abducteurs: 'Abducteurs', mollets: 'Mollets',
};

// slug, nom, schéma moteur, muscles {groupe: coef}, matériel, type, unité, conseil technique, bibliothèque seule
export const EXERCISES = [
  ['dev_incline', 'Développé incliné', 'press_incline', { pectoraux: 1, epaules_ant: 0.5, triceps: 0.5 }, 'Haltères / barre', 'weighted', 'lbs', 'Omoplates serrées, coudes ~45°, descente contrôlée 2-3 s.'],
  ['dev_couche', 'Développé couché', 'press_horizontal', { pectoraux: 1, triceps: 0.5, epaules_ant: 0.5 }, 'Haltères / barre', 'weighted', 'lbs', 'Pieds ancrés, léger arc thoracique, barre au bas des pectoraux.'],
  ['dips', 'Dips assistés', 'dip', { pectoraux: 1, triceps: 1, epaules_ant: 0.5 }, 'Machine assistée', 'assisted', 'lbs', 'Moins d’assistance = plus difficile. Buste légèrement penché, ne pas descendre au-delà du confort de l’épaule.'],
  ['pec_fly', 'Pec Fly', 'chest_fly', { pectoraux: 1, epaules_ant: 0.25 }, 'Machine', 'weighted', 'lbs', 'Coudes légèrement fléchis, serrer 1 s en fin de mouvement.'],
  ['skull_crushers', 'Skull Crushers', 'triceps_extension', { triceps: 1 }, 'Barre EZ', 'weighted', 'lbs', 'Coudes fixes, descendre derrière le front, pas de rebond.'],
  ['ext_triceps_corde', 'Extension triceps corde', 'triceps_pushdown', { triceps: 1 }, 'Poulie', 'weighted', 'lbs', 'Coudes collés au corps, écarter la corde en bas.'],
  ['ext_triceps_uni', 'Extension triceps unilatérale', 'triceps_pushdown', { triceps: 1 }, 'Poulie / haltère', 'weighted', 'lbs', 'Un bras à la fois, amplitude complète.'],
  ['tractions_assistees', 'Tractions assistées', 'vertical_pull', { dos_largeur: 1, biceps: 0.5, dos_epaisseur: 0.5 }, 'Machine assistée', 'assisted', 'kg', 'Moins d’assistance = plus difficile. Menton au-dessus de la barre, descente contrôlée.'],
  ['row', 'Row', 'horizontal_row', { dos_epaisseur: 1, dos_largeur: 0.5, biceps: 0.5, epaules_post: 0.5 }, 'Haltère / machine', 'weighted', 'lbs', 'Dos neutre, tirer avec le coude vers la hanche.'],
  ['tirage_assis_serre', 'Tirage assis Close Grip', 'horizontal_row', { dos_epaisseur: 1, dos_largeur: 0.5, biceps: 0.5 }, 'Poulie basse', 'weighted', 'lbs', 'Poitrine haute, pas de balancier du buste.'],
  ['row_2', 'Deuxième Row', 'horizontal_row', { dos_epaisseur: 1, dos_largeur: 0.5, biceps: 0.5, epaules_post: 0.5 }, 'Haltère / machine', 'weighted', 'lbs', 'Variante possible : prise différente ou unilatérale.'],
  ['curl_classique', 'Curl classique', 'curl', { biceps: 1, avant_bras: 0.25 }, 'Haltères', 'weighted', 'lbs', 'Coudes fixes, supination complète en haut.'],
  ['curl_marteau', 'Curl marteau', 'curl_hammer', { biceps: 1, avant_bras: 1 }, 'Haltères', 'weighted', 'lbs', 'Prise neutre, pas d’élan.'],
  ['rdl', 'Romanian Deadlift', 'hinge', { ischios: 1, fessiers: 1, lombaires: 0.5 }, 'Barre / haltères', 'weighted', 'lbs', 'Hanches en arrière, dos neutre, barre près des jambes.'],
  ['leg_press', 'Leg Press', 'leg_press', { quadriceps: 1, fessiers: 0.5, adducteurs: 0.25 }, 'Machine', 'weighted', 'lbs', 'Ne pas verrouiller les genoux, bas du dos collé au dossier.'],
  ['seated_leg_curl', 'Seated Leg Curl', 'knee_flexion', { ischios: 1 }, 'Machine', 'weighted', 'lbs', 'Contrôler la remontée.'],
  ['abduction', 'Abduction', 'hip_abduction', { abducteurs: 1, fessiers: 0.5 }, 'Machine', 'weighted', 'lbs', 'Buste légèrement penché vers l’avant pour cibler le moyen fessier.'],
  ['hip_thrust', 'Hip Thrust', 'hip_extension', { fessiers: 1, ischios: 0.5 }, 'Barre / machine', 'weighted', 'lbs', 'Menton rentré, bassin en rétroversion en haut, pause 1 s.'],
  ['mollets_machine', 'Mollets machine', 'calf', { mollets: 1 }, 'Machine', 'weighted', 'lbs', 'Étirement complet en bas, pause en haut.'],
  ['mollets_pdc', 'Mollets sans poids', 'calf', { mollets: 1 }, 'Poids du corps', 'bodyweight', 'lbs', 'Sur une marche, amplitude complète.'],
  ['dev_militaire', 'Développé militaire', 'press_vertical', { epaules_ant: 1, epaules_lat: 0.5, triceps: 0.5 }, 'Haltères / barre', 'weighted', 'lbs', 'Gainage serré, ne pas cambrer.'],
  ['reverse_fly', 'Pec Fly inversé', 'rear_delt_fly', { epaules_post: 1, dos_epaisseur: 0.5 }, 'Machine', 'weighted', 'lbs', 'Bras quasi tendus, mouvement mené par les coudes.'],
  ['elev_laterales', 'Élévations latérales', 'lateral_raise', { epaules_lat: 1 }, 'Haltères', 'weighted', 'lbs', 'Monter jusqu’à l’horizontale, sans élan.'],
  ['elev_frontales', 'Élévations frontales', 'front_raise', { epaules_ant: 1 }, 'Haltères', 'weighted', 'lbs', 'Monter à hauteur des yeux maximum.'],
  ['face_pull', 'Face Pull', 'face_pull', { epaules_post: 1, dos_epaisseur: 0.5, trapezes: 0.5 }, 'Poulie + corde', 'weighted', 'lbs', 'Tirer vers le front, rotation externe en fin de mouvement.'],
  ['shrugs', 'Shrugs', 'shrug', { trapezes: 1, avant_bras: 0.25 }, 'Haltères / barre', 'weighted', 'lbs', 'Monter les épaules vers les oreilles, sans rouler.'],
  ['squat', 'Squat', 'squat', { quadriceps: 1, fessiers: 1, adducteurs: 0.5, lombaires: 0.25 }, 'Barre / Smith', 'weighted', 'lbs', 'Genoux dans l’axe des pieds, dos neutre, profondeur maîtrisée.'],
  ['leg_curl_couche', 'Leg Curl couché', 'knee_flexion', { ischios: 1 }, 'Machine', 'weighted', 'lbs', 'Bassin plaqué sur le banc.'],
  ['leg_extension', 'Leg Extension', 'knee_extension', { quadriceps: 1 }, 'Machine', 'weighted', 'lbs', 'Pause 1 s en haut, descente lente.'],
  ['adduct_abduct', 'Machine adducteurs ou abducteurs', 'hip_adduction', { adducteurs: 1, abducteurs: 0.5 }, 'Machine', 'weighted', 'lbs', 'Alterner adducteurs / abducteurs d’une semaine à l’autre si besoin.'],
  // Bibliothèque complémentaire (suggestions du coach)
  ['planche', 'Gainage planche', 'core_anti_extension', { abdominaux: 1 }, 'Poids du corps', 'bodyweight', 'lbs', 'Bassin neutre, fessiers contractés. Compter les secondes comme répétitions.', 1],
  ['crunch_poulie', 'Crunch à la poulie', 'core_flexion', { abdominaux: 1 }, 'Poulie', 'weighted', 'lbs', 'Enrouler la colonne, hanches fixes.', 1],
  ['releves_jambes', 'Relevés de jambes suspendu', 'core_flexion', { abdominaux: 1 }, 'Barre', 'bodyweight', 'lbs', 'Pas de balancier, rétroversion du bassin.', 1],
  ['pallof', 'Pallof press', 'core_anti_rotation', { abdominaux: 1 }, 'Poulie / élastique', 'weighted', 'lbs', 'Résister à la rotation, bras tendus 2 s.', 1],
  ['hyperextension', 'Extensions lombaires (banc 45°)', 'hinge_light', { lombaires: 1, fessiers: 0.5, ischios: 0.5 }, 'Banc 45°', 'bodyweight', 'lbs', 'Amplitude contrôlée, ne pas hyper-cambrer.', 1],
  ['fentes_bulgares', 'Fentes bulgares', 'lunge', { quadriceps: 1, fessiers: 1, adducteurs: 0.25 }, 'Haltères', 'weighted', 'lbs', 'Genou avant stable, buste légèrement penché.', 1],
  ['tirage_vertical', 'Tirage vertical (lat pulldown)', 'vertical_pull', { dos_largeur: 1, biceps: 0.5 }, 'Poulie haute', 'weighted', 'lbs', 'Tirer vers le haut de la poitrine, coudes vers le bas.', 1],
  ['pullover_poulie', 'Pull-over à la poulie', 'shoulder_extension', { dos_largeur: 1 }, 'Poulie haute', 'weighted', 'lbs', 'Bras quasi tendus, arc de cercle.', 1],
  ['rotation_externe', 'Rotation externe à la poulie', 'external_rotation', { epaules_post: 1 }, 'Poulie', 'weighted', 'lbs', 'Coude collé, charge légère — prévention de l’épaule.', 1],
  ['farmer_walk', 'Farmer walk', 'carry', { avant_bras: 1, trapezes: 1, abdominaux: 0.5 }, 'Haltères', 'weighted', 'lbs', 'Marcher droit, épaules basses.', 1],
  ['curl_incline', 'Curl incliné', 'curl', { biceps: 1 }, 'Haltères', 'weighted', 'lbs', 'Bras en arrière du buste pour l’étirement.', 1],
  ['nordic_curl', 'Leg curl nordique (assisté)', 'knee_flexion', { ischios: 1 }, 'Poids du corps', 'bodyweight', 'lbs', 'Descente lente, s’aider des mains.', 1],
];

// [slug, séries, reps, note reps, charge, charge max, unité, note charge, superset, repos]
const PROGRAM = [
  ['D1', 'Jour 1', 'Pectoraux / Triceps', [
    ['dev_incline', 2, 8, null, 40, null, 'lbs'],
    ['dev_couche', 2, 8, null, 40, null, 'lbs'],
    ['dips', 2, 8, null, 120, null, 'lbs', 'assistance'],
    ['pec_fly', 2, 8, null, 100, null, 'lbs'],
    ['skull_crushers', 2, 8, null, 60, null, 'lbs'],
    ['ext_triceps_corde', 2, 8, null, null, null, 'lbs'],
    ['ext_triceps_uni', 2, 8, 'par bras', null, null, 'lbs'],
  ]],
  ['D2', 'Jour 2', 'Dos / Biceps', [
    ['tractions_assistees', 3, 10, null, 60, null, 'kg', 'assistance'],
    ['row', 2, 8, null, 50, 55, 'lbs'],
    ['tirage_assis_serre', 2, 8, null, 100, 110, 'lbs'],
    ['row_2', 2, 8, null, 50, 55, 'lbs'],
    ['curl_classique', 3, 10, 'par bras', null, null, 'lbs', null, 'A', 75],
    ['curl_marteau', 3, 10, 'par bras', null, null, 'lbs', null, 'A', 75],
  ]],
  ['D3', 'Jour 3', 'Jambes A', [
    ['rdl', 2, 8, null, 30, null, 'lbs', 'de chaque côté'],
    ['leg_press', 2, 8, null, 90, null, 'lbs', 'de chaque côté'],
    ['seated_leg_curl', 2, 8, null, 60, null, 'lbs'],
    ['abduction', 2, 8, null, null, null, 'lbs'],
    ['hip_thrust', 2, 8, null, 45, null, 'lbs', 'de chaque côté'],
    ['mollets_machine', 3, 15, null, 90, null, 'lbs'],
    ['mollets_pdc', 3, null, null, null, null, 'lbs'],
  ]],
  ['D4', 'Jour 4', 'Épaules / Trapèzes', [
    ['dev_militaire', 2, 8, null, 35, null, 'lbs'],
    ['reverse_fly', 2, 8, null, 80, null, 'lbs'],
    ['elev_laterales', 2, 8, null, 20, null, 'lbs'],
    ['elev_frontales', 2, 8, null, 20, null, 'lbs'],
    ['face_pull', 3, 15, null, 70, null, 'lbs'],
    ['shrugs', 3, 15, null, 45, null, 'lbs'],
  ]],
  ['D5', 'Jour 5', 'Jambes B', [
    ['squat', 2, 8, null, 25, null, 'lbs'],
    ['leg_curl_couche', 2, 8, null, 60, null, 'lbs'],
    ['leg_extension', 2, 8, null, null, null, 'lbs'],
    ['adduct_abduct', 2, 8, null, null, null, 'lbs'],
    ['mollets_machine', 3, 15, null, 90, null, 'lbs'],
    ['mollets_pdc', 3, 10, null, null, null, 'lbs'],
  ]],
];

export const DEFAULT_SCHEDULE = { mon: 'D1', tue: 'D2', wed: 'D3', thu: 'rest', fri: 'D4', sat: 'D5', sun: 'rest' };

export function seedExercises(db) {
  const ins = db.prepare(`INSERT OR IGNORE INTO exercises (slug, name, pattern, muscles, equipment, kind, default_unit, technique, in_library_only)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const [slug, name, pattern, muscles, equip, kind, unit, tech, lib = 0] of EXERCISES) {
    ins.run(slug, name, pattern, JSON.stringify(muscles), equip, kind, unit, tech, lib);
  }
}

export function seedProgram(db, userId) {
  const progId = Number(db.run('INSERT INTO programs (user_id, name, active) VALUES (?,?,1)', userId, 'Programme actuel — 5 jours').lastInsertRowid);
  const exId = (slug) => db.one('SELECT id FROM exercises WHERE slug = ?', slug).id;
  PROGRAM.forEach(([code, name, focus, items], di) => {
    const dayId = Number(db.run('INSERT INTO program_days (program_id, code, position, name, focus) VALUES (?,?,?,?,?)', progId, code, di + 1, name, focus).lastInsertRowid);
    items.forEach(([slug, sets, reps, repsNote, w, wMax, unit, wNote = null, ss = null, rest = null], i) => {
      db.run(`INSERT INTO program_exercises (day_id, exercise_id, position, sets, reps, reps_note, target_weight, target_weight_max, weight_unit, weight_note, superset_group, rest_seconds)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, dayId, exId(slug), i + 1, sets, reps, repsNote, w, wMax, unit, wNote, ss, rest);
    });
  });
  return progId;
}

export function seed(db) {
  const userId = Number(db.run("INSERT INTO users (name) VALUES ('Athlète')").lastInsertRowid);
  db.run(`INSERT INTO profiles (user_id, schedule, cardio_preferred) VALUES (?,?,?)`, userId, JSON.stringify(DEFAULT_SCHEDULE), JSON.stringify(['marche_inclinee', 'velo']));
  seedExercises(db);
  seedProgram(db, userId);
}
