import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { maybeShowInterstitial } from '@/ads/ads';
import { todayISO } from '@/domain/season';
import { huntWinner } from '@/domain/winner';
import { IntroFlow } from '@/game/IntroFlow';
import type { GameResult } from '@/game/GameView';
import { useStore, type NewBadge } from '@/state/store';
import { BadgeParade } from '@/ui/BadgeParade';
import { Btn, Pixel } from '@/ui/kit';
import { C } from '@/ui/theme';

/** The hunt winner's one round of the duck shoot. The score is saved for the season. */
export default function Round() {
  const { huntId } = useLocalSearchParams<{ huntId: string }>();
  const { data, saveGameScore } = useStore();
  const insets = useSafeAreaInsets();
  const [badges, setBadges] = useState<NewBadge[] | null>(null);
  const saved = useRef(false);
  // Decided once when the screen opens, so saving the score doesn't flip it to "already played".
  const [alreadyPlayed] = useState(() => data.gameScores.some((g) => g.huntId === huntId));

  const hunt = data.hunts.find((h) => h.id === huntId);
  const winner = hunt ? huntWinner(data, hunt.id) : null;
  const name = winner ? (data.hunters.find((h) => h.id === winner.hunterId)?.name ?? '') : '';

  const done = () => {
    router.dismissTo('/(tabs)');
    maybeShowInterstitial();
  };

  if (!hunt || !winner || alreadyPlayed || hunt.date !== todayISO()) {
    return (
      <View style={{ flex: 1, backgroundColor: C.navyDark, padding: 24, paddingTop: insets.top + 80, gap: 16 }}>
        <Pixel size={13} color={C.white}>NO ROUND HERE</Pixel>
        <Text style={{ color: C.navySoft, fontSize: 16 }}>
          {alreadyPlayed ? 'This hunt’s round has already been played.' : 'The winner’s round is only playable on the day of the hunt.'}
        </Text>
        <Btn label="BACK" onPress={() => router.back()} />
      </View>
    );
  }

  async function onResult(r: GameResult) {
    if (saved.current || !hunt || !winner) return;
    saved.current = true;
    const earned = await saveGameScore({
      huntId: hunt.id,
      hunterId: winner.hunterId,
      date: hunt.date,
      score: r.score,
      shots: r.shots,
      hits: r.hits,
      kos: r.kos,
      geese: r.geese,
      swans: r.swans,
      coots: r.coots,
      bands: r.bands,
    });
    if (earned.length) setBadges(earned);
  }

  return (
    <>
      <StatusBar style="light" />
      <IntroFlow mode="hunt" intro={false} playerName={name} onResult={onResult} onDone={done} />
      {badges ? <BadgeParade items={badges.map((b) => ({ badge: b.badge, hunterName: name }))} onDone={() => setBadges(null)} /> : null}
    </>
  );
}
