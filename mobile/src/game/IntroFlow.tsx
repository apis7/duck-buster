import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { play, preload } from '@/audio/sfx';
import { SPECIES_BY_ID } from '@/domain/species';
import { useStore } from '@/state/store';
import { Btn, Pixel } from '@/ui/kit';
import { PixelBird } from '@/ui/PixelBird';
import { C, MEDALS } from '@/ui/theme';

import { Busted } from './Busted';
import { GameView, type GameResult } from './GameView';
import { INTRO_MS, IntroScene } from './IntroScene';
import { gameLayout, gameScale } from './layout';

type Phase = 'whirl' | 'count' | 'play' | 'summary';

/**
 * - practice: the launch game (and replays from More). Logo intro → 3-2-1 → twelve
 *   seconds → arcade summary with PRACTICE high scores. Nothing counts for the season.
 *   Tap the duck at the top 7× to skip. Hold it for 5 seconds and… Marauder Mode.
 * - hunt: the hunt winner's round. No intro, no skip, no easter egg; the result is
 *   handed back to be saved for the season.
 */
export type GameMode = 'practice' | 'hunt';

const SKIP_TAPS = 7;
const MARAUDER_HOLD_MS = 5000;

export function IntroFlow({
  mode = 'practice', intro = true, playerName, onDone, onResult,
}: {
  mode?: GameMode;
  intro?: boolean;
  playerName?: string;
  onDone: () => void;
  /** Hunt rounds: called once with the result, before the summary shows. */
  onResult?: (r: GameResult) => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>(intro && mode === 'practice' ? 'whirl' : 'count');
  const [count, setCount] = useState(3);
  const [result, setResult] = useState<GameResult | null>(null);
  const [round, setRound] = useState(0);
  const [taps, setTaps] = useState(0);
  const [marauder, setMarauder] = useState(false);
  const justHeld = useRef(false);

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

  function restart(nextMarauder = marauder) {
    setMarauder(nextMarauder);
    setResult(null);
    setCount(3);
    setRound((r) => r + 1);
    setPhase('count');
  }

  function tapDuck() {
    // Letting go after the 5-second hold isn't a skip tap.
    if (justHeld.current) {
      justHeld.current = false;
      return;
    }
    const n = taps + 1;
    setTaps(n);
    if (n >= SKIP_TAPS) onDone();
  }

  function enterMarauderMode() {
    justHeld.current = true;
    play('boom');
    setTaps(0);
    restart(true);
  }

  const huntRound = mode === 'hunt';
  const theme = marauder ? '#1A0204' : C.navyDark;

  return (
    <View style={{ flex: 1, backgroundColor: theme }}>
      {phase !== 'whirl' && phase !== 'summary' ? (
        <GameView
          key={round}
          width={vw}
          height={vh}
          scale={scale}
          layout={layout}
          marauder={marauder}
          running={phase === 'play'}
          onEnd={(r) => {
            setResult(r);
            if (huntRound) onResult?.(r);
            setPhase('summary');
          }}
        />
      ) : null}

      {phase === 'whirl' ? <IntroScene width={vw} height={vh} scale={scale} /> : null}

      {phase === 'count' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
          {huntRound && playerName ? (
            <Pixel size={14} color={C.gold} style={{ marginBottom: 18 }}>{`${playerName.toUpperCase()}'S ROUND`}</Pixel>
          ) : marauder ? (
            <Pixel size={16} color="#FF5A4E" style={{ marginBottom: 18 }}>MARAUDER MODE</Pixel>
          ) : null}
          <Pixel size={72} color={marauder ? '#FF5A4E' : C.white} style={{ lineHeight: 90 }}>
            {count > 0 ? `${count}` : 'GO!'}
          </Pixel>
          <Pixel size={10} color={C.white} style={{ marginTop: 24, textAlign: 'center', paddingHorizontal: 30 }}>
            {marauder ? 'Semi-auto. Go nuts.' : 'Grab the gun, drag to aim,\nlet go to shoot'}
          </Pixel>
        </View>
      ) : null}

      {phase === 'summary' && result ? (
        marauder ? (
          <Busted result={result} onAgain={() => restart(false)} onDone={onDone} />
        ) : huntRound ? (
          <RoundSummary result={result} playerName={playerName ?? ''} onDone={onDone} />
        ) : (
          <PracticeSummary result={result} onAgain={() => restart(false)} onDone={onDone} />
        )
      ) : null}

      {/* The duck up top: tap 7× to skip; hold it 5 s for the thing nobody mentions. */}
      {phase !== 'summary' && !huntRound ? (
        <Pressable
          onPress={tapDuck}
          onLongPress={marauder ? undefined : enterMarauderMode}
          delayLongPress={MARAUDER_HOLD_MS}
          style={[styles.skipZone, { paddingTop: insets.top + 8 }]}
        >
          <PixelBird species={SPECIES_BY_ID.mall} size={44 * scale} />
          <Pixel size={7 * scale} color="rgba(255,255,255,0.55)">
            {taps > 0 ? `skip: ${SKIP_TAPS - taps} more` : 'tap duck 7× to skip'}
          </Pixel>
        </Pressable>
      ) : null}
    </View>
  );
}

function Stats({ result }: { result: GameResult }) {
  const accuracy = result.shots ? Math.round((result.hits / result.shots) * 100) : 0;
  return (
    <>
      <Pixel size={9} color={C.navySoft}>{`HITS ${result.hits}  KO ${result.kos}  ACC ${accuracy}%`}</Pixel>
      {result.geese + result.swans + result.coots + result.bands > 0 ? (
        <Pixel size={9} color={C.navySoft}>
          {[
            result.geese ? `GEESE ${result.geese}` : '',
            result.bands ? `BANDED ${result.bands}` : '',
            result.swans ? `SWANS ${result.swans}` : '',
            result.coots ? `COOTS ${result.coots} (SHAME)` : '',
          ].filter(Boolean).join('  ')}
        </Pixel>
      ) : null}
    </>
  );
}

/** You're probably still mid-shot when the buzzer goes: ignore taps for a second. */
function useArmed(onArm?: () => void) {
  const [armed, setArmed] = useState(false);
  const cb = useRef(onArm);
  useEffect(() => {
    const t = setTimeout(() => {
      setArmed(true);
      cb.current?.();
    }, 1000);
    return () => clearTimeout(t);
  }, []);
  return armed;
}

function PracticeSummary({ result, onAgain, onDone }: { result: GameResult; onAgain: () => void; onDone: () => void }) {
  const { highScores, addHighScore } = useStore();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [initials, setInitials] = useState('');
  const [saved, setSaved] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const armed = useArmed(() => input.current?.focus());

  // Ties go to whoever got there first, so a new score must beat the third-place score.
  const rank = result.score > 0 ? highScores.filter((s) => s.score >= result.score).length : 99;
  const qualifies = rank < 3 && !saved;

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
          <Pixel size={12} color={C.orange}>PRACTICE OVER</Pixel>
          <Pixel size={48} color={C.white} style={{ lineHeight: 64 }}>{`${result.score}`}</Pixel>
          <Stats result={result} />
          <Pixel size={8} color={C.navySoft} style={{ textAlign: 'center', marginTop: 6 }}>
            {'Practice only. Win a hunt to play\nthe round that counts.'}
          </Pixel>
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
          <Pixel size={10} color={C.navySoft} style={{ textAlign: 'center' }}>PRACTICE HIGH SCORES</Pixel>
          {highScores.length === 0 ? (
            <Pixel size={9} color={C.navySoft} style={{ textAlign: 'center' }}>No scores yet</Pixel>
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

/** The hunt winner's round: saved for the season. One shot at it — no "again". */
function RoundSummary({ result, playerName, onDone }: { result: GameResult; playerName: string; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const armed = useArmed();
  return (
    <View pointerEvents={armed ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,31,61,0.94)', paddingTop: insets.top + 70, paddingBottom: insets.bottom + 20, paddingHorizontal: 22 }]}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Pixel size={12} color={C.gold}>{`${playerName.toUpperCase()}'S ROUND`}</Pixel>
        <Pixel size={56} color={C.white} style={{ lineHeight: 72 }}>{`${result.score}`}</Pixel>
        <Stats result={result} />
        <Pixel size={9} color={C.orange} style={{ textAlign: 'center', marginTop: 10 }}>
          {'SAVED TO THE SEASON.\nCHECK THE BRAGGING BOARD.'}
        </Pixel>
      </View>
      <View style={{ flex: 1 }} />
      <Btn label="DONE" onPress={onDone} />
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
