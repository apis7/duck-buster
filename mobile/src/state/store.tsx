import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as db from '@/db/database';
import { BADGE_BY_ID, earnedBadges, type Badge } from '@/domain/badges';
import { hunterStats } from '@/domain/stats';
import { titleFor, xpFor } from '@/domain/titles';
import { EMPTY_DATA, type Data, type Harvest, type Hunter } from '@/domain/types';

/**
 * App state: everything on the phone, in memory, written through to SQLite.
 * Screens read `data` and derive what they need with the pure domain functions.
 */

export const HUNTER_COLORS = ['#F26B1D', '#2E7DD7', '#2EA043', '#C8342A', '#8E44AD', '#D4A017', '#16A3A3', '#E05297', '#6B4F2A', '#4A5568'];

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
  addHunter: (name: string) => Promise<Hunter>;
  renameHunter: (id: string, name: string) => Promise<void>;
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
  const [highScores, setHighScores] = useState<db.HighScore[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const loaded = await db.loadAll();
    setData(loaded.data);
    setCelebrated(loaded.celebrated);
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
    async (name: string) => {
      const h: Hunter = {
        id: randomUUID(),
        name: name.trim(),
        color: HUNTER_COLORS[data.hunters.length % HUNTER_COLORS.length],
        createdAt: Date.now(),
      };
      await db.insertHunter(h);
      setData((d) => ({ ...d, hunters: [...d.hunters, h] }));
      return h;
    },
    [data.hunters.length],
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
      setData(next);
      return { huntId: hunt.id, newBadges };
    },
    [data, celebrated],
  );

  const deleteHunt = useCallback(async (id: string) => {
    await db.deleteHuntRows(id);
    setData((d) => ({
      ...d,
      hunts: d.hunts.filter((h) => h.id !== id),
      huntHunters: d.huntHunters.filter((p) => p.huntId !== id),
      harvests: d.harvests.filter((r) => r.huntId !== id),
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
      await db.importRows(incoming, mode);
      const loaded = await db.loadAll();
      // Imported history shouldn't set off a parade of badge pop-ups.
      const pairs = loaded.data.hunters.flatMap((h) => earnedBadges(loaded.data, h.id).map((badgeId) => ({ hunterId: h.id, badgeId })));
      await db.markCelebrated(pairs);
      await reload();
    },
    [reload],
  );

  const value = useMemo<Store>(
    () => ({
      ready, data, highScores, settings, usage,
      addHunter, renameHunter, deleteHunter, saveHunt, deleteHunt, addHighScore, setSetting, importData,
      badgesFor, titleOf,
    }),
    [ready, data, highScores, settings, usage, addHunter, renameHunter, deleteHunter, saveHunt, deleteHunt, addHighScore, setSetting, importData, badgesFor, titleOf],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
