# Spec: Fallbasierte Quest-Generierung

Diese Regel gilt für **jeden Inhaltsblock**, egal aus welchem Fachbereich (Medizin, Coding, BWL, Training, etc.). Ziel: Kein Block wird mit reiner Erklärung + Abschlussaufgabe abgehandelt. Stattdessen wird ein Fall/Szenario konstruiert, das den Stoff *anwenden* statt nur *wiedergeben* lässt – weil reines Wissen ohne echten Bedarf bei mir nicht hängen bleibt.

## Ablauf (immer in dieser Reihenfolge)

**Schritt 1 – Kernpunkte extrahieren.**
Bevor irgendein Fall geschrieben wird, listet die KI alle atomaren, prüfbaren Kernpunkte des Blocks auf (Begriffe, Konzepte, Mechanismen, Funktionsprinzipien – je nach Fach). Diese Liste ist die Referenz für alles Weitere.

**Schritt 2 – Blocktyp klassifizieren.**
Anhand der Art der Kernpunkte wird eines von drei Fallmustern gewählt (siehe unten). Ein Block kann auch mehrere Muster mischen, wenn er gemischten Inhalt hat.

**Schritt 3 – Szenario bauen, das ALLE Kernpunkte zwingend braucht.**
Nicht 80–90%, sondern möglichst 100%. Bei zu vielen/heterogenen Punkten: mehrere kürzere Szenarien statt eins überladenes.

**Schritt 4 – Selbstcheck-Liste generieren.**
Jeder Kernpunkt aus Schritt 1 wird einzeln abgehakt: kam er im Szenario wirklich vor, und musste er aktiv benutzt werden (nicht nur nebenbei erwähnt)? Was nicht abgedeckt ist, wird nachgebessert – oder wandert bewusst in Schritt 5.

**Schritt 5 – Restpunkte minimieren.**
Was sich partout nicht in ein Szenario packen lässt (siehe Muster C), wird als kurze Merksatz-Karte behandelt – die kleinstmögliche Ausnahme, nicht der Standardfall. Ziel: so wenig wie möglich, so viel wie nötig.

---

## Kategorie 0 – Kein Quest (Vorfilter vor Schritt 1)

Nicht jeder Textabschnitt ist Fachwissen. Meta-/Verwaltungsinhalt (Vorwort, Hinweise zum Studienbrief, Copyright, Literaturverzeichnis, organisatorische Sätze) beschreibt das Material selbst, nicht den zu lernenden Stoff. Solche Abschnitte werden **vor** der Kernpunkt-Extraktion aussortiert – kein Quest, keine Merksatz-Karte, einfach übersprungen. Erkennungsmerkmal: Der Abschnitt lässt sich nicht in einer Prüfung sinnvoll abfragen, ohne dass die Frage selbst albern wirkt ("Wer hat das Vorwort geschrieben?").

## Sonderregel – Verweise auf externes Wissen

Manche Blöcke enthalten eingebaute Recherche-Aufgaben, die auf Wissen *außerhalb* des Blocktexts verweisen (z.B. "Recherchieren Sie über Mitose" oder "über Kammerflimmern und Defibrillatoren"). Hier wird der referenzierte Begriff explizit in die Kernpunkte-Liste aus Schritt 1 aufgenommen, auch wenn er im Blocktext selbst nicht erklärt wird – sonst prüft die Selbstcheck-Liste (Schritt 4) nur gegen den sichtbaren Text und der eigentlich geforderte externe Lerninhalt rutscht unbemerkt durch.

## Die drei Fallmuster

### Muster A – Decodier-Fall
**Wann:** Der Inhalt ist Terminologie, Notation, oder Übersetzungswissen – Begriffe/Symbole, die selbst kein Problem lösen, sondern nötig sind, um andere Dinge zu verstehen oder zu beschreiben.
**Aufbau:** Ein realistisches Dokument in Fachsprache (Arztbrief, Log-Datei, Fehlermeldung, Spezifikation, Code-Kommentar) muss in eigene Worte übersetzt/interpretiert werden. Kein "Problem lösen", sondern "Beschreibung verstehen und Konsequenz ableiten".
**Beispiel Medizin:** Arztbrief mit anatomischen Fachbegriffen (Abduktion, distal, Sagittalebene …) → übersetzen, Trainingskonsequenz ableiten.
**Beispiel Coding (analog):** Eine kryptische Fehlermeldung / ein API-Response-Objekt mit Fachbegriffen (Index out of bounds, null pointer, Stack Trace) → interpretieren, was schiefläuft und wo im Code das Problem sitzt.

### Muster B – Diagnose-Fall
**Wann:** Der Inhalt ist Funktions-/Kausalwissen – mehrere mögliche "Verdächtige" (Organe, Ursachen, Fehlerquellen), von denen genau einer die Symptome erklärt.
**Aufbau:** Eine Liste von Befunden/Symptomen wird präsentiert. Ein Teil davon zeigt die Ursache, der Rest sind bewusste **Distraktoren** (unauffällige, normale Werte für die anderen Kandidaten). Die Aufgabe verlangt nicht nur die richtige Antwort zu finden, sondern zu erklären, warum die anderen Kandidaten *nicht* die Ursache sind.
**Beispiel Medizin:** Laborbefund einer Muskelzelle, Mitochondrien auffällig, alle anderen Organellen unauffällig aufgelistet → Ursache identifizieren + falsche Kandidaten ausschließen können.
**Beispiel Coding (analog):** Ein Bug-Report mit mehreren Systemkomponenten (DB-Query, Caching-Layer, Frontend-State, Array-Indexierung), von denen nur eine tatsächlich die Fehlerursache ist, Rest zeigt unauffällige Logs → Ursache finden und begründen, warum die anderen es nicht sind.

### Muster C – Anwendungsfall (aktives Konstruieren/Ausführen)
**Wann:** Der Inhalt ist prozedural – man muss aktiv etwas bauen/ausführen/berechnen, nicht nur decodieren oder diagnostizieren. Typisch für Coding, Mathe, Trainingsplanung.
**Aufbau:** Eine praxisnahe, konkrete Aufgabenstellung, die das Konzept zwingend als Werkzeug braucht, um ein reales Teilproblem zu lösen – kein abstraktes "Erkläre X", sondern "Löse Y, und dafür brauchst du X".
**Beispiel Coding:** Statt "Erkläre mehrdimensionale Arrays und Koordinatensysteme" → "Baue eine Funktion, die für ein Schachbrett (8x8-Array) alle gültigen Springer-Züge von Position (x,y) zurückgibt." Das Array + Koordinatenlogik wird zwingend gebraucht, nicht nur erwähnt.
**Beispiel Training:** Statt "Erkläre Trainingsperiodisierung" → "Ein Kunde hat in 6 Wochen einen Wettkampf, plane die Belastungssteuerung."

### Muster D – Merksatz-Karte (Fallback, so selten wie möglich)
**Wann:** Der Kernpunkt lässt sich in keinem sinnvollen, unverzerrten Fall unterbringen (z.B. rein historische Fakten, Dinge die nur in einem Kontext vorkommen, der keine "Aufgabe" zulässt – wie embryonales Gewebe, das nur vorgeburtlich existiert).
**Aufbau:** Kurzer, direkter Fakt ohne Szenario drumherum. Wird in der Selbstcheck-Liste trotzdem als "abgedeckt" markiert, aber ehrlich als Ausnahme gekennzeichnet (kein künstlich aufgeblähtes Pseudo-Szenario nur um der Form willen).
**Regel:** Wenn mehr als ~15–20% eines Blocks in Muster D landen, ist das ein Signal, den Block eventuell anders zu zerschneiden oder die Kernpunkt-Extraktion zu überprüfen – nicht ein Grund, das Prinzip aufzugeben.

---

## Entscheidungshilfe für die KI (Kurzversion)

1. Ist es ein Begriff/Notation, der übersetzt werden muss, um etwas anderes zu verstehen? → **Muster A**
2. Gibt es mehrere mögliche Ursachen/Erklärungen und man muss die richtige unter Ausschluss der falschen finden? → **Muster B**
3. Muss aktiv etwas gebaut, berechnet oder ausgeführt werden, um ein konkretes Teilproblem zu lösen? → **Muster C**
4. Lässt sich der Punkt in keinem der drei Muster unterbringen, ohne ihn zu verbiegen? → **Muster D**, aber minimal halten.

## Generelles Qualitätskriterium
Ein Fall ist nur dann gut konstruiert, wenn man ihn **nicht** durch Halbwissen oder Mustererkennung lösen kann. Wenn 60% der Aufgabe mit "klingt plausibel" zu schaffen sind, fehlt entweder ein Distraktor (Muster B) oder eine Teilfrage, die einen bislang unbenutzten Kernpunkt zwingend abfragt.

---

## Verfeinerung: Erzählform (Ergänzung, siehe KONZEPT_UEBERGABE.md Abschnitt 3.3)

Diese Punkte wurden nach dem ursprünglichen Spec ergänzt und gelten genauso bindend:

- **Keine Aufgabenliste.** Kein separater "Aufgabe:"-Abschnitt mit nummerierten Anweisungen. Die Quest ist EINE durchgehende Nachricht in der Stimme des NPCs, endet mit einer echten offenen Frage/Bitte, nicht mit einer Anweisung.
- **Direkte Ansprache bevorzugt.** Der NPC wendet sich idealerweise direkt an den Spieler als die Fachperson, die konsultiert wird — nicht "hilf mir, ein fremdes Dokument zu checken".
- **Terminologie bleibt korrekt** in eingebetteten Fachdokumenten/Zitaten — nur der hilfesuchende NPC selbst spricht als Laie.
- **Echtes persönliches Problem, keine abstrakte Aufgabe** — auch bei Muster B (Diagnose-Fall) als echtes Anliegen gerahmt, nicht als neutrale Zuordnungsübung.
