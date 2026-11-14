// Mini-courbe en SVG pur et couleurs des graphiques : sans Chart.js, pour garder l'accueil léger
export const COLORS = { lime: '#0E8747', mint: '#D21034', blue: '#8E8E93', orange: '#FF9500', pink: '#FF2D55', violet: '#AF52DE' };

export function Spark({ points, color = COLORS.lime, height = 40 }) {
  if (!points?.length) return null;
  const vals = points.map((p) => p.value); const min = Math.min(...vals), max = Math.max(...vals);
  const w = 100, h = 30; const span = max - min || 1;
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, vals.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}><path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" /></svg>;
}
