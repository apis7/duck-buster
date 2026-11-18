// Synthesizes the game's 8-bit sound effects as small mono WAVs.
// Run: node scripts/make-sfx.mjs  → assets/sfx/*.wav
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');
mkdirSync(out, { recursive: true });

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767 * 0.8, i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const square = (f, t) => (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1);

/** Notes: [freq, seconds]; square wave with a short decay per note. */
function tune(notes, vol = 0.5) {
  const s = [];
  for (const [f, dur] of notes) {
    const n = Math.floor(dur * RATE);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const env = Math.min(1, i / 60) * Math.max(0, 1 - i / n) ** 0.6;
      s.push(f ? square(f, t) * env * vol : 0);
    }
  }
  return s;
}

function noise(dur, vol = 0.9, decay = 4, hold = 3) {
  const n = Math.floor(dur * RATE);
  const s = [];
  let held = 0;
  const holdN = hold;
  for (let i = 0; i < n; i++) {
    if (i % holdN === 0) held = Math.random() * 2 - 1; // crunchy, low-rate noise
    s.push(held * vol * Math.exp((-decay * i) / n));
  }
  return s;
}

function sweep(f0, f1, dur, vol = 0.5) {
  const n = Math.floor(dur * RATE);
  const s = [];
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 + ((f1 - f0) * i) / n;
    phase += f / RATE;
    s.push((phase % 1 < 0.5 ? 1 : -1) * vol * (1 - i / n));
  }
  return s;
}

/** Short metallic clicks, e.g. pump action: chk-chk. */
function clicks(times, vol = 0.8) {
  const s = [];
  for (const at of times) {
    while (s.length < Math.floor(at * RATE)) s.push(0);
    const n = Math.floor(0.035 * RATE);
    for (let i = 0; i < n; i++) s.push((Math.random() * 2 - 1) * vol * Math.exp((-8 * i) / n) + Math.sin(i * 0.9) * 0.3 * Math.exp((-10 * i) / n));
  }
  return s;
}

/** A gruff 8-bit "woof": a falling square burst with a little noise. */
function woof() {
  const s = sweep(320, 140, 0.16, 0.5);
  return s.map((v, i) => v * 0.8 + (Math.random() * 2 - 1) * 0.15 * (1 - i / s.length));
}

const files = {
  'boom.wav': noise(0.7, 1, 3.2, 9),
  'dry.wav': clicks([0], 0.5),
  'reload.wav': clicks([0, 0.16], 0.9),
  'woof.wav': [...woof(), ...new Array(Math.floor(0.08 * RATE)).fill(0), ...woof()],
  'celebrate.wav': tune([[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.12], [0, 0.04], [784, 0.08], [1047, 0.35]], 0.42),
  
  'shot.wav': noise(0.16, 0.9, 5),
  'hit.wav': sweep(700, 180, 0.14, 0.45),
  'vital.wav': tune([[988, 0.06], [1319, 0.12]], 0.4),
  'beep.wav': tune([[523, 0.14]], 0.4),
  'go.wav': tune([[1047, 0.3]], 0.4),
  'gameover.wav': tune([[784, 0.12], [659, 0.12], [523, 0.12], [392, 0.3]], 0.4),
  'badge.wav': tune([[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.25]], 0.4),
  'correct.wav': tune([[880, 0.07], [1175, 0.14]], 0.35),
  'wrong.wav': tune([[196, 0.22]], 0.35),
};

for (const [name, samples] of Object.entries(files)) writeFileSync(join(out, name), wav(samples));
console.log('wrote', Object.keys(files).join(', '));
