// Séance : charge conseillée (double progression), records et bilan de séance
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';
import { suggestNext } from '../client/src/lib/progression.js';

let base; const H = { 'Content-Type': 'application/json', 'X-Local-Date': '2026-11-09' };
const call = async (method, p, body) => {
  const r = await fetch(base + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-sess-'));
  const { app } = createApp({ dbFile: path.join(tmp, 'db.sqlite'), backupDir: path.join(tmp, 'bk') });
  await new Promise((res) => { const s = app.listen(0, () => { base = `http://localhost:${s.address().port}/api`; s.unref(); res(); }); });
});

test('charge conseillée : double progression', () => {
  const pe = (sets, kind = 'weighted', unit = 'lbs') => ({ reps: 10, kind, weight_unit: unit, last: { sets } });
  assert.equal(suggestNext(pe([{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }])).weight, 65);
  assert.equal(suggestNext(pe([{ weight: 60, reps: 10 }, { weight: 60, reps: 8 }])).weight, 60);
  assert.equal(suggestNext(pe([{ weight: 60, reps: 7 }, { weight: 60, reps: 6 }])).reps, 8);
  assert.equal(suggestNext(pe([{ weight: 120, reps: 10 }, { weight: 120, reps: 10 }], 'assisted')).weight, 115);
  assert.equal(suggestNext(pe([{ weight: 20, reps: 10 }], 'weighted', 'kg')).weight, 22.5);
  assert.equal(suggestNext({ reps: 10, kind: 'weighted', weight_unit: 'lbs', last: null }), null);
});

test('records et bilan de séance', async () => {
  const prog = (await call('GET', '/program')).body; const day = prog.days[0]; const ex = day.exercises[0];
  const mk = (date, weight, reps, cid) => call('POST', '/workouts', { client_id: cid, program_day_id: day.id, name: day.name, date, duration_sec: 3000,
    sets: [1, 2].map((i) => ({ exercise_id: ex.exercise_id, program_exercise_id: ex.id, position: 0, set_index: i, weight, weight_unit: ex.weight_unit, reps, completed: 1 })) });
  const a = await mk('2026-11-02', 100, 8, 'w1'); assert.equal(a.status, 201);
  let d = (await call('GET', `/workouts/${a.body.id}`)).body;
  assert.equal(d.review.first_time, true); assert.equal(d.review.records.length, 0);
  const b = await mk('2026-11-09', 110, 8, 'w2');
  d = (await call('GET', `/workouts/${b.body.id}`)).body;
  assert.equal(d.review.records.length, 1); assert.equal(d.review.records[0].type, 'charge');
  assert.ok(d.review.compare.volume_delta > 0);
  const best = (await call('GET', '/program')).body.days[0].exercises[0].best;
  assert.ok(best.top_lbs > 0 && best.e1rm_lbs > best.top_lbs);
});
