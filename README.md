# OFFLINE

Browser-Spiel (Mystery / Psychological Thriller / Exploration / Puzzle). Der Spieler bedient eine simulierte
Browser-Oberfläche auf einem scheinbar verlassenen Computer und entdeckt, dass er nicht allein ist.

Vollständiges Game Design: [`OFFLINE_Claude_Code_Prompt.md`](OFFLINE_Claude_Code_Prompt.md)

- **Tech:** reines HTML/CSS/JS (Vanilla, keine Frameworks, kein Build-Schritt), Speicherstand in LocalStorage
- **Kernprinzip:** nicht linear gescriptet – jeder Durchlauf hat einen Seed, der deterministisch Rätsel-Varianten und Textvarianten auswählt
- **Sprache im Spiel:** Englisch
- **Repository:** [github.com/ArcticStorm243/Offline](https://github.com/ArcticStorm243/Offline)

---

## Starten

Die Daten liegen in `data/*.json` und werden per `fetch()` geladen – Browser blockieren das bei `file://`.
Deshalb im Projektordner einen lokalen Server starten:

```
python -m http.server 8080
```
(oder `npx serve .`) und dann `http://localhost:8080` öffnen. Ohne Server zeigt das Spiel eine Fehlerseite mit genau diesem Hinweis.

**Beim ersten Start** wartet das Spiel mit „[ press any key to connect ]“ auf eine Eingabe – Browser erlauben Audio erst nach einer Nutzergeste, so ist der Boot-Sound (Modem, Tippen) hörbar. `[ sound: on/off ]` im Footer schaltet den Ton (Einstellung bleibt in LocalStorage).

**Debug in der Browser-Konsole:** `window.OFFLINE` enthält `State, Seed, Content, Router, FX, World, Puzzles, SFX`.

```js
OFFLINE.State.setFlag('chat_unlocked')          // Flag setzen (ohne Requirements-Prüfung)
OFFLINE.State.tryUnlock('core_unlocked')        // Flag setzen, nur wenn Voraussetzungen erfüllt
OFFLINE.State.getState()                        // kompletter Save
OFFLINE.State.resetGame()                       // neuer Seed, alles zurück
OFFLINE.Puzzles.codeword()                      // Codewort für Rätsel 4 / Variante B
OFFLINE.State.getState().puzzleVariants         // eingefrorene Varianten
OFFLINE.SFX.play('modem')                       // Sound testen (Namen: siehe js/audio.js)
```
`[ new game ]` unten rechts setzt den Spielstand zurück (neuer Seed).

---

## Build-Status

| Paket | Inhalt | Status |
|---|---|---|
| 1 – Fundament | HTML/CSS-Gerüst, `seed.js`, `state.js`, `router.js`, `content.js` | ✅ fertig |
| 2 – Statische Seiten | Home (Boot), Profile, System, Files, Archive, Error | ✅ fertig |
| 3 – Content-System | Search, Mail, Forum aus JSON mit Flags + Varianten | ✅ fertig |
| 4 – Chat mit 8471 | Dialogbaum aus `dialogue.json`, Textvarianten | ✅ fertig |
| 5 – Weltreaktivität | Server-Status-Eskalation, Activity-Log, verschwindender User, Archiv-Report, Previous sessions | ✅ fertig |
| 6 – Rätsel-Logik | alle 6 Rätsel, Rätsel 4 + 5 mit je 3 Varianten, Einfrieren in `puzzleVariants`, Core-Freischaltung | ✅ fertig |
| 7 – Enden | DELETE / STAY / ESCAPE inkl. personalisierter Referenzzeile, Neustart-Zyklus | ✅ fertig |
| 8 – Polish | `audio.js` (synthetische SFX, Brummen, Stille, Toggle), Zeichen-für-Zeichen-Tippeffekt, Timing | ✅ fertig |

Alle acht Pakete aus dem Design-Dokument sind umgesetzt. Offen bleibt nur das Ersetzen der synthetischen Platzhalter-Sounds durch echte Aufnahmen (siehe „Sound“).

---

## Projektstruktur

```
index.html                  Layout: Statusleiste, Navigation, #app, Footer; lädt alle Skripte
css/style.css               Terminal-Look, Scanlines, Vignette, Glitch-/Flicker-Klassen, Seitenkomponenten
js/
  seed.js                   mulberry32-PRNG, String-Hash, pickVariant / shuffle / intBetween
  state.js                  Save-Struktur, Flags, Counter, LocalStorage, canUnlock/tryUnlock, Varianten einfrieren, Logs, Chat-State
  content.js                lädt data/*.json, Bedingungs-Checker, Textvarianten, {{platzhalter}}, Page-Builder
  router.js                 Hash-Routing (#/seite/param?q=…), Seitenregistrierung, Before/After-Hooks
  ui.js                     Render-Helfer (kv, table, section), Tippeffekte typeText / typeLines, In-Game-Zeit (+15 Jahre)
  audio.js                  SFX: Web-Audio-Synthese aller Sounds, Brummen, silence(), Ticks, Mute-Toggle, Datei-Overrides
  world.js                  Server-Status-Eskalation, Activity-Log-Beschriftung
  puzzles.js                Varianten einfrieren, Auto-Flags, Eingabeprüfung Rätsel 4, Such-Kombination, Referenzzeilen
  main.js                   Bootstrap, Statusleiste, Mail-Badge, FX (Glitch-Burst, Blackout)
  pages/
    home.js                 Boot-Sequenz (einmal pro Browser-Session), Service-Index
    search.js               Suche mit Effekten, verzögerter „Index-Korrektur“, Actions (Rätsel 3)
    mail.js                 Inbox, Nachricht, Anhang (#/mail/<id>/att), verzögerte Mail-Ankunft
    forum.js                Threads, Antworten mit Varianten, „users seen recently“
    profile.js              eigenes Profil, user_8471, Recent activity, Previous sessions + Rätsel-4-Formular
    chat.js                 Dialogbaum mit 8471, Tipp-Verzögerung, Transkript
    system.js               Status, Diagnostics, Logs, CORE ACCESS
    files.js                FileBrowser (auch für Archive), Files-Seite
    archive.js              Archive-Seite
    error.js                404 / 403 / 500
    ending.js               die drei Enden + Reload-Guard
data/
  flags-content-map.json    requirements (Flag-Voraussetzungen), serverStatus-Regeln, activityLabels, contentMap (Doku)
  puzzles.json              6 Rätsel, Varianten, Hinweise, Referenzzeilen
  search-results.json       Suchbegriffe, flag-abhängige Ergebnisse, Effekte, Actions
  messages.json             22 Mails (14 mit Textvarianten)
  forum.json                5 Threads inkl. Varianten-Antworten
  dialogue.json             9 Chat-Knoten mit 2–3 Antwortoptionen
  files.json                Dateien für Files / Archive / Mail-Anhänge
  profile.json              Legacy-Account, Previous-sessions-Logs (2 Varianten)
  endings.json              Texte der drei Enden
  usernames.json            Pool für den verschwindenden Username
assets/sounds/              leer – hier landen später echte Aufnahmen (per SFX.register einhängen)
```

---

## Architektur

### Seed & Varianten
- Der Seed entsteht bei „New Game“ und ändert sich nie.
- `Seed.pickVariant(seed, poolId, options)`: Seed + Pool-ID (z. B. `"mail.8471_still_there.body"`) → immer dieselbe Variante. Verschiedene Pools würfeln unabhängig.
- **Textvarianten:** überall, wo in den JSON-Dateien ein String stehen kann, darf auch ein Array stehen – `Content.text(value, poolId)` wählt seed-stabil.
- **Rätsel-Varianten:** `puzzles.json → reachedWhen` legt fest, wann ein Rätsel „erreicht“ ist. In diesem Moment wird die Variante gewürfelt und in `state.puzzleVariants` eingefroren (Rätsel 4 bei `chat_unlocked`, Rätsel 5 bei `archive_file_purge_unlocked` oder `found_old_account_2038`).

### Flags & Voraussetzungen
- Requirements-Tabelle in `flags-content-map.json`, ausgewertet von `State.canUnlock(flag)`. Keine if-Ketten im Code.
- `State.tryUnlock(flag)` setzt nur, wenn die Voraussetzungen erfüllt sind – alle Content-Trigger (Effekte, `onRead`, `onOpen`, Actions, Dialog-Optionen) benutzen das.
- `core_unlocked` wird automatisch gesetzt (`puzzles.json → auto`), sobald Beweis + altes Konto + ≥ 3 Chat-Nachrichten vorliegen – Reihenfolge egal.

### Bedingungen in den JSON-Dateien (`when`)
```json
{ "flag": "x" }  { "notFlag": "x" }  { "all": ["a","b"] }  { "any": ["a","b"] }
{ "counter": "messages_with_8471", "min": 2 }  { "variant": { "puzzle_5": "A" } }
```
Beliebig kombinierbar; fehlt `when`, ist der Eintrag immer sichtbar.

### Zustand (`offline_save` in LocalStorage)
`seed, flags, counters, searchHistory, visitedPages, messagesRead, puzzleVariants, eventLog, firstSeen, chat{log,done,opened,pending}, endingChosen`.
`firstSeen` merkt sich, wann eine Mail/ein Post erstmals sichtbar wurde (stabile Zeitstempel). Zusätzlich `offline_meta` (Zyklus-Zähler, gesehene Enden) außerhalb des Saves.

### In-Game-Zeit
Echte Uhr + 15 Jahre (`UI.gameNow()`), damit Zeitstempel zur Purge-Chronologie passen: alter Account 2038, Purge 2039-04-11, eigener Account 2040, Spiel „jetzt“ 2041.

### Sound (`js/audio.js`)
- Alle Sounds werden zur Laufzeit mit der Web Audio API synthetisiert – keine Audiodateien nötig. Echte Aufnahmen später per `SFX.register('modem', 'assets/sounds/modem.ogg')` einhängen (wird dann statt der Synthese abgespielt).
- Sound-Namen: `key`, `keys`, `tick`, `click`, `hdd`, `modem`, `notify`, `unlock`, `error`, `static`, `static_long`, `tone_delete|stay|escape`.
- `SFX.silence(ms)` blendet alles aus (auch das Grundbrummen) – bewusste Stille nach dem Boot („0 users online“), nach Status-Eskalationen (Stage 3 länger) und während der Enden-Sequenzen; `SFX.play(name, { force: true })` durchbricht sie (der eine tiefe Ton pro Ende).
- `SFX.ticks()` / `stopTicks()`: zufällige leise Anschläge, solange „8471 is typing“ steht.
- Globale Trigger in `main.js`: Tastendruck in Eingabefeldern → `key`, Klick auf Links/Buttons → `click`.
- Der AudioContext entsteht erst bei der ersten Nutzergeste (Browser-Autoplay-Regel). HOME zeigt deshalb vor dem Boot „press any key to connect“, wenn Ton an, aber noch nicht freigeschaltet ist. Vorher aufgerufene `play()` verpuffen stumm.

### Tippeffekt (`UI.typeText`, `UI.typeLines`)
- `typeText(el, { charDelay, jitter, sound, onChar })` tippt alle Textknoten eines Elements zeichenweise (HTML-Tags bleiben erhalten); `cancel()` zeigt den Rest sofort.
- `typeLines(container, lines, opts)` baut Zeile für Zeile auf; jede Zeile kann `{ html, cls, delay, sfx }` sein – `sfx` spielt beim Zeilenstart (Boot: `modem`, `click`, `hdd`). `sound: null` schaltet die Tick-Sounds ab (Enden).
- Chat: Antworten von 8471 werden nach der „is typing“-Verzögerung zeichenweise in den Verlauf getippt (`appendLine(el, who, text, done)`); der Save ist vorher schon aktualisiert, ein Seitenwechsel verliert nichts.
- Suche: „querying index…“ ~0,5–0,8 s mit Festplattengeräusch vor den Ergebnissen; die Index-Korrektur nach 1,6 s bleibt.

---

## Spielablauf (Referenz)

| Rätsel | Trigger | Flag |
|---|---|---|
| 1 Wer ist 8471? | Suche `user 8471` **oder** Forum-Thread „roll call“ lesen | `found_8471_profile` |
| 2 Erstkontakt | Mail „Are you still there?“ (kommt in der Inbox an) → Chat: „Who are you?“ / „Yes, I'm here.“ | `replied_to_8471` → `chat_unlocked` |
| 3 Widerspruch | Suche `the purge` + Thread 2 lesen → „Report contradiction“ in Search | `found_contradiction` |
| 4 Altes Konto | **A:** Profil – Erstellungsdatum eingeben · **B:** Profil – Codewort aus dem Chat · **C:** `shutdown` suchen, dann `0192` | `found_old_account_2038` |
| 5 Beweis | `core_dev_notes.txt` – **A:** Files · **B:** Archive (`blk_0x3f2.corrupted`) · **C:** Mail-Anhang von `[no sender]` | `found_developer_proof` |
| 6 Kern | System → CORE ACCESS → Wahl + Bestätigung | Ende |

**Server-Status:** 0 „All systems operational.“ → 1 (chat_unlocked) → 2 (found_contradiction) → 3 „SYSTEM 0192 UNSTABLE“ (altes Konto + Beweis) → 4 „CORE ACCESS GRANTED“.

**Enden:** DELETE (Blackout, `CONNECTION LOST.`), STAY (Netz bleibt, letzte Chat-Zeile von 8471, Spiel bleibt bedienbar), ESCAPE (Glitch, Boot für `user_????`). DELETE/ESCAPE → beliebige Taste startet einen neuen Zyklus mit neuem Seed.

---

## Content erweitern

- **Neue Mail:** Eintrag in `messages.json` mit `when`; `body` als Array = Varianten; `openInChat: true` zeigt „open in chat“; `attachment: { fileId }` verweist auf einen `files.json`-Eintrag mit `location: "attachment"`.
- **Neue Forum-Antwort:** Post mit `when` in den Thread hängen; `date: "rel:-3"` = „3 minutes ago“; `author: "__VANISH__"` = verschwindender Username.
- **Neue Datei:** `files.json`, `location: files | archive | attachment`, `status: ok | corrupted | restricted | locked`, `onOpen: { setFlag }`.
- **Neuer Chat-Knoten:** `dialogue.json`, Knoten mit `when`, `line`, `options[]` (`reply`, optional `setFlag`, `next`); `group` verhindert, dass alternative Knoten beide erscheinen.
- **Neuer Suchbegriff:** `search-results.json → queries[]` mit `match`, `results[]` (`when`, `route`, `snippet`), optional `effects[]`.
- **Platzhalter:** `{{codeword}}` in beliebigen Texten; neue per `Content.registerVar(name, fn)`.
