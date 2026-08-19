# Questlines — GitHub-Pages-Deployment

Diese App lief bisher als Claude.ai-Artefakt (`window.storage` + direkter API-Call),
danach eigenständig auf Netlify. Diese Version trennt Frontend und Backend:

- **Frontend:** `public/index.html` — die App selbst, per GitHub Actions automatisch
  auf **GitHub Pages** deployt. Storage- und KI-Calls gehen an eine feste Backend-URL
  (`API_BASE`-Konstante oben im `<script>`), nicht mehr an relative `/api/...`-Pfade —
  GitHub Pages liefert nur statische Dateien, kein eigenes Backend.
- **`workers/src/index.js`** — ein einzelner Cloudflare Worker, ersetzt die alten
  Netlify Functions bzw. das kurzzeitige Firebase-Backend:
  - `POST /claude` — Proxy zur Anthropic API, hält den API-Key serverseitig (Worker
    Secret), der Browser bekommt ihn nie zu Gesicht.
  - `GET/POST /storage` — einfacher Key/Value-Speicher auf Basis von **Cloudflare
    KV** (ersetzt zunächst Netlify Blobs, dann kurzzeitig Firestore).

## Warum zwei Plattformen (GitHub Pages + Cloudflare)?

GitHub Pages hostet ausschließlich statische Dateien — keine Server-Functions, keine
Environment Variables/Secrets. Die App braucht aber beides (API-Key serverseitig
verstecken, geteilten Speicher). Deshalb: **Frontend auf GitHub Pages, Backend auf
Cloudflare** (Workers + KV).

> **Hinweis Kosten/Sicherheit:** Backend lief zwischenzeitlich auf **Firebase**
> (Cloud Functions + Firestore), wurde aber wieder verworfen: Cloud Functions mit
> ausgehenden Requests an fremde APIs (hier `api.anthropic.com`) brauchen zwingend
> den **Blaze-Plan** — postpaid, kein hartes Limit, Kreditkarte muss hinterlegt
> werden, auch wenn am Ende nichts abgerechnet wird. Cloudflare Workers laufen im
> **kostenlosen Tarif ganz ohne hinterlegte Zahlungsmethode** und setzen ihr
> Freikontingent (100.000 Requests/Tag) hart durch — Anfragen darüber hinaus werden
> abgelehnt statt abgerechnet. Für eine einzelne Person bleibt es damit strukturell
> unmöglich, unabsichtlich eine Rechnung zu bekommen.

## Setup

### 1. Cloudflare-Backend

Voraussetzung: [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
installiert (`npm install -g wrangler`) und ein Cloudflare-Account (kostenlos, keine
Zahlungsmethode nötig).

```bash
cd workers
wrangler login

# Einmalig einen KV-Namespace anlegen und die ausgegebene id in wrangler.toml
# eintragen (Platzhalter/Beispiel-id dort ersetzen):
wrangler kv namespace create APP_STATE

# Anthropic-Key als Secret hinterlegen (Prompt fragt nach dem Wert):
wrangler secret put ANTHROPIC_API_KEY

# Worker deployen:
wrangler deploy
```

Nach dem Deploy gibt die CLI die Worker-URL aus, z.B.:
```
https://gamified-learning-api.<dein-cloudflare-name>.workers.dev
```

Diese URL (ohne `/claude` bzw. `/storage`) in `public/index.html` bei der
`API_BASE`-Konstante eintragen.

**CORS:** `workers/src/index.js` erlaubt standardmäßig nur
`https://euv-rivershen.github.io` (+ `localhost:5000` für lokales Testen). Falls die
GitHub-Pages-URL abweicht (eigene Domain, anderer Org-/User-Name), `ALLOWED_ORIGINS`
in `workers/src/index.js` entsprechend anpassen und neu deployen.

### 2. GitHub Pages (Frontend)

Einmalig in den Repo-Settings: **Settings → Pages → Source → "GitHub Actions"**
auswählen. Der Workflow `.github/workflows/pages.yml` deployt danach bei jedem Push
auf `main` automatisch `public/` nach GitHub Pages (auch manuell auslösbar über
"Run workflow" im Actions-Tab).

Die Seite ist danach erreichbar unter `https://<org>.github.io/<repo>/`.

## Lokal testen

Backend: `wrangler dev` im `workers/`-Ordner (simuliert den Worker lokal — dafür
`API_BASE` temporär auf die dabei ausgegebene `localhost`-URL zeigen lassen).
Frontend: `public/index.html` braucht keinen Build-Schritt, jeder simple statische
Webserver reicht (z.B. `python3 -m http.server` im `public/`-Ordner).

## Wichtiger Hinweis: keine Nutzer-Trennung

Die `/storage`-Route speichert alles unter einem festen Key (`mg_v4`) — **jeder
Aufrufer sieht/bearbeitet denselben Datensatz**, es gibt kein Login. Für rein
persönliche Nutzung (du bist der einzige Nutzer) ist das unproblematisch. Die
CORS-Einschränkung auf die eigene GitHub-Pages-Domain (siehe oben) schützt
Browser-Aufrufe, verhindert aber keine direkten Skript-/curl-Zugriffe auf die
Worker-URL — wer die URL kennt, kann `/claude` direkt ansprechen und damit
Anthropic-API-Kosten auf dem hinterlegten Key verursachen. Für reinen
Eigengebrauch ist das Risiko gering, aber bei Bedarf ließe sich das mit einem
selbst gewählten Shared Secret (Header-Check im Worker) weiter absichern.

## Geplanter nächster Schritt: strukturierte KV-Keys/D1

Aktuell liegt der komplette App-Zustand als ein großer JSON-Blob unter einem
KV-Key (`mg_v4`) — die einfachste Migration vom alten Blob-Modell. Für die im
Konzept (`docs/KONZEPT_UEBERGABE.md`) angedachte Minecraft-Integration (Java-Plugin
braucht gezielten Zugriff auf einzelne Datensätze statt immer den kompletten Blob zu
laden) ist mittelfristig ein Aufbrechen in echte Datensätze (Module, Kapitel,
Unterkapitel, Questgeber, Fortschritt) sinnvoll — dafür kommt entweder weiterhin KV
mit mehreren Keys infrage, oder bei Bedarf für relationale Abfragen **Cloudflare D1**
(SQLite-basiert, ebenfalls im kostenlosen Tarif ohne Zahlungsmethode nutzbar).

## PDF.js

Die PDF-Text-Extraktion läuft weiterhin komplett im Browser über die PDF.js-CDN
(`cdnjs.cloudflare.com`) — das ist unabhängig vom Hosting und braucht keine Anpassung.
