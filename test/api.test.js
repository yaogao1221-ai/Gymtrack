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
  assert.deepEqual(body.periods.map((p) => p.key), ['D2026-11-09', 'D2026-11-08', 'W2026-46', 'W2026-45', 'M2026-11', 'M2026-10']);
  assert.ok(body.periods[0].stats.km >= 5.5); assert.equal(body.periods[1].stats.km, 0);
  const w = body.periods[2];
  assert.deepEqual([w.from, w.to], ['2026-11-09', '2026-11-15']);
  assert.ok(w.stats.km >= 5.5); assert.ok(w.stats.workouts >= 1);
  assert.deepEqual(Object.keys(w.stats).sort(), ['active_days', 'cardio_min', 'cardio_n', 'improved', 'km', 'prs', 'sets', 'target', 'trained', 'workouts'], 'que des totaux');
  assert.ok(body.badges.find((b) => b.id === 'first').got);
  assert.equal(body.periods[5].to, '2026-10-31');
  // Totaux par jour pour les compétitions : 35 jours consécutifs, des nombres seulement
  assert.equal(body.days.length, 35); assert.equal(body.days.at(-1).day, '2026-11-09'); assert.equal(body.days[0].day, '2026-10-06');
  for (const d of body.days) assert.deepEqual(Object.keys(d).sort(), ['cardio_min', 'cardio_n', 'day', 'km', 'prs', 'sets', 'workouts'], 'que des totaux');
  const today = body.days.at(-1); assert.ok(today.km >= 5.5); assert.equal(today.cardio_n >= 1, true);
  assert.ok(body.days.every((d) => d.workouts <= d.sets), 'une séance compte seulement avec une série validée');
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

test('calendrier : reprise par un jour choisi, repos conservés, deload', async () => {
  const { body: prog } = await call('GET', '/program');
  const d4 = prog.days.find((d) => d.code === 'D4');
  // 2026-11-10 = mardi (planning type : mar D2, mer D3, jeu repos, ven D4, sam D5, dim repos, lun D1)
  const r = await call('POST', '/calendar/reflow', { from: '2026-11-10', program_day_id: d4.id, weeks: 1 });
  assert.equal(r.status, 200);
  const cal = (await call('GET', '/calendar?from=2026-11-10&to=2026-11-16')).body.events;
  const seq = cal.map((e) => `${e.date.slice(8)}:${e.type === 'rest' ? 'R' : e.code}`);
  assert.deepEqual(seq, ['10:D4', '11:D5', '12:R', '13:D1', '14:D2', '15:R', '16:D3']);
  const st = (await call('GET', '/deload')).body;
  assert.equal(st.interval, 6); assert.equal(st.rules.length, 6);
  assert.equal((await call('POST', '/deload', { start: '2026-11-16' })).status, 200);
  const after = (await call('GET', '/calendar?from=2026-11-16&to=2026-11-22')).body.events;
  assert.ok(after.length >= 7 && after.every((e) => e.deload === 1));
  assert.equal((await call('GET', '/deload')).body.planned_start, '2026-11-16');
  await call('DELETE', '/deload?start=2026-11-16');
  assert.ok((await call('GET', '/calendar?from=2026-11-16&to=2026-11-22')).body.events.every((e) => e.deload === 0));
});

test('corps & nutrition : IMC, % de gras US Navy, maintien, cure de sèche et contrôle hebdo', async () => {
  await call('PUT', '/profile', { sex: 'homme', height_cm: 178, birth_year: 1998 });
  for (const [d, kg] of [['2026-10-27', 82.4], ['2026-10-29', 82.2], ['2026-11-02', 81.9], ['2026-11-04', 81.7], ['2026-11-09', 81.2]]) {
    const r = await call('POST', '/body-metrics', { date: d, weight_kg: kg }); assert.equal(r.status, 201, JSON.stringify(r.body));
  }
  await call('POST', '/body-metrics', { date: '2026-11-09', waist_cm: 86, neck_cm: 39 });
  const { body: s } = await call('GET', '/nutrition');
  assert.deepEqual(s.missing, []);
  assert.equal(s.bmi.value, 25.7); // poids lissé sur 7 jours : (81,7 + 81,2) / 2
  assert.ok(s.body_fat.value > 14 && s.body_fat.value < 19, String(s.body_fat.value));
  assert.ok(s.tdee > 2000 && s.tdee < 3200, String(s.tdee));
  assert.ok(s.types.seche.preview.kcal < s.tdee && s.types.masse.preview.kcal > s.tdee);
  assert.ok(s.types.seche.preview.protein_g >= 2.2 * 81);
  const p = await call('POST', '/nutrition/plan', { type: 'seche', start_date: '2026-10-27', weeks: 12 });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  assert.equal(p.body.plan.week, 2);
  assert.ok(['ok', 'slow', 'fast'].includes(p.body.plan.check.status));
  const a = await call('POST', `/nutrition/plan/${p.body.plan.id}/adjust`, { delta: -150 });
  assert.equal(a.body.plan.kcal, p.body.plan.kcal - 150);
});

test('équilibre musculaire : paires force et volume, verdicts déterministes', async () => {
  const { status, body } = await call('GET', '/bodymap/balance');
  assert.equal(status, 200);
  assert.deepEqual(body.strength.map((x) => x.id), ['cuisses', 'chaine', 'torse', 'bras', 'hanches']);
  for (const x of [...body.strength, ...body.volume]) {
    assert.ok(['ok', 'low', 'high', 'unknown'].includes(x.verdict));
    if (x.verdict !== 'unknown' && x.ratio != null) assert.equal(x.verdict, x.ratio < x.target[0] ? 'low' : x.ratio > x.target[1] ? 'high' : 'ok');
  }
  assert.equal((await call('GET', '/bodymap/balance')).body.issues, body.issues, 'même résultat à chaque appel');
});
