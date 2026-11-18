import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { play } from '@/audio/sfx';
import { seasonAwards } from '@/domain/awards';
import { currentSeason, seasonLabel } from '@/domain/season';
import { useStore } from '@/state/store';
import { Body, Btn, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

/** Awards Night: envelopes opened one at a time, serious awards first, then the roast. */
export default function Awards() {
  const params = useLocalSearchParams<{ season?: string }>();
  const season = Number(params.season) || currentSeason();
  const { data } = useStore();
  const results = useMemo(() => seasonAwards(data, season), [data, season]);
  const [shown, setShown] = useState(0);
  const names = new Map(data.hunters.map((h) => [h.id, h]));

  useEffect(() => {
    if (shown > 0) play('badge');
  }, [shown]);

  const firstRoast = results.findIndex((r) => r.award.roast);

  return (
    <SubScreen title={`AWARDS ${seasonLabel(season)}`} dark>
      {results.length === 0 ? (
        <Body style={{ color: C.navySoft }}>No hunts this season yet. The trophies are waiting.</Body>
      ) : null}

      {results.slice(0, shown).map((r, i) => (
        <Animated.View key={r.award.id} entering={FadeInDown.springify().damping(12)}>
          {i === firstRoast ? (
            <Pixel size={10} color={C.orange} style={{ textAlign: 'center', marginVertical: 10 }}>
              ~ AND NOW, THE ROAST ~
            </Pixel>
          ) : null}
          <View style={{ backgroundColor: r.award.roast ? '#2A1F12' : C.navy, borderWidth: 2.5, borderColor: r.award.roast ? C.orange : C.gold, padding: 14, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 40 }}>{r.award.icon}</Text>
              <View style={{ flex: 1 }}>
                <Pixel size={10} color={r.award.roast ? C.orange : C.gold}>{r.award.title.toUpperCase()}</Pixel>
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
        <Btn label="START OVER" kind="secondary" onPress={() => setShown(0)} />
      ) : null}
    </SubScreen>
  );
}
