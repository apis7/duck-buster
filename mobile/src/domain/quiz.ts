import { quizWeight } from './regs';
import { SPECIES, SPECIES_BY_ID } from './species';

/**
 * Duck ID quiz: show a photo or play a call, pick the bird from seven choices.
 * Only the right answer is fixed: the six wrong ones are drawn fresh every time,
 * usually with a few look-alikes from the same group (teal vs teal is a real test).
 */

export const CHOICES = 7;
export const ROUND = 10;

export type QuizKind = 'image' | 'audio';
/** `mediaId`: which photo (a species can have a drake and a hen photo). */
export type Question = { speciesId: string; kind: QuizKind; choices: string[]; mediaId?: string };

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
  // A random number of look-alikes (0–3), so the wrong answers differ every time the
  // question comes up — even in small groups — and there's always something to rule out.
  const alike = Math.floor(rng() * (Math.min(3, same.length) + 1));
  const picks = [...same.slice(0, alike), ...rest].slice(0, CHOICES - 1);
  return shuffle([answer, ...picks], rng);
}

/**
 * Weighted draw without repeats: common South Dakota birds come up far more often
 * than rarities (each item's key is rng^(1/weight); the biggest keys win).
 */
function weightedPick(ids: string[], n: number, weight: (id: string) => number, rng: Rng): string[] {
  return ids
    .map((id) => ({ id, key: Math.pow(rng(), 1 / Math.max(0.01, weight(id))) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((x) => x.id);
}

/**
 * A round of questions. Each species appears at most once, picked by how common
 * it is in South Dakota; sound questions are mixed in when calls are available
 * (roughly one in three).
 */
export function makeRound(images: string[], sounds: string[], rng: Rng = Math.random, size = ROUND, weight: (id: string) => number = quizWeight): Question[] {
  const soundSet = new Set(sounds);
  const pool = weightedPick(Array.from(new Set([...images, ...sounds])), size, weight, rng);
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
