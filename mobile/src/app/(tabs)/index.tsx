import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { currentSeason, prettyDate, seasonLabel, seasonOf } from '@/domain/season';
import { SPECIES_BY_ID } from '@/domain/species';
import { useStore } from '@/state/store';
import { Body, Btn, Card, Dot, Pixel, Screen, Section } from '@/ui/kit';
import { C } from '@/ui/theme';

export default function Hunts() {
  const { data, addHunter } = useStore();
  const season = currentSeason();
  const [name, setName] = useState('');

  const hunts = useMemo(
    () => [...data.hunts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [data.hunts],
  );
  const seasonHunts = hunts.filter((h) => seasonOf(h.date) === season);
  const seasonIds = new Set(seasonHunts.map((h) => h.id));
  const seasonBirds = data.harvests.filter((r) => seasonIds.has(r.huntId)).reduce((n, r) => n + r.count, 0);
  const hunterById = new Map(data.hunters.map((h) => [h.id, h]));

  if (data.hunters.length === 0) {
    const add = async () => {
      if (!name.trim()) return;
      await addHunter(name);
      setName('');
    };
    return (
      <Screen title="DUCK BUSTER">
        <Card style={{ gap: 12 }}>
          <Pixel size={12}>WHO HUNTS?</Pixel>
          <Body>Add the hunters in your crew. You can add more any time.</Body>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            onSubmitEditing={add}
            returnKeyType="done"
            style={{ borderWidth: 2, borderColor: C.navy, padding: 12, fontSize: 17, backgroundColor: C.white }}
          />
          <Btn label="ADD HUNTER" onPress={add} disabled={!name.trim()} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="DUCK BUSTER" right={<Pixel size={9} color={C.muted}>{seasonLabel(season)}</Pixel>}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Pixel size={22}>{`${seasonBirds}`}</Pixel>
          <Pixel size={8} color={C.muted}>BIRDS</Pixel>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Pixel size={22}>{`${seasonHunts.length}`}</Pixel>
          <Pixel size={8} color={C.muted}>HUNTS</Pixel>
        </Card>
      </View>

      <Btn label="+ LOG A HUNT" onPress={() => router.push('/hunt')} />

      <Section title="Recent hunts">
        {hunts.length === 0 ? <Body muted>No hunts yet. Go get some!</Body> : null}
        {hunts.slice(0, 40).map((h) => {
          const rows = data.harvests.filter((r) => r.huntId === h.id);
          const birds = rows.reduce((n, r) => n + r.count, 0);
          const bands = rows.reduce((n, r) => n + r.banded, 0);
          const species = Array.from(new Set(rows.map((r) => r.speciesId)));
          const party = data.huntHunters.filter((p) => p.huntId === h.id).map((p) => hunterById.get(p.hunterId)).filter(Boolean);
          return (
            <Card key={h.id} onPress={() => router.push({ pathname: '/hunt', params: { id: h.id } })} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Pixel size={10}>{prettyDate(h.date).toUpperCase()}</Pixel>
                <Pixel size={10} color={birds ? C.orange : C.muted}>
                  {birds ? `${birds} ${birds === 1 ? 'BIRD' : 'BIRDS'}${bands ? ` · ${bands}💍` : ''}` : 'SKUNKED 🦨'}
                </Pixel>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {party.map((p) => (
                  <View key={p!.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Dot color={p!.color} size={10} />
                    <Body style={{ fontSize: 13 }}>{p!.name}</Body>
                  </View>
                ))}
              </View>
              {species.length ? (
                <Body muted style={{ fontSize: 13 }}>
                  {species.map((s) => SPECIES_BY_ID[s]?.name ?? s).join(', ')}
                </Body>
              ) : null}
            </Card>
          );
        })}
      </Section>
    </Screen>
  );
}
