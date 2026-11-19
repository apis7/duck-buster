import { formatMeat } from './meat';
import { prettyDate, seasonLabel } from './season';
import { SPECIES, SPECIES_BY_ID } from './species';
import { hunterDays, hunterStats, statsFromDays } from './stats';
import type { Data } from './types';

/** Season Wrapped: a stack of big-number cards for one hunter's season. */

export type WrappedCard = { id: string; kicker: string; big: string; caption: string; /** For ranking the crew on this card. */ n?: number };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function seasonWrapped(data: Data, hunterId: string, season: number, titleName: string): WrappedCard[] {
  const days = hunterDays(data, hunterId, { season });
  if (days.length === 0) return [];
  const s = statsFromDays(days);
  const cards: WrappedCard[] = [];

  cards.push({
    id: 'hunts', n: s.hunts,
    kicker: `Your ${seasonLabel(season)} season`,
    big: `${s.hunts}`,
    caption: s.hunts === 1 ? 'hunt. Quality over quantity.' : 'hunts. Alarm clock: defeated.',
  });

  cards.push({
    id: 'birds', n: s.birds,
    kicker: 'Birds in the bag',
    big: `${s.birds}`,
    caption: s.birds === 0 ? 'Zero. But what a sunrise.' : s.birds >= 50 ? 'The ducks are filing a complaint.' : 'Every one of them earned.',
  });

  if (s.meatOz > 0) {
    cards.push({
      id: 'meat', n: s.meatOz,
      kicker: 'In the freezer',
      big: formatMeat(s.meatOz).replace('≈ ', ''),
      caption: s.meatOz >= 16 * 20 ? 'of meat (roughly). Time for a bigger freezer.' : 'of meat, give or take. Fire up the grill.',
    });
  }

  const fav = Object.entries(s.bySpecies).sort((a, b) => b[1] - a[1])[0];
  if (fav) {
    const sp = SPECIES_BY_ID[fav[0]];
    cards.push({ id: 'fav', n: fav[1], kicker: 'Your duck of the year', big: sp?.name ?? fav[0], caption: `${fav[1]} of them. A real fan.` });
  }

  if (s.biggestDay) {
    cards.push({
      id: 'bigday', n: s.biggestDay.birds,
      kicker: 'Your biggest day',
      big: `${s.biggestDay.birds}`,
      caption: `birds on ${prettyDate(s.biggestDay.hunt.date)}. Still talking about it.`,
    });
  }

  if (s.drakes + s.hens >= 3) {
    const pct = Math.round((s.drakes / (s.drakes + s.hens)) * 100);
    cards.push({
      id: 'drakes',
      kicker: 'Drakes vs hens',
      big: `${pct}% drakes`,
      caption: pct >= 70 ? 'Picky shooter. Greenheads only, please.' : pct <= 40 ? 'The hens never stood a chance.' : 'An equal-opportunity shooter.',
    });
  }

  if (s.species.size > 0) {
    const pct = Math.round((s.species.size / SPECIES.length) * 100);
    cards.push({ id: 'species', n: s.species.size, kicker: 'Species collected', big: `${s.species.size}`, caption: `${pct}% of the Duck-dex in one season.` });
  }

  if (s.banded > 0) {
    cards.push({ id: 'bands', n: s.banded, kicker: 'Jewelry', big: `${s.banded} ${s.banded === 1 ? 'band' : 'bands'}`, caption: 'Hang it from the call lanyard.' });
  }

  if (s.skunks > 0) {
    cards.push({
      id: 'skunks', n: s.skunks,
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
    cards.push({ id: 'month', kicker: 'Hottest month', big: MONTHS[bestMonth[0]], caption: `${bestMonth[1]} birds. The flight came through.` });
  }

  const field = data.hunters
    .map((h) => ({ id: h.id, birds: hunterStats(data, h.id, { season }).birds, hunts: hunterDays(data, h.id, { season }).length }))
    .filter((e) => e.hunts > 0)
    .sort((a, b) => b.birds - a.birds);
  if (field.length >= 2) {
    const rank = field.findIndex((e) => e.id === hunterId) + 1;
    cards.push({
      id: 'rank', n: -rank,
      kicker: 'On the board',
      big: `#${rank} of ${field.length}`,
      caption: rank === 1 ? 'Top of the heap. Act humble.' : rank === field.length ? 'Somebody has to hold up the bottom.' : 'Next year is your year.',
    });
  }

  cards.push({ id: 'title', kicker: 'You finished the season as', big: titleName, caption: 'See you at opening day.' });
  return cards;
}

/** The same cards, one step per card type, with every hunter who has that card on it. */
export type CrewStep = { id: string; kicker: string; rows: { hunterId: string; big: string; caption: string }[] };

const CREW_KICKERS: Record<string, (season: number) => string> = {
  hunts: (season) => `Hunts in ${seasonLabel(season)}`,
  birds: () => 'Birds in the bag',
  meat: () => 'In the freezer',
  fav: () => 'Duck of the year',
  bigday: () => 'Biggest day',
  drakes: () => 'Drakes vs hens',
  species: () => 'Species collected',
  bands: () => 'Jewelry',
  skunks: () => 'Skunks',
  month: () => 'Hottest month',
  rank: () => 'On the board',
  title: () => 'Finished the season as',
};

export function crewWrapped(data: Data, season: number, titleName: (hunterId: string) => string): CrewStep[] {
  const all = data.hunters.map((h) => ({ hunterId: h.id, cards: seasonWrapped(data, h.id, season, titleName(h.id)) }));
  return Object.keys(CREW_KICKERS)
    .map((id) => {
      const rows = all
        .map((h) => ({ hunterId: h.hunterId, card: h.cards.find((c) => c.id === id) }))
        .filter((r): r is { hunterId: string; card: WrappedCard } => !!r.card);
      // Biggest number first where there is one; otherwise the crew's usual order.
      rows.sort((a, b) => (b.card.n ?? 0) - (a.card.n ?? 0));
      // A tagline shared by several hunters reads like filler: only unique ones are kept.
      const uses = new Map<string, number>();
      for (const r of rows) uses.set(r.card.caption, (uses.get(r.card.caption) ?? 0) + 1);
      return {
        id,
        kicker: CREW_KICKERS[id](season),
        rows: rows.map((r) => ({ hunterId: r.hunterId, big: r.card.big, caption: uses.get(r.card.caption) === 1 ? r.card.caption : '' })),
      };
    })
    .filter((step) => step.rows.length > 0);
}
