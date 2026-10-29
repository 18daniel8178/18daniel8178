# Videos animados: "Claude, haz algo" (trading)

Serie de videos verticales para TikTok (1080×1920, 30 fps) en 3D de bloques: un trader
desvelado a las 3:47 a.m. le pide ayuda a Claude con el trading y Claude responde con
calma, con ironía y en susurros (alguien está dormido al otro lado de la puerta).

Todo se genera con código. **Cada video nuevo es solo un archivo de texto con el diálogo.**

## Cómo se hace un video

```bash
npm install                                          # una sola vez
npm run sfx                                          # efectos de sonido (una sola vez)
node scripts/generate-voices.mjs episodes/ep01-bitcoin.json   # voces con ElevenLabs
node scripts/render.mjs episodes/ep01-bitcoin.json            # → out/ep01-bitcoin.mp4
```

- Sin voces generadas, el render usa tiempos estimados y sale solo con efectos (sirve para previsualizar).
- Capturas sueltas para revisar encuadres: `node scripts/render.mjs episodes/ep01-bitcoin.json --stills 1.5,8,20`
- Render en este contenedor: ~1 frame/s (3D por software). En una computadora con GPU es mucho más rápido.
- Para renderizar fuera de este entorno: `npm i -D playwright && npx playwright install chromium`.

## Escribir un episodio nuevo

Copia `episodes/ep01-bitcoin.json`, cambia el `id` y escribe las líneas:

| Campo | Qué hace |
|---|---|
| `who` | `trader` o `claude` |
| `text` | Lo que dice (también es el subtítulo, palabra por palabra). En MAYÚSCULAS = grito susurrado |
| `tag` | Cómo lo dice la voz: `[whispers]`, `[whispers urgently]`, `[whispers loudly, panicking]`… |
| `shot` | Toma: `trader_cu`, `trader_ecu` (zoom de golpe), `claude_cu`, `claude_low`, `screen`, `wide` |
| `face` | Trader: `neutral`, `worried`, `suspicious`, `shocked`, `frozen`. Claude: `neutral`, `proud`, `happy`, `helpful` |
| `emote` | Encima de la cabeza: `question` (??), `sparkle` (✦), `stress` (rayitas) |
| `screen` | Con `shot: "screen"`: `chart`, `course` (anuncio del curso de $499), `crash` (saldo → LIQUIDADO) |
| `cuts` | Cambiar de toma a mitad de la línea: `[{ "fromWord": 1, "shot": "screen", "screen": "course" }]` |
| `shake` | `true` = sacudida de cámara |
| `sfx` | Efecto: `ding`, `whoosh`, `alarm`, `tinnitus` |
| `gesture` | Claude: `pat` (le da palmaditas al trader) |
| `silent` | Segundos de silencio (reacción sin diálogo) |
| `tail` | Segundos extra al final de la línea |

## Voces (ElevenLabs)

Modelo `eleven_v3`, que entiende etiquetas como `[whispers]`. La configuración está en `voices.json`.

Requisitos del entorno:
1. Permitir el dominio `api.elevenlabs.io` en la configuración de red.
2. La clave de ElevenLabs, de una de dos formas:
   - **Network secret** para `api.elevenlabs.io` con encabezado `xi-api-key`, prefijo vacío y la clave como valor
     (con `Authorization`/`Bearer` ElevenLabs responde 401).
   - O la variable de entorno `ELEVENLABS_API_KEY` (sin network secret para ese dominio).
3. Si la salida pasa por un proxy (`HTTPS_PROXY`), corre los scripts con `NODE_USE_ENV_PROXY=1`
   (el `fetch` de Node no usa el proxy por su cuenta).

Escoger las voces (español latinoamericano neutro, susurro):

```bash
node scripts/voices-tool.mjs design trader     # 3 muestras (A, B, C) → audio/voice-design/trader/
node scripts/voices-tool.mjs design claude
node scripts/voices-tool.mjs save B trader     # guarda la elegida en tu cuenta y en voices.json
# o buscar en la biblioteca pública:
node scripts/voices-tool.mjs list whisper
```

Los audios quedan en `audio/<episodio>/` (se guardan en git para no gastar créditos otra vez).

## Estructura

```
episodes/        guiones (un JSON por video)
src/             escena 3D (three.js): personajes, cuarto, pantallas, tomas, subtítulos
page/            página que se renderiza en Chromium sin ventana
scripts/         timeline, voces, efectos y render (Playwright + ffmpeg)
assets/sfx/      efectos sintetizados (sin licencias de terceros)
audio/           voces generadas
```
