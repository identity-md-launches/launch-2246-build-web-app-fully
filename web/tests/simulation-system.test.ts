import { describe, expect, it } from 'vitest';
import { TECHNIQUES } from '../src/data/techniques';
import { demoFor, demoScript, measureValue } from '../src/modes/demo';
import { makeRig } from '../src/rig/dimensions';
import { buildSkeleton } from '../src/rig/skeleton';
import { dist } from '../src/rig/vec';
import { tipContact } from '../src/sim/geometry';
import { configAtMeasure, DEFAULT_CONFIG, runPhrase } from '../src/sim/phrase';
import { LOCKOUT_TICKS, MIN_CONTACT_TICKS, MIN_TIP_LOAD_N, other } from '../src/sim/types';

describe('all 100 authored demonstrations', () => {
  it.each(TECHNIQUES.map((t) => t.id))('%s keeps scoring, target contact and the referee in agreement', (id) => {
    const result = demoFor(id, DEFAULT_CONFIG);
    expect(result.registered.length, `${id}: every claimed default-demo contact registers`).toBe(result.claimed.length);
    const eligible = result.registered.filter((h) => result.lockoutStart !== null && h.tick <= result.lockoutStart + LOCKOUT_TICKS);
    expect(result.events.filter((e) => e.kind === 'hit')).toEqual(eligible.map((h) => ({ t: h.tick, kind: 'hit', side: h.side, valid: h.valid })));
    for (const hit of result.registered) {
      const claimed = result.claimed.find((c) => c.side === hit.side);
      expect(claimed).toBeDefined();
      expect(hit.valid).toBe(claimed!.valid);
      expect(hit.part).toBe(claimed!.part);
      for (let k = 0; k < MIN_CONTACT_TICKS; k++) {
        const f = result.frames[hit.tick + k];
        const sk = buildSkeleton(f[hit.side], makeRig(1.78));
        const def = buildSkeleton(f[other(hit.side)], makeRig(1.78));
        const contact = tipContact(sk.tip, sk.tipDir, def);
        expect(contact, `${id} ${hit.side}: actual target contact`).not.toBeNull();
        expect(contact!.capsule.part).toBe(hit.part);
        expect(contact!.capsule.valid).toBe(hit.valid);
        expect(contact!.angle).toBeLessThanOrEqual(60);
        expect(f[hit.side].bend * 12).toBeGreaterThan(MIN_TIP_LOAD_N);
        expect(dist(sk.tip, claimed!.point)).toBeLessThanOrEqual(0.02);
      }
    }
    if (result.verdict.scorer && !result.verdict.penalty) {
      expect(eligible.some((h) => h.side === result.verdict.scorer && h.valid)).toBe(true);
      expect(result.lights[result.verdict.scorer === 'left' ? 'red' : 'green']).toBe(true);
    }
  });

  it('rebuilds every demonstration deterministically without the demo cache', () => {
    for (const technique of TECHNIQUES) {
      const script = demoScript(technique);
      const cfg = configAtMeasure({ ...DEFAULT_CONFIG, seed: 90210 }, measureValue(script.measure, DEFAULT_CONFIG.left.height));
      const first = runPhrase(cfg, script.slices);
      const second = runPhrase(cfg, script.slices);
      expect(second.hash, technique.id).toBe(first.hash);
      expect(second.events, technique.id).toEqual(first.events);
      expect(second.verdict, technique.id).toEqual(first.verdict);
    }
  });
});
