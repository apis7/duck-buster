import { useAudioPlayer } from 'expo-audio';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { play } from '@/audio/sfx';
import { makeRound, quizCorrectKey, quizRank, type Question } from '@/domain/quiz';
import { currentSeason } from '@/domain/season';
import { RESTRICTIONS } from '@/domain/regs';
import { SPECIES_BY_ID } from '@/domain/species';
import { QUIZ_IMAGES, QUIZ_SOUNDS } from '@/quiz/media.generated';
import { useStore } from '@/state/store';
import { Body, Btn, Card, Pixel, Screen } from '@/ui/kit';
import { C } from '@/ui/theme';

/** Kids and guests: plays without a hunter, with its own best score. */
const NO_HUNTER = 'none';

export default function Quiz() {
  const { data, settings, setSetting } = useStore();
  const [player, setPlayer] = useState<string | null>(null);
  const [round, setRound] = useState<Question[] | null>(null);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const bestOf = (id: string) => Number(settings[`quizBest:${id}`] ?? 0);
  const best = player ? bestOf(player) : 0;
  const playerName = player === NO_HUNTER ? 'No hunter' : (data.hunters.find((h) => h.id === player)?.name ?? '');
  const available = Object.keys(QUIZ_IMAGES).length + Object.keys(QUIZ_SOUNDS).length;

  const start = (who = player) => {
    if (!who) return;
    setPlayer(who);
    // Photo questions pick the drake or the hen photo at random when there are both.
    const photos = Object.entries(QUIZ_IMAGES);
    const species = Array.from(new Set(photos.map(([, m]) => m.species)));
    setRound(
      makeRound(species, Object.keys(QUIZ_SOUNDS)).map((q) => {
        if (q.kind !== 'image') return q;
        const options = photos.filter(([, m]) => m.species === q.speciesId).map(([id]) => id);
        return { ...q, mediaId: options[Math.floor(Math.random() * options.length)] };
      }),
    );
    setI(0);
    setScore(0);
    setPicked(null);
  };

  const q = round?.[i];
  const done = round && i >= round.length;

  useEffect(() => {
    if (done && round && player && score > best) setSetting(`quizBest:${player}`, String(score));
  }, [done, round, score, best, player, setSetting]);

  function choose(id: string) {
    if (!q || picked) return;
    setPicked(id);
    if (id === q.speciesId) {
      setScore((s) => s + 1);
      // Every right answer counts toward the Bragging Board's Quiz Whiz (hunters only).
      if (player && player !== NO_HUNTER) {
        const key = quizCorrectKey(currentSeason(), player);
        setSetting(key, String(Number(settings[key] ?? 0) + 1));
      }
      play('correct');
    } else play('wrong');
  }

  if (!round) {
    const who = [...data.hunters.map((h) => ({ id: h.id, name: h.name, color: h.color })), { id: NO_HUNTER, name: '🧒 No hunter – N/A', color: C.muted }];
    return (
      <Screen title="DUCK ID QUIZ">
        <Card style={{ gap: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 56 }}>🔎🦆</Text>
          <Pixel size={12} style={{ textAlign: 'center' }}>NAME THAT DUCK</Pixel>
          <Body style={{ textAlign: 'center' }}>
            See a photo or hear a call, then pick the bird from seven choices. Ten questions a round.
          </Body>
          {available === 0 ? <Body muted>Quiz pictures are still being added.</Body> : null}
        </Card>
        <Pixel size={10} color={C.muted}>WHO'S TAKING THE QUIZ?</Pixel>
        <View style={{ gap: 8 }}>
          {who.map((p) => (
            <Pressable
              key={p.id}
              disabled={available === 0}
              onPress={() => start(p.id)}
              style={[styles.choice, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 8, borderLeftColor: p.color }]}
            >
              <Text style={styles.choiceTxt}>{p.name}</Text>
              {bestOf(p.id) ? <Pixel size={8} color={C.muted}>{`BEST ${bestOf(p.id)}/10`}</Pixel> : null}
            </Pressable>
          ))}
        </View>
        {playerHint(data.hunters.length)}
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
          <Pixel size={9} color={C.muted}>{playerName.toUpperCase()}</Pixel>
          {score > best ? <Pixel size={9} color={C.marsh}>NEW BEST!</Pixel> : null}
          <Btn label="PLAY AGAIN" onPress={() => start()} style={{ alignSelf: 'stretch' }} />
          <Btn label="SWITCH PLAYER" kind="secondary" onPress={() => setRound(null)} style={{ alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }

  function next() {
    setPicked(null);
    setI((n) => n + 1);
  }

  return (
    <Screen title="DUCK ID QUIZ" right={<Pixel size={9} color={C.muted}>{`${playerName.toUpperCase()} · ${i + 1}/${round.length} · ${score}✓`}</Pixel>}>
      <Prompt q={q} answered={!!picked} right={picked === q.speciesId} />
      {/* Right under the prompt: on a tall list of seven choices, a button below them sits under the tab bar. */}
      {picked ? <Btn label={i + 1 < round.length ? 'NEXT ›' : 'SEE SCORE ›'} onPress={next} /> : null}
      <View style={{ gap: 8 }}>
        {q.choices.map((id) => {
          const right = picked && id === q.speciesId;
          const wrong = picked === id && id !== q.speciesId;
          return (
            <Pressable
              key={id}
              onPress={() => (picked ? next() : choose(id))}
              style={[styles.choice, right && { backgroundColor: C.marsh, borderColor: C.marsh }, wrong && { backgroundColor: C.red, borderColor: C.red }]}
            >
              <Text style={[styles.choiceTxt, (right || wrong) && { color: C.white }]}>{SPECIES_BY_ID[id]?.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

function playerHint(hunters: number) {
  return hunters === 0 ? <Body muted>Add hunters to keep a best score for each of them.</Body> : null;
}

/** After answering: the bird's name across the top of the photo or sound panel. */
function NameFlag({ speciesId, sex, right }: { speciesId: string; sex?: 'drake' | 'hen'; right: boolean }) {
  const name = SPECIES_BY_ID[speciesId]?.name ?? speciesId;
  return (
    <View style={[styles.name, { backgroundColor: right ? C.marsh : C.red }]}>
      <Text style={styles.nameTxt}>{`${right ? '✓' : '✗'} ${name.toUpperCase()}${sex ? ` · ${sex === 'drake' ? 'DRAKE' : 'HEN'}` : ''}`}</Text>
    </View>
  );
}

function Prompt({ q, answered, right }: { q: Question; answered: boolean; right: boolean }) {
  // The regs flag shows only after answering — before, it would give the bird away.
  return q.kind === 'audio' ? (
    <SoundPrompt key={q.speciesId} speciesId={q.speciesId} answered={answered} right={right} />
  ) : (
    <PhotoPrompt speciesId={q.speciesId} mediaId={q.mediaId ?? q.speciesId} answered={answered} right={right} />
  );
}

function RegsFlag({ speciesId }: { speciesId: string }) {
  const r = RESTRICTIONS[speciesId];
  if (!r) return null;
  return (
    <View style={[styles.flag, { backgroundColor: r.level === 'closed' ? C.red : C.orange }]}>
      <Text style={styles.flagTxt}>{`${r.level === 'closed' ? '⛔ PROTECTED / CLOSED' : '⚠️ RESTRICTED'} · ${r.text}`}</Text>
      <Text style={[styles.flagTxt, { fontWeight: '600', fontSize: 10 }]}>Limits change yearly — check your state's regulations.</Text>
    </View>
  );
}

/** The whole photo, never cropped: fitted inside a 4:3 frame that leaves room for the seven answers. */
function PhotoPrompt({ speciesId, mediaId, answered, right }: { speciesId: string; mediaId: string; answered: boolean; right: boolean }) {
  const img = QUIZ_IMAGES[mediaId];
  const { width, height } = useWindowDimensions();
  const w = width - 32 - 6;
  const h = Math.min(w * 0.75, height * 0.36);
  return (
    <View style={{ gap: 4 }}>
      <View style={[styles.frame, { backgroundColor: C.navyDark }]}>
        <Image source={img.src} style={{ width: w, height: h }} resizeMode="contain" />
        {answered ? <NameFlag speciesId={speciesId} sex={img.sex} right={right} /> : null}
        {img.sex && !answered ? (
          <View style={[styles.sex, { backgroundColor: img.sex === 'drake' ? C.navy : '#8A5A2B' }]}>
            <Text style={styles.sexTxt}>{img.sex === 'drake' ? '♂ DRAKE' : '♀ HEN'}</Text>
          </View>
        ) : null}
        {answered ? <RegsFlag speciesId={speciesId} /> : null}
      </View>
      {img.credit ? <Text style={styles.credit}>{`Photo: ${img.credit}`}</Text> : null}
    </View>
  );
}

function SoundPrompt({ speciesId, answered, right }: { speciesId: string; answered: boolean; right: boolean }) {
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
        {answered ? <NameFlag speciesId={speciesId} right={right} /> : null}
        {answered ? <RegsFlag speciesId={speciesId} /> : null}
      </Pressable>
      {sound.credit ? <Text style={styles.credit}>{`Recording: ${sound.credit}`}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 3, borderColor: C.navy, backgroundColor: C.white, overflow: 'hidden' },
  credit: { fontSize: 10, color: C.muted },
  name: { position: 'absolute', top: 0, left: 0, right: 0, paddingVertical: 6, paddingHorizontal: 10 },
  nameTxt: { color: C.white, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  sex: { position: 'absolute', top: 6, left: 6, paddingVertical: 3, paddingHorizontal: 8 },
  sexTxt: { color: C.white, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  flag: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 5, paddingHorizontal: 8 },
  flagTxt: { color: C.white, fontSize: 12, fontWeight: '800' },
  choice: { borderWidth: 2.5, borderColor: C.navy, backgroundColor: C.white, paddingVertical: 12, paddingHorizontal: 14 },
  choiceTxt: { fontSize: 16, fontWeight: '800', color: C.navy },
});
