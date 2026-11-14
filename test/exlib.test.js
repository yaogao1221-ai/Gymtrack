import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MUSCLES } from '../server/seed.js';

const lib = JSON.parse(readFileSync(new URL('../client/src/data/exlib.json', import.meta.url)));

test('banque d’exercices : identifiants uniques, muscles connus, ajouts v9 présents', () => {
  const ids = new Set();
  for (const x of lib) { assert.ok(!ids.has(x.id), `doublon ${x.id}`); ids.add(x.id); }
  for (const x of lib) for (const k of Object.keys(x.m || {})) assert.ok(k in MUSCLES, `${x.id} : muscle inconnu ${k}`);
  for (const id of ['x_sissy_squat', 'x_bayesian_curl', 'x_pendlay_row', 'x_bulgarian', 'x_pec_deck', 'x_ab_wheel']) {
    const x = lib.find((e) => e.id === id); assert.ok(x, id);
    assert.ok(x.fr && x.i.length >= 2, `${id} : consignes en français`);
    if (x.c !== 'mobilite' && x.c !== 'cardio') assert.ok(Object.values(x.m).some((v) => v >= 1), `${id} : muscle principal`);
  }
  assert.ok(lib.length >= 980);
});
