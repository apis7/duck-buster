import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as db from '@/db/database';
import { BADGE_BY_ID, earnedBadges, type Badge } from '@/domain/badges';
import { hunterStats } from '@/domain/stats';
import { titleFor, xpFor } from '@/domain/titles';
import { prepareMerge } from '@/domain/merge';
import type { SlugfestCard } from '@/domain/slugfest';
import { registerCustomSpecies } from '@/domain/species';
import { EMPTY_DATA, type CustomSpecies, type Data, type GameScore, type Harvest, type Hunter, type Party } from '@/domain/types';

import { pickPartyColor } from './partyColors';

export { PARTY_COLORS, pickPartyColor } from './partyColors';

/**
 * App state: everything on the phone, in memory, written through to SQLite.
 * Screens read `data` and derive what they need with the pure domain functions.
 */

export const HUNTER_COLORS = ['#F26B1D', '#2E7DD7', '#2EA043', '#C8342A', '#8E44AD', '#D4A017', '#16A3A3', '#E05297', '#6B4F2A', '#4A5568'];

export type NewHunterInput = { name: string; partyId: string | null };

export type NewBadge = { hunterId: string; badge: Badge };

export type HuntDraft = {
  id?: string;
  date: string;
  party: string[];
  rows: Omit<Harvest, 'id' | 'huntId'>[];
};

type Store = {
  ready: boolean;
  data: Data;
  highScores: db.HighScore[];
  settings: Record<string, string>;
  usage: Record<string, number>;
  addHunter: (name: string, partyId?: string | null) => Promise<Hunter>;
  /** Several at once (first-run setup), with any new parties they belong to. */
  addHunters: (list: NewHunterInput[], newParties: Party[]) => Promise<void>;
  renameHunter: (id: string, name: string) => Promise<void>;
  setHunterParty: (id: string, partyId: string | null) => Promise<void>;
  /** A party with a fresh id and an unused color; not saved until passed to addHunters. */
  draftParty: (name: string, taken?: string[]) => Party;
  addParty: (name: string) => Promise<Party>;
  updateParty: (id: string, patch: Partial<Pick<Party, 'name' | 'color'>>) => Promise<void>;
  deleteParty: (id: string) => Promise<void>;
  addCustomSpecies: (name: string, sexed: boolean) => Promise<CustomSpecies>;
  /** Save the hunt winner's round; returns any badges it just earned. */
  saveGameScore: (g: Omit<GameScore, 'id' | 'createdAt'>) => Promise<NewBadge[]>;
  /** Other crews' Slugfest cards: add (replacing that crew's copy of the season) or remove. */
  addSlugCard: (c: SlugfestCard) => Promise<void>;
  removeSlugCard: (crewId: string, season: number) => Promise<void>;
  /** This phone's crew for the Slugfest: a stable id plus the name it goes by. */
  crew: { id: string; name: string };
  /** When badges were first earned, for the season archive. */
  celebratedAt: db.Loaded['celebratedAt'];
  deleteHunter: (id: string) => Promise<void>;
  saveHunt: (draft: HuntDraft) => Promise<{ huntId: string; newBadges: NewBadge[] }>;
  deleteHunt: (id: string) => Promise<void>;
  addHighScore: (initials: string, score: number) => Promise<void>;
  setSetting: (key: string, value: string) => Promise<void>;
  importData: (incoming: Data, mode: 'merge' | 'replace') => Promise<void>;
  badgesFor: (hunterId: string) => string[];
  titleOf: (hunterId: string) => ReturnType<typeof titleFor>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Data>(EMPTY_DATA);
  const [celebrated, setCelebrated] = useState<Set<string>>(new Set());
  const [celebratedAt, setCelebratedAt] = useState<db.Loaded['celebratedAt']>([]);
  const [highScores, setHighScores] = useState<db.HighScore[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const loaded = await db.loadAll();
    registerCustomSpecies(loaded.data.customSpecies);
    setData(loaded.data);
    setCelebrated(loaded.celebrated);
    setCelebratedAt(loaded.celebratedAt);
    setHighScores(loaded.highScores);
    setSettings(loaded.settings);
  }, []);

  useEffect(() => {
    db.migrate()
      .then(reload)
      .catch((e) => console.error('Database start-up failed', e))
      .finally(() => setReady(true));
  }, [reload]);

  const usage = useMemo(() => {
    const u: Record<string, number> = {};
    for (const r of data.harvests) u[r.speciesId] = (u[r.speciesId] ?? 0) + 1;
    return u;
  }, [data.harvests]);

  const earned = useMemo(() => new Map(data.hunters.map((h) => [h.id, earnedBadges(data, h.id)])), [data]);
  const badgesFor = useCallback((hunterId: string) => earned.get(hunterId) ?? [], [earned]);
  const titleOf = useCallback(
    (hunterId: string) => titleFor(xpFor(hunterStats(data, hunterId), badgesFor(hunterId).length)),
    [data, badgesFor],
  );

  const addHunter = useCallback(
    async (name: string, partyId: string | null = null) => {
      const h: Hunter = {
        id: randomUUID(),
        name: name.trim(),
        color: HUNTER_COLORS[data.hunters.length % HUNTER_COLORS.length],
        partyId,
        createdAt: Date.now(),
      };
      await db.insertHunter(h);
      setData((d) => ({ ...d, hunters: [...d.hunters, h] }));
      return h;
    },
    [data.hunters.length],
  );

  const addHunters = useCallback(
    async (list: NewHunterInput[], newParties: Party[]) => {
      const now = Date.now();
      const hunters: Hunter[] = list
        .filter((x) => x.name.trim())
        .map((x, i) => ({
          id: randomUUID(),
          name: x.name.trim(),
          color: HUNTER_COLORS[(data.hunters.length + i) % HUNTER_COLORS.length],
          partyId: x.partyId,
          createdAt: now + i,
        }));
      const parties = newParties.filter((p) => p.name.trim());
      await db.insertHunters(hunters, parties);
      setData((d) => ({ ...d, parties: [...d.parties, ...parties], hunters: [...d.hunters, ...hunters] }));
    },
    [data.hunters.length],
  );

  const setHunterParty = useCallback(
    async (id: string, partyId: string | null) => {
      const h = data.hunters.find((x) => x.id === id);
      if (!h) return;
      const next = { ...h, partyId };
      await db.insertHunter(next);
      setData((d) => ({ ...d, hunters: d.hunters.map((x) => (x.id === id ? next : x)) }));
    },
    [data.hunters],
  );

  const draftParty = useCallback(
    (name: string, taken: string[] = []): Party => ({
      id: randomUUID(),
      name: name.trim(),
      color: pickPartyColor([...data.parties.map((p) => p.color), ...taken]),
      createdAt: Date.now(),
    }),
    [data.parties],
  );

  const addParty = useCallback(
    async (name: string) => {
      const p = draftParty(name);
      await db.insertParty(p);
      setData((d) => ({ ...d, parties: [...d.parties, p] }));
      return p;
    },
    [draftParty],
  );

  const updateParty = useCallback(
    async (id: string, patch: Partial<Pick<Party, 'name' | 'color'>>) => {
      const p = data.parties.find((x) => x.id === id);
      if (!p) return;
      const next = { ...p, ...patch, name: (patch.name ?? p.name).trim() || p.name };
      await db.insertParty(next);
      setData((d) => ({ ...d, parties: d.parties.map((x) => (x.id === id ? next : x)) }));
    },
    [data.parties],
  );

  const deleteParty = useCallback(async (id: string) => {
    await db.deletePartyRow(id);
    setData((d) => ({
      ...d,
      parties: d.parties.filter((p) => p.id !== id),
      hunters: d.hunters.map((h) => (h.partyId === id ? { ...h, partyId: null } : h)),
    }));
  }, []);

  const addCustomSpecies = useCallback(
    async (name: string, sexed: boolean) => {
      const c: CustomSpecies = { id: `c_${randomUUID().slice(0, 8)}`, name: name.trim(), sexed, createdAt: Date.now() };
      await db.insertCustomSpecies(c);
      const list = [...data.customSpecies, c];
      registerCustomSpecies(list);
      setData((d) => ({ ...d, customSpecies: list }));
      return c;
    },
    [data.customSpecies],
  );

  const renameHunter = useCallback(
    async (id: string, name: string) => {
      const h = data.hunters.find((x) => x.id === id);
      if (!h) return;
      const next = { ...h, name: name.trim() };
      await db.insertHunter(next);
      setData((d) => ({ ...d, hunters: d.hunters.map((x) => (x.id === id ? next : x)) }));
    },
    [data.hunters],
  );

  const deleteHunter = useCallback(
    async (id: string) => {
      await db.deleteHunterRows(id);
      await reload();
    },
    [reload],
  );

  const saveHunt = useCallback(
    async (draft: HuntDraft) => {
      const existing = draft.id ? data.hunts.find((h) => h.id === draft.id) : undefined;
      if (data.hunts.some((h) => h.date === draft.date && h.id !== draft.id)) {
        throw new Error('There is already a hunt on that day. One hunt per day.');
      }
      const hunt = { id: draft.id ?? randomUUID(), date: draft.date, createdAt: existing?.createdAt ?? Date.now() };
      const party = draft.party.map((hunterId) => ({ huntId: hunt.id, hunterId }));
      const harvests: Harvest[] = draft.rows
        .filter((r) => r.count > 0 && draft.party.includes(r.hunterId))
        .map((r) => ({ ...r, id: randomUUID(), huntId: hunt.id, banded: Math.min(r.banded, r.count) }));
      await db.saveHuntRows(hunt, party, harvests);

      const next: Data = {
        ...data,
        hunts: [...data.hunts.filter((h) => h.id !== hunt.id), hunt],
        huntHunters: [...data.huntHunters.filter((p) => p.huntId !== hunt.id), ...party],
        harvests: [...data.harvests.filter((r) => r.huntId !== hunt.id), ...harvests],
      };
      const newBadges: NewBadge[] = [];
      for (const hunterId of draft.party)
        for (const id of earnedBadges(next, hunterId))
          if (!celebrated.has(db.celebratedKey(hunterId, id))) newBadges.push({ hunterId, badge: BADGE_BY_ID[id] });
      await db.markCelebrated(newBadges.map((b) => ({ hunterId: b.hunterId, badgeId: b.badge.id })));
      setCelebrated((c) => new Set([...c, ...newBadges.map((b) => db.celebratedKey(b.hunterId, b.badge.id))]));
      setCelebratedAt((c) => [...c, ...newBadges.map((b) => ({ hunterId: b.hunterId, badgeId: b.badge.id, at: Date.now() }))]);
      setData(next);
      return { huntId: hunt.id, newBadges };
    },
    [data, celebrated],
  );

  const saveGameScore = useCallback(
    async (g: Omit<GameScore, 'id' | 'createdAt'>) => {
      const row: GameScore = { ...g, id: randomUUID(), createdAt: Date.now() };
      await db.insertGameScore(row);
      const next: Data = { ...data, gameScores: [...data.gameScores.filter((x) => x.huntId !== g.huntId), row] };
      const newBadges: NewBadge[] = earnedBadges(next, g.hunterId)
        .filter((id) => !celebrated.has(db.celebratedKey(g.hunterId, id)))
        .map((id) => ({ hunterId: g.hunterId, badge: BADGE_BY_ID[id] }));
      await db.markCelebrated(newBadges.map((b) => ({ hunterId: b.hunterId, badgeId: b.badge.id })));
      setCelebrated((c) => new Set([...c, ...newBadges.map((b) => db.celebratedKey(b.hunterId, b.badge.id))]));
      setCelebratedAt((c) => [...c, ...newBadges.map((b) => ({ hunterId: b.hunterId, badgeId: b.badge.id, at: Date.now() }))]);
      setData(next);
      return newBadges;
    },
    [data, celebrated],
  );

  const addSlugCard = useCallback(async (c: SlugfestCard) => {
    await db.saveSlugCard(c);
    setData((d) => ({ ...d, slugfest: [...d.slugfest.filter((x) => !(x.crewId === c.crewId && x.season === c.season)), c] }));
  }, []);

  const removeSlugCard = useCallback(async (crewId: string, season: number) => {
    await db.deleteSlugCard(crewId, season);
    setData((d) => ({ ...d, slugfest: d.slugfest.filter((x) => !(x.crewId === crewId && x.season === season)) }));
  }, []);

  // A stable id for this phone's crew, made once; the name lives in settings too.
  useEffect(() => {
    if (ready && !settings.crewId) {
      const id = randomUUID();
      db.writeSetting('crewId', id).then(() => setSettings((s) => ({ ...s, crewId: id })));
    }
  }, [ready, settings.crewId]);
  const crew = useMemo(() => ({ id: settings.crewId ?? '', name: settings.crewName ?? '' }), [settings.crewId, settings.crewName]);

  const deleteHunt = useCallback(async (id: string) => {
    await db.deleteHuntRows(id);
    setData((d) => ({
      ...d,
      hunts: d.hunts.filter((h) => h.id !== id),
      huntHunters: d.huntHunters.filter((p) => p.huntId !== id),
      harvests: d.harvests.filter((r) => r.huntId !== id),
      gameScores: d.gameScores.filter((g) => g.huntId !== id),
    }));
  }, []);

  const addHighScore = useCallback(
    async (initials: string, score: number) => {
      await db.insertHighScore({ id: randomUUID(), initials, score, createdAt: Date.now() });
      await reload();
    },
    [reload],
  );

  const setSetting = useCallback(async (key: string, value: string) => {
    await db.writeSetting(key, value);
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  const importData = useCallback(
    async (incoming: Data, mode: 'merge' | 'replace') => {
      // Merge lines a backup from another phone up with this one (same names, same days).
      await db.importRows(mode === 'merge' ? prepareMerge(data, incoming) : incoming, mode);
      const loaded = await db.loadAll();
      // Imported history shouldn't set off a parade of badge pop-ups.
      const pairs = loaded.data.hunters.flatMap((h) => earnedBadges(loaded.data, h.id).map((badgeId) => ({ hunterId: h.id, badgeId })));
      await db.markCelebrated(pairs);
      await reload();
    },
    [data, reload],
  );

  const value = useMemo<Store>(
    () => ({
      ready, data, highScores, settings, usage,
      addHunter, addHunters, renameHunter, setHunterParty, deleteHunter,
      draftParty, addParty, updateParty, deleteParty, addCustomSpecies, saveGameScore, celebratedAt,
      addSlugCard, removeSlugCard, crew,
      saveHunt, deleteHunt, addHighScore, setSetting, importData,
      badgesFor, titleOf,
    }),
    [
      ready, data, highScores, settings, usage,
      addHunter, addHunters, renameHunter, setHunterParty, deleteHunter,
      draftParty, addParty, updateParty, deleteParty, addCustomSpecies, saveGameScore, celebratedAt,
      addSlugCard, removeSlugCard, crew,
      saveHunt, deleteHunt, addHighScore, setSetting, importData,
      badgesFor, titleOf,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
