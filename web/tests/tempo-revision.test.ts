import { describe, expect, it } from 'vitest';
import { NPC_PROFILE, type NpcLevel } from '../src/ai/npc';
import { DEFAULT_CONFIG, configAtMeasure } from '../src/sim/phrase';
import { TempoSession, TempoSim, replayTempo } from '../src/sim/tempo';
import { LOCKOUT_TICKS, TICK_HZ } from '../src/sim/types';
import { buildSkeleton } from '../src/rig/skeleton';
import { makeRig } from '../src/rig/dimensions';
import { pointToBlade } from '../src/sim/geometry';

describe('Tempo revision: timestamped live actions', () => {
  it('accepts retreat and blade input during an unfinished advance without moving the clock to its end', () => {
    const sim = new TempoSim(DEFAULT_CONFIG);
    expect(sim.input('left', { foot: 'FW02' })).toBe(true);
    sim.advanceTo(6);
    const before = sim.frames[6].left.lower;
    expect(sim.input('left', { blade: 'PA01' })).toBe(true);
    expect(sim.tick).toBe(6);
    expect(sim.frames[6].left.lower).toEqual(before);
    sim.advanceTo(12);
    expect(sim.frames[12].left.lower.pelvisX).toBeGreaterThan(before.pelvisX);
    expect(sim.input('left', { foot: 'FW03' })).toBe(true);
    expect(sim.actions.map((a) => [a.tick, a.choice.foot ?? a.choice.blade])).toEqual([[0, 'FW02'], [6, 'PA01'], [12, 'FW03']]);
    const [advance, parry, retreat] = sim.tracks;
    expect(advance.end).toBeGreaterThan(parry.start);
    expect(parry.end).toBeGreaterThan(retreat.start);
    expect(retreat.start).toBe(12);
  });

  it('does not teleport either layer when an action interrupts its own channel', () => {
    const sim = new TempoSim(DEFAULT_CONFIG);
    sim.input('left', { foot: 'FW02', blade: 'PA02' });
    sim.advanceTo(9);
    const before = sim.frames[9].left;
    sim.input('left', { foot: 'FW03', blade: 'PA01' });
    expect(sim.frames[9].left.lower).toEqual(before.lower);
    expect(sim.frames[9].left.upper).toEqual(before.upper);
  });

  it.each<NpcLevel>(['novice', 'club', 'expert', 'adaptive'])('%s starts its NPC response at its actual sampled reaction tick', (level) => {
    const session = new TempoSession(DEFAULT_CONFIG, level);
    session.input('left', { foot: 'FW02' }, 7);
    const due = session.nextReactionTick!;
    const [min, max] = NPC_PROFILE[level].reaction;
    expect(due - 7).toBeGreaterThanOrEqual(Math.ceil(min * TICK_HZ));
    expect(due - 7).toBeLessThanOrEqual(Math.ceil(max * TICK_HZ));
    session.advanceTo(due - 1);
    expect(session.sim.actions.filter((a) => a.side === 'right')).toHaveLength(0);
    session.advanceTo(due);
    expect(session.sim.actions.filter((a) => a.side === 'right').map((a) => a.tick)).toEqual([due]);
  });

  it('keeps the first real reaction deadline when another input arrives while the NPC is thinking', () => {
    const session = new TempoSession(DEFAULT_CONFIG, 'club');
    session.input('left', { foot: 'FW02' }, 0);
    const due = session.nextReactionTick;
    session.input('left', { blade: 'PA01' }, 6);
    expect(session.nextReactionTick).toBe(due);
    expect(session.sim.actions.map((a) => a.tick)).toEqual([0, 6]);
  });

  it('respects Human: neither creates an NPC action nor prevents the second person acting during movement', () => {
    const session = new TempoSession(DEFAULT_CONFIG, 'human');
    session.input('left', { foot: 'FW02' }, 0);
    session.input('right', { blade: 'PA02' }, 6);
    session.advanceTo(100);
    expect(session.nextReactionTick).toBeNull();
    expect(session.sim.actions.map((a) => [a.side, a.tick])).toEqual([['left', 0], ['right', 6]]);
  });

  it('a parry pressed after an attack starts can intercept it at physical blade contact', () => {
    const cfg = configAtMeasure(DEFAULT_CONFIG, makeRig(1.78).reachLunge * 0.9);
    const sim = new TempoSim(cfg);
    expect(sim.legal('right').blade).not.toContain('RR01');
    sim.input('left', { foot: 'FW04', blade: 'AT02' });
    sim.advanceTo(7);
    sim.input('right', { blade: 'PA02' });
    sim.advanceTo(48);
    const parry = sim.events.find((e) => e.kind === 'parry' && e.success);
    expect(parry).toBeDefined();
    if (parry?.kind !== 'parry' || !parry.point) throw new Error('No verified shared contact');
    const frame = sim.frames[parry.t];
    for (const side of ['left', 'right'] as const) {
      const sk = buildSkeleton(frame[side], sim.rigs[side]);
      expect(sk.armReached).toBe(true);
      expect(pointToBlade(parry.point, sk.blade)).toBeLessThan(0.001);
    }
    expect(sim.registered).toHaveLength(0);
    expect(sim.legal('right').blade).toContain('RR01');
  });

  it('registers actual target contact and ends only after the 300 ms lockout, with referee/lamps in agreement', () => {
    const sim = new TempoSim(configAtMeasure(DEFAULT_CONFIG, makeRig(1.78).reachLunge * 0.9));
    sim.input('left', { foot: 'FW04', blade: 'AT02' });
    sim.advanceTo(50);
    expect(sim.registered).toHaveLength(1);
    expect(sim.ended).toBe(false);
    const at = sim.lockoutStart!;
    sim.advanceTo(at + LOCKOUT_TICKS);
    expect(sim.ended).toBe(true);
    const result = sim.result();
    expect(result.lights.red).toBe(true);
    expect(result.lights.green).toBe(false);
    expect(result.verdict.scorer).toBe('left');
    expect(result.events.filter((e) => e.kind === 'hit').map((e) => e.t)).toEqual(result.registered.map((h) => h.tick));
  });

  it('replays timestamped overlapping human actions deterministically', () => {
    const session = new TempoSession(DEFAULT_CONFIG, 'human');
    session.input('left', { foot: 'FW02' }, 0);
    session.input('left', { blade: 'PA02' }, 8);
    session.input('right', { foot: 'FW03' }, 13);
    session.advanceTo(60);
    session.sim.halt();
    const replay = replayTempo(DEFAULT_CONFIG, session.sim.actions, session.sim.tick);
    expect(replay.hash).toBe(session.sim.result().hash);
    expect(replay.frames).toEqual(session.sim.frames);
  });
});
