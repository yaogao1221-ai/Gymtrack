// Plan selon l'objectif : choix du mode, vitesse sûre, fréquence, application validée élément par élément
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';
import { spreadSchedule } from '../server/strategy.js';

let base; const H = { 'Content-Type': 'application/json', 'X-Local-Date': '2026-11-09' };
const call = async (method, p, body) => {
  const r = await fetch(base + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-strat-'));
  const { app } = createApp({ dbFile: path.join(tmp, 'db.sqlite'), backupDir: path.join(tmp, 'bk') });
  await new Promise((res) => { const s = app.listen(0, () => { base = `http://localhost:${s.address().port}/api`; s.unref(); res(); }); });
});

test('répartition des séances dans la semaine', () => {
  const s = spreadSchedule(3, ['D1', 'D2', 'D3', 'D4'], null);
  assert.deepEqual(s, { mon: 'D1', tue: 'rest', wed: 'D2', thu: 'rest', fri: 'D3', sat: 'rest', sun: 'rest' });
  const t = spreadSchedule(3, ['D1', 'D2'], ['tue', 'thu', 'sat', 'sun']);
  assert.equal(Object.values(t).filter((v) => v !== 'rest').length, 3);
  assert.equal(t.mon, 'rest');
});

test('plan selon l’objectif : sèche, vitesse plafonnée, application validée', async () => {
  let r = await call('GET', '/strategy');
  assert.equal(r.status, 200); assert.equal(r.body.ready, false); // pas de poids ni de taille
  await call('PUT', '/profile', { sex: 'homme', height_cm: 178, birth_year: 1995, level: 'intermediaire' });
  for (const [d, w] of [['2026-11-03', 86.2], ['2026-11-05', 85.8], ['2026-11-08', 86]]) await call('POST', '/body-metrics', { date: d, weight_kg: w });
  await call('POST', '/body-metrics', { date: '2026-11-08', waist_cm: 94, neck_cm: 38 });

  // Objectif 80 kg en 4 semaines : trop rapide, la durée est allongée
  r = await call('GET', '/strategy?target_kg=80&weeks=4');
  assert.equal(r.body.mode, 'seche');
  assert.ok(r.body.warnings.some((w) => /trop|muscle/.test(w)));
  assert.ok(r.body.rate_pct <= 1);
  assert.ok(r.body.weeks > 4 && r.body.weeks <= 16);
  assert.ok(r.body.nutrition.kcal < r.body.nutrition.tdee);
  assert.ok(r.body.nutrition.protein_g >= 86 * 2);
  assert.ok(r.body.frequency.sessions >= 3 && r.body.frequency.sessions <= 4);
  assert.equal(r.body.cardio.min, 180);

  // Mémorisé, puis appliqué élément par élément
  r = await call('PUT', '/strategy/target', { target_kg: 80 });
  assert.equal(r.body.input.target_kg, 80);
  assert.equal((await call('POST', '/strategy/apply', { keys: [] })).status, 400);
  const keys = r.body.actions.map((a) => a.key);
  assert.ok(keys.includes('cure') && keys.includes('cardio'));
  r = await call('POST', '/strategy/apply', { keys: ['cure', 'cardio', 'frequence'] });
  assert.equal(r.status, 200);
  assert.ok(r.body.applied.includes('cure'));
  const n = (await call('GET', '/nutrition')).body;
  assert.equal(n.plan.type, 'seche');
  const goals = (await call('GET', '/goals')).body.filter((g) => g.status === 'actif');
  assert.ok(goals.some((g) => g.type === 'cardio_minutes_semaine' && g.target_value === 180));
  assert.ok(goals.some((g) => g.type === 'poids_corporel' && g.nutrition_plan_id === n.plan.id));
  // La cure est en place : plus proposée de nouveau
  assert.ok(!r.body.strategy.actions.some((a) => a.key === 'cure'));
  // L'accueil suit l'objectif cardio
  const d = (await call('GET', '/dashboard')).body;
  assert.equal(d.week.cardio_target, 180);
  // Ma journée : cibles de la cure, pesée du jour non faite (date du test sans pesée), séance du jour issue de la semaine type
  assert.equal(d.day.kcal, n.plan.kcal); assert.equal(d.day.steps, 10000); assert.equal(d.day.weighed, false);
  assert.ok(Array.isArray(d.pending));
  if (r.body.applied.includes('frequence')) {
    const p = (await call('GET', '/profile')).body;
    assert.equal(Object.values(p.schedule).filter((v) => v !== 'rest').length, r.body.strategy.frequency.sessions);
  }

  // Objectif plus lourd avec % de gras élevé : recomposition proposée avant la masse
  r = await call('GET', '/strategy?target_kg=90');
  assert.ok(['masse', 'recompo'].includes(r.body.mode));
  r = await call('GET', '/strategy?mode=maintien');
  assert.equal(r.body.mode, 'maintien'); assert.equal(r.body.nutrition.delta, 0);
  assert.equal((await call('GET', '/strategy?mode=nimporte')).status, 400);
});
