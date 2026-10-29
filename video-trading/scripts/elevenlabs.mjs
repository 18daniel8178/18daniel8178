// Cliente mínimo de la API de ElevenLabs.
// La clave se lee de ELEVENLABS_API_KEY. Si el entorno inyecta la credencial
// por red (network secret) para api.elevenlabs.io, también funciona sin la variable.
const BASE = 'https://api.elevenlabs.io';

export async function eleven(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (process.env.ELEVENLABS_API_KEY) headers['xi-api-key'] = process.env.ELEVENLABS_API_KEY;
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error(
      `No hay conexión con api.elevenlabs.io (${e.cause?.code || e.message}).\n` +
        'Hay que permitir el dominio api.elevenlabs.io en la configuración de red del entorno.'
    );
  }
  const text = await res.text();
  if (!res.ok) {
    const hint = res.status === 401 ? ' → revisa la clave ELEVENLABS_API_KEY' : '';
    throw new Error(`ElevenLabs ${method} ${path}: HTTP ${res.status}${hint}\n${text.slice(0, 600)}`);
  }
  return text ? JSON.parse(text) : {};
}
