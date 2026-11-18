import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Data } from '@/domain/types';
import { useStore } from '@/state/store';
import { parseFrame, TransferAssembler, type TransferProgress } from '@/transfer/frames';
import { describe, SNAPSHOT_FORMAT, snapshotFromBytes } from '@/transfer/snapshot';
import { useDialog } from '@/ui/Dialog';
import { Bar, Body, Btn, Card, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

const PAINT_MS = 150;
const EMPTY_PROGRESS: TransferProgress = { received: 0, total: 0, secondsLeft: null, complete: false };

/** The new phone: scan the loop, then merge into or replace what's here. */
export default function TransferReceive() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { data, importData } = useStore();
  const ask = useDialog();
  const [permission, requestPermission] = useCameraPermissions();
  const [assembler] = useState(() => new TransferAssembler());
  const done = useRef(false);
  const lastPaint = useRef(0);
  const [progress, setProgress] = useState<TransferProgress>(EMPTY_PROGRESS);
  const [tooNew, setTooNew] = useState(false);
  const [incoming, setIncoming] = useState<Data | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onScan = useCallback(
    (text: string) => {
      if (done.current) return;
      const parsed = parseFrame(text, SNAPSHOT_FORMAT);
      if (parsed.type === 'too-new') return setTooNew(true);
      if (parsed.type !== 'frame' || !assembler.accept(parsed.frame)) return;
      const now = Date.now();
      const p = assembler.progress();
      if (!p.complete && now - lastPaint.current < PAINT_MS) return;
      lastPaint.current = now;
      setProgress(p);
      if (!p.complete) return;
      done.current = true;
      try {
        setIncoming(snapshotFromBytes(assembler.result()).data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (e) {
        setFailed(e instanceof Error ? e.message : String(e));
      }
    },
    [assembler],
  );

  const restart = () => {
    assembler.reset();
    done.current = false;
    setProgress(assembler.progress());
    setIncoming(null);
    setFailed(null);
    setTooNew(false);
  };

  async function apply(mode: 'merge' | 'replace') {
    if (!incoming) return;
    const go = async () => {
      setBusy(true);
      try {
        await importData(incoming, mode);
        router.back();
      } finally {
        setBusy(false);
      }
    };
    if (mode === 'replace' && data.hunts.length > 0) {
      const yes = await ask({
        icon: '⚠️',
        title: 'Replace everything?',
        message: `This phone's ${describe(data)} will be erased and replaced.`,
        buttons: [
          { label: 'Replace', value: 'yes', kind: 'danger' },
          { label: 'Cancel', value: 'no' },
        ],
      });
      if (yes === 'yes') await go();
    } else await go();
  }

  if (incoming || failed) {
    return (
      <SubScreen title="RECEIVE">
        {failed ? (
          <Card style={{ gap: 10 }}>
            <Pixel size={11} color={C.red}>THAT DIDN'T WORK</Pixel>
            <Body>{failed}</Body>
            <Body muted>Nothing on this phone was changed.</Body>
            <Btn label="SCAN AGAIN" onPress={restart} />
          </Card>
        ) : (
          <Card style={{ gap: 10 }}>
            <Pixel size={11} color={C.marsh}>GOT IT!</Pixel>
            <Body>{describe(incoming!)}</Body>
            <Body muted>
              Merge adds what's new and keeps what's here. Replace makes this phone an exact copy of the other one.
            </Body>
            <Btn label="MERGE" onPress={() => apply('merge')} disabled={busy} />
            <Btn label="REPLACE" kind="secondary" onPress={() => apply('replace')} disabled={busy} />
          </Card>
        )}
      </SubScreen>
    );
  }

  if (!permission) return <SubScreen title="RECEIVE"><View /></SubScreen>;
  if (!permission.granted) {
    return (
      <SubScreen title="RECEIVE">
        <Body>Receiving reads the codes on the other phone with this phone's camera. Nothing leaves either phone.</Body>
        {permission.canAskAgain ? (
          <Btn label="ALLOW CAMERA" onPress={requestPermission} />
        ) : (
          <Body muted>Camera access is off in this phone's Settings.</Body>
        )}
      </SubScreen>
    );
  }

  const pct = progress.total ? Math.round((progress.received / progress.total) * 100) : 0;
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data: text }) => onScan(text)}
      />
      <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 16 }}>
        <View style={styles.panel}>
          <Pixel size={10} color={C.white}>RECEIVE FROM A PHONE</Pixel>
          <Body style={{ color: '#ddd' }}>On the other phone: More › Send to a phone. Fill the frame with its code.</Body>
        </View>
        <View style={{ alignSelf: 'center', width: 240, height: 240, borderWidth: 4, borderColor: C.orange }} />
        <View style={[styles.panel, { gap: 10 }]}>
          {tooNew ? (
            <Body style={{ color: '#FFB199' }}>The other phone has a newer Duck Buster. Update this one first.</Body>
          ) : progress.total === 0 ? (
            <Body style={{ color: C.white }}>Looking for the other phone…</Body>
          ) : (
            <>
              <Body style={{ color: C.white }}>
                {`${pct}% · ${progress.received} of ${progress.total}${progress.secondsLeft ? ` · about ${progress.secondsLeft}s left` : ''}`}
              </Body>
              <Bar value={progress.received} max={progress.total} color={C.orange} />
            </>
          )}
          <Btn label="CANCEL" kind="secondary" onPress={() => router.back()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: 'rgba(11,31,61,0.85)', padding: 14, gap: 6, borderWidth: 2, borderColor: C.navy },
});
