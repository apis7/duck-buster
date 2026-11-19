import { dayOfWeek, daysBetween, isThanksgiving, seasonOf } from './season';
import { isCoot, isDuck, isGoose, LIGHT_GEESE, SCAUP, SPECIES_BY_ID, TEAL } from './species';
import { hunterDays, statsFromDays, sum, type HunterDay, type HunterStats } from './stats';
import type { Data, GameScore, Harvest } from './types';

/**
 * Badges are secret. The app never lists the ones not yet earned — it only says
 * how many are left to find — and pops each one up the moment a saved hunt earns
 * it. Every badge is lifetime and earned once.
 *
 * Each check is a pure function of the hunter's days, so earned badges are
 * recomputed from the data rather than stored as truth; the database only
 * remembers which ones have already been celebrated.
 */

export type Badge = {
  id: string;
  name: string;
  icon: string;
  /** Shown only after it is earned. */
  blurb: string;
  test: (ctx: BadgeContext) => boolean;
};

export type BadgeContext = {
  days: HunterDay[];
  stats: HunterStats;
  /** Total birds per hunter on each hunt, for "who outshot whom". */
  partyBirds: (huntId: string) => Map<string, number>;
  hunterId: string;
  /** Duck-shoot rounds this hunter won the right to play. */
  games: GameScore[];
};

const has = (rows: Harvest[], pick: (r: Harvest) => boolean) => rows.some((r) => r.count > 0 && pick(r));
const anyDay = (ctx: BadgeContext, pick: (d: HunterDay) => boolean) => ctx.days.some(pick);
const speciesOn = (d: HunterDay) => new Set(d.rows.filter((r) => r.count > 0).map((r) => r.speciesId));
const allRows = (ctx: BadgeContext) => ctx.days.flatMap((d) => d.rows);

function longestRun(days: HunterDay[], pick: (d: HunterDay) => boolean): number {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = pick(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function bySeason(days: HunterDay[]): HunterDay[][] {
  const map = new Map<number, HunterDay[]>();
  for (const d of days) {
    const s = seasonOf(d.hunt.date);
    map.set(s, [...(map.get(s) ?? []), d]);
  }
  return Array.from(map.values());
}

export const BADGES: Badge[] = [
  // ── Firsts ────────────────────────────────────────────────────────────
  { id: 'boots_wet', name: 'Boots Wet', icon: '🥾', blurb: 'Logged your first hunt.',
    test: (c) => c.days.length >= 1 },
  { id: 'first_bird', name: 'Bird in Hand', icon: '🦆', blurb: 'Your first bird. Frame it.',
    test: (c) => c.stats.birds >= 1 },
  { id: 'greenhead', name: 'Greenhead', icon: '🟢', blurb: 'First drake mallard. The classic.',
    test: (c) => c.stats.greenheads >= 1 },
  { id: 'suzie', name: 'Suzie Q', icon: '🤎', blurb: 'First hen mallard. She counts.',
    test: (c) => has(allRows(c), (r) => r.speciesId === 'mall' && r.sex === 'H') },
  { id: 'woodie', name: 'Woodie', icon: '🌳', blurb: 'Bagged a wood duck. Prettiest bird in the swamp.',
    test: (c) => (c.stats.bySpecies.wodu ?? 0) >= 1 },
  { id: 'honker', name: 'Honker', icon: '🪿', blurb: 'First goose. Bring a bigger bag.',
    test: (c) => c.stats.geese >= 1 },

  // ── The jokes ─────────────────────────────────────────────────────────
  { id: 'skunked', name: 'Skunked', icon: '🦨', blurb: 'A whole hunt and zero birds. Nice sunrise though.',
    test: (c) => c.stats.skunks >= 1 },
  { id: 'double_skunk', name: 'Double Skunk', icon: '🦨🦨', blurb: 'Two skunks in a row. Check your choke.',
    test: (c) => longestRun(c.days, (d) => d.birds === 0) >= 2 },
  { id: 'bird_watcher', name: 'Professional Bird Watcher', icon: '🔭', blurb: 'Three skunks in a row. You just like looking at them.',
    test: (c) => longestRun(c.days, (d) => d.birds === 0) >= 3 },
  { id: 'comeback', name: 'Comeback Kid', icon: '💪', blurb: 'Birds right after a skunk.',
    test: (c) => c.days.some((d, i) => i > 0 && c.days[i - 1].birds === 0 && d.birds > 0) },
  { id: 'mud_hen', name: 'Mud Hen Shame', icon: '🐓', blurb: 'You shot a coot. On purpose?',
    test: (c) => c.stats.coots >= 1 },
  { id: 'coot_connoisseur', name: 'Coot Connoisseur', icon: '🍽️', blurb: 'Ten coots. Nobody is eating those.',
    test: (c) => c.stats.coots >= 10 },
  { id: 'smiling_mallard', name: 'Smiling Mallard', icon: '🥄', blurb: 'Shot a spoonie. It counts. Technically.',
    test: (c) => (c.stats.bySpecies.nsho ?? 0) >= 1 },
  { id: 'fish_stick', name: 'Fish Stick', icon: '🐟', blurb: 'A merganser. Enjoy that one in the kitchen.',
    test: (c) => has(allRows(c), (r) => SPECIES_BY_ID[r.speciesId]?.group === 'merganser') },
  { id: 'got_carried', name: 'Got Carried', icon: '🎒', blurb: 'Zero birds while your party shot five or more.',
    test: (c) => anyDay(c, (d) => {
      if (d.birds > 0 || d.party.length < 2) return false;
      let total = 0;
      for (const n of c.partyBirds(d.hunt.id).values()) total += n;
      return total >= 5;
    }) },
  { id: 'called_in_sick', name: 'Called in Sick', icon: '🤒', blurb: 'Five weekday hunts. Your boss has questions.',
    test: (c) => c.days.filter((d) => { const w = dayOfWeek(d.hunt.date); return w >= 1 && w <= 5; }).length >= 5 },
  { id: 'gray_ghost', name: 'Gray Ghost', icon: '👻', blurb: 'A gadwall. The duck nobody brags about. Until now.',
    test: (c) => (c.stats.bySpecies.gadw ?? 0) >= 1 },

  // ── Drakes and hens ───────────────────────────────────────────────────
  { id: 'greenhead_club', name: 'Greenhead Club', icon: '🎖️', blurb: 'Ten drake mallards. Welcome to the club.',
    test: (c) => c.stats.greenheads >= 10 },
  { id: 'gentlemans_limit', name: "Gentleman's Limit", icon: '🎩', blurb: 'Four or more birds in a hunt, every one a drake.',
    test: (c) => anyDay(c, (d) => d.birds >= 4 && sum(d.rows, (r) => r.sex === 'D') === d.birds) },
  { id: 'hen_house', name: 'Hen House', icon: '🐔', blurb: 'Three or more birds in a hunt, all hens. Look closer next time.',
    test: (c) => anyDay(c, (d) => d.birds >= 3 && sum(d.rows, (r) => r.sex === 'H') === d.birds) },
  { id: 'bull_can', name: 'Bull Can', icon: '👑', blurb: 'A drake canvasback. King of ducks.',
    test: (c) => has(allRows(c), (r) => r.speciesId === 'canv' && r.sex === 'D') },
  { id: 'bull_sprig', name: 'Bull Sprig', icon: '📌', blurb: 'A drake pintail. Long tail, long story.',
    test: (c) => has(allRows(c), (r) => r.speciesId === 'nopi' && r.sex === 'D') },

  // ── Big days ──────────────────────────────────────────────────────────
  { id: 'teal_deal', name: 'Teal Deal', icon: '🚀', blurb: 'Five or more teal in one hunt. Rocket science.',
    test: (c) => anyDay(c, (d) => sum(d.rows, (r) => TEAL.has(r.speciesId)) >= 5) },
  { id: 'bluebill_bonanza', name: 'Bluebill Bonanza', icon: '🔵', blurb: 'Five or more scaup in one hunt.',
    test: (c) => anyDay(c, (d) => sum(d.rows, (r) => SCAUP.has(r.speciesId)) >= 5) },
  { id: 'honker_hammer', name: 'Honker Hammer', icon: '🔨', blurb: 'Five Canada geese in one hunt.',
    test: (c) => anyDay(c, (d) => sum(d.rows, (r) => r.speciesId === 'cago') >= 5) },
  { id: 'snow_storm', name: 'Snow Storm', icon: '❄️', blurb: 'Ten light geese in one hunt.',
    test: (c) => anyDay(c, (d) => sum(d.rows, (r) => LIGHT_GEESE.has(r.speciesId)) >= 10) },
  { id: 'dozen_donuts', name: 'Dozen Donuts', icon: '🍩', blurb: 'Twelve or more birds in a single hunt.',
    test: (c) => anyDay(c, (d) => d.birds >= 12) },
  { id: 'variety_pack', name: 'Variety Pack', icon: '🎨', blurb: 'Five different species in one hunt.',
    test: (c) => anyDay(c, (d) => speciesOn(d).size >= 5) },
  { id: 'triple_crown', name: 'Triple Crown', icon: '🏆', blurb: 'A duck, a goose and a coot in the same hunt.',
    test: (c) => anyDay(c, (d) => has(d.rows, (r) => isDuck(r.speciesId)) && has(d.rows, (r) => isGoose(r.speciesId)) && has(d.rows, (r) => isCoot(r.speciesId))) },
  { id: 'top_gun', name: 'Top Gun', icon: '🎯', blurb: 'Outshot everybody in a group hunt.',
    test: (c) => anyDay(c, (d) => {
      if (d.party.length < 2 || d.birds === 0) return false;
      const birds = c.partyBirds(d.hunt.id);
      return d.party.every((h) => h === c.hunterId || (birds.get(h) ?? 0) < d.birds);
    }) },
  { id: 'lone_wolf', name: 'Lone Wolf', icon: '🐺', blurb: 'Hunted solo and still brought birds home.',
    test: (c) => anyDay(c, (d) => d.party.length === 1 && d.birds > 0) },
  { id: 'full_blind', name: 'Full Blind', icon: '🧑‍🤝‍🧑', blurb: 'Five or more hunters in one blind. Cozy.',
    test: (c) => anyDay(c, (d) => d.party.length >= 5) },

  // ── Collecting ────────────────────────────────────────────────────────
  { id: 'teal_trifecta', name: 'Teal Trifecta', icon: '🎰', blurb: 'Blue-winged, green-winged and cinnamon teal.',
    test: (c) => ['bwte', 'gwte', 'cite'].every((s) => (c.stats.bySpecies[s] ?? 0) > 0) },
  { id: 'grand_slam', name: 'Grand Slam', icon: '⚾', blurb: 'Mallard, pintail, wigeon and teal in one season.',
    test: (c) => bySeason(c.days).some((days) => {
      const st = statsFromDays(days);
      return !!st.bySpecies.mall && !!st.bySpecies.nopi && !!st.bySpecies.amwi && st.teal > 0;
    }) },
  { id: 'butterball', name: 'Butterball', icon: '🧈', blurb: 'A bufflehead. Small duck, big grin.',
    test: (c) => (c.stats.bySpecies.buff ?? 0) >= 1 },
  { id: 'sea_legs', name: 'Sea Legs', icon: '🌊', blurb: 'A sea duck. Hope you brought a bigger boat.',
    test: (c) => has(allRows(c), (r) => SPECIES_BY_ID[r.speciesId]?.group === 'sea') },
  { id: 'whistle_stop', name: 'Whistle Stop', icon: '🎶', blurb: 'A whistling duck.',
    test: (c) => has(allRows(c), (r) => SPECIES_BY_ID[r.speciesId]?.group === 'whistling') },
  { id: 'speck_tacular', name: 'Speck-tacular', icon: '🍳', blurb: 'A specklebelly. Best-eating goose there is.',
    test: (c) => (c.stats.bySpecies.gwfg ?? 0) >= 1 },
  { id: 'unicorn', name: 'Unicorn', icon: '🦄', blurb: 'A rare bird. Tell everyone.',
    test: (c) => has(allRows(c), (r) => SPECIES_BY_ID[r.speciesId]?.rarity === 'rare') },
  { id: 'bird_nerd', name: 'Bird Nerd', icon: '📚', blurb: 'Ten different species.',
    test: (c) => c.stats.species.size >= 10 },
  { id: 'duck_professor', name: 'Duck Professor', icon: '🎓', blurb: 'Twenty different species.',
    test: (c) => c.stats.species.size >= 20 },
  { id: 'ornithologist', name: 'Ornithologist', icon: '🔬', blurb: 'Thirty different species. Get a life list.',
    test: (c) => c.stats.species.size >= 30 },
  { id: 'blackjack', name: 'Blackjack', icon: '🃏', blurb: 'Twenty-one ring-necked ducks. Dealer busts.',
    test: (c) => (c.stats.bySpecies.rndu ?? 0) >= 21 },

  // ── Bands ─────────────────────────────────────────────────────────────
  { id: 'jewelry', name: 'Jewelry', icon: '💍', blurb: 'Your first band! Report it and brag forever.',
    test: (c) => c.stats.banded >= 1 },
  { id: 'double_bling', name: 'Double Bling', icon: '✨', blurb: 'Two bands in one hunt.',
    test: (c) => anyDay(c, (d) => d.rows.reduce((n, r) => n + r.banded, 0) >= 2) },
  { id: 'bling_bling', name: 'Bling Bling', icon: '💎', blurb: 'Three bands. Your lanyard is getting heavy.',
    test: (c) => c.stats.banded >= 3 },

  // ── Totals ────────────────────────────────────────────────────────────
  { id: 'quarter_century', name: 'Quarter Century', icon: '🥉', blurb: '25 birds, all time.',
    test: (c) => c.stats.birds >= 25 },
  { id: 'half_century', name: 'Half Century', icon: '🥈', blurb: '50 birds, all time.',
    test: (c) => c.stats.birds >= 50 },
  { id: 'century_club', name: 'Century Club', icon: '💯', blurb: '100 birds, all time.',
    test: (c) => c.stats.birds >= 100 },
  { id: 'flyway_menace', name: 'Flyway Menace', icon: '☠️', blurb: '250 birds. The ducks have a poster of you.',
    test: (c) => c.stats.birds >= 250 },

  // ── Dedication ────────────────────────────────────────────────────────
  { id: 'grinder', name: 'Grinder', icon: '⚙️', blurb: 'Ten hunts in one season.',
    test: (c) => bySeason(c.days).some((d) => d.length >= 10) },
  { id: 'swamp_rat', name: 'Swamp Rat', icon: '🐀', blurb: 'Twenty-five hunts in one season. Do you live out there?',
    test: (c) => bySeason(c.days).some((d) => d.length >= 25) },
  { id: 'iron_butt', name: 'Iron Butt', icon: '🪑', blurb: 'Hunted three days in a row.',
    test: (c) => {
      const dates = Array.from(new Set(c.days.map((d) => d.hunt.date)));
      return dates.some((d, i) => i >= 2 && daysBetween(dates[i - 2], d) === 2);
    } },
  { id: 'hot_streak', name: 'Hot Streak', icon: '🔥', blurb: 'Birds on five hunts in a row.',
    test: (c) => longestRun(c.days, (d) => d.birds > 0) >= 5 },

  // ── The duck shoot (rounds won by winning a hunt) ─────────────────────
  { id: 'winner_winner', name: 'Winner Winner', icon: '🍗', blurb: 'Won a hunt and earned a round of the duck shoot.',
    test: (c) => c.games.length >= 1 },
  { id: 'arcade_ace', name: 'Arcade Ace', icon: '🕹️', blurb: '30 points in a single round.',
    test: (c) => c.games.some((g) => g.score >= 30) },
  { id: 'joystick_legend', name: 'Joystick Legend', icon: '👾', blurb: '60 points in a single round. Put a quarter in.',
    test: (c) => c.games.some((g) => g.score >= 60) },
  { id: 'pixel_honker', name: 'Pixel Honker', icon: '🪿', blurb: 'Dropped a goose in the duck shoot.',
    test: (c) => c.games.some((g) => g.geese > 0) },
  { id: 'swan_song', name: 'Swan Song', icon: '🦢', blurb: 'Dropped a swan in the duck shoot. Two dogs, one bird.',
    test: (c) => c.games.some((g) => g.swans > 0) },
  { id: 'golden_band', name: 'Golden Band', icon: '🏅', blurb: 'Dropped the banded goose. One in a hundred-something.',
    test: (c) => c.games.some((g) => g.bands > 0) },
  { id: 'coot_clown', name: 'Coot Clown', icon: '🤡', blurb: 'Three coots in one round. On purpose, surely.',
    test: (c) => c.games.some((g) => g.coots >= 3) },
  { id: 'three_peat', name: 'Three-Peat', icon: '🔁', blurb: 'Won three hunts in one season.',
    test: (c) => {
      const bySeason = new Map<number, number>();
      for (const g of c.games) bySeason.set(seasonOf(g.date), (bySeason.get(seasonOf(g.date)) ?? 0) + 1);
      return Array.from(bySeason.values()).some((n) => n >= 3);
    } },

  // ── Holidays ──────────────────────────────────────────────────────────
  { id: 'christmas_duck', name: 'Christmas Duck', icon: '🎄', blurb: 'Birds on Christmas Eve or Christmas Day.',
    test: (c) => anyDay(c, (d) => d.birds > 0 && /-12-2[45]$/.test(d.hunt.date)) },
  { id: 'new_years_duck', name: "New Year's Duck", icon: '🎆', blurb: 'Birds on New Year’s Day.',
    test: (c) => anyDay(c, (d) => d.birds > 0 && d.hunt.date.endsWith('-01-01')) },
  { id: 'not_a_turkey', name: 'Turkey? Nah.', icon: '🦃', blurb: 'Birds on Thanksgiving. Duck for dinner.',
    test: (c) => anyDay(c, (d) => d.birds > 0 && isThanksgiving(d.hunt.date)) },
];

export const BADGE_BY_ID: Record<string, Badge> = Object.fromEntries(BADGES.map((b) => [b.id, b]));

export function partyBirdsFor(data: Data): (huntId: string) => Map<string, number> {
  const cache = new Map<string, Map<string, number>>();
  for (const r of data.harvests) {
    const m = cache.get(r.huntId) ?? new Map<string, number>();
    m.set(r.hunterId, (m.get(r.hunterId) ?? 0) + r.count);
    cache.set(r.huntId, m);
  }
  return (huntId) => cache.get(huntId) ?? new Map();
}

export function earnedBadges(data: Data, hunterId: string): string[] {
  const days = hunterDays(data, hunterId);
  const ctx: BadgeContext = {
    days,
    stats: statsFromDays(days),
    partyBirds: partyBirdsFor(data),
    hunterId,
    games: data.gameScores.filter((g) => g.hunterId === hunterId),
  };
  return BADGES.filter((b) => b.test(ctx)).map((b) => b.id);
}
