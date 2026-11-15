"""Traduit en français les consignes anglaises de la bibliothèque (free-exercise-db).
Résultat gardé dans scripts/exlib_fr.json (id -> étapes), réutilisé par build-exlib.py, puis appliqué à exlib.json.
Usage : python3 scripts/translate-exlib.py"""
import json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, 'client/src/data/exlib.json')
CACHE = os.path.join(ROOT, 'scripts/exlib_fr.json')

def tr(text):
    url = 'https://translate.googleapis.com/translate_a/single?' + urllib.parse.urlencode({'client': 'gtx', 'sl': 'en', 'tl': 'fr', 'dt': 't', 'q': text})
    for k in range(5):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                data = json.loads(r.read().decode('utf-8'))
            return ''.join(seg[0] for seg in data[0] if seg[0])
        except Exception as e:  # limite de débit : on attend et on réessaie
            time.sleep(2 + 3 * k)
    raise RuntimeError('traduction impossible')

# Petites retouches : vocabulaire de salle et typographie française
FIX = [(r"\bhaltère(s)? à une main\b", r"haltère\1"), (r'\s+([:;?!])', ' \\1'), (r"'", '’')]
def tidy(s):
    for a, b in FIX: s = re.sub(a, b, s)
    return s.strip()

def main():
    lib = json.load(open(LIB, encoding='utf-8'))
    cache = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {}
    todo = [e for e in lib if e.get('i') and not e.get('fr') and e['id'] not in cache]
    print(f'{len(todo)} exercices à traduire', flush=True)
    for n, e in enumerate(todo, 1):
        steps = [s.strip() for s in e['i'] if s.strip()]
        out = tr('\n'.join(steps)).split('\n')
        if len(out) != len(steps):  # séparation perdue : une étape à la fois
            out = [tr(s) for s in steps]
        cache[e['id']] = [tidy(s) for s in out]
        if n % 25 == 0:
            json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
            print(n, flush=True)
        time.sleep(0.15)
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    for e in lib:
        if e['id'] in cache and not e.get('fr'):
            e['i'] = cache[e['id']]; e['fr'] = 1
    json.dump(lib, open(LIB, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('ok', sum(1 for e in lib if e.get('fr')), '/', len(lib))

if __name__ == '__main__':
    main()
