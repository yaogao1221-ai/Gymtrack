// Import d'un programme par lien : nouveau programme actif, ancien gardé, charges reprises, pas de doublon d'exercice
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';

let base;
const call = async (method, p, body) => {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', 'X-Local-Date': '2026-11-14' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-imp-'));
  const { app } = createApp({ dbFile: path.join(tmp, 'db.sqlite'), backupDir: path.join(tmp, 'bk') });
  await new Promise((res) => { const s = app.listen(0, () => { base = `http://localhost:${s.address().port}/api`; s.unref(); res(); }); });
});

test('import : programme actif, ancien gardé, charges actuelles, exercices réutilisés', async () => {
  const { body: before } = await call('GET', '/program');
  const nEx = (await call('GET', '/exercises')).body.exercises.length;
  const body = { name: 'Hypertrophie 5 jours', days: [
    { name: 'J1 · Push A', weekdays: ['mon'], cardio: [{ activity: 'marche_inclinee', duration_min: 10, incline_pct: 15, speed_kmh: 4 }],
      items: [{ slug: 'dev_incline', sets: 3, reps: 10, reps_note: '(8 à 10)', rest: 150 }, { slug: 'dips', sets: 2, reps: 12 },
        { exercise: { name: 'Rowing Iso', lib_id: 'Leverage_Iso_Row', muscles: { dos_epaisseur: 1 }, pattern: 'horizontal_row' }, sets: 3, reps: 12 }] },
    { name: 'J2 · Pull A', weekdays: ['tue'], items: [{ exercise: { name: 'Rowing Iso', lib_id: 'Leverage_Iso_Row' }, sets: 2, reps: 10 }] },
  ] };
  const r = await call('POST', '/programs/import', body);
  assert.equal(r.status, 201);
  const { body: prog } = await call('GET', '/program');
  assert.equal(prog.days.length, 2);
  const inc = prog.days[0].exercises[0];
  assert.equal(inc.sets, 3); assert.equal(inc.reps, 10); assert.equal(inc.reps_note, '(8 à 10)');
  assert.equal(inc.target_weight, before.days[0].exercises.find((e) => e.exercise_id === inc.exercise_id).target_weight, 'charge actuelle reprise');
  assert.equal(prog.days[0].exercises[1].weight_note, 'assistance');
  assert.equal(prog.days[0].cardio[0].incline_pct, 15);
  assert.equal(prog.schedule.mon, 'D1'); assert.equal(prog.schedule.wed, 'rest');
  // Rowing Iso créé une seule fois et réutilisé le jour 2
  assert.equal((await call('GET', '/exercises')).body.exercises.length, nEx + 1);
  assert.equal(prog.days[1].exercises[0].exercise_id, prog.days[0].exercises[2].exercise_id);
  const { body: list } = await call('GET', '/programs');
  assert.equal(list.programs.length, 2, 'ancien programme gardé');
  // Rouvrir le lien ne crée pas de doublon
  const again = await call('POST', '/programs/import', body);
  assert.equal(again.body.existing, true);
  assert.equal((await call('GET', '/programs')).body.programs.length, 2);
});
