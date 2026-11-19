import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { play } from '@/audio/sfx';
import { Btn, Pixel } from '@/ui/kit';
import { PixelSprite } from '@/ui/PixelSprite';
import { C } from '@/ui/theme';

import type { GameResult } from './GameView';

/**
 * How Marauder Mode ends: sirens, a squad car rolls up, and you're arrested for
 * poaching. The score isn't saved anywhere — this screen is all you get.
 */

// Facing left (it drives in from the right). L/l = left light bar, R/r = right.
const CAR = [
  '...........LLLRRR...........',
  '........KKKKKKKKKKKK........',
  '.......KGGGGKKGGGGGGK.......',
  '......KGGGGGKKGGGGGGGK......',
  '..KKKKKKKKKKKKKKKKKKKKKKKK..',
  '.KWWWWWWWWWWWWWWWWWWWWWWWWK.',
  'KYWWWWNNNNNNNNNNNNNNWWWWWWWK',
  'KWWWWWNNNNNNNNNNNNNNWWWWWWWK',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '...TTT...............TTT....',
  '..TTTTT.............TTTTT...',
  '...TTT...............TTT....',
];

const base = { K: '#111418', W: '#F4F4F4', G: '#9FC7E8', N: '#13315C', Y: '#FFE29A', T: '#222222' };

export function Busted({ result, onAgain, onDone }: { result: GameResult; onAgain: () => void; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [flash, setFlash] = useState(false);
  const [arrived, setArrived] = useState(false);
  const x = useSharedValue(width);

  useEffect(() => {
    play('siren');
    x.set(withTiming(width / 2 - 112, { duration: 1600, easing: Easing.out(Easing.cubic) }));
    const lights = setInterval(() => setFlash((f) => !f), 180);
    const t = setTimeout(() => setArrived(true), 1700);
    return () => {
      clearInterval(lights);
      clearTimeout(t);
    };
  }, [x, width]);

  const carStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const palette = { ...base, L: flash ? '#FF2A2A' : '#5A1010', R: flash ? '#1A2A5A' : '#2A6BFF' };
  const fine = result.downs * 500;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,2,4,0.88)' }]}>
      {/* Red and blue wash from the light bar. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: flash ? 'rgba(255,0,0,0.12)' : 'rgba(40,90,255,0.12)' }]} />
      <Animated.View style={[{ position: 'absolute', top: height * 0.62 }, carStyle]}>
        <PixelSprite rows={CAR} palette={palette} pixel={8} />
      </Animated.View>

      {arrived ? (
        <Animated.View
          entering={ZoomIn.springify().damping(10)}
          style={{ paddingTop: insets.top + 60, paddingHorizontal: 24, alignItems: 'center', gap: 12 }}
        >
          <Pixel size={34} color="#FF5A4E" style={{ lineHeight: 48 }}>BUSTED!</Pixel>
          <Pixel size={11} color={C.white} style={{ textAlign: 'center', lineHeight: 20 }}>
            {'YOU ARE UNDER ARREST\nFOR POACHING'}
          </Pixel>
          <View style={styles.sheet}>
            <Pixel size={9} color={C.ink}>{`COUNTS OF POACHING: ${result.downs}`}</Pixel>
            <Pixel size={9} color={C.ink}>{`SHOTS FIRED: ${result.shots}`}</Pixel>
            <Pixel size={9} color={C.ink}>{`"SCORE": ${result.score}`}</Pixel>
            {result.coots ? <Pixel size={9} color={C.ink}>{`COOTS (WHY?): ${result.coots}`}</Pixel> : null}
            <Pixel size={9} color={C.red}>{`FINE: $${fine.toLocaleString()}`}</Pixel>
          </View>
          <Pixel size={8} color="rgba(255,255,255,0.6)" style={{ textAlign: 'center' }}>
            {'NOTHING HERE GETS SAVED.\nTHE GAME WARDEN HAS YOUR NUMBER.'}
          </Pixel>
        </Animated.View>
      ) : null}

      {arrived ? (
        <View style={{ position: 'absolute', left: 22, right: 22, bottom: insets.bottom + 20, flexDirection: 'row', gap: 12 }}>
          <Btn label="POST BAIL" kind="secondary" onPress={onAgain} style={{ flex: 1 }} />
          <Btn label="GO STRAIGHT" onPress={onDone} style={{ flex: 1.3 }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: '#F2EBD9', borderWidth: 3, borderColor: C.ink, padding: 14, gap: 8, alignSelf: 'stretch', transform: [{ rotate: '-1.5deg' }] },
});
