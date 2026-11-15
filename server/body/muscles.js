// Source unique des muscles du volet Corps (partagée client et serveur).
// Chaque muscle fin a un identifiant, un nom, une région, les vues où il est visible et le groupe de l'appli
// (clé de server/seed.js MUSCLES) qui porte les séries enregistrées. group = null : muscle sans groupe propre,
// alimenté seulement par des exercices reconnus à leur nom (dentelé, psoas, jambier antérieur, cou).
// La répartition d'un exercice entre muscles fins est une ESTIMATION fondée sur le type de mouvement :
// les séances enregistrent des groupes, pas des faisceaux.

export const REGIONS = {
  cou: 'Cou', epaules: 'Épaules', poitrine: 'Poitrine', dos: 'Dos', bras: 'Bras', avant_bras: 'Avant-bras',
  tronc: 'Abdominaux et tronc', hanches: 'Hanches et fessiers', cuisses: 'Cuisses', jambes: 'Jambes',
};

// v = vues où le muscle se voit : f face, b dos, s profil ; deep = muscle profond (pas dessiné, choisi dans la liste)
const L = (id, name, group, region, v, fn, extra = {}) => ({ id, name, group, region, views: v.split(''), fn, ...extra });
export const MUSCLE_LIST = [
  L('scm', 'Sterno-cléido-mastoïdien', null, 'cou', 'fs', 'Tourne et fléchit la tête.'),
  L('trap_sup', 'Trapèze supérieur', 'trapezes', 'cou', 'fbs', 'Élève les épaules (haussements), stabilise la tête.'),
  L('delt_ant', 'Deltoïde antérieur', 'epaules_ant', 'epaules', 'fs', 'Lève le bras vers l’avant ; très sollicité par les développés.'),
  L('delt_lat', 'Deltoïde latéral', 'epaules_lat', 'epaules', 'fbs', 'Écarte le bras sur le côté : donne la largeur des épaules.'),
  L('delt_post', 'Deltoïde postérieur', 'epaules_post', 'epaules', 'bs', 'Tire le bras vers l’arrière ; posture des épaules.'),
  L('infra', 'Infra-épineux et petit rond', 'epaules_post', 'epaules', 'b', 'Coiffe des rotateurs : rotation externe, protège l’épaule.'),
  L('pec_sup', 'Pectoral supérieur (faisceau claviculaire)', 'pectoraux', 'poitrine', 'fs', 'Rapproche le bras vers le haut et l’avant (développé incliné).'),
  L('pec_inf', 'Pectoral moyen et inférieur (faisceau sternal)', 'pectoraux', 'poitrine', 'fs', 'Rapproche le bras devant le corps (développé couché, dips).'),
  L('dentele', 'Dentelé antérieur', null, 'poitrine', 'fs', 'Plaque l’omoplate contre les côtes ; utile pour des épaules saines.'),
  L('trap_moy', 'Trapèze moyen', 'dos_epaisseur', 'dos', 'b', 'Rapproche les omoplates (tirages horizontaux).'),
  L('trap_inf', 'Trapèze inférieur', 'dos_epaisseur', 'dos', 'b', 'Abaisse les omoplates ; souvent faible, protège l’épaule.'),
  L('rhomboides', 'Rhomboïdes', 'dos_epaisseur', 'dos', '', 'Rapprochent les omoplates, sous le trapèze.', { deep: true }),
  L('grand_dorsal', 'Grand dorsal', 'dos_largeur', 'dos', 'bs', 'Ramène le bras le long du corps : tractions, tirages, largeur du dos.'),
  L('grand_rond', 'Grand rond', 'dos_largeur', 'dos', 'b', 'Aide le grand dorsal, sous l’aisselle.'),
  L('erecteurs', 'Érecteurs du rachis (partie dorsale)', 'lombaires', 'dos', 'b', 'Tiennent la colonne droite.'),
  L('lombaires', 'Région lombaire (carré des lombes, multifides)', 'lombaires', 'dos', 'bs', 'Stabilisent le bas du dos.'),
  L('biceps', 'Biceps brachial', 'biceps', 'bras', 'fs', 'Plie le coude et tourne la paume vers le haut.'),
  L('brachial', 'Brachial', 'biceps', 'bras', 'fs', 'Plie le coude quelle que soit la prise (curl marteau).'),
  L('triceps_long', 'Triceps, chef long', 'triceps', 'bras', 'bs', 'Tend le coude ; travaillé surtout bras au-dessus de la tête.'),
  L('triceps_lat', 'Triceps, chef latéral', 'triceps', 'bras', 'bs', 'Tend le coude ; forme le « fer à cheval ».'),
  L('triceps_med', 'Triceps, chef médial', 'triceps', 'bras', 'f', 'Tend le coude dans toutes les positions.'),
  L('brachioradial', 'Brachio-radial', 'avant_bras', 'avant_bras', 'fs', 'Plie le coude en prise neutre ou en pronation.'),
  L('flechisseurs', 'Fléchisseurs du poignet et des doigts', 'avant_bras', 'avant_bras', 'f', 'Ferment la main : la force de préhension.'),
  L('extenseurs', 'Extenseurs du poignet et des doigts', 'avant_bras', 'avant_bras', 'bs', 'Ouvrent la main et relèvent le poignet.'),
  L('grand_droit', 'Grand droit de l’abdomen', 'abdominaux', 'tronc', 'fs', 'Enroule le buste (crunch) et gaine le ventre.'),
  L('oblique_ext', 'Oblique externe', 'abdominaux', 'tronc', 'fbs', 'Tourne et incline le buste ; résiste aux rotations.'),
  L('oblique_int', 'Oblique interne', 'abdominaux', 'tronc', '', 'Sous l’oblique externe : rotation et gainage.', { deep: true }),
  L('transverse', 'Transverse de l’abdomen', 'abdominaux', 'tronc', '', 'Ceinture profonde : gainage, pression dans le ventre.', { deep: true }),
  L('psoas', 'Iliopsoas (fléchisseurs de hanche)', null, 'hanches', 'f', 'Monte la cuisse vers le ventre (relevés de jambes).'),
  L('tfl', 'Tenseur du fascia lata', 'abducteurs', 'hanches', 'fs', 'Écarte et stabilise la hanche.'),
  L('moyen_fessier', 'Moyen fessier', 'abducteurs', 'hanches', 'bs', 'Écarte la cuisse, garde le bassin stable sur une jambe.'),
  L('grand_fessier', 'Grand fessier', 'fessiers', 'hanches', 'bs', 'Tend la hanche : squat, soulevé de terre, hip thrust.'),
  L('droit_femoral', 'Droit fémoral', 'quadriceps', 'cuisses', 'fs', 'Tend le genou et fléchit la hanche (leg extension).'),
  L('vaste_ext', 'Vaste externe', 'quadriceps', 'cuisses', 'fs', 'Tend le genou ; la plus grosse partie du quadriceps.'),
  L('vaste_int', 'Vaste interne', 'quadriceps', 'cuisses', 'f', 'Tend le genou, stabilise la rotule (la « goutte »).'),
  L('sartorius', 'Sartorius (couturier)', null, 'cuisses', 'f', 'Croise la jambe ; aide la flexion de hanche et de genou.'),
  L('adducteurs', 'Adducteurs (long, court, pectiné, gracile)', 'adducteurs', 'cuisses', 'f', 'Rapprochent les cuisses.'),
  L('grand_adducteur', 'Grand adducteur', 'adducteurs', 'cuisses', 'b', 'Rapproche la cuisse et aide à tendre la hanche (squat profond).'),
  L('biceps_femoral', 'Biceps fémoral', 'ischios', 'cuisses', 'bs', 'Plie le genou et tend la hanche (côté externe).'),
  L('semi_tend', 'Semi-tendineux et semi-membraneux', 'ischios', 'cuisses', 'b', 'Plient le genou et tendent la hanche (côté interne).'),
  L('jumeau_int', 'Gastrocnémien, chef médial', 'mollets', 'jambes', 'fb', 'Pointe le pied, jambe tendue (mollets debout).'),
  L('jumeau_ext', 'Gastrocnémien, chef latéral', 'mollets', 'jambes', 'bs', 'Pointe le pied, jambe tendue.'),
  L('soleaire', 'Soléaire', 'mollets', 'jambes', 'fbs', 'Pointe le pied, genou plié (mollets assis).'),
  L('tibial_ant', 'Jambier antérieur', null, 'jambes', 'fs', 'Relève la pointe du pied ; protège genoux et chevilles.'),
  L('peroniers', 'Long et court fibulaires', null, 'jambes', 'fs', 'Stabilisent la cheville sur le côté.'),
];
export const MUSCLE_BY_ID = Object.fromEntries(MUSCLE_LIST.map((m) => [m.id, m]));

// Type de douleur ressentie (description, pas un diagnostic)
export const PAIN_KINDS = { tiraillement: 'Tiraillement', pincement: 'Pincement', brulure: 'Brûlure', sourde: 'Douleur sourde', vive: 'Douleur vive', raideur: 'Raideur', engourdissement: 'Fourmillements ou engourdissement' };

// Zones de douleur (Soins) → muscles fins voisins
export const PAIN_FINE = {
  epaule: ['delt_ant', 'delt_lat', 'delt_post', 'infra'], coude: ['biceps', 'brachial', 'triceps_long', 'triceps_lat', 'triceps_med', 'brachioradial'],
  poignet: ['flechisseurs', 'extenseurs'], bas_du_dos: ['erecteurs', 'lombaires'], genou: ['droit_femoral', 'vaste_ext', 'vaste_int'],
  hanche: ['psoas', 'tfl', 'moyen_fessier', 'grand_fessier', 'adducteurs'], cheville: ['soleaire', 'jumeau_int', 'jumeau_ext', 'tibial_ant', 'peroniers'],
  nuque: ['trap_sup', 'scm'], pectoral: ['pec_sup', 'pec_inf'], thoracique: ['trap_moy', 'trap_inf', 'rhomboides', 'erecteurs'],
};

// Répartition par défaut d'un groupe entre ses muscles fins (1 = cible principale du groupe)
const DEFAULT = {
  pectoraux: { pec_sup: 0.6, pec_inf: 1 }, epaules_ant: { delt_ant: 1 }, epaules_lat: { delt_lat: 1 }, epaules_post: { delt_post: 1, infra: 0.6 },
  biceps: { biceps: 1, brachial: 0.7 }, triceps: { triceps_long: 0.8, triceps_lat: 1, triceps_med: 1 }, avant_bras: { brachioradial: 0.8, flechisseurs: 1, extenseurs: 0.8 },
  abdominaux: { grand_droit: 1, oblique_ext: 0.6, oblique_int: 0.5, transverse: 0.4 }, quadriceps: { droit_femoral: 0.7, vaste_ext: 1, vaste_int: 1 },
  ischios: { biceps_femoral: 1, semi_tend: 1 }, fessiers: { grand_fessier: 1 }, abducteurs: { moyen_fessier: 1, tfl: 0.6 }, adducteurs: { adducteurs: 1, grand_adducteur: 1 },
  mollets: { jumeau_int: 1, jumeau_ext: 1, soleaire: 0.7 }, trapezes: { trap_sup: 1 }, dos_epaisseur: { trap_moy: 1, rhomboides: 1, trap_inf: 0.7 },
  dos_largeur: { grand_dorsal: 1, grand_rond: 0.8 }, lombaires: { erecteurs: 1, lombaires: 1 },
};
// Règles par type de mouvement (nom français, nom anglais de la bibliothèque, schéma moteur).
// g = nouvelle répartition d'un groupe ; x = muscles hors groupe ajoutés (coefficient direct).
const RULES = [
  { re: /inclin|incline/, pt: ['press_incline'], g: { pectoraux: { pec_sup: 1, pec_inf: 0.6 } } },
  { re: /declin|decline|\bdips?\b/, pt: ['dip'], g: { pectoraux: { pec_sup: 0.3, pec_inf: 1 }, triceps: { triceps_long: 0.7, triceps_lat: 1, triceps_med: 1 } } },
  { re: /pull.?over/, g: { dos_largeur: { grand_dorsal: 1, grand_rond: 1 } }, x: { dentele: 0.6 } },
  { re: /pompe|push.?up|serratus|dentel|scapular push/, x: { dentele: 0.5 } },
  { re: /marteau|hammer|reverse curl|curl inverse|zottman|pronation/, pt: ['curl_hammer'], g: { biceps: { biceps: 0.6, brachial: 1 }, avant_bras: { brachioradial: 1, flechisseurs: 0.5, extenseurs: 0.6 } } },
  { re: /spider|concentration|preacher|pupitre|larry|incline.*curl|curl.*inclin|bayesian/, g: { biceps: { biceps: 1, brachial: 0.6 } } },
  { re: /overhead|au.?dessus de la tete|francais|french|skull|barre au front|lying triceps|nuque.*triceps|triceps.*nuque/, g: { triceps: { triceps_long: 1, triceps_lat: 0.7, triceps_med: 0.8 } } },
  { re: /pushdown|push.?down|poulie haute|corde|rope|kick.?back|pressdown/, pt: ['triceps_pushdown'], g: { triceps: { triceps_long: 0.6, triceps_lat: 1, triceps_med: 1 } } },
  { re: /reverse wrist|wrist extension|extension.*poignet|poignet.*extension/, g: { avant_bras: { brachioradial: 0.3, flechisseurs: 0.3, extenseurs: 1 } } },
  { re: /wrist curl|flexion.*poignet|curl.*poignet|poignet.*flexion|farmer|fermier|grip|dead hang|suspension/, g: { avant_bras: { brachioradial: 0.4, flechisseurs: 1, extenseurs: 0.5 } } },
  { re: /crunch|sit.?up|redressement|releve de buste|enroulement/, g: { abdominaux: { grand_droit: 1, oblique_ext: 0.4, oblique_int: 0.3, transverse: 0.3 } } },
  { re: /oblique|twist|rotation du buste|russian|woodchop|bucheron|side plank|planche laterale|gainage lateral|pallof|landmine rot/, g: { abdominaux: { grand_droit: 0.4, oblique_ext: 1, oblique_int: 1, transverse: 0.5 } } },
  { re: /planche|plank|gainage|vacuum|dead.?bug|hollow|ab wheel|roulette/, g: { abdominaux: { grand_droit: 0.7, oblique_ext: 0.5, oblique_int: 0.6, transverse: 1 } } },
  { re: /leg raise|releve de jambes|releve des jambes|knee raise|releve de genoux|genoux a la poitrine|mountain climber|hip flexor|flexion de hanche/, g: { abdominaux: { grand_droit: 1, oblique_ext: 0.5, oblique_int: 0.4, transverse: 0.5 } }, x: { psoas: 0.8 } },
  { re: /leg extension|extension.*jambe|extension des genoux|sissy/, pt: ['knee_extension'], g: { quadriceps: { droit_femoral: 1, vaste_ext: 0.9, vaste_int: 0.9 } } },
  { pt: ['squat', 'leg_press', 'lunge'], g: { quadriceps: { droit_femoral: 0.5, vaste_ext: 1, vaste_int: 1 } } },
  { re: /seated calf|mollets assis|calf.*assis|soleus|soleaire/, g: { mollets: { jumeau_int: 0.5, jumeau_ext: 0.5, soleaire: 1 } } },
  { re: /abduct|monster walk|band walk|lateral walk|marche laterale|fire hydrant|clam/, pt: ['hip_abduction'], g: { abducteurs: { moyen_fessier: 1, tfl: 0.7 } } },
  { re: /face pull|rotation externe|external rotation|reverse fly|oiseau|rear delt|deltoide posterieur|band pull.?apart|ecarte inverse/, pt: ['face_pull'], g: { epaules_post: { delt_post: 1, infra: 1 } } },
  { re: /\brow|rowing|tirage horizontal|tirage assis|t.?bar/, pt: ['horizontal_row'], g: { dos_epaisseur: { trap_moy: 1, rhomboides: 1, trap_inf: 0.6 } } },
  { re: /prone y|y.?raise|trap.?3|lower trap|elevation en y/, g: { dos_epaisseur: { trap_moy: 0.6, rhomboides: 0.5, trap_inf: 1 } } },
  { re: /straight.?arm|bras tendus/, g: { dos_largeur: { grand_dorsal: 1, grand_rond: 1 } } },
  { re: /hyperextension|back extension|good.?morning|superman|extension lombaire|banc a lombaires/, g: { lombaires: { erecteurs: 1, lombaires: 1 } } },
  { re: /tibia|tibialis|toe raise|releve.*pointe|dorsiflex|jambier/, x: { tibial_ant: 1 } },
  { re: /neck (flexion|curl|extension)|flexion du cou|extension du cou|harnais de nuque/, x: { scm: 1 } },
];
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/_/g, ' ');

// Muscles fins travaillés par un exercice : [{ id, w, direct }] ; w = coefficient du groupe × part estimée du muscle
export function fineLoads(ex) {
  const muscles = typeof ex.muscles === 'string' ? JSON.parse(ex.muscles || '{}') : ex.muscles || {};
  const txt = `${norm(ex.name)} ${norm(ex.lib_id)} ${norm(ex.en)}`;
  const split = { ...DEFAULT }; const extra = {};
  for (const r of RULES) {
    const hit = (r.re && r.re.test(txt)) || (r.pt && r.pt.includes(ex.pattern));
    if (!hit) continue;
    if (r.g) for (const [g, v] of Object.entries(r.g)) if (split[g] === DEFAULT[g]) split[g] = v;
    if (r.x) for (const [k, v] of Object.entries(r.x)) extra[k] = Math.max(extra[k] || 0, v);
  }
  const out = {};
  for (const [g, c] of Object.entries(muscles)) {
    if (!c || !split[g]) continue;
    for (const [id, e] of Object.entries(split[g])) out[id] = Math.max(out[id] || 0, c * e);
  }
  for (const [id, v] of Object.entries(extra)) out[id] = Math.max(out[id] || 0, v);
  return Object.entries(out).map(([id, w]) => ({ id, w: Math.round(w * 100) / 100, direct: w >= 0.75 }));
}
// Répartition d'un groupe (cardio, courbatures) sur ses muscles fins
export const groupSplit = (g) => DEFAULT[g] || {};
export const finesOf = (g) => MUSCLE_LIST.filter((m) => m.group === g).map((m) => m.id);
