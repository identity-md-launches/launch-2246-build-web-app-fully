import { useSettings } from '../store/settings';

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function gain(c: AudioContext, v: number) {
  const g = c.createGain();
  g.gain.value = v * useSettings.getState().volume;
  g.connect(c.destination);
  return g;
}

/** Steel-on-steel: a short band-passed noise burst with a metallic ring. */
export function bladeContact() {
  const c = ac();
  if (!c) return;
  const len = Math.floor(c.sampleRate * 0.12);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18));
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200;
  bp.Q.value = 6;
  const g = gain(c, 0.5);
  src.connect(bp).connect(g);
  src.start();
  const ring = c.createOscillator();
  ring.frequency.value = 2650;
  const rg = gain(c, 0.08);
  rg.gain.setTargetAtTime(0, c.currentTime + 0.02, 0.05);
  ring.connect(rg);
  ring.start();
  ring.stop(c.currentTime + 0.3);
}

/** Scoring-box buzzer. */
export function buzzer() {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.value = 220;
  const o2 = c.createOscillator();
  o2.type = 'square';
  o2.frequency.value = 277;
  const g = gain(c, 0.12);
  g.gain.setTargetAtTime(0, c.currentTime + 0.7, 0.05);
  o.connect(g);
  o2.connect(g);
  o.start();
  o2.start();
  o.stop(c.currentTime + 0.9);
  o2.stop(c.currentTime + 0.9);
}

/** Referee whistle: a warbling sine. */
export function whistle() {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  o.frequency.value = 2800;
  const lfo = c.createOscillator();
  lfo.frequency.value = 28;
  const lg = c.createGain();
  lg.gain.value = 120;
  lfo.connect(lg).connect(o.frequency);
  const g = gain(c, 0.08);
  g.gain.setTargetAtTime(0, c.currentTime + 0.45, 0.04);
  o.connect(g);
  o.start();
  lfo.start();
  o.stop(c.currentTime + 0.6);
  lfo.stop(c.currentTime + 0.6);
}
