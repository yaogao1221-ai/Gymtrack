import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMeal, ALIAS_CODES, splitMeal, regram } from '../client/src/lib/foodParse.js';

const foods = JSON.parse(readFileSync(new URL('../client/src/data/foods.json', import.meta.url)));
const one = (t) => { const r = parseMeal(t, foods); assert.equal(r.items.length, 1, `${t} → ${JSON.stringify(r)}`); return r.items[0]; };

test('dictionnaire : chaque aliment courant existe dans la table Ciqual', () => {
  const codes = new Set(foods.map((f) => f.c));
  for (const c of ALIAS_CODES) assert.ok(codes.has(c), `code Ciqual inconnu ${c}`);
});

test('phrases courantes : aliment et quantité', () => {
  let x = one('un verre de lait'); assert.match(x.food.name, /^Lait demi-écrémé/); assert.equal(x.grams, 200);
  x = one('2 œufs'); assert.match(x.food.name, /^Oeuf/); assert.equal(x.grams, 100);
  x = one('une assiette de pâtes'); assert.match(x.food.name, /^Pâtes sèches, standard, cuites/); assert.equal(x.grams, 250);
  x = one('150g de riz'); assert.match(x.food.name, /^Riz blanc, cuit/); assert.equal(x.grams, 150);
  x = one('riz 150 g'); assert.equal(x.grams, 150);
  x = one('une demi baguette'); assert.equal(x.grams, 125);
  x = one('un grand verre de jus d\'orange'); assert.match(x.food.name, /^Jus d'orange/); assert.equal(x.grams, 260);
  x = one('2 cuillères à soupe d\'huile d\'olive'); assert.match(x.food.name, /^Huile d'olive/); assert.equal(x.grams, 20);
  x = one('une canette de coca'); assert.match(x.food.name, /^Cola, sucré/); assert.equal(x.grams, 330);
  x = one('un scoop de whey'); assert.equal(x.food.per100.p, 78); assert.equal(x.grams, 30);
  x = one('3 dattes'); assert.equal(x.grams, 24);
  x = one('50 cl d\'eau'); assert.equal(x.grams, 500);
  x = one('un café au lait'); assert.match(x.food.name, /^Café au lait/);
  x = one('une pomme de terre'); assert.match(x.food.name, /^Pomme de terre/);
  x = one('un yaourt'); assert.equal(x.grams, 125);
  x = one('deux tranches de pain de mie'); assert.equal(x.grams, 50);
  x = one('1,5 l de lait'); assert.equal(x.grams, 1500);
});

test('phrase entière : plusieurs aliments, repas repéré', () => {
  const r = parseMeal("Ce matin j'ai mangé 2 oeufs, une tranche de pain et un café avec du lait", foods);
  assert.equal(r.meal, 'petit_dej');
  assert.deepEqual(r.items.map((x) => x.food.name.split(/[ ,]/)[0]), ['Oeuf', 'Pain', 'Café', 'Lait']);
  assert.equal(r.unknown.length, 0);
  const s = parseMeal('ce soir couscous au poulet et une orange', foods);
  assert.equal(s.meal, 'diner'); assert.equal(s.items.length, 2); assert.match(s.items[0].food.name, /Couscous au poulet/);
  assert.deepEqual(splitMeal('un kilo et demi de riz'), ['un kilo et_demi de riz']);
});

test('aliment hors dictionnaire : recherche dans Ciqual, autre choix possible', () => {
  const x = one('100 g de quinoa'); assert.match(x.food.name, /^Quinoa/);
  const y = one('une tranche de saumon fumé'); assert.match(y.food.name, /^Saumon fumé/); assert.equal(y.grams, 25);
  const z = one('200 g de cabillaud'); assert.ok(z.alts.length > 0);
  const w = regram(z, z.alts[0]); assert.equal(w.grams, 200);
  const r = parseMeal('blablabla', foods); assert.equal(r.items.length, 0); assert.equal(r.unknown.length, 1);
});
