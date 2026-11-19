import { strFromU8, strToU8 } from 'fflate';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { prettyDate, seasonLabel } from '@/domain/season';
import { buildCard, parseCard } from '@/domain/slugfest';
import { useStore } from '@/state/store';
import { encodeTransfer, FRAME_MS, parseFrame, sessionFromBytes, TransferAssembler } from '@/transfer/frames';
import { frameToPath, type QrPath } from '@/transfer/qr-path';
import { SNAPSHOT_FORMAT } from '@/transfer/snapshot';
import { useDialog } from '@/ui/Dialog';
import { Body, Btn, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

/**
 * Slugfest by QR. With ?season=… this phone shows its season card as a loop of
 * codes; without, it scans another crew's. Same framing as the phone-to-phone
 * transfer — a season card is small, usually one or two codes.
 */
export default function SlugfestQr() {
  const { season } = useLocalSearchParams<{ season?: string }>();
  return season ? <Send season={Number(season)} /> : <Receive />;
}

function Send({ season }: { season: number }) {
  useKeepAwake();
  const { data, crew } = useStore();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [frames] = useState<QrPath[]>(() => {
    const card = buildCard(data, season, crew.id, crew.name);
    return encodeTransfer(strToU8(JSON.stringify(card)), { session: sessionFromBytes(Crypto.getRandomBytes(6)), format: SNAPSHOT_FORMAT }).map(frameToPath);
  });

  useEffect(() => {
    if (frames.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % frames.length), FRAME_MS);
    return () => clearInterval(t);
  }, [frames]);

  const side = Math.min(width - 52, 400);
  const frame = frames[index];
  return (
    <SubScreen title="SLUGFEST: MY SEASON">
      <Body>{`On the other phone: More › Duck Season Slugfest › Scan QR. Point it here.`}</Body>
      <View style={{ alignItems: 'center', padding: 8, backgroundColor: C.white, borderWidth: 2.5, borderColor: C.navy }}>
        <Svg width={side} height={side} viewBox={`0 0 ${frame.size} ${frame.size}`}>
          <Rect width={frame.size} height={frame.size} fill="#FFFFFF" />
          <Path d={frame.d} fill="#000000" />
        </Svg>
      </View>
      <Body muted style={{ fontSize: 13 }}>{`${crew.name} · ${seasonLabel(season)} · code ${index + 1} of ${frames.length}`}</Body>
    </SubScreen>
  );
}

function Receive() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { crew, addSlugCard } = useStore();
  const ask = useDialog();
  const [permission, requestPermission] = useCameraPermissions();
  const [assembler] = useState(() => new TransferAssembler());
  const done = useRef(false);
  const [progress, setProgress] = useState({ received: 0, total: 0 });

  const onScan = useCallback(
    async (text: string) => {
      if (done.current) return;
      const parsed = parseFrame(text, SNAPSHOT_FORMAT);
      if (parsed.type !== 'frame' || !assembler.accept(parsed.frame)) return;
      const p = assembler.progress();
      setProgress({ received: p.received, total: p.total });
      if (!p.complete) return;
      done.current = true;
      try {
        const card = parseCard(JSON.parse(strFromU8(assembler.result())));
        if (card.crewId === crew.id) throw new Error('That’s your own season card.');
        await addSlugCard(card);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await ask({
          icon: '🥊',
          title: `${card.crewName} is in`,
          message: `${seasonLabel(card.season)} · ${card.hunters.length} hunters · ${card.final ? 'final' : `as of ${prettyDate(card.asOf)}`}`,
          buttons: [{ label: 'Bring it', value: 'ok' }],
        });
        router.back();
      } catch (e) {
        await ask({ icon: '⚠️', title: 'That didn’t work', message: e instanceof Error ? e.message : String(e), buttons: [{ label: 'OK', value: 'ok' }] });
        assembler.reset();
        done.current = false;
        setProgress({ received: 0, total: 0 });
      }
    },
    [assembler, crew.id, addSlugCard, ask],
  );

  if (!permission) return <SubScreen title="SCAN A CREW"><View /></SubScreen>;
  if (!permission.granted) {
    return (
      <SubScreen title="SCAN A CREW">
        <Body>Scanning reads the other crew's code with the camera. Nothing leaves either phone.</Body>
        {permission.canAskAgain ? <Btn label="ALLOW CAMERA" onPress={requestPermission} /> : <Body muted>Camera access is off in Settings.</Body>}
      </SubScreen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data: t }) => onScan(t)} />
      <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 16 }}>
        <View style={styles.panel}>
          <Pixel size={10} color={C.white}>SCAN A CREW'S SEASON</Pixel>
          <Body style={{ color: '#ddd' }}>On their phone: Duck Season Slugfest › Show my QR.</Body>
        </View>
        <View style={{ alignSelf: 'center', width: 240, height: 240, borderWidth: 4, borderColor: C.orange }} />
        <View style={[styles.panel, { gap: 10 }]}>
          <Body style={{ color: C.white }}>{progress.total ? `${progress.received} of ${progress.total}` : 'Looking for their code…'}</Body>
          <Btn label="CANCEL" kind="secondary" onPress={() => router.back()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: 'rgba(11,31,61,0.85)', padding: 14, gap: 6, borderWidth: 2, borderColor: C.navy },
});
