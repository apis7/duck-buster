import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { hunterStats } from '@/domain/stats';
import { useStore } from '@/state/store';
import { Body, Btn, Card, Chip, Dot, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

const inputStyle = { borderWidth: 2, borderColor: C.navy, padding: 10, fontSize: 16, backgroundColor: C.white, flex: 1 } as const;

export default function Hunters() {
  const { data, addHunter, renameHunter, deleteHunter, titleOf, setHunterParty } = useStore();
  const [partyFor, setPartyFor] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    await addHunter(name);
    setName('');
  };

  const confirmDelete = (id: string, who: string) =>
    Alert.alert(`Remove ${who}?`, `${who}'s birds, badges and spot on the board go too. Hunts they shared stay for everyone else.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteHunter(id) },
    ]);

  return (
    <SubScreen title="HUNTERS">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={name} onChangeText={setName} placeholder="New hunter's name" onSubmitEditing={add} style={inputStyle} />
        <Btn label="ADD" onPress={add} disabled={!name.trim()} small />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="+ ADD SEVERAL" kind="secondary" small onPress={() => router.push('/setup')} style={{ flex: 1 }} />
        <Btn label="👥 PARTIES" kind="secondary" small onPress={() => router.push('/parties')} style={{ flex: 1 }} />
      </View>
      {data.hunters.map((h) => {
        const s = hunterStats(data, h.id);
        const party = h.partyId ? data.parties.find((p) => p.id === h.partyId) : null;
        return (
          <Card key={h.id} style={{ gap: 8 }}>
            {editing === h.id ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput autoFocus value={draft} onChangeText={setDraft} style={inputStyle} />
                <Btn
                  label="OK"
                  small
                  onPress={async () => {
                    if (draft.trim()) await renameHunter(h.id, draft);
                    setEditing(null);
                  }}
                />
              </View>
            ) : (
              <Pressable onPress={() => router.push({ pathname: '/hunter/[id]', params: { id: h.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Dot color={h.color} size={16} />
                <View style={{ flex: 1 }}>
                  <Pixel size={11}>{h.name.toUpperCase()}</Pixel>
                  <Body muted style={{ fontSize: 13 }}>
                    {`${titleOf(h.id).name} · ${s.birds} birds all time${party ? ` · ${party.name}` : ''}`}
                  </Body>
                </View>
              </Pressable>
            )}
            {partyFor === h.id ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="No party" on={!h.partyId} onPress={() => { setHunterParty(h.id, null); setPartyFor(null); }} />
                {data.parties.map((p) => (
                  <Chip key={p.id} label={p.name} color={p.color} on={h.partyId === p.id} onPress={() => { setHunterParty(h.id, p.id); setPartyFor(null); }} />
                ))}
                <Chip label="+ NEW PARTY" color={C.orange} onPress={() => router.push('/parties')} />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable onPress={() => setPartyFor(partyFor === h.id ? null : h.id)} hitSlop={8}>
                <Pixel size={8} color={party?.color ?? C.navy}>{party ? `PARTY: ${party.name.toUpperCase()}` : 'SET PARTY'}</Pixel>
              </Pressable>
              <Pressable onPress={() => { setEditing(h.id); setDraft(h.name); }} hitSlop={8}>
                <Pixel size={8} color={C.navy}>RENAME</Pixel>
              </Pressable>
              <Pressable onPress={() => confirmDelete(h.id, h.name)} hitSlop={8}>
                <Pixel size={8} color={C.red}>REMOVE</Pixel>
              </Pressable>
            </View>
          </Card>
        );
      })}
    </SubScreen>
  );
}
