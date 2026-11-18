import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { formatMeat } from '@/domain/meat';
import { currentSeason, prettyDate, seasonLabel } from '@/domain/season';
import { SPECIES_BY_ID } from '@/domain/species';
import { hunterStats, partyMembers, partyStats } from '@/domain/stats';
import { useStore } from '@/state/store';
import { Bar, Body, Btn, Card, Chip, Dot, Pixel, Section } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

/** A party's numbers, laid out like a hunter's profile, with its members ranked inside. */
export default function PartyProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useStore();
  const [allTime, setAllTime] = useState(false);
  const party = data.parties.find((p) => p.id === id);
  if (!party) return <SubScreen title="PARTY"><Body>Party not found.</Body></SubScreen>;

  const season = currentSeason();
  const scope = allTime ? {} : { season };
  const s = partyStats(data, party.id, scope);
  const members = partyMembers(data, party.id)
    .map((hid) => ({ h: data.hunters.find((x) => x.id === hid)!, s: hunterStats(data, hid, scope) }))
    .sort((a, b) => b.s.birds - a.s.birds);
  const max = Math.max(1, ...members.map((m) => m.s.birds));
  const species = Object.entries(s.bySpecies).sort((a, b) => b[1] - a[1]);

  const stat = (label: string, value: string | number) => (
    <View style={{ width: '33.33%', alignItems: 'center', paddingVertical: 8 }}>
      <Pixel size={15}>{`${value}`}</Pixel>
      <Pixel size={7} color={C.muted}>{label}</Pixel>
    </View>
  );

  return (
    <SubScreen title={party.name.toUpperCase()}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={seasonLabel(season)} on={!allTime} onPress={() => setAllTime(false)} color={party.color} />
        <Chip label="ALL TIME" on={allTime} onPress={() => setAllTime(true)} color={party.color} />
      </View>

      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 6, borderColor: party.color }}>
        {stat('BIRDS', s.birds)}
        {stat('HUNTS', s.hunts)}
        {stat('SPECIES', s.species.size)}
        {stat('GREENHEADS', s.greenheads)}
        {stat('BANDS', s.banded)}
        {stat('SKUNKS', s.skunks)}
      </Card>
      <Body>{`🧊 Freezer: ${formatMeat(s.meatOz)} of meat (estimate)`}</Body>
      {s.biggestDay ? <Body muted>{`Biggest day: ${s.biggestDay.birds} birds on ${prettyDate(s.biggestDay.hunt.date)}`}</Body> : null}

      <Section title="Members">
        <Card style={{ gap: 10 }}>
          {members.length === 0 ? <Body muted>No hunters in this party yet. Add them in Parties.</Body> : null}
          {members.map((m) => (
            <View key={m.h.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Dot color={m.h.color} />
                <Body style={{ fontWeight: '800', flex: 1 }}>{m.h.name}</Body>
                <Pixel size={11}>{`${m.s.birds}`}</Pixel>
              </View>
              <Bar value={m.s.birds} max={max} color={party.color} />
            </View>
          ))}
        </Card>
      </Section>

      {species.length ? (
        <Section title="Bag by species">
          <Card style={{ gap: 6 }}>
            {species.map(([sp, n]) => (
              <View key={sp} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Body>{SPECIES_BY_ID[sp]?.name ?? sp}</Body>
                <Pixel size={10}>{`${n}`}</Pixel>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Btn label="🥊 PARTY RIVALRY" kind="secondary" onPress={() => router.push({ pathname: '/rivalry', params: { mode: 'parties' } })} disabled={data.parties.length < 2} />
    </SubScreen>
  );
}
