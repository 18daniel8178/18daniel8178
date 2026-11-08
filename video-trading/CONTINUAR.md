# Continuar el proyecto en otra sesión

Prompt para pegar en una sesión nueva:

> Continúa el proyecto de videos animados de trading en la carpeta `video-trading/` del repo
> `18daniel8178/18daniel8178`, rama `claude/animated-trading-video-spanish-p1fhq0` (haz checkout de esa
> rama, trabaja ahí y sube ahí). Lee primero `video-trading/CONTINUAR.md` y `video-trading/README.md`:
> ahí está cómo funciona todo, el estado de cada episodio, las reglas de estilo y lo que falta.
> Los diálogos nuevos me los muestras antes de producirlos y yo los apruebo.

---

## Qué es

Serie de videos verticales para TikTok (1080×1920, 30 fps, ~28-36 s) en 3D de bloques, hechos 100 % con
código (three.js + Playwright + ffmpeg) y voces de ElevenLabs. Un trader desvelado de madrugada le pide
ayuda a **Claude** (bloque naranja con lentes y moñito) y Claude responde tranquilo, irónico y en susurros,
porque alguien ("ella") duerme detrás de la puerta. Desde el episodio 14 aparece **ChatGPT** (parodia).

Cada episodio es un JSON en `episodes/`. El README explica todos los campos (tomas, caras, pantallas, etc.).

## Estado de los episodios

| Ep | Archivo | Título | Hora | Estado |
|---|---|---|---|---|
| 1 | ep01-bitcoin | Claude, haz algo | 3:47 | ✅ renderizado y entregado |
| 2 | ep02-apalancamiento | Antes de que despierte | 4:13 | ✅ |
| 3 | ep03-millonario | Cómo ser millonario | 4:38 | ✅ |
| 4 | ep04-patron | El patrón | 5:02 | ✅ |
| 5 | ep05-diversificar | Diversificar | 5:08 | ✅ |
| 6 | ep06-perrocohete | PerroCohete | 5:14 | ✅ |
| 7 | ep07-senales | Señales VIP | 5:19 | ✅ |
| 8 | ep08-stop-mental | Stop loss mental | 5:24 | ✅ |
| 9 | ep09-desperto | Ella despertó (final de la 1.ª noche) | 5:31 | ✅ |
| 10 | ep10-experiencia | Ganaste experiencia (otra noche, idea del usuario) | 2:58 | ✅ |
| 11 | ep11-que-corra | Que corra | 3:10 | ✅ |
| 12 | ep12-constante | Muy constante | 3:25 | ✅ |
| 13 | ep13-renuncio | Renuncio | 3:41 | ✅ |
| 14 | ep14-el-nuevo | El nuevo (presenta a ChatGPT) | 3:58 | ⏳ guion aprobado, falta la voz de ChatGPT |
| 15 | ep15-segun-un-estudio | Según un estudio (ChatGPT) | 4:12 | ⏳ guion aprobado, falta la voz de ChatGPT |

Los MP4 se generan en `out/` y **no están en git** (`out/` está en `.gitignore`): si el contenedor se
borra, se vuelven a renderizar con `node scripts/render.mjs episodes/<ep>.json` (todo lo demás está en git:
guiones, voces generadas, código).

## Lo siguiente que falta

1. **Voz de ChatGPT**: el usuario tiene que elegir una de las 6 muestras de
   `audio/voice-design/gpt-hombre/` y `audio/voice-design/gpt-mujer/` (A, B, C). Notas: *hombre A* dice algo
   como "ChapGPT"; *hombre C* repite "Soy ChatGPT" y se salta una frase; las otras están completas.
   Si hace falta volver a mandarlas, usa la herramienta para enviar archivos al usuario.
2. Guardar la elegida: `node scripts/voices-tool.mjs save <A|B|C> gpt <hombre|mujer>` (crea la voz en la
   cuenta y escribe `gpt.voice_id` en `voices.json`).
3. Episodios 14 y 15: generar voces → revisar → capturas → render → mandar → commit (ver "Flujo").
4. Proponer más diálogos (el usuario los aprueba antes de producir).

## Entorno (importante)

- **ElevenLabs**: la clave va como *network secret* del entorno para `api.elevenlabs.io` con encabezado
  **`xi-api-key`**, prefijo vacío (con `Authorization: Bearer` ElevenLabs responde 401).
  Plan Starter: 40 000 caracteres/mes; llevamos ~3 600. Cada episodio gasta ~350-400 caracteres más
  repeticiones. Si se acaban los créditos, pausar.
- Los scripts de Node necesitan **`NODE_USE_ENV_PROXY=1`** para pasar por el proxy del entorno.
- Chromium y Playwright ya vienen instalados en el contenedor. `npm install` una vez.
- Render ≈ 1 frame/s (3D por software): un episodio de 30 s tarda ~15 min y usa los 4 núcleos, así que
  se renderiza **uno a la vez** (en segundo plano) y se manda cada video al terminar.

## Flujo por episodio

```bash
cd video-trading
export NODE_USE_ENV_PROXY=1
node scripts/generate-voices.mjs episodes/epXX-nombre.json      # voces (recorta silencios solo)
python3 scripts/check-voices.py episodes/epXX-nombre.json         # transcribe y compara con el guion
python3 scripts/retake-voice.py episodes/epXX-nombre.json 7 hacia # repetir línea 7 hasta oír "hacia"
node scripts/render.mjs episodes/epXX-nombre.json --stills 1,5.2,9  # capturas para revisar encuadres
node scripts/render.mjs episodes/epXX-nombre.json                 # → out/epXX-nombre.mp4
```

Revisión que se hizo en cada episodio:
- **Voces**: `check-voices.py`. Scribe (la transcripción) se equivoca con palabras sueltas susurradas
  ("Hecho" → "Eso"); el script las prueba en contexto. Para confirmar de verdad, repetir con
  `retake-voice.py` hasta que la palabra clave aparezca. Descartar tomas con acento rioplatense
  ("comprás", "bajá"): el español debe ser neutro. La semilla elegida queda en el JSON (`seed`).
- **Imagen**: capturas a mitad de cada línea y en cada pantalla (`--stills`), y al final una tira de
  cuadros del MP4 con ffmpeg (`select=eq(n\,X)+…,tile=10x1`) para ver que salgan los personajes, las
  caras, el reloj y las pantallas.
- **Audio**: volumen final ≈ -16 LUFS (ffmpeg `ebur128`).

## Estilo de la serie (reglas que se fueron acordando)

- Todo en **susurros** (`[whispers]`); los gritos susurrados van en MAYÚSCULAS con
  `[whispers loudly, panicking]`. Números escritos en letra en el texto ("cuatrocientos noventa y nueve").
- Cada episodio **abre con el plano de los dos juntos** (`shot: "wide"`, o `"wide3"` si sale ChatGPT)
  y corta al primer plano del trader a mitad de la primera línea (`cuts`).
- Cierra con **"Tranquilo. …"** de Claude en el plano general, con palmaditas (`gesture: "pat"`).
- Antes del cierre, una pausa sin diálogo del trader (`silent`) con su reacción.
- **Reacciones del trader variadas según el tema**: `hopeful` (ilusionado), `disappointed` (decepcionado),
  `meh` (-.- con `emote: "dots"`), `shocked`, `frozen`. La cara `suspicious` (parece guiño) **máximo una vez
  por episodio** (lo pidió el usuario).
- **Ironía de Claude** (el tono que más le gusta al usuario, ver ep10): le da la razón, valida, pero no se
  hace responsable ("es tu decisión", "esto no es asesoría financiera") y reencuadra la pérdida
  ("ganaste experiencia"). Remates que cuadren con lo que se ve en pantalla.
- Callbacks que ya existen: el curso de $499 "Trader Millonario", PerroCohete, "ella" dormida, el cuñado,
  "ganaste experiencia", "muy constante".
- **ChatGPT** (parodia, diseño propio, **sin el logo de OpenAI**): bloque blanco con cara de pantalla y
  antena, subtítulos turquesa. **No susurra** (habla fuerte y lo callan). Muletillas: "¡Excelente pregunta!",
  listas eternas, "¡Tienes toda la razón! Me disculpo" (cambia de opinión si le dicen "¿seguro?"), inventa
  estudios, "Como modelo de lenguaje no puedo darte asesoría… ¡pero aquí tienes cinco monedas!",
  "¿Quieres que te lo haga en una tabla?". Caras: `happy`, `excited`, `sorry`, `thinking`.

## Trampas conocidas

- `pgrep -f "texto"` encuentra también la propia shell que lo ejecuta: no usarlo para esperar a otro
  proceso (una cola se quedó colgada por eso).
- En bucles `while read …` llamar a node con `< /dev/null` (si no, se come la entrada del bucle).
- El contenedor puede reiniciarse y relanzar un render en segundo plano: revisar el progreso antes de
  asumir que terminó.
- Para mandar los videos al usuario se usa la herramienta de enviar archivos (no hay otra forma de
  descargarlos desde el contenedor).
