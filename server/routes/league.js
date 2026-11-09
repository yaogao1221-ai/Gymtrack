import { Router } from 'express';
import { periodStats, allRecords } from '../services.js';
import { addDays, weekStart } from '../util.js';

// Barème de la ligue : identique pour tout le monde, calculé sur chaque téléphone
export const POINTS = { workout: 10, km: 5, record: 15, steps1000: 1 };

const monthStart = (d) => d.slice(0, 8) + '01';
const monthEnd = (d) => { const [y, m] = d.split('-').map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return `${d.slice(0, 8)}${String(last).padStart(2, '0')}`; };
const prevMonth = (d) => { const [y, m] = d.split('-').map(Number); return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`; };
const isoWeekKey = (monday) => {
  const d = new Date(monday + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 3); // jeudi de la semaine
  const y = d.getUTCFullYear(); const w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `W${y}-${String(w).padStart(2, '0')}`;
};

export function leaguePeriods(today) {
  const ws = weekStart(today); const pws = addDays(ws, -7); const ms = monthStart(today); const pms = prevMonth(today);
  return [
    { key: isoWeekKey(ws), kind: 'week', from: ws, to: addDays(ws, 6), current: true },
    { key: isoWeekKey(pws), kind: 'week', from: pws, to: addDays(pws, 6), current: false },
    { key: 'M' + ms.slice(0, 7), kind: 'month', from: ms, to: monthEnd(ms), current: true },
    { key: 'M' + pms.slice(0, 7), kind: 'month', from: pms, to: monthEnd(pms), current: false },
  ];
}

export default function leagueRoutes(db) {
  const r = Router();
  // Bilan à partager avec la ligue : uniquement des totaux, jamais le détail des séances
  r.get('/league/summary', (req, res) => {
    const records = allRecords(db);
    const periods = leaguePeriods(req.today).map((p) => {
      const s = periodStats(db, p.from, p.to);
      const prs = records.filter((x) => x.date >= p.from && x.date <= p.to).length;
      const stats = { km: s.cardio_km, cardio_min: s.cardio_minutes, cardio_n: s.cardio_sessions, workouts: s.workouts, sets: s.sets, prs };
      return { ...p, stats };
    });
    // Badges personnels (cumul depuis le début)
    const all = periodStats(db, '0000-01-01', req.today);
    let streak = 0; // semaines d'affilée avec au moins une séance (muscu ou cardio)
    for (let ws = weekStart(req.today), i = 0; i < 104; i++, ws = addDays(ws, -7)) {
      const s = periodStats(db, ws, addDays(ws, 6));
      if (s.workouts + s.cardio_sessions > 0) streak++; else if (i > 0) break;
    }
    const badges = [
      { id: 'first', label: 'Première séance', got: all.workouts >= 1 },
      { id: 'w10', label: '10 séances muscu', got: all.workouts >= 10 },
      { id: 'w50', label: '50 séances muscu', got: all.workouts >= 50 },
      { id: 'km42', label: 'Marathon cumulé (42 km)', got: all.cardio_km >= 42.2 },
      { id: 'km100', label: '100 km de cardio', got: all.cardio_km >= 100 },
      { id: 'pr5', label: '5 records battus', got: records.length >= 5 },
      { id: 'pr20', label: '20 records battus', got: records.length >= 20 },
      { id: 'streak4', label: '4 semaines d’affilée', got: streak >= 4 },
      { id: 'streak12', label: '12 semaines d’affilée', got: streak >= 12 },
    ];
    res.json({ periods, streak, badges, points: POINTS });
  });
  return r;
}
