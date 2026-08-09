# Übergabe-Konzept: Gamifizierte Lern-App + Minecraft-Integration

Diese Datei fasst den kompletten aktuellen Planungsstand zusammen — als Kontext für eine neue Claude-Code-Session. Die dazugehörige Web-App (`lern_app_v4.html`) liegt bei und sollte 1:1 als Referenz für das bestehende Datenmodell/die Logik dienen, bevor irgendwas Neues gebaut wird.

---

## 1. Vision

Eine gamifizierte Lern-App für ein DHfPG-Studium (Sport-/Gesundheitsmanagement), die Studienbriefe (PDF) automatisch in eine Skilltree-Struktur mit KI-generierten, fallbasierten Lern-Quests zerlegt. Zusätzlich soll das Ganze in Minecraft "entdeckbar" gemacht werden: NPCs in der Spielwelt geben Zugang zu Quests und Erklärungen, die eigentliche Quest-Bearbeitung bleibt aber auf der Web-App/Website.

**Kernprinzip der Quests:** Kein Wissen wird als reine Erklärung + Abschlussaufgabe präsentiert. Jede Quest ist ein Fall/Szenario, das den Stoff *anwenden* statt nur *wiedergeben* lässt.

---

## 2. Web-App — aktueller Stand (siehe `lern_app_v4.html`)

### 2.1 Tech-Stack & Rahmenbedingungen
- Einzelne HTML-Datei (HTML+CSS+JS inline), Claude.ai-Artefakt-kompatibel
- Persistenz: `window.storage` (Claude.ai-intern) — mit `// NETLIFY-SWAP`-Kommentaren im Code markiert, wo für einen eigenen Server `localStorage`/eigene API stattdessen reinkäme
- KI-Anbindung: direkter Call an `https://api.anthropic.com/v1/messages`, Modell `claude-sonnet-4-6`, Key wird von Claude.ai injiziert (kein eigener Key im Code)
- **Wichtig für Minecraft-Integration:** `window.storage` ist von einem Java-Plugin aus nicht erreichbar — dafür wird ein eigener kleiner Backend-Server nötig (siehe Abschnitt 4).
- Native Browser-Dialoge (`confirm()`, `alert()`) funktionieren in der Claude.ai-Artefakt-Sandbox NICHT zuverlässig — die App hat deshalb eigene Overlay-Dialoge (`showConfirmDialog`, `showAlertDialog`) statt der nativen Funktionen. Bei einer eigenständigen Web-Version (außerhalb des Artefakts) wäre das kein Problem mehr, aber die eigenen Dialoge können trotzdem bleiben.

### 2.1a Aktueller Deployment-Stand (Netlify) — bereits umgesetzt, im Repo enthalten
Die App läuft mittlerweile NICHT mehr nur als Claude.ai-Artefakt, sondern zusätzlich eigenständig auf Netlify:
- `public/index.html` — die App, Storage-Calls gehen an `/api/storage`, KI-Calls an `/api/claude` (die alten `NETLIFY-SWAP`-Kommentare sind an diesen zwei Stellen bereits eingelöst).
- `netlify/functions/claude.js` — Proxy zur Anthropic API, hält den Key serverseitig (Environment Variable `ANTHROPIC_API_KEY`).
- `netlify/functions/storage.js` — **aktuell noch auf Basis von Netlify Blobs** (Zero-Config-Key/Value-Store, funktioniert, ist aber nur ein einzelner JSON-Blob unter dem Key `mg_v4`, keine echte Datenbank).
- `netlify.toml` + `package.json` — fertige Konfiguration (Functions v2, `config.path` statt manueller Redirects).
- **Deploy-Hinweis:** Netlify Drop (reines Drag & Drop) funktioniert NICHT für dieses Projekt — es deployed keine Functions. Nötig ist entweder ein Git-verbundenes Repo (empfohlen, automatischer Deploy bei jedem Push) oder die Netlify CLI (`netlify deploy --prod`).

### 2.1b Geplante Ablösung: Netlify Blobs → Neon (Postgres) — NÄCHSTER SCHRITT, noch nicht umgesetzt
Entscheidung (aus Gesprächen nach dem ersten Netlify-Deploy): **Netlify Blobs wird durch eine echte Datenbank ersetzt — Neon (serverless Postgres).**

Begründung:
- Es gibt jetzt zwei sehr unterschiedliche Clients, die auf denselben Datenbestand zugreifen müssen: die Netlify Function (Node.js) UND später das Minecraft-Plugin (Java). Ein simpler Key/Value-Blob passt dafür schlechter als eine echte, strukturierte DB.
- **Postgres + JDBC ist der mit Abstand ausgetretenste Pfad für Minecraft-Plugin-Entwicklung** (HikariCP + JDBC-Treiber gegen MySQL/Postgres ist Standard in praktisch jedem datenbankgestützten Plugin) — deutlich weniger Neuland als z.B. Turso/libSQL oder Cloudflare D1.
- Cloudflare D1 wurde bewusst verworfen: außerhalb von Cloudflare Workers (also von einer Netlify Function aus) nur über Cloudflares Account-REST-API erreichbar, unbequemer als eine normale DB-Verbindung. Da das Hosting auf Netlify bleiben soll, kein guter Fit.
- Turso (libSQL/SQLite, HTTP-API) wäre ebenfalls eine valide Alternative gewesen (großzügiger Free Tier, sehr einfache HTTP-Anbindung auch aus Java ohne JDBC), wurde aber zugunsten von Neon zurückgestellt, weil Postgres für den Minecraft-Teil konventioneller ist.
- Neon Free Tier (Stand der Recherche): 0.5GB Storage pro Projekt, 100 CU-Stunden/Monat, bis zu 100 Projekte, keine Kreditkarte nötig — für diesen Anwendungsfall (ein Nutzer, überschaubare Datenmenge) mehr als ausreichend.

**Offen/zu tun (siehe auch Abschnitt 5):** `netlify/functions/storage.js` muss von Netlify Blobs auf eine Postgres-Verbindung zu Neon umgestellt werden (z.B. über `@neondatabase/serverless` oder den normalen `pg`-Treiber). Der grobe JSON-Blob-Ansatz (ein Key `mg_v4`, ein großes JSON-Objekt) kann fürs Erste beibehalten werden (einfachste Migration — z.B. eine Tabelle `app_state(key text primary key, value jsonb)`), muss aber spätestens für die Minecraft-Integration wahrscheinlich in echte Tabellen (Module, Kapitel, Unterkapitel, Questgeber, Fortschritt) aufgebrochen werden, damit das Java-Plugin sinnvoll einzelne Datensätze abfragen kann statt immer den kompletten Blob zu laden/parsen.

 (Questgeber-Architektur, aktueller Stand — WICHTIG: das ist NICHT die ursprüngliche 1:1-"ein Unterkapitel = eine Quest"-Version, sondern ein kompletter Umbau)

```
Modul (= ein Studienbrief):
{
  id, title, subject, color,
  startDate, targetDate,      // Fortschritts-Ziel statt starrem Kalenderplan
  pdfText,                    // für Struktur-Retry gespeichert
  chapters: [{
    id, title, stat,          // stat ∈ med|nat|ges|wei|int
    color, icon,               // Emoji, KI-generiert, passend zum KONKRETEN Kapitelinhalt
    _generationFailed,
    subnodes: [{
      id, title, icon, globalIndex,   // globalIndex = Position im GESAMTEN Studienbrief (1-based, modulweit fortlaufend)
      sourceExcerpt,                  // kurzer Text-Auszug aus dem Studienbrief, Kontext für Quest-Generierung
      kernpunkte: [{ id, label, covered }],     // die "Checkliste" — Referenz für Vollständigkeit
      questgeber: [{
        id, name,              // NPC-Name, KI-generiert (z.B. "Mia") — das sieht der Spieler
        label,                 // interner Themen-Cluster-Name, NUR für App-Logik/Prompt, NICHT im UI sichtbar
        kernpunkteIds,          // "Heimat"-Cluster dieses Questgebers (Startschwerpunkt, keine harte Grenze)
        currentQuest: null | {
          id, title, xp, stat, durationMin, muster,  // A|B|C|D
          npcHook,              // kurzer Teaser vor Annahme
          scenario,             // VOLLSTÄNDIGE Nachricht, EINE durchgehende Erzählung (siehe 3.3)
          targetKernpunkteIds,  // welche Kernpunkte diese Quest abdeckt
          accepted, npcChat: []
        }
      }],
      exercise: null | {        // optionaler "Kapitel-Boss" — Originalübung aus dem Studienbrief
        id, title, text, questions, keyPoints, passed
      }
    }]
  }],
  log: [{ questgeberId, subnodeId, title, xp, stat, date }]  // abgeschlossene Quests, für XP + Wissenskarte
}
```

### 2.3 Zentrale Mechanik: Questgeber statt starrer Quest-Liste

- **Keine Vorab-Generierung.** Beim Upload/Import wird nur die Struktur extrahiert: Kapitel, Unterkapitel, Kernpunkte-Checkliste, thematische Cluster (= Questgeber-"Slots"), Icons, Kurz-Auszug. Die eigentliche Quest-Szenario-Generierung passiert **on-demand**, erst wenn ein Questgeber angesprochen wird (schnell, ein Call, ~3000 Output-Tokens).
- **Mehrere Questgeber pro Unterkapitel.** Beim Strukturieren gruppiert die KI die Kernpunkte eines Unterkapitels in nicht-überlappende thematische Cluster (≈3-6 Kernpunkte je Cluster als Richtwert). Jeder Cluster wird ein Questgeber mit eigenem KI-generiertem Namen.
- **Questgeber sind NICHT strikt auf ihren Cluster beschränkt.** Sie dürfen bei der Quest-Generierung aus dem GESAMTEN Unterkapitel schöpfen (Cluster ist nur Startschwerpunkt), damit sich Quests nicht nur auf einen einzelnen Themenblock verengen. Damit sich mehrere Questgeber trotzdem unterscheiden, bekommt der Generierungs-Prompt die Namen der "Geschwister"-Questgeber und zuletzt benutzte Quest-Titel mit, mit der Anweisung sich klar davon abzusetzen.
- **Unbegrenzt wiederholbar.** Ein Questgeber bleibt für immer auf seinem festen Unterkapitel-Level. Nach Abschluss aller eigenen Kernpunkte generiert er bei erneutem Ansprechen **Wiederholungs-Quests**, die bewusst mit älterem Stoff mischen (Interleaving-Effekt/Retrieval Practice — Wissen soll auf wechselnde, nicht vorhersehbare Probleme angewendet werden, nicht nur einmal abgefragt werden).
- **Bekanntes Vokabular.** Begriffe aus bereits abgeschlossenen (früheren) Unterkapiteln werden dem Generierungs-Prompt als "darf ohne Erklärung benutzt werden" mitgegeben.

### 2.4 Level-/Freischaltungssystem

- **Studienbrief-Level** = Anzahl der von Anfang an lückenlos abgeschlossenen Unterkapitel (0 bis X, X = Gesamtzahl Unterkapitel im Studienbrief). Ein Unterkapitel gilt als abgeschlossen, wenn ALLE seine Kernpunkte in erfolgreich abgeschlossenen Quests vorkamen.
- Unterkapitel werden strikt in Buch-Reihenfolge freigeschaltet: Unterkapitel N ist erreichbar, sobald Unterkapitel 1..N-1 komplett fertig sind. Das erste ist immer offen.
- Ein Questgeber ist erreichbar, sobald sein "Heimat"-Unterkapitel freigeschaltet ist — Questgeber-Level ändert sich danach nicht mehr, bleibt aber für immer nutzbar (Wiederholung, s.o.).
- Kein Kalender/keine feste Tages-Zuteilung mehr (bewusst entfernt, weil bei On-Demand-Generierung keine feste Gesamt-Quest-Zahl existiert). Stattdessen: **Fortschritts-Ziel** (Zieldatum), auf der Modul-Kachel als einfache Pace-Anzeige (↑ voraus / → im Plan / ↓ Rückstand, mit Ziel-Marker auf dem Fortschrittsbalken).

### 2.5 Views

1. **Charakter-Seite:** Gender-Onboarding (für spätere Trainingsplanung, kein Einfluss auf Lern-XP), Strichmännchen-Figur mittig, links davon Körper-Stats (Kraft=rot/💪, Ausdauer=grün/🏃, Koordination=orange/🤸, jeweils mit Mini-Balken), rechts Intelligenz (blau/🧠, ausklappbar in die 5 Substats med/nat/ges/wei/int mit je eigener Farbe/Icon). Modul-Kacheln (Level X/Y, Pace-Status, Lösch-Button). Upload- und Text-Import-Buttons.
2. **Skilltree (pro Modul), zwei Tabs:**
   - **🌳 Skilltree:** SVG-Baum, Kapitel = große Icon-Knoten, Unterkapitel = kleine Icon-Knoten (Icons statt Zahlen/Text, Name nur im Hover-Tooltip). Klick auf Unterkapitel öffnet eine **reine Themen-Checkliste** (read-only, gruppiert nach Cluster, wird beim Quest-Abschluss automatisch abgehakt) — KEINE Quest-Navigation von hier aus.
   - **🧭 Entdecken:** Flache Liste ALLER freigeschalteten Questgeber über das ganze Modul (unabhängig vom Skilltree-Pfad), zeigt **Name + Level** (nicht Themenblock/Kapitel!) plus Fortschrittsbalken. Klick öffnet die Quest.
   - Level-Leiste (Modul-Level/Max) oben, "↺ Reset"-Button (setzt Fortschritt zurück, Struktur bleibt, kein neuer API-Call nötig — praktisch zum Testen).
3. **Quest-Modal** (bei Questgeber-Klick): Tabs "🧙 Questgeber" (Quest selbst, wird bei Bedarf live generiert), "🗺️ Wissenskarte" (bereits gelernte Begriffe je Unterkapitel), "🤝 Verbündeter" (Coming-Soon-Platzhalter — **das ist konzeptionell der Prof aus Abschnitt 4.3**). Kapitel-Boss (falls vorhanden) hat eigenes Modal mit KI-bewerteter Freitextantwort.

### 2.6 Upload/Import
- **PDF-Upload:** PDF.js-Extraktion → KI-Outline-Pass (Kapitel/Unterkapitel-Titel) → pro Kapitel ein Struktur-Pass (Kernpunkte + Cluster + Namen + Icon + Excerpt + optionaler Boss) → Zieldatum festlegen → fertig.
- **Text-Import ("Per Text importieren"):** Für Fälle, in denen PDF-Upload nicht geht (z.B. Datei-Picker im mobilen Artefakt funktioniert nicht zuverlässig) — Claude verarbeitet den Studienbrief im Chat und liefert fertiges Struktur-JSON, das per Copy-Paste importiert wird. Zwei Modi: neues Modul ODER "Kapitel ergänzen" (an bestehendes Modul anhängen, für sehr lange Studienbriefe die Claude nur häppchenweise verarbeiten kann — IDs werden dabei automatisch kollisionsfrei neu vergeben, `globalIndex` setzt sich fort).

---

## 3. Quest-Generierungs-Spec (Kernregeln, Details siehe mitgeschickte `quest_generierung_spec.md`)

### 3.1 Ablauf
1. Kernpunkte extrahieren (atomare, prüfbare Einheiten)
2. Fallmuster wählen (A/B/C/D, siehe unten) — ein Block darf mischen
3. Szenario bauen, das ALLE Kernpunkte zwingend braucht (nicht 80%, sondern möglichst 100%; bei zu viel Stoff: mehrere kürzere Quests statt einer überladenen)
4. Selbstcheck: kam jeder Kernpunkt aktiv vor?
5. Restpunkte minimal halten (Muster D nur als Ausnahme, <15-20%)

### 3.2 Die vier Muster
- **A — Decodier-Fall:** Terminologie/Notation, ein Fachdokument muss übersetzt/eingeordnet werden.
- **B — Diagnose-Fall:** mehrere Kandidaten, einer erklärt die Symptome, Rest sind Distraktoren — Aufgabe verlangt auch Ausschluss-Begründung.
- **C — Anwendungsfall:** aktiv etwas konstruieren/berechnen/ausführen für ein konkretes Teilproblem.
- **D — Merksatz-Karte:** Fallback, so selten wie möglich, für Punkte die sich in keinem Fall unterbringen lassen (z.B. rein historische/kontextlose Fakten).
- Vorfilter: Meta-/Verwaltungsinhalt (Vorwort, Literaturverzeichnis, ...) wird gar nicht erst zu Kernpunkten.
- Sonderregel: Verweist der Studienbrief auf externes Wissen ("Recherchieren Sie über X"), wird X trotzdem explizit als Kernpunkt aufgenommen.

### 3.3 Erzählform (wichtige Verfeinerung aus dieser Session — nicht im ursprünglichen Spec-Dokument, aber genauso bindend)
- **Keine Aufgabenliste.** Quests dürfen KEINEN separaten "Aufgabe:"-Abschnitt mit nummerierten Anweisungen haben ("1. Finde... 2. Erkläre..."). Das fühlt sich wie ein Arbeitsblatt an, nicht wie ein echtes Problem.
- **Eine durchgehende Nachricht.** Die komplette Quest ist EIN zusammenhängender Text in der Stimme des NPCs — wie eine echte Chat-Nachricht/ein echtes Gespräch. Was zu tun ist, ergibt sich implizit aus der Bitte selbst (endet mit einer echten offenen Frage, nicht mit einer Anweisung).
- **Direkte Ansprache bevorzugt.** Der NPC wendet sich idealerweise DIREKT an den Spieler als die Fachperson, die er kennt (sein Trainer, sein Arzt, ...) — nicht "hilf mir, das Dokument von jemand anderem zu checken". Das fühlt sich mehr nach "ich bin die konsultierte Fachperson" an als nach "ich reviewe fremden Kram".
- **Terminologie bleibt korrekt** in eingebetteten Fachdokumenten/Zitaten (ein Arzt/Trainer im fiktiven Dokument spricht fachsprachlich richtig) — nur der hilfesuchende NPC selbst spricht als Laie.
- **Echtes persönliches Problem, keine abstrakte Aufgabe.** Auch Diagnose-artige Fälle (Muster B) werden als echtes Anliegen gerahmt ("wir müssen rausfinden was wirklich los ist"), nicht als neutrale Zuordnungs-/Sortierübung.

---

## 4. Minecraft-Integration — Konzept (noch nicht gebaut, nur durchdacht)

### 4.1 Architektur-Entscheidung
- **Server-Plugin (Paper/Spigot, Java)** statt Client-Mod (Fabric/Forge) — pragmatischer, funktioniert auch für Singleplayer über einen lokalen Server, KI-Calls laufen serverseitig (Java kann problemlos HTTP).
- **Backend: Netlify Functions + Neon (Postgres)** — bereits als Entscheidung getroffen (siehe 2.1b), noch nicht vollständig umgesetzt (Blobs→Neon-Migration steht aus). Sowohl die Web-App als auch das künftige MC-Plugin sprechen mit demselben Backend. Der Anthropic-API-Key liegt nur einmal serverseitig (`netlify/functions/claude.js`).
- **Aufgabenteilung:** Minecraft = Entdecken/Freischalten/Erklären. Web-App = tatsächliches Lösen der Quests (Skilltree-Nachbau ingame wurde bewusst verworfen — zu aufwändig, kein Mehrwert ggü. der Web-App).
- NPCs technisch über das **Citizens**-Plugin (Standard-Library für sowas).

### 4.2 Wissensbeschaffung ingame — WICHTIGE EINSCHRÄNKUNG
Minecraft-Text (Bücher, Schilder, Chat) kann **keine Tabellen und keine Illustrationen** darstellen — nur reinen (formatierbaren) Text. Deshalb: alles Tabellarische/Bildhafte bleibt explizit Sache des Studienbriefs/der App; ingame gibt's nur vereinfachte, unvollständige Text-Erklärungen mit explizitem Verweis "für Details: Studienbrief/App". (Item-Maps könnten theoretisch Bilder zeigen, lohnt sich aber nicht bei KI-generiertem, beliebigem Inhalt — verworfen.)

Beschlossene Wege ans Material:
1. **Questgeber-NPCs** (bereits im Datenmodell vorhanden) sprechen ihren `npcHook` als Chat-Teaser aus, bevor man zur App wechselt.
2. **Deep-Link-Buch:** NPC gibt bei Interaktion ein Book&Quill mit anklickbarem Link (`ClickEvent: open_url`) direkt zur passenden Quest/zum Questgeber in der Web-App.
3. **Prof-NPC pro Studienbrief** (siehe 4.3) — zentrale Anlaufstelle für Erklärungen UND Material.
4. **5 feste Themenzonen** statt 1:1-Nachbau des (individuellen, KI-generierten) Skilltrees: eine Zone pro Intelligenz-Substat (med/nat/ges/wei/int, gleiche Farben/Icons wie in der App). Questgeber eines Kapitels spawnen in der zur Kapitel-Stat passenden Zone.

### 4.3 Der Prof-NPC (neu in dieser Session festgelegt)
- **Ein Prof pro Studienbrief**, konzeptionell identisch mit dem "🤝 Verbündeter"-Tab in der App (aktuell noch Platzhalter — hier ist jetzt klar, was er später können soll).
- **Rolle: Erklären, nicht Lösen.** Freies Chatten über alles, was im Studienbrief bereits freigeschaltet ist (`globalIndex <= aktuelles Level + 1` — nutzt exakt die schon vorhandene Freischalt-Logik, kein separates Tracking nötig). Löst aber KEINE konkreten Quest-Aufgaben und verifiziert keine Antworten zu einer aktiven Quest — verweist bei sowas explizit zurück an den zuständigen Questgeber. **Diese Grenze muss als expliziter Guardrail im System-Prompt stehen**, nicht nur implizit erwartet werden.
- **Rollentrennung:** Questgeber = Üben/Anwenden (viele, wechselnd). Prof = Erklären/Nachschlagen (einer, konstant).
- **Material-Bereitstellung:** Der Prof gibt (auf Wunsch oder automatisch bei neuer Freischaltung) ein wachsendes Buch mit den `sourceExcerpt`-Texten aller bisher freigeschalteten Unterkapitel — ein lebendiges Kompendium statt einer separaten Bücherei.
- Technisch: im Kern derselbe Baustein wie der bestehende Quest-NPC-Chat in der Web-App (KI-Call mit Kontext + letzten Nachrichten), nur serverseitig statt clientseitig, plus Erkennung "ist der Spieler gerade im Gespräch mit dem Prof" (Chat-Nachrichten abfangen statt normal broadcasten).

### 4.4 Belohnungssystem (Brainstorm, NICHT final entschieden)
Grundproblem: Skilltree-Inhalte sind KI-generiert/pro Studienbrief individuell — es kann keine handkuratierten, themenspezifischen Belohnungs-Items geben, ohne den Inhalt vorher zu kennen.
**Lösungsansatz:** feste, generische Mechanik + KI-generierter Flavor obendrauf (gleiches Prinzip wie schon bei Icons/Namen) — feste Item-"Hüllen" pro Fach-Stat mit fester Spielmechanik (Attributmodifikator o.ä.), die KI vergibt beim Kapitelabschluss nur Name + Lore-Text passend zum Thema.

Ideen für passive Dauerboni (Substat-Level-skaliert):
- **Medizin** → schnellere Regeneration, Gift-/Krankheitsresistenz
- **Natur** → schnelleres Pflanzenwachstum in der Nähe, bessere Ernte-/Zuchtausbeute
- **Gesellschaft** → bessere Handelspreise, schnellerer Dorfbewohner-Ruf
- **Kultur** → eher kosmetisch (Partikel-Effekte, Titel, freischaltbare Deko/Banner)
- **Abstraktion** → Utility (Kompass zum nächsten freigeschalteten Questgeber, kurzzeitige "Röntgenblick"-artige Reveal-Funktion)

Weitere offene Gedanken:
- Boss-Quest-Abschluss (Kapitel-Boss) als Trigger für die "große" Belohnung; einzelne Questgeber-Abschlüsse eher kleine Sofort-Buffs statt permanenter Items.
- Körper-Stats (Kraft/Ausdauer/Koordination, aktuell App-seitig nur Platzhalter) könnten in Minecraft 1:1 auf echte Spieler-Attribute gemappt werden (Angriffsschaden/Sprint-Ausdauer/Fallschaden-Reduktion) — mechanisch selbsterklärend, kein KI-Flavor nötig. Würde dem für später geplanten Trainings-Modul einen konkreten Ingame-Nutzen geben.
- **Nicht entschieden:** viele kleine Soforteffekte vs. wenige, aber spürbare Meilenstein-Belohnungen.

---

## 5. Offene Punkte / nächste Schritte
- [x] Web-App eigenständig auf Netlify lauffähig gemacht (`/api/claude`, `/api/storage` als Netlify Functions)
- [ ] **Nächster konkreter Schritt:** `netlify/functions/storage.js` von Netlify Blobs auf Neon (Postgres) umstellen — Verbindung via `@neondatabase/serverless` oder `pg`, Umgebungsvariable `DATABASE_URL` statt Blobs-Store. Fürs Erste reicht eine simple `app_state(key text primary key, value jsonb)`-Tabelle als 1:1-Ersatz für den bisherigen Blob; echtes relationales Schema (Module/Kapitel/Unterkapitel/Questgeber/Fortschritt als eigene Tabellen) folgt spätestens für die Minecraft-Integration.
- [ ] Neon-Projekt anlegen, `DATABASE_URL` als Netlify-Environment-Variable setzen
- [ ] Paper-Plugin-Grundgerüst (Maven/Gradle, Citizens-Integration, NPC-Placement-Config)
- [ ] Plugin verbindet sich per JDBC direkt mit derselben Neon-Postgres-Instanz (kein Umweg über die Netlify Functions nötig, da Postgres von überall erreichbar ist)
- [ ] Prof-NPC-Chat-Logik (System-Prompt mit Guardrail "erklären ja, Quest lösen nein")
- [ ] Zonen-Konzept konkretisieren (Koordinaten/Regionen, WorldGuard oder simple Bounding-Boxes)
- [ ] Belohnungssystem final entscheiden (Soforteffekte vs. Meilensteine) und Item-Hüllen pro Fach-Stat definieren
- [ ] Deep-Link-Format für Book&Quill-Links festlegen (welche IDs müssen in der URL, wie öffnet die Web-App direkt die richtige Quest)

## 6. Mitgelieferte Dateien (siehe Repo-Struktur)
- `public/index.html` — die aktuelle, funktionierende Web-App. Stand: Questgeber-System mit On-Demand-Generierung, Entdecken-Tab, Themen-Checkliste, neuer Erzählform ohne Aufgabenliste, Reset-Funktion, eigene Dialog-Overlays, angebunden an `/api/claude` + `/api/storage`.
- `netlify/functions/claude.js`, `netlify/functions/storage.js`, `netlify.toml`, `package.json` — Netlify-Deployment (siehe README.md für Setup).
- `docs/quest_generierung_spec.md` — die Original-Spec für die Quest-Generierung (Muster A/B/C/D, Ablauf, Sonderregeln). Die Verfeinerung zur Erzählform (Abschnitt 3.3 hier) ergänzt diese Spec, ersetzt sie nicht.
