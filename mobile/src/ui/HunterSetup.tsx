import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { firstDuplicate } from '@/domain/names';
import type { Party } from '@/domain/types';
import { useStore } from '@/state/store';
import { useDialog } from '@/ui/Dialog';

import { Body, Btn, Card, Chip, Dot, Pixel } from './kit';
import { C } from './theme';

type Row = { key: number; name: string; partyId: string | null };

/**
 * Enter a whole crew at once: type a name, hit Enter, the next row is ready.
 * Parties (teams) can be made right here and hunters dropped into them; all of it
 * is saved together when you're done.
 */
export function HunterSetup({ onDone, firstRun }: { onDone: () => void; firstRun?: boolean }) {
  const { data, addHunters, draftParty } = useStore();
  const ask = useDialog();
  const [rows, setRows] = useState<Row[]>([{ key: 1, name: '', partyId: null }]);
  const [newParties, setNewParties] = useState<Party[]>([]);
  const [partyName, setPartyName] = useState('');
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const nextKey = useRef(2);
  const inputs = useRef(new Map<number, ComponentRef<typeof TextInput>>());

  const parties = [...data.parties, ...newParties];
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const named = rows.filter((r) => r.name.trim());

  function addRow(after?: number) {
    const key = nextKey.current++;
    setRows((rs) => {
      const i = after == null ? rs.length : rs.findIndex((r) => r.key === after) + 1;
      // New rows join the same party as the one above, which is usually what you want.
      const partyId = rs[i - 1]?.partyId ?? null;
      return [...rs.slice(0, i), { key, name: '', partyId }, ...rs.slice(i)];
    });
    setTimeout(() => inputs.current.get(key)?.focus(), 50);
  }

  function onSubmit(row: Row) {
    if (!row.name.trim()) return;
    const idx = rows.findIndex((r) => r.key === row.key);
    const next = rows[idx + 1];
    if (next) inputs.current.get(next.key)?.focus();
    else addRow(row.key);
  }

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));

  function createParty(forRow?: number) {
    const name = partyName.trim();
    if (!name) return;
    const p = draftParty(name, newParties.map((x) => x.color));
    setNewParties((ps) => [...ps, p]);
    setPartyName('');
    if (forRow != null) update(forRow, { partyId: p.id });
  }

  async function save() {
    if (!named.length) return;
    const dup = firstDuplicate(data.hunters, named.map((r) => r.name));
    if (dup) {
      await ask({ icon: '👯', title: `Two hunters named ${dup}`, message: 'Give each hunter their own name (a last initial works) so the Bragging Board can tell them apart.', buttons: [{ label: 'OK', value: 'ok', kind: 'primary' }] });
      return;
    }
    setSaving(true);
    try {
      await addHunters(named.map((r) => ({ name: r.name, partyId: r.partyId })), newParties);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 8 }}>
        <Pixel size={12}>{firstRun ? "WHO'S IN THE CREW?" : 'ADD HUNTERS'}</Pixel>
        <Body>Type a name and hit Enter for the next one. Add everyone at once.</Body>
        <Body muted style={{ fontSize: 13 }}>
          Parties are teams — like "Dad's Blind" vs "The Cousins". Party stats go head to head, just like hunters. Optional.
        </Body>
      </Card>

      {rows.map((row, i) => {
        const party = row.partyId ? partyById.get(row.partyId) : null;
        return (
          <View key={row.key} style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pixel size={10} color={C.muted} style={{ width: 22 }}>{`${i + 1}`}</Pixel>
              <TextInput
                ref={(r) => {
                  if (r) inputs.current.set(row.key, r);
                  else inputs.current.delete(row.key);
                }}
                autoFocus={i === 0}
                value={row.name}
                onChangeText={(t) => update(row.key, { name: t })}
                placeholder={i === 0 ? 'Name' : 'Next hunter'}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => onSubmit(row)}
                style={styles.input}
              />
              <Pressable onPress={() => setOpenRow(openRow === row.key ? null : row.key)} style={[styles.partyBtn, party && { borderColor: party.color }]}>
                {party ? <Dot color={party.color} size={10} /> : null}
                <Text numberOfLines={1} style={{ color: party ? C.ink : C.muted, fontWeight: '700', maxWidth: 90 }}>
                  {party ? party.name : 'Party'}
                </Text>
              </Pressable>
              {rows.length > 1 ? (
                <Pressable onPress={() => remove(row.key)} hitSlop={8}>
                  <Text style={{ fontSize: 20, color: C.muted, fontWeight: '800' }}>×</Text>
                </Pressable>
              ) : null}
            </View>
            {openRow === row.key ? (
              <View style={{ gap: 8, paddingTop: 8 }}>
                <View style={styles.wrap}>
                  <Chip label="No party" on={!row.partyId} onPress={() => { update(row.key, { partyId: null }); setOpenRow(null); }} />
                  {parties.map((p) => (
                    <Chip key={p.id} label={p.name} color={p.color} on={row.partyId === p.id} onPress={() => { update(row.key, { partyId: p.id }); setOpenRow(null); }} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={partyName}
                    onChangeText={setPartyName}
                    placeholder="New party name"
                    onSubmitEditing={() => { createParty(row.key); setOpenRow(null); }}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <Btn label="+ PARTY" small onPress={() => { createParty(row.key); setOpenRow(null); }} disabled={!partyName.trim()} />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      <Btn label="+ ANOTHER HUNTER" kind="secondary" onPress={() => addRow()} />
      <Btn
        label={saving ? 'SAVING…' : named.length ? `SAVE ${named.length} ${named.length === 1 ? 'HUNTER' : 'HUNTERS'}` : 'ADD A NAME FIRST'}
        onPress={save}
        disabled={!named.length || saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: C.white, borderWidth: 2, borderColor: C.navy, padding: 10 },
  input: { flex: 1, borderWidth: 2, borderColor: C.navy, paddingVertical: 8, paddingHorizontal: 10, fontSize: 16, backgroundColor: C.white },
  partyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: C.line, paddingVertical: 8, paddingHorizontal: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
