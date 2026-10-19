import { describe, expect, it } from 'vitest';
import { getTechnique } from '../src/data/techniques';
import { demoFor, measureValue } from '../src/modes/demo';
import { makeRig } from '../src/rig/dimensions';
import { buildSkeleton } from '../src/rig/skeleton';
import { bothFeetBeyondEnd, contactFrames, pointToBlade } from '../src/sim/geometry';
import { configAtMeasure, DEFAULT_CONFIG, parryOutcome, PhraseSim, runPhrase } from '../src/sim/phrase';
import type { PhraseResult } from '../src/sim/types';

describe('registered geometry is the source of scoring events', () => {
  it('awards the sole registered right light when a claimed lefty line contact fails geometry', () => {
    const cfg = { ...DEFAULT_CONFIG, left: { height: 2, handed: -1 as const } };
    const sim = new PhraseSim(configAtMeasure(cfg, measureValue('lunge', 2)));
    sim.slice({ blade: 'BL14', timing: 'early' }, { blade: 'BL06' });
    // Model a failed animated contact after a tactical intention has claimed a hit.
    // Keeping that claimed event must never overrule the actual scoring box.
    sim.tracks.left.ik.clear();
    const result = sim.finish();
    expect(result.lights.red).toBe(false);
    expect(result.lights.green).toBe(true);
    expect(result.claimed.some((h) => h.side === 'left')).toBe(true);
    expect(result.registered.map((h) => h.side)).toEqual(['right']);
    expect(result.events.filter((e) => e.kind === 'hit').map((e) => e.side)).toEqual(['right']);
    expect(result.verdict.scorer).toBe('right');
    expect(result.verdict.rule).toBe(10);
    expect(result.verdict.why).toContain('Only the right valid light');
  });

  it.each(['FW04', 'AT03', 'BL14', 'RR01', 'PA02'])('%s has identical scoring-box and referee contacts', (id) => {
    const result = demoFor(id, id === 'BL14' ? { ...DEFAULT_CONFIG, left: { height: 2, handed: -1 } } : DEFAULT_CONFIG);
    const expected = result.registered.filter((r) => result.lockoutStart !== null && r.tick <= result.lockoutStart + 36).map((r) => ({ t: r.tick, kind: 'hit', side: r.side, valid: r.valid }));
    expect(result.events.filter((e) => e.kind === 'hit')).toEqual(expected);
    if (result.verdict.scorer && !result.verdict.penalty) expect(result.lights[result.verdict.scorer === 'left' ? 'red' : 'green']).toBe(true);
  });

  it('excludes a real second contact that arrives after the box lockout', () => {
    const sim = new PhraseSim(configAtMeasure(DEFAULT_CONFIG, 1.3));
    sim.slice({ blade: 'AT01' }, { blade: 'AT01' });
    // Delay one actual contact without moving the opposing target or its claimed hit.
    for (const [t, frame] of [...sim.tracks.right.ik]) {
      sim.tracks.right.ik.delete(t);
      sim.tracks.right.ik.set(t + 40, frame);
    }
    const result = sim.finish();
    expect(result.registered.map((r) => r.side)).toEqual(['left', 'right']);
    expect(result.registered[1].tick - result.registered[0].tick).toBe(40);
    expect(result.lights).toMatchObject({ red: true, green: false });
    expect(result.events.filter((e) => e.kind === 'hit').map((e) => e.side)).toEqual(['left']);
    expect(result.verdict.scorer).toBe('left');
    expect(result.verdict.rule).toBe(10);
  });
});

describe('successful parries have verified physical blade contact', () => {
  function assertContacts(result: PhraseResult, heights = { left: 1.78, right: 1.78 }) {
    const events = result.events.filter((e) => e.kind === 'parry' && e.success);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      if (event.kind !== 'parry') continue;
      expect(event.point).toBeDefined();
      const left = buildSkeleton(result.frames[event.t].left, makeRig(heights.left));
      const right = buildSkeleton(result.frames[event.t].right, makeRig(heights.right));
      expect(left.armReached).toBe(true);
      expect(right.armReached).toBe(true);
      expect(pointToBlade(event.point!, left.blade)).toBeLessThan(0.001);
      expect(pointToBlade(event.point!, right.blade)).toBeLessThan(0.001);
      expect(result.priority.some((p) => p.t === event.t && p.side === event.side)).toBe(true);
    }
  }

  it.each(Array.from({ length: 20 }, (_, i) => `PA${String(i + 1).padStart(2, '0')}`))('%s meets at its contact event instead of deflecting across a gap', (id) => assertContacts(demoFor(id, DEFAULT_CONFIG)));

  it('uses the actual rig proportions and handedness for its shared contact', () => {
    assertContacts(demoFor('PA02', { ...DEFAULT_CONFIG, left: { height: 2, handed: -1 }, right: { height: 1.55, handed: 1 } }), { left: 2, right: 1.55 });
  });

  it.each([
    { name: 'short lefty versus tall righty', left: { height: 1.55, handed: -1 as const }, right: { height: 2, handed: 1 as const } },
    { name: 'tall righty versus short lefty', left: { height: 2, handed: 1 as const }, right: { height: 1.55, handed: -1 as const } },
    { name: 'two short lefties', left: { height: 1.55, handed: -1 as const }, right: { height: 1.55, handed: -1 as const } },
    { name: 'two tall lefties', left: { height: 2, handed: -1 as const }, right: { height: 2, handed: -1 as const } },
  ])('keeps all 20 parries physical for $name', ({ left, right }) => {
    for (let i = 1; i <= 20; i++) assertContacts(demoFor(`PA${String(i).padStart(2, '0')}`, { ...DEFAULT_CONFIG, left, right }), { left: left.height, right: right.height });
  });

  it('does not manufacture a contact beyond both arms and blades', () => {
    const far = runPhrase({ ...DEFAULT_CONFIG, leftX: -4, rightX: 4 }, [[{ blade: 'AT02' }, { blade: 'PA02' }]]);
    const a = far.frames[40];
    expect(contactFrames(a.left, a.right, makeRig(1.78), makeRig(1.78))).toBeNull();
    expect(far.events.some((e) => e.kind === 'parry' && e.success)).toBe(false);
  });
});

describe('circular parry final lines', () => {
  it.each(['PA11', 'PA12'])('%s cannot stop a high-out straight thrust', (id) => {
    expect(parryOutcome(getTechnique('AT02').sim, getTechnique(id).sim.parry!)).toBe('wrongLine');
  });

  it.each(['PA09', 'PA10', 'PA11', 'PA12'])('%s catches a straight thrust ending in its own line', (id) => {
    const lines = { PA09: 'high-out', PA10: 'high-in', PA11: 'low-in', PA12: 'low-out' } as const;
    expect(parryOutcome({ ...getTechnique('AT02').sim, finalLine: lines[id as keyof typeof lines] }, getTechnique(id).sim.parry!)).toBe('parried');
  });

  it('preserves disengage and double circular-deception rules', () => {
    expect(parryOutcome(getTechnique('AT03').sim, getTechnique('PA11').sim.parry!)).toBe('parried');
    expect(parryOutcome({ ...getTechnique('AT02').sim, evadeCircular: 1 }, getTechnique('PA09').sim.parry!)).toBe('evaded');
  });
});

describe('end-line penalties require both entire feet past the same end', () => {
  it('keeps the phrase alive when only the rear foot crosses', () => {
    const result = runPhrase({ ...DEFAULT_CONFIG, leftX: -6.9, rightX: -2.4 }, [[{ foot: 'FW01' }, {}]]);
    const sk = buildSkeleton(result.frames[52].left, makeRig(1.78));
    expect(sk.joints.heelR[0]).toBeLessThan(-7);
    expect(sk.joints.heelW[0]).toBeGreaterThan(-7);
    expect(bothFeetBeyondEnd(sk)).toBe(false);
    expect(result.events.some((e) => e.kind === 'endLine')).toBe(false);
    expect(result.verdict.penalty).toBeUndefined();
  });

  it.each([['left', -7.7, -2.4], ['right', 2.4, 7.7]] as const)('awards rule 11 when %s has both feet beyond its end', (side, leftX, rightX) => {
    const result = runPhrase({ ...DEFAULT_CONFIG, leftX, rightX }, [[{ foot: 'FW01' }, { foot: 'FW01' }]]);
    const event = result.events.find((e) => e.kind === 'endLine');
    expect(event).toMatchObject({ kind: 'endLine', side });
    expect(bothFeetBeyondEnd(buildSkeleton(result.frames[event!.t][side], makeRig(1.78)))).toBe(true);
    expect(result.verdict.penalty).toBe(true);
    expect(result.verdict.scorer).toBe(side === 'left' ? 'right' : 'left');
    expect(result.verdict.rule).toBe(11);
  });

  it('waits for the front toe, rather than just the front heel, to clear', () => {
    const result = runPhrase({ ...DEFAULT_CONFIG, leftX: -7.3, rightX: -2.4 }, [[{ foot: 'FW01' }, {}]]);
    const sk = buildSkeleton(result.frames[0].left, makeRig(1.78));
    expect(sk.joints.heelW[0]).toBeLessThan(-7);
    expect(sk.joints.toeW[0]).toBeGreaterThan(-7);
    expect(result.events.some((e) => e.kind === 'endLine')).toBe(false);
  });

  it('penalizes the first tick both feet clear during consecutive retreats', () => {
    const result = runPhrase({ ...DEFAULT_CONFIG, leftX: -6.5, rightX: -2.4 }, [[{ foot: 'FW03' }, {}], [{ foot: 'FW03' }, {}], [{ foot: 'FW03' }, {}]]);
    const event = result.events.find((e) => e.kind === 'endLine')!;
    expect(event.t).toBeGreaterThan(result.slices[1].end);
    expect(bothFeetBeyondEnd(buildSkeleton(result.frames[event.t - 1].left, makeRig(1.78)))).toBe(false);
    expect(bothFeetBeyondEnd(buildSkeleton(result.frames[event.t].left, makeRig(1.78)))).toBe(true);
    expect(result.verdict).toMatchObject({ scorer: 'right', penalty: true, rule: 11 });
  });
});
