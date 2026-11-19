import { seasonOf } from './season';
import type { Data } from './types';
import { rowPoints } from './winner';

/**
 * Season titles, handed out when a season ends. Places go by season points (the
 * same scoring that decides a hunt's winner: drake 3, hen 2, rare-bird bonus,
 * coot 0), ties by most birds; ties beyond that share the title. The coot title
 * stacks with anything else.
 */

export type HonorId = 'first' | 'second' | 'third' | 'coots';

export const HONORS: Record<HonorId, { title: string; icon: string; why: string }> = {
  first: { title: 'Grand Poombah of the Ducksters, Supreme Anatid Overlord', icon: '👑', why: '#1 for the season' },
  second: { title: 'Mr. Waddlsworth', icon: '🎩', why: '#2 for the season' },
  third: { title: 'Decoy Duffer', icon: '🪵', why: '#3 for the season' },
  coots: { title: 'Scourge of the Ditch Chickens', icon: '🐓', why: 'most coots of the season' },
};

export type Honor = { id: HonorId; hunterIds: string[]; value: number };

export function seasonPoints(data: Data, season: number): Map<string, { points: number; birds: number; coots: number }> {
  const huntSeason = new Map(data.hunts.map((h) => [h.id, seasonOf(h.date)]));
  const out = new Map<string, { points: number; birds: number; coots: number }>();
  for (const r of data.harvests) {
    if (huntSeason.get(r.huntId) !== season) continue;
    const e = out.get(r.hunterId) ?? { points: 0, birds: 0, coots: 0 };
    e.points += rowPoints(r);
    e.birds += r.count;
    if (r.speciesId === 'amco') e.coots += r.count;
    out.set(r.hunterId, e);
  }
  return out;
}

export function seasonHonors(data: Data, season: number): Honor[] {
  const totals = seasonPoints(data, season);
  const ranked = Array.from(totals.entries())
    .filter(([, t]) => t.points > 0)
    .sort((a, b) => b[1].points - a[1].points || b[1].birds - a[1].birds);

  // Group into places: hunters with the same points and birds share a place.
  const places: { ids: string[]; points: number }[] = [];
  for (const [id, t] of ranked) {
    const last = places[places.length - 1];
    const lastT = last ? totals.get(last.ids[0])! : null;
    if (last && lastT && lastT.points === t.points && lastT.birds === t.birds) last.ids.push(id);
    else places.push({ ids: [id], points: t.points });
  }

  const out: Honor[] = [];
  (['first', 'second', 'third'] as const).forEach((id, i) => {
    if (places[i]) out.push({ id, hunterIds: places[i].ids, value: places[i].points });
  });

  const cootMax = Math.max(0, ...Array.from(totals.values()).map((t) => t.coots));
  if (cootMax > 0) {
    out.push({ id: 'coots', hunterIds: Array.from(totals.entries()).filter(([, t]) => t.coots === cootMax).map(([id]) => id), value: cootMax });
  }
  return out;
}

/** Every title a hunter holds from finished seasons, newest first. */
export function honorsFor(data: Data, hunterId: string, seasons: number[]): { season: number; id: HonorId }[] {
  return seasons.flatMap((season) =>
    seasonHonors(data, season)
      .filter((h) => h.hunterIds.includes(hunterId))
      .map((h) => ({ season, id: h.id })),
  );
}
