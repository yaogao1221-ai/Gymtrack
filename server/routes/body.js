// Volet Corps : état muscle fin par muscle fin, fiche d'un muscle, réglages du calcul de récupération
import { Router } from 'express';
import { bodyState, muscleHistory, bodySettings, saveBodySettings, SPEEDS, LEVELS } from '../body/state.js';
import { MUSCLE_LIST, REGIONS } from '../body/muscles.js';
import { notFound } from '../util.js';
import { bodyReport, measuresTrend, nutritionTrend } from '../body/report.js';

export default function bodyRoutes(db) {
  const r = Router();
  const hour = (req) => { const h = Number(req.query.h); return Number.isFinite(h) && h >= 0 && h < 24 ? h : 12; };
  r.get('/body/state', (req, res) => res.json(bodyState(db, req.today, { hour: hour(req) })));
  r.get('/body/muscles', (req, res) => res.json({ regions: REGIONS, muscles: MUSCLE_LIST }));
  r.get('/body/muscle/:id', (req, res) => {
    const w = Number(req.query.weeks) === 26 ? 26 : 12;
    const m = muscleHistory(db, req.today, req.params.id, w); if (!m) throw notFound('Muscle inconnu'); res.json(m);
  });
  r.get('/body/settings', (req, res) => res.json({ settings: bodySettings(db), speeds: SPEEDS, levels: LEVELS }));
  r.put('/body/settings', (req, res) => res.json({ settings: saveBodySettings(db, req.body || {}) }));
  r.get('/body/report', (req, res) => res.json(bodyReport(db, req.today, req.query.period === 'month' ? 'month' : 'week', Math.min(24, Math.max(0, Number(req.query.offset) || 0)))));
  r.get('/body/measures', (req, res) => res.json(measuresTrend(db)));
  r.get('/body/nutrition', (req, res) => res.json(nutritionTrend(db, req.today)));
  return r;
}
