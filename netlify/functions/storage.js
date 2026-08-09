// Ersetzt window.storage (Claude.ai-Artefakt-API) durch einen simplen Key/Value-Endpunkt
// auf Basis von Netlify Blobs. Erreichbar unter /api/storage (siehe "config.path" unten).
//
// GET  /api/storage?key=xyz          -> { value: string|null }
// POST /api/storage  { key, value }  -> { ok: true }
//
// Achtung: Es gibt hier keine Nutzer-Trennung/Login — alle Besucher der Seite teilen
// sich denselben Datensatz. Für eine rein persönlich genutzte Deployment ist das okay,
// für alles andere: Netlify-Passwortschutz (Site settings → Visitor access) aktivieren
// oder eine eigene Auth-Prüfung hier in der Function ergänzen.

import { getStore } from '@netlify/blobs';

export default async (req) => {
  const store = getStore({ name: 'app-state', consistency: 'strong' });
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const key = url.searchParams.get('key');
    if (!key) {
      return new Response(JSON.stringify({ error: 'key fehlt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const value = await store.get(key);
    return new Response(JSON.stringify({ value: value ?? null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Ungültiges JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!body.key) {
      return new Response(JSON.stringify({ error: 'key fehlt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    await store.set(body.key, body.value ?? '');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/storage' };
