// Routines de mobilité et d'échauffement du volet Corps. Chaque exercice renvoie à la bibliothèque (démo, consignes,
// muscles, niveau) et ajoute : dose, point clé, erreur à éviter, variante plus facile, articulations travaillées.
const E = (id, dose, cue, err, easy, joints) => ({ id, dose, cue, err, easy, joints });
export const MOB_ROUTINES = [
  { key: 'haut', t: 'Haut du corps', d: 'Avant pectoraux, dos, épaules ou bras', min: 7, kind: 'echauffement', ex: [
    E('Arm_Circles', '10 par sens', 'Grands cercles lents, bras tendus.', 'Hausser les épaules vers les oreilles.', 'Petits cercles, un bras à la fois.', ['epaule']),
    E('x_thoracic', '8 par côté', 'Le regard suit la main qui s’ouvre.', 'Tourner avec le bas du dos au lieu du haut.', 'Amplitude réduite, coussin sous la tête.', ['thoracique']),
    E('Band_Pull_Apart', '15', 'Bras tendus, omoplates qui se rapprochent.', 'Cambrer le dos pour finir le mouvement.', 'Élastique plus léger, prise plus large.', ['epaule']),
    E('External_Rotation_with_Band', '12 par côté', 'Coude collé au corps, rotation lente.', 'Décoller le coude du buste.', 'Sans élastique, juste le geste.', ['epaule']),
    E('x_wall_slide', '10', 'Dos, coudes et poignets contre le mur.', 'Décoller le bas du dos du mur.', 'S’arrêter avant que les coudes décollent.', ['epaule', 'thoracique']),
    E('Wrist_Circles', '10 par sens', 'Doigts croisés, cercles amples.', 'Aller trop vite.', 'Cercles plus petits.', ['poignet']),
  ] },
  { key: 'bas', t: 'Bas du corps', d: 'Avant squats, soulevés de terre, fentes', min: 8, kind: 'echauffement', ex: [
    E('x_9090', '8 par côté', 'Bassin droit, rotation depuis la hanche.', 'S’aider des mains au point de forcer.', 'Mains au sol derrière soi.', ['hanche']),
    E('Worlds_Greatest_Stretch', '5 par côté', 'Coude vers le pied avant, puis ouverture vers le ciel.', 'Laisser le genou avant passer en dedans.', 'Genou arrière posé au sol.', ['hanche', 'thoracique']),
    E('x_ankle_knee', '10 par côté', 'Genou vers le mur, talon au sol.', 'Décoller le talon.', 'Pied plus près du mur.', ['cheville', 'genou']),
    E('Monster_Walk', '15 pas par sens', 'Genoux poussés vers l’extérieur.', 'Laisser les genoux rentrer.', 'Sans élastique.', ['hanche', 'genou']),
    E('Pelvic_Tilt_Into_Bridge', '10', 'Enroule le bassin, serre les fessiers en haut.', 'Cambrer le bas du dos en haut.', 'Demi-amplitude.', ['hanche', 'bas_du_dos']),
    E('Bodyweight_Squat', '10 lents', 'Talons au sol, buste fier.', 'Genoux qui rentrent.', 'Squat sur une chaise.', ['genou', 'hanche', 'cheville']),
  ] },
  { key: 'corps', t: 'Corps complet', d: 'Jour de repos ou réveil musculaire, 10 min', min: 10, kind: 'mobilite', ex: [
    E('Cat_Stretch', '10', 'Enroule puis creuse le dos lentement.', 'Bloquer la respiration.', 'Petite amplitude.', ['thoracique', 'bas_du_dos']),
    E('Worlds_Greatest_Stretch', '4 par côté', 'Mouvement lent, souffle long.', 'Genou avant qui rentre.', 'Genou arrière au sol.', ['hanche', 'thoracique']),
    E('Inchworm', '6', 'Marche des mains jusqu’à la planche, puis reviens.', 'Creuser le dos en planche.', 'Genoux fléchis.', ['epaule', 'hanche']),
    E('x_9090', '6 par côté', 'Rotation douce des deux hanches.', 'Forcer en fin d’amplitude.', 'Mains au sol.', ['hanche']),
    E('Arm_Circles', '10 par sens', 'Cercles amples.', 'Hausser les épaules.', 'Petits cercles.', ['epaule']),
    E('Childs_Pose', '45 s', 'Fesses vers les talons, bras longs.', 'Forcer sur les genoux.', 'Coussin sous les fesses.', ['bas_du_dos', 'epaule']),
  ] },
  { key: 'epaules', t: 'Épaules', d: 'Épaules raides ou sensibles, avant les développés', min: 7, kind: 'mobilite', ex: [
    E('Round_The_World_Shoulder_Stretch', '8', 'Bâton tenu large, passage lent derrière la tête.', 'Plier les coudes pour passer.', 'Prise plus large, demi-cercle.', ['epaule']),
    E('External_Rotation_with_Band', '12 par côté', 'Coude au corps, 2 s en retour.', 'Tourner le buste.', 'Sans élastique.', ['epaule']),
    E('x_wall_slide', '10', 'Monte en gardant le contact avec le mur.', 'Hausser les épaules.', 'S’arrêter à hauteur d’yeux.', ['epaule']),
    E('Band_Pull_Apart', '15', 'Omoplates basses et serrées.', 'Cambrer.', 'Élastique plus léger.', ['epaule']),
    E('Chest_And_Front_Of_Shoulder_Stretch', '30 s par côté', 'Avant-bras au cadre de porte, avance doucement.', 'Douleur vive à l’avant de l’épaule : stop.', 'Bras plus bas.', ['epaule']),
  ] },
  { key: 'thoracique', t: 'Colonne thoracique', d: 'Haut du dos raide (bureau, téléphone)', min: 6, kind: 'mobilite', ex: [
    E('x_foam_tspine', '1 min', 'Rouleau sous le haut du dos, mains derrière la tête.', 'Rouler sur le bas du dos.', 'Sans rouleau : extension sur une chaise.', ['thoracique']),
    E('x_thoracic', '8 par côté', 'Genoux serrés, ouvre le bras vers l’arrière.', 'Laisser les genoux se séparer.', 'Amplitude réduite.', ['thoracique']),
    E('Cat_Stretch', '10', 'Vertèbre par vertèbre.', 'Aller vite.', 'Petite amplitude.', ['thoracique']),
    E('Upper_Back_Stretch', '30 s', 'Arrondis le haut du dos, bras devant.', 'Hausser les épaules.', 'Assis.', ['thoracique']),
    E('x_dead_hang', '3 × 20 s', 'Épaules relâchées, respire.', 'Se balancer.', 'Pieds au sol, poids partiel.', ['thoracique', 'epaule']),
  ] },
  { key: 'hanches', t: 'Hanches', d: 'Hanches raides, avant les jambes', min: 8, kind: 'mobilite', ex: [
    E('x_9090', '8 par côté', 'Buste droit, rotation depuis la hanche.', 'Forcer en fin d’amplitude.', 'Mains au sol.', ['hanche']),
    E('Kneeling_Hip_Flexor', '30 s par côté', 'Bascule le bassin, serre le fessier arrière.', 'Cambrer le bas du dos.', 'Coussin sous le genou.', ['hanche']),
    E('x_pigeon', '30 s par côté', 'Bassin bien à plat.', 'Tordre le genou avant.', 'Pigeon sur une table ou allongé (figure 4).', ['hanche']),
    E('Standing_Hip_Circles', '8 par sens', 'Grands cercles lents du genou.', 'Pencher le buste.', 'Main sur un mur.', ['hanche']),
    E('Adductor', '30 s', 'Dos droit, pousse les genoux doucement.', 'Rebondir.', 'Moins d’écart.', ['hanche']),
  ] },
  { key: 'chevilles', t: 'Chevilles', d: 'Squat qui bloque, talons qui décollent', min: 5, kind: 'mobilite', ex: [
    E('Ankle_Circles', '10 par sens', 'Cercles amples, pied relâché.', 'Bouger la jambe entière.', 'Assis.', ['cheville']),
    E('x_ankle_knee', '10 par côté', 'Genou vers le mur, talon collé au sol.', 'Laisser le pied s’affaisser en dedans.', 'Pied plus près du mur.', ['cheville']),
    E('Calf_Stretch_Hands_Against_Wall', '30 s par côté', 'Jambe arrière tendue, talon au sol.', 'Pied arrière tourné en dehors.', 'Moins d’écart entre les pieds.', ['cheville']),
    E('Standing_Soleus_And_Achilles_Stretch', '30 s par côté', 'Genou arrière plié pour viser le soléaire.', 'Décoller le talon.', 'Mains au mur.', ['cheville']),
  ] },
  { key: 'poignets', t: 'Poignets et avant-bras', d: 'Avant pompes, développés ou curls', min: 4, kind: 'mobilite', ex: [
    E('Wrist_Circles', '10 par sens', 'Doigts croisés, cercles amples.', 'Aller vite.', 'Plus petits cercles.', ['poignet']),
    E('Kneeling_Forearm_Stretch', '30 s', 'Paumes au sol, doigts vers les genoux, recule doucement.', 'Forcer jusqu’à la douleur.', 'Debout, mains sur une table.', ['poignet', 'coude']),
    E('Side_Wrist_Pull', '30 s par côté', 'Tire doucement la main vers le bas.', 'Plier le coude.', 'Moins de traction.', ['poignet']),
    E('Elbow_Circles', '10 par sens', 'Coudes pliés, cercles réguliers.', 'Hausser les épaules.', 'Un bras à la fois.', ['coude']),
  ] },
  { key: 'nuque', t: 'Nuque', d: 'Cou raide, tensions de bureau', min: 4, kind: 'mobilite', ex: [
    E('x_chin_tuck', '10', 'Rentre le menton comme pour un double menton.', 'Pencher la tête vers le bas.', 'Allongé, tête au sol.', ['nuque']),
    E('Side_Neck_Stretch', '30 s par côté', 'Oreille vers l’épaule, épaule opposée basse.', 'Tirer fort avec la main.', 'Sans la main.', ['nuque']),
    E('Chin_To_Chest_Stretch', '30 s', 'Menton vers le sternum, mains derrière la tête sans tirer.', 'Arrondir tout le dos.', 'Sans les mains.', ['nuque']),
    E('Shoulder_Circles', '10 par sens', 'Épaules qui roulent vers l’arrière.', 'Aller vite.', 'Plus petits cercles.', ['nuque', 'epaule']),
  ] },
  { key: 'apres', t: 'Retour au calme', d: 'Après la séance, étirements doux de 30 s', min: 6, kind: 'etirement', ex: [
    E('Kneeling_Hip_Flexor', '30 s par côté', 'Serre le fessier arrière.', 'Cambrer.', 'Coussin sous le genou.', ['hanche']),
    E('Hamstring_Stretch', '30 s', 'Dos long, penche depuis les hanches.', 'Arrondir le dos pour aller plus loin.', 'Genou légèrement fléchi.', ['hanche']),
    E('x_pigeon', '30 s par côté', 'Respire, relâche.', 'Forcer sur le genou.', 'Figure 4 allongé.', ['hanche']),
    E('Chest_And_Front_Of_Shoulder_Stretch', '30 s', 'Avance doucement.', 'Douleur vive : stop.', 'Bras plus bas.', ['epaule']),
    E('Childs_Pose', '45 s', 'Souffle long.', 'Forcer.', 'Coussin sous les fesses.', ['bas_du_dos']),
    E('Calf_Stretch_Hands_Against_Wall', '30 s par côté', 'Talon au sol.', 'Pied tourné.', 'Moins d’écart.', ['cheville']),
  ] },
];
export const MOB_BY_KEY = Object.fromEntries(MOB_ROUTINES.map((r) => [r.key, r]));
// Douleur active → routine la plus utile ; séance du jour (haut / bas) → échauffement correspondant
export const PAIN_ROUTINE = { epaule: 'epaules', pectoral: 'epaules', coude: 'poignets', poignet: 'poignets', nuque: 'nuque', thoracique: 'thoracique', bas_du_dos: 'thoracique', hanche: 'hanches', genou: 'hanches', cheville: 'chevilles' };
export const LEVEL = { b: 'Débutant', i: 'Intermédiaire', e: 'Avancé' };
export const JOINT_FR = { epaule: 'épaule', coude: 'coude', poignet: 'poignet', nuque: 'nuque', thoracique: 'haut du dos', bas_du_dos: 'bas du dos', hanche: 'hanche', genou: 'genou', cheville: 'cheville' };
