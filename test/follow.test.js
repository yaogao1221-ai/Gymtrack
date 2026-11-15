import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';

let base;
const call = async (method, p, body, day) => {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', 'X-Local-Date': day }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-follow-'));
before(async () => {
  const { app } = createApp({ dbFile: path.join(tmp, 'db.sqlite'), backupDir: path.join(tmp, 'bk') });
  await new Promise((res) => { const s = app.listen(0, () => { base = `http://localhost:${s.address().port}/api`; s.unref(); res(); }); });
});
const seq = async (day) => (await call('GET', '/calendar?from=2026-11-16&to=2026-11-23', null, day)).body.events
  .filter((e) => e.type !== 'cardio').map((e) => `${e.date.slice(8)}:${e.type === 'rest' ? (e.title === 'Séance non faite' ? 'X' : 'R') : `${e.code}${e.status === 'done' ? '✓' : ''}`}`);

test('séance non confirmée = repos, le programme se décale ; confirmée plus tard, la suite repart après elle', async () => {
  const { body: prog } = await call('GET', '/program', null, '2026-11-16');
  const [d1] = prog.days;
  // Planning type : lun D1, mar D2, mer D3, jeu repos, ven D4, sam D5, dim repos
  assert.equal((await call('POST', '/calendar/reflow', { from: '2026-11-16', program_day_id: d1.id, weeks: 2 }, '2026-11-16')).status, 200);
  assert.deepEqual(await seq('2026-11-16'), ['16:D1', '17:D2', '18:D3', '19:R', '20:D4', '21:D5', '22:R', '23:D1']);
  // Mercredi : lundi et mardi jamais confirmés → repos, D1 passe à aujourd'hui et tout suit
  assert.deepEqual(await seq('2026-11-18'), ['16:X', '17:X', '18:D1', '19:R', '20:D2', '21:D3', '22:R', '23:D4']);
  // Finalement, D1 avait été fait lundi : on le confirme à sa vraie date
  const sets = d1.exercises.slice(0, 1).map((e) => ({ exercise_id: e.exercise_id, program_exercise_id: e.id, position: 0, set_index: 1, weight: e.target_weight, weight_unit: e.weight_unit, reps: e.reps }));
  assert.equal((await call('POST', '/workouts', { client_id: 'f-1', program_day_id: d1.id, name: d1.name, date: '2026-11-16', sets }, '2026-11-18')).status, 201);
  assert.deepEqual(await seq('2026-11-18'), ['16:D1✓', '17:X', '18:D2', '19:R', '20:D3', '21:D4', '22:R', '23:D5']);
  // Rien de neuf : l'ordre reste stable
  assert.deepEqual(await seq('2026-11-18'), ['16:D1✓', '17:X', '18:D2', '19:R', '20:D3', '21:D4', '22:R', '23:D5']);
});

test('compléments : cocher, série de jours, liste modifiable ; Ramadan : horaires, repas, séance allégée', async () => {
  let r = await call('GET', '/supplements', null, '2026-11-16');
  assert.deepEqual(r.body.items.map((x) => x.key), ['creatine', 'proteines', 'eau']);
  for (const d of ['2026-11-14', '2026-11-15', '2026-11-16']) await call('POST', '/supplements/toggle', { key: 'creatine', on: true, date: d }, '2026-11-16');
  r = await call('GET', '/supplements', null, '2026-11-16');
  const c = r.body.items.find((x) => x.key === 'creatine'); assert.equal(c.done, true); assert.equal(c.streak, 3);
  assert.equal((await call('POST', '/supplements/toggle', { key: 'inconnu', on: true }, '2026-11-16')).status, 404);
  r = await call('PUT', '/supplements', { items: [{ key: 'creatine', label: 'Créatine', dose: '5 g' }, { label: 'Vitamine D' }] }, '2026-11-16');
  assert.deepEqual(r.body.items.map((x) => x.key), ['creatine', 'vitamine_d']); assert.equal(r.body.items[0].streak, 3);
  // Ramadan : position d'Alger, séance avant le ftour
  r = await call('PUT', '/ramadan', { on: true, start: '2027-02-08', end: '2027-03-09', when: 'avant_ftour', lat: 36.75, lon: 3.06 }, '2027-02-10');
  assert.equal(r.body.active, true); assert.equal(r.body.day, 3); assert.equal(r.body.days, 30);
  assert.match(r.body.ftour, /^\d{2}:\d{2}$/); assert.match(r.body.shour, /^\d{2}:\d{2}$/);
  assert.deepEqual(r.body.lighten, { hold_loads: true, minus_set: true, extra_rest: 30 });
  assert.equal(r.body.meals.length, 3);
  r = await call('GET', '/ramadan', null, '2027-03-20'); assert.equal(r.body.active, false); assert.equal(r.body.lighten, null);
});

test('morpho-anatomie : leviers, conflits articulaires, ordre, articulation deux jours de suite', async () => {
  const { rateExercise, programConflicts } = await import('../server/morpho.js');
  const squat = { name: 'Squat barre', pattern: 'squat', equipment: 'Barre' };
  assert.equal(rateExercise(squat, { femurs: 'longs' }).verdict, 'attention');
  assert.equal(rateExercise(squat, { femurs: 'courts' }).verdict, 'bon');
  assert.equal(rateExercise({ name: 'Rowing menton', pattern: 'lib' }, {}).verdict, 'conflit');
  assert.equal(rateExercise({ n: 'Développé militaire', pt: 'press_vertical', q: 'Haltères' }, {}, [{ area: 'epaule' }]).verdict, 'conflit');
  const days = [
    { id: 1, name: 'J1', exercises: [{ id: 11, name: 'Extension triceps', pattern: 'triceps_extension', muscles: { triceps: 1 }, sets: 3 }, { id: 12, name: 'Développé couché', pattern: 'press_horizontal', muscles: { pectoraux: 1 }, sets: 4 }, { id: 13, name: 'Développé militaire', pattern: 'press_vertical', muscles: { epaules_ant: 1 }, sets: 4 }, { id: 14, name: 'Écartés', pattern: 'chest_fly', muscles: { pectoraux: 1 }, sets: 3 }] },
    { id: 2, name: 'J2', exercises: [{ id: 21, name: 'Élévations latérales', pattern: 'lateral_raise', muscles: { epaules_lat: 1 }, sets: 5 }, { id: 22, name: 'Dips', pattern: 'dip', muscles: { pectoraux: 1 }, sets: 4 }] },
  ];
  const c = programConflicts(days, { bras: 'longs' }, []);
  assert.ok(c.some((x) => x.type === 'ordre' && x.pe_id === 11 && x.move_after === 12));
  assert.ok(c.some((x) => x.type === 'articulation' && x.day === 'J2'));
  assert.ok(c.some((x) => x.type === 'morpho' && x.pe_id === 22));
  // Route : profil enregistré, valeurs contrôlées
  let r = await call('PUT', '/morpho', { femurs: 'longs', bras: 'moyens' }, '2026-11-16');
  assert.equal(r.status, 200); assert.equal(r.body.morpho.femurs, 'longs'); assert.ok(Array.isArray(r.body.conflicts));
  assert.equal((await call('PUT', '/morpho', { femurs: 'enorme' }, '2026-11-16')).status, 400);
});
