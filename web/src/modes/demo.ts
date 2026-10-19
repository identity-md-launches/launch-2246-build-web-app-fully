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

/** The setup is part of a counter link: a parry only works in its own line and a riposte needs a parry first. */
export interface CounterScenario {
  measure: ReturnType<typeof demoScript>['measure'];
  slices: [Choice, Choice][];
  context: string;
}

function actionChoice(t: Technique): Choice {
  return t.category === 'footwork' || t.sim.role === 'footwork' ? { foot: t.id } : { blade: t.id };
}
function parryForLine(line: TargetLine = 'high-out'): Choice {
  return { blade: line === 'high-in' ? 'PA01' : line === 'low-in' ? 'PA03' : line === 'low-out' ? 'PA04' : line === 'back' ? 'PA08' : 'PA02' };
}
function oppositeLine(line: TargetLine): TargetLine {
  return line === 'high-in' ? 'high-out' : line === 'high-out' ? 'high-in' : line === 'low-in' ? 'low-out' : 'low-in';
}

/** Authored tactical setup for the selected graph edge; arbitrary, unlisted pairs keep their actual lines. */
export function counterScenario(attackId: string, counterId: string): CounterScenario {
  const a = getTechnique(attackId);
  const c = getTechnique(counterId);
  const linked = a.counteredBy.some((link) => link.id === counterId);
  const atk: Choice = actionChoice(a);
  const ctr: Choice = { ...actionChoice(c), timing: c.sim.role === 'line' || c.sim.role === 'counter' || c.id === 'CT04' ? 'early' : 'onTime' };
  const script = demoScript(a);
  let measure = script.measure === 'far' ? 'lunge' : script.measure;
  const context: string[] = [];
  let slices: [Choice, Choice][] = [[atk, ctr]];

  // Match the incoming final to the line named by the counter, rather than aiming every lunge outside.
  if (linked && c.sim.parry && c.sim.parry.type !== 'ceding' && a.sim.finalLine && !a.sim.flick) {
    const endPosition = c.sim.parry.positions[c.sim.parry.positions.length - 1];
    atk.finalLine = POS_LINE[endPosition];
    context.push(`The incoming attack finishes ${atk.finalLine.replace('-', ' ')} so ${c.name} closes that line.`);
  }
  // A disengage must finish in the line the original lateral parry leaves open.
  if (linked && a.sim.parry && c.sim.changesLine && a.sim.parry.type !== 'circular') {
    const closedLine = POS_LINE[a.sim.parry.positions[a.sim.parry.positions.length - 1]];
    ctr.finalLine = a.sim.parry.type === 'semicircular' || a.sim.parry.type === 'diagonal' ? (closedLine.endsWith('in') ? 'high-out' : 'high-in') : oppositeLine(closedLine);
    context.push(`${a.name} commits to the original line; ${c.name} finishes in the opposite line.`);
  }
  if (linked && (a.id === 'FW15' || a.id === 'FW13' || a.id === 'AT18' || a.id === 'FW23') && c.sim.role === 'parry') {
    ctr.foot = 'FW03';
    context.push('The defender retreats while parrying the final movement.');
  }
  if (c.id === 'CT11') {
    ctr.foot = 'FW03';
    ctr.timing = 'early';
    context.push('The attack starts at the edge of its reach; the defender pulls distance immediately.');
  }
  if (a.sim.role === 'line' && c.sim.bladeOn && !c.sim.finalLine) {
    slices.push([{}, { blade: 'AT02' }]);
    context.push('The blade action first removes the established line; the defender then extends to finish.');
    measure = 'extend';
  }
  if ((a.sim.role === 'bladeAttack' && !a.sim.finalLine) || a.sim.role === 'bladePrep') measure = 'extend';

  // Build the prerequisite exchange, preserving the selected techniques in their actual tactical roles.
  if (c.id === 'RR08') {
    slices = [[{ blade: 'PA02' }, { blade: 'AT02' }], [atk, parryForLine(a.sim.finalLine)], [{}, ctr]];
    context.push('Red first parries and ripostes; green counter-parries that riposte before the counter-riposte.');
  } else if (c.sim.role === 'riposte') {
    if (a.sim.role === 'renewal') {
      slices = [[{ blade: 'AT02' }, { blade: 'PA02' }], [atk, ctr]];
      context.push('Green first parries the initial attack, then ripostes against the renewal.');
    } else if (a.id === 'CT06') {
      slices = [[{ blade: 'AT02' }, { blade: 'PA02' }], [{ ...atk, timing: 'late' }, ctr]];
      context.push('Green parries the first attack and varies the riposte timing against the anticipated counter-parry.');
    } else {
      slices = [[atk, parryForLine(a.sim.finalLine)], [{}, ctr]];
      context.push('Green must parry the incoming attack before the selected riposte can begin.');
    }
  } else if (a.sim.role === 'riposte') {
    slices = [[{ blade: 'PA02' }, { blade: 'AT02' }], [atk, ctr]];
    if (c.sim.role === 'parry') slices.push([{}, { blade: 'RR08' }]);
    context.push('Red first parries to earn the selected riposte; green answers that riposte.');
  } else if (a.sim.role === 'renewal') {
    slices = [[{ blade: 'AT02' }, { blade: 'PA02' }], [atk, ctr]];
    if (c.sim.role === 'parry') slices.push([{}, { blade: 'RR01' }]);
    context.push('The first red attack is parried, creating the situation for the selected renewal.');
  } else if (c.id === 'CT06' && a.sim.role === 'parry') {
    slices = [[atk, { blade: 'AT02', finalLine: POS_LINE[a.sim.parry!.positions[0]] }], [{ blade: 'RR01' }, ctr], [{}, { blade: 'RR08' }]];
    context.push('Green draws the red parry and riposte, then counter-parries the expected riposte.');
  } else if (c.sim.role === 'parry') {
    slices.push([{}, { blade: 'RR01' }]);
  }
  if (a.sim.role === 'riposte' || c.id === 'RR08' || (c.sim.role === 'riposte' && a.sim.role === 'parry') || (c.id === 'CT06' && a.sim.role === 'parry')) measure = 'extend';
  if (c.sim.role === 'line') context.push('Green establishes a straight point in line before the final attacking movement.');
  if (c.sim.role === 'counter') context.push('Green reacts early, during the incoming preparation or compound action.');
  if (!context.length) context.push(`The partner performs ${a.name}; green answers with ${c.name} at the appropriate measure.`);
  return { measure, slices, context: context.join(' ') };
}

/** Attack-versus-counter demo for the Counter Explorer: left performs X, right answers with the counter. */
export function versusFor(attackId: string, counterId: string, cfg: PhraseConfig): PhraseResult {
  const scenario = counterScenario(attackId, counterId);
  const measure = measureValue(scenario.measure, cfg.left.height);
  const result = runPhrase(configAtMeasure(cfg, measure), scenario.slices);
  result.captions[0] = { t: 0, text: scenario.context };
  return result;
}
