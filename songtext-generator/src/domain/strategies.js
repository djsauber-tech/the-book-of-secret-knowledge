/**
 * Die sechs verbindlichen Songwriting-Herangehensweisen.
 *
 * Jede Strategie ist Daten, nicht Prosa im Prompt-Code: `directive` wandert
 * wörtlich in den System-Prompt, `roleHints` präzisiert die Anweisung je
 * nach Block-Rolle (eine Strophe soll beweisen, ein Refrain urteilen).
 */
export const STRATEGIES = [
  {
    id: 'show_dont_tell',
    short: 'SHOW/TELL',
    name: 'Show, Don’t Tell (Beweise vs. Urteil)',
    summary: 'Strophen liefern die Quittungen, der Refrain das Urteil.',
    directive:
      'SHOW, DON’T TELL - BEWEISE VS. URTEIL: Die Strophen sind Beweisführung. ' +
      'Sie zeigen ausschließlich konkrete, physische Details und Handlungen - die "Quittungen", ' +
      'die belegen, dass der Refrain absolut wahr ist. Benenne in den Strophen kein Gefühl direkt. ' +
      'Der Refrain erklärt das Gefühl nicht, sondern liefert die klare emotionale Wahrheit und das ' +
      'endgültige Urteil auf den Punkt.',
    roleHints: {
      strophe:
        'Dieser Block ist Beweisführung: nur Quittungen (Objekte, Orte, Uhrzeiten, Handlungen). Kein Gefühlswort als Urteil.',
      refrain:
        'Dieser Block ist das Urteil: die emotionale Wahrheit auf den Punkt, ohne Erklärung und ohne Beweismaterial.',
      bridge:
        'Dieser Block kippt die Beweislage: ein letzter konkreter Beweis, der das Urteil des Refrains unausweichlich macht.'
    }
  },
  {
    id: 'emotional_knot',
    short: 'KNOTEN',
    name: 'Der Emotionale Knoten (Innere Konflikte)',
    summary: 'Zwei echte, gegensätzliche Gefühle reiben aneinander.',
    directive:
      'DER EMOTIONALE KNOTEN: Der Text baut auf der Reibung zweier echter, aber völlig gegensätzlicher ' +
      'Gefühle auf, die aufeinanderprallen (z.B. Nähe vs. Distanz, Gewissheit vs. Ungewissheit). ' +
      'Der Refrain benennt die eine Seite des Knotens, die Strophen beleuchten die andere Seite. ' +
      'Die Magie und das Knistern des Songs spielen sich genau in diesem inneren Zwiespalt ab - ' +
      'löse den Knoten nicht auf.',
    roleHints: {
      strophe: 'Beleuchte hier die Gegenseite dessen, was der Refrain behauptet.',
      refrain: 'Benenne hier genau eine Seite des Knotens - kompromisslos, ohne die Gegenseite zu erwähnen.',
      bridge: 'Hier prallen beide Seiten des Knotens direkt aufeinander.'
    }
  },
  {
    id: 'story_path',
    short: 'STORY',
    name: 'Strukturierte Story-Pfade',
    summary: 'Situations-, problem- oder gefühlsbasierter Aufbau.',
    directive:
      'STRUKTURIERTE STORY-PFADE: Der Songaufbau folgt streng dem global gewählten Erzählmuster. ' +
      'Halte die Rolle dieses Blocks innerhalb des Musters exakt ein und nimm nichts vorweg, ' +
      'was ein späterer Block leisten soll.',
    roleHints: {}
  },
  {
    id: 'shy',
    short: 'S-H-Y',
    name: 'Die S-H-Y-Methode',
    summary: 'Simile → How → Why für bildhafte Vergleiche.',
    directive:
      'DIE S-H-Y-METHODE: Bildhafte Vergleiche werden streng nach dem S-H-Y-Muster strukturiert. ' +
      'S (Simile): ein Vergleich wird aufgemacht. H (How): wie äußert sich dieser Vergleich im Detail? ' +
      'Y (Why): was ist der emotionale Grund dafür, der dem Bild seine Daseinsberechtigung gibt? ' +
      'Ein Vergleich ohne How und Why wird gestrichen.',
    roleHints: {}
  },
  {
    id: 'image_stacking',
    short: 'STACKING',
    name: 'Image Stacking',
    summary: 'Mehrere visuelle Schnappschüsse statt Allgemeinplätze.',
    directive:
      'IMAGE STACKING: Klischees und generische Aussagen (Typ "Es war ein schöner Tag") werden ' +
      'vollständig gestrichen. Stattdessen werden mehrere spezifische, visuelle Schnappschüsse ' +
      'hintereinander gestapelt, die sofort einen kleinen Film im Kopf des Zuhörers ablaufen lassen ' +
      'und die Szene aufbauen.',
    roleHints: {}
  },
  {
    id: 'power_positions',
    short: 'POWER',
    name: 'Fokus auf Power-Positionen',
    summary: 'Erste Zeile setzt die Szene, letzte Zeile bricht die Erwartung.',
    directive:
      'FOKUS AUF POWER-POSITIONEN: Die erste und die letzte Zeile jedes Abschnitts tragen das größte ' +
      'textliche Gewicht, weil sie die meiste Aufmerksamkeit des Ohrs bekommen. Die erste Zeile setzt ' +
      'die Szene, lenkt die Vorstellungskraft und liefert das Setup. Die letzte Zeile bricht die ' +
      'Erwartungshaltung, liefert den Twist oder fungiert als emotionale Punchline, die eine Reaktion auslöst.',
    roleHints: {}
  }
];

export const STRATEGY_BY_ID = Object.fromEntries(STRATEGIES.map((s) => [s.id, s]));

/** Die drei Erzählmuster aus Strategie 3 - global gewählt, pro Block ausgedeutet. */
export const STORY_PATHS = [
  {
    id: 'situational',
    name: 'Situationsbasiert',
    directive:
      'SITUATIONSBASIERT: Strophe 1 etabliert die Situation. Strophe 2 liefert den emotionalen Kontext. ' +
      'Die Bridge zieht eine Konsequenz.',
    roles: {
      'strophe:1': 'Etabliere die Situation.',
      'strophe:2': 'Liefere den emotionalen Kontext zur Situation aus Strophe 1.',
      'strophe:n': 'Führe die Situation weiter, ohne die Konsequenz der Bridge vorwegzunehmen.',
      bridge: 'Zieh die Konsequenz aus der Situation.'
    }
  },
  {
    id: 'problem',
    name: 'Problembasiert',
    directive:
      'PROBLEMBASIERT: Strophe 1 stellt ein Problem vor. Strophe 2 intensiviert oder verschärft es. ' +
      'Die Bridge bildet die finale Eskalation.',
    roles: {
      'strophe:1': 'Stelle das Problem vor.',
      'strophe:2': 'Verschärfe das Problem aus Strophe 1.',
      'strophe:n': 'Verschärfe weiter - die Eskalation bleibt der Bridge vorbehalten.',
      bridge: 'Liefere die finale Eskalation.'
    }
  },
  {
    id: 'feeling',
    name: 'Gefühlsbasiert',
    directive:
      'GEFÜHLSBASIERT: Strophe 1 beschreibt intensiv ein Gefühl. Strophe 2 wirft ein Hindernis oder ' +
      'eine Hürde auf. Eine Bridge ist hier nicht zwingend vorgesehen.',
    roles: {
      'strophe:1': 'Beschreibe das Gefühl intensiv.',
      'strophe:2': 'Wirf ein Hindernis oder eine Hürde auf.',
      'strophe:n': 'Halte das Gefühl unter Spannung, ohne es aufzulösen.',
      bridge: 'In diesem Pfad optional - nur einsetzen, wenn das Hindernis eine eigene Zuspitzung braucht.'
    }
  }
];

export const STORY_PATH_BY_ID = Object.fromEntries(STORY_PATHS.map((p) => [p.id, p]));
