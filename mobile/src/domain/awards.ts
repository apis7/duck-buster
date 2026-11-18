import { formatMeat } from './meat';
import { seasonOf } from './season';
import { SPECIES_BY_ID } from './species';
import { hunterStats, type HunterStats } from './stats';
import type { Data } from './types';

/**
 * Season Awards Night: every hunter who went out this season is in the running.
 * Ties share the trophy. Roast awards ("lowest wins") only run when there's
 * someone to beat, so a hunter alone on the phone is never mocked by a field of one.
 */

export type AwardDef = {
  id: string;
  title: string;
  icon: string;
  roast?: boolean;
  /** Lower is "better" (the roast awards). */
  lowest?: boolean;
  /** Fewest qualifying value to hand the award out (highest-wins awards). */
  min?: number;
  metric: (s: HunterStats, ctx: { firstEverSeason: number | null; season: number }) => number | null;
  describe: (value: number) => string;
};

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
const ofGroup = (s: HunterStats, group: string) =>
  Object.entries(s.bySpecies).reduce((t, [id, c]) => (SPECIES_BY_ID[id]?.group === group ? t + c : t), 0);

export const AWARDS: AwardDef[] = [
  { id: 'mvp', title: 'Season MVP', icon: '🏆', min: 1,
    metric: (s) => s.birds, describe: (v) => n(v, 'bird', 'birds') },
  { id: 'big_day', title: 'Biggest Day', icon: '📅', min: 1,
    metric: (s) => s.biggestDay?.birds ?? 0, describe: (v) => `${n(v, 'bird', 'birds')} in one hunt` },
  { id: 'sharpshooter', title: 'Sharpshooter', icon: '🎯', min: 0.01,
    metric: (s) => (s.hunts >= 2 ? Math.round((s.birds / s.hunts) * 10) / 10 : null),
    describe: (v) => `${v} birds per hunt` },
  { id: 'iron_man', title: 'Iron Man', icon: '🦾', min: 2,
    metric: (s) => s.hunts, describe: (v) => n(v, 'hunt', 'hunts') },
  { id: 'rookie', title: 'Rookie of the Year', icon: '🐣', min: 1,
    metric: (s, ctx) => (ctx.firstEverSeason === ctx.season ? s.birds : null),
    describe: (v) => `${n(v, 'bird', 'birds')} in season one` },
  { id: 'band_champ', title: 'Band Champion', icon: '💍', min: 1,
    metric: (s) => s.banded, describe: (v) => n(v, 'band', 'bands') },
  { id: 'greenhead_prez', title: 'Greenhead Club President', icon: '🟢', min: 1,
    metric: (s) => s.greenheads, describe: (v) => n(v, 'drake mallard', 'drake mallards') },
  { id: 'teal_dealer', title: 'Teal Dealer', icon: '🚀', min: 1,
    metric: (s) => s.teal, describe: (v) => n(v, 'teal', 'teal') },
  { id: 'goose_whisperer', title: 'Goose Whisperer', icon: '🪿', min: 1,
    metric: (s) => s.geese, describe: (v) => n(v, 'goose', 'geese') },
  { id: 'freezer_filler', title: 'Freezer Filler', icon: '🧊', min: 1,
    metric: (s) => Math.round(s.meatOz), describe: (v) => `${formatMeat(v)} of meat in the freezer` },
  { id: 'bird_nerd', title: 'Bird Nerd of the Year', icon: '📚', min: 2,
    metric: (s) => s.species.size, describe: (v) => n(v, 'species', 'species') },

  // ── The roast ───────────────────────────────────────────────────────────
  { id: 'bird_watcher', title: 'Professional Bird Watcher', icon: '🔭', roast: true, min: 1,
    metric: (s) => s.skunks, describe: (v) => `${n(v, 'skunk', 'skunks')}. Great views though.` },
  { id: 'hen_house', title: 'Hen House Mother', icon: '🐔', roast: true, min: 2,
    metric: (s) => s.hens, describe: (v) => `${n(v, 'hen', 'hens')}. Brown is beautiful.` },
  { id: 'mud_hen_mayor', title: 'Mud Hen Mayor', icon: '🐓', roast: true, min: 1,
    metric: (s) => s.coots, describe: (v) => `${n(v, 'coot', 'coots')}. The people have spoken.` },
  { id: 'smiling_mallard', title: 'Smiling Mallard Award', icon: '🥄', roast: true, min: 1,
    metric: (s) => s.bySpecies.nsho ?? 0, describe: (v) => `${n(v, 'spoonie', 'spoonies')}. Close enough to a mallard.` },
  { id: 'fish_stick', title: 'Fish Stick Award', icon: '🐟', roast: true, min: 1,
    metric: (s) => ofGroup(s, 'merganser'), describe: (v) => `${n(v, 'merganser', 'mergansers')}. Bon appétit.` },
  { id: 'gadwall_society', title: 'Gadwall Appreciation Society', icon: '👻', roast: true, min: 2,
    metric: (s) => s.bySpecies.gadw ?? 0, describe: (v) => `${n(v, 'gadwall', 'gadwall')}. Somebody has to.` },
  { id: 'participation', title: 'Participation Trophy', icon: '🏅', roast: true, lowest: true,
    metric: (s) => s.birds, describe: (v) => `${n(v, 'bird', 'birds')}. You showed up!` },
  { id: 'fair_weather', title: 'Fair-Weather Fowler', icon: '☀️', roast: true, lowest: true,
    metric: (s) => s.hunts, describe: (v) => `${n(v, 'hunt', 'hunts')}. Too cold?` },
];

export type AwardResult = {
  award: AwardDef;
  winners: string[];
  value: number;
  text: string;
};

export function seasonAwards(data: Data, season: number): AwardResult[] {
  const firstSeason = new Map<string, number>();
  for (const h of data.hunters) {
    const s = hunterStats(data, h.id);
    if (s.firstDate) firstSeason.set(h.id, seasonOf(s.firstDate));
  }
  const field = data.hunters
    .map((h) => ({ id: h.id, stats: hunterStats(data, h.id, { season }) }))
    .filter((e) => e.stats.hunts > 0);
  if (field.length === 0) return [];

  const results: AwardResult[] = [];
  for (const award of AWARDS) {
    const scored = field
      .map((e) => ({ id: e.id, v: award.metric(e.stats, { firstEverSeason: firstSeason.get(e.id) ?? null, season }) }))
      .filter((e): e is { id: string; v: number } => e.v != null);
    if (scored.length === 0) continue;
    const values = scored.map((e) => e.v);
    const best = award.lowest ? Math.min(...values) : Math.max(...values);
    if (award.lowest) {
      // Needs a field of at least two, and somebody who did better.
      if (scored.length < 2 || values.every((v) => v === best)) continue;
    } else if (best < (award.min ?? 1)) continue;
    const winners = scored.filter((e) => e.v === best).map((e) => e.id);
    results.push({ award, winners, value: best, text: award.describe(best) });
  }
  return results;
}
