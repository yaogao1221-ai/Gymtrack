// Visuel du bilan de la semaine, dessiné sur un canvas : format story (1080 × 1920, Insta / Snap) ou post (1080 × 1350).
// Sortie JPEG : fichier léger que les applis reconnaissent comme une photo.
import { fmtDate, addDays, n0, n1, mins } from './format.js';

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const font = (w, s, f = 'Sora') => `${w} ${s}px ${f}, Manrope, -apple-system, "Helvetica Neue", sans-serif`;
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);

export const recapRange = (r) => `${fmtDate(r.from, { day: 'numeric', month: 'short' })} – ${fmtDate(r.to, { day: 'numeric', month: 'short' })}`;

export function verdict(r) {
  const { cur, target } = r;
  if (!cur.workouts && !cur.cardio_sessions) return 'Semaine off. La prochaine sera la bonne.';
  if (target && cur.workouts >= target) return r.records.length ? 'Objectif atteint et records battus. Semaine parfaite.' : 'Objectif de séances atteint. Solide.';
  if (r.records.length) return `${r.records.length} record${r.records.length > 1 ? 's' : ''} battu${r.records.length > 1 ? 's' : ''} cette semaine.`;
  if (cur.volume_lbs > r.prev.volume_lbs && r.prev.volume_lbs) return 'Plus de volume que la semaine dernière. Ça monte.';
  return 'Une semaine de plus dans la boîte. La régularité paie.';
}

// Titre court et percutant pour le visuel
function headline(r) {
  const { cur, target } = r;
  if (!cur.workouts && !cur.cardio_sessions) return ['SEMAINE', 'OFF'];
  if (target && cur.workouts >= target && r.records.length) return ['SEMAINE', 'PARFAITE'];
  if (r.records.length) return ['NOUVEAUX', 'RECORDS'];
  if (target && cur.workouts >= target) return ['OBJECTIF', 'ATTEINT'];
  if (r.prev.volume_lbs && cur.volume_lbs > r.prev.volume_lbs) return ['ÇA', 'MONTE'];
  return ['TOUJOURS', 'LÀ'];
}

function loadImg(src) {
  return new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}

function fit(g, text, max, w, size, f) {
  let s = size; g.font = font(w, s, f);
  while (g.measureText(text).width > max && s > 20) { s -= 4; g.font = font(w, s, f); }
  return s;
}

function wrapLines(g, text, max) {
  const out = []; let l = '';
  for (const w of text.split(' ')) { const t = l ? `${l} ${w}` : w; if (g.measureText(t).width > max && l) { out.push(l); l = w; } else l = t; }
  if (l) out.push(l); return out;
}

function grad(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; }

function glow(g, W, H, x, y, rad, col) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}

function background(g, W, H) {
  g.fillStyle = '#08070f'; g.fillRect(0, 0, W, H);
  glow(g, W, H, W * 0.95, H * 0.06, W * 0.85, 'rgba(255,92,56,.55)');
  glow(g, W, H, W * 0.05, H * 0.42, W * 0.8, 'rgba(139,92,246,.42)');
  glow(g, W, H, W * 0.9, H * 0.78, W * 0.75, 'rgba(255,61,139,.30)');
  glow(g, W, H, W * 0.1, H * 1.02, W * 0.9, 'rgba(46,230,197,.32)');
  // Lignes diagonales très discrètes (texture « sport »)
  g.save(); g.globalAlpha = 0.045; g.strokeStyle = '#fff'; g.lineWidth = 2;
  for (let x = -H; x < W; x += 44) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); }
  g.restore();
  // Vignette
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}

function glass(g, x, y, w, h, rad) {
  g.save(); g.fillStyle = 'rgba(255,255,255,.065)'; g.beginPath(); g.roundRect(x, y, w, h, rad); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.stroke(); g.restore();
}

function brand(g, x, y, size) {
  g.save(); g.fillStyle = grad(g, x, y, x + size, y + size, ['#ffb03a', '#ff4d8d']); g.beginPath(); g.roundRect(x, y, size, size, size * 0.28); g.fill();
  // Haltère stylisée
  g.fillStyle = '#1a0b10'; const c = y + size / 2; const u = size / 12;
  g.fillRect(x + 3 * u, c - u * 0.6, 6 * u, u * 1.2);
  [[2, 2.2], [8.6, 2.2]].forEach(([dx]) => { g.beginPath(); g.roundRect(x + dx * u - 0.6 * u, c - 2.4 * u, 1.6 * u, 4.8 * u, u * 0.5); g.fill(); });
  g.fillStyle = '#f4f2ff'; g.font = font(700, size * 0.5); g.textBaseline = 'middle'; g.fillText('GYMTRACK', x + size + size * 0.32, c + 2); g.textBaseline = 'alphabetic';
  g.restore();
}

function avatar(g, img, name, cx, cy, rad) {
  g.save();
  g.beginPath(); g.arc(cx, cy, rad + 7, 0, Math.PI * 2); g.fillStyle = grad(g, cx - rad, cy - rad, cx + rad, cy + rad, ['#ffb03a', '#ff4d8d', '#8b5cf6']); g.fill();
  g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fillStyle = '#16142a'; g.fill(); g.clip();
  if (img) g.drawImage(img, cx - rad, cy - rad, rad * 2, rad * 2);
  else { g.fillStyle = '#f4f2ff'; g.font = font(700, rad * 0.95); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((name || 'G').slice(0, 1).toUpperCase(), cx, cy + rad * 0.06); }
  g.restore();
}

// Anneau de progression : séances / objectif (ou jours actifs / 7)
function ring(g, r, cx, cy, rad, thick) {
  const goal = r.target || 7; const val = r.target ? r.cur.workouts : r.active_days.length; const p = Math.min(1, val / goal);
  g.save();
  glow(g, g.canvas.width, g.canvas.height, cx, cy, rad * 1.6, 'rgba(255,122,61,.22)');
  g.lineCap = 'round'; g.lineWidth = thick;
  g.strokeStyle = 'rgba(255,255,255,.09)'; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.stroke();
  if (p > 0) {
    g.shadowColor = 'rgba(255,90,90,.75)'; g.shadowBlur = thick;
    g.strokeStyle = grad(g, cx - rad, cy - rad, cx + rad, cy + rad, ['#ffd23a', '#ff7a3d', '#ff3d8b']);
    g.beginPath(); g.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(p, 0.02)); g.stroke();
  }
  g.shadowBlur = 0;
  // Graduations
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.lineCap = 'butt';
  for (let i = 0; i < goal; i++) { const a = -Math.PI / 2 + (i / goal) * Math.PI * 2; const r0 = rad - thick / 2 - 18; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 - 14), cy + Math.sin(a) * (r0 - 14)); g.stroke(); }
  g.textAlign = 'center'; g.fillStyle = '#ffffff';
  const big = String(r.cur.workouts); g.font = font(700, rad * 0.92); g.fillText(big, cx, cy + rad * 0.22);
  g.fillStyle = 'rgba(244,242,255,.72)'; g.font = font(700, rad * 0.15, 'Manrope');
  g.fillText(`SÉANCE${r.cur.workouts > 1 ? 'S' : ''}${r.target ? ` SUR ${r.target}` : ''}`, cx, cy + rad * 0.5);
  g.restore();
}

function statTile(g, x, y, w, h, value, label, colors, d) {
  glass(g, x, y, w, h, 34);
  g.save();
  g.fillStyle = grad(g, x, y, x, y + h, colors); g.beginPath(); g.roundRect(x + 26, y + 30, 8, h - 60, 4); g.fill();
  const vs = fit(g, value, w - 90, 700, h * 0.42); g.fillStyle = grad(g, x + 54, y, x + w, y + h, colors);
  g.fillText(value, x + 56, y + h * 0.18 + vs * 0.82);
  g.fillStyle = 'rgba(244,242,255,.7)'; g.font = font(600, h * 0.155, 'Manrope'); g.fillText(label, x + 58, y + h - h * 0.17);
  if (d) {
    const t = `${d > 0 ? '▲' : '▼'} ${Math.abs(d)} %`; g.font = font(700, h * 0.13, 'Manrope'); const tw = g.measureText(t).width + 28;
    g.fillStyle = d > 0 ? 'rgba(46,230,197,.18)' : 'rgba(255,77,109,.18)'; g.beginPath(); g.roundRect(x + w - tw - 22, y + 24, tw, h * 0.2, h * 0.1); g.fill();
    g.fillStyle = d > 0 ? '#2ee6c5' : '#ff6b86'; g.fillText(t, x + w - tw - 8, y + 24 + h * 0.145);
  }
  g.restore();
}

function dayDots(g, r, x0, y, w, rad) {
  const step = (w - rad * 2) / 6;
  DAYS.forEach((d, i) => {
    const on = r.active_days.includes(addDays(r.from, i)); const cx = x0 + rad + i * step;
    g.save();
    if (on) { g.shadowColor = 'rgba(255,110,70,.8)'; g.shadowBlur = 28; g.fillStyle = grad(g, cx - rad, y - rad, cx + rad, y + rad, ['#ffb03a', '#ff4d8d']); }
    else g.fillStyle = 'rgba(255,255,255,.08)';
    g.beginPath(); g.arc(cx, y, rad, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    if (!on) { g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = on ? '#1a0b10' : 'rgba(244,242,255,.45)'; g.font = font(700, rad * 0.8); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d, cx, y + 2);
    g.restore();
  });
}

function stats(r) {
  const c = r.cur;
  const cardio = c.cardio_km ? [`${n1(c.cardio_km)} km`, 'de cardio', null] : c.cardio_minutes ? [mins(c.cardio_minutes), 'de cardio', null] : [mins(c.training_minutes) || '0 min', 'de muscu', null];
  return [
    [n0(c.sets), 'séries validées', ['#c4b5fd', '#e14bd0'], pct(c.sets, r.prev.sets)],
    [n0(c.volume_lbs), 'lbs soulevées', ['#ffd23a', '#ff7a3d'], pct(c.volume_lbs, r.prev.volume_lbs)],
    [cardio[0], cardio[1], ['#5ff5dc', '#3b82f6'], null],
    [r.records.length ? String(r.records.length) : (c.avg_rpe ? `${n1(c.avg_rpe)}/10` : String(r.active_days.length)), r.records.length ? `record${r.records.length > 1 ? 's' : ''} battu${r.records.length > 1 ? 's' : ''}` : (c.avg_rpe ? 'effort moyen' : 'jours actifs'), ['#ff9ec4', '#ff3d8b'], null],
  ];
}

function headlineText(g, r, x, y, size, max) {
  const [a, b] = headline(r);
  g.save(); g.fillStyle = '#ffffff'; const s1 = fit(g, a, max, 700, size); g.fillText(a, x, y);
  const s2 = fit(g, b, max, 700, size * 1.12); const y2 = y + s1 * 0.16 + s2 * 0.98; const bw = g.measureText(b).width;
  g.fillStyle = grad(g, x, y2, x + Math.max(bw, 200), y2, ['#ffd23a', '#ff7a3d', '#ff3d8b']); g.fillText(b, x, y2);
  g.restore(); return y2;
}

function footer(g, r, W, y, size) {
  g.save(); g.textAlign = 'center';
  g.fillStyle = 'rgba(244,242,255,.55)'; g.font = font(600, size, 'Manrope');
  const t = r.streak > 1 ? `🔥 ${r.streak} semaines d’affilée  ·  GymTrack` : 'Suivi avec GymTrack';
  g.fillText(t, W / 2, y); g.restore();
}

export async function drawRecap(r, name, format = 'story', photo = null) {
  try { await document.fonts?.ready; } catch { /* polices système */ }
  const img = await loadImg(photo);
  const W = 1080; const H = format === 'story' ? 1920 : 1350; const M = 80;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  background(g, W, H);
  const tiles = stats(r);
  if (format === 'story') {
    brand(g, M, 150, 64);
    g.save(); g.font = font(700, 26, 'Manrope'); const lab = 'BILAN DE LA SEMAINE'; const lw = g.measureText(lab).width + 48;
    g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.roundRect(W - M - lw, 152, lw, 60, 30); g.fill();
    g.fillStyle = '#f4f2ff'; g.fillText(lab, W - M - lw + 24, 192); g.restore();
    avatar(g, img, name, M + 62, 340, 62);
    g.fillStyle = '#ffffff'; fit(g, name || 'Ma semaine', W - M * 2 - 160, 700, 66); g.fillText(name || 'Ma semaine', M + 160, 330);
    g.fillStyle = 'rgba(244,242,255,.6)'; g.font = font(600, 34, 'Manrope'); g.fillText(recapRange(r), M + 160, 384);
    ring(g, r, W / 2, 680, 220, 46);
    let y = headlineText(g, r, M, 1035, 104, W - M * 2);
    g.fillStyle = 'rgba(244,242,255,.75)'; g.font = font(500, 36, 'Manrope');
    wrapLines(g, verdict(r), W - M * 2).slice(0, 2).forEach((l, i) => g.fillText(l, M, y + 62 + i * 48));
    y = 1310; const tw = (W - M * 2 - 24) / 2; const th = 170;
    tiles.forEach(([v, l, col, d], i) => statTile(g, M + (i % 2) * (tw + 24), y + Math.floor(i / 2) * (th + 24), tw, th, v, l, col, d));
    dayDots(g, r, M, 1745, W - M * 2, 46);
    footer(g, r, W, 1860, 30);
  } else {
    brand(g, M, 80, 54);
    g.save(); g.textAlign = 'right'; g.fillStyle = 'rgba(244,242,255,.6)'; g.font = font(600, 30, 'Manrope'); g.fillText(recapRange(r), W - M, 118); g.restore();
    avatar(g, img, name, M + 48, 232, 48);
    g.fillStyle = '#ffffff'; fit(g, name || 'Ma semaine', W - M * 2 - 130, 700, 56); g.fillText(name || 'Ma semaine', M + 128, 252);
    ring(g, r, 300, 545, 170, 36);
    let y = headlineText(g, r, 540, 450, 80, W - M - 540);
    g.fillStyle = 'rgba(244,242,255,.75)'; g.font = font(500, 30, 'Manrope');
    wrapLines(g, verdict(r), W - M - 540).slice(0, 3).forEach((l, i) => g.fillText(l, 540, y + 52 + i * 40));
    y = 790; const tw = (W - M * 2 - 24) / 2; const th = 160;
    tiles.forEach(([v, l, col, d], i) => statTile(g, M + (i % 2) * (tw + 24), y + Math.floor(i / 2) * (th + 24), tw, th, v, l, col, d));
    dayDots(g, r, M, 1210, W - M * 2, 40);
    footer(g, r, W, 1300, 26);
  }
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
}
