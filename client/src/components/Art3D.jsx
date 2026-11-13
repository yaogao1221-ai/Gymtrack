// Illustrations 3D isométriques en cel-shading : 3 tons (lumière / base / ombre), aucun dégradé ni filtre.
// Tout est construit à partir de 4 primitives (pavé, cylindre, faces isométriques, extrusion) → SVG léger, net à toutes les tailles.
import { useId } from 'react';

export const PAL = {
  bg: '#12111A', card: '#1C1A29',
  coral: ['#FFA88A', '#FF7A50', '#B83D18'],
  cyan: ['#85E2FA', '#33C9F2', '#127A99'],
  violet: ['#DF9EFF', '#C062F8', '#7A24B0'],
  mint: ['#7FF5C4', '#2CE69B', '#148A5A'],
  steel: ['#D4D3E0', '#8E8D9E', '#4A4959'],
  gold: ['#FFE680', '#FFC837', '#B87D00'],
  locked: ['#3A3750', '#262436', '#1B1A27'],
};

// --- Projection isométrique (x vers la droite-bas, y vers la gauche-bas, z vers le haut) ---
const C = 0.866; const S = 0.5;
const O = [60, 80];
const P = (x, y, z) => [O[0] + (x - y) * C, O[1] + (x + y) * S - z];
const pts = (...p) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
// Matrices pour dessiner en 2D directement sur une face : u horizontal, v vers le bas
const onFaceY = (x, y, z) => { const [a, b] = P(x, y, z); return `matrix(${C} ${S} 0 1 ${a.toFixed(1)} ${b.toFixed(1)})`; }; // face avant gauche (normale +y)
const onFaceX = (x, y, z) => { const [a, b] = P(x, y, z); return `matrix(${C} ${-S} 0 1 ${a.toFixed(1)} ${b.toFixed(1)})`; }; // face avant droite (normale +x)
const onTop = (x, y, z) => { const [a, b] = P(x, y, z); return `matrix(${C} ${S} ${-C} ${S} ${a.toFixed(1)} ${b.toFixed(1)})`; };

// Pavé : dessus clair, face gauche en base, face droite en ombre
export function Box({ x, y, z = 0, w, d, h, c }) {
  const [L, B, D] = c;
  return (
    <g>
      <polygon fill={B} points={pts(P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h))} />
      <polygon fill={D} points={pts(P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h))} />
      <polygon fill={L} points={pts(P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h))} />
    </g>
  );
}

// Cylindre vertical : corps en base, tiers droit en ombre, disque du dessus clair
export function Cyl({ x, y, z = 0, r, h, c, top = null }) {
  const [L, B, D] = c;
  const [cx, by] = P(x, y, z); const ty = by - h; const rx = r * 1.2247; const ry = r * 0.7071;
  const k = 0.32; const sx = cx + rx * k; const sy = by + ry * Math.sqrt(1 - k * k);
  return (
    <g>
      <path fill={B} d={`M${cx - rx},${ty} L${cx - rx},${by} A${rx},${ry} 0 0 0 ${cx + rx},${by} L${cx + rx},${ty} Z`} />
      <path fill={D} d={`M${sx},${ty} L${sx},${sy} A${rx},${ry} 0 0 0 ${cx + rx},${by} L${cx + rx},${ty} Z`} />
      <ellipse cx={cx} cy={ty} rx={rx} ry={ry} fill={L} />
      {top}
    </g>
  );
}

// Forme 2D extrudée vers l'arrière (épaisseur en tranches d'ombre) puis face avant en base, reflet clair
function Extrude({ d, t = 6, c, dir = [C, -S], hi = null, transform }) {
  const [, B, D] = c; const steps = Math.max(2, Math.round(t));
  return (
    <g transform={transform}>
      {Array.from({ length: steps }, (_, i) => steps - i).map((i) => <path key={i} d={d} fill={D} transform={`translate(${(dir[0] * i).toFixed(2)} ${(dir[1] * i).toFixed(2)})`} />)}
      <path d={d} fill={B} />
      {hi}
    </g>
  );
}

const Shadow = ({ cx = 60, cy = 100, rx = 34 }) => <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.32} fill="#000" opacity=".28" />;

function Svg({ size = 96, title, children, className = '' }) {
  return (
    <svg className={`art3d ${className}`} viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={title}>
      <title>{title}</title>
      {children}
    </svg>
  );
}

const STAR = 'M0,-9 L2.6,-2.8 L9,-2.8 L3.9,1.2 L5.8,7.6 L0,3.8 L-5.8,7.6 L-3.9,1.2 L-9,-2.8 L-2.6,-2.8 Z';
const BOLT = 'M2,-14 L-8,2 L-1,2 L-3,14 L8,-3 L1,-3 Z';

// ---------- Trophées du classement ----------

// Champion : coupe dorée sur socle corail
export function TrophyChampion({ size, animated, title = 'Champion' }) {
  const g = PAL.gold;
  return (
    <Svg size={size} title={title} className={animated ? 'float' : ''}>
      <Shadow cy={98} rx={34} />
      <Box x={-16} y={-16} z={0} w={32} d={32} h={12} c={PAL.coral} />
      <Box x={-11} y={-11} z={12} w={22} d={22} h={5} c={PAL.coral} />
      <Cyl x={0} y={0} z={17} r={4} h={10} c={g} />
      <Cyl x={0} y={0} z={27} r={9} h={3} c={g} />
      {/* Anses */}
      {(() => { const [cx, cy] = P(0, 0, 50); return (
        <g fill="none" strokeLinecap="round">
          <path d={`M${cx - 17},${cy - 4} C${cx - 31},${cy - 6} ${cx - 29},${cy + 14} ${cx - 15},${cy + 15}`} stroke={g[2]} strokeWidth="5" />
          <path d={`M${cx + 17},${cy - 4} C${cx + 31},${cy - 6} ${cx + 29},${cy + 14} ${cx + 15},${cy + 15}`} stroke={g[2]} strokeWidth="5" />
          <path d={`M${cx - 17},${cy - 5} C${cx - 28},${cy - 6} ${cx - 27},${cy + 10} ${cx - 17},${cy + 12}`} stroke={g[1]} strokeWidth="2" />
        </g>); })()}
      {/* Coupe : tronc de cône */}
      {(() => {
        const [cx, by] = P(0, 0, 30); const ty = by - 30; const rb = 8; const rt = 17;
        const k = 0.34;
        return (
          <g>
            <path fill={g[1]} d={`M${cx - rt},${ty} C${cx - rt},${ty + 18} ${cx - rb},${by - 6} ${cx - rb},${by} A${rb},${rb * 0.58} 0 0 0 ${cx + rb},${by} C${cx + rb},${by - 6} ${cx + rt},${ty + 18} ${cx + rt},${ty} Z`} />
            <path fill={g[2]} d={`M${cx + rt * k},${ty + 6} C${cx + rt * k},${ty + 20} ${cx + rb * k},${by - 4} ${cx + rb * k},${by + 4.4} L${cx + rb},${by} C${cx + rb},${by - 6} ${cx + rt},${ty + 18} ${cx + rt},${ty} Z`} />
            <ellipse cx={cx} cy={ty} rx={rt} ry={rt * 0.5} fill={g[0]} />
            <ellipse cx={cx} cy={ty + 1} rx={rt - 3.5} ry={(rt - 3.5) * 0.46} fill={g[2]} />
            <path d={STAR} fill={g[0]} transform={`translate(${cx - 3} ${ty + 15}) scale(.75)`} />
          </g>
        );
      })()}
      <g transform={onFaceY(-16, 16, 9)}><text x="16" y="0" fontFamily="Sora, sans-serif" fontWeight="700" fontSize="9" fill={PAL.coral[0]} textAnchor="middle">1</text></g>
    </Svg>
  );
}

// Runner of the week : éclair cyan extrudé sur socle cylindrique
export function TrophyRunner({ size, animated, title = 'Runner of the week' }) {
  const c = PAL.cyan;
  const [cx, cy] = P(0, 0, 46);
  return (
    <Svg size={size} title={title} className={animated ? 'float' : ''}>
      <Shadow cy={84} rx={34} />
      <Cyl x={0} y={0} z={0} r={22} h={9} c={PAL.steel} />
      <Cyl x={0} y={0} z={9} r={17} h={6} c={c} />
      <Extrude c={c} t={7} transform={`translate(${cx} ${cy}) scale(2.1)`} d={BOLT}
        hi={<path d="M2,-14 L-8,2 L-5.6,2 L3,-11.5 Z" fill={c[0]} />} />
      {/* Traits de vitesse */}
      <g stroke={c[0]} strokeWidth="3" strokeLinecap="round" opacity=".9">
        <line x1={cx - 34} y1={cy - 8} x2={cx - 22} y2={cy - 8} />
        <line x1={cx - 38} y1={cy + 2} x2={cx - 24} y2={cy + 2} />
        <line x1={cx - 32} y1={cy + 12} x2={cx - 23} y2={cy + 12} />
      </g>
    </Svg>
  );
}

// Iron of the week : disque de fonte en acier, centre corail, debout sur un socle
export function TrophyIron({ size, animated, title = 'Iron of the week' }) {
  const s = PAL.steel; const co = PAL.coral;
  return (
    <Svg size={size} title={title} className={animated ? 'float' : ''}>
      <Shadow cy={96} rx={36} />
      <Box x={-20} y={-12} z={0} w={40} d={24} h={10} c={co} />
      <g transform={onFaceY(-17, 2, 10)}>
        {Array.from({ length: 7 }, (_, i) => 7 - i).map((i) => <circle key={i} cx={17} cy={-27} r={25} fill={s[2]} transform={`translate(${i * 0.9} ${-i * 0.55})`} />)}
        <circle cx={17} cy={-27} r={25} fill={s[1]} />
        <path d="M-6.5,-35 A25,25 0 0 1 9,-50.7 L11,-46 A20,20 0 0 0 -1.6,-33.6 Z" fill={s[0]} />
        <circle cx={17} cy={-27} r={17} fill="none" stroke={s[2]} strokeWidth="2.5" />
        <circle cx={17} cy={-27} r={9} fill={co[2]} />
        <circle cx={17} cy={-27} r={7.5} fill={co[1]} />
        <circle cx={17} cy={-27} r={3} fill={s[2]} />
        <path d="M11.5,-31.5 A7.5,7.5 0 0 1 16,-34.4" stroke={co[0]} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </Svg>
  );
}

// ---------- Badges ----------

const GLYPHS = {
  first: (L) => <path d="M-3,10 L-3,-8 L8,-4 L-3,0" fill="none" stroke={L} strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" />, // drapeau
  w10: (L) => <text y="5.5" textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight="700" fontSize="16" fill={L}>10</text>,
  km42: (L) => <text y="5" textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight="700" fontSize="13" fill={L}>42</text>,
  record: (L) => <path d={STAR} fill={L} transform="scale(1.15)" />,
  streak: (L) => <path d="M0,-11 C5,-5 9,-1 9,4 A9,8 0 0 1 -9,4 C-9,-1 -5,-3 -3,-8 C-2,-4 0,-3 1,-3 C1,-6 0,-9 0,-11 Z" fill={L} />,
  bolt: (L) => <path d={BOLT} fill={L} transform="scale(.85)" />,
};
const HEX = 'M0,-26 L22.5,-13 L22.5,13 L0,26 L-22.5,13 L-22.5,-13 Z';

/**
 * Badge3D : médaille hexagonale en relief.
 * @param {boolean} unlocked  débloqué (couleurs) ou verrouillé (gris + cadenas)
 * @param {'coral'|'cyan'|'violet'|'mint'|'gold'|'steel'} tone
 * @param {'first'|'w10'|'km42'|'record'|'streak'|'bolt'} glyph
 */
export function Badge3D({ unlocked = true, tone = 'violet', glyph = 'record', label, size = 88, animated = false }) {
  const id = useId();
  const c = unlocked ? PAL[tone] : PAL.locked;
  const [L, B, D] = c;
  return (
    <Svg size={size} title={`${label || 'Badge'}${unlocked ? '' : ' (verrouillé)'}`} className={`${unlocked ? '' : 'locked'} ${animated && unlocked ? 'float' : ''}`}>
      <Shadow cy={108} rx={30} />
      <g transform="translate(60 54) scale(1.32)">
        {/* Rubans */}
        {unlocked && <g>
          <polygon points="-15,14 -24,40 -15,35 -9,43 -4,20" fill={PAL.coral[2]} />
          <polygon points="15,14 24,40 15,35 9,43 4,20" fill={PAL.coral[1]} />
        </g>}
        {/* Épaisseur */}
        {[6, 5, 4, 3, 2, 1].map((i) => <path key={i} d={HEX} fill={D} transform={`translate(${i * 0.7} ${i * 0.8})`} />)}
        <path d={HEX} fill={B} stroke={unlocked ? 'none' : PAL.locked[0]} strokeWidth="1.5" />
        {/* Biseau éclairé (haut gauche) */}
        <path d="M0,-26 L22.5,-13 L18.2,-10.5 L0,-21 L-18.2,-10.5 L-18.2,10.5 L-22.5,13 L-22.5,-13 Z" fill={unlocked ? L : PAL.locked[0]} opacity={unlocked ? 1 : 0.6} />
        <clipPath id={id}><path d={HEX} /></clipPath>
        {unlocked && <path d="M-30,-6 L6,-34 L12,-34 L-30,0 Z" fill="#fff" opacity=".14" clipPath={`url(#${id})`} />}
        <g transform="translate(0 1)">
          {unlocked ? <>
            <g transform="translate(1.4 1.6)">{(GLYPHS[glyph] || GLYPHS.record)(D)}</g>
            {(GLYPHS[glyph] || GLYPHS.record)(L)}
          </> : (
            <g>
              <path d="M-6,-3 L-6,-8 A6,6 0 0 1 6,-8 L6,-3" fill="none" stroke={PAL.locked[0]} strokeWidth="3.2" />
              <rect x="-9" y="-3" width="18" height="14" rx="3" fill={PAL.locked[0]} />
              <circle cx="0" cy="3.5" r="2.2" fill={PAL.locked[1]} />
            </g>
          )}
        </g>
      </g>
    </Svg>
  );
}

// ---------- Icônes d'entraînement ----------

// Musculation : haltère posée en diagonale (disques corail, barre acier)
export function IconStrength({ size = 64, animated, title = 'Musculation', className = '' }) {
  const s = PAL.steel; const co = PAL.coral;
  const plate = (x, r, t) => (
    <g transform={onFaceX(x, 0, 20)}>
      {Array.from({ length: t }, (_, i) => t - i).map((i) => <circle key={i} cx={0} cy={0} r={r} fill={co[2]} transform={`translate(${-i * 0.87} ${-i * 0.5})`} />)}
      <circle cx={0} cy={0} r={r} fill={co[1]} />
      <path d={`M${-r * 0.7},${-r * 0.7} A${r},${r} 0 0 1 ${r * 0.7},${-r * 0.7} L${r * 0.5},${-r * 0.5} A${r * 0.72},${r * 0.72} 0 0 0 ${-r * 0.5},${-r * 0.5} Z`} fill={co[0]} />
      <circle cx={0} cy={0} r={2.6} fill={s[2]} />
    </g>
  );
  return (
    <Svg size={size} title={title} className={`${animated ? 'float' : ''} ${className}`}>
      <Shadow cy={98} rx={40} />
      {plate(-26, 19, 8)}
      {plate(-18, 14, 6)}
      <g transform={onFaceY(-30, 0, 18)}><rect x="0" y="0" width="64" height="4.5" rx="2.2" fill={s[1]} /><rect x="0" y="0" width="64" height="1.8" rx=".9" fill={s[0]} /></g>
      {plate(22, 19, 8)}
      {plate(30, 14, 6)}
    </Svg>
  );
}

// Cardio : chronomètre cyan (boîtier en relief, cadran clair, aiguille)
export function IconCardio({ size = 64, animated, title = 'Cardio' }) {
  const c = PAL.cyan; const s = PAL.steel;
  return (
    <Svg size={size} title={title} className={animated ? 'float' : ''}>
      <Shadow cy={98} rx={30} />
      <g transform={onFaceY(-4, 6, 6)}>
        {/* Couronne et poussoir */}
        <rect x="21" y="-82" width="10" height="8" rx="2" fill={s[1]} />
        <rect x="23.5" y="-76" width="5" height="6" fill={s[2]} />
        <rect x="40" y="-73" width="7" height="5" rx="1.5" fill={s[2]} transform="rotate(40 43 -70)" />
        {Array.from({ length: 8 }, (_, i) => 8 - i).map((i) => <circle key={i} cx={26} cy={-40} r={29} fill={c[2]} transform={`translate(${i * 0.87} ${-i * 0.5})`} />)}
        <circle cx={26} cy={-40} r={29} fill={c[1]} />
        <path d="M2,-56 A29,29 0 0 1 26,-69 L26,-64 A24,24 0 0 0 6,-53.5 Z" fill={c[0]} />
        <circle cx={26} cy={-40} r={21} fill={PAL.card} />
        <circle cx={26} cy={-40} r={21} fill="none" stroke={c[2]} strokeWidth="2" />
        {[0, 90, 180, 270].map((a) => <rect key={a} x="25" y="-59" width="2" height="5" rx="1" fill={c[0]} transform={`rotate(${a} 26 -40)`} />)}
        {/* Arc de progression + aiguille */}
        <path d="M26,-56 A16,16 0 0 1 41.2,-45" fill="none" stroke={c[0]} strokeWidth="3.5" strokeLinecap="round" />
        <line x1="26" y1="-40" x2="36" y2="-50" stroke={PAL.coral[1]} strokeWidth="3" strokeLinecap="round" />
        <circle cx={26} cy={-40} r={3} fill={c[0]} />
      </g>
    </Svg>
  );
}

// Récupération : cœur menthe extrudé avec éclair
export function IconRecovery({ size = 64, animated, title = 'Récupération' }) {
  const m = PAL.mint;
  const HEART = 'M0,14 C-4,10 -20,1 -20,-8 C-20,-15 -14,-19 -9,-19 C-5,-19 -2,-17 0,-13 C2,-17 5,-19 9,-19 C14,-19 20,-15 20,-8 C20,1 4,10 0,14 Z';
  return (
    <Svg size={size} title={title} className={animated ? 'pulse3d' : ''}>
      <Shadow cy={100} rx={30} />
      <Extrude c={m} t={8} dir={[1.2, -0.6]} transform="translate(56 62) scale(1.75)" d={HEART}
        hi={<g>
          <path d="M-17,-9 C-17,-14 -13,-17 -9,-17 C-6,-17 -4,-16 -2.5,-14 C-6,-14.5 -12,-13 -14,-6 Z" fill={m[0]} />
          <path d={BOLT} fill={PAL.card} transform="translate(0 -2) scale(.62)" />
          <path d={BOLT} fill={m[0]} transform="translate(-1 -3) scale(.62)" />
        </g>} />
    </Svg>
  );
}

// Trophée selon la catégorie de classement de la ligue
export const TROPHY_BY_CAT = { points: TrophyChampion, km: TrophyRunner, iron: TrophyIron, steps: TrophyRunner };
// Badge de réussite de la ligue → glyphe et couleur
export const BADGE_ART = {
  first: ['first', 'mint'], w10: ['w10', 'coral'], w50: ['w10', 'violet'], km42: ['km42', 'cyan'], km100: ['km42', 'violet'],
  pr5: ['record', 'gold'], pr20: ['record', 'violet'], streak4: ['streak', 'coral'], streak12: ['streak', 'gold'],
};
