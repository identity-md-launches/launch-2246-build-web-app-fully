/** Anthropometric proportions (fractions of stature) used to build the procedural fencer. */
export const RATIOS = {
  shoulderHeight: 0.818,
  hipHeight: 0.53,
  thigh: 0.245,
  shin: 0.246,
  ankleHeight: 0.039,
  footLength: 0.152,
  upperArm: 0.186,
  forearm: 0.146,
  handToGrip: 0.054,
  shoulderHalf: 0.115,
  hipHalf: 0.06,
  neck: 0.052,
  headRadius: 0.065,
  chestDepthHalf: 0.068,
  chestWidthHalf: 0.095,
};

export const BLADE_LENGTH = 0.9;
export const GUARD_DIAMETER = 0.1;
export const WEAPON_LENGTH = 1.1;
export const TIP_RADIUS = 0.0035;
export const DEFAULT_HEIGHT = 1.78;

export interface RigDims {
  height: number;
  scale: number;
  shoulderHeight: number;
  hipHeight: number;
  thigh: number;
  shin: number;
  ankleHeight: number;
  footLength: number;
  upperArm: number;
  forearm: number;
  handToGrip: number;
  shoulderHalf: number;
  hipHalf: number;
  neck: number;
  headRadius: number;
  chestDepthHalf: number;
  chestWidthHalf: number;
  legLength: number;
  armLength: number;
  reachExtend: number;
  reachShortLunge: number;
  reachLunge: number;
  reachAdvLunge: number;
  reachFleche: number;
  lungeLength: number;
  lungeGain: number;
  stepLength: number;
}

/** Derive every length (and therefore every reach) from stature. Nothing is hard-coded per fencer. */
export function makeRig(height = DEFAULT_HEIGHT): RigDims {
  const h = Math.min(2.0, Math.max(1.55, height));
  const r = (k: keyof typeof RATIOS) => RATIOS[k] * h;
  const thigh = r('thigh');
  const shin = r('shin');
  const legLength = thigh + shin + r('ankleHeight');
  const armLength = r('upperArm') + r('forearm') + r('handToGrip');
  const reachExtend = armLength + BLADE_LENGTH + 0.03;
  // Feet spread in a full lunge (1.0–1.3 × leg length) and the forward gain of the front shoulder it
  // produces once the rear leg is straight and the front shin is vertical (solved for the default rig).
  const lungeLength = 1.2 * legLength;
  const lungeGain = 0.58 * legLength;
  const stepLength = 0.42 * legLength;
  return {
    height: h,
    scale: h / DEFAULT_HEIGHT,
    shoulderHeight: r('shoulderHeight'),
    hipHeight: r('hipHeight'),
    thigh,
    shin,
    ankleHeight: r('ankleHeight'),
    footLength: r('footLength'),
    upperArm: r('upperArm'),
    forearm: r('forearm'),
    handToGrip: r('handToGrip'),
    shoulderHalf: r('shoulderHalf'),
    hipHalf: r('hipHalf'),
    neck: r('neck'),
    headRadius: r('headRadius'),
    chestDepthHalf: r('chestDepthHalf'),
    chestWidthHalf: r('chestWidthHalf'),
    legLength,
    armLength,
    reachExtend,
    reachShortLunge: reachExtend + 0.3 * legLength,
    reachLunge: reachExtend + lungeGain,
    reachAdvLunge: reachExtend + lungeGain + stepLength,
    reachFleche: reachExtend + 1.3 * legLength,
    lungeLength,
    lungeGain,
    stepLength,
  };
}

export type Band = 'Close' | 'Lunge' | 'Advance-Lunge' | 'Out of distance';

export function bandFor(measure: number, rig: RigDims): Band {
  if (measure <= rig.reachExtend) return 'Close';
  if (measure <= rig.reachLunge) return 'Lunge';
  if (measure <= rig.reachAdvLunge) return 'Advance-Lunge';
  return 'Out of distance';
}
