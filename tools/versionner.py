# Ajoute ?v=<empreinte> aux visuels et aux scripts, pour que le navigateur
# recharge un fichier dès qu'il change (sinon il garde l'ancien en cache).
# À lancer avant chaque commit : python3 tools/versionner.py
import hashlib, re, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
def h(p): return hashlib.md5((R / p).read_bytes()).hexdigest()[:8]
js = R / 'data/origines.js'; s = js.read_text(encoding='utf-8')
s = re.sub(r'"(assets/cartes/[^"?]+)(\?v=[0-9a-f]+)?"', lambda m: '"%s?v=%s"' % (m.group(1), h(m.group(1))), s)
js.write_text(s, encoding='utf-8')
ix = R / 'index.html'; t = ix.read_text(encoding='utf-8')
t = re.sub(r'src="((?:data|js|js/vendor)/[\w.-]+\.js|config\.js)(\?v=[0-9a-f]+)?"', lambda m: 'src="%s?v=%s"' % (m.group(1), h(m.group(1))), t)
ix.write_text(t, encoding='utf-8')
