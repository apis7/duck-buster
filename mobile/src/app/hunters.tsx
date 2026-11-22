import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { hasPastSeasons } from '@/domain/archive';
import { nameTaken } from '@/domain/names';
import { hunterStats } from '@/domain/stats';
import { useStore } from '@/state/store';
import { useDialog } from '@/ui/Dialog';
import { Body, Btn, Card, Chip, Dot, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';
import { count } from '@/domain/plural';

const inputStyle = { borderWidth: 2, borderColor: C.navy, padding: 10, fontSize: 16, backgroundColor: C.white, flex: 1 } as const;

export default function Hunters() {
  const { data, addHunter, renameHunter, deleteHunter, titleOf, setHunterParty } = useStore();
  const history = hasPastSeasons(data);
  const [partyFor, setPartyFor] = useState<string | null>(null);
  const ask = useDialog();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    const clash = nameTaken(data.hunters, name);
    if (clash) {
      await ask({ icon: '👯', title: `There's already a ${clash.name}`, message: 'Give each hunter their own name (a last initial works) so the Bragging Board can tell them apart.', buttons: [{ label: 'OK', value: 'ok', kind: 'primary' }] });
      return;
    }
    await addHunter(name);
    setName('');
  };

  const confirmDelete = async (id: string, who: string) => {
    const yes = await ask({
      icon: '🗑️',
      title: `Remove ${who}?`,
      message: `${who}'s birds, badges and spot on the board go too. Hunts they shared stay for everyone else.`,
      buttons: [
        { label: 'Remove', value: 'yes', kind: 'danger' },
        { label: 'Keep', value: 'no' },
      ],
    });
    if (yes === 'yes') await deleteHunter(id);
  };

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
                    const clash = nameTaken(data.hunters, draft, h.id);
                    if (clash) {
                      await ask({ icon: '👯', title: `There's already a ${clash.name}`, message: 'Give each hunter their own name (a last initial works) so the Bragging Board can tell them apart.', buttons: [{ label: 'OK', value: 'ok', kind: 'primary' }] });
                      return;
                    }
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
                    {`${titleOf(h.id).name} · ${count(s.birds, 'bird')}${history ? ' all time' : ''}${party ? ` · ${party.name}` : ''}`}
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
