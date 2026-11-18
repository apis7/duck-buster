/** Plain data shapes shared by the database layer, the domain rules and the QR transfer. */

export type Sex = 'D' | 'H' | 'U';

export type Hunter = {
  id: string;
  name: string;
  /** Pixel-palette color, hex. */
  color: string;
  /** The party (team) this hunter belongs to, if any. */
  partyId: string | null;
  createdAt: number;
};

/** A team of hunters. Parties go head to head the way hunters do. */
export type Party = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};

/** A bird the user added that isn't in the built-in list. Remembered for search. */
export type CustomSpecies = {
  id: string;
  name: string;
  /** Logged as drakes/hens (true) or a plain count (false). */
  sexed: boolean;
  createdAt: number;
};

export type Hunt = {
  id: string;
  /** Local calendar date, YYYY-MM-DD. One hunt per date. */
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
  parties: Party[];
  customSpecies: CustomSpecies[];
  hunts: Hunt[];
  huntHunters: HuntHunter[];
  harvests: Harvest[];
};

export const EMPTY_DATA: Data = { hunters: [], parties: [], customSpecies: [], hunts: [], huntHunters: [], harvests: [] };
