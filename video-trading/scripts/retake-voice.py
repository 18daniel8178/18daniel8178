"""Repite una línea con otras semillas hasta que la palabra clave aparezca en la transcripción.
Uso (desde video-trading/): python3 scripts/retake-voice.py episodes/<episodio>.json <n_linea> <palabra> [semillas...]"""
import json, os, subprocess, sys, unicodedata

path, n, key = sys.argv[1], int(sys.argv[2]), sys.argv[3]
seeds = [int(s) for s in sys.argv[4:]] or [3, 17, 41, 59]


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def stt(f):
    out = subprocess.run(['curl', '-sS', 'https://api.elevenlabs.io/v1/speech-to-text', '-F', 'model_id=scribe_v1',
                          '-F', 'language_code=spa', '-F', f'file=@{f}'], capture_output=True, text=True).stdout
    return json.loads(out).get('text', '')


ep = json.load(open(path))
mp3 = os.path.join('audio', ep['id'], f'{n:02d}.mp3')
for seed in seeds:
    ep['lines'][n - 1]['seed'] = seed
    open(path, 'w').write(json.dumps(ep, indent=2, ensure_ascii=False) + '\n')
    subprocess.run(['node', 'scripts/generate-voices.mjs', path], capture_output=True,
                   env={**os.environ, 'NODE_USE_ENV_PROXY': '1'})
    txt = stt(mp3)
    print(f'  {ep["id"]} #{n} seed {seed}: {txt}')
    if norm(key) in norm(txt):
        print('  OK')
        sys.exit(0)
print('  SIN ÉXITO (queda la última toma)')
