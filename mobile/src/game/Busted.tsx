import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
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

// The perp, shoulders up, in jailhouse stripes, mid-groan.
const PERP = [
  '......HHHHHHHH......',
  '....HHHHHHHHHHHH....',
  '...HHHHHHHHHHHHHH...',
  '...HHSSSSSSSSSSHH...',
  '...HSSSSSSSSSSSSH...',
  '...SHHHSSSSSSHHHS...',
  '...SSSEESSSSEESSS...',
  '..sSSSEESSSSEESSSs..',
  '..sSSSSSSnnSSSSSSs..',
  '...SSSSSSnnSSSSSS...',
  '...SSSwwwwwwwwSSS...',
  '...SSwMMMMMMMMwSS...',
  '...SSwMTTTTTTMwSS...',
  '....SwMMMMMMMMwS....',
  '.....SwwwwwwwwS.....',
  '......SSSSSSSS......',
  '.......ssSSss.......',
  '...BBBBBBBBBBBBBB...',
  '.WWWWWWWWWWWWWWWWWW.',
  'BBBBBBBBBBBBBBBBBBBB',
  'WWWWWWWWWWWWWWWWWWWW',
  'BBBBBBBBBBBBBBBBBBBB',
  'WWWWWWWWWWWWWWWWWWWW',
];
const PERP_PALETTE = {
  H: '#3A2A1E', S: '#E0B48A', s: '#C8956A', E: '#111111', n: '#B98058', w: '#8C6A50',
  M: '#5A1A1A', T: '#F4F4F4', B: '#111111', W: '#F4F4F4',
};

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
  // The groan wobbles like he means it.
  const groan = useSharedValue(0);
  useEffect(() => {
    if (!arrived) return;
    // The perp's groan as he's booked.
    play('badGuy');
    groan.set(withRepeat(withSequence(withTiming(-2, { duration: 90 }), withTiming(2, { duration: 90 })), -1, true));
  }, [arrived, groan]);
  const groanStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${groan.value}deg` }] }));
  const cootMeals = result.coots > 15;
  const palette = { ...base, L: flash ? '#FF2A2A' : '#5A1010', R: flash ? '#1A2A5A' : '#2A6BFF' };
  const fine = result.downs * 500;
  // Stack from the bottom up: buttons, squad car, mug shot. The charge sheet gets
  // whatever's left above and scrolls if a small phone runs out of room.
  const pixel = height < 760 ? 4 : 5;
  const carTop = height - insets.bottom - 92 - CAR.length * 8;
  const perpTop = carTop - PERP.length * pixel - 12;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,2,4,0.88)' }]}>
      {/* Red and blue wash from the light bar. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: flash ? 'rgba(255,0,0,0.12)' : 'rgba(40,90,255,0.12)' }]} />
      <Animated.View style={[{ position: 'absolute', top: carTop }, carStyle]}>
        <PixelSprite rows={CAR} palette={palette} pixel={8} />
      </Animated.View>

      {/* Mug shot, right above the squad car. */}
      {arrived ? (
        <Animated.View entering={ZoomIn.duration(200)} style={[styles.perp, { top: perpTop }]}>
          <PixelSprite rows={PERP} palette={PERP_PALETTE} pixel={pixel} />
          <Animated.View style={[styles.bubble, groanStyle]}>
            <Pixel size={11} color={C.ink}>UUGGGGGHHHH</Pixel>
          </Animated.View>
        </Animated.View>
      ) : null}

      {arrived ? (
        <Animated.ScrollView
          entering={ZoomIn.duration(200)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: perpTop - 8 }}
          contentContainerStyle={{ paddingTop: insets.top + Math.min(60, height * 0.05), paddingHorizontal: 24, alignItems: 'center', gap: 12, paddingBottom: 8 }}
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
            {cootMeals ? (
              <Pixel size={8} color={C.ink} style={{ lineHeight: 14 }}>
                {`${result.coots} COOTS?! GOOD NEWS: THE JAIL MENU IS COOT. BREAKFAST, LUNCH AND DINNER, FOR YOUR WHOLE STINT.`}
              </Pixel>
            ) : null}
          </View>
          <Pixel size={8} color="rgba(255,255,255,0.6)" style={{ textAlign: 'center' }}>
            {'NOTHING HERE GETS SAVED.\nTHE GAME WARDEN HAS YOUR NUMBER.'}
          </Pixel>
        </Animated.ScrollView>
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
  perp: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bubble: { backgroundColor: C.white, borderWidth: 3, borderColor: C.ink, paddingVertical: 8, paddingHorizontal: 10 },
  sheet: { backgroundColor: '#F2EBD9', borderWidth: 3, borderColor: C.ink, padding: 14, gap: 8, alignSelf: 'stretch', transform: [{ rotate: '-1.5deg' }] },
});
