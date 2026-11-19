import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { maybeShowInterstitial } from '@/ads/ads';
import { play } from '@/audio/sfx';
import { todayISO } from '@/domain/season';
import { huntStandings, huntWinner } from '@/domain/winner';
import { useStore } from '@/state/store';
import { Btn, Pixel } from '@/ui/kit';
import { C } from '@/ui/theme';

/**
 * After a hunt is finalized: who won, and — if it's today's hunt and the round
 * hasn't been played — hand them the phone. They can also play later today.
 */
export default function Winner() {
  const { huntId } = useLocalSearchParams<{ huntId: string }>();
  const { data } = useStore();
  const insets = useSafeAreaInsets();
  const hunt = data.hunts.find((h) => h.id === huntId);
  const winner = hunt ? huntWinner(data, hunt.id) : null;
  const name = winner ? (data.hunters.find((h) => h.id === winner.hunterId)?.name ?? '') : '';
  const played = data.gameScores.some((g) => g.huntId === huntId);
  const canPlay = !!winner && !!hunt && hunt.date === todayISO() && !played;
  const standings = hunt ? huntStandings(data, hunt.id) : [];

  useEffect(() => {
    if (winner) play('celebrate');
  }, [winner]);

  const leave = () => {
    router.dismissTo('/(tabs)');
    maybeShowInterstitial();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.navyDark, paddingTop: insets.top + 50, paddingBottom: insets.bottom + 20, paddingHorizontal: 22 }}>
      {winner ? (
        <Animated.View entering={ZoomIn.duration(200)} style={{ alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 70 }}>🏆</Text>
          <Pixel size={22} color={C.gold} style={{ textAlign: 'center', lineHeight: 34 }}>{name.toUpperCase()}</Pixel>
          <Pixel size={11} color={C.white} style={{ textAlign: 'center', lineHeight: 20 }}>{'IS THE WINNER OF\nTODAY’S HUNT!'}</Pixel>
          <Text style={{ color: C.navySoft, fontSize: 15 }}>
            {winner.bands ? `${winner.bands} ${winner.bands === 1 ? 'band' : 'bands'} — an automatic win` : `${winner.points} points · ${winner.birds} birds`}
          </Text>
        </Animated.View>
      ) : (
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 70 }}>🦨</Text>
          <Pixel size={14} color={C.white} style={{ textAlign: 'center', lineHeight: 24 }}>{'NOBODY WINS\nA SKUNK'}</Pixel>
        </View>
      )}

      <View style={{ marginTop: 26, gap: 6 }}>
        {standings.map((s, i) => {
          const h = data.hunters.find((x) => x.id === s.hunterId);
          return (
            <View key={s.hunterId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pixel size={10} color={i === 0 && winner ? C.gold : C.navySoft}>{`${i + 1}. ${(h?.name ?? '?').toUpperCase()}`}</Pixel>
              <Pixel size={10} color={i === 0 && winner ? C.gold : C.navySoft}>{s.bands ? `${s.points} +💍` : `${s.points}`}</Pixel>
            </View>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      {canPlay ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: C.white, fontSize: 17, textAlign: 'center', lineHeight: 24 }}>
            {`Hand ${name} the phone — the winner gets one round of the duck shoot, and it counts for the season.`}
          </Text>
          <Btn label={`🎮 ${name.toUpperCase()}, PLAY NOW`} onPress={() => router.replace({ pathname: '/round', params: { huntId } })} />
          <Btn label="LATER (TODAY ONLY)" kind="secondary" onPress={leave} />
        </View>
      ) : (
        <Btn label="DONE" onPress={leave} />
      )}
    </View>
  );
}
