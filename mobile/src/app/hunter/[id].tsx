import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { archivedSeasons, hasPastSeasons } from '@/domain/archive';
import { BADGE_BY_ID, BADGES } from '@/domain/badges';
import { honorsFor, HONORS } from '@/domain/honors';
import { speciesLabel, speciesLeads } from '@/domain/leads';
import { formatMeat } from '@/domain/meat';
import { currentSeason, prettyDate, seasonLabel } from '@/domain/season';
import { SPECIES_BY_ID } from '@/domain/species';
import { hunterStats } from '@/domain/stats';
import { useStore } from '@/state/store';
import { Bar, Body, Btn, Card, Chip, Pixel, Section } from '@/ui/kit';
import { PixelBird } from '@/ui/PixelBird';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

export default function HunterProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, badgesFor, titleOf } = useStore();
  const [allTimePicked, setAllTime] = useState(false);
  const history = hasPastSeasons(data);
  const allTime = history && allTimePicked;
  const hunter = data.hunters.find((h) => h.id === id);
  if (!hunter) return <SubScreen title="HUNTER"><Body>Hunter not found.</Body></SubScreen>;

  const season = currentSeason();
  const s = hunterStats(data, hunter.id, allTime ? {} : { season });
  const title = titleOf(hunter.id);
  const badges = badgesFor(hunter.id);
  const species = Object.entries(s.bySpecies).sort((a, b) => b[1] - a[1]);
  const party = hunter.partyId ? data.parties.find((p) => p.id === hunter.partyId) : null;
  const honors = honorsFor(data, hunter.id, archivedSeasons(data));
  // Each species this hunter leads the crew in counts as a badge while it lasts.
  const leads = speciesLeads(data, allTime ? {} : { season }).get(hunter.id) ?? [];

  const stat = (label: string, value: string | number) => (
    <View style={{ width: '33.33%', alignItems: 'center', paddingVertical: 8 }}>
      <Pixel size={16}>{`${value}`}</Pixel>
      <Pixel size={7} color={C.muted}>{label}</Pixel>
    </View>
  );

  return (
    <SubScreen title={hunter.name.toUpperCase()}>
      <Card style={{ gap: 8, borderColor: hunter.color }}>
        <Pixel size={9} color={C.muted}>{`LEVEL ${title.level}`}</Pixel>
        <Pixel size={16} color={hunter.color}>{title.name.toUpperCase()}</Pixel>
        <Bar value={title.progress} max={1} color={C.orange} />
        <Body muted style={{ fontSize: 12 }}>
          {title.next ? `${title.xp} XP · ${title.next.xp - title.xp} to ${title.next.name}` : `${title.xp} XP · top of the ladder`}
        </Body>
      </Card>

      {honors.length ? (
        <Card style={{ gap: 8, borderColor: C.gold }}>
          <Pixel size={9} color={C.muted}>SEASON TITLES</Pixel>
          {honors.map((h) => (
            <View key={`${h.season}-${h.id}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 22 }}>{HONORS[h.id].icon}</Text>
              <View style={{ flex: 1 }}>
                <Pixel size={9} style={{ lineHeight: 15 }}>{HONORS[h.id].title.toUpperCase()}</Pixel>
                <Body muted style={{ fontSize: 12 }}>{seasonLabel(h.season)}</Body>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {history ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={seasonLabel(season)} on={!allTime} onPress={() => setAllTime(false)} />
          <Chip label="ALL TIME" on={allTime} onPress={() => setAllTime(true)} />
        </View>
      ) : null}

      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 6 }}>
        {stat('BIRDS', s.birds)}
        {stat('HUNTS', s.hunts)}
        {stat('SPECIES', s.species.size)}
        {stat('DRAKES', s.drakes)}
        {stat('HENS', s.hens)}
        {stat('BANDS', s.banded)}
        {stat('GREENHEADS', s.greenheads)}
        {stat('GEESE', s.geese)}
        {stat('SKUNKS', s.skunks)}
      </Card>

      <Body>{`🧊 Freezer: ${formatMeat(s.meatOz)} of meat (estimate)`}</Body>
      {party ? (
        <Pressable onPress={() => router.push({ pathname: '/party/[id]', params: { id: party.id } })}>
          <Body muted>{`Party: ${party.name} ›`}</Body>
        </Pressable>
      ) : null}
      {s.biggestDay ? (
        <Body muted>{`Biggest day: ${s.biggestDay.birds} birds on ${prettyDate(s.biggestDay.hunt.date)}`}</Body>
      ) : null}

      <Section title={`Badges ${badges.length + leads.length}`}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {badges.map((b) => (
            <View key={b} style={{ width: '31%', backgroundColor: C.white, borderWidth: 2, borderColor: C.navy, padding: 8, alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: 30 }}>{BADGE_BY_ID[b].icon}</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.navy, textAlign: 'center' }}>{BADGE_BY_ID[b].name}</Text>
            </View>
          ))}
        </View>
        <Body muted style={{ fontSize: 13 }}>
          {`🔒 ${BADGES.length - badges.length} secret badges left to find. Go hunting.`}
        </Body>
        <Pixel size={9} color={C.muted} style={{ marginTop: 6 }}>{`SPECIES LEADER · ${allTime ? 'ALL TIME' : seasonLabel(season)}`}</Pixel>
        {leads.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {leads.map((l) => {
              const sp = SPECIES_BY_ID[l.speciesId];
              return (
                <View key={l.speciesId} style={{ width: '31%', backgroundColor: C.white, borderWidth: 2, borderColor: C.gold, padding: 8, alignItems: 'center', gap: 2 }}>
                  {sp ? <PixelBird species={sp} size={40} /> : <Text style={{ fontSize: 30 }}>🦆</Text>}
                  <Text style={{ fontSize: 11, fontWeight: '800', color: C.navy, textAlign: 'center' }}>{`Top ${speciesLabel(data, l.speciesId)}`}</Text>
                  <Pixel size={8} color={C.orange}>{`${l.count} BAGGED`}</Pixel>
                </View>
              );
            })}
          </View>
        ) : null}
        <Body muted style={{ fontSize: 13 }}>
          {leads.length
            ? `Leads the crew in ${leads.length} ${leads.length === 1 ? 'species' : 'species'} — +1 badge each, for as long as nobody passes them.`
            : 'Bag more of a species than anyone else to lead it. Each lead is +1 badge (ties don’t count).'}
        </Body>
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

      <Btn label="🎁 SEASON WRAPPED" kind="secondary" onPress={() => router.push({ pathname: '/wrapped', params: { season: String(season), hunter: hunter.id } })} />
    </SubScreen>
  );
}
