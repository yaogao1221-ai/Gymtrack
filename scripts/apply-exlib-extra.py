# Ajoute (ou met à jour) les exercices de exlib_extra.py dans client/src/data/exlib.json sans retélécharger free-exercise-db.
import json, pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(root))
from exlib_extra import EXTRA2, PT, tag_lib
src = (root / 'build-exlib.py').read_text()
ns = {'re': re}
exec(src[src.index('PATTERNS = ['):src.index('data = json.load')], ns)  # PATTERNS, pattern(), kind()
out = root.parent / 'client/src/data/exlib.json'
lib = json.loads(out.read_text())
ids = {x[0] for x in EXTRA2}
lib = [x for x in lib if x['id'] not in ids and x['id'] != 'x_rower']  # x_rower fusionné avec Rowing_Stationary (v10.1)
for x in lib:
    if x['id'] == 'Rowing_Stationary':
        x.update(n='Rameur', l='b', fr=1, i=['Pieds sanglés, dos droit, bras tendus vers la poignée.', 'Pousse d’abord avec les jambes, puis bascule le buste en arrière, puis tire la poignée vers le bas des côtes.', 'Au retour, dans l’ordre inverse : bras, buste, puis jambes.', 'Garde un rythme régulier : la puissance vient des jambes, pas des bras.'])
for i, n, en, c, q, k, m, l, steps in EXTRA2:
    lib.append({'id': i, 'n': n, 'en': en, 'c': c, 'q': q, 'l': l, 'k': k, 'pt': PT.get(i) or ns['pattern']({'name': en, 'category': c}), 'm': m, 'p': [], 'img': 0, 'i': steps, 'fr': 1})
missing = tag_lib(lib)
# Petite table des échelles pour le moteur (sans charger toute la bibliothèque)
lad = {x['id']: {k: x[k] for k in ('pv', 'nx') if k in x} | ({'nxn': byid2[x['nx']]['n']} if 'nx' in x else {}) for byid2 in [{y['id']: y for y in lib}] for x in lib if 'pv' in x or 'nx' in x}
(root.parent / 'client/src/data/ladders.json').write_text(json.dumps(lad, ensure_ascii=False, separators=(',', ':')))
if missing: print('ABSENTS :', missing)
out.write_text(json.dumps(lib, ensure_ascii=False, separators=(',', ':')))
print(len(lib), 'exercices,', len(EXTRA2), 'ajouts v9')
