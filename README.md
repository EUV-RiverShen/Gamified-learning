# Questlines — Netlify-Deployment

Diese App lief bisher als Claude.ai-Artefakt (`window.storage` + direkter API-Call).
Diese Version läuft eigenständig auf Netlify:

- **Frontend:** `public/index.html` — die App selbst, unverändert bis auf zwei Stellen:
  Storage-Calls gehen jetzt an `/api/storage`, KI-Calls an `/api/claude`.
- **`netlify/functions/claude.js`** — Proxy zur Anthropic API. Hält den API-Key serverseitig
  (Environment Variable), der Browser bekommt ihn nie zu Gesicht.
- **`netlify/functions/storage.js`** — einfacher Key/Value-Speicher auf Basis von
  **Netlify Blobs** (in jeder Netlify-Site automatisch verfügbar, keine separate
  Datenbank nötig — siehe Erklärung unten).

## Setup

1. **Repo/Ordner zu Netlify pushen** (per Git-Verbindung oder `netlify deploy` per CLI).
2. **Environment Variable setzen:** Site settings → Environment variables →
   `ANTHROPIC_API_KEY` = dein Anthropic-API-Key. Ohne den läuft `/api/claude` nicht.
3. Fertig — `netlify.toml` ist schon so konfiguriert, dass `public/` als Site
   ausgeliefert wird und die Functions automatisch unter `/api/claude` und
   `/api/storage` erreichbar sind (die Functions deklarieren ihren Pfad selbst
   über `config.path`, keine manuellen Redirects nötig).

Lokal testen: `netlify dev` (Netlify CLI) — simuliert Functions + Blobs lokal.

## Wichtiger Hinweis: keine Nutzer-Trennung

`storage.js` speichert alles unter einem festen Key (`mg_v4`) — **jeder Besucher der
Seite sieht/bearbeitet denselben Datensatz**, es gibt kein Login. Für rein persönliche
Nutzung (du bist der einzige Nutzer) ist das unproblematisch. Falls die URL aber
öffentlich erreichbar ist und du das nicht willst:

- Einfachste Lösung: **Netlify Password Protection** aktivieren (Site settings →
  Visitor access) — schützt die ganze Seite mit einem Passwort, kein Code nötig.
- Für "echte" Mehrbenutzer-Fähigkeit bräuchte es eigentlich Auth (z.B. Netlify Identity
  oder ein anderer Login-Anbieter) und pro Nutzer eigene Storage-Keys — das ist aktuell
  bewusst nicht gebaut, wäre aber ein überschaubarer nächster Schritt.

## Warum Netlify Blobs (und nicht Cloudflare)?

Netlify Blobs ist ein Zero-Config-Key/Value-Speicher, der in jeder Netlify-Site von Haus
aus verfügbar ist — kein separates Datenbank-Setup, keine zweite Plattform, kein
Schema nötig. Das passt exakt auf das, was diese App braucht: ein einzelner JSON-Blob
pro Speicher-Key, genau wie vorher bei `window.storage`.

Cloudflare (Workers KV / D1) wäre technisch genauso möglich und in mancher Hinsicht
mächtiger (breiteres Ökosystem, D1 ist eine echte SQL-Datenbank), aber dafür bräuchtest
du einen zweiten Account/eine zweite Plattform — für diesen Anwendungsfall (ein simples
Get/Set eines JSON-Objekts, keine relationalen Abfragen, kein Multi-Tenant-Bedarf) ist
das ein Mehraufwand ohne echten Vorteil. Bleib bei Netlify, solange alles auf einer
Plattform bleiben soll.

## PDF.js

Die PDF-Text-Extraktion läuft weiterhin komplett im Browser über die PDF.js-CDN
(`cdnjs.cloudflare.com`) — das ist unabhängig vom Hosting und braucht keine Anpassung.
