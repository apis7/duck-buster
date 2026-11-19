import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Btn, Pixel } from './kit';
import { C } from './theme';

/**
 * The app's own "are you sure?" dialog, in the pixel style — used instead of the
 * platform Alert everywhere. `ask` resolves to the chosen button's value, or null
 * if the user tapped outside / pressed back.
 */

export type DialogButton = { label: string; value: string; kind?: 'primary' | 'secondary' | 'danger' };
export type DialogOptions = { title: string; message?: string; icon?: string; buttons: DialogButton[] };

type Ask = (o: DialogOptions) => Promise<string | null>;

const Ctx = createContext<Ask | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<DialogOptions | null>(null);
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const ask = useCallback<Ask>((o) => {
    resolver.current?.(null);
    setOpen(o);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: string | null) => {
    const r = resolver.current;
    resolver.current = null;
    setOpen(null);
    r?.(v);
  };

  return (
    <Ctx.Provider value={ask}>
      {children}
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => close(null)}>
        <Pressable style={styles.backdrop} onPress={() => close(null)}>
          {open ? (
            <Animated.View entering={ZoomIn.duration(200)}>
              <Pressable style={styles.card} onPress={() => {}}>
                {open.icon ? <Text style={{ fontSize: 44, textAlign: 'center' }}>{open.icon}</Text> : null}
                <Pixel size={13} style={{ textAlign: 'center' }}>{open.title.toUpperCase()}</Pixel>
                {open.message ? <Text style={styles.msg}>{open.message}</Text> : null}
                <View style={{ gap: 10, marginTop: 6 }}>
                  {open.buttons.map((b) => (
                    <Btn key={b.value} label={b.label.toUpperCase()} kind={b.kind ?? 'secondary'} onPress={() => close(b.value)} />
                  ))}
                </View>
              </Pressable>
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>
    </Ctx.Provider>
  );
}

export function useDialog(): Ask {
  const ask = useContext(Ctx);
  if (!ask) throw new Error('useDialog outside DialogProvider');
  return ask;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,61,0.78)', justifyContent: 'center', padding: 26 },
  card: { backgroundColor: C.white, borderWidth: 3, borderColor: C.navy, borderBottomWidth: 7, borderRightWidth: 7, padding: 20, gap: 10 },
  msg: { fontSize: 16, color: C.ink, textAlign: 'center', lineHeight: 22 },
});
