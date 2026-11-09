# Transforme dist-standalone/index.html en page publiable comme artifact Claude (sans squelette html/head/body)
import re, sys
s = open('dist-standalone/index.html', encoding='utf-8').read()
m = re.search(r'<title>.*?</title>', s); title = m.group(0); s = s.replace(title, '')
for pat in [r'<!doctype html>', r'<html[^>]*>', r'</html>', r'<head>', r'</head>', r'<body>', r'</body>', r'<meta charset="UTF-8"\s*/?>', r'<meta name="viewport"[^>]*>', r'<meta name="(apple-mobile-web-app-[^"]*|mobile-web-app-capable)"[^>]*>']:
    s = re.sub(pat, '', s, flags=re.I)
open(sys.argv[1], 'w', encoding='utf-8').write(title + '\n' + s.strip() + '\n')
