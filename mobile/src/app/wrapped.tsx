import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { currentSeason, seasonLabel } from '@/domain/season';
import { seasonWrapped } from '@/domain/wrapped';
import { useStore } from '@/state/store';
import { Body, Chip, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

const BACKS = ['#13315C', '#F26B1D', '#3C6E47', '#8E3A22', '#2B3F73', '#6B4F2A'];

/** Season Wrapped: tap through big-number cards. */
export default function Wrapped() {
  const params = useLocalSearchParams<{ season?: string; hunter?: string }>();
  const season = Number(params.season) || currentSeason();
  const { data, titleOf } = useStore();
  const [hunterId, setHunterId] = useState(params.hunter ?? data.hunters[0]?.id);
  const [i, setI] = useState(0);
  const hunter = data.hunters.find((h) => h.id === hunterId);
  const cards = hunter ? seasonWrapped(data, hunter.id, season, titleOf(hunter.id).name) : [];
  const card = cards[Math.min(i, cards.length - 1)];

  return (
    <SubScreen title={`WRAPPED ${seasonLabel(season)}`} scroll={false}>
      <View style={{ padding: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {data.hunters.map((h) => (
            <Chip key={h.id} label={h.name} color={h.color} on={h.id === hunterId} onPress={() => { setHunterId(h.id); setI(0); }} />
          ))}
        </ScrollView>
      </View>
      {card ? (
        <Pressable style={{ flex: 1, padding: 16 }} onPress={() => setI((n) => (n + 1) % cards.length)}>
          <Animated.View
            key={`${hunterId}-${i}`}
            entering={ZoomIn.springify().damping(14)}
            style={{ flex: 1, backgroundColor: BACKS[i % BACKS.length], borderWidth: 3, borderColor: C.navyDark, borderBottomWidth: 8, borderRightWidth: 8, padding: 24, justifyContent: 'center', gap: 18 }}
          >
            <Pixel size={11} color={C.white}>{card.kicker.toUpperCase()}</Pixel>
            <Pixel size={card.big.length > 10 ? 22 : 40} color={C.white} style={{ lineHeight: card.big.length > 10 ? 34 : 56 }}>
              {card.big.toUpperCase()}
            </Pixel>
            <Body style={{ color: C.white, fontSize: 18, lineHeight: 26 }}>{card.caption}</Body>
            <View style={{ flexDirection: 'row', gap: 6, position: 'absolute', bottom: 18, left: 24 }}>
              {cards.map((_, k) => (
                <View key={k} style={{ width: 10, height: 10, backgroundColor: k === i ? C.white : 'rgba(255,255,255,0.35)' }} />
              ))}
            </View>
            <Pixel size={7} color="rgba(255,255,255,0.7)" style={{ position: 'absolute', bottom: 18, right: 20 }}>TAP ▶</Pixel>
          </Animated.View>
        </Pressable>
      ) : (
        <Body muted style={{ padding: 16 }}>{hunter ? `${hunter.name} hasn't hunted this season yet.` : 'Add a hunter first.'}</Body>
      )}
    </SubScreen>
  );
}
