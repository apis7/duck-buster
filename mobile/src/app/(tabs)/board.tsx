import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { AdBanner } from '@/ads/ads';
import { currentSeason, seasonLabel } from '@/domain/season';
import { formatMeat } from '@/domain/meat';
import { hunterStats, partyMembers, partyRaceSeries, partyStats, raceSeries, seasonsIn } from '@/domain/stats';
import { useStore } from '@/state/store';
import { Bar, Body, Btn, Card, Chip, Dot, Pixel, Screen, Section } from '@/ui/kit';
import { RaceChart } from '@/ui/RaceChart';
import { C, MEDALS } from '@/ui/theme';

export default function Board() {
  const { data, titleOf } = useStore();
  const { width } = useWindowDimensions();
  const seasons = useMemo(() => {
    const s = seasonsIn(data);
    return s.includes(currentSeason()) ? s : [currentSeason(), ...s];
  }, [data]);
  const [season, setSeason] = useState<number | null>(currentSeason());
  const [byParty, setByParty] = useState(false);
  const scope = season == null ? {} : { season };

  const rows = useMemo(
    () =>
      data.hunters
        .map((h) => ({ h, s: hunterStats(data, h.id, scope) }))
        .sort((a, b) => b.s.birds - a.s.birds || b.s.hunts - a.s.hunts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, season],
  );
  const totals = rows.reduce(
    (t, r) => ({ birds: t.birds + r.s.birds, bands: t.bands + r.s.banded, greenheads: t.greenheads + r.s.greenheads, hens: t.hens + r.s.hens }),
    { birds: 0, bands: 0, greenheads: 0, hens: 0 },
  );
  const max = Math.max(1, ...rows.map((r) => r.s.birds));
  const partyRows = useMemo(
    () =>
      data.parties
        .map((p) => ({ p, s: partyStats(data, p.id, scope), members: partyMembers(data, p.id).length }))
        .sort((a, b) => b.s.birds - a.s.birds || b.s.hunts - a.s.hunts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, season],
  );
  const partyMax = Math.max(1, ...partyRows.map((r) => r.s.birds));
  const race =
    season == null
      ? []
      : byParty
        ? data.parties.map((p) => ({ color: p.color, points: partyRaceSeries(data, p.id, season) }))
        : data.hunters.map((h) => ({ color: h.color, points: raceSeries(data, h.id, season) }));
  const club = [...rows].sort((a, b) => b.s.greenheads - a.s.greenheads).filter((r) => r.s.greenheads > 0);
  const henHouse = [...rows].sort((a, b) => b.s.hens - a.s.hens).filter((r) => r.s.hens > 0);

  return (
    <View style={{ flex: 1 }}>
      <Screen title="BRAGGING BOARD">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {seasons.map((s) => (
            <Chip key={s} label={seasonLabel(s)} on={season === s} onPress={() => setSeason(s)} />
          ))}
          <Chip label="ALL TIME" on={season == null} onPress={() => setSeason(null)} />
        </ScrollView>

        {data.hunters.length === 0 ? <Body muted>Add hunters and log a hunt to get on the board.</Body> : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="HUNTERS" on={!byParty} onPress={() => setByParty(false)} />
          <Chip label="PARTIES" on={byParty} onPress={() => setByParty(true)} />
        </View>

        {byParty ? (
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pixel size={10} color={C.muted}>THE PARTIES</Pixel>
              <Pixel size={10}>{`${totals.birds} BIRDS`}</Pixel>
            </View>
            {partyRows.length === 0 ? (
              <Body muted>No parties yet. Make some in More › Hunters › Parties.</Body>
            ) : null}
            {partyRows.map((r, i) => (
              <Pressable key={r.p.id} onPress={() => router.push({ pathname: '/party/[id]', params: { id: r.p.id } })} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pixel size={11} color={MEDALS[i] && r.s.birds > 0 ? MEDALS[i] : C.muted} style={{ width: 26 }}>{`${i + 1}`}</Pixel>
                  <Dot color={r.p.color} />
                  <Body style={{ fontWeight: '800', flex: 1 }}>{r.p.name}</Body>
                  <Pixel size={11}>{`${r.s.birds}`}</Pixel>
                </View>
                <View style={{ paddingLeft: 34 }}>
                  <Bar value={r.s.birds} max={partyMax} color={r.p.color} />
                </View>
                <Body muted style={{ fontSize: 12, paddingLeft: 34 }}>
                  {`${r.members} hunters · ${r.s.hunts} hunts · ${r.s.species.size} species · ${formatMeat(r.s.meatOz)}`}
                </Body>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {!byParty ? (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pixel size={10} color={C.muted}>THE CREW</Pixel>
            <Pixel size={10}>{`${totals.birds} BIRDS`}</Pixel>
          </View>
          {rows.map((r, i) => (
            <View key={r.h.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pixel size={11} color={MEDALS[i] && r.s.birds > 0 ? MEDALS[i] : C.muted} style={{ width: 26 }}>{`${i + 1}`}</Pixel>
                <Dot color={r.h.color} />
                <Body style={{ fontWeight: '800', flex: 1 }} >{r.h.name}</Body>
                <Pixel size={11}>{`${r.s.birds}`}</Pixel>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 34 }}>
                <Bar value={r.s.birds} max={max} color={r.h.color} />
              </View>
              <Body muted style={{ fontSize: 12, paddingLeft: 34 }}>
                {`${titleOf(r.h.id).name} · ${r.s.hunts} hunts · ${r.s.species.size} species · ${formatMeat(r.s.meatOz)}${r.s.banded ? ` · ${r.s.banded}💍` : ''}`}
              </Body>
            </View>
          ))}
        </Card>
        ) : null}

        {season != null && totals.birds > 0 ? (
          <Section title="The race">
            <RaceChart width={width - 32} start={raceStart(season, race)} series={race} />
          </Section>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1, gap: 6 }}>
            <Pixel size={9} color={C.marsh}>GREENHEAD CLUB</Pixel>
            <Pixel size={20}>{`${totals.greenheads}`}</Pixel>
            {club.slice(0, 3).map((r) => (
              <Body key={r.h.id} style={{ fontSize: 13 }}>{`${r.h.name} ${r.s.greenheads}`}</Body>
            ))}
          </Card>
          <Card style={{ flex: 1, gap: 6 }}>
            <Pixel size={9} color="#8A6A48">HEN HOUSE</Pixel>
            <Pixel size={20}>{`${totals.hens}`}</Pixel>
            {henHouse.slice(0, 3).map((r) => (
              <Body key={r.h.id} style={{ fontSize: 13 }}>{`${r.h.name} ${r.s.hens}`}</Body>
            ))}
          </Card>
        </View>

        <Section title="Hunters">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {data.hunters.map((h) => (
              <Chip key={h.id} label={h.name} color={h.color} onPress={() => router.push({ pathname: '/hunter/[id]', params: { id: h.id } })} />
            ))}
          </View>
        </Section>

        <View style={{ gap: 12 }}>
          <Btn
            label={byParty ? '🥊 PARTY RIVALRY' : '🥊 RIVALRY'}
            kind="secondary"
            onPress={() => router.push({ pathname: '/rivalry', params: { mode: byParty ? 'parties' : 'hunters' } })}
            disabled={byParty ? data.parties.length < 2 : data.hunters.length < 2}
          />
          <Btn label="🏆 AWARDS NIGHT" kind="secondary" onPress={() => router.push({ pathname: '/awards', params: { season: String(season ?? currentSeason()) } })} />
          <Btn label="🎁 SEASON WRAPPED" kind="secondary" onPress={() => router.push({ pathname: '/wrapped', params: { season: String(season ?? currentSeason()) } })} />
        </View>
      </Screen>
      <AdBanner />
    </View>
  );
}

/** Opening line of the race: September 1, or the first hunt if someone was out earlier. */
function raceStart(season: number, race: { points: { date: string }[] }[]): string {
  const first = race.flatMap((r) => r.points.map((p) => p.date)).sort()[0];
  const sept = `${season}-09-01`;
  return first && first < sept ? first : sept;
}
