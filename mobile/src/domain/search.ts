import { CUSTOM_SPECIES, SPECIES, speciesVersion, type Species } from './species';

/**
 * Species search for the hunt log. The goal is one or two keystrokes per bird:
 * "gw" → Green-winged Teal, "spoon" → Shoveler, "can" → Canvasback, "gwt" → the
 * initials of Green-Winged Teal, "malard" → Mallard (one typo forgiven).
 *
 * Usage counts from this phone's own logs break ties, so the birds this family
 * actually shoots float to the top.
 */

export type UsageCounts = Record<string, number>;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

type Indexed = { species: Species; names: string[]; words: string[]; initials: string[] };

function indexOf(species: Species): Indexed {
  const names = [species.name, ...species.aliases].map(norm);
  const words = Array.from(new Set(names.flatMap((n) => n.split(' '))));
  const initials = names.map((n) => n.split(' ').map((w) => w[0]).join(''));
  return { species, names, words, initials };
}

const BUILT_IN = SPECIES.map(indexOf);
let cache: { version: number; index: Indexed[] } | null = null;

/** Built-in birds plus the ones the user added; rebuilt when that list changes. */
function index(): Indexed[] {
  if (!cache || cache.version !== speciesVersion) cache = { version: speciesVersion, index: [...BUILT_IN, ...CUSTOM_SPECIES.map(indexOf)] };
  return cache.index;
}

/** Levenshtein distance capped at 2 — anything further is "no match". */
function closeEnough(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length] <= 1;
}

function score(entry: Indexed, q: string, tokens: string[]): number {
  const { species, names, words, initials } = entry;
  if (q === species.id) return 1000;
  if (names[0] === q) return 980;
  if (names.includes(q)) return 950;
  if (names[0].startsWith(q)) return 900;
  if (names.some((n) => n.startsWith(q))) return 860;
  if (q.length >= 2 && initials.includes(q)) return 840;
  if (q.length >= 2 && species.id.startsWith(q)) return 800;

  // Every typed word is the start of some word of one name ("green tea", "w duck").
  const tokensMatchOneName = names.some((n) => {
    const nameWords = n.split(' ');
    return tokens.every((t) => nameWords.some((w) => w.startsWith(t)));
  });
  if (tokensMatchOneName) return 700;

  if (tokens.every((t) => words.some((w) => w.startsWith(t)))) return 600;
  if (names.some((n) => n.includes(q))) return 450;
  if (q.length >= 4) {
    const fuzzy = (pool: string[]) =>
      tokens.every((t) => pool.some((w) => closeEnough(t, w) || closeEnough(t, w.slice(0, t.length + 1))));
    // A typo of the real name beats a typo of a nickname ("malard" → Mallard, not "black mallard").
    if (fuzzy(names[0].split(' '))) return 320;
    if (fuzzy(words)) return 300;
  }
  return 0;
}

export function searchSpecies(query: string, usage: UsageCounts = {}, limit = 8): Species[] {
  const q = norm(query);
  if (!q) return topByUsage(usage, limit);
  const tokens = q.split(' ');
  return index().map((e) => ({ e, s: score(e, q, tokens) }))
    .filter((r) => r.s > 0)
    .map((r) => ({ ...r, s: r.s + Math.min(usage[r.e.species.id] ?? 0, 40) }))
    .sort((a, b) => b.s - a.s || a.e.species.name.localeCompare(b.e.species.name))
    .slice(0, limit)
    .map((r) => r.e.species);
}

/** Quick-pick chips before anything is typed: most-logged first, then the usual suspects. */
export function topByUsage(usage: UsageCounts, limit = 8): Species[] {
  const defaults = ['mall', 'gwte', 'bwte', 'wodu', 'gadw', 'amwi', 'nopi', 'cago'];
  const ranked = Object.entries(usage)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const ids = Array.from(new Set([...ranked, ...defaults])).slice(0, limit);
  return ids.map((id) => index().find((e) => e.species.id === id)?.species).filter((s): s is Species => !!s);
}
