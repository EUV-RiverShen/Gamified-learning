// Cloudflare-Worker-Version des Backends — ersetzt die Firebase-Functions
// (functions/index.js: claude, storage), die wiederum die Netlify Functions
// ersetzt hatten. Grund für den Wechsel: Firebase Cloud Functions (2nd Gen)
// + Secret Manager erfordern zwingend den Blaze-Tarif (Kreditkarte, "pay as
// you go", kein hartes Limit). Cloudflare Workers laufen im Free-Tier ganz
// ohne hinterlegte Zahlungsmethode — Limits werden hart durchgesetzt
// (Anfragen schlagen fehl statt abgerechnet zu werden).
//
// Ein Worker, zwei Routen (Pfad-basiert statt getrennter Function-URLs):
//   POST /claude   -> Proxy zur Anthropic API, Key als Worker Secret
//   GET/POST /storage -> Key/Value-Speicher, Cloudflare KV statt Firestore
//
// Frontend (GitHub Pages) und Worker laufen auf unterschiedlichen Domains,
// daher CORS hier nötig — auf ALLOWED_ORIGINS eingeschränkt, damit nicht
// jede beliebige Website diesen Worker (und damit den Anthropic-Key)
// missbrauchen kann. CORS schützt aber nur Browser-Aufrufe, keine direkten
// Skript-/curl-Zugriffe auf die Worker-URL (siehe README).

// Anpassen, falls die GitHub-Pages-URL anders lautet (z.B. eigene Domain)
// oder für lokales Testen (`wrangler dev` + `python -m http.server` o.ä.).
const ALLOWED_ORIGINS = [
  'https://euv-rivershen.github.io',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

function corsHeaders(origin) {
  const headers = { Vary: 'Origin' };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return headers;
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

async function handleClaude(request, env, origin) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin);
  }

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { error: 'ANTHROPIC_API_KEY ist nicht gesetzt (wrangler secret put ANTHROPIC_API_KEY).' },
      500,
      origin
    );
  }

  const payload = await request.json().catch(() => ({}));
  payload.stream = true;

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return json({ error: 'Anthropic-API nicht erreichbar: ' + (e.message || e) }, 502, origin);
  }

  // Stream 1:1 durchreichen (siehe SSE-Kommentar im Frontend, callClaude()).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      ...corsHeaders(origin)
    }
  });
}

// Key/Value-Speicher auf Basis von Cloudflare KV. Erreichbar als GET/POST
// unter /storage.
//
// GET  ?key=xyz          -> { value: string|null }
// POST { key, value }    -> { ok: true }
//
// Achtung: keine Nutzer-Trennung/Login — alle Aufrufer teilen sich denselben
// Datensatz. Für rein persönliche Nutzung unproblematisch (siehe README).
async function handleStorage(request, env, origin) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const key = url.searchParams.get('key');
    if (!key) return json({ error: 'key fehlt' }, 400, origin);
    const value = await env.APP_STATE.get(key);
    return json({ value: value ?? null }, 200, origin);
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (!body.key) return json({ error: 'key fehlt' }, 400, origin);
    await env.APP_STATE.put(body.key, body.value ?? '');
    return json({ ok: true }, 200, origin);
  }

  return json({ error: 'Method not allowed' }, 405, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const { pathname } = new URL(request.url);
    if (pathname === '/claude') return handleClaude(request, env, origin);
    if (pathname === '/storage') return handleStorage(request, env, origin);

    return json({ error: 'Not found' }, 404, origin);
  }
};
