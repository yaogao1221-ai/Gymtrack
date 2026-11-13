import { Router } from 'express';
import { USER_ID, goalsWithProgress } from '../services.js';
import { nutritionState, targets, PLAN_TYPES } from '../nutrition.js';
import { strategy, applyStrategy, MODES } from '../strategy.js';
import { replanFuture } from '../planning.js';
import { buildPlan, applyPlan, OBJECTIVES, TYPES } from '../builder.js';
import { num, oneOf, date, bad, notFound, addDays } from '../util.js';
import { r1 } from '../formulas.js';

export default function nutritionRoutes(db) {
  const r = Router();
  // Fin de cure : son objectif est validé s'il est atteint, archivé sinon (il reste dans l'historique des objectifs)
  const closePlan = (id, status, today) => {
    db.run('UPDATE nutrition_plans SET status = ?, ended_at = ? WHERE id = ?', status, today, id);
    for (const g of goalsWithProgress(db, today).filter((x) => x.nutrition_plan_id === id && x.status === 'actif')) db.run('UPDATE goals SET status = ? WHERE id = ?', g.reached ? 'atteint' : 'abandonne', g.id);
  };
  r.get('/nutrition', (req, res) => res.json(nutritionState(db, req.today)));

  r.put('/nutrition/activity', (req, res) => {
    const pal = num(req.body.activity_pal, 'activité', { min: 1.1, max: 2 });
    db.run('UPDATE profiles SET activity_pal = ? WHERE user_id = ?', pal, USER_ID);
    res.json(nutritionState(db, req.today));
  });

  // Démarrer une cure : fige le poids, le métabolisme et les cibles de départ
  const startPlan = (b, today) => {
    const type = oneOf(b.type, 'type de cure', Object.keys(PLAN_TYPES), { required: true });
    const T = PLAN_TYPES[type];
    const weeks = num(b.weeks, 'durée', { min: 4, max: 52, int: true }) ?? T.weeks[2];
    const rate = num(b.rate_pct, 'vitesse', { min: 0, max: 1.5 });
    const st = nutritionState(db, today);
    if (!st.weight_kg || !st.tdee) throw bad(`Complète d’abord : ${st.missing.join(', ') || 'ton poids'}`);
    const t = targets(type, { kg: st.weight_kg, tdee: st.tdee, bf: st.body_fat?.value, level: st.profile.level, rate });
    const start = date(b.start_date || today);
    db.tx(() => {
      for (const old of db.all("SELECT id FROM nutrition_plans WHERE user_id = ? AND status = 'active'", USER_ID)) closePlan(old.id, 'stopped', today);
      const pid = Number(db.run(`INSERT INTO nutrition_plans (user_id, type, start_date, weeks, rate_pct, start_weight_kg, start_tdee, kcal_base, kcal_adjust, status)
        VALUES (?,?,?,?,?,?,?,?,0,'active')`, USER_ID, type, start, weeks, t.rate_pct, st.weight_kg, st.tdee, t.kcal).lastInsertRowid);
      // La cure crée son objectif : poids visé en fin de cure (sèche, masse) ou tour de taille (recomposition : le poids bouge peu)
      const end = addDays(start, weeks * 7 - 1);
      if (type !== 'recompo') {
        const target = r1(st.weight_kg * (1 + T.rate.sign * t.rate_pct / 100 * weeks));
        db.run("INSERT INTO goals (user_id, type, title, start_value, target_value, unit, deadline, status, nutrition_plan_id) VALUES (?, 'poids_corporel', ?, ?, ?, 'kg', ?, 'actif', ?)",
          USER_ID, `${T.label} : ${String(target).replace('.', ',')} kg`, st.weight_kg, target, end, pid);
      } else {
        const waist = db.one('SELECT waist_cm v FROM body_metrics WHERE user_id = ? AND waist_cm IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1', USER_ID)?.v;
        if (waist) db.run("INSERT INTO goals (user_id, type, title, start_value, target_value, unit, deadline, status, nutrition_plan_id) VALUES (?, 'tour_de_taille', ?, ?, ?, 'cm', ?, 'actif', ?)",
          USER_ID, `${T.label} : tour de taille ${String(r1(waist - Math.max(2, weeks / 4))).replace('.', ',')} cm`, waist, r1(waist - Math.max(2, weeks / 4)), end, pid);
      }
    });
  };
  r.post('/nutrition/plan', (req, res) => { startPlan(req.body, req.today); res.status(201).json(nutritionState(db, req.today)); });

  // Plan selon l'objectif : propositions calculées, puis application des seuls éléments cochés
  const readTarget = (b) => ({
    mode: b.mode === 'auto' || b.mode == null || b.mode === '' ? null : oneOf(b.mode, 'mode', Object.keys(MODES)),
    target_kg: num(b.target_kg, 'poids visé', { min: 35, max: 250 }), target_bf: num(b.target_bf, '% de gras visé', { min: 5, max: 45 }),
    weeks: num(b.weeks, 'durée', { min: 4, max: 52, int: true }),
  });
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
  r.get('/strategy', (req, res) => res.json(strategy(db, req.today, clean(readTarget(req.query)))));
  r.put('/strategy/target', (req, res) => {
    const t = clean(readTarget(req.body || {}));
    db.run('UPDATE profiles SET body_target = ? WHERE user_id = ?', Object.keys(t).length ? JSON.stringify(t) : null, USER_ID);
    res.json(strategy(db, req.today));
  });
  r.post('/strategy/apply', (req, res) => {
    const keys = Array.isArray(req.body.keys) ? req.body.keys.map(String) : [];
    if (!keys.length) throw bad('Coche au moins un élément à appliquer');
    const s = strategy(db, req.today);
    if (!s.ready) throw bad(`Complète d’abord : ${s.missing.join(', ') || 'ton poids'}`);
    const applied = applyStrategy(db, req.today, s, keys, {
      startPlan: (b) => startPlan(b, req.today),
      setSchedule: (schedule, n) => { db.run('UPDATE profiles SET schedule = ?, sessions_per_week = ? WHERE user_id = ?', JSON.stringify(schedule), n, USER_ID); replanFuture(db, req.today); },
    });
    res.json({ applied, strategy: strategy(db, req.today) });
  });

  // Créateur de programme : aperçu (rien n'est enregistré) puis création
  r.get('/builder/options', (req, res) => res.json({ objectives: Object.entries(OBJECTIVES).map(([k, o]) => ({ key: k, label: o.label, type: o.type })), types: TYPES }));
  r.post('/builder/preview', (req, res) => res.json(buildPlan(db, req.today, req.body || {})));
  r.post('/builder/apply', (req, res) => res.status(201).json(applyPlan(db, req.today, req.body || {}, { startPlan: (b) => startPlan(b, req.today) })));

  // Ajustement validé par l'utilisateur (proposé par le contrôle de la semaine)
  r.post('/nutrition/plan/:id/adjust', (req, res) => {
    const d = num(req.body.delta, 'ajustement', { min: -500, max: 500, int: true });
    if (!db.run("UPDATE nutrition_plans SET kcal_adjust = kcal_adjust + ?, last_adjust = ? WHERE id = ? AND user_id = ? AND status = 'active'", d || 0, req.today, req.params.id, USER_ID).changes) throw notFound('Cure introuvable');
    res.json(nutritionState(db, req.today));
  });

  r.post('/nutrition/plan/:id/stop', (req, res) => {
    const status = oneOf(req.body.status || 'stopped', 'statut', ['stopped', 'done']);
    if (!db.one('SELECT id FROM nutrition_plans WHERE id = ? AND user_id = ?', req.params.id, USER_ID)) throw notFound('Cure introuvable');
    db.tx(() => closePlan(Number(req.params.id), status, req.today));
    res.json(nutritionState(db, req.today));
  });
  return r;
}
