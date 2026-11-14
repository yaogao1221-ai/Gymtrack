#!/usr/bin/env python3
"""Génère client/src/data/exlib.json depuis free-exercise-db (domaine public, Unlicense).

Usage : python3 scripts/build-exlib.py <chemin/exercises.json>
Les photos ne sont pas copiées : l'appli les charge depuis le dépôt public (2 photos par exercice).
"""
import json, re, sys, pathlib

SRC = sys.argv[1]
OUT = pathlib.Path(__file__).resolve().parent.parent / 'client/src/data/exlib.json'

EQUIP = {  # mots de matériel retirés du nom et affichés entre parenthèses
    'Smith Machine': 'Smith', 'E-Z Curl Bar': 'barre EZ', 'EZ-Bar': 'barre EZ', 'EZ Bar': 'barre EZ', 'Medicine Ball': 'médecine-ball',
    'Exercise Ball': 'swiss ball', 'Stability Ball': 'swiss ball', 'Kettlebells': 'kettlebells', 'Kettlebell': 'kettlebell',
    'Dumbbells': 'haltères', 'Dumbbell': 'haltères', 'Two-Dumbbell': 'haltères', 'Barbell': 'barre', 'Cable': 'poulie', 'Low-Pulley': 'poulie basse',
    'Machine': 'machine', 'Bands': 'élastiques', 'Band': 'élastique', 'Leverage': 'machine guidée', 'Sled': 'traîneau', 'Foam Roll': 'rouleau',
    'Trap Bar': 'trap bar', 'Plate': 'disque', 'Chains': 'chaînes', 'Landmine': 'landmine', 'Suspended': 'TRX', 'Bodyweight': 'poids du corps',
}
ADJ = [  # qualificatifs placés après le mouvement
    ('Single-Leg', 'sur une jambe'), ('One-Leg', 'sur une jambe'), ('One Leg', 'sur une jambe'), ('Single-Arm', 'à un bras'), ('One-Arm', 'à un bras'), ('One Arm', 'à un bras'),
    ('Two-Arm', 'à deux bras'), ('Alternating', 'alterné'), ('Alternate', 'alterné'), ('Close-Grip', 'prise serrée'), ('Wide-Grip', 'prise large'),
    ('Medium Grip', 'prise moyenne'), ('Narrow Stance', 'pieds serrés'), ('Wide Stance', 'pieds écartés'), ('Reverse Grip', 'prise inversée'), ('Palms-Up', 'paumes vers le haut'),
    ('Palms-Down', 'paumes vers le bas'), ('Bent-Over', 'buste penché'), ('Bent Over', 'buste penché'), ('Seated', 'assis'), ('Standing', 'debout'), ('Lying', 'allongé'),
    ('Kneeling', 'à genoux'), ('Incline', 'incliné'), ('Decline', 'décliné'), ('Flat', 'à plat'), ('Overhead', 'au-dessus de la tête'), ('Weighted', 'lesté'),
    ('Isometric', 'isométrique'), ('Supine', 'sur le dos'), ('Prone', 'sur le ventre'), ('Hanging', 'suspendu'), ('Straight-Arm', 'bras tendus'), ('Bent-Arm', 'bras fléchis'),
    ('Elevated', 'surélevé'), ('Deficit', 'en déficit'), ('Speed', 'vitesse'), ('Paused', 'avec pause'), ('Reverse', 'inversé'), ('Rear', 'arrière'), ('Front', 'avant'),
    ('Side', 'latéral'), ('Lateral', 'latéral'), ('Behind The Head', 'derrière la nuque'), ('Behind Head', 'derrière la nuque'), ('Behind', 'derrière'),
]
MOVES = [  # du plus long au plus court
    ('Romanian Deadlift', 'Soulevé de terre roumain'), ('Stiff-Legged Deadlift', 'Soulevé de terre jambes tendues'), ('Sumo Deadlift', 'Soulevé de terre sumo'),
    ('Deadlift', 'Soulevé de terre'), ('Deadlifts', 'Soulevé de terre'), ('Bench Press', 'Développé couché'), ('Shoulder Press', 'Développé épaules'),
    ('Military Press', 'Développé militaire'), ('Arnold Press', 'Développé Arnold'), ('Chest Press', 'Presse pectoraux'), ('Leg Press', 'Presse à cuisses'),
    ('Push Press', 'Push press'), ('Floor Press', 'Développé au sol'), ('Press', 'Développé'), ('Presses', 'Développé'),
    ('Hammer Curl', 'Curl marteau'), ('Hammer Curls', 'Curl marteau'), ('Preacher Curl', 'Curl pupitre'), ('Concentration Curl', 'Curl concentré'),
    ('Leg Curl', 'Leg curl'), ('Wrist Curl', 'Curl poignets'), ('Curls', 'Curl'), ('Curl', 'Curl'),
    ('Front Squat', 'Squat avant'), ('Hack Squat', 'Hack squat'), ('Split Squat', 'Squat bulgare'), ('Goblet Squat', 'Goblet squat'), ('Squats', 'Squat'), ('Squat', 'Squat'),
    ('Upright Row', 'Tirage menton'), ('Rows', 'Rowing'), ('Row', 'Rowing'), ('Face Pull', 'Face pull'),
    ('Lateral Raise', 'Élévations latérales'), ('Front Raise', 'Élévations frontales'), ('Calf Raise', 'Mollets'), ('Calf Raises', 'Mollets'), ('Raises', 'Élévations'), ('Raise', 'Élévations'),
    ('Flyes', 'Écarté'), ('Flye', 'Écarté'), ('Fly', 'Écarté'), ('Crossover', 'Écarté vis-à-vis'),
    ('Triceps Extension', 'Extension triceps'), ('Tricep Extension', 'Extension triceps'), ('Leg Extensions', 'Leg extension'), ('Leg Extension', 'Leg extension'), ('Extension', 'Extension'),
    ('Pushdown', 'Extension triceps à la poulie'), ('Kickback', 'Kickback'), ('Skull Crusher', 'Barre au front'), ('Lying Triceps Press', 'Barre au front'),
    ('Pulldown', 'Tirage vertical'), ('Pullover', 'Pull-over'), ('Pull-Up', 'Traction'), ('Pull-Ups', 'Tractions'), ('Pullups', 'Tractions'), ('Pullup', 'Traction'),
    ('Chin-Up', 'Traction supination'), ('Muscle Up', 'Muscle-up'), ('Dips', 'Dips'), ('Dip', 'Dips'),
    ('Push-Ups', 'Pompes'), ('Push-Up', 'Pompes'), ('Pushups', 'Pompes'), ('Push Up', 'Pompes'),
    ('Walking Lunge', 'Fentes marchées'), ('Lunges', 'Fentes'), ('Lunge', 'Fentes'), ('Step-up', 'Montée sur banc'), ('Step Up', 'Montée sur banc'), ('Step-Up', 'Montée sur banc'), ('Step Ups', 'Montée sur banc'), ('Side Bends', 'Flexions latérales'),
    ('Good Morning', 'Good morning'), ('Hip Thrust', 'Hip thrust'), ('Glute Bridge', 'Pont fessier'), ('Bridge', 'Pont'), ('Hyperextensions', 'Extension lombaire'), ('Hyperextension', 'Extension lombaire'),
    ('Shrugs', 'Shrug'), ('Shrug', 'Shrug'), ('Crunches', 'Crunch'), ('Crunch', 'Crunch'), ('Sit-Ups', 'Redressements assis'), ('Sit-Up', 'Redressement assis'),
    ('Plank', 'Gainage'), ('Rollout', 'Roulette abdos'), ('Russian Twist', 'Rotation russe'), ('Twist', 'Rotation'), ('Leg Raise', 'Relevé de jambes'), ('Knee Raise', 'Relevé de genoux'),
    ('Clean and Jerk', 'Épaulé-jeté'), ('Clean and Press', 'Épaulé-développé'), ('Power Clean', 'Épaulé en force'), ('Hang Clean', 'Épaulé suspendu'), ('Clean', 'Épaulé'),
    ('Power Snatch', 'Arraché en force'), ('Hang Snatch', 'Arraché suspendu'), ('Snatch', 'Arraché'), ('Jerk', 'Jeté'), ('Swing', 'Swing'), ('Swings', 'Swing'),
    ('Thruster', 'Thruster'), ('Windmill', 'Moulin'), ('Box Jump', 'Saut sur box'), ('Jump', 'Saut'), ('Jumps', 'Sauts'), ('Hops', 'Sauts'), ('Bound', 'Bonds'),
    ('Throw', 'Lancer'), ('Slam', 'Slam'), ('Sprint', 'Sprint'), ('Walk', 'Marche'), ('Carry', 'Porté'), ('Drag', 'Tirage'), ('Push', 'Poussée'), ('Pull', 'Tirage'),
    ('Rotation', 'Rotation'), ('Circles', 'Cercles'), ('Stretch', 'Étirement'), ('Rope Jumping', 'Corde à sauter'), ('Rowing, Stationary', 'Rameur'),
    ('Bicycling, Stationary', 'Vélo d’appartement'), ('Bicycling', 'Vélo'), ('Air Bike', 'Air bike'), ('Recumbent Bike', 'Vélo semi-allongé'), ('Treadmill', 'Tapis'),
]
NOUNS = [  # parties du corps et objets (complément du nom)
    ('Hip Flexors', 'des fléchisseurs de hanche'), ('Hip Flexor', 'des fléchisseurs de hanche'), ('Hamstrings', 'des ischios'), ('Hamstring', 'des ischios'),
    ('Quadriceps', 'des quadriceps'), ('Quads', 'des quadriceps'), ('Quad', 'des quadriceps'), ('Chest', 'pectoraux'), ('Shoulders', 'épaules'), ('Shoulder', 'épaules'),
    ('Triceps', 'triceps'), ('Tricep', 'triceps'), ('Biceps', 'biceps'), ('Bicep', 'biceps'), ('Calves', 'mollets'), ('Calf', 'mollets'), ('Wrists', 'poignets'), ('Wrist', 'poignets'),
    ('Neck', 'nuque'), ('Lower Back', 'bas du dos'), ('Upper Back', 'haut du dos'), ('Back', 'dos'), ('Glutes', 'fessiers'), ('Glute', 'fessiers'), ('Groin', 'adducteurs'),
    ('Adductor', 'adducteurs'), ('Abductor', 'abducteurs'), ('Hip', 'hanche'), ('Hips', 'hanches'), ('Knees', 'genoux'), ('Knee', 'genou'), ('Ankles', 'chevilles'), ('Ankle', 'cheville'),
    ('Arms', 'bras'), ('Arm', 'bras'), ('Legs', 'jambes'), ('Leg', 'jambes'), ('Elbows', 'coudes'), ('Elbow', 'coude'), ('Hands', 'mains'), ('Lats', 'grands dorsaux'), ('Lat', 'grand dorsal'),
    ('Abs', 'abdos'), ('Ab', 'abdos'), ('Oblique', 'obliques'), ('Obliques', 'obliques'), ('Torso', 'buste'), ('Spine', 'colonne'), ('Rope', 'corde'), ('Bench', 'banc'),
    ('Box', 'box'), ('Wall', 'mur'), ('Floor', 'sol'), ('Ball', 'ballon'), ('Bar', 'barre'), ('Rack', 'rack'), ('Chair', 'chaise'), ('Partner', 'partenaire'),
    ('with', 'avec'), ('With', 'avec'), ('on', 'sur'), ('On', 'sur'), ('from', 'depuis'), ('to', 'vers'), ('To', 'vers'), ('and', 'et'), ('And', 'et'), ('The', ''), ('the', ''), ('A', ''), ('a', ''),
    ('External', 'externe'), ('Internal', 'interne'), ('Deltoid', 'deltoïde'), ('Delt', 'deltoïde'), ('Single', 'unilatéral'), ('High-Pulley', 'poulie haute'),
    ('Mid', 'milieu'), ('Straight', 'droite'), ('Step Ups', 'Montée sur banc'), ('Pelvic Tilt', 'bascule du bassin'), ('Flexor', 'fléchisseurs'), ('Above Head', 'au-dessus de la tête'),
    ('Pulldowns', 'tirage vertical'), ('Hammer', 'marteau'), ('Preacher', 'pupitre'), ('Bends', 'flexions'), ('Ups', ''), ('Into', 'vers'),
    ('Over', 'au-dessus'), ('Through', 'à travers'), ('Against', 'contre'), ('Up', ''), ('Version', 'version'), ('Exercise', ''), ('Drill', 'exercice'),
]
MUSCLE = {  # free-exercise-db -> groupes de l'appli
    'abdominals': ['abdominaux'], 'abductors': ['abducteurs'], 'adductors': ['adducteurs'], 'biceps': ['biceps'], 'calves': ['mollets'], 'chest': ['pectoraux'],
    'forearms': ['avant_bras'], 'glutes': ['fessiers'], 'hamstrings': ['ischios'], 'lats': ['dos_largeur'], 'lower back': ['lombaires'], 'middle back': ['dos_epaisseur'],
    'neck': ['trapezes'], 'quadriceps': ['quadriceps'], 'traps': ['trapezes'], 'triceps': ['triceps'], 'shoulders': ['epaules_ant'],
}
CAT = {'strength': 'muscu', 'stretching': 'mobilite', 'plyometrics': 'crossfit', 'powerlifting': 'muscu', 'olympic weightlifting': 'crossfit', 'strongman': 'crossfit', 'cardio': 'cardio'}
EQ = {'barbell': 'Barre', 'dumbbell': 'Haltères', 'other': 'Autre', 'body only': 'Poids du corps', 'cable': 'Poulie', 'machine': 'Machine', 'kettlebells': 'Kettlebell',
      'bands': 'Élastique', 'medicine ball': 'Médecine-ball', 'exercise ball': 'Swiss ball', 'foam roll': 'Rouleau', 'e-z curl bar': 'Barre EZ', None: 'Aucun'}


def sub_phrase(text, pairs, out):
    for en, fr in sorted(pairs, key=lambda p: -len(p[0])):
        pat = re.compile(r'(?<![\w-])' + re.escape(en) + r'(?![\w-])')
        if pat.search(text):
            text = pat.sub(' ', text, count=1); out.append(fr)
    return text


def translate(name, cat=''):
    t = name.replace('–', '-').replace('’', "'")
    sub = ''
    if ' - ' in t:
        t, sub = t.split(' - ', 1)
    eq, adj, mv = [], [], []
    t = sub_phrase(t, list(EQUIP.items()), eq)
    t = sub_phrase(t, MOVES, mv)
    t = sub_phrase(t, ADJ, adj)
    for en, fr in sorted(NOUNS, key=lambda p: -len(p[0])):
        if ' ' in en: t = re.sub(r'(?<!\w)' + re.escape(en) + r'(?!\w)', fr.replace(' ', '_'), t)
    rest = []
    for w in re.findall(r"[^\s]+", t):
        hit = next((fr for en, fr in NOUNS if en == w), None)
        rest.append((w if hit is None else hit).replace('_', ' '))
    rest = [w for w in rest if w]
    while rest and rest[-1] in ('avec', 'sur', 'vers', 'et', 'depuis'): rest.pop()
    if not mv and cat == 'stretching': mv = ['Étirement']
    head = ' '.join(mv) if mv else ''
    adj = [a for a in adj if a.split()[0][:6] not in head.lower()]
    body = ' '.join(rest)
    if head and body:
        s = f'{head} {body}'
    else:
        s = head or body or name
    if adj: s += ' ' + ' '.join(dict.fromkeys(adj))
    if sub:
        subt = []; r = sub_phrase(sub, ADJ + MOVES, subt); s += ' · ' + (' '.join(subt + [r.strip()]).strip() if subt else sub)
    if eq: s += ' (' + ', '.join(dict.fromkeys(eq)) + ')'
    s = re.sub(r'\s+', ' ', s).strip().replace('Étirement Des', 'Étirement des')
    return s[0].upper() + s[1:]


def shoulder_part(name):
    n = name.lower()
    if re.search(r'lateral|side raise|upright', n): return 'epaules_lat'
    if re.search(r'rear|row|reverse fl|face pull|external rotation|bent.?over.*raise', n): return 'epaules_post'
    return 'epaules_ant'


def muscles(e):
    out = {}
    for i, group in enumerate([e['primaryMuscles'], e['secondaryMuscles']]):
        for m in group:
            for k in MUSCLE.get(m, []):
                if m == 'shoulders': k = shoulder_part(e['name'])
                out[k] = max(out.get(k, 0), 1 if i == 0 else 0.5)
    return out


PATTERNS = [
    (r'incline.*(press|bench)', 'press_incline'), (r'bench press|chest press|floor press|push-?up|pushup', 'press_horizontal'), (r'\bdips?\b', 'dip'),
    (r'shoulder press|military|overhead press|arnold|push press|jerk|handstand', 'press_vertical'), (r'lateral raise|side lateral', 'lateral_raise'),
    (r'front .*raise|front raise', 'front_raise'), (r'fly|flye|crossover|butterfly', 'chest_fly'), (r'pushdown|kickback', 'triceps_pushdown'),
    (r'triceps|tricep|skull', 'triceps_extension'), (r'hammer curl', 'curl_hammer'), (r'curl', 'curl'), (r'face pull', 'face_pull'),
    (r'deadlift|good morning|swing|clean|snatch', 'hinge'), (r'leg press', 'leg_press'), (r'squat|thruster', 'squat'), (r'lunge|step.?up|split', 'lunge'),
    (r'leg extension', 'knee_extension'), (r'hip thrust|bridge|hyperextension', 'hip_extension'), (r'abduct', 'hip_abduction'), (r'adduct', 'hip_adduction'),
    (r'calf', 'calf'), (r'shrug', 'shrug'), (r'pull-?up|pullup|chin|pulldown|muscle up', 'vertical_pull'), (r'row', 'horizontal_row'),
]


def pattern(e):
    n = e['name'].lower()
    if e['category'] == 'stretching': return 'mobility'
    return next((pt for rx, pt in PATTERNS if re.search(rx, n)), 'lib')


def kind(e):
    n = e['name'].lower()
    if 'assisted' in n: return 'assisted'
    if e['category'] in ('stretching',) or e['equipment'] in ('body only', None, 'foam roll', 'exercise ball'): return 'bodyweight'
    return 'weighted'


data = json.load(open(SRC))
lib = []
for e in data:
    lib.append({
        'id': e['id'], 'n': translate(e['name'], e['category']), 'en': e['name'], 'c': CAT.get(e['category'], 'muscu'), 'q': EQ.get(e['equipment'], 'Autre'),
        'l': e['level'][0], 'k': kind(e), 'pt': pattern(e), 'm': muscles(e), 'p': e['primaryMuscles'], 'img': len(e['images']),
        'i': e['instructions'],
    })

# Compléments (sans photo) : classiques du crossfit et de la mobilité absents de la base
EXTRA = [
    ('x_burpee', 'Burpee', 'Burpee', 'crossfit', 'Poids du corps', 'bodyweight', {'pectoraux': 0.5, 'quadriceps': 0.5, 'abdominaux': 0.5}),
    ('x_wall_ball', 'Wall ball', 'Wall Ball', 'crossfit', 'Médecine-ball', 'weighted', {'quadriceps': 1, 'fessiers': 0.5, 'epaules_ant': 0.5}),
    ('x_thruster', 'Thruster (barre)', 'Barbell Thruster', 'crossfit', 'Barre', 'weighted', {'quadriceps': 1, 'fessiers': 0.5, 'epaules_ant': 1, 'triceps': 0.5}),
    ('x_toes_to_bar', 'Toes to bar', 'Toes to Bar', 'crossfit', 'Poids du corps', 'bodyweight', {'abdominaux': 1, 'dos_largeur': 0.5}),
    ('x_double_unders', 'Double unders (corde)', 'Double Unders', 'crossfit', 'Autre', 'bodyweight', {'mollets': 1}),
    ('x_kb_swing', 'Swing russe (kettlebell)', 'Russian Kettlebell Swing', 'crossfit', 'Kettlebell', 'weighted', {'fessiers': 1, 'ischios': 1, 'lombaires': 0.5}),
    ('x_devil_press', 'Devil press (haltères)', 'Devil Press', 'crossfit', 'Haltères', 'weighted', {'fessiers': 0.5, 'epaules_ant': 0.5, 'pectoraux': 0.5}),
    ('x_hspu', 'Pompes en équilibre (HSPU)', 'Handstand Push-Up', 'crossfit', 'Poids du corps', 'bodyweight', {'epaules_ant': 1, 'triceps': 1}),
    ('x_pistol', 'Pistol squat', 'Pistol Squat', 'crossfit', 'Poids du corps', 'bodyweight', {'quadriceps': 1, 'fessiers': 1}),
    ('x_nordic', 'Leg curl nordique', 'Nordic Hamstring Curl', 'muscu', 'Poids du corps', 'bodyweight', {'ischios': 1}),
    ('x_copenhagen', 'Gainage Copenhague', 'Copenhagen Plank', 'muscu', 'Poids du corps', 'bodyweight', {'adducteurs': 1, 'abdominaux': 0.5}),
    ('x_bird_dog', 'Bird dog', 'Bird Dog', 'mobilite', 'Poids du corps', 'bodyweight', {}),
    ('x_pigeon', 'Étirement du pigeon', 'Pigeon Stretch', 'mobilite', 'Poids du corps', 'bodyweight', {}),
    ('x_9090', 'Rotation de hanches 90/90', '90/90 Hip Switch', 'mobilite', 'Poids du corps', 'bodyweight', {}),
    ('x_thoracic', 'Rotation thoracique (open book)', 'Open Book Thoracic Rotation', 'mobilite', 'Poids du corps', 'bodyweight', {}),
    ('x_wall_slide', 'Wall slides', 'Wall Slides', 'mobilite', 'Poids du corps', 'bodyweight', {}),
    ('x_ankle_knee', 'Mobilité de cheville genou au mur', 'Knee-to-Wall Ankle Mobilization', 'mobilite', 'Poids du corps', 'bodyweight', {}),
    ('x_dead_hang', 'Suspension passive à la barre', 'Dead Hang', 'mobilite', 'Poids du corps', 'bodyweight', {}),
    ('x_foam_quads', 'Rouleau quadriceps', 'Foam Roll Quads', 'mobilite', 'Rouleau', 'bodyweight', {}),
    ('x_foam_tspine', 'Rouleau haut du dos', 'Foam Roll Thoracic Spine', 'mobilite', 'Rouleau', 'bodyweight', {}),
    ('x_tibialis', 'Relevés de pointes de pieds', 'Tibialis Raise', 'muscu', 'Poids du corps', 'bodyweight', {'mollets': 0.5}),
    ('x_spanish_squat', 'Squat espagnol (élastique)', 'Spanish Squat', 'muscu', 'Élastique', 'bodyweight', {'quadriceps': 1}),
    ('x_wrist_ext_ecc', 'Extension de poignet excentrique', 'Eccentric Wrist Extension', 'muscu', 'Haltères', 'weighted', {'avant_bras': 1}),
    ('x_tyler_twist', 'Tyler twist inversé (barre flexible)', 'Reverse Tyler Twist', 'muscu', 'Autre', 'weighted', {'avant_bras': 1}),
    ('x_side_lying_er', 'Rotation externe couché sur le côté', 'Side-Lying External Rotation', 'muscu', 'Haltères', 'weighted', {'epaules_post': 1}),
    ('x_mcgill_curl', 'Curl-up de McGill', 'McGill Curl-Up', 'muscu', 'Poids du corps', 'bodyweight', {'abdominaux': 1}),
    ('x_side_plank', 'Gainage latéral', 'Side Plank', 'muscu', 'Poids du corps', 'bodyweight', {'abdominaux': 1}),
    ('x_chin_tuck', 'Rentré de menton', 'Chin Tuck', 'mobilite', 'Poids du corps', 'bodyweight', {}),
]
FR = {
    'x_burpee': ['Debout, descends en squat et pose les mains au sol.', 'Saute les pieds en arrière en planche, fais une pompe.', 'Ramène les pieds vers les mains, puis saute bras en l’air.'],
    'x_wall_ball': ['Ballon contre la poitrine, face au mur, descends en squat complet.', 'Remonte en poussant fort des jambes et lance le ballon sur la cible.', 'Rattrape-le en redescendant directement dans le squat suivant.'],
    'x_thruster': ['Barre sur l’avant des épaules, descends en squat avant.', 'Remonte vite et profite de l’élan pour pousser la barre au-dessus de la tête, bras tendus.'],
    'x_toes_to_bar': ['Suspendu à la barre, gainage serré.', 'Monte les pieds jusqu’à toucher la barre, redescends sous contrôle sans te balancer.'],
    'x_double_unders': ['Corde à sauter : la corde passe 2 fois sous les pieds à chaque saut.', 'Petits sauts toniques, poignets qui tournent vite, coudes près du corps.'],
    'x_kb_swing': ['Pieds largeur d’épaules, kettlebell entre les jambes, dos neutre.', 'Pousse les hanches vers l’avant d’un coup sec : la kettlebell monte à hauteur des épaules.', 'Laisse-la redescendre en reculant les fesses, sans arrondir le dos.'],
    'x_devil_press': ['Une haltère dans chaque main au sol, fais un burpee sur les haltères.', 'En remontant, balance les haltères entre les jambes puis jusqu’au-dessus de la tête en un mouvement.'],
    'x_hspu': ['En équilibre sur les mains contre un mur, mains un peu plus larges que les épaules.', 'Descends la tête jusqu’au sol (sur un coussin), puis pousse jusqu’à bras tendus.', 'Version plus facile : pompes pieds surélevés, fesses en l’air (pike push-up).'],
    'x_pistol': ['Debout sur une jambe, l’autre tendue devant.', 'Descends en squat complet sur la jambe d’appui, talon au sol, puis remonte.', 'Plus facile : descendre sur un banc ou en tenant un support.'],
    'x_nordic': ['À genoux, chevilles bloquées (partenaire ou barre).', 'Penche-toi en avant, corps droit des genoux à la tête, le plus lentement possible.', 'Rattrape-toi avec les mains et repousse pour remonter.'],
    'x_copenhagen': ['Allongé sur le côté, pied (ou genou, plus facile) du dessus posé sur un banc.', 'Soulève le bassin pour aligner le corps et tiens la position.', 'La jambe du dessous peut rester décollée du sol.'],
    'x_bird_dog': ['À quatre pattes, dos neutre.', 'Tends un bras devant et la jambe opposée derrière, sans bouger le bassin.', 'Tiens 10 s, reviens, change de côté.'],
    'x_pigeon': ['Depuis la planche, ramène un genou vers la main du même côté, tibia en travers.', 'Allonge l’autre jambe derrière, bassin droit, et penche le buste vers l’avant.', 'Respire lentement, 30 s à 1 min par côté.'],
    'x_9090': ['Assis au sol, une jambe devant pliée à 90°, l’autre sur le côté pliée à 90°.', 'Bascule les deux genoux de l’autre côté sans t’aider des mains si possible.'],
    'x_thoracic': ['Allongé sur le côté, genoux pliés, bras tendus devant l’un sur l’autre.', 'Ouvre le bras du dessus vers l’arrière en suivant la main des yeux, genoux collés au sol.', 'Reviens lentement.'],
    'x_wall_slide': ['Dos et avant-bras contre le mur, coudes à 90°.', 'Fais glisser les bras vers le haut sans décoller le bas du dos, puis redescends.'],
    'x_ankle_knee': ['Face au mur, pied à 10 cm du mur, en fente.', 'Avance le genou pour toucher le mur, talon collé au sol.', 'Recule le pied petit à petit pour gagner en amplitude.'],
    'x_dead_hang': ['Suspends-toi à une barre de traction, bras tendus, épaules relâchées.', 'Respire et laisse le poids du corps étirer le dos et les épaules.'],
    'x_foam_quads': ['Allongé sur le ventre, rouleau sous les cuisses.', 'Roule lentement de la hanche au-dessus du genou, pause sur les points sensibles.'],
    'x_foam_tspine': ['Rouleau sous le haut du dos, mains derrière la tête, fesses au sol.', 'Roule doucement entre les omoplates, sans descendre dans le bas du dos.'],
    'x_tibialis': ['Dos contre un mur, talons à 30 cm du mur.', 'Relève les pointes de pieds le plus haut possible, redescends lentement.'],
    'x_spanish_squat': ['Élastique solide derrière les genoux, attaché à un poteau devant toi.', 'Recule pour le tendre, puis descends en squat buste droit, tibias verticaux.', 'Tiens la position (genoux vers 60°) : soulage souvent la douleur sous la rotule.'],
    'x_wrist_ext_ecc': ['Avant-bras posé sur la cuisse, paume vers le bas, haltère légère.', 'Monte le poignet en t’aidant de l’autre main, puis redescends seul en 4 secondes.'],
    'x_tyler_twist': ['Barre flexible (FlexBar) tenue verticalement côté douloureux.', 'L’autre main tord le haut de la barre ; tends les bras devant toi.', 'Laisse lentement la barre se détordre avec le poignet douloureux (excentrique).'],
    'x_side_lying_er': ['Allongé sur le côté, coude du dessus collé au corps à 90°, petite haltère.', 'Tourne l’avant-bras vers le plafond, puis redescends en 3 s.'],
    'x_mcgill_curl': ['Sur le dos, une jambe pliée, l’autre tendue, mains sous le bas du dos.', 'Décolle à peine la tête et les épaules sans plier la nuque ni le bas du dos, tiens 10 s.'],
    'x_side_plank': ['Sur le côté, coude sous l’épaule, genoux pliés (facile) ou jambes tendues.', 'Soulève le bassin pour aligner le corps et tiens.'],
    'x_chin_tuck': ['Assis ou debout, regard droit.', 'Rentre le menton vers l’arrière (double menton) sans baisser la tête, tiens 3 s.'],
}
for i, n, en, c, q, k, m in EXTRA:
    lib.append({'id': i, 'n': n, 'en': en, 'c': c, 'q': q, 'l': 'b', 'k': k, 'pt': pattern({'name': en, 'category': 'stretching' if c == 'mobilite' else c}), 'm': m, 'p': [], 'img': 0, 'i': FR.get(i, []), 'fr': 1})

# Exercices modernes ajoutés en v9 (sissy squat, curl bayésien, rowing Pendlay…)
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from exlib_extra import EXTRA2, PT, tag_lib  # noqa: E402
for i, n, en, c, q, k, m, l, steps in EXTRA2:
    lib.append({'id': i, 'n': n, 'en': en, 'c': c, 'q': q, 'l': l, 'k': k, 'pt': PT.get(i) or pattern({'name': en, 'category': c}), 'm': m, 'p': [], 'img': 0, 'i': steps, 'fr': 1})

# Les étirements ne comptent pas dans le volume musculaire : on garde les muscles visés à part
for x in lib:
    if x['c'] == 'mobilite':
        x['t'] = list(x['m'].keys()) or x['p']; x['m'] = {}

tag_lib(lib)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(lib, ensure_ascii=False, separators=(',', ':')))
print(len(lib), 'exercices ->', OUT, OUT.stat().st_size // 1024, 'Ko')
