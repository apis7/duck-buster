import { formatMeat } from './meat';
import { prettyDate, seasonLabel } from './season';
import { SPECIES, SPECIES_BY_ID } from './species';
import { hunterDays, hunterStats, statsFromDays } from './stats';
import type { Data } from './types';

/** Season Wrapped: a stack of big-number cards for one hunter's season. */

export type WrappedCard = { kicker: string; big: string; caption: string };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function seasonWrapped(data: Data, hunterId: string, season: number, titleName: string): WrappedCard[] {
  const days = hunterDays(data, hunterId, { season });
  if (days.length === 0) return [];
  const s = statsFromDays(days);
  const cards: WrappedCard[] = [];

  cards.push({
    kicker: `Your ${seasonLabel(season)} season`,
    big: `${s.hunts}`,
    caption: s.hunts === 1 ? 'hunt. Quality over quantity.' : 'hunts. Alarm clock: defeated.',
  });

  cards.push({
    kicker: 'Birds in the bag',
    big: `${s.birds}`,
    caption: s.birds === 0 ? 'Zero. But what a sunrise.' : s.birds >= 50 ? 'The ducks are filing a complaint.' : 'Every one of them earned.',
  });

  if (s.meatOz > 0) {
    cards.push({
      kicker: 'In the freezer',
      big: formatMeat(s.meatOz).replace('≈ ', ''),
      caption: s.meatOz >= 16 * 20 ? 'of meat (roughly). Time for a bigger freezer.' : 'of meat, give or take. Fire up the grill.',
    });
  }

  const fav = Object.entries(s.bySpecies).sort((a, b) => b[1] - a[1])[0];
  if (fav) {
    const sp = SPECIES_BY_ID[fav[0]];
    cards.push({ kicker: 'Your duck of the year', big: sp?.name ?? fav[0], caption: `${fav[1]} of them. A real fan.` });
  }

  if (s.biggestDay) {
    cards.push({
      kicker: 'Your biggest day',
      big: `${s.biggestDay.birds}`,
      caption: `birds on ${prettyDate(s.biggestDay.hunt.date)}. Still talking about it.`,
    });
  }

  if (s.drakes + s.hens >= 3) {
    const pct = Math.round((s.drakes / (s.drakes + s.hens)) * 100);
    cards.push({
      kicker: 'Drakes vs hens',
      big: `${pct}% drakes`,
      caption: pct >= 70 ? 'Picky shooter. Greenheads only, please.' : pct <= 40 ? 'The hens never stood a chance.' : 'An equal-opportunity shooter.',
    });
  }

  if (s.species.size > 0) {
    const pct = Math.round((s.species.size / SPECIES.length) * 100);
    cards.push({ kicker: 'Species collected', big: `${s.species.size}`, caption: `${pct}% of the Duck-dex in one season.` });
  }

  if (s.banded > 0) {
    cards.push({ kicker: 'Jewelry', big: `${s.banded} ${s.banded === 1 ? 'band' : 'bands'}`, caption: 'Hang it from the call lanyard.' });
  }

  if (s.skunks > 0) {
    cards.push({
      kicker: 'Skunks',
      big: `${s.skunks}`,
      caption: s.skunks === 1 ? 'Just the one. We won’t talk about it.' : 'Professional bird watcher.',
    });
  }

  const byMonth = new Map<number, number>();
  for (const d of days) {
    const m = Number(d.hunt.date.slice(5, 7)) - 1;
    byMonth.set(m, (byMonth.get(m) ?? 0) + d.birds);
  }
  const bestMonth = Array.from(byMonth.entries()).sort((a, b) => b[1] - a[1])[0];
  if (bestMonth && bestMonth[1] > 0) {
    cards.push({ kicker: 'Hottest month', big: MONTHS[bestMonth[0]], caption: `${bestMonth[1]} birds. The flight came through.` });
  }

  const field = data.hunters
    .map((h) => ({ id: h.id, birds: hunterStats(data, h.id, { season }).birds, hunts: hunterDays(data, h.id, { season }).length }))
    .filter((e) => e.hunts > 0)
    .sort((a, b) => b.birds - a.birds);
  if (field.length >= 2) {
    const rank = field.findIndex((e) => e.id === hunterId) + 1;
    cards.push({
      kicker: 'On the board',
      big: `#${rank} of ${field.length}`,
      caption: rank === 1 ? 'Top of the heap. Act humble.' : rank === field.length ? 'Somebody has to hold up the bottom.' : 'Next year is your year.',
    });
  }

  cards.push({ kicker: 'You finished the season as', big: titleName, caption: 'See you at opening day.' });
  return cards;
}

