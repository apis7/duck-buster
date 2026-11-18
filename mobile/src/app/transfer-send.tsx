import * as Crypto from 'expo-crypto';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { encodeTransfer, FRAME_MS, sessionFromBytes } from '@/transfer/frames';
import { frameToPath, type QrPath } from '@/transfer/qr-path';
import { describe, SNAPSHOT_FORMAT, snapshotToBytes } from '@/transfer/snapshot';
import { useStore } from '@/state/store';
import { Body, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

/** The old phone: loops QR codes until the new phone has caught them all. */
export default function TransferSend() {
  useKeepAwake();
  const { data } = useStore();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // Snapshot once on open; edits made elsewhere while sending don't restart the loop.
  const [{ frames, error }] = useState<{ frames: QrPath[] | null; error: string | null }>(() => {
    try {
      const texts = encodeTransfer(snapshotToBytes(data), {
        session: sessionFromBytes(Crypto.getRandomBytes(6)),
        format: SNAPSHOT_FORMAT,
      });
      return { frames: texts.map(frameToPath), error: null };
    } catch (e) {
      return { frames: null, error: e instanceof Error ? e.message : String(e) };
    }
  });

  useEffect(() => {
    if (!frames || frames.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % frames.length), FRAME_MS);
    return () => clearInterval(t);
  }, [frames]);

  const side = Math.min(width - 32, 420);
  const frame = frames?.[index];

  return (
    <SubScreen title="SEND TO A PHONE">
      <Body>
        On the other phone, open Duck Buster › More › Receive from a phone, and point its camera at this screen. Hold both
        phones steady.
      </Body>
      <View style={{ alignItems: 'center', padding: 8, backgroundColor: C.white, borderWidth: 2.5, borderColor: C.navy }}>
        {error ? (
          <Body style={{ color: C.red }}>{error}</Body>
        ) : frame ? (
          // Always black on white: many decoders refuse inverted codes.
          <Svg width={side - 20} height={side - 20} viewBox={`0 0 ${frame.size} ${frame.size}`}>
            <Rect width={frame.size} height={frame.size} fill="#FFFFFF" />
            <Path d={frame.d} fill="#000000" />
          </Svg>
        ) : (
          <Pixel size={10}>PACKING UP…</Pixel>
        )}
      </View>
      {frames ? (
        <Body muted style={{ fontSize: 13 }}>
          {`${describe(data)}\nCode ${index + 1} of ${frames.length} · one loop takes about ${Math.ceil((frames.length * FRAME_MS) / 1000)}s. Keep this open until the other phone says it's done.`}
        </Body>
      ) : null}
    </SubScreen>
  );
}
