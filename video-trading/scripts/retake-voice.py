"""Repite una línea con otras semillas hasta que la palabra clave aparezca en la transcripción.
Uso (desde video-trading/): python3 scripts/retake-voice.py episodes/<episodio>.json <n_linea> <palabra> [semillas...]"""
import json, os, subprocess, sys, unicodedata


def auth_header():
    """Cabecera xi-api-key por stdin (curl -H @-) para no dejar la clave en la línea de comandos.
    Sin ELEVENLABS_API_KEY queda vacía: el entorno con network secret la inyecta solo."""
    api_key = os.environ.get('ELEVENLABS_API_KEY', '')
    return f'xi-api-key: {api_key}\n' if api_key else ''

path, n, key = sys.argv[1], int(sys.argv[2]), sys.argv[3]
seeds = [int(s) for s in sys.argv[4:]] or [3, 17, 41, 59]


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def stt(f):
    out = subprocess.run(['curl', '-sS', '-H', '@-', 'https://api.elevenlabs.io/v1/speech-to-text', '-F', 'model_id=scribe_v1',
                          '-F', 'language_code=spa', '-F', f'file=@{f}'], input=auth_header(), capture_output=True,
                         text=True, encoding='utf-8').stdout
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
