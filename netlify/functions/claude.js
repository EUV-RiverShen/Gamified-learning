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

  let body;
  try {
    body = await req.text();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Ungültiger Request-Body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Anthropic-API nicht erreichbar: ' + (e.message || e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/claude' };
