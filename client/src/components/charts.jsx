import { Chart as C, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

C.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);
C.defaults.color = '#8a93a6';
C.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif';
C.defaults.font.size = 11;
C.defaults.borderColor = 'rgba(255,255,255,0.06)';

export const COLORS = { lime: '#c6ff3d', mint: '#3dffb5', blue: '#6ea8ff', orange: '#ffb547', pink: '#ff7ab6', violet: '#a98bff' };

const base = (yTitle, legend) => ({
  responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: !!legend, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
    tooltip: { backgroundColor: '#1b2030', borderColor: '#2c3346', borderWidth: 1, padding: 10, titleColor: '#e9ecf3', bodyColor: '#c9cfdc', displayColors: true },
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
      label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.fill ? `${s.color}22` : s.color, fill: !!s.fill, tension: 0.35,
      pointRadius: labels.length > 20 ? 0 : 3, pointHoverRadius: 5, borderWidth: 2.5, spanGaps: true, yAxisID: s.axis || 'y',
    })),
  };
  const o = base(yTitle, series.length > 1);
  o.scales.y.beginAtZero = beginAtZero;
  if (series.some((s) => s.axis === 'y2')) o.scales.y2 = { position: 'right', grid: { display: false }, ticks: { maxTicksLimit: 5 } };
  return <div style={{ height }}><Line data={data} options={o} /></div>;
}

export function BarChart({ labels, series, yTitle, height = 220, stacked }) {
  const data = { labels, datasets: series.map((s) => ({ label: s.label, data: s.data, backgroundColor: s.color, borderRadius: 6, maxBarThickness: 28 })) };
  const o = base(yTitle, series.length > 1);
  o.scales.y.beginAtZero = true;
  if (stacked) { o.scales.x.stacked = true; o.scales.y.stacked = true; }
  return <div style={{ height }}><Bar data={data} options={o} /></div>;
}

// Mini courbe sans axes (tableau de bord)
export function Spark({ points, color = COLORS.lime, height = 40 }) {
  if (!points?.length) return null;
  const vals = points.map((p) => p.value); const min = Math.min(...vals), max = Math.max(...vals);
  const w = 100, h = 30; const span = max - min || 1;
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, vals.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}><path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" /></svg>;
}
