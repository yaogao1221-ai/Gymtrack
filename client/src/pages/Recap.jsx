import { useState } from 'react';
import { Page, Card, Icon, Segmented, Loading, ErrorBox, useApi, useToast } from '../components/ui.jsx';
import { fmtDate, addDays, n0, n1, mins } from '../lib/format.js';
import { LEAGUE_ON } from '../lib/api.js';
import { getMembership, postMessage } from '../lib/league.js';

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const delta = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
const range = (r) => `${fmtDate(r.from, { day: 'numeric', month: 'short' })} – ${fmtDate(r.to, { day: 'numeric', month: 'short' })}`;

function verdict(r) {
  const { cur, target } = r;
  if (!cur.workouts && !cur.cardio_sessions) return 'Semaine off. La prochaine sera la bonne.';
  if (target && cur.workouts >= target) return r.records.length ? 'Objectif atteint et records battus. Semaine parfaite.' : 'Objectif de séances atteint. Solide.';
  if (r.records.length) return `${r.records.length} record${r.records.length > 1 ? 's' : ''} battu${r.records.length > 1 ? 's' : ''} cette semaine.`;
  if (cur.volume_lbs > r.prev.volume_lbs && r.prev.volume_lbs) return 'Plus de volume que la semaine dernière. Ça monte.';
  return 'Une semaine de plus dans la boîte. La régularité paie.';
}

export function recapText(r, pseudo) {
  const parts = [`${r.cur.workouts} séance${r.cur.workouts > 1 ? 's' : ''}`, `${r.cur.sets} séries`];
  if (r.cur.volume_lbs) parts.push(`${n0(r.cur.volume_lbs)} lbs soulevées`);
  if (r.cur.cardio_km) parts.push(`${n1(r.cur.cardio_km)} km de cardio`);
  if (r.records.length) parts.push(`${r.records.length} record${r.records.length > 1 ? 's' : ''}`);
  return `Bilan de ${pseudo || 'ma'} semaine : ${parts.join(' · ')}.`.slice(0, 200);
}

// Image 1080 × 1350 (format story / post) dessinée sur un canvas
async function drawRecap(r, name) {
  try { await document.fonts?.ready; } catch { /* */ }
  const W = 1080; const H = 1350; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#15152a'); bg.addColorStop(1, '#0b0b15'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = (x, y, rad, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'transparent'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  glow(900, 120, 520, 'rgba(255,122,61,.28)'); glow(120, 1250, 560, 'rgba(46,230,197,.18)');
  const font = (w, s, f = 'Sora') => `${w} ${s}px ${f}, Manrope, -apple-system, sans-serif`;
  g.fillStyle = '#9a98b8'; g.font = font(600, 34, 'Manrope'); g.fillText('GYMTRACK · BILAN DE LA SEMAINE', 80, 120);
  g.fillStyle = '#f1f0fa'; g.font = font(700, 76); g.fillText(name || 'Ma semaine', 80, 215);
  g.fillStyle = '#9a98b8'; g.font = font(500, 38, 'Manrope'); g.fillText(range(r), 80, 275);
  const tiles = [
    [`${r.cur.workouts}${r.target ? `/${r.target}` : ''}`, 'séances', ['#ffb03a', '#ff4d8d']],
    [n0(r.cur.sets), 'séries', ['#a78bfa', '#e14bd0']],
    [n0(r.cur.volume_lbs), 'lbs soulevées', ['#ff7a3d', '#ffb03a']],
    [r.cur.cardio_km ? `${n1(r.cur.cardio_km)} km` : mins(r.cur.cardio_minutes), 'de cardio', ['#2ee6c5', '#3b82f6']],
  ];
  tiles.forEach(([v, l, [a, b]], i) => {
    const x = 80 + (i % 2) * 470; const y = 340 + Math.floor(i / 2) * 250;
    g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.roundRect(x, y, 450, 225, 36); g.fill();
    const tg = g.createLinearGradient(x, y, x + 450, y + 225); tg.addColorStop(0, a); tg.addColorStop(1, b);
    g.fillStyle = tg; g.font = font(700, 92); g.fillText(v, x + 40, y + 125);
    g.fillStyle = '#c9c7e0'; g.font = font(600, 34, 'Manrope'); g.fillText(l, x + 42, y + 185);
  });
  // Jours actifs
  let y = 920; g.fillStyle = '#9a98b8'; g.font = font(600, 30, 'Manrope'); g.fillText('JOURS ACTIFS', 80, y);
  DAYS.forEach((d, i) => {
    const on = r.active_days.includes(addDays(r.from, i)); const x = 80 + i * 134;
    g.fillStyle = on ? '#ff7a3d' : 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect(x, y + 25, 112, 112, 28); g.fill();
    g.fillStyle = on ? '#1a0d06' : '#6d6b8c'; g.font = font(700, 44); g.textAlign = 'center'; g.fillText(d, x + 56, y + 97); g.textAlign = 'left';
  });
  y = 1150;
  g.fillStyle = '#f1f0fa'; g.font = font(600, 40, 'Manrope');
  const line = r.records.length ? `Records : ${r.records.slice(0, 2).map((x) => `${x.name} ${n1(x.weight)} ${x.unit}`).join(' · ')}` : verdict(r);
  wrap(g, line, 80, y, 920, 52, 2);
  g.fillStyle = '#6d6b8c'; g.font = font(500, 28, 'Manrope'); g.fillText(r.streak > 1 ? `Série en cours : ${r.streak} semaines d’affilée` : 'yaogao1221-ai.github.io/Gymtrack', 80, 1290);
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}
function wrap(g, text, x, y, max, lh, lines) {
  const words = text.split(' '); let l = ''; let n = 0;
  for (const w of words) {
    const t = l ? `${l} ${w}` : w;
    if (g.measureText(t).width > max && l) { g.fillText(l, x, y + n * lh); n++; l = w; if (n >= lines) return; } else l = t;
  }
  if (n < lines) g.fillText(l, x, y + n * lh);
}

export default function Recap() {
  const toast = useToast(); const [off, setOff] = useState(0); const [busy, setBusy] = useState(false);
  const { data: r, error, reload } = useApi(`/recap?offset=${off}`, [off]);
  const m = LEAGUE_ON ? getMembership() : null;
  if (error && !r) return <Page title="Bilan"><ErrorBox error={error} retry={reload} /></Page>;
  if (!r) return <Page title="Bilan"><Loading /></Page>;
  const name = m?.pseudo || r.name || '';
  const dW = delta(r.cur.workouts, r.prev.workouts); const dV = delta(r.cur.volume_lbs, r.prev.volume_lbs);
  const share = async () => {
    setBusy(true);
    try {
      const blob = await drawRecap(r, name);
      const file = new File([blob], `gymtrack-bilan-${r.from}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: recapText(r, name) });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Image enregistrée'); }
    } catch (e) { if (e?.name !== 'AbortError') toast(e.message || 'Partage impossible', 'err'); } finally { setBusy(false); }
  };
  const publish = async () => {
    setBusy(true);
    try { await postMessage(null, 'bravo', recapText(r, name)); toast('Bilan publié dans le fil de la ligue'); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const Delta = ({ v }) => (v == null || v === 0 ? null : <span className={`delta small ${v > 0 ? 'up' : 'down'}`}>{v > 0 ? '+' : ''}{v} %</span>);
  return (
    <Page title="Bilan de la semaine" subtitle={range(r)} back="/">
      <Segmented value={off} onChange={setOff} options={[[0, 'Cette semaine'], [1, 'Semaine dernière']]} />
      <div className="recap-card">
        <p className="recap-verdict">{verdict(r)}</p>
        <div className="recap-tiles">
          <div className="t-fire"><b>{r.cur.workouts}{r.target ? <span>/{r.target}</span> : null}</b><span>séances <Delta v={dW} /></span></div>
          <div className="t-violet"><b>{n0(r.cur.sets)}</b><span>séries validées</span></div>
          <div className="t-orange"><b>{n0(r.cur.volume_lbs)}</b><span>lbs soulevées <Delta v={dV} /></span></div>
          <div className="t-aqua"><b>{r.cur.cardio_km ? n1(r.cur.cardio_km) : n0(r.cur.cardio_minutes)}</b><span>{r.cur.cardio_km ? 'km de cardio' : 'min de cardio'}</span></div>
        </div>
        <div className="recap-days">
          {DAYS.map((d, i) => <span key={i} className={r.active_days.includes(addDays(r.from, i)) ? 'on' : ''}>{d}</span>)}
        </div>
        <p className="muted small">{r.cur.training_minutes ? `${mins(r.cur.training_minutes)} de muscu` : ''}{r.cur.avg_rpe ? ` · effort moyen ${n1(r.cur.avg_rpe)}/10` : ''}{r.streak > 1 ? ` · ${r.streak} semaines d’affilée` : ''}</p>
      </div>
      {r.records.length > 0 && (
        <Card title="Records de la semaine" icon="trophy">
          <ul className="plain-list">{r.records.map((x, i) => <li key={i}><span className="grow">{x.name}</span><span className="mono small">{n1(x.previous)} → <b>{n1(x.weight)}</b> {x.unit}{x.assisted ? ' d’assistance' : ''}</span></li>)}</ul>
        </Card>
      )}
      {r.muscles.length > 0 && (
        <Card title="Muscles les plus travaillés" icon="target">
          {r.muscles.map((x) => { const max = r.muscles[0].sets || 1; return <div key={x.muscle} className="bar-row"><span className="small">{x.label}</span><div className="bar"><span style={{ width: `${(x.sets / max) * 100}%` }} /></div><span className="mono small">{n1(x.sets)}</span></div>; })}
          <p className="muted small mt">Séries pondérées par muscle sollicité.</p>
        </Card>
      )}
      <div className="row gap-s wrap">
        <button className="btn primary" disabled={busy} onClick={share}><Icon name="upload" size={16} />Partager en image</button>
        {m && <button className="btn" disabled={busy} onClick={publish}><Icon name="trophy" size={16} />Publier dans la ligue</button>}
      </div>
    </Page>
  );
}
