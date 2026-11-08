"""QA de voces: transcribe cada línea con Scribe y la compara con el guion.
Si sale dudosa sola, la prueba en contexto (pegada a la línea anterior).
Uso (desde video-trading/): python3 scripts/check-voices.py episodes/<episodio>.json"""
import json, os, re, subprocess, sys, tempfile, unicodedata
from difflib import SequenceMatcher

ep = json.load(open(sys.argv[1]))
adir = os.path.join('audio', ep['id'])


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'\[[^\]]*\]', ' ', s)
    return re.sub(r'[^a-z0-9 ]', ' ', s).split()


def stt(path):
    out = subprocess.run(['curl', '-sS', 'https://api.elevenlabs.io/v1/speech-to-text', '-F', 'model_id=scribe_v1',
                          '-F', 'language_code=spa', '-F', f'file=@{path}'], capture_output=True, text=True).stdout
    return json.loads(out).get('text', '')


def sim(a, b):
    return SequenceMatcher(None, ' '.join(a), ' '.join(b)).ratio()


prev = None
bad = []
for i, line in enumerate(ep['lines']):
    if line.get('silent'):
        continue
    n = f'{i + 1:02d}'
    mp3 = os.path.join(adir, n + '.mp3')
    want = norm(line['text'])
    got = stt(mp3)
    r = sim(want, norm(got))
    verdict = 'ok' if r >= 0.8 else '??'
    ctx = ''
    if r < 0.8 and prev:
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as f:
            tmp = f.name
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', prev, '-i', mp3, '-filter_complex',
                        '[0][1]concat=n=2:v=0:a=1', tmp], check=True)
        cg = norm(stt(tmp))
        os.unlink(tmp)
        tail = cg[-len(want):] if len(cg) >= len(want) else cg
        rc = sim(want, tail)
        ctx = f'  | en contexto: {" ".join(tail)} ({rc:.2f})'
        if rc >= 0.8:
            verdict = 'ok*'
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3],
                               capture_output=True, text=True).stdout)
    print(f'{n} {verdict:3} {dur:5.2f}s  {r:.2f}  {got}{ctx}')
    if verdict == '??':
        bad.append(i)
    prev = mp3
print('REVISAR:', ' '.join(str(i) for i in bad) if bad else 'nada')
