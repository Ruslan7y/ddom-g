// Sentezlenmiş sesler (dosya gerektirmez)
import { profile } from './store.js';

let ctx = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBurst(c, t, dur, freq, gain) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start(t);
}

function tone(c, t, freq, dur, gain, type = 'sine') {
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  place() {
    if (!profile().sound) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, t, 0.06, 2600, 0.9);
    noiseBurst(c, t + 0.012, 0.05, 900, 0.6);
    tone(c, t, 180, 0.08, 0.25, 'triangle');
  },
  tap() {
    if (!profile().sound) return;
    const c = ac(); if (!c) return;
    noiseBurst(c, c.currentTime, 0.03, 3200, 0.35);
  },
  draw() {
    if (!profile().sound) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noiseBurst(c, t, 0.05, 1800, 0.5);
    noiseBurst(c, t + 0.09, 0.05, 1800, 0.5);
  },
  pass() {
    if (!profile().sound) return;
    const c = ac(); if (!c) return;
    tone(c, c.currentTime, 330, 0.18, 0.12, 'sine');
  },
  win() {
    if (!profile().sound) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.11, f, 0.35, 0.16, 'triangle'));
  },
  lose() {
    if (!profile().sound) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [392, 330, 262].forEach((f, i) => tone(c, t + i * 0.16, f, 0.4, 0.13, 'sine'));
  },
  topple(i) {
    if (!profile().sound) return;
    const c = ac(); if (!c) return;
    noiseBurst(c, c.currentTime, 0.035, 2200 + (i % 5) * 200, 0.25);
  },
};

export function vibrate(ms = 15) {
  if (!profile().vibration) return;
  try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* yoksay */ }
}
