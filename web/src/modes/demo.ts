import { getTechnique } from '../data/techniques';
import type { Position, TargetLine, Technique } from '../data/types';
import { makeRig } from '../rig/dimensions';
import { configAtMeasure, runPhrase, type PhraseConfig } from '../sim/phrase';
import type { Choice, PhraseResult } from '../sim/types';
import type { Settings } from '../store/settings';

const POS_LINE: Record<Position, TargetLine> = {
  quarte: 'high-in',
  sixte: 'high-out',
  septime: 'low-in',
  octave: 'low-out',
  prime: 'high-in',
  seconde: 'low-out',
  tierce: 'high-out',
  quinte: 'high-in',
  quinteHigh: 'back',
};

export function baseConfig(s: Pick<Settings, 'tempoSec' | 'heightLeft' | 'heightRight' | 'handedLeft' | 'handedRight'>, seed = 7): PhraseConfig {
  return { seed, tempoSec: s.tempoSec, left: { height: s.heightLeft, handed: s.handedLeft }, right: { height: s.heightRight, handed: s.handedRight } };
}

/** The demonstrator (left, red) performs the technique; the partner (right, green) shows its purpose. */
export function demoScript(t: Technique): { measure: 'extend' | 'lunge' | 'advLunge' | 'fleche' | 'far' | 'short'; slices: [Choice, Choice][] } {
  const r = t.sim.role;
  const id = t.id;
  if (r === 'stance') return { measure: 'far', slices: [[{ foot: 'FW01' }, {}]] };
  if (r === 'footwork') {
    if (id === 'CT11') return { measure: 'lunge', slices: [[{ foot: 'FW03', timing: 'onTime' }, { blade: 'AT02' }]] };
    return { measure: 'far', slices: [[{ foot: id }, {}]] };
  }
  if (r === 'attack' && t.category === 'footwork') {
    return { measure: t.sim.reach === 'fleche' ? 'fleche' : t.sim.reach === 'advLunge' ? 'advLunge' : t.sim.reach === 'shortLunge' ? 'short' : 'lunge', slices: [[{ foot: id }, {}]] };
  }
  if (r === 'attack' || r === 'bladeAttack') {
    if (id === 'CT04') return { measure: 'lunge', slices: [[{ blade: id, timing: 'late' }, { foot: 'FW02', timing: 'early' }]] };
    const partner: Choice = t.sim.bladeOn && t.sim.finalLine ? { blade: 'CT03', timing: 'early' } : {};
    const m = t.sim.flick ? 'short' : t.sim.reach === 'advLunge' ? 'advLunge' : t.sim.reach === 'extend' ? 'extend' : 'lunge';
    return { measure: m, slices: [[{ blade: id }, partner]] };
  }
  if (r === 'parry') {
    const p = t.sim.parry!;
    let partner: Choice = { blade: 'AT02', finalLine: POS_LINE[p.positions[0]] };
    if (p.type === 'circular') partner = { blade: 'AT03', finalLine: POS_LINE[p.positions[0]] };
    if (p.type === 'semicircular' || p.type === 'diagonal') partner = { blade: 'AT14', finalLine: POS_LINE[p.positions[0]] };
    if (p.type === 'ceding') partner = { blade: 'BL11' };
    if (p.type === 'successive') partner = { blade: 'AT10', finalLine: 'high-out' };
    if (p.positions[0] === 'quinteHigh' || id === 'PA05') partner = { blade: 'AT07' };
    if (id === 'CT05') return { measure: 'lunge', slices: [[{ blade: id }, { blade: 'CT01', timing: 'early' }], [{ blade: 'RR01' }, {}]] };
    if (id === 'CT06') return { measure: 'lunge', slices: [[{ foot: 'FW07', blade: id }, { blade: 'CT04' }], [{ blade: 'RR01' }, {}]] };
    return { measure: partner.blade === 'AT07' ? 'short' : 'lunge', slices: [[{ blade: id }, partner], [{ blade: 'RR01' }, {}]] };
  }
  if (r === 'riposte') {
    if (id === 'RR08') return { measure: 'lunge', slices: [[{ blade: 'AT02' }, { blade: 'PA02' }], [{ blade: 'PA02' }, { blade: 'RR01' }], [{ blade: id }, {}]] };
    return { measure: 'lunge', slices: [[{ blade: 'PA02' }, { blade: 'AT02' }], [{ blade: id }, {}]] };
  }
  if (r === 'renewal') return { measure: 'lunge', slices: [[{ blade: 'AT02' }, { blade: 'PA02' }], [{ blade: id }, { blade: 'RR05' }]] };
  if (r === 'counter') {
    const atk: Choice =
      id === 'CT01' ? { blade: 'AT11' } : id === 'CT08' ? { blade: 'AT02', finalLine: 'high-in' } : id === 'CT12' ? { blade: 'AT01' } : { blade: 'AT02' };
    return { measure: id === 'CT12' ? 'extend' : 'lunge', slices: [[{ blade: id, timing: id === 'CT01' ? 'early' : 'onTime' }, atk]] };
  }
  if (r === 'line') return { measure: 'lunge', slices: [[{ blade: id, timing: 'early' }, { blade: 'AT02' }]] };
  if (r === 'derobe') return { measure: 'lunge', slices: [[{ blade: id, timing: 'early' }, { blade: 'BL06' }]] };
  if (id === 'CT07') return { measure: 'lunge', slices: [[{ blade: id }, {}], [{ blade: 'PA02' }, { blade: 'AT02' }], [{ blade: 'RR01' }, {}]] };
  return { measure: 'lunge', slices: [[{ blade: id }, {}]] };
}

export function measureValue(kind: ReturnType<typeof demoScript>['measure'], height: number): number {
  const rig = makeRig(height);
  switch (kind) {
    case 'extend':
      return rig.reachExtend - 0.25;
    case 'short':
      return rig.reachShortLunge - 0.3;
    case 'lunge':
      return rig.reachLunge - 0.2;
    case 'advLunge':
      return rig.reachAdvLunge - 0.2;
    case 'fleche':
      return rig.reachFleche - 0.25;
    default:
      return 3.4;
  }
}

const cache = new Map<string, PhraseResult>();
export function demoFor(id: string, cfg: PhraseConfig): PhraseResult {
  const key = `${id}|${JSON.stringify(cfg)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = getTechnique(id);
  const script = demoScript(t);
  const res = runPhrase(configAtMeasure(cfg, measureValue(script.measure, cfg.left.height)), script.slices);
  if (cache.size > 40) cache.clear();
  cache.set(key, res);
  return res;
}

/** Attack-versus-counter demo for the Counter Explorer: left performs X, right answers with the counter. */
export function versusFor(attackId: string, counterId: string, cfg: PhraseConfig): PhraseResult {
  const a = getTechnique(attackId);
  const c = getTechnique(counterId);
  const atkChoice: Choice = a.category === 'footwork' ? { foot: attackId } : { blade: attackId };
  const ctrChoice: Choice = c.category === 'footwork' ? { foot: counterId } : { blade: counterId, timing: c.sim.role === 'line' || c.sim.role === 'counter' ? 'early' : 'onTime' };
  const script = demoScript(a);
  const slices: [Choice, Choice][] = [[atkChoice, ctrChoice]];
  if (c.sim.role === 'parry') slices.push([{}, { blade: 'RR01' }]);
  return runPhrase(configAtMeasure(cfg, measureValue(script.measure === 'far' ? 'lunge' : script.measure, cfg.left.height)), slices);
}
