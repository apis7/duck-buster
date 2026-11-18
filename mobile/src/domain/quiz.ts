import { SPECIES, SPECIES_BY_ID } from './species';

/**
 * Duck ID quiz: show a photo or play a call, pick the bird from seven choices.
 * Distractors come from the same group first (teal vs teal is a real test;
 * teal vs Canada goose is not), then fill from anywhere.
 */

export const CHOICES = 7;
export const ROUND = 10;

export type QuizKind = 'image' | 'audio';
export type Question = { speciesId: string; kind: QuizKind; choices: string[] };

type Rng = () => number;

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeChoices(answer: string, rng: Rng = Math.random): string[] {
  const group = SPECIES_BY_ID[answer]?.group;
  const same = shuffle(SPECIES.filter((s) => s.id !== answer && s.group === group).map((s) => s.id), rng);
  const rest = shuffle(SPECIES.filter((s) => s.id !== answer && s.group !== group).map((s) => s.id), rng);
  // At most four look-alikes, so there's always something to rule out.
  const picks = [...same.slice(0, 4), ...rest].slice(0, CHOICES - 1);
  return shuffle([answer, ...picks], rng);
}

/**
 * A round of questions. Each species appears at most once; sound questions are
 * mixed in when calls are available (roughly one in three).
 */
export function makeRound(images: string[], sounds: string[], rng: Rng = Math.random, size = ROUND): Question[] {
  const soundSet = new Set(sounds);
  const pool = shuffle(Array.from(new Set([...images, ...sounds])), rng).slice(0, size);
  return pool.map((speciesId) => {
    const hasImage = images.includes(speciesId);
    const hasSound = soundSet.has(speciesId);
    const kind: QuizKind = hasSound && (!hasImage || rng() < 0.35) ? 'audio' : 'image';
    return { speciesId, kind, choices: makeChoices(speciesId, rng) };
  });
}

export function quizRank(score: number, of: number): string {
  const pct = of ? score / of : 0;
  if (pct === 1) return 'Duck Professor';
  if (pct >= 0.8) return 'Sharp Eye';
  if (pct >= 0.6) return 'Decent Birder';
  if (pct >= 0.4) return 'Squints a Lot';
  return 'Shoots Gadwall';
}
