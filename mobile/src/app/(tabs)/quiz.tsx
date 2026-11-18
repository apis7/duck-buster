import { useAudioPlayer } from 'expo-audio';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { play } from '@/audio/sfx';
import { makeRound, quizRank, type Question } from '@/domain/quiz';
import { SPECIES_BY_ID } from '@/domain/species';
import { QUIZ_IMAGES, QUIZ_SOUNDS } from '@/quiz/media.generated';
import { useStore } from '@/state/store';
import { Body, Btn, Card, Pixel, Screen } from '@/ui/kit';
import { C } from '@/ui/theme';

export default function Quiz() {
  const { settings, setSetting } = useStore();
  const [round, setRound] = useState<Question[] | null>(null);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const best = Number(settings.quizBest ?? 0);
  const available = Object.keys(QUIZ_IMAGES).length + Object.keys(QUIZ_SOUNDS).length;

  const start = () => {
    setRound(makeRound(Object.keys(QUIZ_IMAGES), Object.keys(QUIZ_SOUNDS)));
    setI(0);
    setScore(0);
    setPicked(null);
  };

  const q = round?.[i];
  const done = round && i >= round.length;

  useEffect(() => {
    if (done && round && score > best) setSetting('quizBest', String(score));
  }, [done, round, score, best, setSetting]);

  function choose(id: string) {
    if (!q || picked) return;
    setPicked(id);
    if (id === q.speciesId) {
      setScore((s) => s + 1);
      play('correct');
    } else play('wrong');
  }

  if (!round) {
    return (
      <Screen title="DUCK ID QUIZ">
        <Card style={{ gap: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 56 }}>🔎🦆</Text>
          <Pixel size={12} style={{ textAlign: 'center' }}>NAME THAT DUCK</Pixel>
          <Body style={{ textAlign: 'center' }}>
            See a photo or hear a call, then pick the bird from seven choices. Ten questions a round.
          </Body>
          {best ? <Pixel size={9} color={C.muted}>{`BEST: ${best}/10`}</Pixel> : null}
          <Btn label="START" onPress={start} disabled={available === 0} style={{ alignSelf: 'stretch' }} />
          {available === 0 ? <Body muted>Quiz pictures are still being added.</Body> : null}
        </Card>
      </Screen>
    );
  }

  if (done || !q) {
    return (
      <Screen title="DUCK ID QUIZ">
        <Card style={{ gap: 12, alignItems: 'center' }}>
          <Pixel size={10} color={C.muted}>YOU SCORED</Pixel>
          <Pixel size={40}>{`${score}/${round.length}`}</Pixel>
          <Pixel size={12} color={C.orange}>{quizRank(score, round.length).toUpperCase()}</Pixel>
          {score > best ? <Pixel size={9} color={C.marsh}>NEW BEST!</Pixel> : null}
          <Btn label="PLAY AGAIN" onPress={start} style={{ alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="DUCK ID QUIZ" right={<Pixel size={9} color={C.muted}>{`${i + 1}/${round.length} · ${score}✓`}</Pixel>}>
      <Prompt q={q} />
      <View style={{ gap: 8 }}>
        {q.choices.map((id) => {
          const right = picked && id === q.speciesId;
          const wrong = picked === id && id !== q.speciesId;
          return (
            <Pressable
              key={id}
              onPress={() => choose(id)}
              style={[styles.choice, right && { backgroundColor: C.marsh, borderColor: C.marsh }, wrong && { backgroundColor: C.red, borderColor: C.red }]}
            >
              <Text style={[styles.choiceTxt, (right || wrong) && { color: C.white }]}>{SPECIES_BY_ID[id]?.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {picked ? (
        <Btn
          label={i + 1 < round.length ? 'NEXT' : 'SEE SCORE'}
          onPress={() => {
            setPicked(null);
            setI((n) => n + 1);
          }}
        />
      ) : null}
    </Screen>
  );
}

function Prompt({ q }: { q: Question }) {
  if (q.kind === 'audio') return <SoundPrompt key={q.speciesId} speciesId={q.speciesId} />;
  const img = QUIZ_IMAGES[q.speciesId];
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.frame}>
        <Image source={img.src} style={{ width: '100%', aspectRatio: 4 / 3 }} resizeMode="cover" />
      </View>
      {img.credit ? <Text style={styles.credit}>{`Photo: ${img.credit}`}</Text> : null}
    </View>
  );
}

function SoundPrompt({ speciesId }: { speciesId: string }) {
  const sound = QUIZ_SOUNDS[speciesId];
  const player = useAudioPlayer(sound.src);
  const playIt = useMemo(
    () => () => {
      player.seekTo(0);
      player.play();
    },
    [player],
  );
  useEffect(() => {
    const t = setTimeout(playIt, 250);
    return () => clearTimeout(t);
  }, [playIt]);
  return (
    <View style={{ gap: 4 }}>
      <Pressable onPress={playIt} style={[styles.frame, { aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center', backgroundColor: C.navyDark }]}>
        <Text style={{ fontSize: 64 }}>🔊</Text>
        <Pixel size={10} color={C.white}>WHO'S CALLING? TAP TO REPLAY</Pixel>
      </Pressable>
      {sound.credit ? <Text style={styles.credit}>{`Recording: ${sound.credit}`}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 3, borderColor: C.navy, backgroundColor: C.white, overflow: 'hidden' },
  credit: { fontSize: 10, color: C.muted },
  choice: { borderWidth: 2.5, borderColor: C.navy, backgroundColor: C.white, paddingVertical: 12, paddingHorizontal: 14 },
  choiceTxt: { fontSize: 16, fontWeight: '800', color: C.navy },
});
