import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Fire-and-forget sound effects. Each sound keeps a small pool of players so
 * rapid gunfire overlaps instead of cutting itself off.
 */

const SOURCES = {
  shot: require('../../assets/sfx/shot.wav'),
  hit: require('../../assets/sfx/hit.wav'),
  vital: require('../../assets/sfx/vital.wav'),
  beep: require('../../assets/sfx/beep.wav'),
  go: require('../../assets/sfx/go.wav'),
  gameover: require('../../assets/sfx/gameover.wav'),
  badge: require('../../assets/sfx/badge.wav'),
  correct: require('../../assets/sfx/correct.wav'),
  wrong: require('../../assets/sfx/wrong.wav'),
  quack: require('../../assets/sfx/quack.mp3'),
  dry: require('../../assets/sfx/dry.wav'),
  reload: require('../../assets/sfx/reload.wav'),
  woof: require('../../assets/sfx/woof.wav'),
  celebrate: require('../../assets/sfx/celebrate.wav'),
  boom: require('../../assets/sfx/boom.wav'),
} as const;

export type Sfx = keyof typeof SOURCES;

const POOL = 4;
const pools = new Map<Sfx, { players: AudioPlayer[]; next: number }>();
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

export async function initAudio() {
  // Respect the silent switch: a duck call in church is not a feature.
  await setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
}

export function play(name: Sfx) {
  if (muted) return;
  try {
    let pool = pools.get(name);
    if (!pool) {
      const size = name === 'shot' || name === 'hit' ? POOL : 1;
      pool = { players: Array.from({ length: size }, () => createAudioPlayer(SOURCES[name])), next: 0 };
      pools.set(name, pool);
    }
    const p = pool.players[pool.next];
    pool.next = (pool.next + 1) % pool.players.length;
    p.seekTo(0);
    p.play();
  } catch {
    // Sound is decoration; never let it break a flow.
  }
}

/** Warm the players used in the first second of the game. */
export function preload() {
  for (const n of ['shot', 'hit', 'vital', 'beep', 'go', 'reload', 'dry'] as Sfx[]) {
    if (!pools.has(n)) {
      const size = n === 'shot' || n === 'hit' ? POOL : 1;
      pools.set(n, { players: Array.from({ length: size }, () => createAudioPlayer(SOURCES[n])), next: 0 });
    }
  }
}
