import { FOOTWORK_CLIPS } from '../anim/clips';
import { getTechnique } from '../data/techniques';
import type { TargetLine } from '../data/types';
import { makeRig } from '../rig/dimensions';
import { configAtMeasure, runPhrase, type PhraseConfig } from '../sim/phrase';
import type { Choice, PhraseResult } from '../sim/types';
import { measureValue } from './demo';

export interface BuildSituation {
  partnerId: string;
  finishIds: string[];
  cards: string[];
}

/** A partner who waits at the edge of measure and commits to one known parry. */
export function buildSituation(partnerId: string, finishId: string): BuildSituation {
  const partner = getTechnique(partnerId);
  const finishIds = partner.counteredBy.filter((link) => link.reliability === 'reliable' && getTechnique(link.id).category === 'attack').map((link) => link.id);
  const otherDeception = partner.sim.parry?.type === 'circular' ? 'AT03' : 'AT05';
  return { partnerId, finishIds, cards: ['FW02', 'FW03', 'FW01', finishId, 'AT02', otherDeception] };
}

function startingConfig(cfg: PhraseConfig): PhraseConfig {
  const advance = FOOTWORK_CLIPS.advance.keys.at(-1)!.pose.pelvisX * makeRig(cfg.left.height).scale;
  return configAtMeasure(cfg, measureValue('lunge', cfg.left.height) + advance);
}

export function buildPreview(cfg: PhraseConfig): PhraseResult {
  return runPhrase(startingConfig(cfg), [[{}, {}]]);
}

const POSITION_LINE: Record<string, TargetLine> = { quarte: 'high-in', sixte: 'high-out', septime: 'low-in', octave: 'low-out' };

/** Play the visitor's cards in their chosen order, including the preparation and the described partner. */
export function playBuildSequence(situation: BuildSituation, ids: string[], cfg: PhraseConfig): PhraseResult {
  const partner = getTechnique(situation.partnerId);
  const line = POSITION_LINE[partner.sim.parry!.positions.at(-1)!] ?? 'high-out';
  const opposite: TargetLine = line.endsWith('in') ? (line.startsWith('high') ? 'high-out' : 'low-out') : (line.startsWith('high') ? 'high-in' : 'low-in');
  const slices: [Choice, Choice][] = ids.map((id) => {
    const t = getTechnique(id);
    if (t.category === 'footwork') return [{ foot: id }, {}];
    // A line-changing finish goes around the original parry; a straight thrust stays in its line.
    const finalLine = t.sim.changesLine ? opposite : line;
    return [{ blade: id, finalLine }, { blade: situation.partnerId }];
  });
  // If the constructed attack is caught, show the consequence rather than hiding the partner's riposte.
  slices.push([{}, { blade: 'RR01' }]);
  const result = runPhrase(startingConfig(cfg), slices);
  result.captions[0] = { t: 0, text: `Your ordered sequence: ${ids.map((id) => getTechnique(id).name).join(', then ')}. The partner waits, then uses ${partner.name} against the finish.` };
  return result;
}

export function isBuildSequenceCorrect(situation: BuildSituation, ids: string[]): boolean {
  return ids.length === 2 && ids[0] === 'FW02' && situation.finishIds.includes(ids[1]);
}
