import { Router } from 'express';
import { USER_ID } from '../services.js';
import { nutritionState, targets, PLAN_TYPES } from '../nutrition.js';
import { num, oneOf, date, bad, notFound } from '../util.js';

export default function nutritionRoutes(db) {
  const r = Router();
  r.get('/nutrition', (req, res) => res.json(nutritionState(db, req.today)));

  r.put('/nutrition/activity', (req, res) => {
    const pal = num(req.body.activity_pal, 'activité', { min: 1.1, max: 2 });
    db.run('UPDATE profiles SET activity_pal = ? WHERE user_id = ?', pal, USER_ID);
    res.json(nutritionState(db, req.today));
  });

  // Démarrer une cure : fige le poids, le métabolisme et les cibles de départ
  r.post('/nutrition/plan', (req, res) => {
    const b = req.body;
    const type = oneOf(b.type, 'type de cure', Object.keys(PLAN_TYPES), { required: true });
    const T = PLAN_TYPES[type];
    const weeks = num(b.weeks, 'durée', { min: 4, max: 52, int: true }) ?? T.weeks[2];
    const rate = num(b.rate_pct, 'vitesse', { min: 0, max: 1.5 });
    const st = nutritionState(db, req.today);
    if (!st.weight_kg || !st.tdee) throw bad(`Complète d’abord : ${st.missing.join(', ') || 'ton poids'}`);
    const t = targets(type, { kg: st.weight_kg, tdee: st.tdee, bf: st.body_fat?.value, level: st.profile.level, rate });
    db.run("UPDATE nutrition_plans SET status = 'stopped' WHERE user_id = ? AND status = 'active'", USER_ID);
    db.run(`INSERT INTO nutrition_plans (user_id, type, start_date, weeks, rate_pct, start_weight_kg, start_tdee, kcal_base, kcal_adjust, status)
      VALUES (?,?,?,?,?,?,?,?,0,'active')`, USER_ID, type, date(b.start_date || req.today), weeks, t.rate_pct, st.weight_kg, st.tdee, t.kcal);
    res.status(201).json(nutritionState(db, req.today));
  });

  // Ajustement validé par l'utilisateur (proposé par le contrôle de la semaine)
  r.post('/nutrition/plan/:id/adjust', (req, res) => {
    const d = num(req.body.delta, 'ajustement', { min: -500, max: 500, int: true });
    if (!db.run("UPDATE nutrition_plans SET kcal_adjust = kcal_adjust + ?, last_adjust = ? WHERE id = ? AND user_id = ? AND status = 'active'", d || 0, req.today, req.params.id, USER_ID).changes) throw notFound('Cure introuvable');
    res.json(nutritionState(db, req.today));
  });

  r.post('/nutrition/plan/:id/stop', (req, res) => {
    const status = oneOf(req.body.status || 'stopped', 'statut', ['stopped', 'done']);
    if (!db.run('UPDATE nutrition_plans SET status = ?, ended_at = ? WHERE id = ? AND user_id = ?', status, req.today, req.params.id, USER_ID).changes) throw notFound('Cure introuvable');
    res.json(nutritionState(db, req.today));
  });
  return r;
}
