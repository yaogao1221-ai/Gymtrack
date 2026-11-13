// Bibliothèque, modèles de programmes, progrès, carte du corps, trophées, journal alimentaire
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';

let base; const H = { 'Content-Type': 'application/json', 'X-Local-Date': '2026-11-13' };
const call = async (method, p, body) => {
  const r = await fetch(base + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-ins-'));
  const { app } = createApp({ dbFile: path.join(tmp, 'db.sqlite'), backupDir: path.join(tmp, 'bk') });
  await new Promise((res) => { const s = app.listen(0, () => { base = `http://localhost:${s.address().port}/api`; s.unref(); res(); }); });
});

test('exercices de base reliés aux photos, ajout depuis la bibliothèque sans doublon', async () => {
  const prog = (await call('GET', '/program')).body;
  assert.ok(prog.days[0].exercises.every((e) => e.lib_id), 'chaque exercice du programme a une démo');
  const body = { lib_id: 'Kettlebell_Thruster', name: 'Thruster (kettlebell)', pattern: 'squat', muscles: { quadriceps: 1, epaules_ant: 0.5 }, kind: 'weighted' };
  const a = await call('POST', '/exercises', body); const b = await call('POST', '/exercises', body);
  assert.equal(a.status, 201); assert.equal(b.body.id, a.body.id); assert.equal(a.body.lib_id, 'Kettlebell_Thruster');
});

test('progrès, carte du corps et trophées', async () => {
  const prog = (await call('GET', '/program')).body; const day = prog.days[0]; const ex = day.exercises[0];
  for (const [i, d] of ['2026-10-30', '2026-11-06', '2026-11-12'].entries()) {
    const r = await call('POST', '/workouts', { client_id: `i${i}`, program_day_id: day.id, name: day.name, date: d, duration_sec: 3000,
      sets: [1, 2, 3, 4].map((k) => ({ exercise_id: ex.exercise_id, program_exercise_id: ex.id, position: 0, set_index: k, weight: 100 + i * 10, weight_unit: 'lbs', reps: 8, completed: 1 })) });
    assert.equal(r.status, 201);
  }
  const p = (await call('GET', '/stats/progress?weeks=8')).body;
  assert.equal(p.weeks.length, 8); assert.equal(p.lifts[0].id, ex.exercise_id); assert.ok(p.lifts[0].gain_pct > 15);
  assert.ok(p.heat.days['2026-11-12'] > 0); assert.equal(p.muscles.length, 18);
  const m = (await call('GET', '/bodymap')).body;
  assert.equal(m.muscles.pectoraux.status, 'fatigue'); assert.equal(m.muscles.ischios.status, 'oublie');
  const b = (await call('GET', '/badges')).body;
  assert.ok(b.list.find((x) => x.id === 'first').earned); assert.ok(b.list.find((x) => x.id === 'pr1').earned); assert.equal(b.streak_weeks, 3);
});

test('journal alimentaire : calcul à la quantité et modification', async () => {
  const per100 = { k: 141, p: 30.1, g: 0, l: 2 };
  const a = await call('POST', '/food', { name: 'Poulet, filet grillé', food_code: '36018', grams: 150, meal: 'dejeuner', per100 });
  assert.equal(a.status, 201); assert.equal(a.body.kcal, 211.5); assert.equal(a.body.protein_g, 45.2);
  await call('PATCH', `/food/${a.body.id}`, { grams: 200 });
  let d = (await call('GET', '/food')).body;
  assert.equal(d.totals.kcal, 282); assert.equal(d.recent[0].name, 'Poulet, filet grillé');
  assert.equal((await call('POST', '/food', { name: 'x', grams: 0, per100 })).status, 400);
  await call('DELETE', `/food/${a.body.id}`); d = (await call('GET', '/food')).body; assert.equal(d.logs.length, 0);
});

test('modèle de programme : nouveau programme actif, ancien conservé et réactivable', async () => {
  const list = (await call('GET', '/programs')).body; assert.ok(list.templates.find((t) => t.key === 'upperlower4'));
  const old = list.programs[0].id;
  assert.equal((await call('POST', '/programs/template', { key: 'upperlower4' })).status, 201);
  const prog = (await call('GET', '/program')).body; assert.equal(prog.days.length, 4);
  const prof = (await call('GET', '/profile')).body; assert.equal(Object.values(prof.schedule).filter((c) => c !== 'rest').length, 4);
  await call('POST', `/programs/${old}/activate`); assert.equal((await call('GET', '/program')).body.days.length, 5);
});

test('historique : changer un exercice, ajouter/supprimer une série, retirer un exercice', async () => {
  const prog = (await call('GET', '/program')).body; const [a, b] = prog.days[0].exercises;
  const w = (await call('POST', '/workouts', { client_id: 'edit1', name: 'Test', date: '2026-11-10',
    sets: [1, 2].map((k) => ({ exercise_id: a.exercise_id, position: 0, set_index: k, weight: 50, weight_unit: 'lbs', reps: 10 })) })).body;
  let r = await call('PATCH', `/workouts/${w.id}/exercises`, { position: 0, exercise_id: a.exercise_id, new_exercise_id: b.exercise_id });
  assert.equal(r.body.exercises[0].exercise_id, b.exercise_id); assert.equal(r.body.exercises[0].sets.length, 2);
  r = await call('POST', `/workouts/${w.id}/sets`, { exercise_id: b.exercise_id, position: 0 });
  assert.equal(r.status, 201); const s3 = r.body.exercises[0].sets[2]; assert.equal(s3.set_index, 3); assert.equal(s3.weight, 50);
  r = await call('DELETE', `/workouts/${w.id}/sets/${r.body.exercises[0].sets[0].id}`);
  assert.deepEqual(r.body.exercises[0].sets.map((x) => x.set_index), [1, 2]);
  r = await call('POST', `/workouts/${w.id}/sets`, { exercise_id: a.exercise_id, weight: null, reps: null });
  assert.equal(r.body.exercises.length, 2); assert.equal(r.body.exercises[1].position, 1);
  r = await call('POST', `/workouts/${w.id}/exercises/remove`, { position: 1, exercise_id: a.exercise_id });
  assert.equal(r.body.exercises.length, 1);
});

test('créateur de programme : objectif → muscu + cardio intégrés, objectifs créés', async () => {
  const pv = (await call('POST', '/builder/preview', { objective: 'perte_de_gras', days: 4, level: 'intermediaire' })).body;
  assert.equal(pv.type, 'mixte'); assert.equal(pv.sessions.muscu, 3); assert.equal(pv.sessions.cardio, 1); assert.ok(pv.cardio_week >= 120);
  assert.ok(pv.why.some((w) => /Schoenfeld/.test(w)));
  const c = (await call('POST', '/builder/preview', { objective: 'endurance', days: 3, level: 'avance' })).body;
  assert.equal(c.sessions.muscu, 0); assert.ok(c.days.some((d) => d.name === 'Cardio intervalles'));
  const r = await call('POST', '/builder/apply', { objective: 'perte_de_gras', days: 4, cure: false });
  assert.equal(r.status, 201);
  const prog = (await call('GET', '/program')).body;
  assert.equal(prog.days.length, 4); assert.ok(prog.days.some((d) => !d.exercises.length && d.cardio.length));
  const goals = (await call('GET', '/goals')).body;
  assert.ok(goals.some((g) => g.type === 'cardio_minutes_semaine' && g.status === 'actif' && g.target_value === pv.cardio_week));
  const own = await call('POST', '/builder/apply', { custom: true, days: 3, name: 'Perso' });
  assert.equal(own.status, 201); assert.equal((await call('GET', '/program')).body.days.length, 3);
});
