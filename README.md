# Questlines — GitHub-Pages-Deployment

Diese App lief bisher als Claude.ai-Artefakt (`window.storage` + direkter API-Call),
danach eigenständig auf Netlify. Diese Version trennt Frontend und Backend:

- **Frontend:** `public/index.html` — die App selbst, per GitHub Actions automatisch
  auf **GitHub Pages** deployt. Storage- und KI-Calls gehen an eine feste Backend-URL
  (`API_BASE`-Konstante oben im `<script>`), nicht mehr an relative `/api/...`-Pfade —
  GitHub Pages liefert nur statische Dateien, kein eigenes Backend.
- **`functions/index.js`** — Firebase Cloud Functions, ersetzen die alten Netlify
  Functions:
  - `claude` — Proxy zur Anthropic API, hält den API-Key serverseitig (Firebase
    Secret), der Browser bekommt ihn nie zu Gesicht.
  - `storage` — einfacher Key/Value-Speicher auf Basis von **Firestore** (ersetzt
    Netlify Blobs).

## Warum zwei Plattformen (GitHub Pages + Firebase)?

GitHub Pages hostet ausschließlich statische Dateien — keine Server-Functions, keine
Environment Variables/Secrets. Die App braucht aber beides (API-Key serverseitig
verstecken, geteilten Speicher). Deshalb: **Frontend auf GitHub Pages, Backend auf
Firebase** (Cloud Functions + Firestore).

> **Hinweis Kosten:** Cloud Functions mit ausgehenden Requests an fremde APIs (hier:
> `api.anthropic.com`) brauchen den **Blaze-Plan** (Pay-as-you-go) — der kostenlose
> Spark-Plan erlaubt das nicht. Blaze hat aber ein großzügiges kostenloses Kontingent
> (u.a. 2 Mio. Function-Aufrufe/Monat); für eine einzelne Person fällt in der Regel
> nichts an. Eine Kreditkarte muss trotzdem hinterlegt werden.

## Setup

### 1. Firebase-Backend

Voraussetzung: [Firebase CLI](https://firebase.google.com/docs/cli) installiert
(`npm install -g firebase-tools`) und ein Firebase-Projekt (Blaze-Plan) angelegt.

```bash
firebase login

# Projekt-ID in .firebaserc eintragen (Platzhalter "DEIN-FIREBASE-PROJEKT-ID" ersetzen)

# Firestore einmalig im Projekt aktivieren (Firebase Console oder):
firebase firestore:databases:create --location=eur3   # Region nach Bedarf wählen

# Anthropic-Key als Secret hinterlegen (Prompt fragt nach dem Wert):
firebase functions:secrets:set ANTHROPIC_API_KEY

# Functions + Firestore-Regeln deployen:
firebase deploy --only functions,firestore:rules
```

Nach dem Deploy gibt die CLI die Function-URLs aus, z.B.:
```
https://europe-west1-dein-projekt.cloudfunctions.net/claude
https://europe-west1-dein-projekt.cloudfunctions.net/storage
```

Den gemeinsamen Basisteil (ohne `/claude` bzw. `/storage`) in `public/index.html` bei
der `API_BASE`-Konstante eintragen.

**CORS:** `functions/index.js` erlaubt standardmäßig nur
`https://euv-rivershen.github.io` (+ `localhost:5000` für lokales Testen). Falls die
GitHub-Pages-URL abweicht (eigene Domain, anderer Org-/User-Name), `ALLOWED_ORIGINS`
in `functions/index.js` entsprechend anpassen und neu deployen.

### 2. GitHub Pages (Frontend)

Einmalig in den Repo-Settings: **Settings → Pages → Source → "GitHub Actions"**
auswählen. Der Workflow `.github/workflows/pages.yml` deployt danach bei jedem Push
auf `main` automatisch `public/` nach GitHub Pages (auch manuell auslösbar über
"Run workflow" im Actions-Tab).

Die Seite ist danach erreichbar unter `https://<org>.github.io/<repo>/`.

## Lokal testen

Backend: `firebase emulators:start` (simuliert Functions + Firestore lokal — dafür
`API_BASE` temporär auf die Emulator-URL zeigen lassen).
Frontend: `public/index.html` braucht keinen Build-Schritt, jeder simple statische
Webserver reicht (z.B. `python3 -m http.server` im `public/`-Ordner).

## Wichtiger Hinweis: keine Nutzer-Trennung

`storage`-Function speichert alles unter einem festen Key (`mg_v4`) — **jeder
Aufrufer sieht/bearbeitet denselben Datensatz**, es gibt kein Login. Für rein
persönliche Nutzung (du bist der einzige Nutzer) ist das unproblematisch. Die
CORS-Einschränkung auf die eigene GitHub-Pages-Domain (siehe oben) verhindert
zumindest, dass fremde Websites den Endpunkt (und damit indirekt den Anthropic-Key)
missbrauchen.

## Geplanter nächster Schritt: strukturierte Firestore-Collections

Aktuell liegt der komplette App-Zustand als ein großer JSON-Blob unter einem
Firestore-Dokument (`appState/mg_v4`) — die einfachste Migration vom alten
Blob-Modell. Für die im Konzept (`docs/KONZEPT_UEBERGABE.md`) angedachte
Minecraft-Integration (Java-Plugin braucht gezielten Zugriff auf einzelne
Datensätze statt immer den kompletten Blob zu laden) ist mittelfristig ein Aufbrechen
in echte Collections (Module, Kapitel, Unterkapitel, Questgeber, Fortschritt)
sinnvoll — dafür eignet sich Firestore direkt (keine zusätzliche DB-Migration nötig,
anders als beim ursprünglich angedachten Umstieg auf Neon/Postgres).

## PDF.js

Die PDF-Text-Extraktion läuft weiterhin komplett im Browser über die PDF.js-CDN
(`cdnjs.cloudflare.com`) — das ist unabhängig vom Hosting und braucht keine Anpassung.
