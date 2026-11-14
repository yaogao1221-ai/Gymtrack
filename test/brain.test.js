// Cerveau musculaire : état par muscle et par articulation, séance du jour, ajustements et vérification à 4 semaines
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';

let base; const DAY0 = '2026-09-01';
const call = async (method, p, body, date = '2026-10-27') => {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', 'X-Local-Date': date }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const add = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-brain-'));
  const { app } = createApp({ dbFile: path.join(tmp, 'db.sqlite'), backupDir: path.join(tmp, 'bk') });
  await new Promise((res) => { const s = app.listen(0, () => { base = `http://localhost:${s.address().port}/api`; s.unref(); res(); }); });
});

// Séance du jour 1 du programme (pectoraux) une fois par semaine, charges en hausse de 2,5 kg chaque semaine
async function logWeeks(n, from, start = 0) {
  const { body: prog } = await call('GET', '/program');
  const day = prog.days[0];
  for (let w = 0; w < n; w++) {
    const date = add(from, 7 * w);
    const sets = day.exercises.flatMap((e, pos) => Array.from({ length: e.sets }, (_, i) => ({ exercise_id: e.exercise_id, program_exercise_id: e.id, position: pos, set_index: i + 1,
      weight: e.target_weight != null ? e.target_weight + (e.weight_note === 'assistance' ? 0 : 2.5 * (w + start)) : null, weight_unit: e.weight_unit, reps: e.reps || 10, target_reps: e.reps })));
    const r = await call('POST', '/workouts', { client_id: `brain-${date}`, program_day_id: day.id, name: day.name, date, duration_sec: 3000, rpe: 7, sets }, date);
    assert.equal(r.status, 201);
  }
  return day;
}

test('état musculaire : volume, fréquence, progression réelle, verdicts honnêtes', async () => {
  const day = await logWeeks(8, DAY0);
  const { body: st } = await call('GET', '/muscles/state', null, add(DAY0, 7 * 7 + 1));
  const pec = st.muscles.pectoraux;
  // Volume = séries réelles (principal 1, secondaire 0,5) moyennées sur 4 semaines, sans double comptage
  const planned = day.exercises.reduce((t, e) => t + (e.muscles.pectoraux || 0) * e.sets, 0);
  assert.equal(pec.volume.avg, Math.round(planned * 10) / 10);
  assert.equal(pec.frequency, 1);
  assert.equal(pec.progression.verdict, 'progres');
  assert.ok(pec.progression.change_pct > 2);
  assert.ok(pec.needs.some((n) => n.k === 'frequence' || n.k === 'volume'), 'une seule séance par semaine : volume ou fréquence à revoir');
  // Muscle jamais travaillé : pas de progression inventée
  assert.equal(st.muscles.ischios.progression.verdict, 'insuffisant');
  assert.equal(st.muscles.ischios.volume.verdict, 'absent');
  // Articulations : chaque zone a un état, l'épaule est sollicitée par les développés
  assert.ok(st.joints.epaule.load.avg > 0);
  assert.ok(['ok', 'surcharge'].includes(st.joints.epaule.status));
  assert.ok(st.global && st.global.value >= 0 && st.global.value <= 100);
});

test('séance du jour : muscles récupérés et en manque, mobilité, rien de fatigué proposé', async () => {
  const { body: st } = await call('GET', '/muscles/state', null, add(DAY0, 7 * 7 + 1));
  const p = st.today_plan;
  assert.equal(p.done, false);
  assert.ok(p.focus.length > 0);
  for (const f of p.focus) assert.ok(['pret', 'oublie'].includes(st.muscles[f.key].recovery.status));
  assert.ok(p.mobility && p.mobility.routine);
  // Le lendemain d'une séance pectoraux, les pectoraux ne sont pas proposés
  const { body: st2 } = await call('GET', '/muscles/state', null, add(DAY0, 7 * 7));
  assert.ok(st2.today_plan.done || !st2.today_plan.focus.some((f) => f.key === 'pectoraux'));
});

test('douleur : le muscle n’est plus poussé, l’articulation passe en soin', async () => {
  const date = add(DAY0, 7 * 7 + 1);
  await call('POST', '/pains', { date, area: 'genou', intensity: 6 }, date);
  const { body: st } = await call('GET', '/muscles/state', null, date);
  assert.equal(st.joints.genou.status, 'douleur');
  assert.ok(st.muscles.quadriceps.pain);
  assert.equal(st.muscles.quadriceps.needs.length, 0);
  assert.ok(!st.today_plan.focus.some((f) => f.key === 'quadriceps'));
  assert.equal(st.today_plan.mobility.routine, 'soin:genou');
  assert.ok(!st.proposals.some((p) => p.muscle === 'quadriceps'));
});

test('mobilité : routine notée une fois par jour, retirable', async () => {
  const date = add(DAY0, 7 * 7 + 1);
  assert.equal((await call('POST', '/mobility', { routine: 'haut' }, date)).status, 200);
  await call('POST', '/mobility', { routine: 'haut' }, date);
  let { body: list } = await call('GET', '/mobility', null, date);
  assert.equal(list.filter((x) => x.routine === 'haut' && x.date === date).length, 1);
  const { body: st } = await call('GET', '/muscles/state', null, date);
  assert.equal(st.joints.epaule.mobility.days, 0);
  await call('POST', '/mobility', { routine: 'haut', on: false }, date);
  ({ body: list } = await call('GET', '/mobility', null, date));
  assert.equal(list.filter((x) => x.routine === 'haut').length, 0);
  assert.equal((await call('POST', '/mobility', { routine: 'rm -rf' }, date)).status, 400);
});

test('priorités et ajustement validé : point de départ gardé, effet vérifié 4 semaines plus tard', async () => {
  const d1 = add(DAY0, 7 * 7 + 1);
  assert.equal((await call('POST', '/muscles/priority', { muscles: ['pectoraux', 'biceps', 'triceps', 'mollets'] }, d1)).status, 400);
  const { body: st } = await call('POST', '/muscles/priority', { muscles: ['pectoraux'] }, d1);
  assert.deepEqual(st.priority, ['pectoraux']);
  assert.ok(st.muscles.pectoraux.priority);
  const { body: prog } = await call('GET', '/program');
  const pe = prog.days[0].exercises.find((e) => (e.muscles.pectoraux || 0) >= 1);
  const r = await call('POST', '/muscles/adjust', { pe_id: pe.id, sets: pe.sets + 1, muscle: 'pectoraux', key: 'test' }, d1);
  assert.equal(r.status, 200);
  const { body: prog2 } = await call('GET', '/program');
  assert.equal(prog2.days[0].exercises.find((e) => e.id === pe.id).sets, pe.sets + 1);
  const adj = r.body.adjustments.find((a) => a.kind === 'series');
  assert.equal(adj.status, 'en_cours');
  assert.ok(adj.baseline.e1rm > 0);
  // 4 semaines de plus avec des charges qui montent : l'ajustement « a marché »
  await logWeeks(4, add(DAY0, 7 * 8), 8);
  const { body: later } = await call('GET', '/muscles/state', null, add(d1, 30));
  const res = later.adjustments.find((a) => a.id === adj.id);
  assert.equal(res.status, 'marche');
  assert.ok(res.change_pct >= 2);
  // Export : priorités, ajustements et mobilité font partie de la sauvegarde
  const { body: exp } = await call('GET', '/data/export');
  assert.ok(exp.data.muscle_adjustments.length >= 2);
  assert.ok(Array.isArray(exp.data.mobility_logs));
  assert.ok(exp.data.profiles[0].priority_muscles.includes('pectoraux'));
});

test('bilan du dimanche et boîte « À valider » : propositions sans doublon', async () => {
  const { body: sun } = await call('GET', '/coach/sunday', null, add(DAY0, 7 * 12));
  assert.ok(sun.tracked > 0);
  const { body: box } = await call('GET', '/coach/inbox', null, add(DAY0, 7 * 12));
  const ids = box.items.filter((it) => it.accept.pe_id).map((it) => it.accept.pe_id);
  assert.equal(ids.length, new Set(ids).size, 'un même exercice n’est proposé qu’une fois');
});
