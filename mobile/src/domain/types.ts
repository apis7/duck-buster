/** Plain data shapes shared by the database layer, the domain rules and the QR transfer. */

export type Sex = 'D' | 'H' | 'U';

export type Hunter = {
  id: string;
  name: string;
  /** Pixel-palette color, hex. */
  color: string;
  createdAt: number;
};

export type Hunt = {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  createdAt: number;
};

/** Who was in the blind. A hunter on a hunt with no harvest rows was skunked. */
export type HuntHunter = { huntId: string; hunterId: string };

export type Harvest = {
  id: string;
  huntId: string;
  hunterId: string;
  speciesId: string;
  /** D drake, H hen, U unsexed (geese, coots, whistling ducks). */
  sex: Sex;
  count: number;
  /** How many of `count` wore a band. */
  banded: number;
};

export type Data = {
  hunters: Hunter[];
  hunts: Hunt[];
  huntHunters: HuntHunter[];
  harvests: Harvest[];
};

export const EMPTY_DATA: Data = { hunters: [], hunts: [], huntHunters: [], harvests: [] };
