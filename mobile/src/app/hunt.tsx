import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { maybeShowInterstitial } from '@/ads/ads';
import { play } from '@/audio/sfx';
import { searchSpecies } from '@/domain/search';
import { prettyDate, shiftDate, todayISO } from '@/domain/season';
import { SPECIES_BY_ID } from '@/domain/species';
import type { Harvest } from '@/domain/types';
import { useStore, type NewBadge } from '@/state/store';
import { BadgeParade } from '@/ui/BadgeParade';
import { BirdPicker } from '@/ui/BirdPicker';
import { DatePicker } from '@/ui/DatePicker';
import { Btn, Chip, Pixel, Stepper } from '@/ui/kit';
import { C } from '@/ui/theme';

/** One line in the bag: a hunter's take of one species. */
type Line = { key: string; hunterId: string; speciesId: string; drakes: number; hens: number; count: number; banded: number };

const total = (l: Line) => (SPECIES_BY_ID[l.speciesId]?.sexed ? l.drakes + l.hens : l.count);

function linesFrom(rows: Harvest[]): Line[] {
  const map = new Map<string, Line>();
  for (const r of rows) {
    const key = `${r.hunterId}:${r.speciesId}`;
    const l = map.get(key) ?? { key, hunterId: r.hunterId, speciesId: r.speciesId, drakes: 0, hens: 0, count: 0, banded: 0 };
    if (r.sex === 'D') l.drakes += r.count;
    else if (r.sex === 'H') l.hens += r.count;
    else l.count += r.count;
    l.banded += r.banded;
    map.set(key, l);
  }
  return Array.from(map.values());
}

function rowsFrom(lines: Line[]): Omit<Harvest, 'id' | 'huntId'>[] {
  const out: Omit<Harvest, 'id' | 'huntId'>[] = [];
  for (const l of lines) {
    let bands = Math.min(l.banded, total(l));
    const push = (sex: Harvest['sex'], count: number) => {
      if (count <= 0) return;
      const b = Math.min(bands, count);
      bands -= b;
      out.push({ hunterId: l.hunterId, speciesId: l.speciesId, sex, count, banded: b });
    };
    if (SPECIES_BY_ID[l.speciesId]?.sexed) {
      push('D', l.drakes);
      push('H', l.hens);
    } else push('U', l.count);
  }
  return out;
}

export default function LogHunt() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, usage, saveHunt, deleteHunt, addHunter } = useStore();
  const insets = useSafeAreaInsets();
  const existing = id ? data.hunts.find((h) => h.id === id) : undefined;

  const lastParty = useMemo(() => {
    const last = [...data.hunts].sort((a, b) => b.createdAt - a.createdAt)[0];
    const p = last ? data.huntHunters.filter((x) => x.huntId === last.id).map((x) => x.hunterId) : [];
    return p.length ? p : data.hunters.map((h) => h.id);
  }, [data]);

  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [party, setParty] = useState<string[]>(
    existing ? data.huntHunters.filter((p) => p.huntId === existing.id).map((p) => p.hunterId) : lastParty,
  );
  const [shooter, setShooter] = useState<string>(party[0] ?? data.hunters[0]?.id ?? '');
  const [lines, setLines] = useState<Line[]>(() => (existing ? linesFrom(data.harvests.filter((r) => r.huntId === existing.id)) : []));
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState<string | null>(null);
  const [parade, setParade] = useState<NewBadge[] | null>(null);
  const [saving, setSaving] = useState(false);
  // An existing hunt with no birds was a skunk.
  const [skunked, setSkunked] = useState(!!existing && !data.harvests.some((r) => r.huntId === existing.id));
  const [picking, setPicking] = useState(false);
  const [pickerName, setPickerName] = useState<string | undefined>(undefined);
  const [birdPicker, setBirdPicker] = useState(false);

  // One hunt per day.
  const huntDays = useMemo(() => new Set(data.hunts.filter((h) => h.id !== existing?.id).map((h) => h.date)), [data.hunts, existing]);
  const clash = data.hunts.find((h) => h.date === date && h.id !== existing?.id);

  const results = useMemo(() => searchSpecies(query, usage, 8), [query, usage]);
  const hunterById = new Map(data.hunters.map((h) => [h.id, h]));
  const activeShooter = party.includes(shooter) ? shooter : party[0];

  function toggleParty(hid: string) {
    setParty((p) => (p.includes(hid) ? p.filter((x) => x !== hid) : [...p, hid]));
    if (!party.includes(hid)) setShooter(hid);
  }

  function addBird(speciesId: string) {
    if (!activeShooter) return;
    Haptics.selectionAsync().catch(() => {});
    // Logging a bird un-skunks the hunt.
    setSkunked(false);
    const sexed = SPECIES_BY_ID[speciesId]?.sexed;
    setLines((ls) => {
      const key = `${activeShooter}:${speciesId}`;
      const found = ls.find((l) => l.key === key);
      if (found) return ls.map((l) => (l.key === key ? { ...l, drakes: sexed ? l.drakes + 1 : 0, count: sexed ? 0 : l.count + 1 } : l));
      return [...ls, { key, hunterId: activeShooter, speciesId, drakes: sexed ? 1 : 0, hens: 0, count: sexed ? 0 : 1, banded: 0 }];
    });
    setQuery('');
  }

  const update = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  function toggleSkunk() {
    if (skunked) return setSkunked(false);
    if (lines.length) {
      Alert.alert('Skunked?', 'That clears the birds you entered for this hunt.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skunked 🦨', style: 'destructive', onPress: () => { setLines([]); setSkunked(true); } },
      ]);
    } else setSkunked(true);
  }

  function pickDate(d: string) {
    setPicking(false);
    const other = data.hunts.find((h) => h.date === d && h.id !== existing?.id);
    if (other) {
      Alert.alert('Already logged', `There's already a hunt on ${prettyDate(d)}. One hunt per day — open that one?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open it', onPress: () => router.replace({ pathname: '/hunt', params: { id: other.id } }) },
      ]);
      return;
    }
    setDate(d);
  }

  async function save() {
    if (party.length === 0) {
      Alert.alert('Who went?', 'Pick at least one hunter.');
      return;
    }
    if (clash) {
      pickDate(date);
      return;
    }
    const counted = lines.filter((l) => party.includes(l.hunterId) && total(l) > 0);
    if (!counted.length && !skunked) {
      Alert.alert('No birds?', 'Log some birds, or mark this hunt SKUNKED.', [
        { text: 'Back', style: 'cancel' },
        { text: 'Skunked 🦨', onPress: () => setSkunked(true) },
      ]);
      return;
    }
    setSaving(true);
    try {
      const { newBadges } = await saveHunt({
        id: existing?.id,
        date,
        party,
        rows: skunked ? [] : rowsFrom(lines.filter((l) => party.includes(l.hunterId))),
      });
      play('quack');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (newBadges.length) setParade(newBadges);
      else finish();
    } finally {
      setSaving(false);
    }
  }

  function finish() {
    router.back();
    maybeShowInterstitial();
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert('Delete this hunt?', 'Its birds come off the board too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteHunt(existing.id); router.back(); } },
    ]);
  }

  async function createHunter() {
    const n = newName?.trim();
    if (!n) { setNewName(null); return; }
    const h = await addHunter(n);
    setParty((p) => [...p, h.id]);
    setShooter(h.id);
    setNewName(null);
  }

  const birdsBy = (hid: string) => lines.filter((l) => l.hunterId === hid).reduce((n, l) => n + total(l), 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Pixel size={10}>{'< BACK'}</Pixel>
        </Pressable>
        <Pixel size={12}>{existing ? 'EDIT HUNT' : 'LOG A HUNT'}</Pixel>
        {existing ? (
          <Pressable onPress={confirmDelete} hitSlop={10}>
            <Pixel size={10} color={C.red}>DEL</Pixel>
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}>
        {/* Date */}
        <View style={styles.dateRow}>
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

        {/* Party */}
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
                onChangeText={setNewName}
                onSubmitEditing={createHunter}
                onBlur={createHunter}
                placeholder="Name"
                style={[styles.chipInput]}
              />
            )}
          </View>
        </View>

        {/* Shooter */}
        {party.length > 1 ? (
          <View style={{ gap: 6 }}>
            <Pixel size={9} color={C.muted}>WHOSE BIRD?</Pixel>
            <View style={styles.wrap}>
              {party.map((hid) => {
                const h = hunterById.get(hid);
                if (!h) return null;
                return <Chip key={hid} label={`${h.name} · ${birdsBy(hid)}`} on={activeShooter === hid} color={h.color} onPress={() => setShooter(hid)} />;
              })}
            </View>
          </View>
        ) : null}

        {/* Skunked: a hunt with no birds, for the whole party. */}
        <Pressable onPress={toggleSkunk} style={[styles.skunk, skunked && styles.skunkOn]}>
          <Text style={{ fontSize: 26 }}>🦨</Text>
          <View style={{ flex: 1 }}>
            <Pixel size={11} color={skunked ? C.white : C.navy}>SKUNKED</Pixel>
            <Text style={{ color: skunked ? C.white : C.muted, fontSize: 12 }}>
              {skunked ? 'No birds this hunt. Tap a bird to undo.' : 'Nobody got a bird'}
            </Text>
          </View>
          <View style={[styles.check, skunked && { backgroundColor: C.white }]}>{skunked ? <Text style={{ fontWeight: '900', color: C.navy }}>✓</Text> : null}</View>
        </Pressable>

        {/* Search */}
        <View style={{ gap: 8, opacity: skunked ? 0.45 : 1 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Type a bird: gwt, greenhead, can…"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => results[0] && addBird(results[0].id)}
            style={styles.search}
          />
          <View style={styles.wrap}>
            {results.map((s, i) => (
              <Chip key={s.id} label={s.name} on={!!query && i === 0} color={C.navy} onPress={() => addBird(s.id)} />
            ))}
            {query.trim() && !results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase()) ? (
              <Chip label={`+ Add "${query.trim()}"`} color={C.orange} onPress={() => { setPickerName(query.trim()); setBirdPicker(true); }} />
            ) : null}
            <Chip label="ALL BIRDS ▸" color={C.marsh} onPress={() => { setPickerName(undefined); setBirdPicker(true); }} />
          </View>
        </View>

        {/* Bag */}
        {party.map((hid) => {
          const mine = lines.filter((l) => l.hunterId === hid);
          if (mine.length === 0) return null;
          const h = hunterById.get(hid);
          return (
            <View key={hid} style={{ gap: 8 }}>
              <Pixel size={10} color={h?.color ?? C.navy}>{`${h?.name.toUpperCase()} · ${birdsBy(hid)}`}</Pixel>
              {mine.map((l) => {
                const sp = SPECIES_BY_ID[l.speciesId];
                return (
                  <View key={l.key} style={styles.line}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: C.navy, flex: 1 }}>{sp?.name ?? l.speciesId}</Text>
                      <Pressable onPress={() => remove(l.key)} hitSlop={10}>
                        <Text style={{ fontSize: 18, color: C.muted, fontWeight: '800' }}>×</Text>
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      {sp?.sexed ? (
                        <>
                          <Stepper label="DRAKES" value={l.drakes} onChange={(n) => update(l.key, { drakes: n })} />
                          <Stepper label="HENS" value={l.hens} onChange={(n) => update(l.key, { hens: n })} />
                        </>
                      ) : (
                        <Stepper label="COUNT" value={l.count} onChange={(n) => update(l.key, { count: n })} />
                      )}
                      <Stepper label="💍 BANDED" value={l.banded} onChange={(n) => update(l.key, { banded: Math.min(n, total(l)) })} />
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {lines.length === 0 ? (
          <Text style={{ color: C.muted, textAlign: 'center', marginTop: 8 }}>
            No birds? Tap SKUNKED above — skunks count too. 🦨
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Btn label={saving ? 'SAVING…' : 'SAVE HUNT'} onPress={save} disabled={saving} />
      </View>

      {picking ? (
        <DatePicker visible value={date} huntDays={huntDays} onPick={pickDate} onClose={() => setPicking(false)} />
      ) : null}
      {birdPicker ? (
        <BirdPicker
          visible
          initialName={pickerName}
          onPick={(id) => { setBirdPicker(false); addBird(id); }}
          onClose={() => setBirdPicker(false)}
        />
      ) : null}

      {parade ? (
        <BadgeParade
          items={parade.map((b) => ({ badge: b.badge, hunterName: hunterById.get(b.hunterId)?.name ?? '' }))}
          onDone={() => { setParade(null); finish(); }}
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
  search: { borderWidth: 2.5, borderColor: C.navy, backgroundColor: C.white, padding: 14, fontSize: 17 },
  line: { backgroundColor: C.white, borderWidth: 2, borderColor: C.navy, padding: 10, gap: 8 },
  skunk: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2.5, borderColor: C.navy, backgroundColor: C.white, padding: 10 },
  skunkOn: { backgroundColor: C.navy },
  check: { width: 26, height: 26, borderWidth: 2.5, borderColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: C.paper, borderTopWidth: 2.5, borderColor: C.navy },
});
