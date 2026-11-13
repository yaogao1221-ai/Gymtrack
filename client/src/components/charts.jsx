import { Chart as C, CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Radar } from 'react-chartjs-2';

C.register(CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);
// Couleurs d'axes et de grille lues dans le thème (clair le jour, sombre le soir)
const syncChartTheme = () => {
  const cs = getComputedStyle(document.documentElement);
  C.defaults.color = cs.getPropertyValue('--muted').trim() || '#5B6473';
  C.defaults.borderColor = cs.getPropertyValue('--line').trim() || '#E2E6EC';
};
syncChartTheme();
window.addEventListener('gt-theme', syncChartTheme);
C.defaults.font.family = '"Inter", system-ui, sans-serif';
C.defaults.font.size = 11;

export const COLORS = { lime: '#DE4E14', mint: '#2E8B5A', blue: '#3F5F86', orange: '#B08400', pink: '#9A6B5B', violet: '#6A5E9E' };
// Paires de dégradé associées à chaque couleur
const PAIR = {}; // aplats : une couleur par série
const vgrad = (color, alphaTop = 'ff', alphaBottom = 'ff') => (ctx) => {
  const { chart } = ctx; const area = chart.chartArea; if (!area) return color;
  const p = PAIR[color] || [color, color];
  const g = chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
  g.addColorStop(0, p[1] + alphaBottom); g.addColorStop(1, p[0] + alphaTop); return g;
};

const base = (yTitle, legend) => ({
  responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: !!legend, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
    tooltip: { backgroundColor: '#12161F', borderColor: '#2A303C', borderWidth: 1, padding: 10, titleColor: '#FFFFFF', bodyColor: '#D5DAE3', cornerRadius: 10, displayColors: true },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
    y: { beginAtZero: false, grace: '10%', title: { display: !!yTitle, text: yTitle }, ticks: { maxTicksLimit: 5 } },
  },
});

export function LineChart({ labels, series, yTitle, height = 220, beginAtZero = false }) {
  const data = {
    labels,
    datasets: series.map((s) => ({
      label: s.label, data: s.data, borderColor: vgrad(s.color), backgroundColor: s.fill ? vgrad(s.color, '55', '00') : s.color, pointBackgroundColor: s.color, fill: !!s.fill, tension: 0.35,
      pointRadius: labels.length > 20 ? 0 : 3, pointHoverRadius: 5, borderWidth: 2.5, spanGaps: true, yAxisID: s.axis || 'y',
    })),
  };
  const o = base(yTitle, series.length > 1);
  o.scales.y.beginAtZero = beginAtZero;
  if (series.some((s) => s.axis === 'y2')) o.scales.y2 = { position: 'right', grid: { display: false }, ticks: { maxTicksLimit: 5 } };
  return <div style={{ height }}><Line data={data} options={o} /></div>;
}

export function BarChart({ labels, series, yTitle, height = 220, stacked }) {
  const data = { labels, datasets: series.map((s) => ({ label: s.label, data: s.data, backgroundColor: vgrad(s.color), borderRadius: 8, borderSkipped: false, maxBarThickness: 22 })) };
  const o = base(yTitle, series.length > 1);
  o.scales.y.beginAtZero = true;
  if (stacked) { o.scales.x.stacked = true; o.scales.y.stacked = true; }
  return <div style={{ height }}><Bar data={data} options={o} /></div>;
}

// Radar (volume par groupe musculaire)
export function RadarChart({ labels, series, height = 300, max }) {
  const data = { labels, datasets: series.map((s) => ({ label: s.label, data: s.data, borderColor: s.color, backgroundColor: `${s.color}33`, pointBackgroundColor: s.color, pointRadius: 2.5, borderWidth: 2, borderDash: s.dash || [] })) };
  const o = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
    plugins: { legend: { display: series.length > 1, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip: base().plugins.tooltip },
    scales: { r: { min: 0, max, ticks: { display: false, maxTicksLimit: 4 }, grid: { color: 'rgba(128,140,160,0.22)' }, angleLines: { color: 'rgba(128,140,160,0.22)' }, pointLabels: { color: C.defaults.color, font: { size: 10.5 } } } },
  };
  return <div style={{ height }}><Radar data={data} options={o} /></div>;
}

// Mini courbe sans axes (tableau de bord)
export function Spark({ points, color = COLORS.lime, height = 40 }) {
  if (!points?.length) return null;
  const vals = points.map((p) => p.value); const min = Math.min(...vals), max = Math.max(...vals);
  const w = 100, h = 30; const span = max - min || 1;
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, vals.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}><path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" /></svg>;
}
