import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatMeat } from '@/domain/meat';
import { partyMembers, partyStats } from '@/domain/stats';
import { PARTY_COLORS, useStore } from '@/state/store';
import { useDialog } from '@/ui/Dialog';
import { Body, Btn, Card, Chip, Dot, Explainer, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

/** Parties (teams): create, rename, recolor, choose members. */
export default function Parties() {
  const { data, addParty, updateParty, deleteParty, setHunterParty } = useStore();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const ask = useDialog();

  const create = async () => {
    if (!name.trim()) return;
    const p = await addParty(name);
    setName('');
    setEditing(p.id);
    setDraft(p.name);
  };

  const confirmDelete = async (id: string, n: string) => {
    const yes = await ask({
      icon: '🗑️',
      title: `Delete ${n}?`,
      message: 'Its hunters stay — they just won’t be in a party.',
      buttons: [
        { label: 'Delete', value: 'yes', kind: 'danger' },
        { label: 'Keep', value: 'no' },
      ],
    });
    if (yes === 'yes') await deleteParty(id);
  };

  return (
    <SubScreen title="PARTIES">
      <Explainer>
        Parties are teams of hunters, so you can compete as teams within your family or group — like "Dad's Blind" vs "The
        Cousins", or each household against the others. Put each hunter on a party, and every bird they log counts for
        their team. Party totals go head to head on the Bragging Board (tap PARTIES) and in Party Rivalry. Optional — skip
        it if you just want hunter vs hunter.
      </Explainer>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={name} onChangeText={setName} placeholder="New party name" onSubmitEditing={create} style={styles.input} />
        <Btn label="ADD" small onPress={create} disabled={!name.trim()} />
      </View>

      {data.parties.length === 0 ? <Body muted>No parties yet.</Body> : null}

      {data.parties.map((p) => {
        const members = partyMembers(data, p.id);
        const s = partyStats(data, p.id);
        const open = editing === p.id;
        return (
          <Card key={p.id} style={{ gap: 10, borderColor: p.color }}>
            <Pressable onPress={() => router.push({ pathname: '/party/[id]', params: { id: p.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Dot color={p.color} size={18} />
              <View style={{ flex: 1 }}>
                <Pixel size={11}>{p.name.toUpperCase()}</Pixel>
                <Body muted style={{ fontSize: 13 }}>
                  {`${members.length} ${members.length === 1 ? 'hunter' : 'hunters'} · ${s.birds} birds · ${formatMeat(s.meatOz)}`}
                </Body>
              </View>
              <Pixel size={10} color={C.muted}>{'>'}</Pixel>
            </Pressable>

            {open ? (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput value={draft} onChangeText={setDraft} style={styles.input} />
                  <Btn label="OK" small onPress={async () => { await updateParty(p.id, { name: draft }); setEditing(null); }} />
                </View>
                <Pixel size={8} color={C.muted}>COLOR</Pixel>
                <View style={styles.wrap}>
                  {PARTY_COLORS.map((c) => {
                    const taken = data.parties.some((o) => o.id !== p.id && o.color === c);
                    return (
                      <Pressable
                        key={c}
                        disabled={taken}
                        onPress={() => updateParty(p.id, { color: c })}
                        style={[styles.swatch, { backgroundColor: c, opacity: taken ? 0.2 : 1 }, p.color === c && styles.swatchOn]}
                      />
                    );
                  })}
                </View>
                <Pixel size={8} color={C.muted}>MEMBERS</Pixel>
                <View style={styles.wrap}>
                  {data.hunters.map((h) => {
                    const inThis = h.partyId === p.id;
                    const other = h.partyId && !inThis ? data.parties.find((o) => o.id === h.partyId) : null;
                    return (
                      <Chip
                        key={h.id}
                        label={other ? `${h.name} (${other.name})` : h.name}
                        color={p.color}
                        on={inThis}
                        onPress={() => setHunterParty(h.id, inThis ? null : p.id)}
                      />
                    );
                  })}
                </View>
                <Text style={{ fontSize: 12, color: C.muted }}>A hunter can be in one party; tapping moves them here.</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable onPress={() => { setEditing(open ? null : p.id); setDraft(p.name); }} hitSlop={8}>
                <Pixel size={8}>{open ? 'DONE' : 'EDIT'}</Pixel>
              </Pressable>
              <Pressable onPress={() => confirmDelete(p.id, p.name)} hitSlop={8}>
                <Pixel size={8} color={C.red}>DELETE</Pixel>
              </Pressable>
            </View>
          </Card>
        );
      })}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 2, borderColor: C.navy, padding: 10, fontSize: 16, backgroundColor: C.white, flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 34, height: 34, borderWidth: 2, borderColor: C.navy },
  swatchOn: { borderWidth: 4, borderColor: C.ink, transform: [{ scale: 1.1 }] },
});
