import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { play, preload } from '@/audio/sfx';
import { SPECIES_BY_ID } from '@/domain/species';
import { useStore } from '@/state/store';
import { Btn, Pixel } from '@/ui/kit';
import { PixelBird } from '@/ui/PixelBird';
import { C, MEDALS } from '@/ui/theme';

import { GameView, type GameResult } from './GameView';
import { INTRO_MS, IntroScene } from './IntroScene';
import { gameLayout, gameScale } from './layout';

type Phase = 'whirl' | 'count' | 'play' | 'summary';

const SKIP_TAPS = 7;

/**
 * Logo fly-up → 3-2-1 → twelve seconds of shooting → arcade summary.
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

  // The scene is laid out in "game units" and scaled up as one on wide screens.
  const scale = gameScale(width);
  const vw = width / scale;
  const vh = height / scale;
  const layout = useMemo(
    () => gameLayout(vw, vh, insets.top / scale, insets.bottom / scale),
    [vw, vh, scale, insets.top, insets.bottom],
  );

  useEffect(() => {
    preload();
  }, []);

  useEffect(() => {
    if (phase !== 'whirl') return;
    const t = setTimeout(() => setPhase('count'), INTRO_MS);
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
          width={vw}
          height={vh}
          scale={scale}
          layout={layout}
          running={phase === 'play'}
          onEnd={(r) => {
            setResult(r);
            setPhase('summary');
          }}
        />
      ) : null}

      {phase === 'whirl' ? <IntroScene width={vw} height={vh} scale={scale} /> : null}

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
          <PixelBird species={SPECIES_BY_ID.mall} size={44 * scale} />
          <Pixel size={7 * scale} color="rgba(255,255,255,0.55)">
            {taps > 0 ? `skip: ${SKIP_TAPS - taps} more` : 'tap duck 7× to skip'}
          </Pixel>
        </Pressable>
      ) : null}
    </View>
  );
}

function Summary({ result, onAgain, onDone }: { result: GameResult; onAgain: () => void; onDone: () => void }) {
  const { highScores, addHighScore } = useStore();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [initials, setInitials] = useState('');
  const [saved, setSaved] = useState(false);
  // You're probably still mid-shot when the buzzer goes: hold the keyboard and the
  // buttons for a second so a late tap doesn't land on them.
  const [armed, setArmed] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setArmed(true);
      input.current?.focus();
    }, 1000);
    return () => clearTimeout(t);
  }, []);

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
    <View pointerEvents={armed ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,31,61,0.94)' }]}>
      {/* Scrolls on short phones and when the keyboard is up for initials. */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + Math.min(70, height * 0.07), paddingBottom: insets.bottom + 20, paddingHorizontal: 22 }}
      >
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Pixel size={12} color={C.orange}>
          GAME OVER
        </Pixel>
        <Pixel size={48} color={C.white} style={{ lineHeight: 64 }}>
          {`${result.score}`}
        </Pixel>
        <Pixel size={9} color={C.navySoft}>
          {`HITS ${result.hits}  KO ${result.kos}  ACC ${accuracy}%`}
        </Pixel>
        {result.geese + result.swans + result.coots > 0 ? (
          <Pixel size={9} color={C.navySoft}>
            {[
              result.geese ? `GEESE ${result.geese}` : '',
              result.swans ? `SWANS ${result.swans}` : '',
              result.coots ? `COOTS ${result.coots} (SHAME)` : '',
            ].filter(Boolean).join('  ')}
          </Pixel>
        ) : null}
      </View>

      {qualifies ? (
        <View style={{ alignItems: 'center', marginTop: 26, gap: 12 }}>
          <Pixel size={11} color={MEDALS[rank]}>
            {['NEW HIGH SCORE! GOLD', 'SILVER! ENTER INITIALS', 'BRONZE! ENTER INITIALS'][rank]}
          </Pixel>
          <TextInput
            ref={input}
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

      <View style={{ flex: 1, minHeight: 20 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Btn label="AGAIN" kind="secondary" onPress={onAgain} style={{ flex: 1 }} />
        <Btn label="CONTINUE" onPress={onDone} style={{ flex: 1.4 }} />
      </View>
      </ScrollView>
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
