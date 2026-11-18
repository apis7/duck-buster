import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, Switch, Text, View } from 'react-native';

import { setMuted } from '@/audio/sfx';
import { useStore } from '@/state/store';
import { Body, Card, Pixel, Screen, Section } from '@/ui/kit';
import { C, MEDALS } from '@/ui/theme';

function Row({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ fontSize: 22, width: 30 }}>{icon}</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: C.navy, flex: 1 }}>{label}</Text>
      <Pixel size={10} color={C.muted}>{'>'}</Pixel>
    </Pressable>
  );
}

export default function More() {
  const { highScores, settings, setSetting } = useStore();
  const muted = settings.muted === '1';

  return (
    <Screen title="MORE">
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="👥" label="Hunters" onPress={() => router.push('/hunters')} />
        <Row icon="🎮" label="Play the duck shoot" onPress={() => router.push('/game')} />
        <Row icon="📤" label="Send to a phone" onPress={() => router.push('/transfer-send')} />
        <Row icon="📥" label="Receive from a phone" onPress={() => router.push('/transfer-receive')} />
      </Card>

      <Section title="Arcade high scores">
        <Card style={{ gap: 6 }}>
          {highScores.length === 0 ? <Body muted>No scores yet.</Body> : null}
          {highScores.slice(0, 5).map((s, i) => (
            <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pixel size={11} color={MEDALS[i] ?? C.navy}>{`${i + 1}. ${s.initials}`}</Pixel>
              <Pixel size={11} color={MEDALS[i] ?? C.navy}>{`${s.score}`}</Pixel>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Settings">
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Body style={{ fontWeight: '700' }}>Sound effects</Body>
          <Switch
            value={!muted}
            onValueChange={(on) => {
              setMuted(!on);
              setSetting('muted', on ? '0' : '1');
            }}
            trackColor={{ true: C.orange, false: C.locked }}
          />
        </Card>
      </Section>

      <Section title="About the ads">
        <Card style={{ gap: 8 }}>
          <Body>
            Duck Buster is free because it's ad-supported. We place ads where you're already done with something — after
            you save a hunt, or on screens you're just browsing — so you can finish what you're doing first, set the phone
            down, and let the ad play out on its own.
          </Body>
          <Body muted style={{ fontSize: 13 }}>
            Ads are limited to family-friendly content. You'll never see an ad while logging a hunt or playing the game.
          </Body>
        </Card>
      </Section>

      <Section title="Privacy">
        <Card style={{ gap: 8 }}>
          <Body>
            Your hunts live only on this phone. No account, no cloud, no tracking. The only thing that talks to the internet
            is the ads. Moving to a new phone? Use Send to a phone — it goes screen to camera, nothing in between.
          </Body>
        </Card>
      </Section>

      <Body muted style={{ textAlign: 'center', fontSize: 12 }}>
        {`Duck Buster ${Constants.expoConfig?.version ?? ''} · Quiz photos and calls are public domain — credits in the quiz.`}
      </Body>
    </Screen>
  );
}
