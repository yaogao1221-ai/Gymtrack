// Espace Coach : décision du jour (GET /coach/today, dans insights.js), boîte « À valider », bilan, 10 questions
import { Router } from 'express';
import { coachHub, ask, QUESTIONS, recoveryView, stagnationReport, programReview, weeklyReview, inbox } from '../coach/engine.js';
import { notFound } from '../util.js';

export default function coachRoutes(db) {
  const r = Router();
  r.get('/coach/hub', (req, res) => res.json(coachHub(db, req.today)));
  r.get('/coach/questions', (req, res) => res.json(QUESTIONS));
  r.get('/coach/ask/:id', (req, res) => { const a = ask(db, req.today, req.params.id, req.query); if (!a) throw notFound('Question inconnue'); res.json(a); });
  r.get('/coach/inbox', (req, res) => res.json(inbox(db, req.today)));
  r.get('/coach/recovery', (req, res) => res.json(recoveryView(db, req.today)));
  r.get('/coach/stagnation', (req, res) => res.json(stagnationReport(db, req.today)));
  r.get('/coach/program-review', (req, res) => res.json(programReview(db, req.today)));
  r.get('/coach/week', (req, res) => res.json(weeklyReview(db, req.today)));
  return r;
}
