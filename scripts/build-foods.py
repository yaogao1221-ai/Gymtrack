#!/usr/bin/env python3
"""Génère client/src/data/foods.json depuis la table Ciqual (ANSES, Licence Ouverte Etalab).

Usage : python3 scripts/build-foods.py <chemin/ciqual_2025_complete.json>
Valeurs pour 100 g : kcal, protéines, glucides, lipides, fibres, sucres.
"""
import json, re, sys, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / 'client/src/data/foods.json'
K = {
    'k': ['Energie, Règlement UE N° 1169/2011 (kcal/100 g)', 'Energie, N x facteur Jones, avec fibres (kcal/100 g)'],
    'p': ['Protéines, N x facteur de Jones (g/100 g)', 'Protéines, N x 6.25 (g/100 g)'],
    'g': ['Glucides (g/100 g)'], 'l': ['Lipides (g/100 g)'], 'f': ['Fibres alimentaires (g/100 g)'], 's': ['Sucres (g/100 g)'],
}


def val(comp, keys):
    for k in keys:
        v = (comp.get(k) or {}).get('valeur', '')
        v = v.strip().replace(',', '.')
        if v in ('', '-'): continue
        if v.lower().startswith('traces') or v.startswith('<'): return 0.0
        try: return round(float(v), 1)
        except ValueError: continue
    return None


# Portions usuelles (g) pour quelques familles, proposées en raccourci
PORTIONS = [
    (r'^oeuf', 50), (r'^pain', 40), (r'^riz', 150), (r'^pâtes|^pates', 180), (r'^pomme,', 150), (r'^banane', 120), (r'^yaourt', 125),
    (r'^lait', 250), (r'^blanc de poulet|^poulet, filet', 120), (r'^steak haché', 100), (r'^fromage blanc', 100), (r'^amande|^noix', 30),
]

data = json.load(open(sys.argv[1]))
out = []
for x in data:
    c = x.get('composition', {})
    row = {'c': x['alim_code'], 'n': x['alim_nom_fr'].strip(), 'gr': x.get('groupe', '')}
    for k, keys in K.items(): row[k] = val(c, keys)
    if row['k'] is None: continue
    for pat, g in PORTIONS:
        if re.search(pat, row['n'].lower()): row['por'] = g; break
    out.append(row)
out.sort(key=lambda r: r['n'])
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print(len(out), 'aliments ->', OUT, OUT.stat().st_size // 1024, 'Ko')
