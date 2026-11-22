import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, SlideInRight, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { play } from '@/audio/sfx';
import { isLockedDate } from '@/domain/archive';
import { nameTaken } from '@/domain/names';
import { searchSpecies } from '@/domain/search';
import { prettyDate, shiftDate, todayISO } from '@/domain/season';
import { pickSkunkLine, SKUNK_LINES } from '@/domain/skunk';
import { SPECIES_BY_ID } from '@/domain/species';
import type { Harvest } from '@/domain/types';
import { useStore, type NewBadge } from '@/state/store';
import { BadgeParade } from '@/ui/BadgeParade';
import { BirdPicker } from '@/ui/BirdPicker';
import { DatePicker } from '@/ui/DatePicker';
import { useDialog } from '@/ui/Dialog';
import { Btn, Chip, Explainer, Pixel, Stepper } from '@/ui/kit';
import { SkunkSplash } from '@/ui/SkunkSplash';
import { C } from '@/ui/theme';
import { count } from '@/domain/plural';

/**
 * Logging a hunt, one hunter at a time, one question at a time:
 *   1. How many birds did they get?  (SKUNKED = zero, with a zinger)
 *   2. What kinds?  Each kind gets a count; a live total shows "4 of 6".
 *   3. Drakes or hens?  Everything starts as hens; each drake moves one over.
 * Then on to the next hunter. One hunt per day.
 */

type Line = { speciesId: string; count: number; drakes: number; banded: number };
type Step = 'count' | 'kinds' | 'sex' | 'done';
type Entry = { target: number | null; skunked: boolean; step: Step; lines: Line[] };

/** A bird can carry more than one band (a leg band plus a second one now and then). */
const MAX_BANDS_PER_BIRD = 2;

const isSexed = (id: string) => !!SPECIES_BY_ID[id]?.sexed;
const totalOf = (lines: Line[]) => lines.reduce((n, l) => n + l.count, 0);
const newEntry = (): Entry => ({ target: null, skunked: false, step: 'count', lines: [] });

function entriesFrom(rows: Harvest[], party: string[]): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const hid of party) {
    const byKind = new Map<string, Line>();
    for (const r of rows.filter((x) => x.hunterId === hid)) {
      const l = byKind.get(r.speciesId) ?? { speciesId: r.speciesId, count: 0, drakes: 0, banded: 0 };
      l.count += r.count;
      if (r.sex === 'D') l.drakes += r.count;
      l.banded += r.banded;
      byKind.set(r.speciesId, l);
    }
    const lines = Array.from(byKind.values());
    out[hid] = { target: totalOf(lines), skunked: lines.length === 0, step: 'done', lines };
  }
  return out;
}

function rowsFrom(entries: Record<string, Entry>, party: string[]): Omit<Harvest, 'id' | 'huntId'>[] {
  const out: Omit<Harvest, 'id' | 'huntId'>[] = [];
  for (const hid of party) {
    const e = entries[hid];
    if (!e || e.skunked) continue;
    for (const l of e.lines) {
      if (l.count <= 0) continue;
      let bands = Math.min(l.banded, l.count * MAX_BANDS_PER_BIRD);
      const push = (sex: Harvest['sex'], count: number) => {
        if (count <= 0) return;
        const b = Math.min(bands, count * MAX_BANDS_PER_BIRD);
        bands -= b;
        out.push({ hunterId: hid, speciesId: l.speciesId, sex, count, banded: b });
      };
      if (isSexed(l.speciesId)) {
        push('D', l.drakes);
        push('H', l.count - l.drakes);
      } else push('U', l.count);
    }
  }
  return out;
}

/** A bird chip that pops and flashes when tapped, so you see the tap register. */
function BirdChip({ label, onPress, highlight }: { label: string; onPress: () => void; highlight?: boolean }) {
  const scale = useSharedValue(1);
  const flash = useSharedValue(0);
  const box = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: flash.value > 0.5 ? C.orange : highlight ? C.navy : C.white,
  }));
  const txt = useAnimatedStyle(() => ({ color: flash.value > 0.5 || highlight ? C.white : C.navy }));
  return (
    <Pressable
      hitSlop={4}
      onPress={() => {
        scale.set(withSequence(withTiming(1.15, { duration: 80 }), withTiming(1, { duration: 140 })));
        flash.set(withSequence(withTiming(1, { duration: 10 }), withTiming(1, { duration: 260 }), withTiming(0, { duration: 10 })));
        onPress();
      }}
    >
      <Animated.View style={[styles.birdChip, box]}>
        <Animated.Text style={[styles.birdChipTxt, txt]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function StepCard({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Animated.View entering={SlideInRight.duration(200)} style={styles.step}>
      <Pixel size={8} color={C.muted}>{`STEP ${n} OF 3`}</Pixel>
      <Pixel size={12} style={{ lineHeight: 20 }}>{title}</Pixel>
      {children}
    </Animated.View>
  );
}

export default function LogHunt() {
  const { id, date: dateParam } = useLocalSearchParams<{ id?: string; date?: string }>();
  const { data, usage, saveHunt, deleteHunt, addHunter, settings, setSetting } = useStore();
  const ask = useDialog();
  const insets = useSafeAreaInsets();
  const existing = id ? data.hunts.find((h) => h.id === id) : undefined;
  // Hunts in an archived (past) season are read-only.
  const locked = !!existing && isLockedDate(existing.date);
  const savedId = useRef<string | null>(null);

  const lastParty = useMemo(() => {
    const last = [...data.hunts].sort((a, b) => b.createdAt - a.createdAt)[0];
    const p = last ? data.huntHunters.filter((x) => x.huntId === last.id).map((x) => x.hunterId) : [];
    return p.length ? p : data.hunters.map((h) => h.id);
  }, [data]);

  const [date, setDate] = useState(existing?.date ?? (dateParam && dateParam <= todayISO() ? dateParam : todayISO()));
  const [party, setParty] = useState<string[]>(() =>
    existing ? data.huntHunters.filter((p) => p.huntId === existing.id).map((p) => p.hunterId) : lastParty,
  );
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    existing
      ? entriesFrom(data.harvests.filter((r) => r.huntId === existing.id), party)
      : Object.fromEntries(party.map((hid) => [hid, newEntry()])),
  );
  const [active, setActive] = useState<string | null>(() => (existing ? null : (party[0] ?? null)));
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState<string | null>(null);
  const creating = useRef(false);
  /** The name being typed for a new hunter; consumed by the first create call. */
  const pendingName = useRef<string | null>(null);
  const [parade, setParade] = useState<NewBadge[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [birdPicker, setBirdPicker] = useState<{ name?: string } | null>(null);
  const [splash, setSplash] = useState<{ hunterId: string; line: number } | null>(null);
  // Re-tapping SKUNKED for the same hunter shows the same zinger — no cycling for laughs.
  const zingerFor = useRef(new Map<string, number>());

  // Leaving with unsaved changes asks first — a half-logged hunt is easy to lose to a stray BACK.
  const [initial] = useState(() => JSON.stringify({ date, party, entries }));
  const [leaving, setLeaving] = useState(false);
  // Saving and deleting navigate away through allowLeave(), so they never hit the question.
  const dirty = !leaving && JSON.stringify({ date, party, entries }) !== initial;
  const allowLeave = usePreventRemove(dirty, ({ repeat }) => {
    ask({
      icon: '🦆',
      title: 'Leave without saving?',
      message: 'The birds you entered for this hunt will be lost.',
      buttons: [
        { label: 'Keep logging', value: 'stay', kind: 'primary' },
        { label: 'Leave', value: 'leave', kind: 'danger' },
      ],
    }).then((v) => {
      if (v !== 'leave') return;
      setLeaving(true);
      repeat();
    });
  });

  const huntDays = useMemo(() => new Set(data.hunts.filter((h) => h.id !== existing?.id).map((h) => h.date)), [data.hunts, existing]);
  const hunterById = new Map(data.hunters.map((h) => [h.id, h]));
  const results = useMemo(() => searchSpecies(query, usage, 8), [query, usage]);
  const entry = active ? entries[active] : null;
  const activeName = active ? (hunterById.get(active)?.name ?? '') : '';
  const pending = party.filter((hid) => entries[hid]?.step !== 'done');
  const total = entry ? totalOf(entry.lines) : 0;
  const dismissSplash = useCallback(() => setSplash(null), []);

  const patch = useCallback((hid: string, p: Partial<Entry> | ((e: Entry) => Partial<Entry>)) => {
    setEntries((es) => {
      const cur = es[hid] ?? newEntry();
      return { ...es, [hid]: { ...cur, ...(typeof p === 'function' ? p(cur) : p) } };
    });
  }, []);

  const patchLine = (hid: string, speciesId: string, p: Partial<Line>) =>
    patch(hid, (e) => ({ lines: e.lines.map((l) => (l.speciesId === speciesId ? { ...l, ...p } : l)) }));

  function toggleParty(hid: string) {
    if (party.includes(hid)) {
      setParty((p) => p.filter((x) => x !== hid));
      if (active === hid) setActive(null);
    } else {
      setParty((p) => [...p, hid]);
      if (!entries[hid]) patch(hid, newEntry());
      setActive(hid);
    }
  }

  function nextHunter(after: string) {
    const rest = party.filter((hid) => hid !== after && entries[hid]?.step !== 'done');
    setActive(rest[0] ?? null);
  }

  // ── Step 1 ───────────────────────────────────────────────────────────────
  function setCount(hid: string, n: number) {
    Haptics.selectionAsync().catch(() => {});
    patch(hid, { target: n, skunked: false, step: 'kinds' });
    setQuery('');
  }

  async function markSkunked(hid: string) {
    const name = hunterById.get(hid)?.name ?? '';
    if (entries[hid]?.lines.length) {
      const ok = await ask({
        icon: '🦨',
        title: `Skunk ${name}?`,
        message: `That clears the birds you entered for ${name} on this hunt.`,
        buttons: [
          { label: 'Yes, skunked', value: 'yes', kind: 'danger' },
          { label: 'Keep the birds', value: 'no' },
        ],
      });
      if (ok !== 'yes') return;
    }
    patch(hid, { target: 0, skunked: true, step: 'done', lines: [] });
    let line = zingerFor.current.get(hid);
    if (line == null) {
      const last = settings.skunkLast != null ? Number(settings.skunkLast) : null;
      line = pickSkunkLine(last);
      zingerFor.current.set(hid, line);
      setSetting('skunkLast', String(line));
    }
    play('wrong');
    setSplash({ hunterId: hid, line });
    nextHunter(hid);
  }

  // ── Step 2 ───────────────────────────────────────────────────────────────
  /**
   * The first kind takes the whole count (it's usually all one kind). After that,
   * each tap adds one of that kind and — to keep the total at the hunter's count —
   * takes one back from the biggest other kind.
   */
  function addKind(hid: string, speciesId: string) {
    Haptics.selectionAsync().catch(() => {});
    patch(hid, (e) => {
      const target = e.target ?? 0;
      if (!e.lines.length) return { lines: [{ speciesId, count: Math.max(1, target), drakes: 0, banded: 0 }] };
      const lines = e.lines.map((l) => ({ ...l }));
      const before = totalOf(lines);
      const found = lines.find((l) => l.speciesId === speciesId);
      if (found) found.count += 1;
      else lines.push({ speciesId, count: 1, drakes: 0, banded: 0 });
      if (before + 1 > target) {
        const donor = lines.filter((l) => l.speciesId !== speciesId && l.count > 1).sort((a, b) => b.count - a.count)[0];
        if (donor) {
          donor.count -= 1;
          donor.drakes = Math.min(donor.drakes, donor.count);
          donor.banded = Math.min(donor.banded, donor.count * MAX_BANDS_PER_BIRD);
        }
      }
      return { lines };
    });
    setQuery('');
  }

  /** What each unfinished hunter still needs, in plain words. */
  function whatsLeft(): string[] {
    return pending.map((hid) => {
      const e = entries[hid] ?? newEntry();
      const name = hunterById.get(hid)?.name ?? '?';
      if (e.step === 'count') return `${name} still needs a bird count (or SKUNKED).`;
      if (e.step === 'kinds') {
        const t = totalOf(e.lines);
        return t === e.target
          ? `${name} still needs to tap COMPLETE on the kinds.`
          : `${name} still needs to pick which kinds — ${t} of ${e.target} entered.`;
      }
      return `${name} still needs to say how many were drakes or hens.`;
    });
  }

  // ── Date, save, delete ───────────────────────────────────────────────────
  async function pickDate(d: string) {
    setPicking(false);
    if (isLockedDate(d)) {
      await ask({
        icon: '🗄️',
        title: 'Archived season',
        message: 'That season is over and archived. Pick a date in this season.',
        buttons: [{ label: 'OK', value: 'ok' }],
      });
      return;
    }
    const other = data.hunts.find((h) => h.date === d && h.id !== existing?.id);
    if (other) {
      const go = await ask({
        icon: '📅',
        title: 'Already logged',
        message: `There's already a hunt on ${prettyDate(d)}. One hunt per day — open that one?`,
        buttons: [
          { label: 'Open it', value: 'open', kind: 'primary' },
          { label: 'Cancel', value: 'cancel' },
        ],
      });
      if (go === 'open') router.replace({ pathname: '/hunt', params: { id: other.id } });
      return;
    }
    setDate(d);
  }

  async function save() {
    if (party.length === 0) {
      await ask({ icon: '🦆', title: 'Who went?', message: 'Pick at least one hunter.', buttons: [{ label: 'OK', value: 'ok' }] });
      return;
    }
    if (pending.length) {
      const first = hunterById.get(pending[0])?.name ?? '';
      const go = await ask({
        icon: '📝',
        title: pending.length === 1 ? 'One hunter to finish' : `${count(pending.length, 'hunter')} to finish`,
        message: whatsLeft().join('\n'),
        buttons: [
          { label: `Go to ${first}`, value: 'go', kind: 'primary' },
          { label: 'OK', value: 'ok' },
        ],
      });
      if (go === 'go') setActive(pending[0]);
      return;
    }
    if (data.hunts.some((h) => h.date === date && h.id !== existing?.id)) return pickDate(date);
    setSaving(true);
    try {
      const { huntId, newBadges } = await saveHunt({ id: existing?.id, date, party, rows: rowsFrom(entries, party) });
      savedId.current = huntId;
      play('quack');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (newBadges.length) setParade(newBadges);
      else finish();
    } finally {
      setSaving(false);
    }
  }

  /** On to the winner: they may get today's round of the duck shoot. */
  function finish() {
    allowLeave();
    if (savedId.current) router.replace({ pathname: '/winner', params: { huntId: savedId.current } });
    else router.back();
  }

  async function confirmDelete() {
    if (!existing) return;
    const yes = await ask({
      icon: '🗑️',
      title: 'Delete this hunt?',
      message: 'Its birds come off the board too.',
      buttons: [
        { label: 'Delete', value: 'yes', kind: 'danger' },
        { label: 'Keep it', value: 'no' },
      ],
    });
    if (yes !== 'yes') return;
    await deleteHunt(existing.id);
    allowLeave();
    router.back();
  }

  async function createHunter() {
    // Enter and losing focus both land here. The first call takes the typed name
    // and clears it at once, so the second finds nothing left to create — no
    // matter how the two events are timed.
    if (creating.current) return;
    const n = pendingName.current?.trim();
    pendingName.current = null;
    if (!n) {
      setNewName(null);
      return;
    }
    // Typing an existing hunter's name just brings that hunter along.
    const existing = nameTaken(data.hunters, n);
    if (existing) {
      if (!party.includes(existing.id)) {
        setParty((p) => [...p, existing.id]);
        patch(existing.id, newEntry());
      }
      setActive(existing.id);
      setNewName(null);
      return;
    }
    creating.current = true;
    try {
      const h = await addHunter(n);
      setParty((p) => [...p, h.id]);
      patch(h.id, newEntry());
      setActive(h.id);
      setNewName(null);
    } finally {
      creating.current = false;
    }
  }

  // Plain-words status of the whole screen, updated with every tap.
  const names = (ids: string[]) => ids.map((h) => hunterById.get(h)?.name ?? '?').join(', ');
  const stepWords: Record<Step, string> = {
    count: 'how many birds they got',
    kinds: `which kinds (${total} of ${entry?.target ?? 0} entered)`,
    sex: 'drakes or hens',
    done: 'done — tap CHANGE to edit',
  };
  const explain = !party.length
    ? 'Tap the hunters who went under WHO WENT (filled in = went).'
    : `${party.length} went: ${names(party)}. ` +
      (active && entry
        ? `Now logging ${activeName}: ${stepWords[entry.step]}.`
        : pending.length
          ? 'Tap a hunter under TAP A HUNTER to log their birds.'
          : 'Everyone is logged — tap FINALIZE HUNT.') +
      (pending.length ? ` Still to log: ${names(pending)}.` : '');

  const status = (hid: string) => {
    const e = entries[hid];
    if (!e || e.step !== 'done') return '…';
    return e.skunked ? '🦨' : `✓ ${totalOf(e.lines)}`;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Pixel size={10}>{'< BACK'}</Pixel>
        </Pressable>
        <Pixel size={12}>{existing ? 'EDIT HUNT' : 'LOG A HUNT'}</Pixel>
        {existing && !locked ? (
          <Pressable onPress={confirmDelete} hitSlop={10}>
            <Pixel size={10} color={C.red}>DEL</Pixel>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 130 }}>
        {locked ? (
          <View style={styles.lockedBanner}>
            <Text style={{ fontSize: 20 }}>🗄️</Text>
            <Text style={{ flex: 1, color: C.white, fontWeight: '700' }}>Archived season — this hunt is read-only.</Text>
          </View>
        ) : null}
        <View style={styles.dateRow} pointerEvents={locked ? 'none' : 'auto'}>
          <Pressable onPress={() => pickDate(shiftDate(date, -1))} hitSlop={10} style={styles.arrow}>
            <Pixel size={14}>{'<'}</Pixel>
          </Pressable>
          <Pressable onPress={() => setPicking(true)} style={{ alignItems: 'center', flex: 1 }}>
            <Pixel size={12}>{prettyDate(date).toUpperCase()}</Pixel>
            <Text style={{ color: C.muted, fontSize: 11 }}>📅 tap to pick a date</Text>
          </Pressable>
          <Pressable onPress={() => date < todayISO() && pickDate(shiftDate(date, 1))} hitSlop={10} style={styles.arrow}>
            <Pixel size={14} color={date < todayISO() ? C.navy : C.locked}>{'>'}</Pixel>
          </Pressable>
        </View>

        {!locked ? <Explainer>{explain}</Explainer> : null}

        <View style={{ gap: 6 }}>
          <Pixel size={9} color={C.muted}>WHO WENT</Pixel>
          <View style={styles.wrap}>
            {data.hunters.map((h) => (
              <Chip key={h.id} label={h.name} on={party.includes(h.id)} color={h.color} onPress={() => toggleParty(h.id)} />
            ))}
            {newName === null ? (
              <Chip label="+ NEW" onPress={() => setNewName('')} />
            ) : (
              <TextInput
                autoFocus
                value={newName}
                onChangeText={(t) => {
                  setNewName(t);
                  pendingName.current = t;
                }}
                onSubmitEditing={createHunter}
                onBlur={createHunter}
                submitBehavior="blurAndSubmit"
                placeholder="Name"
                style={styles.chipInput}
              />
            )}
          </View>
        </View>

        {party.length ? (
          <View style={{ gap: 6 }}>
            <Pixel size={9} color={C.muted}>TAP A HUNTER</Pixel>
            <View style={styles.wrap}>
              {party.map((hid) => {
                const h = hunterById.get(hid);
                if (!h) return null;
                const on = active === hid;
                return (
                  <Pressable key={hid} onPress={() => setActive(on ? null : hid)} style={[styles.hunterTab, { borderColor: h.color }, on && { backgroundColor: h.color }]}>
                    <Text style={[styles.hunterTabTxt, on && { color: C.white }]}>{h.name}</Text>
                    <Text style={[styles.hunterTabStatus, on && { color: C.white }]}>{status(hid)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {active && entry ? (
          <View key={active} style={{ gap: 12 }}>
            {/* Step 1: how many */}
            {entry.step === 'count' ? (
              <StepCard n={1} title={`How many birds did ${activeName} get today?`}>
                <View style={styles.numGrid}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <Pressable key={n} onPress={() => setCount(active, n)} style={[styles.num, entry.target === n && styles.numOn]}>
                      <Pixel size={14} color={entry.target === n ? C.white : C.navy}>{`${n}`}</Pixel>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ color: C.muted, flex: 1 }}>More than 12?</Text>
                  <Stepper value={Math.max(13, entry.target ?? 13)} min={13} onChange={(n) => patch(active, { target: n })} />
                  <Btn label="NEXT ›" small onPress={() => setCount(active, Math.max(13, entry.target ?? 13))} />
                </View>
                <Pressable onPress={() => markSkunked(active)} style={styles.skunk}>
                  <Text style={{ fontSize: 26 }}>🦨</Text>
                  <View style={{ flex: 1 }}>
                    <Pixel size={11}>SKUNKED</Pixel>
                    <Text style={{ color: C.muted, fontSize: 12 }}>{`${activeName} got zero birds`}</Text>
                  </View>
                </Pressable>
              </StepCard>
            ) : (
              <Pressable onPress={() => patch(active, { step: 'count' })} style={styles.doneRow}>
                <Text style={styles.doneTxt}>
                  {entry.skunked ? `🦨 ${activeName} got skunked` : `${entry.target} ${entry.target === 1 ? 'bird' : 'birds'}`}
                </Text>
                <Pixel size={8} color={C.muted}>CHANGE</Pixel>
              </Pressable>
            )}

            {/* Step 2: what kinds */}
            {entry.step === 'kinds' ? (
              <StepCard n={2} title="What kinds?">
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Type a bird: gwt, greenhead, can…"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={() => results[0] && addKind(active, results[0].id)}
                  style={styles.search}
                />
                <View style={styles.wrap}>
                  {results.map((s, i) => (
                    <BirdChip key={s.id} label={s.name} highlight={!!query && i === 0} onPress={() => addKind(active, s.id)} />
                  ))}
                  {query.trim() && !results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase()) ? (
                    <Chip label={`+ Add "${query.trim()}"`} color={C.orange} onPress={() => setBirdPicker({ name: query.trim() })} />
                  ) : null}
                  <Chip label="ALL BIRDS ▸" color={C.marsh} onPress={() => setBirdPicker({})} />
                </View>

                {entry.lines.map((l) => (
                  <Animated.View key={l.speciesId} entering={FadeInDown} style={styles.kindRow}>
                    <Text style={styles.kindName}>{SPECIES_BY_ID[l.speciesId]?.name ?? l.speciesId}</Text>
                    <Stepper
                      value={l.count}
                      min={1}
                      onChange={(n) => patchLine(active, l.speciesId, { count: n, drakes: Math.min(l.drakes, n), banded: Math.min(l.banded, n * MAX_BANDS_PER_BIRD) })}
                    />
                    <Pressable onPress={() => patch(active, (e) => ({ lines: e.lines.filter((x) => x.speciesId !== l.speciesId) }))} hitSlop={10}>
                      <Text style={{ fontSize: 20, color: C.muted, fontWeight: '800' }}>×</Text>
                    </Pressable>
                  </Animated.View>
                ))}

                <View style={styles.totalRow}>
                  <View style={{ flex: 1 }}>
                    <Pixel size={14} color={total === entry.target ? C.marsh : total > (entry.target ?? 0) ? C.red : C.navy}>
                      {`${total} of ${entry.target}`}
                    </Pixel>
                    {total !== entry.target && total > 0 ? (
                      <Pressable onPress={() => patch(active, { target: total })} hitSlop={6}>
                        <Text style={{ color: C.orange, fontWeight: '700', marginTop: 4 }}>{`Actually ${total}? Tap to use ${total}`}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Btn label="COMPLETE ›" small onPress={() => patch(active, { step: 'sex' })} disabled={total === 0 || total !== entry.target} />
                </View>
              </StepCard>
            ) : (entry.step === 'sex' || entry.step === 'done') && !entry.skunked ? (
              <Pressable onPress={() => patch(active, { step: 'kinds' })} style={styles.doneRow}>
                <Text style={styles.doneTxt} numberOfLines={2}>
                  {entry.lines.map((l) => `${l.count} ${SPECIES_BY_ID[l.speciesId]?.name ?? l.speciesId}`).join(', ')}
                </Text>
                <Pixel size={8} color={C.muted}>CHANGE</Pixel>
              </Pressable>
            ) : null}

            {/* Step 3: drakes or hens */}
            {entry.step === 'sex' ? (
              <StepCard n={3} title="Drakes or hens?">
                <Text style={{ color: C.muted }}>Everything starts as hens — add the drakes. Banded? Up to 2 bands per bird.</Text>
                {entry.lines.map((l) => (
                  <View key={l.speciesId} style={styles.sexRow}>
                    <Text style={styles.kindName}>{`${l.count} × ${SPECIES_BY_ID[l.speciesId]?.name ?? l.speciesId}`}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      {isSexed(l.speciesId) ? (
                        <>
                          <Stepper label="DRAKES" value={l.drakes} max={l.count} onChange={(n) => patchLine(active, l.speciesId, { drakes: n })} />
                          <View style={{ alignItems: 'center', gap: 2 }}>
                            <Text style={{ fontSize: 11, color: C.muted, fontWeight: '700' }}>HENS</Text>
                            <View style={styles.hens}>
                              <Pixel size={12}>{`${l.count - l.drakes}`}</Pixel>
                            </View>
                          </View>
                        </>
                      ) : (
                        <Text style={{ color: C.muted, fontSize: 12, paddingBottom: 8 }}>No drake/hen for this one</Text>
                      )}
                      <Stepper label="💍 BANDS" value={l.banded} max={l.count * MAX_BANDS_PER_BIRD} onChange={(n) => patchLine(active, l.speciesId, { banded: n })} />
                    </View>
                  </View>
                ))}
                <Btn
                  label={`DONE WITH ${activeName.toUpperCase()} ›`}
                  onPress={() => {
                    patch(active, { step: 'done' });
                    nextHunter(active);
                  }}
                />
              </StepCard>
            ) : null}
          </View>
        ) : party.length && !pending.length ? (
          <Text style={{ color: C.marsh, textAlign: 'center', fontWeight: '700' }}>Everyone's logged. Tap a hunter to change anything.</Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {locked ? (
          <Btn label="BACK" kind="secondary" onPress={() => router.back()} />
        ) : (
          <Btn
            label={saving ? 'SAVING…' : pending.length ? `${pending.length} ${pending.length === 1 ? 'HUNTER' : 'HUNTERS'} TO FINISH ›` : 'FINALIZE HUNT 🏆'}
            kind={pending.length ? 'secondary' : 'primary'}
            onPress={save}
            disabled={saving}
          />
        )}
      </View>

      {picking ? <DatePicker visible value={date} huntDays={huntDays} onPick={pickDate} onClose={() => setPicking(false)} /> : null}
      {birdPicker && active ? (
        <BirdPicker
          visible
          initialName={birdPicker.name}
          onPick={(sid) => {
            setBirdPicker(null);
            addKind(active, sid);
          }}
          onClose={() => setBirdPicker(null)}
        />
      ) : null}

      {splash ? (
        <SkunkSplash name={hunterById.get(splash.hunterId)?.name ?? ''} message={SKUNK_LINES[splash.line]} onDismiss={dismissSplash} />
      ) : null}

      {parade ? (
        <BadgeParade
          items={parade.map((b) => ({ badge: b.badge, hunterName: hunterById.get(b.hunterId)?.name ?? '' }))}
          onDone={() => {
            setParade(null);
            finish();
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: C.white, borderBottomWidth: 2.5, borderColor: C.navy },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderWidth: 2.5, borderColor: C.navy, padding: 8 },
  arrow: { padding: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipInput: { borderWidth: 2, borderColor: C.orange, paddingVertical: 5, paddingHorizontal: 10, minWidth: 110, fontSize: 14, backgroundColor: C.white },
  hunterTab: { borderWidth: 2.5, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.white, alignItems: 'center', minWidth: 74 },
  hunterTabTxt: { fontWeight: '800', fontSize: 15, color: C.navy },
  hunterTabStatus: { fontSize: 12, color: C.muted, fontWeight: '700' },
  step: { backgroundColor: C.white, borderWidth: 2.5, borderColor: C.navy, borderBottomWidth: 5, borderRightWidth: 5, padding: 14, gap: 12 },
  numGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  num: { width: '22%', aspectRatio: 1.4, borderWidth: 2.5, borderColor: C.navy, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  numOn: { backgroundColor: C.orange, borderColor: C.orange },
  skunk: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2.5, borderColor: C.navy, borderStyle: 'dashed', padding: 10 },
  search: { borderWidth: 2.5, borderColor: C.navy, backgroundColor: C.white, padding: 12, fontSize: 17 },
  birdChip: { borderWidth: 2, borderColor: C.navy, paddingVertical: 7, paddingHorizontal: 12 },
  birdChipTxt: { fontWeight: '700', fontSize: 14 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1.5, borderColor: C.line, paddingTop: 10 },
  kindName: { flex: 1, fontSize: 16, fontWeight: '800', color: C.navy },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 2.5, borderColor: C.navy, paddingTop: 12 },
  sexRow: { gap: 8, borderTopWidth: 1.5, borderColor: C.line, paddingTop: 10 },
  hens: { borderWidth: 2, borderColor: C.line, minWidth: 54, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.navySoft, borderWidth: 2, borderColor: C.navy, paddingVertical: 10, paddingHorizontal: 12 },
  doneTxt: { flex: 1, fontSize: 15, fontWeight: '700', color: C.navy },
  lockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.muted, padding: 12, borderWidth: 2, borderColor: C.navy },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: C.paper, borderTopWidth: 2.5, borderColor: C.navy },
});
