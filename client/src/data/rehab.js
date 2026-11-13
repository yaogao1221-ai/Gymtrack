// Soins et mobilité : repères issus de la kinésithérapie du sport (consensus publiés), pas un diagnostic.
// Les exercices renvoient à la bibliothèque illustrée (id free-exercise-db ou compléments x_…).

export const PRINCIPLES = [
  { t: 'Blessure récente (choc, entorse, claquage) : PEACE puis LOVE', d: 'Les premiers jours : protéger sans immobiliser complètement, surélever, éviter les anti-inflammatoires qui freinent la cicatrisation, compresser, comprendre ce qui se passe. Ensuite : recharger progressivement, rester positif, bouger sans douleur (cardio léger), renforcer.', src: 'Dubois & Esculier, British Journal of Sports Medicine, 2020' },
  { t: 'La règle de la douleur acceptable', d: 'Pendant un exercice de rééducation, une douleur jusqu’à 3 à 4 sur 10 est acceptable si elle revient à ton niveau habituel le lendemain matin. Si elle augmente d’un jour à l’autre, baisse la charge ou l’amplitude.', src: 'Modèle de suivi de la douleur, Silbernagel et al., 2007' },
  { t: 'Le repos total ralentit la guérison d’un tendon', d: 'Un tendon guérit en étant chargé progressivement : isométrique (tenir une position) les premiers jours, puis lent et lourd (3 s en montée, 3 s en descente), puis rapide quand ça ne fait plus mal.', src: 'Cook & Purdam 2009 ; Malliaras et al. 2015' },
  { t: 'Garde l’entraînement du reste du corps', d: 'Une épaule douloureuse n’empêche pas de faire jambes et gainage. Rester actif accélère la récupération et protège le moral.', src: '' },
  { t: 'Le sommeil et les protéines comptent', d: '7 à 9 h de sommeil et 1,6 à 2,2 g de protéines par kg de poids soutiennent la réparation des tissus.', src: '' },
];

export const RED_FLAGS_ALL = [
  'Douleur après un choc avec déformation, craquement ou impossibilité d’appuyer ou de bouger',
  'Engourdissement, fourmillements ou perte de force qui s’étendent dans un bras ou une jambe',
  'Fièvre, gonflement chaud et rouge, ou douleur la nuit qui ne bouge pas avec la position',
  'Pas d’amélioration après 2 à 3 semaines malgré la baisse des charges',
];

// zone de douleur (mêmes clés que l'Analyse) -> repères et protocole en 3 étapes
export const AREAS = {
  epaule: {
    label: 'Épaule', muscles: ['epaules_ant', 'epaules_lat', 'epaules_post'],
    common: 'Le plus souvent : tendinopathie de la coiffe des rotateurs ou douleur en élévation (développés, dips, élévations latérales). Souvent liée à une hausse rapide du volume de poussée et à un dos (tirage, arrière d’épaule) trop faible.',
    flags: ['Épaule qui « sort » ou bras impossible à lever après une chute : consulte rapidement'],
    adapt: 'Remplace temporairement : développé couché barre par haltères prise neutre, amplitude réduite ; dips et développé derrière la nuque à éviter ; garde les tirages.',
    phases: [
      { t: '1. Calmer (jours 1 à 7)', d: 'Isométriques sans douleur, 5 × 30 à 45 s, 1 à 2 fois par jour.', ex: [['External_Rotation_with_Band', 'Tenir 30 s contre l’élastique, coude au corps'], ['x_wall_slide', '2 × 10 lents, sans hausser les épaules'], ['Round_The_World_Shoulder_Stretch', '2 × 8 dans l’amplitude confortable']] },
      { t: '2. Recharger (semaines 2 à 6)', d: 'Renforcement lent, 3 × 10 à 15, 3 fois par semaine. Douleur ≤ 3/10.', ex: [['x_side_lying_er', '3 × 12-15, 3 s en descente'], ['Band_Pull_Apart', '3 × 15'], ['Face_Pull', '3 × 15, léger'], ['External_Rotation_with_Cable', '3 × 12']] },
      { t: '3. Reprendre', d: 'Réintroduis les développés à 50 % de ta charge, +10 % par semaine si pas de douleur le lendemain. Garde 2 séries de rotations externes en échauffement.', ex: [['Dumbbell_Bench_Press', 'Prise neutre, 50 % de la charge habituelle']] },
    ],
  },
  coude: {
    label: 'Coude', muscles: ['avant_bras', 'biceps', 'triceps'],
    common: 'Douleur à l’extérieur du coude (épicondylalgie, « tennis elbow ») : tirages, curls en pronation, prises serrées. À l’intérieur (« golf elbow ») : curls, tractions. Ce sont des tendinopathies : elles guérissent avec une charge progressive.',
    flags: ['Craquement au pli du coude avec bleu et biceps qui « remonte » : consulte en urgence (rupture)'],
    adapt: 'Préfère les prises neutres (curl marteau, tirage prise neutre), sangles de tirage pour soulager la prise, évite les barres droites quelques semaines.',
    phases: [
      { t: '1. Calmer', d: 'Isométrique du poignet 5 × 45 s à 30-50 % d’effort.', ex: [['Palms-Down_Wrist_Curl_Over_A_Bench', 'Tenir le poignet relevé 45 s, haltère légère']] },
      { t: '2. Recharger (6 à 12 semaines)', d: 'Excentrique lent : 3 × 15, 1 fois par jour, en montant la charge quand c’est facile.', ex: [['x_wrist_ext_ecc', '3 × 15, descente en 4 s'], ['x_tyler_twist', '3 × 15 (barre flexible)'], ['Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench', '3 × 15 (intérieur du coude)']] },
      { t: '3. Reprendre', d: 'Réintroduis tirages et curls en prise neutre, puis en pronation. Garde 2 séries d’excentrique en échauffement.', ex: [['Hammer_Curls', 'Léger, 3 × 12']] },
    ],
  },
  poignet: {
    label: 'Poignet', muscles: ['avant_bras'],
    common: 'Douleurs sur les développés (poignet cassé en arrière), les front squats ou les pompes. Souvent une question de position et de charge.',
    flags: ['Chute sur la main tendue avec douleur à la base du pouce : radio nécessaire (fracture du scaphoïde fréquente et invisible au début)'],
    adapt: 'Poignet aligné avec l’avant-bras sur les développés, haltères plutôt que barre, pompes sur poignées ou poings.',
    phases: [
      { t: '1. Mobilité', d: 'Chaque jour, sans douleur.', ex: [['Wrist_Circles', '2 × 10 dans chaque sens']] },
      { t: '2. Renforcer', d: '3 × 15 léger, 3 fois par semaine.', ex: [['Seated_Dumbbell_Palms-Up_Wrist_Curl', '3 × 15'], ['Seated_Dumbbell_Palms-Down_Wrist_Curl', '3 × 15'], ['Dumbbell_Lying_Supination', '3 × 12']] },
      { t: '3. Reprendre', d: 'Charge progressive sur les développés, poignets droits, avec des bandes de poignet si besoin.', ex: [] },
    ],
  },
  bas_du_dos: {
    label: 'Bas du dos', muscles: ['lombaires', 'abdominaux', 'fessiers'],
    common: 'La lombalgie « commune » (sans cause grave) est la plus fréquente. Elle passe en général en quelques jours à semaines. Le mouvement aide : le repos au lit la prolonge.',
    flags: ['Perte de contrôle des urines ou des selles, engourdissement entre les jambes : urgence', 'Douleur qui descend sous le genou avec perte de force du pied'],
    adapt: 'Arrête soulevé de terre, squat lourd et rowing buste penché quelques jours. Garde presse à cuisses légère, tirages assis, gainage et marche.',
    phases: [
      { t: '1. Calmer', d: 'Marche 20 à 30 min par jour. Positions de soulagement.', ex: [['Childs_Pose', '3 × 30 s'], ['Cat_Stretch', '2 × 10 lents'], ['Pelvic_Tilt_Into_Bridge', '2 × 10']] },
      { t: '2. Stabiliser : le « big 3 » de McGill', d: 'Chaque jour, séries courtes : 10 s de maintien, 5-3-1 répétitions.', ex: [['x_mcgill_curl', '10 s × 5, puis 3, puis 1'], ['x_side_plank', '10 s × 5-3-1 de chaque côté'], ['x_bird_dog', '10 s × 5-3-1 de chaque côté']] },
      { t: '3. Reprendre', d: 'Charnière de hanche légère puis soulevé de terre roumain à 50 %, +10 % par semaine. Gainage avant chaque séance de jambes.', ex: [['Single_Leg_Glute_Bridge', '3 × 10'], ['Romanian_Deadlift', '50 % de la charge, dos neutre']] },
    ],
  },
  genou: {
    label: 'Genou', muscles: ['quadriceps', 'ischios'],
    common: 'Douleur devant le genou (sous ou autour de la rotule) : syndrome fémoro-patellaire ou tendinopathie rotulienne, souvent après une hausse de squats, fentes, sauts ou course.',
    flags: ['Genou qui gonfle en quelques heures, se bloque ou se dérobe : consulte (ménisque, ligament)'],
    adapt: 'Réduis la profondeur de squat à une amplitude sans douleur, presse à cuisses en amplitude partielle, garde le travail des fessiers et des ischios.',
    phases: [
      { t: '1. Calmer', d: 'Isométrique du quadriceps : 5 × 45 s à 70 % d’effort, soulage la douleur du tendon pendant quelques heures.', ex: [['x_spanish_squat', '5 × 45 s, genoux à 60°'], ['Leg_Extensions', 'Tenir 45 s à mi-amplitude, 5 fois']] },
      { t: '2. Recharger', d: 'Lent et lourd : 3 s en montée, 3 s en descente, 3 à 4 × 8-15, 3 fois par semaine.', ex: [['Leg_Press', 'Amplitude sans douleur, 4 × 10 lents'], ['Dumbbell_Step_Ups', '3 × 10 par jambe'], ['Single_Leg_Glute_Bridge', '3 × 12'], ['Monster_Walk', '3 × 15 pas']] },
      { t: '3. Reprendre', d: 'Squat complet léger, puis charge progressive. Sauts seulement quand 3 × 15 squats unipodaux lents sont sans douleur.', ex: [['Quad_Stretch', '2 × 30 s après la séance']] },
    ],
  },
  hanche: {
    label: 'Hanche / aine', muscles: ['fessiers', 'adducteurs', 'abducteurs'],
    common: 'Pincement en flexion profonde (squat), douleur sur le côté de la hanche (tendons fessiers) ou dans l’aine (adducteurs).',
    flags: ['Douleur d’aine profonde qui empêche de marcher, ou après une chute : consulte'],
    adapt: 'Squat moins profond et pieds plus écartés, évite les fentes larges et la machine adducteurs lourde quelques semaines.',
    phases: [
      { t: '1. Mobilité', d: 'Chaque jour, sans forcer.', ex: [['x_9090', '2 × 8 de chaque côté'], ['Kneeling_Hip_Flexor', '2 × 30 s'], ['x_pigeon', '2 × 30 s si pas de pincement']] },
      { t: '2. Renforcer', d: '3 fois par semaine.', ex: [['x_copenhagen', '3 × 15-30 s (aine), genou posé au début'], ['Monster_Walk', '3 × 15 pas'], ['Barbell_Glute_Bridge', '3 × 10'], ['Band_Hip_Adductions', '3 × 15']] },
      { t: '3. Reprendre', d: 'Ramène la profondeur de squat progressivement, garde les gainages Copenhague 2 fois par semaine (réduisent les blessures d’aine).', ex: [] },
    ],
  },
  cheville: {
    label: 'Cheville / mollet', muscles: ['mollets'],
    common: 'Entorse de cheville, tendinopathie d’Achille (raideur le matin), ou cheville raide qui gêne le squat.',
    flags: ['Impossible de faire 4 pas après une entorse, ou douleur sur l’os de la malléole : radio', 'Choc dans le mollet « comme un coup de pied » : rupture d’Achille possible, urgence'],
    adapt: 'Évite sauts et corde quelques semaines, garde vélo et rameur si pas de douleur.',
    phases: [
      { t: '1. Calmer', d: 'Entorse : PEACE, appui dès que possible avec chevillère. Tendon : mollets isométriques 5 × 45 s.', ex: [['Ankle_Circles', '2 × 10'], ['Standing_Calf_Raises', 'Tenir sur la pointe 45 s, 5 fois']] },
      { t: '2. Recharger', d: 'Mollets lents, 3 × 15, puis lestés, chaque jour pour un tendon d’Achille (protocole d’Alfredson : descente sur une jambe).', ex: [['Standing_Calf_Raises', '3 × 15, descente en 3 s'], ['Barbell_Seated_Calf_Raise', '3 × 15'], ['x_tibialis', '3 × 20'], ['x_ankle_knee', '2 × 10 (mobilité pour le squat)']] },
      { t: '3. Reprendre', d: 'Équilibre sur une jambe 30 s yeux fermés avant de reprendre les sauts. Réintroduis la course 1 jour sur 2.', ex: [['Calf_Stretch_Hands_Against_Wall', '2 × 30 s']] },
    ],
  },
  nuque: {
    label: 'Nuque / cervicales', muscles: ['trapezes'],
    common: 'Raideur ou douleur après shrugs, développés au-dessus de la tête, ou posture prolongée (téléphone, écran).',
    flags: ['Douleur avec fourmillements dans un bras, maux de tête violents ou vertiges : consulte'],
    adapt: 'Évite shrugs lourds et développé derrière la nuque, garde la tête neutre (ne pas regarder le plafond sur les développés).',
    phases: [
      { t: '1. Mobilité', d: 'Plusieurs fois par jour.', ex: [['x_chin_tuck', '2 × 10, tenir 3 s'], ['Chin_To_Chest_Stretch', '2 × 20 s']] },
      { t: '2. Renforcer', d: 'Isométriques légers puis haut du dos.', ex: [['Isometric_Neck_Exercise_-_Front_And_Back', '5 × 10 s, 30 % d’effort'], ['Isometric_Neck_Exercise_-_Sides', '5 × 10 s de chaque côté'], ['Band_Pull_Apart', '3 × 15'], ['Face_Pull', '3 × 15']] },
      { t: '3. Reprendre', d: 'Shrugs légers, amplitude contrôlée, sans rouler les épaules.', ex: [] },
    ],
  },
  pectoral: {
    label: 'Pectoral', muscles: ['pectoraux'],
    common: 'Tiraillement au développé couché, en bas du mouvement. Une douleur soudaine avec bleu sous l’aisselle peut être une déchirure.',
    flags: ['Claquement pendant un développé, bleu et creux dans le pectoral : consulte en urgence (rupture, chirurgie souvent nécessaire)'],
    adapt: 'Amplitude réduite (développé au sol), prise moins large, écarté à éviter quelques semaines.',
    phases: [
      { t: '1. Calmer', d: 'Isométriques doux sans douleur.', ex: [['Isometric_Chest_Squeezes', '5 × 20 s, 30 % d’effort']] },
      { t: '2. Recharger', d: 'Amplitude partielle puis complète, lent.', ex: [['Pushups', 'Sur les genoux puis classiques, 3 × 10'], ['Dumbbell_Floor_Press', '3 × 10, léger'], ['Dynamic_Chest_Stretch', '2 × 10 doux']] },
      { t: '3. Reprendre', d: 'Développé couché à 50 %, +10 % par semaine. Garde un tempo de 3 s en descente.', ex: [['Chest_And_Front_Of_Shoulder_Stretch', '2 × 30 s après la séance']] },
    ],
  },
};

// Routines de mobilité (5 à 8 min) : échauffement ou jours de repos
export const ROUTINES = [
  { key: 'haut', t: 'Avant le haut du corps', d: 'Épaules, thoracique, poignets', ex: [['Round_The_World_Shoulder_Stretch', '10'], ['x_thoracic', '8 / côté'], ['Band_Pull_Apart', '15'], ['External_Rotation_with_Band', '12 / côté'], ['x_wall_slide', '10'], ['Wrist_Circles', '10 / sens']] },
  { key: 'bas', t: 'Avant les jambes', d: 'Hanches, chevilles, fessiers', ex: [['x_9090', '8 / côté'], ['Worlds_Greatest_Stretch', '5 / côté'], ['x_ankle_knee', '10 / côté'], ['Monster_Walk', '15 pas'], ['Pelvic_Tilt_Into_Bridge', '10'], ['Bodyweight_Squat', '10 lents']] },
  { key: 'apres', t: 'Après la séance ou jour de repos', d: 'Étirements doux, 30 s chacun', ex: [['Kneeling_Hip_Flexor', '30 s / côté'], ['Hamstring_Stretch', '30 s'], ['x_pigeon', '30 s / côté'], ['Chest_And_Front_Of_Shoulder_Stretch', '30 s'], ['Childs_Pose', '45 s'], ['Calf_Stretch_Hands_Against_Wall', '30 s / côté']] },
  { key: 'dos', t: 'Dos raide (bureau, voiture)', d: 'Colonne, hanches, nuque', ex: [['Cat_Stretch', '10'], ['x_thoracic', '8 / côté'], ['x_dead_hang', '3 × 20 s'], ['x_chin_tuck', '10'], ['Childs_Pose', '45 s']] },
];
