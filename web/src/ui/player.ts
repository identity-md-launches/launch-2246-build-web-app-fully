import { useEffect, useRef, useState } from 'react';
import type { PhraseResult } from '../sim/types';

/** Mutable playback clock shared by the 3D stage (per frame) and the HTML controls (throttled). */
export class Player {
  tick = 0;
  playing = true;
  speed = 1;
  loop = true;
  result: PhraseResult | null = null;
  /** Upper bound of playable ticks (for phrases still in progress). */
  limit = Infinity;
  private listeners = new Set<() => void>();
  onEnd?: () => void;
  setResult(r: PhraseResult | null, from = 0) {
    this.result = r;
    this.tick = from;
    this.limit = Infinity;
    this.emit();
  }
  get end() {
    return Math.min(this.limit, this.result?.endTick ?? 0);
  }
  advance(dt: number) {
    if (!this.result || !this.playing) return;
    this.tick += dt * 120 * this.speed;
    if (this.tick >= this.end) {
      if (this.loop) this.tick = 0;
      else {
        this.tick = this.end;
        this.playing = false;
        this.onEnd?.();
      }
      this.emit();
    }
  }
  seek(t: number) {
    this.tick = Math.max(0, Math.min(this.end, t));
    this.emit();
  }
  step(n: number) {
    this.playing = false;
    this.seek(Math.round(this.tick) + n);
  }
  toggle() {
    if (!this.playing && this.tick >= this.end) this.tick = 0;
    this.playing = !this.playing;
    this.emit();
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.listeners.forEach((f) => f());
  }
}

/** Re-render a component ~15 times a second with the player's tick. */
export function usePlayerTick(p: Player): number {
  const [t, setT] = useState(p.tick);
  const ref = useRef(p.tick);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last > 66 || Math.abs(p.tick - ref.current) > 30) {
        last = now;
        if (p.tick !== ref.current) {
          ref.current = p.tick;
          setT(p.tick);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const un = p.subscribe(() => {
      ref.current = p.tick;
      setT(p.tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      un();
    };
  }, [p]);
  return t;
}
