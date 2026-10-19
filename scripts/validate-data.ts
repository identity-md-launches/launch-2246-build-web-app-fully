import assert from 'node:assert/strict';
import { FOOTWORK_CLIPS, makeBladeClip, sampleLower, sampleUpper } from '../web/src/anim/clips';
import { EN_GARDE_LOWER, SIXTE_GUARD } from '../web/src/anim/poses';
import { TECHNIQUES, TECHNIQUE_BY_ID } from '../web/src/data/techniques';
import { makeRig } from '../web/src/rig/dimensions';
import { withinLimit } from '../web/src/rig/limits';
import { buildSkeleton, type FencerFrame } from '../web/src/rig/skeleton';

export function validateData() {
  const expected = Object.entries({ FW: 25, PA: 20, AT: 18, BL: 14, RR: 11, CT: 12 })
    .flatMap(([prefix, count]) => Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`));
  assert.equal(TECHNIQUES.length, 100);
  assert.deepEqual(TECHNIQUES.map(t => t.id).sort(), expected.sort());
  let samples = 0;
  for (const t of TECHNIQUES) {
    assert.ok(t.steps.length >= 3 && t.steps.length <= 7, `${t.id}: execution steps`);
    assert.ok(t.commonErrors.length >= 3 && t.commonErrors.length <= 5, `${t.id}: common errors`);
    assert.ok(t.phases.length && (t.footworkClip || t.bladeClip), `${t.id}: phases/clips`);
    for (const field of ['name', 'french', 'description', 'whenToUse', 'tacticalNotes', 'rowNotes'] as const) assert.ok(t[field].trim(), `${t.id}: ${field}`);
    for (const id of [...t.prerequisites, t.demoScenario.partner]) assert.ok(TECHNIQUE_BY_ID[id], `${t.id}: unknown ${id}`);
    for (const c of t.counteredBy) {
      const reverse = TECHNIQUE_BY_ID[c.id]?.counters.find(x => x.id === t.id);
      assert.ok(reverse && reverse.reliability === c.reliability && reverse.why === c.why, `${t.id}: reciprocal counter ${c.id}`);
    }
    for (const c of t.counters) assert.ok(TECHNIQUE_BY_ID[c.id]?.counteredBy.some(x => x.id === t.id), `${t.id}: reciprocal counters`);
    if (['attack', 'bladeAttack'].includes(t.sim.role) && t.footworkClip && /lunge|fleche|balestra|patinando/i.test(t.footworkClip)) {
      assert.ok(t.syncMarkers.armExtendStart < t.syncMarkers.frontFootLift, `${t.id}: arm before foot`);
    }
    const lower = t.footworkClip ? FOOTWORK_CLIPS[t.footworkClip] : null;
    if (t.footworkClip) assert.ok(lower, `${t.id}: lower clip`);
    const upper = makeBladeClip(t.bladeClip ?? t.id, t.sim);
    for (let i = 0; i < 60; i++) {
      const f: FencerFrame = { rootX: 0, facing: 1, handed: 1, lower: lower ? sampleLower(lower, lower.duration * i / 59) : EN_GARDE_LOWER, upper: upper ? sampleUpper(upper, upper.duration * i / 59) : SIXTE_GUARD, bend: 0, bendDir: [0, 1, 0], whip: 0 };
      const sk = buildSkeleton(f, makeRig());
      assert.ok(withinLimit('kneeFlex', sk.frontKneeFlex) && withinLimit('kneeFlex', sk.rearKneeFlex), `${t.id}: knee limits at ${i}`);
      assert.ok(withinLimit('elbowFlex', sk.elbowFlex) && withinLimit('forearmTwist', f.upper.pron), `${t.id}: weapon arm limits at ${i}`);
      for (const p of [...Object.values(sk.joints), ...sk.blade]) assert.ok(p.every(Number.isFinite), `${t.id}: finite pose`);
      samples++;
    }
  }
  return { techniques: TECHNIQUES.length, samples };
}

const summary = validateData();
console.log(`Validated ${summary.techniques} canonical techniques, reciprocal counters, content, clips, arm-first markers and ${summary.samples} sampled poses (knees, weapon elbow and forearm twist).`);
