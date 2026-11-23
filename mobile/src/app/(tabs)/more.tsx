import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';

import { setMuted } from '@/audio/sfx';
import { CRASH_TEST, testCrash } from '@/crash/crash';
import { exportBackup, pickBackup } from '@/db/backup';
import { describe } from '@/transfer/snapshot';
import { useStore } from '@/state/store';
import { useDialog } from '@/ui/Dialog';
import { Body, Btn, Card, Pixel, Screen, Section } from '@/ui/kit';
import { C, MEDALS } from '@/ui/theme';

const PRIVACY_URL = 'https://apis7.github.io/apsinthion-apps/duck-buster/privacy/';

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
  const { data, highScores, settings, setSetting, importData } = useStore();
  const ask = useDialog();
  const [busy, setBusy] = useState(false);
  const muted = settings.muted === '1';
  const lastBackup = settings.lastBackupAt ? new Date(Number(settings.lastBackupAt)).toLocaleDateString() : null;

  async function backup() {
    setBusy(true);
    try {
      await exportBackup(data);
      // Android's share sheet doesn't say whether it was cancelled, so ask before
      // recording a backup — the Jan–Jun reminder goes quiet once one is recorded.
      const saved = await ask({
        icon: '💾',
        title: 'Saved it?',
        message: 'Did the backup file make it somewhere safe (Drive, email, Files)?',
        buttons: [
          { label: 'Yes, saved', value: 'yes', kind: 'primary' },
          { label: 'Not yet', value: 'no' },
        ],
      });
      if (saved === 'yes') await setSetting('lastBackupAt', String(Date.now()));
    } catch (e) {
      await ask({ icon: '⚠️', title: 'Backup failed', message: e instanceof Error ? e.message : String(e), buttons: [{ label: 'OK', value: 'ok' }] });
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    let snap;
    try {
      snap = await pickBackup();
    } catch (e) {
      await ask({ icon: '⚠️', title: 'Not a backup', message: e instanceof Error ? e.message : String(e), buttons: [{ label: 'OK', value: 'ok' }] });
      return;
    }
    if (!snap) return;
    const choice = await ask({
      icon: '📦',
      title: 'Restore this backup?',
      message: `${describe(snap.data)}. Merge adds what's new and keeps what's here (same names are the same hunter; same-day hunts combine). Replace makes this phone an exact copy of the backup.`,
      buttons: [
        { label: 'Merge', value: 'merge', kind: 'primary' },
        { label: 'Replace everything', value: 'replace', kind: 'danger' },
        { label: 'Cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'merge' && choice !== 'replace') return;
    setBusy(true);
    try {
      await importData(snap.data, choice);
      await ask({ icon: '✅', title: 'Restored', message: describe(snap.data), buttons: [{ label: 'Nice', value: 'ok' }] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="MORE">
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="👥" label="Hunters" onPress={() => router.push('/hunters')} />
        <Row icon="🎮" label="Practice the duck shoot" onPress={() => router.push('/game')} />
        <Row icon="🗄️" label="Past seasons" onPress={() => router.push('/seasons')} />
        <Row icon="📤" label="Send to a phone" onPress={() => router.push('/transfer-send')} />
        <Row icon="📥" label="Receive from a phone" onPress={() => router.push('/transfer-receive')} />
        <Row icon="🥊" label="Duck Season Slugfest" onPress={() => router.push('/slugfest')} />
      </Card>

      <Section title="Backup">
        <Card style={{ gap: 10 }}>
          <Body>
            Save every season — hunters, hunts, birds, duck-shoot scores — to a file you keep (Drive, email, wherever). Restore
            it on any phone.
          </Body>
          <Body muted style={{ fontSize: 13 }}>{lastBackup ? `Last backup: ${lastBackup}` : 'No backup yet.'}</Body>
          <Btn label={busy ? 'WORKING…' : '💾 SAVE A BACKUP'} onPress={backup} disabled={busy} />
          <Btn label="📂 RESTORE FROM A BACKUP" kind="secondary" onPress={restore} disabled={busy} />
        </Card>
      </Section>

      <Section title="Practice high scores">
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
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="❓" label="Minigame FAQ" onPress={() => router.push('/minigame-faq')} />
        </Card>
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
            Your hunts live only on this phone: no account, no cloud. The only thing that talks to the internet is the ads
            (Google AdMob), which use your phone's advertising ID — your hunting log is never shared. Moving to a new phone?
            Use Send to a phone (screen to camera), or a backup file.
          </Body>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8}>
            <Body style={{ color: C.orange, fontWeight: '800' }}>Privacy policy ›</Body>
          </Pressable>
        </Card>
      </Section>

      {CRASH_TEST ? (
        <Section title="Crash reporter (test builds only)">
          <Card style={{ gap: 10 }}>
            <Btn label="THROW A JS ERROR" kind="secondary" onPress={testCrash.js} />
            <Btn label="NATIVE CRASH" kind="danger" onPress={testCrash.native} />
          </Card>
        </Section>
      ) : null}

      <Body muted style={{ textAlign: 'center', fontSize: 12 }}>
        {`Duck Buster ${Constants.expoConfig?.version ?? ''} · Quiz photos and calls are public domain or Creative Commons — credits in the quiz.`}
      </Body>
    </Screen>
  );
}
