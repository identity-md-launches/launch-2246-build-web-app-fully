import type { Technique } from '../data/types';
import type { PhraseResult, RowEvent } from '../sim/types';

export interface StepCue { start: number; end: number; anchor: string }

/** Resolve coaching cues from authored phases/markers and the events of the entire demo.
 * A parry demo includes the incoming attack and a separate riposte slice: the riposte
 * instruction must wait for that real event, regardless of either slice's duration. */
export function executionCues(t: Technique, result: PhraseResult): StepCue[] {
  const T = result.tempoTicks;
  const event = (kind: RowEvent['kind'], last = false) => {
    const list = result.events.filter(e => e.kind === kind && 'side' in e && e.side === 'left' && (e.kind !== 'parry' || e.success));
    return (last ? list.at(-1) : list[0])?.t;
  };
  const phase = (name: string, end = false) => {
    const p = t.phases.find(p => p.name === name);
    return (end ? p?.end : p?.start) ?? 0;
  };
  const attackStart = event('attackStart') ?? result.tracks.find(track => track.side === 'left' && track.label === t.name)?.start ?? 0;
  const hit = event('hit', true) ?? Math.min(result.endTick, attackStart + phase('finish', true) * T);
  const parry = event('parry');
  const riposte = event('riposteStart', true);
  let starts: { t: number; anchor: string }[];
  if (t.sim.role === 'parry' && parry !== undefined) {
    if (t.sim.parry?.type === 'circular') {
      starts = [{ t: 0, anchor: 'preparation' }, { t: phase('execution') * T, anchor: 'execution' }, { t: parry, anchor: 'parry contact' }, { t: riposte ?? result.endTick, anchor: 'riposte start' }];
    } else if (t.steps.length === 3) {
      starts = [{ t: 0, anchor: 'preparation' }, { t: parry, anchor: 'parry contact' }, { t: riposte ?? result.endTick, anchor: 'riposte start' }];
    } else {
      starts = [{ t: 0, anchor: 'preparation' }, { t: Math.max(0, parry - T * 0.1), anchor: 'approach to contact' }, { t: parry, anchor: 'parry contact' }, { t: riposte ?? result.endTick, anchor: 'riposte start' }];
    }
  } else if (t.sim.role === 'riposte' && riposte !== undefined) {
    starts = t.sim.delay
      ? [{ t: 0, anchor: 'preparatory parry' }, { t: parry ?? 0, anchor: 'parry contact / wait' }, { t: riposte, anchor: 'riposte start' }]
      : [{ t: 0, anchor: 'preparatory parry' }, { t: riposte, anchor: 'riposte start' }, { t: Math.max(riposte, hit - T * 0.15), anchor: 'tip arrival' }];
  } else {
    // These phase boundaries are authored per technique, in tempo units. Rebase an
    // offensive action on its actual start rather than the preceding partner setup.
    const anchors = [
      { t: attackStart, anchor: 'preparation' },
      { t: attackStart + (t.syncMarkers.frontFootLift ?? phase('execution')) * T, anchor: t.syncMarkers.frontFootLift !== undefined ? 'frontFootLift' : 'execution' },
      { t: attackStart + phase('execution', true) * T, anchor: 'finish' },
      { t: hit, anchor: 'tip arrival' },
      { t: Math.max(attackStart + phase('recovery') * T, hit + T * 0.2), anchor: 'recovery' },
    ];
    starts = t.steps.map((_, i) => anchors[Math.round(i * (anchors.length - 1) / Math.max(1, t.steps.length - 1))]);
  }
  let previous = 0;
  const normalized = t.steps.map((_, i) => {
    const s = starts[i] ?? starts[starts.length - 1];
    previous = Math.max(previous, Math.min(result.endTick, Math.round(s.t)));
    return { start: previous, anchor: s.anchor };
  });
  return normalized.map((cue, i) => ({ ...cue, end: normalized[i + 1]?.start ?? result.endTick + 1 }));
}

export function activeExecutionStep(cues: StepCue[], tick: number): number {
  for (let i = cues.length - 1; i >= 0; i--) if (tick >= cues[i].start) return i;
  return 0;
}
