import * as SQLite from 'expo-sqlite';

import type { CustomSpecies, Data, GameScore, Harvest, Hunt, HuntHunter, Hunter, Party } from '@/domain/types';

/**
 * The phone's only copy of the season. Hand-written, append-only migrations on
 * `PRAGMA user_version`: never edit a shipped one, add a new one.
 *
 * The whole dataset is small (a family's hunts for years is a few thousand rows),
 * so the app reads everything into memory at start-up and the rules engine works
 * on plain arrays. This file only persists.
 */

const db = SQLite.openDatabaseSync('duckbuster.db');

const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS hunters (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS hunts (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS hunt_hunters (
      hunt_id TEXT NOT NULL,
      hunter_id TEXT NOT NULL,
      PRIMARY KEY (hunt_id, hunter_id)
    );`,
    `CREATE TABLE IF NOT EXISTS harvests (
      id TEXT PRIMARY KEY NOT NULL,
      hunt_id TEXT NOT NULL,
      hunter_id TEXT NOT NULL,
      species_id TEXT NOT NULL,
      sex TEXT NOT NULL,
      count INTEGER NOT NULL,
      banded INTEGER NOT NULL DEFAULT 0
    );`,
    `CREATE INDEX IF NOT EXISTS idx_harvests_hunt ON harvests (hunt_id);`,
    `CREATE TABLE IF NOT EXISTS celebrated_badges (
      hunter_id TEXT NOT NULL,
      badge_id TEXT NOT NULL,
      at INTEGER NOT NULL,
      PRIMARY KEY (hunter_id, badge_id)
    );`,
    `CREATE TABLE IF NOT EXISTS high_scores (
      id TEXT PRIMARY KEY NOT NULL,
      initials TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );`,
  ],
  // 2: parties (teams of hunters) and user-added birds.
  [
    `CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );`,
    `ALTER TABLE hunters ADD COLUMN party_id TEXT;`,
    `CREATE TABLE IF NOT EXISTS custom_species (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      sexed INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );`,
  ],
  // 3: the hunt winner's round of the duck shoot (one per hunt).
  [
    `CREATE TABLE IF NOT EXISTS game_scores (
      id TEXT PRIMARY KEY NOT NULL,
      hunt_id TEXT NOT NULL UNIQUE,
      hunter_id TEXT NOT NULL,
      date TEXT NOT NULL,
      score INTEGER NOT NULL,
      shots INTEGER NOT NULL,
      hits INTEGER NOT NULL,
      kos INTEGER NOT NULL,
      geese INTEGER NOT NULL,
      swans INTEGER NOT NULL,
      coots INTEGER NOT NULL,
      bands INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );`,
  ],
];

export async function migrate(): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const statements = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      for (const sql of statements) await db.execAsync(sql);
    });
    version++;
    await db.execAsync(`PRAGMA user_version = ${version};`);
  }
}

export type HighScore = { id: string; initials: string; score: number; createdAt: number };

export type Loaded = {
  data: Data;
  celebrated: Set<string>;
  /** When each badge was first celebrated — places it in a season for the archive. */
  celebratedAt: { hunterId: string; badgeId: string; at: number }[];
  highScores: HighScore[];
  settings: Record<string, string>;
};

export const celebratedKey = (hunterId: string, badgeId: string) => `${hunterId}:${badgeId}`;

export async function loadAll(): Promise<Loaded> {
  const [hunters, parties, customSpecies, hunts, huntHunters, harvests, gameScores, celebrated, highScores, settings] = await Promise.all([
    db.getAllAsync<{ id: string; name: string; color: string; party_id: string | null; created_at: number }>('SELECT * FROM hunters ORDER BY created_at'),
    db.getAllAsync<{ id: string; name: string; color: string; created_at: number }>('SELECT * FROM parties ORDER BY created_at'),
    db.getAllAsync<{ id: string; name: string; sexed: number; created_at: number }>('SELECT * FROM custom_species ORDER BY name'),
    db.getAllAsync<{ id: string; date: string; created_at: number }>('SELECT * FROM hunts'),
    db.getAllAsync<{ hunt_id: string; hunter_id: string }>('SELECT * FROM hunt_hunters'),
    db.getAllAsync<{ id: string; hunt_id: string; hunter_id: string; species_id: string; sex: string; count: number; banded: number }>(
      'SELECT * FROM harvests',
    ),
    db.getAllAsync<Record<string, string | number>>('SELECT * FROM game_scores ORDER BY date'),
    db.getAllAsync<{ hunter_id: string; badge_id: string; at: number }>('SELECT hunter_id, badge_id, at FROM celebrated_badges'),
    db.getAllAsync<{ id: string; initials: string; score: number; created_at: number }>(
      'SELECT * FROM high_scores ORDER BY score DESC, created_at ASC LIMIT 10',
    ),
    db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings'),
  ]);
  return {
    data: {
      hunters: hunters.map((h) => ({ id: h.id, name: h.name, color: h.color, partyId: h.party_id ?? null, createdAt: h.created_at })),
      parties: parties.map((p) => ({ id: p.id, name: p.name, color: p.color, createdAt: p.created_at })),
      customSpecies: customSpecies.map((c) => ({ id: c.id, name: c.name, sexed: !!c.sexed, createdAt: c.created_at })),
      hunts: hunts.map((h) => ({ id: h.id, date: h.date, createdAt: h.created_at })),
      huntHunters: huntHunters.map((h) => ({ huntId: h.hunt_id, hunterId: h.hunter_id })),
      harvests: harvests.map((r) => ({
        id: r.id,
        huntId: r.hunt_id,
        hunterId: r.hunter_id,
        speciesId: r.species_id,
        sex: r.sex as Harvest['sex'],
        count: r.count,
        banded: r.banded,
      })),
      gameScores: gameScores.map(gameFromRow),
    },
    celebratedAt: celebrated.map((c) => ({ hunterId: c.hunter_id, badgeId: c.badge_id, at: c.at })),
    celebrated: new Set(celebrated.map((c) => celebratedKey(c.hunter_id, c.badge_id))),
    highScores: highScores.map((s) => ({ id: s.id, initials: s.initials, score: s.score, createdAt: s.created_at })),
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
  };
}

export async function insertHunter(h: Hunter): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO hunters (id, name, color, party_id, created_at) VALUES (?, ?, ?, ?, ?)',
    h.id, h.name, h.color, h.partyId, h.createdAt,
  );
}

export async function insertHunters(list: Hunter[], parties: Party[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const p of parties) await insertParty(p);
    for (const h of list) await insertHunter(h);
  });
}

export async function insertParty(p: Party): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO parties (id, name, color, created_at) VALUES (?, ?, ?, ?)', p.id, p.name, p.color, p.createdAt);
}

export async function deletePartyRow(id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE hunters SET party_id = NULL WHERE party_id = ?', id);
    await db.runAsync('DELETE FROM parties WHERE id = ?', id);
  });
}

export async function insertCustomSpecies(c: CustomSpecies): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO custom_species (id, name, sexed, created_at) VALUES (?, ?, ?, ?)', c.id, c.name, c.sexed ? 1 : 0, c.createdAt);
}

export async function deleteHunterRows(id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM harvests WHERE hunter_id = ?', id);
    await db.runAsync('DELETE FROM hunt_hunters WHERE hunter_id = ?', id);
    await db.runAsync('DELETE FROM celebrated_badges WHERE hunter_id = ?', id);
    await db.runAsync('DELETE FROM hunters WHERE id = ?', id);
    // A hunt with nobody left on it is gone too.
    await db.runAsync('DELETE FROM hunts WHERE id NOT IN (SELECT hunt_id FROM hunt_hunters)');
  });
}

async function writeHuntRows(hunt: Hunt, party: HuntHunter[], harvests: Harvest[]): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO hunts (id, date, created_at) VALUES (?, ?, ?)', hunt.id, hunt.date, hunt.createdAt);
  await db.runAsync('DELETE FROM hunt_hunters WHERE hunt_id = ?', hunt.id);
  await db.runAsync('DELETE FROM harvests WHERE hunt_id = ?', hunt.id);
  for (const p of party) await db.runAsync('INSERT OR IGNORE INTO hunt_hunters (hunt_id, hunter_id) VALUES (?, ?)', p.huntId, p.hunterId);
  for (const r of harvests)
    await db.runAsync(
      'INSERT INTO harvests (id, hunt_id, hunter_id, species_id, sex, count, banded) VALUES (?, ?, ?, ?, ?, ?, ?)',
      r.id, r.huntId, r.hunterId, r.speciesId, r.sex, r.count, r.banded,
    );
}

export async function saveHuntRows(hunt: Hunt, party: HuntHunter[], harvests: Harvest[]): Promise<void> {
  await db.withTransactionAsync(() => writeHuntRows(hunt, party, harvests));
}

export async function deleteHuntRows(id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM harvests WHERE hunt_id = ?', id);
    await db.runAsync('DELETE FROM hunt_hunters WHERE hunt_id = ?', id);
    await db.runAsync('DELETE FROM game_scores WHERE hunt_id = ?', id);
    await db.runAsync('DELETE FROM hunts WHERE id = ?', id);
  });
}

export async function markCelebrated(pairs: { hunterId: string; badgeId: string }[]): Promise<void> {
  const at = Date.now();
  for (const p of pairs)
    await db.runAsync('INSERT OR IGNORE INTO celebrated_badges (hunter_id, badge_id, at) VALUES (?, ?, ?)', p.hunterId, p.badgeId, at);
}

function gameFromRow(r: Record<string, string | number>): GameScore {
  return {
    id: String(r.id),
    huntId: String(r.hunt_id),
    hunterId: String(r.hunter_id),
    date: String(r.date),
    score: Number(r.score),
    shots: Number(r.shots),
    hits: Number(r.hits),
    kos: Number(r.kos),
    geese: Number(r.geese),
    swans: Number(r.swans),
    coots: Number(r.coots),
    bands: Number(r.bands),
    createdAt: Number(r.created_at),
  };
}

export async function insertGameScore(g: GameScore): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO game_scores (id, hunt_id, hunter_id, date, score, shots, hits, kos, geese, swans, coots, bands, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    g.id, g.huntId, g.hunterId, g.date, g.score, g.shots, g.hits, g.kos, g.geese, g.swans, g.coots, g.bands, g.createdAt,
  );
}

export async function insertHighScore(s: HighScore): Promise<void> {
  await db.runAsync('INSERT INTO high_scores (id, initials, score, created_at) VALUES (?, ?, ?, ?)', s.id, s.initials, s.score, s.createdAt);
}

export async function writeSetting(key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

/** Replace everything (mode 'replace') or upsert by id (mode 'merge'). */
export async function importRows(incoming: Data, mode: 'merge' | 'replace'): Promise<void> {
  await db.withTransactionAsync(async () => {
    if (mode === 'replace') {
      for (const t of ['harvests', 'hunt_hunters', 'hunts', 'hunters', 'parties', 'custom_species', 'game_scores', 'celebrated_badges'])
        await db.execAsync(`DELETE FROM ${t};`);
    }
    for (const p of incoming.parties) await insertParty(p);
    for (const c of incoming.customSpecies) await insertCustomSpecies(c);
    for (const h of incoming.hunters) await insertHunter(h);
    for (const g of incoming.gameScores) await insertGameScore(g);
    for (const hunt of incoming.hunts) {
      await writeHuntRows(
        hunt,
        incoming.huntHunters.filter((p) => p.huntId === hunt.id),
        incoming.harvests.filter((r) => r.huntId === hunt.id),
      );
    }
  });
}
