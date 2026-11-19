import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { play } from '@/audio/sfx';
import { seasonBadges } from '@/domain/archive';
import { seasonAwards } from '@/domain/awards';
import { HONORS, seasonHonors } from '@/domain/honors';
import { currentSeason, seasonLabel } from '@/domain/season';
import { useStore } from '@/state/store';
import { Body, Btn, Pixel } from '@/ui/kit';
import { SeasonBadges } from '@/ui/SeasonBadges';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

/** Awards Night: envelopes opened one at a time, serious awards first, then the roast. */
export default function Awards() {
  const params = useLocalSearchParams<{ season?: string }>();
  const season = Number(params.season) || currentSeason();
  const { data, celebratedAt } = useStore();
  const badges = useMemo(() => seasonBadges(celebratedAt, season), [celebratedAt, season]);
  // Awards, then the roast, then the season titles — saving the Grand Poombah for last.
  const results = useMemo(() => {
    const awards = seasonAwards(data, season, badges).map((r) => ({
      key: r.award.id, icon: r.award.icon, title: r.award.title, winners: r.winners, text: r.text, kind: r.award.roast ? 'roast' : 'award',
    }));
    const order = ['coots', 'third', 'second', 'first'] as const;
    const titles = order
      .map((id) => seasonHonors(data, season).find((h) => h.id === id))
      .filter((h): h is NonNullable<typeof h> => !!h)
      .map((h) => ({
        key: `title-${h.id}`, icon: HONORS[h.id].icon, title: HONORS[h.id].title, winners: h.hunterIds,
        text: h.id === 'coots' ? `${h.value} coots. The ditch chickens fear you.` : `${HONORS[h.id].why} · ${h.value} points`, kind: 'title',
      }));
    return [...awards, ...titles];
  }, [data, season, badges]);
  const [shown, setShown] = useState(0);
  const names = new Map(data.hunters.map((h) => [h.id, h]));

  useEffect(() => {
    if (shown > 0) play('badge');
  }, [shown]);

  const firstRoast = results.findIndex((r) => r.kind === 'roast');
  const firstTitle = results.findIndex((r) => r.kind === 'title');

  return (
    <SubScreen title={`AWARDS ${seasonLabel(season)}`} dark>
      {results.length === 0 ? (
        <Body style={{ color: C.navySoft }}>No hunts this season yet. The trophies are waiting.</Body>
      ) : null}

      {results.slice(0, shown).map((r, i) => (
        <Animated.View key={r.key} entering={FadeInDown.duration(200)}>
          {i === firstRoast ? (
            <Pixel size={10} color={C.orange} style={{ textAlign: 'center', marginVertical: 10 }}>
              ~ AND NOW, THE ROAST ~
            </Pixel>
          ) : null}
          {i === firstTitle ? (
            <Pixel size={10} color={C.gold} style={{ textAlign: 'center', marginVertical: 10 }}>
              ~ AND NOW, THE SEASON TITLES ~
            </Pixel>
          ) : null}
          <View
            style={{
              backgroundColor: r.kind === 'roast' ? '#2A1F12' : r.kind === 'title' ? '#3A2A06' : C.navy,
              borderWidth: r.kind === 'title' ? 4 : 2.5,
              borderColor: r.kind === 'roast' ? C.orange : C.gold,
              padding: 14,
              gap: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 40 }}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Pixel size={10} color={r.kind === 'roast' ? C.orange : C.gold} style={{ lineHeight: 16 }}>{r.title.toUpperCase()}</Pixel>
                <Pixel size={14} color={C.white}>
                  {r.winners.map((w) => names.get(w)?.name ?? '?').join(' & ').toUpperCase()}
                </Pixel>
              </View>
            </View>
            <Body style={{ color: C.navySoft }}>{r.text}</Body>
          </View>
        </Animated.View>
      ))}

      {shown < results.length ? (
        <Pressable onPress={() => setShown((n) => n + 1)} style={{ marginTop: 8 }}>
          <View style={{ borderWidth: 2.5, borderStyle: 'dashed', borderColor: C.gold, padding: 26, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 40 }}>✉️</Text>
            <Pixel size={10} color={C.gold}>{shown === 0 ? 'TAP TO OPEN THE FIRST ENVELOPE' : 'NEXT ENVELOPE'}</Pixel>
            <Pixel size={7} color={C.navySoft}>{`${results.length - shown} TO GO`}</Pixel>
          </View>
        </Pressable>
      ) : results.length ? (
        <>
          <SeasonBadges badges={badges} names={names} dark />
          <Btn label="START OVER" kind="secondary" onPress={() => setShown(0)} />
        </>
      ) : null}
    </SubScreen>
  );
}
