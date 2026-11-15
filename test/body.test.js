import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';
import { fineLoads, MUSCLE_LIST, MUSCLE_BY_ID } from '../server/body/muscles.js';

let base;
const call = async (method, p, body, day = '2026-11-15') => {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', 'X-Local-Date': day }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-body-'));
before(async () => {
  const { app } = createApp({ dbFile: path.join(tmp, 'db.sqlite'), backupDir: path.join(tmp, 'bk') });
  await new Promise((res) => { const s = app.listen(0, () => { base = `http://localhost:${s.address().port}/api`; s.unref(); res(); }); });
});

test('source des muscles : identifiants uniques, groupes connus, répartition par type de mouvement', () => {
  assert.equal(new Set(MUSCLE_LIST.map((m) => m.id)).size, MUSCLE_LIST.length);
  const incline = Object.fromEntries(fineLoads({ name: 'Développé incliné haltères', pattern: 'press_incline', muscles: { pectoraux: 1, epaules_ant: 0.5 } }).map((x) => [x.id, x]));
  const flat = Object.fromEntries(fineLoads({ name: 'Développé couché', pattern: 'press_horizontal', muscles: { pectoraux: 1 } }).map((x) => [x.id, x]));
  assert.ok(incline.pec_sup.w > incline.pec_inf.w && flat.pec_inf.w > flat.pec_sup.w);
  assert.equal(incline.delt_ant.direct, false);
  const hammer = Object.fromEntries(fineLoads({ name: 'Curl marteau', pattern: 'curl_hammer', muscles: { biceps: 1, avant_bras: 0.5 } }).map((x) => [x.id, x]));
  assert.ok(hammer.brachial.w > hammer.biceps.w);
  assert.ok(MUSCLE_BY_ID.rhomboides.deep && MUSCLE_BY_ID.tibial_ant.group === null);
});

test('état du corps : fatigue estimée, volume direct et indirect, douleur avec côté, réglages', async () => {
  let st = (await call('GET', '/body/state')).body;
  assert.equal(st.summary.has_data, false);
  assert.ok(Object.values(st.muscles).every((m) => m.recovery.level === 'aucune' && m.volume[4].total === 0));
  const { body: prog } = await call('GET', '/program'); const d = prog.days[0];
  const sets = d.exercises.flatMap((e, j) => [1, 2, 3].map((k) => ({ exercise_id: e.exercise_id, program_exercise_id: e.id, position: j, set_index: k, weight: e.target_weight || 50, weight_unit: e.weight_unit, reps: 10 })));
  assert.equal((await call('POST', '/workouts', { client_id: 'b-1', program_day_id: d.id, name: d.name, date: '2026-11-15', sets }, '2026-11-15')).status, 201);
  st = (await call('GET', '/body/state?h=20')).body;
  const hit = Object.values(st.muscles).filter((m) => m.volume[1].direct > 0);
  assert.ok(hit.length > 0);
  assert.ok(hit.some((m) => m.recovery.level === 'elevee' || m.recovery.level === 'moderee'));
  assert.ok(Object.values(st.muscles).every((m) => !/100 ?%/.test(m.recovery.label)));
  // Deux jours plus tard, la fatigue a baissé
  const later = (await call('GET', '/body/state?h=20', null, '2026-11-17')).body;
  for (const m of hit) assert.ok(later.muscles[m.id].recovery.fatigue < m.recovery.fatigue);
  // Réglage plus lent : fatigue restante plus élevée
  assert.equal((await call('PUT', '/body/settings', { speed: 'lente' })).status, 200);
  const slow = (await call('GET', '/body/state?h=20', null, '2026-11-17')).body;
  assert.ok(slow.muscles[hit[0].id].recovery.fatigue > later.muscles[hit[0].id].recovery.fatigue);
  // Douleur avec côté, type et mouvements : visible sur les muscles voisins, séparée de la fatigue
  const p = await call('POST', '/pains', { area: 'epaule', intensity: 5, side: 'gauche', kind: 'pincement', movements: ['Bras au-dessus de la tête'], date: '2026-11-15' });
  assert.equal(p.status, 201); assert.equal(p.body.side, 'gauche');
  assert.equal((await call('POST', '/pains', { area: 'epaule', intensity: 5, side: 'milieu', date: '2026-11-15' })).status, 400);
  st = (await call('GET', '/body/state')).body;
  assert.equal(st.muscles.delt_lat.pain[0].side, 'gauche');
  // Fiche muscle : historique par semaine
  const mh = (await call('GET', `/body/muscle/${hit[0].id}`)).body;
  assert.equal(mh.weeks.length, 12); assert.ok(mh.weeks.at(-1).direct > 0);
  assert.equal((await call('GET', '/body/muscle/inconnu')).status, 404);
  // Mensurations complètes
  const bm = await call('POST', '/body-metrics', { date: '2026-11-15', arm_cm: 36.5, thigh_cm: 58 });
  assert.equal(bm.status, 201); assert.equal(bm.body.arm_cm, 36.5);
});
