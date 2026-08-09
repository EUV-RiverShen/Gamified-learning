// Proxy zur Anthropic API — hält den API-Key serverseitig (nie im Browser sichtbar).
// Erreichbar unter /api/claude (siehe "config.path" unten).

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY ist auf Netlify nicht gesetzt (Site settings → Environment variables).' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let payload;
  try {
    payload = JSON.parse(await req.text());
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Ungültiger Request-Body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Streaming erzwingen: Netlify killt Functions ohne Datenfluss nach kurzer Zeit
  // ("Inactivity Timeout"). Bei größeren Anfragen (z.B. Kernpunkte-Extraktion aus
  // einem ganzen Kapitel) braucht Claude oft länger — solange aber laufend Bytes
  // fließen, greift der Timeout nicht. Das Frontend liest den Stream in callClaude().
  payload.stream = true;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
    // Fehler (ungültiger Key, Rate-Limit, ...) kommen von Anthropic nicht gestreamt,
    // sondern als normale JSON-Antwort — resp.body 1:1 durchreichen deckt beides ab,
    // das Frontend unterscheidet über resp.ok.
    return new Response(resp.body, {
      status: resp.status,
      headers: { 'Content-Type': resp.headers.get('content-type') || 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Anthropic-API nicht erreichbar: ' + (e.message || e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/claude' };
