// Firebase-Version des Backends — ersetzt die zwei Netlify Functions
// (netlify/functions/claude.js, netlify/functions/storage.js).
//
// - claude:   Proxy zur Anthropic API, hält den API-Key serverseitig (Firebase Secret).
// - storage:  Einfacher Key/Value-Speicher, Firestore statt Netlify Blobs.
//
// Frontend (GitHub Pages) und Backend (Cloud Functions) laufen auf unterschiedlichen
// Domains, daher ist CORS hier nötig — auf ALLOWED_ORIGINS eingeschränkt, damit nicht
// jede beliebige Website diese Functions (und damit den Anthropic-Key) missbrauchen kann.

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Anpassen, falls die GitHub-Pages-URL anders lautet (z.B. eigene Domain) oder für
// lokales Testen (`firebase emulators:start` + `python -m http.server` o.ä.).
const ALLOWED_ORIGINS = [
  'https://euv-rivershen.github.io',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

// Proxy zur Anthropic API — Key liegt nur hier (Firebase Secret), nie im Browser.
exports.claude = onRequest(
  { secrets: [ANTHROPIC_API_KEY], cors: ALLOWED_ORIGINS, timeoutSeconds: 300, memory: '256MiB' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      res.status(500).json({
        error: 'ANTHROPIC_API_KEY ist nicht gesetzt (firebase functions:secrets:set ANTHROPIC_API_KEY).'
      });
      return;
    }

    const payload = req.body || {};
    payload.stream = true;

    try {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
      });

      res.status(upstream.status);
      res.set('Content-Type', upstream.headers.get('content-type') || 'application/json');

      if (!upstream.body) {
        res.end();
        return;
      }
      // Stream 1:1 durchreichen (siehe SSE-Kommentar im Frontend, callClaude()).
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (e) {
      res.status(502).json({ error: 'Anthropic-API nicht erreichbar: ' + (e.message || e) });
    }
  }
);

// Key/Value-Speicher auf Basis von Firestore. Erreichbar als GET/POST auf die
// Function-URL (kein "config.path" wie bei Netlify Functions v2 nötig — Firebase
// vergibt jeder Function ihre eigene URL).
//
// GET  ?key=xyz          -> { value: string|null }
// POST { key, value }    -> { ok: true }
//
// Achtung: keine Nutzer-Trennung/Login — alle Aufrufer teilen sich denselben
// Datensatz. Für rein persönliche Nutzung unproblematisch (siehe README).
exports.storage = onRequest({ cors: ALLOWED_ORIGINS }, async (req, res) => {
  if (req.method === 'GET') {
    const key = req.query.key;
    if (!key) {
      res.status(400).json({ error: 'key fehlt' });
      return;
    }
    const snap = await db.collection('appState').doc(key).get();
    const value = snap.exists ? (snap.data().value ?? null) : null;
    res.status(200).json({ value });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.key) {
      res.status(400).json({ error: 'key fehlt' });
      return;
    }
    await db.collection('appState').doc(body.key).set({ value: body.value ?? '' });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
});
