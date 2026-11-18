import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { play, preload } from '@/audio/sfx';
import { SPECIES_BY_ID } from '@/domain/species';
import { useStore } from '@/state/store';
import { Btn, Pixel } from '@/ui/kit';
import { PixelBird } from '@/ui/PixelBird';
import { C, MEDALS } from '@/ui/theme';

import { GameView, type GameResult } from './GameView';

type Phase = 'whirl' | 'count' | 'play' | 'summary';

const SKIP_TAPS = 7;

/**
 * Whirling duck → 3-2-1 → twelve seconds of shooting → arcade summary.
 * Tapping the duck at the top seven times skips straight to the app.
 */
export function IntroFlow({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('whirl');
  const [count, setCount] = useState(3);
  const [result, setResult] = useState<GameResult | null>(null);
  const [round, setRound] = useState(0);
  const [taps, setTaps] = useState(0);

  // Gun sits well above Android's gesture/nav bar.
  const gunY = height - Math.max(insets.bottom, 24) - 96;
  const skyTop = insets.top + 110;

  useEffect(() => {
    preload();
  }, []);

  useEffect(() => {
    if (phase !== 'whirl') return;
    const t = setTimeout(() => setPhase('count'), 1900);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'count') return;
    play('beep');
    const t = setTimeout(() => {
      if (count > 1) return setCount(count - 1);
      play('go');
      setPhase('play');
    }, 700);
    return () => clearTimeout(t);
  }, [phase, count]);

  function restart() {
    setResult(null);
    setCount(3);
    setRound((r) => r + 1);
    setPhase('count');
  }

  function tapDuck() {
    const n = taps + 1;
    setTaps(n);
    if (n >= SKIP_TAPS) onDone();
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.navyDark }}>
      {phase !== 'whirl' && phase !== 'summary' ? (
        <GameView
          key={round}
          width={width}
          height={height}
          gunY={gunY}
          skyTop={skyTop}
          running={phase === 'play'}
          onEnd={(r) => {
            setResult(r);
            setPhase('summary');
          }}
        />
      ) : null}

      {phase === 'whirl' ? <Whirl /> : null}

      {phase === 'count' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
          <Pixel size={72} color={C.white} style={{ lineHeight: 90 }}>
            {count > 0 ? `${count}` : 'GO!'}
          </Pixel>
          <Pixel size={10} color={C.white} style={{ marginTop: 24, textAlign: 'center', paddingHorizontal: 30 }}>
            {'Grab the gun, drag to aim,\nlet go to shoot'}
          </Pixel>
        </View>
      ) : null}

      {phase === 'summary' && result ? (
        <Summary result={result} onAgain={restart} onDone={onDone} />
      ) : null}

      {phase !== 'summary' ? (
        <Pressable onPress={tapDuck} style={[styles.skipZone, { paddingTop: insets.top + 8 }]}>
          <PixelBird species={SPECIES_BY_ID.mall} size={44} />
          <Pixel size={7} color="rgba(255,255,255,0.55)">
            {taps > 0 ? `skip: ${SKIP_TAPS - taps} more` : 'tap duck 7× to skip'}
          </Pixel>
        </Pressable>
      ) : null}
    </View>
  );
}

function Whirl() {
  const spin = useSharedValue(0);
  const scale = useSharedValue(0.2);
  useEffect(() => {
    spin.value = withTiming(4 * 360, { duration: 1600, easing: Easing.out(Easing.cubic) });
    scale.value = withSequence(withTiming(1.3, { duration: 1300 }), withTiming(1, { duration: 300 }));
  }, [spin, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }, { scale: scale.value }] }));
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <Animated.View style={style}>
        <PixelBird species={SPECIES_BY_ID.mall} size={180} />
      </Animated.View>
      <Pixel size={22} color={C.white} style={{ marginTop: 36 }}>
        DUCK BUSTER
      </Pixel>
    </View>
  );
}

function Summary({ result, onAgain, onDone }: { result: GameResult; onAgain: () => void; onDone: () => void }) {
  const { highScores, addHighScore } = useStore();
  const insets = useSafeAreaInsets();
  const [initials, setInitials] = useState('');
  const [saved, setSaved] = useState(false);

  // Ties go to whoever got there first, so a new score must beat the third-place score.
  const rank = result.score > 0 ? highScores.filter((s) => s.score >= result.score).length : 99;
  const qualifies = rank < 3 && !saved;
  const accuracy = result.shots ? Math.round((result.hits / result.shots) * 100) : 0;

  const save = async () => {
    const i = initials.trim().toUpperCase() || 'AAA';
    await addHighScore(i.padEnd(3, ' ').slice(0, 3), result.score);
    setSaved(true);
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,31,61,0.94)', paddingTop: insets.top + 70, paddingBottom: insets.bottom + 20, paddingHorizontal: 22 }]}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Pixel size={12} color={C.orange}>
          GAME OVER
        </Pixel>
        <Pixel size={48} color={C.white} style={{ lineHeight: 64 }}>
          {`${result.score}`}
        </Pixel>
        <Pixel size={9} color={C.navySoft}>
          {`HITS ${result.hits}  VITAL ${result.vitals}  ACC ${accuracy}%`}
        </Pixel>
      </View>

      {qualifies ? (
        <View style={{ alignItems: 'center', marginTop: 26, gap: 12 }}>
          <Pixel size={11} color={MEDALS[rank]}>
            {['NEW HIGH SCORE! GOLD', 'SILVER! ENTER INITIALS', 'BRONZE! ENTER INITIALS'][rank]}
          </Pixel>
          <TextInput
            autoFocus
            value={initials}
            onChangeText={(t) => setInitials(t.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3))}
            maxLength={3}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={save}
            placeholder="AAA"
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.initials}
          />
          <Btn label="SAVE" onPress={save} />
        </View>
      ) : null}

      <View style={{ marginTop: 26, gap: 8 }}>
        <Pixel size={10} color={C.navySoft} style={{ textAlign: 'center' }}>
          HIGH SCORES
        </Pixel>
        {highScores.length === 0 ? (
          <Pixel size={9} color={C.navySoft} style={{ textAlign: 'center' }}>
            No scores yet
          </Pixel>
        ) : (
          highScores.slice(0, 5).map((s, i) => (
            <View key={s.id} style={styles.scoreRow}>
              <Pixel size={12} color={MEDALS[i] ?? C.white}>{`${i + 1}. ${s.initials}`}</Pixel>
              <Pixel size={12} color={MEDALS[i] ?? C.white}>{`${s.score}`}</Pixel>
            </View>
          ))
        )}
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Btn label="AGAIN" kind="secondary" onPress={onAgain} style={{ flex: 1 }} />
        <Btn label="CONTINUE" onPress={onDone} style={{ flex: 1.4 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  skipZone: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 10, gap: 2 },
  initials: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 32,
    color: '#FFFFFF',
    letterSpacing: 12,
    borderBottomWidth: 4,
    borderColor: C.orange,
    width: 200,
    textAlign: 'center',
    paddingVertical: 8,
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40 },
});
