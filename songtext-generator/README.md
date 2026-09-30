# Multi-LLM Songtext-Generator

Lokale Single-Page-App (React + Vite), die deutsche Songtexte blockweise über
mehrere KI-Modelle hinweg erzeugt — jeder Song-Block kann von Claude (Anthropic)
oder Gemini (Google) geschrieben werden. Ziel ist ein Text, der durch den
Modellwechsel und harte Strategie-Vorgaben weniger stereotyp ausfällt.

## Start

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Produktions-Build nach dist/
npm run smoke     # Logik-Test ohne Netz: Prompts, Locks, Kritik, Silben, Export
npm run ui-check  # End-to-End im Browser, beide APIs gefälscht (siehe unten)
```

`ui-check` braucht einen laufenden `npm run dev` in einem zweiten Terminal und
einmalig `npx playwright install chromium`. Der Test fälscht beide Anbieter-
Antworten und prüft Streaming, Duell, Kritik, Silbenmaß und Export durch —
also alles außer den echten Endpunkten.

API-Keys werden im Settings-Panel eingetragen und liegen ausschließlich im
`localStorage` dieses Browsers. Sie gehen direkt an `api.anthropic.com` bzw.
`generativelanguage.googleapis.com` — es gibt kein Backend. Die App ist für den
**lokalen Betrieb** gedacht; nicht öffentlich deployen.

## Architektur

```
src/
  domain/          Fachwissen als Daten, keine UI, keine Netzwerkaufrufe
    strategies.js    die sechs Herangehensweisen + die drei Story-Pfade
    blockTypes.js    Block-Typen, Auto-Strategie-Zuweisung, Labels
    providers.js     welche Modelle pro Anbieter wählbar sind
  state/
    songReducer.js   reiner Reducer — einzige Stelle, die State verändert
    selectors.js     abgeleitete Werte (gelockter Kontext, Zeilenstatus …)
    persistence.js   localStorage für Song und Keys
    SongContext.jsx  Provider + Hooks
  services/
    promptBuilder.js Baut aus State + Block den Provider-neutralen Request
    generation.js    Orchestrierung: Request → Provider → Parsing → Action
    critique.js      Kreuz-Kritik: Prüfer-Wahl und JSON-Befunde
    syllables.js     Silbenheuristik und Metrik-Ableitung
    exporter.js      .txt- und .json-Export, Import mit Prüfung
    providers/
      http.js        Retry, Backoff, Abbruch, SSE-Reader (beide Anbieter)
      anthropic.js   Messages API, optional gestreamt
      gemini.js      generateContent, optional gestreamt
  components/        reine Darstellung, lösen nur Actions aus
```

Die Trennung ist bewusst streng: `promptBuilder` kennt keine HTTP-Details, die
Adapter kennen keine Songlogik, und die Komponenten kennen weder das eine noch
das andere. Ein neuer Anbieter braucht einen Eintrag in `domain/providers.js`
und ein Adapter-Modul mit der Signatur `(request, apiKey, options) => Promise<string>`.

### Datenfluss einer Generierung

```
Block + globaler State
  → buildRequest(state, block, mode)      … Prompt-Assembly
  → callProvider(request, keys)           … HTTP an Anthropic oder Google
  → parseFullResponse / parseLinePatch    … Aufräumen, Validieren
  → GENERATION_REPLACED / GENERATION_PATCHED
```

## Kernkonzepte

### Zeilen sind die Wahrheit

Ein Block hat keine Textspalte, sondern eine Liste von Zeilen
(`{ id, text, locked }`). Das Volltext-Textarea ist eine Projektion davon; beim
Tippen werden Zeilen positionsweise zurückgeschrieben, sodass Zeilen-Locks an
ihrer Position hängen bleiben. Das macht den Micro-Editor möglich, ohne einen
zweiten Zustand zu pflegen.

### Block-Lock = Kontext

Jeder Block hat eine Checkbox **Lock / Fertig**. Der Text jedes gelockten Blocks
geht bei *jedem* weiteren Aufruf als fester, unveränderbarer Kontext mit
(`FIXIERTER SONG-KONTEXT` im Prompt) — damit das Modell Bezüge herstellen kann,
statt jeden Block isoliert zu schreiben. Der Header jedes Blocks zeigt an,
welche Blöcke gerade als Kontext mitgehen.

### Zeilen-Lock = Micro-Edit

Innerhalb eines Blocks lässt sich jede Zeile einzeln locken. Sind sowohl
gelockte als auch freie Zeilen vorhanden, schaltet *Freie Zeilen generieren* auf
den Modus `lines`: Das Modell bekommt das nummerierte Zeilenraster mit den
gelockten Zeilen im Wortlaut und liefert ausschließlich `<nr>: <text>` für die
freien Nummern zurück. Antworten auf gelockte oder unbekannte Nummern werden
beim Parsen verworfen, und der Reducer schreibt grundsätzlich nie in eine
gelockte Zeile — der Lock hält also auf beiden Ebenen.

### Songwriting-Strategien

Die sechs Herangehensweisen liegen als Daten in `domain/strategies.js`. Jede hat
eine `directive` (geht wörtlich in den Prompt) und optionale `roleHints`, die je
nach Block-Rolle präzisieren — bei *Show, Don't Tell* etwa liefert eine Strophe
die Beweise und der Refrain das Urteil, aus derselben Strategie.

Pro Block gilt **AUTO** (Zuweisung nach Block-Typ aus `AUTO_STRATEGIES`) oder
manuelle Auswahl; der erste manuelle Klick schaltet automatisch auf manuell um.
Der Story-Pfad (Strategie 3) wird global gewählt, weil er den Aufbau des ganzen
Songs bestimmt; der Prompt leitet daraus die Rolle des einzelnen Blocks ab
(*Strophe 1 etabliert die Situation*, *Bridge zieht die Konsequenz* …).

Mit **Prompt prüfen** lässt sich der vollständige Payload vor dem Absenden
ansehen — System-Prompt, Vokabular-Pool, Story-Pfad, Strategien, gelockter
Kontext und Ausgabeformat.

## Design

Digitaler Brutalismus: keine abgerundeten Ecken (global per `border-radius: 0`
erzwungen), keine weichen Schatten, Asphaltschwarz mit Neongrün und reinem Weiß
als einzige Kontrastfarben. Monospace für alle Prompt-, Text- und Zeilenfelder,
serifenlose Schrift für das UI-Chrom.

## Varianten-Duell

*Varianten-Duell* lässt beide Modelle denselben Block schreiben — mit identischem
Prompt, identischem Kontext, identischen Strategien. Die Ergebnisse landen
**nicht** im Block, sondern nebeneinander daneben: übernommen wird per Klick,
ganz oder einzeln je Zeile. Der Vergleich ist der eigentliche Zweck der App,
deshalb entscheidet er sich sichtbar und nicht im Hintergrund.

Fällt ein Anbieter aus, bleibt die andere Variante brauchbar (`Promise.allSettled`);
der Fehler steht als Hinweis am Block.

## Kreuz-Kritik

*Kreuz-Kritik* schickt den fertigen Block an das **jeweils andere** Modell — mit
genau den Strategien, unter denen er geschrieben wurde. Der Prüfer schreibt
nichts um, sondern liefert JSON-Befunde: Zeilennummer, Schwere (`hart`/`weich`),
verletzte Strategie, Problem und ein konkreter Gegenvorschlag. Jeder Befund ist
einzeln annehmbar oder verwerfbar; eine Übernahme schreibt direkt in die Zeile
und legt vorher einen Schnappschuss ab.

Der Perspektivwechsel ist der Punkt: ein Modell erkennt die eigenen Reflexe
schlechter als die eines fremden. Ist nur ein Key hinterlegt, prüft das Modell
sich selbst — die UI kennzeichnet das als Selbstkritik, statt es zu verschweigen.

## Silben und Metrik

Der Zeilen-Editor zeigt je Zeile die Silbenzahl. Sobald Zeilen gelockt sind,
leitet sich daraus ein Zielmaß ab (Median der gelockten Zeilen), Ausreißer von
mehr als einer Silbe werden rot markiert — und der Prompt bekommt eine Zahl
(`Zielwert 10`) statt der weichen Ansage „passend zur Metrik".

Die Zählung ist eine **Heuristik** über Vokalgruppen und Diphthonge, kein
Aussprachewörterbuch. Für Songzeilen trägt das; bei Fremdwörtern und Eigennamen
kann sie danebenliegen. Die Tooltips sagen „geschätzt" dazu.

## Robustheit

- **Abbrechen**: jeder laufende Block hat einen eigenen `AbortController`,
  der Abbruch-Button steht neben dem Generieren-Button. Ein Abbruch ist kein
  Fehler und hinterlässt keinen Fehlerzustand.
- **Retry**: 429, 5xx und Netzwerkaussetzer werden bis zu viermal wiederholt,
  mit exponentiellem Backoff plus Jitter. `Retry-After` des Anbieters gewinnt.
  Die Wartezeit steht als Hinweis am Block.
- **Streaming**: beide Anbieter über SSE, die Ausgabe läuft live mit und wird
  erst am Ende in Zeilen zerlegt.
- **Verlauf**: jeder Modell-Lauf legt vorher einen Schnappschuss ab (max. 20 je
  Block). Wiederherstellen ist ein normaler Zustandswechsel und wird selbst
  wieder als Schnappschuss abgelegt — man kann sich also nicht aussperren.
- **Export**: `.txt` für den Songtext, `.json` für den Projektstand. Der
  JSON-Export enthält **keine API-Keys** und keine laufbezogenen Daten
  (Varianten, Kritik, Verlauf); der Import prüft Kennung und Version, bevor er
  den Zustand ersetzt.
