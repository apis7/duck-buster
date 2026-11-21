import { Platform } from 'react-native';
import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export type UpdateState = 'none' | 'available' | 'downloaded';

type Native = {
  check(): Promise<UpdateState>;
  start(): Promise<boolean>;
  complete(): Promise<void>;
  addListener(event: 'onDownloaded', cb: () => void): EventSubscription;
};

// Android only; absent (null) on iOS and in Expo Go, where every call is a no-op.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('InAppUpdates') : null;

export const checkForUpdate = (): Promise<UpdateState> => native?.check() ?? Promise.resolve('none');
export const startUpdate = (): Promise<boolean> => native?.start() ?? Promise.resolve(false);
export const completeUpdate = (): Promise<void> => native?.complete() ?? Promise.resolve();
export const onUpdateDownloaded = (cb: () => void): (() => void) => {
  const sub = native?.addListener('onDownloaded', cb);
  return () => sub?.remove();
};
