# Multi-LLM Songtext-Generator

Lokale Single-Page-App (React + Vite), die deutsche Songtexte blockweise über
mehrere KI-Modelle hinweg erzeugt — jeder Song-Block kann von Claude (Anthropic)
oder Gemini (Google) geschrieben werden. Ziel ist ein Text, der durch den
Modellwechsel und harte Strategie-Vorgaben weniger stereotyp ausfällt.

## Start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Produktions-Build nach dist/
npm run smoke    # Logik-Test: Prompt-Bau, Kontext, Line-Patching (ohne Netz)
```

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
    providers/       je ein HTTP-Adapter pro Anbieter + Registry
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
