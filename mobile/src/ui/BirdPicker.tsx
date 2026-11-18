import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CUSTOM_SPECIES, GROUP_LABEL, SPECIES, type Species, type SpeciesGroup } from '@/domain/species';
import { useStore } from '@/state/store';

import { Body, Btn, Pixel } from './kit';
import { C } from './theme';

const ORDER: SpeciesGroup[] = ['dabbler', 'diver', 'merganser', 'sea', 'whistling', 'goose', 'coot', 'other'];

/** Every bird, grouped, plus "add a new bird" — which is remembered for next time. */
export function BirdPicker({
  visible, initialName, onPick, onClose,
}: { visible: boolean; initialName?: string; onPick: (speciesId: string) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { addCustomSpecies, data } = useStore();
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState<string | null>(initialName ?? null);
  const [sexed, setSexed] = useState(true);

  const groups = useMemo(() => {
    const all = [...SPECIES, ...CUSTOM_SPECIES];
    const f = filter.trim().toLowerCase();
    const shown = f ? all.filter((s) => s.name.toLowerCase().includes(f) || s.aliases.some((a) => a.includes(f))) : all;
    return ORDER.map((g) => ({ g, list: shown.filter((s) => s.group === g) })).filter((x) => x.list.length);
    // CUSTOM_SPECIES changes with data.customSpecies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, data.customSpecies]);

  async function add() {
    const name = adding?.trim();
    if (!name) return;
    const existing = [...SPECIES, ...CUSTOM_SPECIES].find((s) => s.name.toLowerCase() === name.toLowerCase());
    const id = existing ? existing.id : (await addCustomSpecies(name, sexed)).id;
    setAdding(null);
    onPick(id);
  }

  const pick = (s: Species) => onPick(s.id);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top }}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Pixel size={10}>{'< BACK'}</Pixel>
          </Pressable>
          <Pixel size={12}>ALL BIRDS</Pixel>
          <View style={{ width: 50 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 30 }}>
          {adding === null ? (
            <>
              <TextInput value={filter} onChangeText={setFilter} placeholder="Filter…" autoCorrect={false} style={styles.input} />
              <Btn label="+ ADD A NEW BIRD" kind="secondary" onPress={() => setAdding(filter)} />
            </>
          ) : (
            <View style={styles.addCard}>
              <Pixel size={10}>NEW BIRD</Pixel>
              <TextInput autoFocus value={adding} onChangeText={setAdding} placeholder="Name, e.g. Tundra Swan" style={styles.input} onSubmitEditing={add} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Body style={{ flex: 1 }}>Log drakes and hens separately</Body>
                <Switch value={sexed} onValueChange={setSexed} trackColor={{ true: C.orange, false: C.locked }} />
              </View>
              <Body muted style={{ fontSize: 13 }}>It's remembered and shows up in search from now on.</Body>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn label="CANCEL" kind="secondary" small onPress={() => setAdding(null)} style={{ flex: 1 }} />
                <Btn label="ADD & LOG IT" small onPress={add} disabled={!adding.trim()} style={{ flex: 1.4 }} />
              </View>
            </View>
          )}
          {groups.map(({ g, list }) => (
            <View key={g} style={{ gap: 6 }}>
              <Pixel size={9} color={C.muted}>{GROUP_LABEL[g].toUpperCase()}</Pixel>
              <View style={styles.wrap}>
                {list.map((s) => (
                  <Pressable key={s.id} onPress={() => pick(s)} style={styles.bird}>
                    <Text style={styles.birdTxt}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: C.white, borderBottomWidth: 2.5, borderColor: C.navy },
  input: { borderWidth: 2.5, borderColor: C.navy, backgroundColor: C.white, padding: 12, fontSize: 16 },
  addCard: { backgroundColor: C.white, borderWidth: 2.5, borderColor: C.orange, padding: 12, gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bird: { borderWidth: 2, borderColor: C.navy, backgroundColor: C.white, paddingVertical: 8, paddingHorizontal: 12 },
  birdTxt: { fontSize: 14, fontWeight: '700', color: C.navy },
});
