import { describe, expect, it } from 'vitest';
import { getTechnique } from '../src/data/techniques';
import { buildPreview, buildSituation, isBuildSequenceCorrect, playBuildSequence } from '../src/modes/buildSequence';
import { counterScenario, versusFor } from '../src/modes/demo';
import type { PhraseConfig } from '../src/sim/phrase';

const cfg: PhraseConfig = { seed: 1, tempoSec: 0.3, left: { height: 1.78, handed: 1 }, right: { height: 1.78, handed: 1 } };

describe('Counter Explorer tactical setups', () => {
  it.each([
    ['FW04', 'PA01', 'high-in'],
    ['AT06', 'PA03', 'low-in'],
    ['AT06', 'PA04', 'low-out'],
    ['AT06', 'PA06', 'low-out'],
  ])('%s aims into the line closed by %s', (attack, counter, line) => {
    expect(counterScenario(attack, counter).slices[0][0].finalLine).toBe(line);
    const result = versusFor(attack, counter, cfg);
    expect(result.events.some((event) => event.kind === 'parry' && event.side === 'right' && event.success)).toBe(true);
    expect(result.slices.some((slice) => slice.note.includes('wrong line'))).toBe(false);
    expect(result.lights.green).toBe(true);
    expect(result.verdict.scorer).toBe('right');
  });

  it('keeps the real final line for an unlisted pairing', () => {
    const scenario = counterScenario('AT02', 'PA11');
    expect(scenario.slices[0][0].finalLine).toBeUndefined();
    const result = versusFor('AT02', 'PA11', cfg);
    expect(result.events.some((event) => event.kind === 'parry' && event.success)).toBe(false);
    expect(result.verdict.scorer).toBe('left');
  });

  it('earns the direct riposte against a short lunge with a prerequisite parry', () => {
    const result = versusFor('FW19', 'RR01', cfg);
    const parry = result.events.find((event) => event.kind === 'parry' && event.side === 'right' && event.success)!;
    const riposte = result.events.find((event) => event.kind === 'riposteStart' && event.side === 'right')!;
    expect(parry).toBeDefined();
    expect(riposte.t).toBeGreaterThan(parry.t);
    expect(result.tracks.filter((track) => track.kind === 'blade').map((track) => track.label)).toContain('Direct riposte');
    expect(result.verdict.scorer).toBe('right');
  });

  it('shows the parry, riposte, counter-parry, and counter-riposte chain at close measure', () => {
    const result = versusFor('RR01', 'RR08', cfg);
    expect(result.events.filter((event) => event.kind === 'parry' && event.success)).toHaveLength(2);
    expect(result.events.filter((event) => event.kind === 'riposteStart').map((event) => event.side)).toEqual(['left', 'right']);
    expect(result.verdict.scorer).toBe('right');
  });

  it('deceives a sixte parry in the line it actually leaves open', () => {
    const result = versusFor('PA02', 'AT03', cfg);
    expect(counterScenario('PA02', 'AT03').slices[0][1].finalLine).toBe('high-in');
    expect(result.slices[0].note).toContain('deceived');
    expect(result.verdict.scorer).toBe('right');
  });
});

describe('Build It ordered action sequences', () => {
  it('starts without revealing a finishing attack', () => {
    const preview = buildPreview(cfg);
    expect(preview.tracks).toHaveLength(0);
    expect(preview.registered).toHaveLength(0);
  });

  it.each(['PA01', 'PA02', 'PA03', 'PA04', 'PA09', 'PA10'])('plays a constructed preparation and finish against %s', (partnerId) => {
    const finisher = getTechnique(partnerId).counteredBy.find((link) => link.reliability === 'reliable' && getTechnique(link.id).category === 'attack')!.id;
    const situation = buildSituation(partnerId, finisher);
    const sequence = ['FW02', finisher];
    expect(situation.cards).toContain('FW02');
    expect(situation.cards).toContain(finisher);
    expect(isBuildSequenceCorrect(situation, sequence)).toBe(true);
    const result = playBuildSequence(situation, sequence, cfg);
    const advance = result.tracks.find((track) => track.side === 'left' && track.label === 'Advance')!;
    const finish = result.tracks.find((track) => track.side === 'left' && track.label === getTechnique(finisher).name)!;
    expect(finish.start).toBeGreaterThan(advance.end);
    expect(result.tracks.some((track) => track.side === 'right' && track.label === getTechnique(partnerId).name)).toBe(true);
    expect(result.verdict.scorer).toBe('left');
    expect(result.lights.red).toBe(true);
  });

  it('validates both the selected actions and their order', () => {
    const situation = buildSituation('PA02', 'AT03');
    expect(isBuildSequenceCorrect(situation, ['FW02', 'AT03'])).toBe(true);
    expect(isBuildSequenceCorrect(situation, ['AT03', 'FW02'])).toBe(false);
    expect(isBuildSequenceCorrect(situation, ['FW03', 'AT03'])).toBe(false);
    expect(isBuildSequenceCorrect(situation, ['FW02', 'AT02'])).toBe(false);
    expect(isBuildSequenceCorrect(situation, ['FW02'])).toBe(false);
    const straight = playBuildSequence(situation, ['FW02', 'AT02'], cfg);
    expect(straight.events.some((event) => event.kind === 'parry' && event.success && event.side === 'right')).toBe(true);
    expect(straight.tracks.some((track) => track.label === 'Straight thrust')).toBe(true);
    expect(straight.tracks.some((track) => track.label === 'Disengage')).toBe(false);
    expect(straight.verdict.scorer).toBe('right');
  });
});
