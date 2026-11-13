import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';

let base; const H = { 'Content-Type': 'application/json', 'X-Local-Date': '2026-11-20' };
const call = async (method, p, body) => { const r = await fetch(base + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gtc-'));
before(async () => {
  const { app } = createApp({ dbFile: path.join(tmp, 'db.sqlite'), backupDir: path.join(tmp, 'bk') });
  await new Promise((res) => { const s = app.listen(0, () => { base = `http://localhost:${s.address().port}/api`; s.unref(); res(); }); });
});
const log = async (day, date, rpe, repsFor = () => null, wFor = (e) => e.target_weight) => {
  const sets = day.exercises.flatMap((e, pos) => Array.from({ length: e.sets }, (_, i) => ({ exercise_id: e.exercise_id, program_exercise_id: e.id, position: pos, set_index: i + 1, weight: wFor(e), weight_unit: e.weight_unit, reps: repsFor(e) ?? e.reps ?? 12, target_reps: e.reps })));
  return call('POST', '/workouts', { client_id: `c-${date}`, program_day_id: day.id, name: day.name, date, duration_sec: 3000, rpe, sets });
};

test('progression : suggérée après une séance, confirmée après deux, effort ≥ 9 bloque', async () => {
  const day = (await call('GET', '/program')).body.days[0];
  await log(day, '2026-11-10', 7);
  let p = (await call('GET', '/program')).body.days[0].exercises.find((e) => e.slug === 'dev_incline');
  assert.equal(p.coach.type, 'increase'); assert.equal(p.coach.state, 'suggeree');
  await log(day, '2026-11-13', 7);
  p = (await call('GET', '/program')).body.days[0].exercises.find((e) => e.slug === 'dev_incline');
  assert.equal(p.coach.state, 'confirmee'); assert.ok(p.coach.evidence.length >= 2, 'la décision cite ses séances');
  await log(day, '2026-11-17', 9.5);
  p = (await call('GET', '/program')).body.days[0].exercises.find((e) => e.slug === 'dev_incline');
  assert.equal(p.coach.type, 'hold', 'séance à la limite : pas de hausse');
  const a = await call('GET', '/analysis');
  assert.ok(!a.body.progression.some((x) => x.exercise === 'Développé incliné' && x.type === 'increase'));
});

test('espace Coach : boîte à valider, bilan, récupération et 10 questions', async () => {
  const hub = (await call('GET', '/coach/hub')).body;
  assert.ok(Array.isArray(hub.inbox.items)); assert.equal(hub.questions.length, 10);
  assert.ok(hub.recovery.note.includes('pas une mesure médicale'));
  assert.ok(hub.week.cur.workouts >= 1);
  for (const q of hub.questions) {
    const r = await call('GET', `/coach/ask/${q.id}`);
    assert.equal(r.status, 200, q.id); assert.ok(r.body.headline, `réponse à ${q.id}`);
  }
  assert.equal((await call('GET', '/coach/ask/nimportequoi')).status, 404);
  // Un refus ne revient pas
  const it = hub.inbox.items[0];
  if (it) { await call('POST', '/analysis/dismiss', { key: it.key }); const again = (await call('GET', '/coach/inbox')).body; assert.ok(!again.items.some((x) => x.key === it.key)); }
});

test('stagnation : objectif atteint sans progresser → c’est le programme qui freine', async () => {
  const day = (await call('GET', '/program')).body.days[1];
  for (const d of ['2026-11-02', '2026-11-06', '2026-11-11', '2026-11-16']) await log(day, d, 7);
  const st = (await call('GET', '/coach/stagnation')).body;
  const row = st.find((x) => x.exercise === day.exercises[1].name);
  assert.equal(row.status, 'stagne'); assert.ok(row.causes.some((c) => c.k === 'objectif' || c.k === 'charge'));
});
