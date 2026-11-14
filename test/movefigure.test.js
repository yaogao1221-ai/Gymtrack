// Chaque exercice de la bibliothèque sans photo a une illustration adaptée (pas la silhouette debout par défaut)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';

const lib = JSON.parse(readFileSync(new URL('../client/src/data/exlib.json', import.meta.url)));
const out = new URL('../node_modules/.cache/mf-test.mjs', import.meta.url).pathname;
buildSync({ entryPoints: [new URL('../client/src/components/MoveFigure.jsx', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', external: ['react', 'react/jsx-runtime'], outfile: out, logLevel: 'error' });
const { moveFor, MOVES } = await import(pathToFileURL(out));

test('illustrations : chaque exercice sans photo a un mouvement dessiné', () => {
  const STATIC_OK = new Set(['Kettlebell_Halo', 'x_wrist_ext_ecc', 'x_tyler_twist', 'x_side_lying_er']);
  for (const x of lib.filter((e) => !e.img)) {
    const m = moveFor(x);
    assert.ok(MOVES[m], `${x.id} : mouvement ${m} inconnu`);
    if (!STATIC_OK.has(x.id)) assert.notEqual(m, 'stand', `${x.id} n’a pas d’illustration adaptée`);
  }
});

test('illustrations : rowings machine et exercices du programme sans bibliothèque', () => {
  for (const id of ['x_machine_row', 'x_machine_row_1arm', 'x_machine_row_wide', 'x_machine_row_neutral', 'x_tbar_machine', 'x_low_row_machine']) assert.equal(moveFor(lib.find((x) => x.id === id)), 'machinerow', id);
  assert.equal(moveFor(lib.find((x) => x.id === 'x_high_row_machine')), 'highrow');
  assert.equal(moveFor({ name: 'Mon exercice', pattern: 'horizontal_row' }), 'row');
  assert.equal(moveFor({ name: 'Leg curl assis', pattern: 'knee_flexion' }), 'legcurl');
});
