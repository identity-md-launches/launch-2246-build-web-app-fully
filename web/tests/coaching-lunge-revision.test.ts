import { describe, expect, it } from 'vitest';
import { activeExecutionStep, executionCues } from '../src/modes/coaching';
import { demoFor } from '../src/modes/demo';
import { TECHNIQUES, getTechnique } from '../src/data/techniques';
import { makeRig } from '../src/rig/dimensions';
import { buildSkeleton } from '../src/rig/skeleton';
import { DEFAULT_CONFIG } from '../src/sim/phrase';

describe('full lunge geometry', () => {
  for (const height of [1.55, 1.78, 2]) for (const handed of [1, -1] as const) for (const [id, tick] of [['FW04', 48], ['FW13', 77]] as const) {
    it(`${id}: height ${height}, hand ${handed}, straight rear leg and vertical front shin`, () => {
      const result = demoFor(id, { ...DEFAULT_CONFIG, left: { height, handed } });
      const frame = result.frames[tick].left;
      const sk = buildSkeleton(frame, makeRig(height));
      expect(sk.rearKneeFlex).toBeLessThan(1);
      expect(Math.abs(sk.joints.kneeW[0] - sk.joints.ankleW[0])).toBeLessThan(0.001);
      expect(Math.abs(sk.joints.kneeW[2] - sk.joints.ankleW[2])).toBeLessThan(0.001);
      const shinTilt = Math.atan2(Math.hypot(sk.joints.kneeW[0] - sk.joints.ankleW[0], sk.joints.kneeW[2] - sk.joints.ankleW[2]), sk.joints.kneeW[1] - sk.joints.ankleW[1]) * 180 / Math.PI;
      expect(shinTilt).toBeLessThan(0.2);
      expect(frame.lower.rearLift).toBe(0);
      expect(sk.lean).toBeLessThanOrEqual(15);
      expect(Math.abs(sk.joints.heelR[1] - sk.joints.toeR[1])).toBeLessThan(0.001);
    });
  }
});

describe('coaching uses the actual whole-demo events', () => {
  for (const id of ['PA01', 'PA02', 'PA03', 'PA04', 'PA09', 'PA10']) it(`${id}: riposte cue never precedes riposte start`, () => {
    const t = getTechnique(id), result = demoFor(id, DEFAULT_CONFIG);
    const cues = executionCues(t, result);
    const riposte = result.events.find(e => e.kind === 'riposteStart' && e.side === 'left')!;
    expect(cues.at(-1)?.start).toBe(riposte.t);
    expect(activeExecutionStep(cues, 36)).toBeLessThan(t.steps.length - 1);
    expect(activeExecutionStep(cues, riposte.t)).toBe(t.steps.length - 1);
  });
  it('riposte preparation is shown through the prerequisite parry', () => {
    const result = demoFor('RR01', DEFAULT_CONFIG), cues = executionCues(getTechnique('RR01'), result);
    const start = result.events.find(e => e.kind === 'riposteStart' && e.side === 'left')!.t;
    expect(activeExecutionStep(cues, start - 1)).toBe(0);
    expect(activeExecutionStep(cues, start)).toBe(1);
  });
  it('all techniques have ordered, bounded coaching ranges', () => {
    for (const t of TECHNIQUES) {
      const result = demoFor(t.id, DEFAULT_CONFIG), cues = executionCues(t, result);
      expect(cues).toHaveLength(t.steps.length);
      cues.forEach((c, i) => {
        expect(c.start).toBeGreaterThanOrEqual(cues[i - 1]?.start ?? 0);
        expect(c.end).toBeGreaterThanOrEqual(c.start);
        expect(c.end).toBeLessThanOrEqual(result.endTick + 1);
      });
    }
  });
  it('derobement coaching teaches evading contact', () => {
    expect(getTechnique('BL14').tacticalNotes).toContain('evade the attempted blade contact');
    expect(getTechnique('BL14').tacticalNotes).not.toContain('controls the opponent');
  });
});
