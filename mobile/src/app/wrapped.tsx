import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { currentSeason, seasonLabel } from '@/domain/season';
import { crewWrapped } from '@/domain/wrapped';
import { useStore } from '@/state/store';
import { Body, Btn, Explainer, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C, PIXEL_FONT } from '@/ui/theme';

const BACKS = ['#13315C', '#F26B1D', '#3C6E47', '#8E3A22', '#2B3F73', '#6B4F2A'];

/** Season Wrapped: one card per stat, with the whole crew on every card. */
export default function Wrapped() {
  const params = useLocalSearchParams<{ season?: string; hunter?: string }>();
  const season = Number(params.season) || currentSeason();
  const { data, titleOf } = useStore();
  const [i, setI] = useState(0);
  const steps = useMemo(() => crewWrapped(data, season, (id) => titleOf(id).name), [data, season, titleOf]);
  const names = new Map(data.hunters.map((h) => [h.id, h]));
  const at = Math.min(i, steps.length - 1);
  const step = steps[at];
  const back = BACKS[at % BACKS.length];

  return (
    <SubScreen title={`WRAPPED ${seasonLabel(season)}`} scroll={false}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Explainer>
          {`The ${seasonLabel(season)} season in recap cards — hunts, birds, best day, favorite duck, titles and more. Every hunter who hunted this season is on each card, best first. Tap ▶ for the next card.`}
        </Explainer>
      </View>
      {step ? (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <Animated.View
            key={step.id}
            entering={ZoomIn.duration(200)}
            style={{ flex: 1, backgroundColor: back, borderWidth: 3, borderColor: C.navyDark, borderBottomWidth: 8, borderRightWidth: 8, padding: 18, gap: 12 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pixel size={11} color={C.white} style={{ flex: 1, lineHeight: 18 }}>{step.kicker.toUpperCase()}</Pixel>
              <Pixel size={8} color="rgba(255,255,255,0.7)">{`${at + 1}/${steps.length}`}</Pixel>
            </View>
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
              {step.rows.map((r) => {
                const h = names.get(r.hunterId);
                const mine = params.hunter === r.hunterId;
                return (
                  <View
                    key={r.hunterId}
                    style={{ gap: 2, borderLeftWidth: 6, borderColor: h?.color ?? C.white, paddingLeft: 10, backgroundColor: mine ? 'rgba(255,255,255,0.12)' : undefined }}
                  >
                    <Pixel size={9} color="rgba(255,255,255,0.85)">{(h?.name ?? '?').toUpperCase()}</Pixel>
                    <Text
                      adjustsFontSizeToFit
                      numberOfLines={1}
                      maxFontSizeMultiplier={1}
                      style={{ fontFamily: PIXEL_FONT, color: C.white, fontSize: r.big.length > 10 ? 16 : 24, lineHeight: r.big.length > 10 ? 26 : 36 }}
                    >
                      {r.big.toUpperCase()}
                    </Text>
                    {r.caption ? <Body style={{ color: C.white, fontSize: 14, lineHeight: 19 }}>{r.caption}</Body> : null}
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Btn label="◀" kind="secondary" disabled={at === 0} onPress={() => setI(at - 1)} style={{ flex: 1 }} />
            <Btn label={at === steps.length - 1 ? 'FROM THE TOP' : 'NEXT ▶'} onPress={() => setI((at + 1) % steps.length)} style={{ flex: 2 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
            {steps.map((s, k) => (
              <Pressable key={s.id} onPress={() => setI(k)} hitSlop={6}>
                <View style={{ width: 10, height: 10, backgroundColor: k === at ? C.navy : C.navySoft }} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <Body muted style={{ padding: 16 }}>{data.hunters.length ? 'Nobody has hunted this season yet.' : 'Add a hunter first.'}</Body>
      )}
    </SubScreen>
  );
}
