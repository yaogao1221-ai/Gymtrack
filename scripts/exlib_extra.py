# Exercices modernes absents de free-exercise-db (v9) : noms, matériel, muscles et consignes en français, sans photo.
# Format : (id, nom, nom anglais, catégorie, matériel, type, muscles {clé: 1 principal | 0.5 secondaire}, niveau b/i/e, consignes)
Q, F, G, I, P, D, S, A = 'quadriceps', 'fessiers', 'ischios', 'mollets', 'pectoraux', 'dos_largeur', 'dos_epaisseur', 'abdominaux'
EA, EL, EP, T, B, AB, LO, TR = 'epaules_ant', 'epaules_lat', 'epaules_post', 'triceps', 'biceps', 'avant_bras', 'lombaires', 'trapezes'
AD, ABD = 'adducteurs', 'abducteurs'
W, BW = 'weighted', 'bodyweight'

EXTRA2 = [
    # ---- Jambes ----
    ('x_sissy_squat', 'Sissy squat (poids du corps)', 'Sissy Squat', 'muscu', 'Poids du corps', BW, {Q: 1}, 'i', [
        'Debout, tiens-toi d’une main à un support, pieds largeur de hanches, talons qui peuvent se décoller.',
        'Pousse les genoux vers l’avant et descends en penchant tout le corps en arrière : genoux, hanches et épaules restent alignés.',
        'Descends tant que tes genoux le tolèrent, puis remonte en contractant les quadriceps.',
        'Commence avec une petite amplitude : c’est très exigeant pour le tendon rotulien.']),
    ('x_sissy_machine', 'Sissy squat (machine / banc)', 'Sissy Squat Machine', 'muscu', 'Machine', BW, {Q: 1}, 'i', [
        'Bloque les tibias sous les rouleaux et les talons sur le repose-pied.',
        'Descends en laissant les genoux avancer, le buste reste droit et part en arrière.',
        'Remonte en poussant les genoux vers l’arrière, sans t’aider des bras.']),
    ('x_heel_elev_squat', 'Squat talons surélevés (haltères)', 'Heel-Elevated Goblet Squat', 'muscu', 'Haltères', W, {Q: 1, F: 0.5}, 'b', [
        'Talons sur une cale de 2 à 5 cm, haltère tenue contre la poitrine.',
        'Descends buste droit, genoux qui avancent loin au-dessus des orteils.',
        'Remonte en poussant dans tout le pied : l’accent est mis sur les quadriceps.']),
    ('x_cyclist_squat', 'Squat cycliste', 'Cyclist Squat', 'muscu', 'Haltères', W, {Q: 1}, 'i', [
        'Talons sur une cale haute, pieds serrés, haltères le long du corps ou contre la poitrine.',
        'Descends tout droit, genoux très en avant, buste vertical.',
        'Remonte sans verrouiller complètement les genoux pour garder la tension.']),
    ('x_bulgarian', 'Squat bulgare (haltères)', 'Bulgarian Split Squat', 'muscu', 'Haltères', W, {Q: 1, F: 1, AD: 0.5}, 'i', [
        'Dos au banc, pose le dessus du pied arrière dessus ; pied avant assez loin devant.',
        'Descends le genou arrière vers le sol, buste légèrement penché pour plus de fessiers, droit pour plus de quadriceps.',
        'Remonte en poussant dans le talon avant. Fais toutes les répétitions d’un côté, puis change.']),
    ('x_bulgarian_smith', 'Squat bulgare (Smith)', 'Smith Machine Bulgarian Split Squat', 'muscu', 'Barre', W, {Q: 1, F: 1}, 'i', [
        'Barre du Smith sur le haut du dos, pied arrière posé sur un banc.',
        'Descends sous contrôle jusqu’à ce que le genou arrière frôle le sol.',
        'Remonte en poussant dans le pied avant, sans rebond.']),
    ('x_belt_squat', 'Belt squat', 'Belt Squat', 'muscu', 'Machine', W, {Q: 1, F: 1, AD: 0.5}, 'i', [
        'Ceinture de lestage autour des hanches, charge accrochée entre les jambes (ou machine dédiée).',
        'Descends en squat, buste droit, sans charge sur la colonne.',
        'Remonte en poussant le sol. Idéal quand le dos ou les épaules sont fatigués.']),
    ('x_pendulum_squat', 'Pendulum squat', 'Pendulum Squat', 'muscu', 'Machine', W, {Q: 1, F: 0.5}, 'i', [
        'Épaules sous les coussins, dos plaqué, pieds au milieu de la plateforme.',
        'Descends profondément en laissant les genoux avancer.',
        'Remonte sans verrouiller les genoux en haut.']),
    ('x_ssb_squat', 'Squat barre de sécurité (SSB)', 'Safety Bar Squat', 'muscu', 'Barre', W, {Q: 1, F: 1, LO: 0.5, S: 0.5}, 'i', [
        'Barre de sécurité sur les trapèzes, mains sur les poignées devant toi.',
        'Descends en squat en gardant le haut du dos droit : la barre pousse vers l’avant.',
        'Remonte en poussant la nuque contre la barre.']),
    ('x_pause_squat', 'Squat avec pause (barre)', 'Pause Squat', 'muscu', 'Barre', W, {Q: 1, F: 1, LO: 0.5}, 'i', [
        'Squat classique, mais tiens 2 à 3 secondes en bas, gainage serré.',
        'Remonte sans rebond. Charge 15 à 20 % plus légère qu’au squat normal.']),
    ('x_cossack', 'Squat cosaque', 'Cossack Squat', 'muscu', 'Poids du corps', BW, {Q: 0.5, F: 1, AD: 1}, 'i', [
        'Pieds très écartés, pointes légèrement ouvertes.',
        'Descends sur une jambe pliée, l’autre tendue sur le côté, pointe vers le haut.',
        'Remonte et passe de l’autre côté. Tiens une haltère devant toi pour l’équilibre.']),
    ('x_curtsy_lunge', 'Fente croisée (curtsy)', 'Curtsy Lunge', 'muscu', 'Haltères', W, {F: 1, Q: 0.5, ABD: 0.5}, 'b', [
        'Debout, haltères en main.',
        'Recule une jambe en diagonale derrière l’autre, comme une révérence, et descends.',
        'Remonte en poussant dans le pied avant.']),
    ('x_reverse_nordic', 'Reverse nordic', 'Reverse Nordic Curl', 'muscu', 'Poids du corps', BW, {Q: 1}, 'i', [
        'À genoux sur un tapis, corps droit des genoux à la tête.',
        'Penche-toi en arrière lentement en gardant les hanches tendues.',
        'Reviens en contractant les quadriceps. Petite amplitude au début.']),
    ('x_slider_leg_curl', 'Leg curl glissé (au sol)', 'Sliding Leg Curl', 'muscu', 'Poids du corps', BW, {G: 1, F: 0.5}, 'b', [
        'Sur le dos, talons sur des patins (ou chaussettes sur parquet), bassin levé.',
        'Tends les jambes en gardant le bassin haut, puis ramène les talons vers les fesses.']),
    ('x_single_leg_rdl', 'Soulevé de terre roumain sur une jambe', 'Single-Leg Romanian Deadlift', 'muscu', 'Haltères', W, {G: 1, F: 1, LO: 0.5}, 'i', [
        'Debout sur une jambe, haltère dans la main opposée.',
        'Penche le buste en avant, jambe libre tendue derrière, dos plat, bassin bien horizontal.',
        'Remonte en serrant le fessier de la jambe d’appui.']),
    ('x_trap_bar_dl', 'Soulevé de terre barre hexagonale', 'Trap Bar Deadlift', 'muscu', 'Barre', W, {Q: 0.5, F: 1, G: 0.5, LO: 0.5, TR: 0.5}, 'b', [
        'Place-toi au centre de la barre hexagonale, mains sur les poignées.',
        'Hanches basses, dos plat, poitrine sortie.',
        'Pousse le sol pour te redresser, puis redescends en contrôlant.']),
    ('x_deficit_dl', 'Soulevé de terre en déficit', 'Deficit Deadlift', 'muscu', 'Barre', W, {G: 1, F: 1, LO: 1, Q: 0.5}, 'e', [
        'Debout sur une plateforme de 3 à 8 cm, barre au sol.',
        'Même technique que le soulevé de terre, dos plat : l’amplitude est plus grande.',
        'Charge plus légère que ton soulevé habituel.']),
    ('x_block_pull', 'Soulevé de terre partiel (blocs)', 'Block Pull', 'muscu', 'Barre', W, {LO: 1, F: 1, G: 0.5, TR: 0.5}, 'i', [
        'Barre posée sur des blocs, juste sous ou au-dessus des genoux.',
        'Dos plat, verrouille les hanches en fin de mouvement.']),
    ('x_kas_glute_bridge', 'Kas glute bridge (barre)', 'Kas Glute Bridge', 'muscu', 'Barre', W, {F: 1, G: 0.5}, 'i', [
        'Haut du dos sur un banc, barre sur les hanches (avec un coussin).',
        'Monte les hanches jusqu’à l’horizontale seulement, menton rentré, et serre les fessiers 1 s.',
        'Petite amplitude, tension constante.']),
    ('x_b_stance_hip_thrust', 'Hip thrust B-stance', 'B-Stance Hip Thrust', 'muscu', 'Barre', W, {F: 1, G: 0.5}, 'i', [
        'Position de hip thrust, un pied en appui, l’autre posé légèrement devant, sur le talon (béquille).',
        'Pousse surtout avec la jambe d’appui, puis change de côté.']),
    ('x_frog_pump', 'Frog pump', 'Frog Pump', 'muscu', 'Poids du corps', BW, {F: 1}, 'b', [
        'Sur le dos, plantes des pieds collées, genoux ouverts.',
        'Monte le bassin en serrant fort les fessiers, redescends. Séries longues.']),
    ('x_cable_pull_through', 'Pull-through à la poulie', 'Cable Pull-Through', 'muscu', 'Poulie', W, {F: 1, G: 1}, 'b', [
        'Dos à la poulie basse, corde entre les jambes.',
        'Recule les hanches en gardant le dos plat, puis pousse les hanches vers l’avant en serrant les fessiers.']),
    ('x_45_back_ext', 'Extension lombaire à 45° (fessiers)', '45-Degree Back Extension', 'muscu', 'Machine', BW, {F: 1, G: 1, LO: 0.5}, 'b', [
        'Hanches juste au bord du coussin, pieds bloqués.',
        'Descends le buste, puis remonte en poussant les hanches dans le coussin : arrête-toi quand le corps est aligné.',
        'Haut du dos légèrement arrondi pour cibler les fessiers.']),
    ('x_hip_abduction_machine', 'Abduction de hanche (machine)', 'Hip Abduction Machine', 'muscu', 'Machine', W, {ABD: 1, F: 1}, 'b', [
        'Assis, cuisses contre les coussins.',
        'Écarte les jambes, tiens 1 s, ramène lentement. Buste penché en avant pour plus de grand fessier.']),
    ('x_hip_adduction_machine', 'Adduction de hanche (machine)', 'Hip Adduction Machine', 'muscu', 'Machine', W, {AD: 1}, 'b', [
        'Assis, coussins contre l’intérieur des genoux.',
        'Serre les jambes, puis laisse-les s’ouvrir lentement jusqu’à un étirement confortable.']),
    ('x_cable_kickback', 'Kickback fessier à la poulie', 'Cable Glute Kickback', 'muscu', 'Poulie', W, {F: 1}, 'b', [
        'Sangle à la cheville, face à la poulie basse, mains en appui.',
        'Pousse la jambe vers l’arrière et légèrement vers l’extérieur, sans cambrer.']),
    ('x_standing_calf_machine', 'Mollets debout (machine)', 'Standing Calf Raise Machine', 'muscu', 'Machine', W, {I: 1}, 'b', [
        'Épaules sous les coussins, avant des pieds sur la marche.',
        'Descends les talons au maximum, pause 1 s, monte sur la pointe, pause 1 s.']),
    ('x_leg_press_calf', 'Mollets à la presse', 'Leg Press Calf Raise', 'muscu', 'Machine', W, {I: 1}, 'b', [
        'Pointe des pieds en bas de la plateforme, jambes presque tendues.',
        'Pousse avec les orteils, puis laisse revenir lentement en étirement.']),
    # ---- Dos ----
    ('x_pendlay_row', 'Rowing Pendlay (barre)', 'Pendlay Row', 'muscu', 'Barre', W, {S: 1, D: 0.5, EP: 0.5, B: 0.5}, 'i', [
        'Buste parallèle au sol, dos plat, barre posée au sol à chaque répétition.',
        'Tire la barre de façon explosive vers le bas de la poitrine, repose-la.']),
    ('x_seal_row', 'Seal row', 'Seal Row', 'muscu', 'Barre', W, {S: 1, D: 0.5, EP: 0.5}, 'i', [
        'Allongé à plat ventre sur un banc surélevé, barre ou haltères sous toi.',
        'Tire vers le banc sans décoller la poitrine : aucune triche possible.']),
    ('x_chest_supported_row', 'Rowing buste appuyé (haltères)', 'Chest-Supported Dumbbell Row', 'muscu', 'Haltères', W, {S: 1, D: 0.5, EP: 0.5, B: 0.5}, 'b', [
        'Poitrine contre un banc incliné à 30-45°, haltères bras tendus.',
        'Tire les coudes vers l’arrière, serre les omoplates, redescends lentement.']),
    ('x_meadows_row', 'Rowing Meadows (landmine)', 'Meadows Row', 'muscu', 'Barre', W, {D: 1, S: 1, B: 0.5}, 'i', [
        'Perpendiculaire à une barre en landmine, main en pronation sur le bout de la barre.',
        'Tire le coude haut et vers l’arrière, puis laisse la barre étirer le dos en bas.']),
    ('x_kroc_row', 'Rowing Kroc (haltère lourde)', 'Kroc Row', 'muscu', 'Haltères', W, {D: 1, S: 1, B: 0.5, AB: 0.5}, 'e', [
        'Une main sur un support, haltère lourde dans l’autre.',
        'Séries longues (15-25), un peu d’élan accepté sur la fin, mais dos toujours plat.']),
    ('x_machine_row', 'Rowing assis (machine)', 'Seated Machine Row', 'muscu', 'Machine', W, {S: 1, D: 0.5, EP: 0.5, B: 0.5}, 'b', [
        'Poitrine contre l’appui, poignées bras tendus.',
        'Tire en serrant les omoplates, coudes près du corps ou écartés selon la poignée.']),
    ('x_machine_row_1arm', 'Rowing assis à un bras (machine)', 'Single-Arm Seated Machine Row', 'muscu', 'Machine', W, {S: 1, D: 1, EP: 0.5, B: 0.5}, 'b', [
        'Poitrine contre l’appui, une poignée bras tendu, l’autre main sur la machine.',
        'Tire le coude vers la hanche sans tourner le buste, redescends en contrôlant.']),
    ('x_machine_row_wide', 'Rowing assis prise large (machine)', 'Wide-Grip Seated Machine Row', 'muscu', 'Machine', W, {S: 1, EP: 1, D: 0.5, B: 0.5}, 'b', [
        'Poitrine contre l’appui, poignées larges, coudes à hauteur des épaules.',
        'Tire les coudes vers l’arrière et vers l’extérieur, serre les omoplates.']),
    ('x_machine_row_neutral', 'Rowing assis prise neutre (machine)', 'Neutral-Grip Seated Machine Row', 'muscu', 'Machine', W, {S: 1, D: 1, B: 0.5}, 'b', [
        'Poitrine contre l’appui, paumes face à face.',
        'Tire les coudes le long du corps jusqu’aux hanches, marque une pause, reviens lentement.']),
    ('x_tbar_machine', 'Rowing T-bar buste appuyé (machine)', 'Chest-Supported T-Bar Row Machine', 'muscu', 'Machine', W, {S: 1, D: 1, EP: 0.5, B: 0.5}, 'i', [
        'Poitrine sur l’appui incliné, pieds sur la plateforme, poignées bras tendus.',
        'Tire jusqu’à ce que les poignées touchent presque l’appui, redescends sans rebond.']),
    ('x_low_row_machine', 'Rowing bas (machine)', 'Low Row Machine', 'muscu', 'Machine', W, {D: 1, S: 1, B: 0.5}, 'b', [
        'Assis, poitrine contre l’appui, poignées basses bras tendus.',
        'Tire vers le bas du ventre en gardant les épaules basses, reviens en étirant le dos.']),
    ('x_high_row_machine', 'Rowing haut (machine)', 'High Row Machine', 'muscu', 'Machine', W, {D: 1, S: 0.5, EP: 0.5, B: 0.5}, 'b', [
        'Assis, cuisses bloquées, poignées hautes devant toi.',
        'Tire vers le bas et l’arrière jusqu’aux épaules, reviens bras tendus.']),
    ('x_single_arm_pulldown', 'Tirage vertical à un bras (poulie)', 'Single-Arm Lat Pulldown', 'muscu', 'Poulie', W, {D: 1, B: 0.5}, 'i', [
        'Assis ou à genoux, une poignée à la poulie haute.',
        'Tire le coude vers la hanche en gardant le buste stable, étire bien en haut.']),
    ('x_lat_prayer', 'Pull-over à la poulie (bras tendus)', 'Cable Lat Prayer', 'muscu', 'Poulie', W, {D: 1}, 'b', [
        'Face à la poulie haute, corde ou barre, bras presque tendus, buste penché.',
        'Ramène les mains vers les cuisses en serrant les dorsaux, sans plier les coudes.']),
    ('x_neutral_pullup', 'Traction prise neutre', 'Neutral-Grip Pull-Up', 'muscu', 'Poids du corps', BW, {D: 1, B: 0.5, S: 0.5}, 'i', [
        'Paumes face à face sur les poignées parallèles.',
        'Monte la poitrine vers les poignées, descends bras tendus.']),
    ('x_muscle_up_bar', 'Muscle-up à la barre', 'Bar Muscle-Up', 'crossfit', 'Poids du corps', BW, {D: 1, T: 1, P: 0.5}, 'e', [
        'Traction explosive jusqu’à la poitrine, en ramenant les hanches vers la barre.',
        'Bascule les poignets par-dessus la barre et pousse jusqu’à bras tendus.']),
    # ---- Pectoraux ----
    ('x_pec_deck', 'Pec deck (butterfly machine)', 'Pec Deck', 'muscu', 'Machine', W, {P: 1, EA: 0.5}, 'b', [
        'Assis, dos plaqué, avant-bras ou mains sur les poignées à hauteur de poitrine.',
        'Ramène les bras devant toi, serre 1 s, ouvre lentement jusqu’à l’étirement.']),
    ('x_cable_fly_low_high', 'Écarté poulie bas vers haut', 'Low-to-High Cable Fly', 'muscu', 'Poulie', W, {P: 1, EA: 0.5}, 'b', [
        'Poulies basses, un pas en avant, bras légèrement fléchis.',
        'Monte les mains vers le haut et le centre, à hauteur du menton : cible le haut des pectoraux.']),
    ('x_cable_fly_high_low', 'Écarté poulie haut vers bas', 'High-to-Low Cable Fly', 'muscu', 'Poulie', W, {P: 1}, 'b', [
        'Poulies hautes, buste légèrement penché.',
        'Ramène les mains vers le bas devant les hanches : cible le bas des pectoraux.']),
    ('x_larsen_press', 'Développé couché Larsen', 'Larsen Press', 'muscu', 'Barre', W, {P: 1, T: 0.5, EA: 0.5}, 'i', [
        'Développé couché jambes tendues ou décollées, sans appui des pieds.',
        'Charge plus légère : la stabilité doit venir du haut du corps.']),
    ('x_spoto_press', 'Développé Spoto', 'Spoto Press', 'muscu', 'Barre', W, {P: 1, T: 0.5, EA: 0.5}, 'e', [
        'Développé couché : arrête la barre 2 à 3 cm au-dessus de la poitrine, pause 1 s.',
        'Repousse sans toucher la poitrine.']),
    ('x_close_grip_bench', 'Développé couché prise serrée', 'Close-Grip Bench Press', 'muscu', 'Barre', W, {T: 1, P: 0.5, EA: 0.5}, 'i', [
        'Mains à largeur d’épaules (pas plus serré), coudes près du corps.',
        'Descends la barre sur le bas des pectoraux, pousse en verrouillant les coudes.']),
    ('x_machine_chest_press', 'Développé machine convergente', 'Converging Chest Press Machine', 'muscu', 'Machine', W, {P: 1, T: 0.5, EA: 0.5}, 'b', [
        'Poignées à hauteur du milieu de la poitrine, omoplates serrées.',
        'Pousse jusqu’à bras presque tendus, reviens lentement en étirement.']),
    ('x_deficit_pushup', 'Pompes en déficit', 'Deficit Push-Up', 'muscu', 'Poids du corps', BW, {P: 1, T: 0.5, EA: 0.5}, 'i', [
        'Mains sur deux supports (haltères, plaques) pour descendre plus bas que les mains.',
        'Descends la poitrine sous le niveau des mains, remonte gainé.']),
    # ---- Épaules ----
    ('x_cable_lateral', 'Élévations latérales à la poulie', 'Cable Lateral Raise', 'muscu', 'Poulie', W, {EL: 1}, 'b', [
        'Poulie basse, poignée dans la main opposée, câble devant ou derrière toi.',
        'Monte le bras sur le côté jusqu’à l’horizontale, redescends lentement.']),
    ('x_lean_away_lateral', 'Élévation latérale penché (haltère)', 'Lean-Away Lateral Raise', 'muscu', 'Haltères', W, {EL: 1}, 'b', [
        'Tiens-toi d’une main à un poteau et penche-toi sur le côté.',
        'Monte l’haltère sur le côté : la tension est plus forte en bas du mouvement.']),
    ('x_machine_lateral', 'Élévations latérales (machine)', 'Machine Lateral Raise', 'muscu', 'Machine', W, {EL: 1}, 'b', [
        'Coudes contre les coussins, épaules alignées avec l’axe de la machine.',
        'Monte jusqu’à l’horizontale, pause, redescends lentement.']),
    ('x_y_raise', 'Y-raise (banc incliné)', 'Incline Y-Raise', 'muscu', 'Haltères', W, {EL: 0.5, TR: 1, EP: 0.5}, 'b', [
        'À plat ventre sur un banc incliné, petites haltères.',
        'Monte les bras en Y, pouces vers le haut, sans hausser les épaules.']),
    ('x_lu_raise', 'Lu raise', 'Lu Raise', 'muscu', 'Haltères', W, {EL: 1, EA: 0.5, TR: 0.5}, 'i', [
        'Debout, bras tendus, très petites haltères.',
        'Monte les bras sur les côtés jusqu’au-dessus de la tête, sans plier les coudes.']),
    ('x_reverse_pec_deck', 'Pec deck inversé (arrière d’épaule)', 'Reverse Pec Deck', 'muscu', 'Machine', W, {EP: 1, S: 0.5}, 'b', [
        'Face à la machine, poignées à hauteur des épaules.',
        'Ouvre les bras vers l’arrière en gardant les coudes légèrement fléchis.']),
    ('x_cable_rear_delt', 'Oiseau à la poulie (croisé)', 'Cable Rear Delt Fly', 'muscu', 'Poulie', W, {EP: 1}, 'b', [
        'Poulies à hauteur d’épaules, câbles croisés (main droite tient le câble gauche).',
        'Ouvre les bras vers l’arrière à hauteur d’épaules.']),
    ('x_landmine_press', 'Développé landmine (un bras)', 'Landmine Press', 'muscu', 'Barre', W, {EA: 1, P: 0.5, T: 0.5}, 'b', [
        'Bout de la barre en landmine à hauteur d’épaule, debout ou à genoux.',
        'Pousse vers le haut et l’avant, gainage serré. Doux pour les épaules.']),
    ('x_z_press', 'Z press (assis au sol)', 'Z Press', 'muscu', 'Barre', W, {EA: 1, T: 0.5, A: 0.5}, 'e', [
        'Assis au sol, jambes tendues, barre ou haltères aux épaules.',
        'Pousse au-dessus de la tête sans t’appuyer en arrière.']),
    ('x_kelso_shrug', 'Kelso shrug', 'Kelso Shrug', 'muscu', 'Haltères', W, {TR: 1, S: 0.5}, 'i', [
        'Buste appuyé sur un banc incliné, bras tendus.',
        'Serre les omoplates vers l’arrière sans plier les coudes, tiens 1 s.']),
    ('x_cuban_rotation', 'Rotation cubaine', 'Cuban Rotation', 'muscu', 'Haltères', W, {EP: 1, TR: 0.5}, 'b', [
        'Très petites haltères, coudes montés à hauteur d’épaules à 90°.',
        'Tourne les avant-bras vers le haut, puis pousse au-dessus de la tête.']),
    # ---- Bras ----
    ('x_bayesian_curl', 'Curl bayésien (poulie derrière)', 'Bayesian Cable Curl', 'muscu', 'Poulie', W, {B: 1}, 'b', [
        'Dos à la poulie basse, un pas en avant, bras tendu légèrement derrière le corps.',
        'Plie le coude sans avancer l’épaule : le biceps travaille en étirement.',
        'Redescends lentement jusqu’à sentir l’étirement.']),
    ('x_cable_curl_bar', 'Curl à la poulie basse (barre)', 'Cable Bar Curl', 'muscu', 'Poulie', W, {B: 1, AB: 0.5}, 'b', [
        'Face à la poulie basse, barre droite ou EZ.',
        'Plie les coudes sans les avancer, serre en haut, redescends lentement.']),
    ('x_curl_21', 'Curl 21', '21s Curl', 'muscu', 'Barre', W, {B: 1}, 'i', [
        '7 répétitions du bas jusqu’à mi-course, 7 de mi-course jusqu’en haut, 7 complètes.',
        'Sans pause entre les trois parties. Charge légère.']),
    ('x_preacher_db', 'Curl pupitre (haltère, un bras)', 'Single-Arm Dumbbell Preacher Curl', 'muscu', 'Haltères', W, {B: 1}, 'b', [
        'Bras posé sur le pupitre, aisselle en haut du coussin.',
        'Monte l’haltère, puis redescends lentement jusqu’à bras presque tendu.']),
    ('x_rope_pushdown', 'Extension triceps à la corde (poulie haute)', 'Rope Triceps Pushdown', 'muscu', 'Poulie', W, {T: 1}, 'b', [
        'Coudes collés au corps, corde à la poulie haute.',
        'Pousse vers le bas et écarte les mains en fin de mouvement.']),
    ('x_cable_oh_ext', 'Extension triceps au-dessus de la tête (poulie)', 'Overhead Cable Triceps Extension', 'muscu', 'Poulie', W, {T: 1}, 'b', [
        'Dos à la poulie, corde derrière la tête, coudes vers le plafond.',
        'Tends les bras vers l’avant et le haut, reviens en étirement : cible la longue portion.']),
    ('x_katana_ext', 'Extension triceps katana (poulie, un bras)', 'Katana Triceps Extension', 'muscu', 'Poulie', W, {T: 1}, 'i', [
        'Poulie basse, poignée tenue au niveau de l’épaule opposée, coude en l’air.',
        'Tends le bras en diagonale vers le haut, comme dégainer un sabre.']),
    ('x_jm_press_smith', 'JM press (Smith)', 'Smith Machine JM Press', 'muscu', 'Barre', W, {T: 1, P: 0.5}, 'e', [
        'Allongé sous le Smith, prise serrée.',
        'Descends la barre vers le menton en avançant les coudes, puis pousse.']),
    ('x_french_press', 'Barre au front (barre EZ)', 'EZ-Bar French Press', 'muscu', 'Barre EZ', W, {T: 1}, 'i', [
        'Allongé, barre EZ bras tendus au-dessus du front.',
        'Plie les coudes pour amener la barre derrière le front, coudes fixes, puis tends.']),
    ('x_reverse_curl_ez', 'Curl inversé (barre EZ)', 'Reverse EZ-Bar Curl', 'muscu', 'Barre EZ', W, {AB: 1, B: 0.5}, 'b', [
        'Prise en pronation (paumes vers le bas).',
        'Plie les coudes sans bouger les épaules, redescends lentement.']),
    # ---- Gainage ----
    ('x_ab_wheel', 'Roulette abdominale', 'Ab Wheel Rollout', 'muscu', 'Autre', BW, {A: 1, D: 0.5}, 'i', [
        'À genoux, mains sur la roulette sous les épaules.',
        'Roule vers l’avant en gardant le dos plat et les fesses serrées, aussi loin que tu restes gainé.',
        'Reviens en contractant les abdominaux.']),
    ('x_hollow_hold', 'Hollow hold', 'Hollow Body Hold', 'muscu', 'Poids du corps', BW, {A: 1}, 'b', [
        'Sur le dos, bas du dos plaqué au sol.',
        'Décolle épaules et jambes, bras tendus derrière la tête, et tiens.']),
    ('x_dead_bug', 'Dead bug', 'Dead Bug', 'muscu', 'Poids du corps', BW, {A: 1}, 'b', [
        'Sur le dos, bras vers le plafond, genoux à 90°.',
        'Tends un bras et la jambe opposée sans décoller le bas du dos, reviens, change.']),
    ('x_cable_crunch', 'Crunch à la poulie (à genoux)', 'Kneeling Cable Crunch', 'muscu', 'Poulie', W, {A: 1}, 'b', [
        'À genoux face à la poulie haute, corde tenue près de la tête.',
        'Enroule le buste vers les cuisses en arrondissant le dos, hanches fixes.']),
    ('x_captain_chair', 'Relevés de jambes (chaise romaine)', 'Captain’s Chair Leg Raise', 'muscu', 'Machine', BW, {A: 1}, 'b', [
        'Avant-bras sur les appuis, dos contre le dossier.',
        'Monte les genoux vers la poitrine en enroulant le bassin, redescends sans balancer.']),
    ('x_woodchop', 'Bûcheron à la poulie', 'Cable Woodchop', 'muscu', 'Poulie', W, {A: 1}, 'b', [
        'De profil à la poulie haute, bras tendus.',
        'Tire en diagonale vers la hanche opposée en tournant le buste, pieds stables.']),
    ('x_suitcase_carry', 'Marche du valise (un bras)', 'Suitcase Carry', 'muscu', 'Haltères', W, {A: 1, AB: 1, TR: 0.5}, 'b', [
        'Une haltère ou kettlebell lourde dans une seule main.',
        'Marche en restant parfaitement droit, sans pencher du côté de la charge.']),
    ('x_dragon_flag', 'Dragon flag', 'Dragon Flag', 'muscu', 'Poids du corps', BW, {A: 1}, 'e', [
        'Allongé sur un banc, mains agrippées derrière la tête.',
        'Monte le corps droit sur les épaules, puis redescends lentement sans plier les hanches.']),
    ('x_l_sit', 'L-sit', 'L-Sit', 'crossfit', 'Poids du corps', BW, {A: 1, T: 0.5}, 'i', [
        'Mains sur des parallettes ou le sol, bras tendus.',
        'Décolle les fesses, jambes tendues à l’horizontale, et tiens.']),
    # ---- Cardio / conditionnement ----
    ('x_assault_bike', 'Vélo à air (assault bike)', 'Air Bike', 'cardio', 'Machine', BW, {Q: 0.5}, 'b', [
        'Pousse et tire les poignées en pédalant : bras et jambes travaillent ensemble.',
        'Idéal en intervalles courts (10 à 30 s).']),
    ('x_ski_erg', 'Ski erg', 'SkiErg', 'cardio', 'Machine', BW, {D: 0.5, T: 0.5, A: 0.5}, 'b', [
        'Bras en haut, tire les poignées vers le bas en fléchissant les hanches.',
        'Remonte et recommence en rythme.']),
    ('x_sled_push', 'Poussée de traîneau', 'Sled Push', 'crossfit', 'Autre', W, {Q: 1, F: 0.5, I: 0.5}, 'b', [
        'Mains sur les montants, buste incliné, bras tendus.',
        'Pousse à petits pas rapides et puissants. Aucune phase excentrique : peu de courbatures.']),
    ('x_broad_jump', 'Saut en longueur sans élan', 'Broad Jump', 'crossfit', 'Poids du corps', BW, {Q: 1, F: 1}, 'i', [
        'Pieds largeur de hanches, balance les bras.',
        'Saute le plus loin possible et atterris en douceur, genoux fléchis.']),
]

# Schéma de mouvement corrigé quand la détection par le nom anglais se trompe
# ---- Calisthenics (v10) : poids du corps, avec des échelles de progression (pv / nx) ----
CAL = [
    ('x_incline_pushup', 'Pompes inclinées (mains surélevées)', 'Incline Push-Up', 'calisthenics', 'Poids du corps', BW, {P: 1, T: 0.5, EA: 0.5}, 'b', [
        'Mains sur un banc ou une barre, corps gainé de la tête aux talons.',
        'Descends la poitrine vers l’appui, coudes à 45° du corps, puis pousse. Plus l’appui est bas, plus c’est dur.']),
    ('x_knee_pushup', 'Pompes sur les genoux', 'Knee Push-Up', 'calisthenics', 'Poids du corps', BW, {P: 1, T: 0.5, EA: 0.5}, 'b', [
        'Genoux au sol, hanches dans l’alignement du buste.',
        'Descends jusqu’à frôler le sol avec la poitrine, remonte sans casser les hanches.']),
    ('x_decline_pushup', 'Pompes déclinées (pieds surélevés)', 'Decline Push-Up', 'calisthenics', 'Poids du corps', BW, {P: 1, EA: 1, T: 0.5}, 'i', [
        'Pieds sur un banc, mains au sol un peu plus larges que les épaules.',
        'Descends le haut de la poitrine vers le sol en gardant le gainage, puis pousse.']),
    ('x_diamond_pushup', 'Pompes diamant', 'Diamond Push-Up', 'calisthenics', 'Poids du corps', BW, {T: 1, P: 0.5, EA: 0.5}, 'i', [
        'Mains rapprochées sous la poitrine, pouces et index qui forment un losange.',
        'Coudes le long du corps, descends jusqu’aux mains, pousse en contractant les triceps.']),
    ('x_archer_pushup', 'Pompes archer', 'Archer Push-Up', 'calisthenics', 'Poids du corps', BW, {P: 1, T: 0.5, EA: 0.5}, 'e', [
        'Mains très écartées. Descends vers une main en gardant l’autre bras tendu sur le côté.',
        'Remonte et alterne. Étape vers la pompe à un bras.']),
    ('x_one_arm_pushup', 'Pompe à un bras', 'One-Arm Push-Up', 'calisthenics', 'Poids du corps', BW, {P: 1, T: 1, A: 0.5}, 'e', [
        'Pieds écartés, une main sous l’épaule, l’autre dans le dos.',
        'Descends en gardant les hanches face au sol, remonte sans tourner le buste.']),
    ('x_pike_pushup', 'Pompes piquées (pike push-up)', 'Pike Push-Up', 'calisthenics', 'Poids du corps', BW, {EA: 1, T: 0.5, EL: 0.5}, 'i', [
        'Hanches hautes, corps en V inversé, mains largeur d’épaules.',
        'Descends le sommet de la tête vers le sol devant les mains, puis pousse. Prépare le handstand push-up.']),
    ('x_elevated_pike_pushup', 'Pompes piquées pieds surélevés', 'Elevated Pike Push-Up', 'calisthenics', 'Poids du corps', BW, {EA: 1, T: 0.5, EL: 0.5}, 'e', [
        'Pieds sur une box, hanches au-dessus des épaules, buste presque vertical.',
        'Descends la tête vers le sol en contrôlant, pousse jusqu’aux bras tendus.']),
    ('x_wall_handstand', 'Équilibre contre le mur (tenue)', 'Wall Handstand Hold', 'calisthenics', 'Poids du corps', BW, {EA: 1, T: 0.5, TR: 0.5, A: 0.5}, 'i', [
        'Face au mur, monte en marchant avec les pieds, mains à 10-20 cm du mur.',
        'Bras tendus, épaules poussées vers les oreilles, corps gainé. Tiens 20 à 60 s.']),
    ('x_pseudo_planche_pushup', 'Pompes pseudo-planche', 'Pseudo Planche Push-Up', 'calisthenics', 'Poids du corps', BW, {EA: 1, P: 1, T: 0.5}, 'e', [
        'Mains au niveau des hanches, doigts tournés vers l’extérieur, épaules penchées en avant des mains.',
        'Garde cette inclinaison pendant toute la pompe. Prépare la planche.']),
    ('x_planche_lean', 'Planche lean', 'Planche Lean', 'calisthenics', 'Poids du corps', BW, {EA: 1, P: 0.5, A: 0.5}, 'i', [
        'Position de pompe, bras tendus, penche les épaules en avant des mains.',
        'Omoplates écartées, bassin rentré, tiens 15 à 30 s.']),
    ('x_tuck_planche', 'Planche groupée (tuck planche)', 'Tuck Planche', 'calisthenics', 'Poids du corps', BW, {EA: 1, P: 0.5, A: 1, T: 0.5}, 'e', [
        'Mains au sol ou sur parallettes, genoux rentrés contre la poitrine.',
        'Penche-toi en avant jusqu’à décoller les pieds, bras tendus, dos arrondi. Tiens 5 à 15 s.']),
    ('x_parallel_dips', 'Dips aux barres parallèles', 'Parallel Bar Dips', 'calisthenics', 'Poids du corps', BW, {P: 1, T: 1, EA: 0.5}, 'i', [
        'En appui bras tendus, épaules basses.',
        'Descends jusqu’à ce que les épaules passent légèrement sous les coudes, buste un peu penché, puis pousse.']),
    ('x_support_hold', 'Tenue en appui aux barres', 'Parallel Bar Support Hold', 'calisthenics', 'Poids du corps', BW, {T: 0.5, P: 0.5, TR: 0.5, A: 0.5}, 'b', [
        'Bras tendus sur les barres, épaules poussées vers le bas, corps gainé.',
        'Tiens 20 à 45 s. Première étape avant les dips.']),
    ('x_ring_dips', 'Dips aux anneaux', 'Ring Dips', 'calisthenics', 'Anneaux', BW, {P: 1, T: 1, EA: 0.5}, 'e', [
        'En appui sur les anneaux, anneaux serrés contre le corps.',
        'Descends sous les coudes en contrôlant le tremblement, pousse jusqu’aux bras tendus en tournant les anneaux vers l’extérieur.']),
    ('x_ring_pushup', 'Pompes aux anneaux', 'Ring Push-Up', 'calisthenics', 'Anneaux', BW, {P: 1, T: 0.5, EA: 0.5}, 'i', [
        'Anneaux bas, corps gainé, comme une pompe classique.',
        'Garde les anneaux près du corps en descendant, pousse et écarte légèrement les mains en haut.']),
    ('x_negative_pullup', 'Traction négative', 'Negative Pull-Up', 'calisthenics', 'Poids du corps', BW, {D: 1, B: 0.5, S: 0.5}, 'b', [
        'Monte en haut de la barre avec un saut ou une box, menton au-dessus.',
        'Descends en 3 à 5 s jusqu’aux bras tendus. Première étape vers la traction.']),
    ('x_archer_pullup', 'Traction archer', 'Archer Pull-Up', 'calisthenics', 'Poids du corps', BW, {D: 1, B: 1, S: 0.5}, 'e', [
        'Prise très large. Tire vers une main en gardant l’autre bras presque tendu.',
        'Alterne les côtés. Étape vers la traction à un bras.']),
    ('x_typewriter_pullup', 'Traction typewriter', 'Typewriter Pull-Up', 'calisthenics', 'Poids du corps', BW, {D: 1, B: 1, S: 0.5}, 'e', [
        'Monte en traction prise large, puis déplace-toi d’une main à l’autre en restant en haut.',
        'Redescends en contrôlant.']),
    ('x_chin_hold', 'Tenue menton au-dessus de la barre', 'Flexed-Arm Hang', 'calisthenics', 'Poids du corps', BW, {D: 0.5, B: 1, AB: 0.5}, 'b', [
        'Menton au-dessus de la barre, coudes serrés, épaules basses.',
        'Tiens 10 à 30 s. Renforce le haut de la traction.']),
    ('x_active_hang', 'Suspension active', 'Active Hang', 'calisthenics', 'Poids du corps', BW, {D: 0.5, TR: 0.5, AB: 1}, 'b', [
        'Suspendu bras tendus, tire les épaules vers le bas sans plier les coudes.',
        'Tiens 20 à 45 s. Protège les épaules et renforce la prise.']),
    ('x_tuck_front_lever', 'Front lever groupé', 'Tuck Front Lever', 'calisthenics', 'Poids du corps', BW, {D: 1, A: 1, S: 0.5}, 'e', [
        'Suspendu, genoux rentrés, monte le bassin jusqu’à avoir le dos horizontal, bras tendus.',
        'Pousse la barre vers les hanches. Tiens 5 à 15 s.']),
    ('x_adv_tuck_front_lever', 'Front lever groupé avancé', 'Advanced Tuck Front Lever', 'calisthenics', 'Poids du corps', BW, {D: 1, A: 1, S: 0.5}, 'e', [
        'Comme le front lever groupé, mais dos plat et cuisses à 90° du buste.',
        'Tiens 5 à 10 s, bras tendus.']),
    ('x_front_lever', 'Front lever', 'Front Lever', 'calisthenics', 'Poids du corps', BW, {D: 1, A: 1, S: 1, LO: 0.5}, 'e', [
        'Suspendu, corps tendu à l’horizontale, face vers le haut, bras tendus.',
        'Tiens 3 à 10 s en serrant fessiers et abdos.']),
    ('x_skin_the_cat', 'Skin the cat', 'Skin the Cat', 'calisthenics', 'Anneaux', BW, {D: 0.5, EA: 0.5, A: 1}, 'i', [
        'Suspendu, passe les jambes entre les bras et tourne vers l’arrière jusqu’à étirer les épaules.',
        'Reviens lentement. Doux pour la mobilité des épaules, à faire sans douleur.']),
    ('x_tuck_back_lever', 'Back lever groupé', 'Tuck Back Lever', 'calisthenics', 'Anneaux', BW, {EA: 0.5, B: 0.5, A: 1, P: 0.5}, 'e', [
        'Depuis le skin the cat, arrête-toi dos horizontal face au sol, genoux rentrés.',
        'Tiens 5 à 10 s, bras tendus.']),
    ('x_ring_muscle_up', 'Muscle-up aux anneaux', 'Ring Muscle-Up', 'calisthenics', 'Anneaux', BW, {D: 1, P: 0.5, T: 1, B: 0.5}, 'e', [
        'Prise en faux (poignets au-dessus des anneaux), tire jusqu’à la poitrine.',
        'Bascule le buste au-dessus des anneaux, puis pousse en dips jusqu’aux bras tendus.']),
    ('x_shrimp_squat', 'Shrimp squat', 'Shrimp Squat', 'calisthenics', 'Poids du corps', BW, {Q: 1, F: 1}, 'e', [
        'Sur une jambe, tiens l’autre pied derrière toi.',
        'Descends jusqu’à poser le genou arrière au sol, remonte sans t’aider.']),
    ('x_skater_squat', 'Squat patineur', 'Skater Squat', 'calisthenics', 'Poids du corps', BW, {Q: 1, F: 1, ABD: 0.5}, 'i', [
        'Sur une jambe, l’autre pliée derrière, bras devant pour l’équilibre.',
        'Descends le genou arrière vers le sol, remonte en poussant dans le talon.']),
    ('x_assisted_pistol', 'Pistol squat assisté', 'Assisted Pistol Squat', 'calisthenics', 'Poids du corps', BW, {Q: 1, F: 1}, 'i', [
        'Sur une jambe, tiens un poteau ou une sangle, l’autre jambe tendue devant.',
        'Descends le plus bas possible en contrôlant, remonte en t’aidant le moins possible.']),
    ('x_jump_squat', 'Squat sauté', 'Jump Squat', 'calisthenics', 'Poids du corps', BW, {Q: 1, F: 1, I: 0.5}, 'b', [
        'Descends en squat, puis saute le plus haut possible.',
        'Réceptionne-toi en douceur, genoux dans l’axe des pieds.']),
    ('x_wall_sit', 'Chaise contre le mur', 'Wall Sit', 'calisthenics', 'Poids du corps', BW, {Q: 1}, 'b', [
        'Dos au mur, cuisses parallèles au sol, genoux à 90°.',
        'Tiens 30 à 90 s. Doux pour les genoux douloureux (isométrique).']),
    ('x_single_leg_bridge', 'Pont fessier sur une jambe', 'Single-Leg Glute Bridge', 'calisthenics', 'Poids du corps', BW, {F: 1, I: 0.5}, 'b', [
        'Sur le dos, un pied au sol, l’autre jambe tendue.',
        'Monte le bassin en poussant dans le talon, serre le fessier 1 s en haut.']),
    ('x_single_leg_calf', 'Mollets sur une jambe', 'Single-Leg Calf Raise', 'calisthenics', 'Poids du corps', BW, {I: 1}, 'b', [
        'Sur une marche, une seule jambe, talon dans le vide.',
        'Monte sur la pointe, descends lentement sous la marche.']),
    ('x_tuck_l_sit', 'L-sit groupé', 'Tuck L-Sit', 'calisthenics', 'Poids du corps', BW, {A: 1, T: 0.5}, 'b', [
        'Mains au sol ou sur les barres, bras tendus, épaules basses.',
        'Décolle les fesses et monte les genoux contre la poitrine. Tiens 10 à 20 s.']),
    ('x_v_sit', 'V-sit', 'V-Sit', 'calisthenics', 'Poids du corps', BW, {A: 1, T: 0.5, EA: 0.5}, 'e', [
        'Depuis le L-sit, monte les jambes tendues au-dessus de l’horizontale.',
        'Pousse fort dans les mains, épaules en arrière. Tiens 3 à 10 s.']),
    ('x_hanging_knee_raise', 'Relevé de genoux suspendu', 'Hanging Knee Raise', 'calisthenics', 'Poids du corps', BW, {A: 1}, 'b', [
        'Suspendu, épaules actives.',
        'Monte les genoux vers la poitrine en enroulant le bassin, redescends sans balancer.']),
    ('x_toes_to_bar', 'Pieds à la barre', 'Toes to Bar', 'calisthenics', 'Poids du corps', BW, {A: 1, D: 0.5}, 'e', [
        'Suspendu, jambes tendues.',
        'Monte les pieds jusqu’à toucher la barre, redescends en contrôlant.']),
    ('x_windshield_wipers', 'Essuie-glaces suspendu', 'Hanging Windshield Wipers', 'calisthenics', 'Poids du corps', BW, {A: 1}, 'e', [
        'Suspendu, jambes montées à la verticale.',
        'Fais tourner les jambes d’un côté à l’autre en contrôlant, sans balancer.']),
    ('x_arch_hold', 'Arch hold (superman tenu)', 'Arch Body Hold', 'calisthenics', 'Poids du corps', BW, {LO: 1, F: 0.5, EP: 0.5}, 'b', [
        'Sur le ventre, bras tendus devant, décolle bras et jambes.',
        'Fessiers serrés, regard vers le sol. Tiens 20 à 40 s. Complément du hollow hold.']),
    ('x_tuck_human_flag', 'Drapeau humain groupé', 'Tuck Human Flag', 'calisthenics', 'Poids du corps', BW, {A: 1, D: 1, EL: 0.5}, 'e', [
        'Mains sur un poteau, bras du bas tendu qui pousse, bras du haut qui tire.',
        'Monte les genoux et décolle le corps sur le côté. Tiens 3 à 10 s.']),
    ('x_crow_pose', 'Corbeau (crow pose)', 'Crow Pose', 'calisthenics', 'Poids du corps', BW, {EA: 0.5, T: 0.5, A: 1, AB: 0.5}, 'b', [
        'Accroupi, mains au sol, genoux posés sur l’arrière des bras.',
        'Penche-toi en avant jusqu’à décoller les pieds. Tiens 10 à 30 s. Base de l’équilibre sur les mains.']),
]
EXTRA2 += CAL
# Exercices au poids du corps déjà présents, classés aussi en calisthenics
CAL_TAG = ['Pullups', 'Chin-Up', 'Dips_-_Triceps_Version', 'Bench_Dips', 'Inverted_Row', 'Handstand_Push-Ups', 'Hanging_Leg_Raise', 'Scapular_Pull-Up', 'Pushups', 'Band_Assisted_Pull-Up',
    'x_hspu', 'x_pistol', 'x_nordic', 'x_sissy_squat', 'x_reverse_nordic', 'x_neutral_pullup', 'x_muscle_up_bar', 'x_hollow_hold', 'x_dragon_flag', 'x_l_sit', 'x_dead_hang', 'x_cossack']
# Échelles de progression : chaque exercice connaît le précédent (plus facile) et le suivant (plus dur)
LADDERS = [
    ['x_incline_pushup', 'x_knee_pushup', 'Pushups', 'x_decline_pushup', 'x_archer_pushup', 'x_one_arm_pushup'],
    ['x_pike_pushup', 'x_elevated_pike_pushup', 'x_wall_handstand', 'x_hspu'],
    ['x_planche_lean', 'x_pseudo_planche_pushup', 'x_tuck_planche'],
    ['x_support_hold', 'Bench_Dips', 'x_parallel_dips', 'x_ring_dips'],
    ['x_active_hang', 'Scapular_Pull-Up', 'Inverted_Row', 'x_negative_pullup', 'Band_Assisted_Pull-Up', 'Pullups', 'x_archer_pullup', 'x_typewriter_pullup'],
    ['Pullups', 'x_muscle_up_bar', 'x_ring_muscle_up'],
    ['x_tuck_front_lever', 'x_adv_tuck_front_lever', 'x_front_lever'],
    ['x_skin_the_cat', 'x_tuck_back_lever'],
    ['x_wall_sit', 'x_jump_squat', 'x_assisted_pistol', 'x_pistol'],
    ['x_skater_squat', 'x_shrimp_squat'],
    ['x_hollow_hold', 'x_tuck_l_sit', 'x_l_sit', 'x_v_sit'],
    ['x_hanging_knee_raise', 'Hanging_Leg_Raise', 'x_toes_to_bar', 'x_windshield_wipers'],
    ['x_crow_pose', 'x_tuck_planche'],
]

PT = {'x_machine_row': 'horizontal_row', 'x_machine_row_1arm': 'horizontal_row', 'x_machine_row_wide': 'horizontal_row', 'x_machine_row_neutral': 'horizontal_row', 'x_tbar_machine': 'horizontal_row', 'x_low_row_machine': 'horizontal_row', 'x_high_row_machine': 'horizontal_row', 'x_rower': 'lib', 'x_jm_press_smith': 'triceps_extension', 'x_cable_kickback': 'hip_extension',
      'x_leg_press_calf': 'calf', 'x_cable_rear_delt': 'lib', 'x_reverse_pec_deck': 'lib', 'x_reverse_nordic': 'knee_extension', 'x_sissy_machine': 'knee_extension'}


def tag_lib(lib):
    """Calisthenics (cal) et échelles de progression (pv = plus facile, nx = plus dur). Renvoie les ids absents."""
    byid = {x['id']: x for x in lib}
    for x in lib:
        x.pop('pv', None); x.pop('nx', None); x.pop('cal', None)
    for i in CAL_TAG:
        if i in byid: byid[i]['cal'] = 1
    for lad in LADDERS:
        for a, b in zip(lad, lad[1:]):
            if a in byid and b in byid:
                byid[a].setdefault('nx', b); byid[b].setdefault('pv', a)
    return [i for lad in LADDERS for i in lad if i not in byid] + [i for i in CAL_TAG if i not in byid]
