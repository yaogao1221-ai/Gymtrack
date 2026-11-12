import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';

let base; const H = { 'Content-Type': 'application/json', 'X-Local-Date': '2026-11-09' };
const call = async (method, p, body, headers = {}) => {
  const r = await fetch(base + p, { method, headers: { ...H, ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-'));

before(async () => {
  const { app } = createApp({ dbFile: path.join(tmp, 'db.sqlite'), backupDir: path.join(tmp, 'bk') });
  await new Promise((res) => { const s = app.listen(0, () => { base = `http://localhost:${s.address().port}/api`; s.unref(); res(); }); });
});

test('programme initial : 5 jours, charges exactes', async () => {
  const { body } = await call('GET', '/program');
  assert.equal(body.days.length, 5);
  const d2 = body.days[1];
  assert.equal(d2.focus, 'Dos / Biceps');
  const trac = d2.exercises[0];
  assert.deepEqual([trac.sets, trac.reps, trac.target_weight, trac.weight_unit, trac.weight_note], [3, 10, 60, 'kg', 'assistance']);
  const row = d2.exercises[1]; assert.deepEqual([row.target_weight, row.target_weight_max], [50, 55]);
  assert.equal(d2.exercises.filter((e) => e.superset_group === 'A').length, 2);
  const d3 = body.days[2]; assert.equal(d3.exercises.find((e) => e.slug === 'rdl').target_weight, 30);
  assert.equal(body.days[0].exercises.find((e) => e.slug === 'dips').target_weight, 120);
  assert.equal(d3.exercises.find((e) => e.slug === 'mollets_pdc').reps, null);
});

test('séance : enregistrement, idempotence, calendrier, stats, progression validée', async () => {
  const { body: prog } = await call('GET', '/program');
  const day = prog.days[0];
  await call('POST', '/calendar', { type: 'workout', date: '2026-11-09', program_day_id: day.id });
  const sets = day.exercises.flatMap((e, pos) => Array.from({ length: e.sets }, (_, i) => ({ exercise_id: e.exercise_id, program_exercise_id: e.id, position: pos, set_index: i + 1, weight: e.target_weight, weight_unit: e.weight_unit, reps: e.reps, target_reps: e.reps })));
  const payload = { client_id: 'abc-1', program_day_id: day.id, name: day.name, date: '2026-11-09', duration_sec: 3000, rpe: 7, sets };
  const r1 = await call('POST', '/workouts', payload); assert.equal(r1.status, 201);
  const r2 = await call('POST', '/workouts', payload); assert.equal(r2.body.id, r1.body.id, 'pas de doublon hors ligne');
  const cal = await call('GET', '/calendar?from=2026-11-09&to=2026-11-09');
  assert.equal(cal.body.events[0].status, 'done');
  const dash = await call('GET', '/dashboard');
  assert.equal(dash.body.week.workouts, 1);
  assert.equal(dash.body.next.name, 'Jour 2');
  // Le coach propose, mais ne modifie rien seul
  const a = await call('GET', '/analysis');
  const inc = a.body.progression.find((p) => p.exercise === 'Développé incliné');
  assert.equal(inc.type, 'increase'); assert.equal(inc.patch.target_weight, 45);
  const before = (await call('GET', '/program')).body.days[0].exercises[0].target_weight; assert.equal(before, 40);
  const ap = await call('POST', '/analysis/apply', { key: inc.key }); assert.equal(ap.status, 200);
  assert.equal((await call('GET', '/program')).body.days[0].exercises[0].target_weight, 45);
  const dips = a.body.progression.find((p) => p.exercise === 'Dips assistés');
  assert.equal(dips.patch.target_weight, 110, 'assistance réduite');
});

test('douleur : bloque la progression des exercices concernés', async () => {
  await call('POST', '/pains', { area: 'epaule', intensity: 6, date: '2026-11-09' });
  const a = await call('GET', '/analysis');
  const couche = a.body.progression.find((p) => p.exercise === 'Développé couché');
  assert.equal(couche.type, 'hold');
  assert.ok(a.body.findings.some((f) => f.category === 'douleur'));
});

test('cardio : calories estimées, vitesse calculée', async () => {
  const r = await call('POST', '/cardio', { activity: 'marche_inclinee', date: '2026-11-09', duration_min: 30, distance_km: 2.5, incline_pct: 10 });
  assert.equal(r.status, 201); assert.equal(r.body.speed_kmh, 5); assert.ok(r.body.calories > 150 && r.body.calories < 350, String(r.body.calories));
  const bad = await call('POST', '/cardio', { activity: 'autre', date: '2026-11-09', duration_min: 10 }); assert.equal(bad.status, 400);
});

test('analyse du programme : détecte l’absence de gainage et les tirages redondants', async () => {
  const a = await call('GET', '/analysis');
  assert.ok(a.body.findings.some((f) => f.title.includes('Abdominaux')));
  assert.ok(a.body.findings.some((f) => f.category === 'redondance' && f.title.includes('tirages horizontaux')));
  assert.ok(a.body.cardio.weeks.length > 0);
});

test('comparaison de périodes et export / import', async () => {
  const c = await call('GET', '/stats/compare?aFrom=2026-10-01&aTo=2026-10-31&bFrom=2026-11-01&bTo=2026-11-30');
  assert.equal(c.body.b.workouts, 1); assert.equal(c.body.a.workouts, 0);
  const ex = await call('GET', '/data/export');
  assert.equal(ex.body.app, 'gymtrack-ai');
  await call('DELETE', `/workouts/${ex.body.data.workouts[0].id}`);
  assert.equal((await call('GET', '/workouts')).body.length, 0);
  const imp = await call('POST', '/data/import', ex.body); assert.equal(imp.status, 200);
  assert.equal((await call('GET', '/workouts')).body.length, 1);
});

test('validation des entrées', async () => {
  assert.equal((await call('PATCH', '/program/exercises/1', { sets: 0 })).status, 400);
  assert.equal((await call('POST', '/workouts', { name: 'x', date: '2026-13-01', sets: [{ exercise_id: 1 }] })).status, 400);
  assert.equal((await call('PUT', '/profile', { schedule: { mon: 'D9' } })).status, 400);
});

test('mot de passe', async () => {
  const { app } = createApp({ dbFile: path.join(tmp, 'db2.sqlite'), backupDir: path.join(tmp, 'bk2'), password: 'secret' });
  const s = app.listen(0); const u = `http://localhost:${s.address().port}/api`;
  assert.equal((await fetch(u + '/program')).status, 401);
  assert.equal((await fetch(u + '/auth/login', { method: 'POST', headers: H, body: '{"password":"x"}' })).status, 401);
  const { token } = await (await fetch(u + '/auth/login', { method: 'POST', headers: H, body: '{"password":"secret"}' })).json();
  assert.equal((await fetch(u + '/program', { headers: { Authorization: `Bearer ${token}` } })).status, 200);
  s.close();
});

test('ligue : bilan des périodes (totaux seulement), badges, semaines ISO', async () => {
  const c = await call('POST', '/cardio', { activity: 'course', date: '2026-11-09', duration_min: 30, distance_km: 5.5 }); assert.equal(c.status, 201, JSON.stringify(c.body));
  const { status, body } = await call('GET', '/league/summary');
  assert.equal(status, 200);
  assert.deepEqual(body.periods.map((p) => p.key), ['W2026-46', 'W2026-45', 'M2026-11', 'M2026-10']);
  const w = body.periods[0];
  assert.deepEqual([w.from, w.to], ['2026-11-09', '2026-11-15']);
  assert.ok(w.stats.km >= 5.5); assert.ok(w.stats.workouts >= 1);
  assert.deepEqual(Object.keys(w.stats).sort(), ['cardio_min', 'cardio_n', 'km', 'prs', 'sets', 'workouts']);
  assert.ok(body.badges.find((b) => b.id === 'first').got);
  assert.equal(body.periods[3].to, '2026-10-31');
});

test('cardio dans le programme : bloc, lien avec la séance, progression validée', async () => {
  const { body: prog } = await call('GET', '/program');
  const day = prog.days[0];
  const b = await call('POST', `/program/days/${day.id}/cardio`, { activity: 'marche_inclinee', duration_min: 15, speed_kmh: 5, incline_pct: 8 });
  assert.equal(b.status, 201);
  let p2 = (await call('GET', '/program')).body;
  assert.equal(p2.days[0].cardio[0].label, 'Marche inclinée (tapis)');
  for (const d of ['2026-11-03', '2026-11-06']) {
    const c = await call('POST', '/cardio', { activity: 'marche_inclinee', date: d, duration_min: 15, speed_kmh: 5, incline_pct: 8, program_cardio_id: b.body.id });
    assert.equal(c.status, 201);
  }
  p2 = (await call('GET', '/program')).body; assert.equal(p2.days[0].cardio[0].last.date, '2026-11-06');
  const a = (await call('GET', '/analysis')).body;
  const rec = a.progression.find((x) => x.cardio_id === b.body.id);
  assert.ok(rec, 'progression cardio proposée');
  if (rec.type === 'increase') {
    assert.equal((await call('POST', '/analysis/apply', { key: rec.key })).status, 200);
    p2 = (await call('GET', '/program')).body; assert.equal(p2.days[0].cardio[0].duration_min, 20);
  }
  assert.equal((await call('PATCH', `/program/cardio/${b.body.id}`, { placement: 'debut' })).body.placement, 'debut');
  const exp = (await call('GET', '/data/export')).body; assert.equal(exp.data.program_cardio.length, 1);
});
