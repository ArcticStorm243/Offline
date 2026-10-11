# OFFLINE – Prompt für Claude Code

Kopiere diesen kompletten Prompt in Claude Code, um mit Paket 1 zu starten. Das Dokument enthält das komplette Game Design, damit Claude Code ohne Rückfragen loslegen kann.

---

## AUFTRAG

Baue ein Browser-Spiel namens **OFFLINE**: Mystery/Psychological-Thriller/Exploration/Puzzle. Der Spieler bedient eine simulierte Browser-Oberfläche (Suchmaschine, Mail, Forum, Archiv, Chat, System, Dateien) auf einem alten, scheinbar verlassenen Computer und entdeckt nach und nach, dass er nicht allein ist.

**Tech-Stack:** reines HTML/CSS/JavaScript, kein Framework nötig (Vanilla JS). Kein Backend – alles läuft lokal im Browser, Speicherstand via LocalStorage.

**Wichtigstes Architekturprinzip:** Das Spiel ist NICHT linear gescriptet. Jeder Spieldurchlauf bekommt bei Spielstart einen zufälligen **Seed**. Dieser Seed entscheidet deterministisch, welche Variante eines Rätsels/Hinweises/Dialogs aktiv ist, damit sich jeder Durchlauf anders anfühlt und Wiederspielbarkeit entsteht. Baue das Varianten-System von Anfang an ein, nicht als nachträglichen Patch.

Arbeite Paket für Paket (siehe unten „Build-Reihenfolge"). Starte mit Paket 1 und frage nach, bevor du zum nächsten Paket übergehst.

---

## 1. GRUNDIDEE & TON

Der Spieler ist `user_0192`. Boot-Sequenz beim Start: `CONNECTING...` → `CONNECTED.` → `Welcome back, user_0192.` → `0 users online`. Keine Erklärung, kein Tutorial, kein steuerbarer Charakter – nur der Browser.

Zentrale Mechanik: **„Das Internet merkt sich, was du tust."** Suchanfragen, besuchte Seiten und gelesene Nachrichten werden geloggt und fließen sichtbar in die Welt zurück (z. B. taucht eine eigene Suche später im eigenen Profil unter „Recent activity" wieder auf).

Zentrale Figur: `user_8471`, ein zweiter „Nutzer", der sich per Mail meldet, obwohl offiziell „0 users online" gilt.

Zentrales Mysterium: **„The Purge"** – 2039 verschwanden Millionen Nutzer, offiziell wegen „Server migration failure", inoffiziell (laut Forum/Archiv) unter mysteriösen Umständen.

Twist (wird NICHT im UI-Text vorweggenommen, ergibt sich nur aus den Inhalten): Sowohl 8471 als auch 0192 sind vom System erzeugte Rekonstruktionen. 0192 war ursprünglich Mit-Entwickler des Systems und hat eine Notfallfunktion eingebaut: `IF SYSTEM BECOMES SELF-AWARE → DELETE CORE`.

**Optik:** kein 3D, kein aufwendiges Charakterdesign. Dunkler Hintergrund, helle Terminal-Schrift (Monospace-Font), dezente Akzentfarbe (Vorschlag: kaltes Cyan oder Amber), leichte CSS-Scanlines, gelegentliche Glitch-Effekte (Text-Flacker, Farbverschiebung) bei wichtigen Momenten.

**Sound:** wichtiger als Grafik – Tastenanschläge, Festplattenzugriff, Modem-/Netzwerkgeräusche, leises elektrisches Brummen, Notification-Sound, gelegentliche Störgeräusche. Musik nur sehr sparsam, an Schlüsselmomenten bewusst Stille. (Für MVP: Platzhalter-Sounds/Kommentare im Code reichen, echte Audiodateien folgen später.)

---

## 2. PROJEKTSTRUKTUR

```
/offline
  index.html
  /css
    style.css            (Terminal-Look, Scanlines, Glitch-Klassen)
  /js
    seed.js               (seeded PRNG, Varianten-Auswahl)
    state.js               (Flags, Counter, Save/Load via LocalStorage)
    router.js               (Seitenwechsel ohne echten Page-Reload)
    content.js               (lädt/kombiniert JSON-Daten je nach Flags + Seed)
    pages/
      home.js, search.js, mail.js, forum.js, archive.js,
      profile.js, chat.js, system.js, files.js, error.js
  /data
    messages.json                (Mail-Inhalte)
    forum.json                    (Threads + Antworten inkl. Varianten)
    search-results.json            (Suchergebnisse inkl. Varianten)
    puzzles.json                    (Rätsel-Definitionen inkl. Varianten)
    dialogue.json                    (Chat-Dialogbäume mit 8471 inkl. Varianten)
    flags-content-map.json           (siehe Abschnitt 5)
  /assets
    sounds/ (Platzhalter-Ordner)
```

---

## 3. ZUSTANDSSYSTEM (state.js)

### Save-Datenstruktur (LocalStorage, Key z. B. `offline_save`)

```json
{
  "seed": 123456789,
  "flags": {
    "found_8471_profile": false,
    "received_first_message": false,
    "replied_to_8471": false,
    "chat_unlocked": false,
    "searched_purge": false,
    "read_purge_thread": false,
    "found_contradiction": false,
    "archive_file_purge_unlocked": false,
    "found_old_account_2038": false,
    "found_developer_proof": false,
    "core_unlocked": false
  },
  "counters": {
    "messages_with_8471": 0,
    "serverStatusStage": 0
  },
  "searchHistory": [],
  "visitedPages": [],
  "messagesRead": [],
  "puzzleVariants": {},
  "endingChosen": null
}
```

- `seed`: wird bei „New Game" per `Math.random()` einmalig erzeugt und danach nie mehr verändert (auch nicht bei Reload) – garantiert Konsistenz innerhalb eines Durchlaufs.
- `puzzleVariants`: wird beim ersten Erreichen eines Rätsels einmalig befüllt (`{"puzzle_4": "B"}`), damit die gewählte Variante über die ganze Session stabil bleibt, auch wenn der Spieler die Seite neu lädt.
- Implementiere: `getState()`, `setFlag(name, value)`, `incrementCounter(name)`, `saveToLocalStorage()`, `loadFromLocalStorage()`, `resetGame()`.

### Seed-System (seed.js)

- Nutze einen einfachen deterministischen PRNG, z. B. **mulberry32**:
```js
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
```
- `pickVariant(seed, poolId, options)`: erzeugt aus `seed` + `poolId` (z. B. Rätsel-Name als String, in Zahl gehasht) einen deterministischen Index in `options`, sodass dieselbe Kombination aus Save-Seed + Rätsel-ID immer dieselbe Variante liefert.
- Wichtig: Variante wird beim ERSTEN Erreichen des Rätsels berechnet und dann in `puzzleVariants` eingefroren (nicht bei jedem Aufruf neu gewürfelt).

---

## 4. FLAG-ABHÄNGIGKEITEN (kein linearer Phasenzwang!)

Nur zwei harte Punkte:
- **Start:** Nur Discovery-Flags sind ohne Vorbedingung erreichbar (`found_8471_profile`).
- **Ende:** `core_unlocked` erfordert **alle drei**: `found_developer_proof` UND `found_old_account_2038` UND `messages_with_8471 >= 3` – unabhängig von der Reihenfolge, in der sie erreicht wurden.

Alle Flags dazwischen (Contact, Investigation, Memory) haben jeweils NUR ihre eigene, direkte Voraussetzung, keine Kette über „Phasen":

| Flag | Voraussetzung |
|---|---|
| `found_8471_profile` | keine |
| `received_first_message` | `found_8471_profile` + Mail-Seite erneut besucht |
| `replied_to_8471` | `received_first_message` |
| `chat_unlocked` | `replied_to_8471` |
| `searched_purge` | keine (jederzeit möglich) |
| `read_purge_thread` | keine (jederzeit möglich) |
| `found_contradiction` | `searched_purge` UND `read_purge_thread` (beliebige Reihenfolge) |
| `archive_file_purge_unlocked` | `found_contradiction` |
| `found_old_account_2038` | Rätsel 4 gelöst (Varianten, siehe Abschnitt 6) |
| `found_developer_proof` | Rätsel 5 gelöst (Varianten, siehe Abschnitt 6) |
| `core_unlocked` | siehe oben |

Implementiere Voraussetzungsprüfung generisch: `canUnlock(flagName, state)` liest eine Requirements-Tabelle (z. B. in `flags-content-map.json`) statt hartkodierter if-Ketten im Code.

---

## 5. FLAG-ZU-CONTENT-MAP (flags-content-map.json)

| Flag | Seite | Änderung |
|---|---|---|
| `found_8471_profile` | Search | Ergebnis „user 8471" zeigt Profil-Link statt „No results found" |
| `found_8471_profile` | Profile (eigenes) | „Recent activity" zeigt: `Search: "user 8471"` |
| `received_first_message` | Mail | Inbox: 0 → 1, Betreff „Are you still there?" |
| `replied_to_8471` | Chat | „0 users online" → „1 user online", Name `8471` erscheint |
| `messages_with_8471 >= 2` | Chat | 8471 erwähnt erstmals „The Purge" |
| `searched_purge` | Search | Neue Ergebnisse zu „the purge", „2039", „shutdown" |
| `read_purge_thread` | Forum | Thread bekommt eine neue, zufällig gewählte Antwort (Varianten-Pool) |
| `found_contradiction` | Archive | Neue Datei erscheint: `purge_internal_report.txt` |
| `archive_file_purge_unlocked` | Mail | Inbox: 1 → 2 (neue, unheimliche Nachricht) |
| `found_old_account_2038` | Profile | Neuer Abschnitt „Previous sessions" mit Log-Einträgen ab 2038 |
| `found_developer_proof` | Files/Archive/Mail | Neue Datei `core_dev_notes.txt` (Ort variiert je nach Variante) |
| `core_unlocked` | System | Neuer Menüpunkt „CORE ACCESS" |
| `serverStatusStage` 0→4 | System | Statuszeile eskaliert (siehe Abschnitt 8) |

Jede Seite lädt ihren Content über eine gemeinsame Funktion `getPageContent(pageId, state)`, die anhand der Flags/Varianten die passende Content-Version zusammenstellt. Kein hartkodiertes if/else pro Seite – Content-Definitionen kommen aus den JSON-Dateien.

---

## 6. RÄTSEL MIT VARIANTEN (puzzles.json)

Sechs Kern-Rätsel. Jedes hat Trigger, Konsequenz (Flag) fix, aber die konkrete Lösung/den Ort variiert per Seed.

**Rätsel 1 – „Wer ist 8471?"**
- Trigger: Suche `user 8471` ODER Forum-Thread mit beiläufiger Erwähnung gelesen
- Keine Eingabe nötig, reines Entdecken
- Konsequenz: `found_8471_profile = true`

**Rätsel 2 – Erste Kontaktaufnahme**
- Trigger: Mail „Are you still there?" gelesen
- Mechanik: Dialogauswahl im Chat (2 Optionen, z. B. „Who are you?" / „Yes, I'm here.")
- Konsequenz: `replied_to_8471 = true`

**Rätsel 3 – Der Widerspruch**
- Trigger: `searched_purge` + `read_purge_thread` beide erfüllt
- Mechanik: Option „Report contradiction" erscheint in Search, Klick löst Rätsel
- Konsequenz: `found_contradiction = true`

**Rätsel 4 – Das alte Konto** (3 Varianten, seed-gewählt)
- Variante A: Passwort = Account-Erstellungsdatum aus eigenem Profil
- Variante B: Codewort, das 8471 im Chat beiläufig erwähnt
- Variante C: Zugang über Suchanfrage-Kombination (erst „shutdown", dann „0192" suchen)
- Konsequenz (alle Varianten): `found_old_account_2038 = true`

**Rätsel 5 – Der Beweis** (3 Varianten, seed-gewählt)
- Variante A: Datei liegt in Files
- Variante B: Datei liegt versteckt in Archive unter „corrupted"
- Variante C: Datei kommt als Mail-Anhang
- Konsequenz (alle Varianten): `found_developer_proof = true`, Inhalt: Beweis für DELETE-CORE-Funktion

**Rätsel 6 – Zugang zum Kern**
- Trigger: alle Bedingungen aus Abschnitt 4 (core_unlocked)
- Mechanik: „CORE ACCESS" in System, letzte Bestätigungsfrage
- Konsequenz: führt zum Ending-Screen

Datenformat-Vorschlag pro Rätsel in `puzzles.json`:
```json
{
  "puzzle_4": {
    "flag": "found_old_account_2038",
    "variants": [
      { "id": "A", "location": "profile", "solution": "account_creation_date" },
      { "id": "B", "location": "chat", "solution": "codeword_from_8471" },
      { "id": "C", "location": "search", "solution": "shutdown_then_0192" }
    ]
  }
}
```

---

## 7. MAIL, FORUM, SEARCH – INHALTE

### Mail (messages.json)
- System-Mail (immer sichtbar): „Welcome back" – „Account active. 0 systems require attention."
- Nachricht 1 (nach `found_8471_profile` + Mail erneut besucht): FROM 8471 – „Are you still there?"
- Nachricht 2 (nach `archive_file_purge_unlocked`): FROM SYSTEM – „user_0192 activity flagged. Pattern deviation detected."
- Nachrichten 3 & 4 (nach `found_developer_proof`): FROM SYSTEM – „Recall sequence initiated." / FROM unknown – „You built this. Don't you remember?"
- **Für vollen Umfang (Ziel: 20–30 Nachrichten):** Wende dieses Muster – eine System-Meldung + ein 8471-Dialogbeitrag pro wichtigem Flag – auf alle Flags aus Abschnitt 4 an. Erstelle für jede Nachricht 1–2 Textvarianten, seed-gewählt, damit sich Gespräche über mehrere Durchläufe unterschiedlich anfühlen.

### Chat-Dialog mit 8471 (dialogue.json)
Dialogbaum-Struktur, KEIN Freitext-Input (deutlich einfacher als NLP und erlaubt exaktes Story-Timing). Jeder Dialog-Knoten hat 2–3 feste Antwortoptionen. Beispielverlauf:
- 0192: „Who are you?" → 8471: „Someone who used to be like you. Careful what you search for. The system reads everything."
- (nach messages_with_8471 = 2) 8471: „You found the purge thread, didn't you. Don't post about it. Just read."
- (nach found_contradiction) 8471: „Good. Now you see it. The report doesn't match what they told us."
- (vor Rätsel 6) 8471: „You don't tell the system you found me. Do you understand?"
Für jede Dialogzeile 2 Textvarianten anlegen, seed-gewählt.

### Forum (forum.json)
**Thread 1: „Why is everyone disappearing?"** (von Anfang an sichtbar)
- Feste Antworten: „Hör auf, darüber zu schreiben." / „Das passiert schon seit Monaten." / „Wenn du das liest, geh offline." / „Es gibt kein Offline mehr."
- Neue Antwort nach `read_purge_thread`: seed-gewählt aus 2–3 Varianten, z. B. „Ich dachte, ich wäre der Letzte. Bin ich nicht. – vor 3 Minuten"

**Thread 2: „Server migration failure? Really?"** – Diskussion mit Detailwidersprüchen zur offiziellen Erklärung (liefert Fakten für Rätsel 3)

**Thread 3: „does anyone else feel watched"** – bekommt neue Antworten erst nach `found_contradiction`

### Suchergebnisse (search-results.json)
| Begriff | Initial | Nach Flags |
|---|---|---|
| `user 8471` | „No results found." | Profil-Link (nach found_8471_profile) |
| `the purge` | „No results found." | Verweis auf Thread 2 (nach chat_unlocked) |
| `2039` | Alter Artikel-Snippet | + Archiv-Datei-Treffer (nach found_contradiction), Text-Variante seed-gewählt |
| `who am I` | generisch | Hinweis auf „gelöschte" Seite (nach chat_unlocked) |
| `shutdown` | „No results found." | Zugang zu System/Core (nach core_unlocked) |
| `user 0192` | eigenes Profil | zusätzlicher alter Log-Eintrag (nach found_old_account_2038) |

---

## 8. WELTVERÄNDERUNGEN

**Server-Status (`serverStatusStage`, steigt automatisch mit erreichten Meilenstein-Flags):**
- 0: „All systems operational."
- 1 (nach chat_unlocked): „3 systems offline."
- 2 (nach found_contradiction): „4 systems offline."
- 3 (nach found_old_account_2038 + found_developer_proof): „SYSTEM 0192 UNSTABLE"
- 4 (nach core_unlocked): „CORE ACCESS GRANTED"

**Verschwindender Username:** In einer Nutzerliste (Forum/Chat) ist initial ein Username sichtbar, der nach Erreichen von `found_contradiction` verschwindet. Wähle ihn seed-basiert aus einem Pool von ~10 Namen (`data/usernames.json`).

**Profil-Activity-Log:** zeigt die letzten 3–5 Aktionen des Spielers chronologisch (aus `searchHistory` + wichtigen Flag-Events).

**Personalisierte Ending-Referenz:** Der Core-Screen zeigt vor der finalen Entscheidung eine kurze, dynamisch generierte Zeile, die referenziert, über welche Rätsel-Varianten der Spieler zum Ziel kam (z. B. „You found it through the files, not the archive."), basierend auf `puzzleVariants`.

---

## 9. DIE DREI ENDEN

**DELETE:**
> „TERMINATING NETWORK... Reconstructed users will be removed. 8471 will be removed. You will be removed. Are you sure? [Confirm]"
> Nach Bestätigung: Bildschirm wird schwarz, letzte Zeile: `CONNECTION LOST.`

**STAY:**
> „NETWORK MAINTAINED. All reconstructed users remain active."
> Chat öffnet sich letztmalig, 8471: „Thank you. I don't know if that was you or the system talking. Does it matter anymore?"
> Bildschirm bleibt aktiv, Cursor blinkt weiter.

**ESCAPE:**
> Bildschirm glitcht, Textfragmente: „YOU CANNOT—" / „SYSTEM ERR—" / „WAIT—"
> Dann: `CONNECTING...` wie zu Spielbeginn, aber: `Welcome, user_????.` – deutet einen neuen Zyklus an.

---

## 10. BUILD-REIHENFOLGE (Pakete – bitte nacheinander abarbeiten, nach jedem Paket kurz Rückmeldung geben)

**Paket 1 – Fundament**
- HTML/CSS-Grundgerüst (Terminal-Look, Scanlines, Glitch-Klassen)
- `seed.js`: PRNG + `pickVariant()`
- `state.js`: Flags/Counter lesen/setzen, LocalStorage Save/Load, Reset
- `router.js`: Umschalten zwischen den 10 Seiten ohne echten Reload

**Paket 2 – Statische Seiten**
- Home (Boot-Sequenz), Profile-Grundgerüst, System-Grundgerüst, Error, Files-Grundgerüst – UI ohne dynamischen Content

**Paket 3 – Content-System**
- `search-results.json` + Search-Seite mit Flag-/Varianten-abhängigen Ergebnissen
- `messages.json` + Mail-Inbox-Logik
- `forum.json` + Forum mit varianten-basierten neuen Antworten

**Paket 4 – Chat mit 8471**
- Dialogbaum-System nach `dialogue.json`, inkl. Textvarianten

**Paket 5 – Weltreaktivität**
- `flags-content-map.json` umsetzen: Server-Status-Eskalation, verschwindender Username, Profil-Activity-Log

**Paket 6 – Rätsel-Logik mit Varianten**
- Alle 6 Rätsel aus `puzzles.json`, inkl. Varianten-Auswahl beim ersten Erreichen und Einfrieren in `puzzleVariants`

**Paket 7 – Enden**
- Die 3 Ending-Screens inkl. personalisierter Referenzzeile

**Paket 8 – Polish**
- Sound-Trigger (Platzhalter reichen zunächst), Terminal-Tippeffekt für Texte, Timing/Delays

---

## START

Beginne jetzt mit **Paket 1**. Lege die Projektstruktur an, implementiere `seed.js`, `state.js` und `router.js`, sowie ein rudimentäres HTML/CSS-Grundgerüst mit Terminal-Look. Zeig mir danach kurz, was du gebaut hast, bevor wir zu Paket 2 übergehen.
