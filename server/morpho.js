// Morpho-anatomie : choisir les exercices selon ta structure (leviers, clavicules, mobilité) et éviter les conflits articulaires.
// Module partagé (serveur et téléphone). Tout est déterministe : chaque note donne sa raison et une meilleure option.

export const MORPHO_QUESTIONS = [
  { key: 'bras', label: 'Longueur des bras', options: [['courts', 'Courts'], ['moyens', 'Moyens'], ['longs', 'Longs']],
    test: 'Debout, bras relâchés le long du corps : si le bout de tes doigts arrive au milieu de la cuisse ou plus bas, tes bras sont longs ; juste sous la hanche, ils sont courts ; entre les deux, moyens.' },
  { key: 'femurs', label: 'Longueur des fémurs (par rapport au buste)', options: [['courts', 'Courts'], ['moyens', 'Moyens'], ['longs', 'Longs']],
    test: 'Fais un squat au poids du corps, pieds à largeur d’épaules, talons au sol, bras tendus devant. Si ton buste doit beaucoup pencher vers l’avant pour descendre cuisses parallèles, tes fémurs sont longs ; si tu descends buste presque droit, ils sont courts.' },
  { key: 'clavicules', label: 'Largeur des clavicules', options: [['etroites', 'Étroites'], ['moyennes', 'Moyennes'], ['larges', 'Larges']],
    test: 'Mesure la distance entre les deux pointes osseuses des épaules et compare-la à la largeur du bassin (os des hanches). Épaules nettement plus larges que le bassin (1,5 fois ou plus) : larges. À peine plus larges : étroites.' },
  { key: 'gabarit', label: 'Gabarit', options: [['longiligne', 'Longiligne'], ['moyen', 'Moyen'], ['trapu', 'Trapu']],
    test: 'Longiligne : membres fins et longs, poignets fins. Trapu : membres courts et épais, poignets larges.' },
  { key: 'epaule', label: 'Mobilité des épaules', options: [['bonne', 'Bonne'], ['limitee', 'Limitée']],
    test: 'Dos contre un mur, pieds à 20 cm, monte les bras tendus au-dessus de la tête. Si tes pouces touchent le mur sans que le bas du dos décolle, c’est bon ; sinon, limitée.' },
  { key: 'cheville', label: 'Mobilité des chevilles', options: [['bonne', 'Bonne'], ['limitee', 'Limitée']],
    test: 'Test genou-mur : pied à 10 cm du mur, avance le genou vers le mur. S’il touche sans que le talon se lève, c’est bon ; sinon, limitée.' },
  { key: 'hanche', label: 'Fond de hanche', options: [['bonne', 'Libre'], ['limitee', 'Ça pince']],
    test: 'Allongé sur le dos, ramène un genou vers la poitrine avec les mains. Si ça pince dans le pli de l’aine avant que la cuisse touche le ventre, réponds « Ça pince ».' },
];

const n = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const T = (x) => n(`${x.name || x.n || ''} ${x.en || ''} ${x.slug || ''} ${x.equipment || x.q || ''}`);
const P = (x) => x.pattern || x.pt || '';
const has = (x, re) => re.test(T(x));
const bar = (x) => has(x, /\b(barre|barbell|smith)\b/) && !has(x, /halt|dumbbell|kettlebell|ez\b/);

// Familles d'exercices
export const F = {
  backSquat: (x) => P(x) === 'squat' && bar(x) && !has(x, /front|avant|goblet|zercher|hack|box|bench|banc|split|bulgar|pistol|overhead|jump|saute/),
  frontSquat: (x) => P(x) === 'squat' && has(x, /front|avant|goblet|zercher/),
  machineLeg: (x) => P(x) === 'leg_press' || has(x, /hack|presse|leg press|pendulum|belt squat/),
  convDeadlift: (x) => P(x) === 'hinge' && has(x, /deadlift|souleve/) && !has(x, /roman|roumain|rdl|stiff|jambes tendues|sumo|trap|hex|single|unilat|deficit/),
  sumoTrap: (x) => P(x) === 'hinge' && has(x, /sumo|trap bar|hex/),
  benchBar: (x) => ['press_horizontal', 'press_incline'].includes(P(x)) && bar(x) && !has(x, /close|serr|floor|sol\b/),
  benchWide: (x) => ['press_horizontal', 'press_incline'].includes(P(x)) && has(x, /wide|large/),
  dbPress: (x) => ['press_horizontal', 'press_incline'].includes(P(x)) && has(x, /halt|dumbbell/),
  uprightRow: (x) => has(x, /upright|menton/),
  behindNeck: (x) => has(x, /behind (the )?(neck|head)|nuque/) && ['press_vertical', 'vertical_pull', 'lib'].includes(P(x)) && !has(x, /stretch|etirement/),
  dips: (x) => P(x) === 'dip' || has(x, /\bdips?\b/),
  overhead: (x) => P(x) === 'press_vertical',
  wideGripPull: (x) => P(x) === 'vertical_pull' && has(x, /wide|large/),
  deepFlexionHip: (x) => (P(x) === 'squat' && has(x, /full|complet|profond|ass to grass|atg/)) || (P(x) === 'leg_press' && has(x, /deep|profond/)),
  latRaise: (x) => P(x) === 'lateral_raise',
  pullover: (x) => has(x, /pull ?over/),
  goodMorning: (x) => has(x, /good morning/),
  pushup: (x) => has(x, /push-?up|pompe/),
  lunge: (x) => P(x) === 'lunge',
};

// Règles : quand (profil), quoi (famille), effet sur la note (-3 à +2), raison, meilleure option
const RULES = [
  { when: (m) => m.femurs === 'longs', on: F.backSquat, d: -2, tone: 'attention', text: 'Fémurs longs : au squat barre, le buste penche fort et le bas du dos prend le relais des cuisses.', alt: 'squat avant, hack squat, presse ou talons surélevés' },
  { when: (m) => m.femurs === 'longs', on: F.frontSquat, d: 1, tone: 'bon', text: 'Fémurs longs : la charge devant garde le buste droit, les cuisses travaillent mieux.' },
  { when: (m) => m.femurs === 'longs', on: F.machineLeg, d: 1, tone: 'bon', text: 'Fémurs longs : la machine guide le buste, idéal pour cibler les cuisses.' },
  { when: (m) => m.femurs === 'courts', on: F.backSquat, d: 1, tone: 'bon', text: 'Fémurs courts : leviers favorables au squat barre, buste droit.' },
  { when: (m) => m.bras === 'longs' || (m.femurs === 'courts' && m.bras !== 'courts'), on: F.convDeadlift, d: 1, tone: 'bon', text: 'Bras longs : la barre part plus haut, le soulevé de terre classique te réussit.' },
  { when: (m) => m.bras === 'courts' || (m.femurs === 'longs' && m.bras !== 'longs'), on: F.convDeadlift, d: -1, tone: 'attention', text: 'Bras courts ou fémurs longs : au soulevé classique, les hanches partent bas et le dos s’arrondit facilement.', alt: 'soulevé sumo ou à la trap bar' },
  { when: (m) => m.bras === 'courts' || m.femurs === 'longs', on: F.sumoTrap, d: 1, tone: 'bon', text: 'Avec tes leviers, le sumo ou la trap bar garde le dos plus droit.' },
  { when: (m) => m.bras === 'longs', on: F.benchBar, d: -1, tone: 'attention', text: 'Bras longs : grande amplitude au développé barre, les épaules encaissent plus.', alt: 'développé haltères ou prise un peu plus large, arrêt à 2 doigts de la poitrine' },
  { when: (m) => m.bras === 'longs', on: F.dbPress, d: 1, tone: 'bon', text: 'Bras longs : les haltères laissent les épaules trouver leur trajectoire.' },
  { when: (m) => m.bras === 'courts', on: F.benchBar, d: 1, tone: 'bon', text: 'Bras courts : course courte, leviers favorables au développé couché.' },
  { when: (m) => m.bras === 'longs', on: F.dips, d: -1, tone: 'attention', text: 'Bras longs : aux dips, l’épaule part loin en arrière en bas du mouvement.', alt: 'dips moins profonds (bras parallèles au sol) ou développé décliné' },
  { when: (m) => m.clavicules === 'etroites', on: F.benchWide, d: -2, tone: 'attention', text: 'Clavicules étroites : la prise large étire l’avant de l’épaule plus que les pectoraux.', alt: 'prise moyenne, haltères ou écartés' },
  { when: (m) => m.clavicules === 'etroites', on: F.dbPress, d: 1, tone: 'bon', text: 'Clavicules étroites : les haltères respectent la largeur de tes épaules.' },
  { when: (m) => m.clavicules === 'larges', on: F.benchWide, d: 1, tone: 'bon', text: 'Clavicules larges : la prise large suit ta structure.' },
  { when: (m) => m.clavicules === 'etroites', on: F.wideGripPull, d: -1, tone: 'attention', text: 'Clavicules étroites : la prise très large raccourcit l’amplitude du dos.', alt: 'prise largeur d’épaules ou prise neutre' },
  // Conflits articulaires
  { when: () => true, on: F.uprightRow, d: -2, tone: 'conflit', text: 'Conflit sous-acromial : bras levés en rotation interne, le tendon se pince sous l’os de l’épaule.', alt: 'élévations latérales légèrement vers l’avant, pouce vers le haut, ou rowing menton prise large jusqu’au sternum' },
  { when: () => true, on: F.behindNeck, d: -2, tone: 'conflit', text: 'Derrière la nuque : l’épaule est forcée en rotation externe extrême, risque de conflit et d’instabilité.', alt: 'la version devant la tête' },
  { when: (m, c) => m.epaule === 'limitee' || c.pain.epaule, on: F.overhead, d: -1, tone: 'conflit', text: 'Épaule raide ou douloureuse : au-dessus de la tête, le bas du dos se creuse et l’épaule se pince.', alt: 'développé incliné haltères à 60°, prise neutre' },
  { when: (m, c) => m.epaule === 'limitee' || c.pain.epaule, on: F.dips, d: -1, tone: 'conflit', text: 'Épaule raide ou douloureuse : le bas des dips met l’avant de l’épaule en tension.', alt: 'développé décliné ou machine convergente' },
  { when: (m, c) => m.epaule === 'limitee' || c.pain.epaule, on: F.pullover, d: -1, tone: 'conflit', text: 'Épaule raide : le pull-over en fin de course force l’épaule.', alt: 'pull-over à la poulie, amplitude réduite' },
  { when: (m, c) => m.epaule === 'limitee' || c.pain.epaule, on: F.latRaise, d: 0, tone: 'attention', text: 'Épaule sensible : élévations dans le plan de l’omoplate (bras à 30° vers l’avant), sans dépasser l’horizontale.' },
  { when: (m) => m.cheville === 'limitee', on: (x) => F.backSquat(x) || F.frontSquat(x), d: -1, tone: 'attention', text: 'Chevilles raides : les talons décollent ou le dos s’arrondit en bas du squat.', alt: 'talons surélevés (cale de 2 cm), hack squat ou presse' },
  { when: (m) => m.hanche === 'limitee', on: F.deepFlexionHip, d: -2, tone: 'conflit', text: 'Pincement de hanche : en flexion profonde, le col du fémur bute sur le bassin (conflit fémoro-acétabulaire).', alt: 'squat à la parallèle, pieds plus écartés et pointes ouvertes' },
  { when: (m) => m.hanche === 'limitee', on: F.backSquat, d: -1, tone: 'attention', text: 'Hanche qui pince : arrête le squat à la parallèle, pieds plus écartés, pointes ouvertes.' },
  { when: (m, c) => c.pain.bas_du_dos || c.pain.dos, on: (x) => F.goodMorning(x) || F.convDeadlift(x) || F.backSquat(x), d: -1, tone: 'conflit', text: 'Douleur au bas du dos : la charge sur la colonne est à limiter pour l’instant.', alt: 'presse, hip thrust ou soulevé à la trap bar léger' },
  { when: (m, c) => c.pain.genou, on: (x) => F.lunge(x) || F.deepFlexionHip(x), d: -1, tone: 'conflit', text: 'Douleur au genou : la flexion profonde sous charge l’irrite.', alt: 'amplitude réduite, presse avec pieds hauts' },
  { when: (m) => m.gabarit === 'longiligne', on: F.machineLeg, d: 1, tone: 'bon', text: 'Gabarit longiligne : la machine stabilise de longs segments.' },
];

export const morphoComplete = (m) => !!m && MORPHO_QUESTIONS.some((q) => m[q.key]);

// Note d'un exercice pour ce profil : 0 = neutre ; notes ordonnées (conflits d'abord)
export function rateExercise(x, m = {}, pains = []) {
  const c = { pain: Object.fromEntries((pains || []).map((p) => [p.area || p, true])) };
  let score = 0; const notes = [];
  for (const r of RULES) {
    if (!r.when(m || {}, c) || !r.on(x)) continue;
    score += r.d; notes.push({ tone: r.tone, text: r.text, alt: r.alt || null });
  }
  const rank = { conflit: 0, attention: 1, bon: 2 };
  notes.sort((a, b) => rank[a.tone] - rank[b.tone]);
  return { score, notes, verdict: notes.some((x) => x.tone === 'conflit') ? 'conflit' : score < 0 ? 'attention' : score > 0 ? 'bon' : 'neutre' };
}

// Conflits dans le programme : morphologie, ordre des exercices, même articulation deux jours de suite, doublons
const JOINT = { press_horizontal: 'epaule', press_incline: 'epaule', press_vertical: 'epaule', dip: 'epaule', lateral_raise: 'epaule', front_raise: 'epaule', chest_fly: 'epaule',
  squat: 'genou', leg_press: 'genou', lunge: 'genou', knee_extension: 'genou', hinge: 'bas_du_dos', triceps_extension: 'coude' };
const BIG = { press_horizontal: ['triceps', 'epaules_ant'], press_incline: ['triceps', 'epaules_ant'], press_vertical: ['triceps', 'epaules_lat'], dip: ['triceps'],
  vertical_pull: ['biceps', 'avant_bras'], horizontal_row: ['biceps', 'avant_bras', 'epaules_post'], squat: ['lombaires', 'abdominaux'], hinge: ['lombaires', 'avant_bras'] };
const SMALL = { triceps_extension: 'triceps', triceps_pushdown: 'triceps', curl: 'biceps', curl_hammer: 'biceps', front_raise: 'epaules_ant', lateral_raise: 'epaules_lat',
  hinge_light: 'lombaires', core_flexion: 'abdominaux', core_anti_extension: 'abdominaux', rear_delt_fly: 'epaules_post' };
const SMALL_LABEL = { triceps: 'les triceps', biceps: 'les biceps', epaules_ant: 'l’avant des épaules', epaules_lat: 'les épaules', lombaires: 'les lombaires', abdominaux: 'les abdos', epaules_post: 'l’arrière des épaules', avant_bras: 'les avant-bras' };

export function programConflicts(days, m = {}, pains = []) {
  const out = [];
  for (const d of days) {
    const ex = d.exercises || [];
    for (const e of ex) {
      const r = rateExercise(e, m, pains);
      const worst = r.notes.find((x) => x.tone !== 'bon');
      if (worst && r.score < 0) out.push({ type: worst.tone === 'conflit' ? 'conflit' : 'morpho', day: d.name, day_id: d.id, pe_id: e.id, exercise: e.name, text: worst.text, alt: worst.alt, pattern: e.pattern, muscles: e.muscles });
    }
    // Ordre : un petit muscle épuisé avant le gros exercice qui en a besoin
    ex.forEach((e, i) => {
      const small = SMALL[e.pattern]; if (!small) return;
      const later = ex.slice(i + 1).find((x) => (BIG[x.pattern] || []).includes(small));
      if (later) out.push({ type: 'ordre', day: d.name, day_id: d.id, pe_id: e.id, exercise: e.name, text: `${e.name} fatigue ${SMALL_LABEL[small]} avant ${later.name}, qui en a besoin : tu perdras des reps sur le gros exercice.`, alt: `place ${e.name} après ${later.name}`, move_after: later.id });
    });
    // Doublons : même schéma et même muscle principal dans la même séance
    const seen = {};
    for (const e of ex) {
      const main = Object.entries(e.muscles || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
      // Variante unilatérale ou autre matériel = autre stimulus : pas un doublon
      if (!e.pattern || e.pattern === 'custom' || has(e, /unilat|1 bras|un bras|one.arm|single/)) continue;
      const k = `${e.pattern}|${main}|${n(e.equipment).split(/[ /]/)[0]}`;
      if (seen[k] && !['horizontal_row', 'curl'].includes(e.pattern)) out.push({ type: 'doublon', day: d.name, day_id: d.id, pe_id: e.id, exercise: e.name, text: `${e.name} et ${seen[k]} travaillent ${main ? 'le même muscle' : 'pareil'} sous le même angle.`, alt: 'un autre angle (incliné, unilatéral, poulie) pour un muscle plus complet', pattern: e.pattern, muscles: e.muscles });
      else seen[k] = e.name;
    }
  }
  // Même articulation très sollicitée deux jours de suite (jours de programme consécutifs)
  const load = days.map((d) => { const j = {}; for (const e of d.exercises || []) { const k = JOINT[e.pattern]; if (k) j[k] = (j[k] || 0) + (Number(e.sets) || 3); } return j; });
  const JL = { epaule: 'les épaules', genou: 'les genoux', bas_du_dos: 'le bas du dos', coude: 'les coudes' };
  for (let i = 1; i < days.length; i++) for (const [k, v] of Object.entries(load[i])) {
    if (v >= 9 && (load[i - 1][k] || 0) >= 9) out.push({ type: 'articulation', day: days[i].name, day_id: days[i].id, text: `${days[i - 1].name} puis ${days[i].name} chargent fort ${JL[k]} (${load[i - 1][k]} puis ${v} séries) : peu de récupération pour l’articulation.`, alt: 'intercaler un jour d’un autre groupe ou alléger un des deux' });
  }
  return out;
}
