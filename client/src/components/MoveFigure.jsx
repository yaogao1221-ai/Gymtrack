import { useState } from 'react';
// Illustration animée d'un exercice (dessin original, pour les exercices sans photo) : silhouette de profil qui passe
// de la position de départ à la position d'arrivée, matériel dessiné, segments des muscles travaillés surlignés.
// Les positions sont décrites par des angles (cinématique directe), ce qui garde des proportions justes.

const L = { torso: 29, thigh: 21, shin: 21, upper: 15, fore: 14, neck: 9 };
const rad = (d) => (d * Math.PI) / 180;
const step = ([x, y], len, deg) => [x + len * Math.sin(rad(deg)), y + len * Math.cos(rad(deg))];
// Pose : h = hanche, t = inclinaison du buste (0 debout, 90 couché tête à droite, -90 tête à gauche),
// l1/l2 = [cuisse, tibia], a1/a2 = [bras, avant-bras] : angles absolus (0 = vers le bas, 90 = vers l'avant, 180 = vers le haut, -90 = vers l'arrière).
// anc = point d'ancrage : ['foot' | 'toe' | 'knee' | 'hand' | 'shoulder' | 'hip', [x, y]] (le reste du corps suit).
function fk(p) {
  const H0 = p.h || [60, 52]; const t = p.t || 0;
  const build = (H) => {
    const S = [H[0] + L.torso * Math.sin(rad(t)), H[1] - L.torso * Math.cos(rad(t))];
    const head = [S[0] + L.neck * Math.sin(rad(t + (p.n || 0))), S[1] - L.neck * Math.cos(rad(t + (p.n || 0)))];
    const leg = ([a, b]) => { const K = step(H, L.thigh, a); const A = step(K, L.shin, b); const fd = p.f ?? 0; const T = [A[0] + 6 * Math.cos(rad(fd)), A[1] + 6 * Math.sin(rad(fd))]; return [H, K, A, T]; };
    const arm = ([u, v]) => { const E = step(S, L.upper, u); const W = step(E, L.fore, v); return [S, E, W]; };
    return { H, S, head, l1: leg(p.l1 || [0, 0]), l2: leg(p.l2 || p.l1 || [0, 0]), a1: arm(p.a1 || [0, 0]), a2: arm(p.a2 || p.a1 || [0, 0]) };
  };
  let o = build(H0);
  if (p.anc) {
    const [kind, [x, y]] = p.anc;
    const cur = { foot: o.l1[2], toe: o.l1[3], knee: o.l1[1], hand: o.a1[2], shoulder: o.S, hip: o.H }[kind];
    o = build([H0[0] + x - cur[0], H0[1] + y - cur[1]]);
  }
  return o;
}

const FOOT = ['foot', [60, 94]];
const ST = { l1: [0, 0], a1: [0, 0], anc: FOOT };
// Bibliothèque de mouvements : [départ, arrivée, matériel, décor]
export const MOVES = {
  squat: [{ ...ST, a1: [-30, 165] }, { t: 40, l1: [82, -30], a1: [10, 175], anc: FOOT }, 'barback'],
  goblet: [{ ...ST, a1: [20, 160] }, { t: 22, l1: [82, -30], a1: [40, 175], anc: FOOT }, 'dbchest'],
  sissy: [{ ...ST, a1: [90, 90] }, { t: -45, l1: [55, -35], a1: [70, 70], f: 35, anc: ['toe', [66, 94]] }, 'none'],
  split: [{ t: 0, l1: [18, 0], l2: [-28, -100], a1: [0, 0], anc: ['foot', [68, 94]] }, { t: 8, l1: [78, -8], l2: [-5, -95], a1: [0, 0], anc: ['foot', [68, 94]] }, 'db', 'benchback'],
  lunge: [{ t: 0, l1: [14, 0], l2: [-14, -14], f: 30, a1: [0, 0], anc: ['foot', [66, 94]] }, { t: 5, l1: [78, -8], l2: [-12, -88], f: 30, a1: [0, 0], anc: ['foot', [66, 94]] }, 'db'],
  hinge: [{ ...ST }, { t: 75, l1: [14, 0], a1: [0, 0], anc: FOOT }, 'bar'],
  deadlift: [{ ...ST }, { t: 55, l1: [62, -15], a1: [0, 0], anc: FOOT }, 'bar'],
  singlerdl: [{ ...ST }, { t: 82, l1: [8, 0], l2: [-98, -98], a1: [0, 0], anc: FOOT }, 'db'],
  hipthrust: [{ t: -75, l1: [60, -10], a1: [-100, -20], anc: ['shoulder', [36, 72]] }, { t: -92, l1: [90, 0], a1: [-100, -20], anc: ['shoulder', [36, 72]] }, 'barhip', 'benchleft'],
  bridge: [{ t: -90, l1: [130, 15], a1: [-90, -90], anc: ['shoulder', [30, 88]] }, { t: -112, l1: [105, 5], a1: [-90, -90], anc: ['shoulder', [30, 88]] }, 'none'],
  backext: [{ t: 160, l1: [-55, -55], a1: [0, 0], anc: ['hip', [64, 58]] }, { t: 55, l1: [-55, -55], a1: [60, 60], anc: ['hip', [64, 58]] }, 'none', 'pad45'],
  legext: [{ t: -6, l1: [90, 12], a1: [8, 8], anc: ['hip', [52, 62]] }, { t: -6, l1: [90, 86], a1: [8, 8], anc: ['hip', [52, 62]] }, 'none', 'seat'],
  legcurl: [{ t: -6, l1: [90, 86], a1: [8, 8], anc: ['hip', [52, 62]] }, { t: -6, l1: [90, -10], a1: [8, 8], anc: ['hip', [52, 62]] }, 'none', 'seat'],
  nordic: [{ t: 0, l1: [0, -90], a1: [20, 40], anc: ['knee', [52, 92]] }, { t: 62, l1: [-62, -90], a1: [45, 45], anc: ['knee', [52, 92]] }, 'none'],
  revnordic: [{ t: 0, l1: [0, -90], a1: [90, 90], anc: ['knee', [56, 92]] }, { t: -45, l1: [45, -90], a1: [60, 60], anc: ['knee', [56, 92]] }, 'none'],
  calf: [{ ...ST, f: 0, anc: ['toe', [66, 90]] }, { l1: [0, 0], a1: [0, 0], f: 40, anc: ['toe', [66, 90]] }, 'db', 'step'],
  bench: [{ t: 90, l1: [-80, 0], a1: [178, 178], anc: ['hip', [40, 74]] }, { t: 90, l1: [-80, 0], a1: [-15, 178], anc: ['hip', [40, 74]] }, 'barbench', 'benchflat'],
  pushup: [{ t: 65, l1: [-65, -65], a1: [0, 0], f: 0, anc: ['foot', [22, 90]] }, { t: 82, l1: [-82, -82], a1: [-100, 25], anc: ['foot', [22, 90]] }, 'none'],
  dip: [{ t: 0, l1: [20, -60], a1: [0, 0], anc: ['hand', [64, 54]] }, { t: 15, l1: [25, -60], a1: [-130, 5], anc: ['hand', [64, 54]] }, 'none', 'bars'],
  ohp: [{ ...ST, a1: [10, 170] }, { ...ST, a1: [175, 178] }, 'barhand'],
  lateral: [{ ...ST, a1: [5, 5] }, { ...ST, a1: [88, 92] }, 'db'],
  front: [{ ...ST, a1: [8, 8] }, { ...ST, a1: [92, 92] }, 'db'],
  reardelt: [{ t: 70, l1: [14, 0], a1: [0, 0], anc: FOOT }, { t: 70, l1: [14, 0], a1: [-75, -75], anc: FOOT }, 'db'],
  fly: [{ t: 12, l1: [14, 0], l2: [-16, -6], a1: [-150, -150], anc: FOOT }, { t: 12, l1: [14, 0], l2: [-16, -6], a1: [70, 75], anc: FOOT }, 'cablehighback'],
  flylow: [{ t: 5, l1: [14, 0], l2: [-16, -6], a1: [-35, -35], anc: FOOT }, { t: 5, l1: [14, 0], l2: [-16, -6], a1: [125, 125], anc: FOOT }, 'cablelowback'],
  row: [{ t: 65, l1: [28, -6], a1: [0, 0], anc: FOOT }, { t: 65, l1: [28, -6], a1: [-115, 0], anc: FOOT }, 'bar'],
  upright: [{ ...ST, a1: [5, 0] }, { ...ST, a1: [125, -15] }, 'bar'],
  machinerow: [{ t: 8, l1: [88, 0], a1: [86, 88], anc: ['hip', [42, 64]] }, { t: 2, l1: [88, 0], a1: [-35, 80], anc: ['hip', [42, 64]] }, 'handle', 'rowmachine'],
  highrow: [{ t: 6, l1: [88, 0], a1: [140, 145], anc: ['hip', [42, 64]] }, { t: 2, l1: [88, 0], a1: [-30, 110], anc: ['hip', [42, 64]] }, 'handle', 'rowmachine'],
  cablerow: [{ t: 18, l1: [90, 90], a1: [88, 88], anc: ['hip', [38, 86]] }, { t: -6, l1: [90, 90], a1: [-15, 80], anc: ['hip', [38, 86]] }, 'cableseat', 'floorseat'],
  pulldown: [{ t: -8, l1: [90, 0], a1: [176, 176], anc: ['hip', [50, 62]] }, { t: -14, l1: [90, 0], a1: [-10, 172], anc: ['hip', [50, 62]] }, 'cabletop', 'seat'],
  pullup: [{ l1: [10, -25], a1: [180, 180], anc: ['hand', [60, -2]] }, { l1: [10, -25], a1: [12, 178], anc: ['hand', [60, -2]] }, 'none', 'barhigh'],
  curl: [{ ...ST, a1: [0, 0] }, { ...ST, a1: [6, 150] }, 'db'],
  cablecurl: [{ t: 5, l1: [16, 0], l2: [-16, -6], a1: [-28, -28], anc: FOOT }, { t: 5, l1: [16, 0], l2: [-16, -6], a1: [-28, 125], anc: FOOT }, 'cablebehind'],
  preacher: [{ t: 12, l1: [90, 0], a1: [55, 65], anc: ['hip', [46, 64]] }, { t: 12, l1: [90, 0], a1: [55, 165], anc: ['hip', [46, 64]] }, 'db', 'pupitre'],
  pushdown: [{ t: 10, l1: [12, 0], l2: [-12, 0], a1: [4, 140], anc: FOOT }, { t: 10, l1: [12, 0], l2: [-12, 0], a1: [4, 6], anc: FOOT }, 'cabletop2'],
  ohext: [{ t: 12, l1: [16, 0], l2: [-16, -6], a1: [168, -25], anc: FOOT }, { t: 12, l1: [16, 0], l2: [-16, -6], a1: [168, 172], anc: FOOT }, 'cablelowback'],
  skull: [{ t: 90, l1: [-80, 0], a1: [165, 165], anc: ['hip', [40, 74]] }, { t: 90, l1: [-80, 0], a1: [165, 55], anc: ['hip', [40, 74]] }, 'barbench', 'benchflat'],
  shrug: [{ ...ST }, { ...ST, up: 4 }, 'db'],
  plank: [{ t: 78, l1: [-78, -78], a1: [0, 90], anc: ['foot', [24, 90]] }, { t: 80, l1: [-80, -80], a1: [0, 90], anc: ['foot', [24, 90]] }, 'none'],
  sideplank: [{ t: 72, l1: [-72, -72], a1: [0, 90], anc: ['foot', [24, 90]] }, { t: 80, l1: [-80, -80], a1: [0, 90], anc: ['foot', [24, 90]] }, 'none'],
  crunch: [{ t: -90, l1: [135, 20], a1: [-160, -40], anc: ['hip', [56, 89]] }, { t: -55, l1: [135, 20], a1: [-130, -10], anc: ['hip', [56, 89]] }, 'none'],
  cablecrunch: [{ t: 10, l1: [0, -90], a1: [160, -20], anc: ['knee', [52, 92]] }, { t: 78, l1: [0, -90], a1: [95, -80], anc: ['knee', [52, 92]] }, 'cabletop3'],
  legraise: [{ l1: [5, 0], a1: [180, 180], anc: ['hand', [60, -2]] }, { l1: [92, 92], a1: [180, 180], anc: ['hand', [60, -2]] }, 'none', 'barhigh'],
  abwheel: [{ t: 40, l1: [-15, -90], a1: [10, 10], anc: ['knee', [30, 92]] }, { t: 78, l1: [-60, -90], a1: [100, 100], anc: ['knee', [30, 92]] }, 'wheel'],
  deadbug: [{ t: -90, l1: [180, 90], a1: [180, 180], anc: ['hip', [56, 89]] }, { t: -90, l1: [100, 100], l2: [180, 90], a1: [-95, -95], a2: [180, 180], anc: ['hip', [56, 89]] }, 'none'],
  carry: [{ l1: [16, 0], l2: [-16, -6], a1: [0, 0], anc: ['foot', [64, 94]] }, { l1: [-16, -6], l2: [16, 0], a1: [0, 0], anc: ['foot', [52, 94]] }, 'db'],
  rower: [{ t: 25, l1: [125, 25], a1: [88, 88], anc: ['hip', [44, 82]] }, { t: -22, l1: [90, 90], a1: [-25, 95], anc: ['hip', [62, 82]] }, 'none', 'rower'],
  bike: [{ t: 30, l1: [75, -5], l2: [25, 25], a1: [65, 65], anc: ['hip', [52, 56]] }, { t: 30, l1: [25, 25], l2: [75, -5], a1: [65, 65], anc: ['hip', [52, 56]] }, 'none', 'bike'],
  skierg: [{ ...ST, a1: [172, 172] }, { t: 50, l1: [25, -10], a1: [-25, -25], anc: FOOT }, 'cabletop'],
  jump: [{ t: 38, l1: [78, -28], a1: [-45, -45], anc: FOOT }, { l1: [0, 0], f: 40, a1: [160, 160], anc: ['foot', [62, 82]] }, 'none'],
  burpee: [{ t: 65, l1: [-65, -65], a1: [0, 0], anc: ['foot', [22, 90]] }, { l1: [0, 0], f: 40, a1: [172, 172], anc: ['foot', [60, 84]] }, 'none'],
  swing: [{ t: 62, l1: [25, -10], a1: [-12, -12], anc: FOOT }, { ...ST, a1: [90, 90] }, 'kb'],
  sled: [{ t: 58, l1: [62, -12], l2: [-22, -30], a1: [65, 65], anc: ['foot', [52, 94]] }, { t: 58, l1: [-22, -30], l2: [62, -12], a1: [65, 65], anc: ['foot', [44, 94]] }, 'none', 'sled'],
  hang: [{ l1: [0, 0], a1: [180, 180], anc: ['hand', [60, -2]] }, { l1: [4, 0], a1: [178, 178], anc: ['hand', [60, -2]] }, 'none', 'barhigh'],
  stretch: [{ t: 0, l1: [85, 0], l2: [-30, -90], a1: [10, 10], anc: ['foot', [74, 94]] }, { t: 8, l1: [70, -18], l2: [-50, -90], a1: [10, 10], anc: ['foot', [74, 94]] }, 'none'],
  lying: [{ t: -90, l1: [130, 50], l2: [90, 90], a1: [-90, -90], anc: ['hip', [56, 89]] }, { t: -90, l1: [165, 75], l2: [90, 90], a1: [-90, -90], anc: ['hip', [56, 89]] }, 'none'],
  abduction: [{ t: -6, l1: [90, 0], a1: [8, 8], anc: ['hip', [52, 62]] }, { t: -6, l1: [90, 0], l2: [72, -12], a1: [8, 8], anc: ['hip', [52, 62]] }, 'none', 'seat'],
};

// Muscles → segments à surligner
const SEG = {
  quadriceps: ['thigh'], ischios: ['thigh'], fessiers: ['hip'], adducteurs: ['thigh'], abducteurs: ['hip'], mollets: ['shin'],
  pectoraux: ['chest'], dos_largeur: ['back'], dos_epaisseur: ['back'], lombaires: ['back'], trapezes: ['back'], abdominaux: ['chest'],
  epaules_ant: ['upper'], epaules_lat: ['upper'], epaules_post: ['upper'], biceps: ['upper'], triceps: ['upper'], avant_bras: ['fore'],
};

// Choix du mouvement : identifiant connu, sinon schéma de mouvement, sinon le nom
export function moveFor(x) {
  if (!x) return null;
  if (x.v && MOVES[x.v]) return x.v;
  const n = `${x.en || ''} ${x.n || x.name || ''}`.toLowerCase(); const pt = x.pt || x.pattern;
  const R = [[/sissy/, 'sissy'], [/nordic/, /reverse/.test(n) ? 'revnordic' : 'nordic'], [/bulgar|split squat|bulgare/, 'split'], [/lunge|fente/, 'lunge'], [/pistol|cossack|cosaque/, 'lunge'],
    [/goblet|heel|cyclist|talons/, 'goblet'], [/squat/, 'squat'], [/single-leg romanian|une jambe/, 'singlerdl'], [/deadlift|soulevé|block pull/, 'deadlift'], [/romanian|good morning/, 'hinge'],
    [/hip thrust|kas|glute bridge|b-stance/, 'hipthrust'], [/frog|bridge|pont/, 'bridge'], [/back extension|extension lombaire|45/, 'backext'], [/pull-through|swing/, 'swing'],
    [/leg extension/, 'legext'], [/leg curl|slider/, 'legcurl'], [/calf|mollet/, 'calf'], [/abduction/, 'abduction'], [/adduction/, 'abduction'],
    [/close-grip bench|bench|larsen|spoto|chest press|développé couché/, 'bench'], [/push-up|pompe/, 'pushup'], [/dip/, 'dip'],
    [/landmine press|z press|press|militaire|arnold/, 'ohp'], [/lateral|latérale|lu raise|y-raise|cuban/, 'lateral'], [/front raise|frontale/, 'front'],
    [/rear delt|reverse pec|oiseau/, 'reardelt'], [/low-to-high|bas vers haut/, 'flylow'], [/fly|pec deck|écarté|butterfly/, 'fly'],
    [/upright row|tirage menton|rowing upright/, 'upright'], [/rower|rameur|rowing_stationary|stationary row/, 'rower'], [/high row|rowing haut|high pulley/, 'highrow'], [/machine row|iso row|low row|t-bar row machine|rowing assis.*machine/, 'machinerow'], [/cable row|tirage assis|rowing assis/, 'cablerow'], [/row|rowing/, 'row'], [/pulldown|lat prayer|tirage/, 'pulldown'], [/pull-up|chin|traction|muscle-up/, 'pullup'],
    [/bayesian|bayésien|cable bar curl|poulie basse/, 'cablecurl'], [/preacher|pupitre/, 'preacher'], [/curl/, 'curl'],
    [/pushdown|corde/, 'pushdown'], [/overhead|katana|au-dessus/, 'ohext'], [/jm press|french|skull|barre au front/, 'skull'], [/shrug/, 'shrug'],
    [/side plank|latéral|copenhagen|copenhague/, 'sideplank'], [/plank|gainage|hollow|l-sit/, 'plank'], [/cable crunch|woodchop|bûcheron/, 'cablecrunch'], [/crunch|curl-up|sit-up/, 'crunch'],
    [/leg raise|relevés de jambes|toes to bar|captain|dragon/, 'legraise'], [/wheel|roulette|rollout/, 'abwheel'], [/dead bug|bird dog/, 'deadbug'],
    [/carry|marche|farmer/, 'carry'], [/rower|rameur/, 'rower'], [/bike|vélo/, 'bike'], [/ski/, 'skierg'], [/jump|saut|double unders|box/, 'jump'], [/burpee|devil|thruster|wall ball/, 'burpee'],
    [/sled|traîneau/, 'sled'], [/hang|suspension/, 'hang'], [/tibialis|pointes/, 'calf']];
  for (const [rx, m] of R) if (rx.test(n)) return m;
  const P = { squat: 'squat', lunge: 'lunge', hinge: 'hinge', hip_extension: 'hipthrust', knee_extension: 'legext', knee_flexion: 'legcurl', calf: 'calf', leg_press: 'squat',
    press_horizontal: 'bench', press_incline: 'bench', dip: 'dip', press_vertical: 'ohp', lateral_raise: 'lateral', front_raise: 'front', chest_fly: 'fly', horizontal_row: 'row',
    vertical_pull: 'pulldown', curl: 'curl', curl_hammer: 'curl', triceps_pushdown: 'pushdown', triceps_extension: 'ohext', shrug: 'shrug', face_pull: 'reardelt', rear_delt_fly: 'reardelt',
    hip_abduction: 'abduction', hip_adduction: 'abduction', mobility: 'stretch' };
  if (P[pt]) return P[pt];
  if (x.c === 'mobilite') return 'stretch';
  if (x.c === 'cardio') return 'bike';
  return 'stand';
}
MOVES.stand = [{ ...ST }, { ...ST, a1: [10, 20] }, 'none'];

const pts = (arr) => arr.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
const anim = (a, b, dur) => ({ values: `${a};${b};${a}`, dur: `${dur}s`, repeatCount: 'indefinite', calcMode: 'spline', keyTimes: '0;0.5;1', keySplines: '0.45 0 0.55 1;0.45 0 0.55 1' });

function Limb({ A, B, k, cls, dur, w }) {
  return <polyline className={cls} points={pts(A)} strokeWidth={w}><animate attributeName="points" {...anim(pts(A), pts(B), dur)} /></polyline>;
}
function Dot({ a, b, r, cls, dur, dx = 0, dy = 0 }) {
  return <circle className={cls} cx={a[0] + dx} cy={a[1] + dy} r={r}>
    <animate attributeName="cx" {...anim((a[0] + dx).toFixed(1), (b[0] + dx).toFixed(1), dur)} /><animate attributeName="cy" {...anim((a[1] + dy).toFixed(1), (b[1] + dy).toFixed(1), dur)} />
  </circle>;
}
function Cable({ from, a, b, dur }) {
  return <line className="mf-cable" x1={from[0]} y1={from[1]} x2={a[0]} y2={a[1]}>
    <animate attributeName="x2" {...anim(a[0].toFixed(1), b[0].toFixed(1), dur)} /><animate attributeName="y2" {...anim(a[1].toFixed(1), b[1].toFixed(1), dur)} />
  </line>;
}

const DECOR = {
  floor: null,
  benchback: <rect className="mf-prop" x="22" y="70" width="22" height="6" rx="2" />,
  benchleft: <><rect className="mf-prop" x="10" y="73" width="30" height="6" rx="2" /><rect className="mf-prop" x="22" y="79" width="5" height="15" /></>,
  benchflat: <><rect className="mf-prop" x="20" y="77" width="60" height="6" rx="2" /><rect className="mf-prop" x="46" y="83" width="6" height="11" /></>,
  pad45: <path className="mf-prop" d="M44 70 L70 52 L74 58 L50 76 Z M62 76 L66 94" />,
  seat: <><rect className="mf-prop" x="34" y="61" width="28" height="6" rx="2" /><rect className="mf-prop" x="30" y="30" width="6" height="34" rx="2" /></>,
  step: <rect className="mf-prop" x="52" y="90" width="22" height="4" rx="1" />,
  bars: <><rect className="mf-prop" x="40" y="54" width="40" height="3" rx="1.5" /><rect className="mf-prop" x="76" y="54" width="3" height="40" /></>,
  barhigh: <rect className="mf-prop" x="35" y="-4" width="50" height="3" rx="1.5" />,
  pupitre: <path className="mf-prop" d="M58 52 L76 64 L74 70 L56 60 Z M62 66 L62 94" />,
  floorseat: <rect className="mf-prop" x="22" y="84" width="40" height="5" rx="2" />,
  rower: <><rect className="mf-prop" x="20" y="88" width="80" height="3" rx="1.5" /><rect className="mf-prop" x="96" y="74" width="8" height="16" rx="3" /></>,
  bike: <><circle className="mf-prop" cx="68" cy="80" r="10" fill="none" /><rect className="mf-prop" x="50" y="60" width="12" height="4" rx="2" /><path className="mf-prop" d="M56 64 L66 80 M80 40 L80 80" /></>,
  rowmachine: <><rect className="mf-prop" x="26" y="66" width="30" height="5" rx="2" /><rect className="mf-prop" x="38" y="71" width="5" height="23" /><rect className="mf-prop" x="54" y="36" width="5" height="22" rx="2.5" /><rect className="mf-prop" x="62" y="84" width="10" height="4" rx="1" /><rect className="mf-prop" x="94" y="20" width="5" height="74" rx="2" /></>,
  sled: <rect className="mf-prop" x="80" y="58" width="10" height="34" rx="3" />,
};

export default function MoveFigure({ x, size = 'lg', muscles, frame, move }) {
  const key = move || moveFor(x) || 'stand';
  const [p0, p1, equip, decor] = MOVES[key];
  let A = fk(p0); let B = fk(p1);
  if (p1.up) { for (const o of [B]) { o.S[1] -= p1.up; o.head[1] -= p1.up; for (const a of [o.a1, o.a2]) a.forEach((pt) => { pt[1] -= p1.up; }); } }
  if (frame === 0) B = A; else if (frame === 1) A = B;
  const dur = key === 'jump' || key === 'burpee' || key === 'bike' || key === 'carry' ? 1.6 : 2.6;
  let m = muscles || x?.m || x?.muscles || {};
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch { m = {}; } }
  const hot = new Set(Object.entries(m).filter(([, v]) => v >= 1).flatMap(([k]) => SEG[k] || []));
  const warm = new Set(Object.entries(m).filter(([, v]) => v > 0 && v < 1).flatMap(([k]) => SEG[k] || []));
  const c = (seg) => (hot.has(seg) ? 'mf-hot' : warm.has(seg) ? 'mf-warm' : 'mf-body');
  const torsoCls = hot.has('chest') || hot.has('back') ? 'mf-hot' : warm.has('chest') || warm.has('back') ? 'mf-warm' : 'mf-body';
  const legParts = (P) => [[P[0], P[1]], [P[1], P[2], P[3]]];
  const H1 = A.a1[2]; const H1b = B.a1[2];
  const W = 120;
  // Vignette : cadrage serré autour de la silhouette (elle remplit la petite case)
  let vb = `0 -14 ${W} 114`;
  if (size === 'thumb') {
    const all = [B.H, B.S, B.head, ...B.l1, ...B.l2, ...B.a1, ...B.a2];
    const xs = all.map((q) => q[0]); const ys = all.map((q) => q[1]);
    let x0 = Math.min(...xs) - 9; let x1 = Math.max(...xs) + 9; let y0 = Math.min(...ys) - 9; let y1 = Math.max(...ys) + 7;
    const w = Math.max(x1 - x0, (y1 - y0) * 4 / 3); const h = w * 3 / 4; const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
    x0 = cx - w / 2; y0 = Math.min(cy - h / 2, 96 - h); vb = `${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  }
  const svg = (cls) => (
      <svg viewBox={vb} className={cls} preserveAspectRatio="xMidYMid meet">
        <line className="mf-ground" x1="6" y1="94.5" x2={W - 6} y2="94.5" />
        {decor && DECOR[decor]}
        {equip === 'cablehighback' && <Cable from={[16, 14]} a={H1} b={H1b} dur={dur} />}
        {(equip === 'cabletop' || equip === 'cabletop2' || equip === 'cabletop3') && <Cable from={[equip === 'cabletop' ? 66 : 74, -10]} a={H1} b={H1b} dur={dur} />}
        {equip === 'cablebehind' && <Cable from={[14, 90]} a={H1} b={H1b} dur={dur} />}
        {equip === 'cablelowback' && <Cable from={[16, 88]} a={H1} b={H1b} dur={dur} />}
        {equip === 'cableseat' && <Cable from={[104, 82]} a={H1} b={H1b} dur={dur} />}
        {/* membres du côté éloigné, plus pâles */}
        <g className="mf-far">
          {(() => { const [a, b] = [legParts(A.l2, 0), legParts(B.l2, 0)]; return <><Limb A={a[0]} B={b[0]} cls={c('thigh')} dur={dur} w={6.5} /><Limb A={a[1]} B={b[1]} cls={c('shin')} dur={dur} w={5} /></>; })()}
          <Limb A={A.a2.slice(0, 2)} B={B.a2.slice(0, 2)} cls={c('upper')} dur={dur} w={5} /><Limb A={A.a2.slice(1)} B={B.a2.slice(1)} cls={c('fore')} dur={dur} w={4} />
        </g>
        <Limb A={[A.H, A.S]} B={[B.H, B.S]} cls={torsoCls} dur={dur} w={10} />
        <Dot a={A.H} b={B.H} r={5.5} cls={c('hip')} dur={dur} />
        <Dot a={A.head} b={B.head} r={6} cls="mf-body" dur={dur} />
        {(() => { const [a, b] = [legParts(A.l1, 0), legParts(B.l1, 0)]; return <><Limb A={a[0]} B={b[0]} cls={c('thigh')} dur={dur} w={7} /><Limb A={a[1]} B={b[1]} cls={c('shin')} dur={dur} w={5.5} /></>; })()}
        <Limb A={A.a1.slice(0, 2)} B={B.a1.slice(0, 2)} cls={c('upper')} dur={dur} w={5.5} /><Limb A={A.a1.slice(1)} B={B.a1.slice(1)} cls={c('fore')} dur={dur} w={4.5} />
        {/* matériel */}
        {(equip === 'db' || equip === 'dbchest') && <Dot a={H1} b={H1b} r={3.6} cls="mf-weight" dur={dur} />}
        {(equip === 'bar' || equip === 'barhand' || equip === 'barbench') && <Dot a={H1} b={H1b} r={7} cls="mf-plate" dur={dur} />}
        {equip === 'barback' && <Dot a={A.S} b={B.S} r={7} cls="mf-plate" dur={dur} dx={-2} dy={1} />}
        {equip === 'barhip' && <Dot a={A.H} b={B.H} r={7} cls="mf-plate" dur={dur} dy={-6} />}
        {equip === 'kb' && <Dot a={H1} b={H1b} r={4.5} cls="mf-weight" dur={dur} dy={3} />}
        {equip === 'wheel' && <Dot a={H1} b={H1b} r={4.5} cls="mf-plate" dur={dur} dy={1} />}
        {equip === 'handle' && <Dot a={H1} b={H1b} r={2.8} cls="mf-weight" dur={dur} />}
        {equip?.startsWith('cable') && <Dot a={H1} b={H1b} r={2.4} cls="mf-weight" dur={dur} />}
      </svg>);
  if (size === 'thumb') return svg('mf mf-thumb');
  return (
    <div className={`demo-img ${size} mf`} role="img" aria-label="Illustration animée du mouvement">
      {svg()}
      <span className="demo-step">Illustration</span>
    </div>
  );
}

// Vignette : la photo si elle existe (et se charge), sinon l'illustration (position d'arrivée)
export function ExThumb({ src, x, className = '' }) {
  const [err, setErr] = useState(false);
  if (src && !err) return <img className={className} src={src} alt="" loading="lazy" onError={() => setErr(true)} />;
  return <span className={`${className} mf-box`} aria-hidden="true"><MoveFigure x={x} size="thumb" frame={1} /></span>;
}
