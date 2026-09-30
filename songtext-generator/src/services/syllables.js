/**
 * Silbenzählung für deutsche Songzeilen.
 *
 * Bewusst eine Heuristik, kein Wörterbuch: gezählt werden Vokalgruppen, wobei
 * Diphthonge und die typischen Digraphen als eine Silbe gelten. Für die
 * Metrik-Anzeige im Zeilen-Editor reicht das - als exakte phonetische Analyse
 * ist es nicht gedacht, und die UI kennzeichnet den Wert entsprechend.
 */

const VOWELS = 'aeiouäöüy';

// Zwei Zeichen, die zusammen eine Silbe bilden.
const DIGRAPHS = ['au', 'ei', 'ai', 'eu', 'äu', 'ey', 'ay', 'ie', 'oi', 'ui'];

/** Silben eines einzelnen Wortes. */
export function syllablesInWord(rawWord) {
  const word = rawWord.toLowerCase().replace(/[^a-zäöüß]/g, '');
  if (word.length === 0) return 0;

  let count = 0;
  let i = 0;
  let previousWasVowel = false;

  while (i < word.length) {
    const pair = word.slice(i, i + 2);
    const char = word[i];

    // "qu" ist kein Vokalkontakt - das u zählt hier nicht als eigener Kern.
    if (char === 'q' && word[i + 1] === 'u') {
      previousWasVowel = false;
      i += 2;
      continue;
    }

    if (DIGRAPHS.includes(pair)) {
      count += 1;
      previousWasVowel = false;
      i += 2;
      continue;
    }

    if (VOWELS.includes(char)) {
      // "y" nur als Vokal werten, wenn es allein steht (Rhythmus, System).
      if (!previousWasVowel) count += 1;
      previousWasVowel = true;
      i += 1;
      continue;
    }

    previousWasVowel = false;
    i += 1;
  }

  // Jedes geschriebene Wort hat mindestens eine Silbe.
  return Math.max(count, 1);
}

/** Silben einer ganzen Zeile. Leere Zeilen zählen 0. */
export function syllablesInLine(line) {
  const words = line.split(/[\s—–-]+/).filter((w) => /[a-zäöüßA-ZÄÖÜ]/.test(w));
  return words.reduce((sum, word) => sum + syllablesInWord(word), 0);
}

/**
 * Metrik-Profil eines Blocks: Silben je Zeile plus das Zielmaß, das sich aus
 * den gelockten Zeilen ergibt. Ohne gelockte Zeilen gibt es kein Ziel - dann
 * zeigt die UI nur die Zählung.
 */
export function meterProfile(block) {
  const counts = block.lines.map((line) => syllablesInLine(line.text));
  const lockedCounts = block.lines
    .map((line, i) => (line.locked && line.text.trim() ? counts[i] : null))
    .filter((n) => n !== null);

  if (lockedCounts.length === 0) {
    return { counts, target: null, min: null, max: null };
  }

  const min = Math.min(...lockedCounts);
  const max = Math.max(...lockedCounts);
  // Zielwert ist der Median der gelockten Zeilen - robuster als der Mittelwert,
  // wenn eine einzelne Zeile deutlich aus der Reihe fällt.
  const sorted = [...lockedCounts].sort((a, b) => a - b);
  const target = sorted[Math.floor(sorted.length / 2)];

  return { counts, target, min, max };
}

/**
 * Silbenvorgabe für den Prompt. Nur sinnvoll, wenn gelockte Zeilen existieren -
 * dann bekommt das Modell eine Zahl statt "passend zur Metrik".
 */
export function meterInstruction(block) {
  const { counts, target, min, max } = meterProfile(block);
  if (target === null) return null;

  const lockedRows = block.lines
    .map((line, i) => (line.locked && line.text.trim() ? `Zeile ${i + 1}: ${counts[i]} Silben` : null))
    .filter(Boolean);

  const span = min === max ? `${target}` : `${min}-${max}`;
  return [
    'SILBENVORGABE (aus den gelockten Zeilen abgeleitet):',
    lockedRows.join(', ') + '.',
    `Die neuen Zeilen sollen im selben Maß liegen: ${span} Silben, Zielwert ${target}.`,
    'Weiche höchstens um eine Silbe ab, sonst bricht der Gesang.'
  ].join('\n');
}
