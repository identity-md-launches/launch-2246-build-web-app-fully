import { TECHNIQUE_BY_ID } from '../data/techniques';
import type { Reliability } from '../data/types';
import { bandFor } from '../rig/dimensions';
import type { PhraseSim } from '../sim/phrase';
import type { Rng } from '../sim/prng';
import { other, type Choice, type Side, type Timing } from '../sim/types';

export type NpcLevel = 'novice' | 'club' | 'expert' | 'adaptive';

export const NPC_PROFILE: Record<NpcLevel, { reaction: [number, number]; bite: number }> = {
  novice: { reaction: [0.3, 0.45], bite: 0.8 },
  club: { reaction: [0.22, 0.32], bite: 0.5 },
  expert: { reaction: [0.16, 0.24], bite: 0.25 },
  adaptive: { reaction: [0.16, 0.24], bite: 0.25 },
};
const REL_WEIGHT: Record<Reliability, number> = { reliable: 3, situational: 1.5, risky: 0.5 };

/** Frequency model of the user's last 20 choices per situation (used by Adaptive). */
export class OpponentModel {
  history: Record<string, string[]> = {};
  record(situation: string, c: Choice) {
    const key = c.blade ?? c.foot;
    if (!key) return;
    const h = (this.history[situation] ??= []);
    h.push(key);
    if (h.length > 20) h.shift();
  }
  likely(situation: string): string | undefined {
    const h = this.history[situation] ?? [];
    const counts = new Map<string, number>();
    for (const x of h) counts.set(x, (counts.get(x) ?? 0) + 1);
    let best: string | undefined;
    let n = 0;
    counts.forEach((v, k) => {
      if (v > n) {
        n = v;
        best = k;
      }
    });
    return best;
  }
}

function pick<T>(rng: Rng, xs: T[]): T {
  return xs[Math.floor(rng() * xs.length) % xs.length];
}
function weighted<T>(rng: Rng, xs: [T, number][]): T {
  const total = xs.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [x, w] of xs) {
    r -= w;
    if (r <= 0) return x;
  }
  return xs[xs.length - 1][0];
}

export function reactionTiming(level: NpcLevel, rng: Rng, tempoSec: number): { timing: Timing; reaction: number } {
  const [a, b] = NPC_PROFILE[level].reaction;
  const reaction = a + (b - a) * rng();
  const timing: Timing = reaction <= 0.2 * (tempoSec / 0.3) ? 'early' : reaction <= 0.33 * (tempoSec / 0.3) ? 'onTime' : 'late';
  return { timing, reaction };
}

export function situationKey(sim: PhraseSim, side: Side): string {
  const band = bandFor(sim.measure(side), sim.tracks[side].rig);
  return `${sim.state}|${band}`;
}

/** Choose the NPC's action for the next slice. All randomness comes from the seeded `rng`. */
export function npcChoose(sim: PhraseSim, side: Side, level: NpcLevel, rng: Rng, model: OpponentModel, tempoSec: number): Choice {
  const legal = sim.legal(side);
  const opp = other(side);
  const { timing } = reactionTiming(level, rng, tempoSec);
  const band = bandFor(sim.measure(side), sim.tracks[side].rig);
  const blade = new Set(legal.blade);
  const has = (id: string) => blade.has(id);
  const parrier = sim.lastParry?.side === side && (sim.state === 'PARRY_CONTACT' || sim.state === 'COUNTER_RIPOSTE');
  const ownFailed = sim.lastAttacker === side && (sim.state === 'PARRY_CONTACT' || sim.state === 'COUNTER_RIPOSTE');

  if (level === 'novice') {
    if (parrier) return { blade: pick(rng, legal.blade.filter((id) => id.startsWith('RR'))), timing };
    if (band === 'Out of distance') return { foot: pick(rng, ['FW02', 'FW02', 'FW09', 'FW03', 'FW22']), timing };
    const r = rng();
    if (r < 0.4) return { blade: pick(rng, legal.blade), timing };
    if (r < 0.7) return { foot: pick(rng, legal.foot), timing };
    return { foot: 'FW02', blade: pick(rng, legal.blade.filter((id) => id.startsWith('AT') || id.startsWith('PA'))), timing };
  }

  if (parrier) {
    const options: [string, number][] = [
      ['RR01', 4],
      ['RR02', level === 'club' ? 1 : 2],
      ['RR04', level === 'club' ? 0.5 : 1],
    ];
    return { blade: weighted(rng, options.filter(([id]) => has(id))), timing: level === 'club' ? 'onTime' : 'early' };
  }
  if (ownFailed) {
    const r = rng();
    if (r < 0.45 && has('PA02')) return { blade: 'PA02', timing };
    if (r < 0.75 && has('RR09')) return { blade: 'RR09', timing: 'early' };
    return { foot: 'FW03', timing };
  }

  // Predict the opponent's next action: Expert reads the last action in this situation, Adaptive uses the frequency model.
  const sit = situationKey(sim, opp);
  const predicted = level === 'adaptive' ? model.likely(sit) : level === 'expert' ? model.history[sit]?.slice(-1)[0] : undefined;

  if (band === 'Out of distance') {
    if ((level === 'adaptive' || level === 'expert') && rng() < 0.25) return { foot: 'FW22', timing };
    if (level === 'adaptive' && rng() < 0.15) return { blade: 'CT07', timing };
    return { foot: rng() < 0.75 ? 'FW02' : 'FW07', timing };
  }

  if (predicted && TECHNIQUE_BY_ID[predicted]) {
    const counters = TECHNIQUE_BY_ID[predicted].counteredBy.filter((c) => has(c.id) || legal.foot.includes(c.id));
    if (counters.length) {
      const c = weighted(
        rng,
        counters.map((x) => [x.id, REL_WEIGHT[x.reliability]] as [string, number]),
      );
      const isFoot = c.startsWith('FW') || c === 'CT11';
      // Second intention / bait: the adaptive NPC sometimes makes a false attack instead.
      if (level === 'adaptive' && rng() < 0.12 && has('AT17')) return { blade: 'AT17', timing };
      return isFoot ? { foot: c === 'CT11' ? 'FW03' : c, timing } : { blade: c, timing };
    }
  }

  // Club (or no prediction): weight a defensive or offensive choice by counter reliability against common attacks.
  const r = rng();
  const bite = rng() < NPC_PROFILE[level].bite;
  if (r < 0.4) {
    const attacks = ['AT02', 'AT03', 'AT06', 'AT10', 'BL06', 'AT07'].filter(has);
    return { blade: pick(rng, attacks), foot: band === 'Advance-Lunge' ? 'FW13' : undefined, timing };
  }
  if (r < 0.75) {
    // Biting on feints means a lateral parry; otherwise circular or a stop hit.
    const parries = bite ? ['PA02', 'PA01', 'PA04'] : ['PA09', 'PA10', 'PA19'];
    return { blade: pick(rng, parries.filter(has)), timing };
  }
  if (r < 0.88 && has('CT01')) return { blade: level === 'club' ? 'CT01' : pick(rng, ['CT01', 'CT02']), timing };
  return { foot: pick(rng, ['FW03', 'FW08', 'FW25']), timing };
}
