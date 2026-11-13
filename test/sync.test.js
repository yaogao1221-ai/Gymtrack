// Cohérence entre modules : poids, objectifs, planning ↔ calendrier, séances déplacées, records, formules
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';
import { e1rm, smoothedWeight, goalProgress, goalReached, toLbs } from '../server/formulas.js';

let base; const H = { 'Content-Type': 'application/json', 'X-Local-Date': '2026-11-09' };
const call = async (method, p, body) => {
  const r = await fetch(base + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-sync-'));
  const { app } = createApp({ dbFile: path.join(tmp, 'db.sqlite'), backupDir: path.join(tmp, 'bk') });
  await new Promise((res) => { const s = app.listen(0, () => { base = `http://localhost:${s.address().port}/api`; s.unref(); res(); }); });
});

test('formules : 1RM, poids lissé, progression d’objectif', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 0), null);
  assert.equal(e1rm(null, 5), null);
  assert.ok(Math.abs(e1rm(100, 5) - (100 * (1 + 5 / 30) + 100 * 36 / 32) / 2) < 1e-9);
  assert.ok(Math.abs(e1rm(100, 15) - 150) < 1e-9); // Epley seul au-delà de 10 reps
  assert.equal(smoothedWeight([]), null);
  const sw = smoothedWeight([{ date: '2026-10-01', weight_kg: 90 }, { date: '2026-11-03', weight_kg: 81 }, { date: '2026-11-09', weight_kg: 80 }]);
  assert.deepEqual([sw.value, sw.n, sw.last], [80.5, 2, 80]);
  assert.equal(goalProgress(80, 78, 75), 0.4); // perte de poids : 2 kg sur 5
  assert.equal(goalProgress(80, 82, 75), 0); // dans le mauvais sens : 0, jamais négatif
  assert.equal(goalProgress(null, 78, 75), null);
  assert.equal(goalReached(80, 74.8, 75), true);
  assert.equal(goalReached(80, 76, 75), false);
  assert.ok(Math.abs(toLbs(100, 'kg') - 220.462) < 1e-9);
});

test('poids : une seule source (pesées), le profil suit, l’objectif de poids se calcule dans le bon sens', async () => {
  await call('PUT', '/profile', { body_weight_kg: 84 }); // première saisie → devient une pesée
  let m = (await call('GET', '/body-metrics')).body;
  assert.equal(m.length, 1); assert.equal(m[0].weight_kg, 84);
  const g = await call('POST', '/goals', { type: 'poids_corporel', title: 'Descendre à 80', target_value: 80, unit: 'kg' });
  assert.equal(g.status, 201);
  assert.equal(g.body.start_used, 84); assert.equal(g.body.lower_is_better, true); assert.equal(g.body.progress, 0);
  await call('POST', '/body-metrics', { date: '2026-11-09', weight_kg: 82 });
  const p = (await call('GET', '/profile')).body; assert.equal(p.body_weight_kg, 82, 'le profil affiche la dernière pesée');
  const goals = (await call('GET', '/goals')).body; const wg = goals.find((x) => x.type === 'poids_corporel');
  assert.equal(wg.current_value, 83); // moyenne 7 jours : (84 + 82) / 2
  assert.equal(wg.progress, 0.25); assert.equal(wg.reached, false);
  const d = (await call('GET', '/dashboard')).body;
  assert.equal(d.body.weight, 83); assert.equal(d.body.last, 82); assert.equal(d.body.points.length, 2);
  // Supprimer la dernière pesée recalcule tout
  m = (await call('GET', '/body-metrics')).body;
  await call('DELETE', `/body-metrics/${m.find((x) => x.weight_kg === 82).id}`);
  assert.equal((await call('GET', '/profile')).body.body_weight_kg, 84);
  assert.equal((await call('GET', '/goals')).body.find((x) => x.type === 'poids_corporel').current_value, 84);
  // Le même poids renvoyé par le formulaire du profil ne crée pas de doublon
  await call('PUT', '/profile', { body_weight_kg: 84 });
  assert.equal((await call('GET', '/body-metrics')).body.length, 1);
});

test('planning type modifié → calendrier à venir replanifié, séances faites conservées', async () => {
  const prog = (await call('GET', '/program')).body;
  await call('PUT', '/profile', { schedule: { mon: 'D1', tue: 'rest', wed: 'D2', thu: 'rest', fri: 'D3', sat: 'rest', sun: 'rest' } });
  await call('POST', '/calendar/plan', { from: '2026-11-09', weeks: 2 });
  let cal = (await call('GET', '/calendar?from=2026-11-09&to=2026-11-22')).body.events;
  assert.equal(cal.find((e) => e.date === '2026-11-10').type, 'rest');
  // Séance du lundi faite
  const day = prog.days[0]; const ex = day.exercises[0];
  const w = await call('POST', '/workouts', { program_day_id: day.id, name: day.name, date: '2026-11-09', sets: [{ exercise_id: ex.exercise_id, set_index: 1, weight: 100, reps: 8 }] });
  assert.equal(w.status, 201);
  await call('PUT', '/profile', { schedule: { mon: 'D1', tue: 'D2', wed: 'rest', thu: 'D3', fri: 'rest', sat: 'rest', sun: 'rest' } });
  cal = (await call('GET', '/calendar?from=2026-11-09&to=2026-11-22')).body.events;
  const on = (d) => cal.filter((e) => e.date === d && e.type !== 'cardio');
  assert.equal(on('2026-11-09').length, 1); assert.equal(on('2026-11-09')[0].status, 'done');
  assert.equal(on('2026-11-10')[0].code, 'D2'); assert.equal(on('2026-11-11')[0].type, 'rest');
  assert.equal(on('2026-11-19')[0].code, 'D3');
  // Séance déplacée au mardi : lundi redevient prévu, mardi est fait
  await call('PATCH', `/workouts/${w.body.id}`, { date: '2026-11-10' });
  cal = (await call('GET', '/calendar?from=2026-11-09&to=2026-11-10')).body.events;
  assert.equal(cal.find((e) => e.date === '2026-11-09').status, 'planned');
  assert.equal(cal.find((e) => e.date === '2026-11-10').status, 'done');
  // Supprimer la séance remet le jour en « prévu » et retire les stats
  await call('DELETE', `/workouts/${w.body.id}`);
  cal = (await call('GET', '/calendar?from=2026-11-10&to=2026-11-10')).body.events;
  assert.equal(cal[0].status, 'planned');
  assert.equal((await call('GET', '/dashboard')).body.week.workouts, 0);
});

test('records : un changement d’unité ne crée pas de faux record, objectif de charge converti', async () => {
  const prog = (await call('GET', '/program')).body; const day = prog.days[0];
  const ex = day.exercises.find((e) => e.kind === 'weighted');
  const post = (date, weight, unit) => call('POST', '/workouts', { program_day_id: day.id, name: day.name, date, sets: [{ exercise_id: ex.exercise_id, set_index: 1, weight, weight_unit: unit, reps: 5 }] });
  await post('2026-11-02', 100, 'kg'); await post('2026-11-04', 150, 'lbs'); await post('2026-11-06', 230, 'lbs');
  const recs = (await call('GET', '/stats/overview')).body.records.filter((r) => r.exercise_id === ex.exercise_id);
  assert.equal(recs.length, 1, '150 lbs < 100 kg : pas de record'); assert.equal(recs[0].weight, 230);
  const g = await call('POST', '/goals', { type: 'charge', title: 'test', exercise_id: ex.exercise_id, target_value: 110, unit: 'kg', start_value: 100 });
  assert.equal(g.body.current_value, 104.3); // 230 lbs en kg
  const s = (await call('GET', `/stats/exercise/${ex.exercise_id}`)).body;
  assert.ok(s.points.every((p) => p.e1rm == null || p.e1rm > p.top_weight));
});
