import type { Position } from '../data/types';
import type { V3 } from '../rig/vec';
import { makeRig } from '../rig/dimensions';
import { twoBoneIk } from '../rig/ik';

/**
 * Pose parameters are authored for a 1.78 m right-hander in a local frame where +x points at the
 * opponent, +y is up and +z is the weapon-side outside (sixte side). Lengths scale with stature and
 * z mirrors for left-handers.
 */
export interface LowerPose {
  /** Pelvis offset along the piste from the clip origin. */
  pelvisX: number;
  /** How far the pelvis sits below standing hip height. */
  pelvisDrop: number;
  /** Forward torso lean in degrees. */
  lean: number;
  /** Heel positions along the piste and their lift off the floor. */
  frontX: number;
  frontLift: number;
  /** Toe pitch of the front foot in degrees (positive = toe up). */
  frontPitch: number;
  rearX: number;
  rearLift: number;
  /** -1 dropped along the rear leg, 0 relaxed, 1 classical raised. */
  rearArm: number;
  /** Lateral body shift in metres (+ = toward weapon side), used by inquartata. */
  sideShift: number;
}

export interface UpperPose {
  /** Wrist position relative to the weapon shoulder. */
  hand: V3;
  /** Blade direction. */
  tip: V3;
  /** Forearm twist: 0 supinated, 90 half-supinated, 180 pronated. */
  pron: number;
}

export const EN_GARDE_LOWER: LowerPose = {
  pelvisX: 0,
  pelvisDrop: 0.13,
  lean: 3,
  frontX: 0.25,
  frontLift: 0,
  frontPitch: 0,
  rearX: -0.22,
  rearLift: 0,
  rearArm: 0,
  sideShift: 0,
};

/** Sixte guard: hand a little outside, half-supinated, tip at the opponent's upper chest. */
export const SIXTE_GUARD: UpperPose = { hand: [0.3, -0.22, 0.06], tip: [1, 0.12, -0.04], pron: 90 };

/**
 * Positions and parries. Lateral parries move the hand 10–15 cm; the point travels further than the
 * hand. Values are offsets from the weapon shoulder.
 */
export const POSITIONS: Record<Position, UpperPose> = {
  quarte: { hand: [0.3, -0.2, -0.07], tip: [1, 0.38, -0.12], pron: 0 },
  sixte: { hand: [0.3, -0.2, 0.08], tip: [1, 0.38, 0.12], pron: 90 },
  septime: { hand: [0.31, -0.23, -0.05], tip: [1, -0.55, -0.14], pron: 0 },
  octave: { hand: [0.31, -0.25, 0.08], tip: [1, -0.55, 0.16], pron: 0 },
  prime: { hand: [0.22, 0.02, -0.14], tip: [0.55, -0.8, -0.12], pron: 180 },
  seconde: { hand: [0.32, -0.27, 0.1], tip: [1, -0.6, 0.18], pron: 180 },
  tierce: { hand: [0.3, -0.18, 0.1], tip: [1, 0.42, 0.14], pron: 180 },
  quinte: { hand: [0.28, -0.3, -0.12], tip: [1, 0.55, -0.2], pron: 180 },
  quinteHigh: { hand: [0.2, 0.26, -0.02], tip: [0.25, 0.08, -1], pron: 180 },
};

/** Arm extensions toward each quadrant. The final frames are replaced by IK onto the real target. */
export const EXTENSIONS: Record<string, UpperPose> = {
  'high-in': { hand: [0.52, -0.06, -0.03], tip: [1, -0.04, -0.06], pron: 60 },
  'high-out': { hand: [0.52, -0.06, 0.05], tip: [1, -0.04, 0.02], pron: 90 },
  'low-in': { hand: [0.5, -0.14, -0.03], tip: [1, -0.2, -0.05], pron: 30 },
  'low-out': { hand: [0.5, -0.14, 0.05], tip: [1, -0.2, 0.05], pron: 120 },
  back: { hand: [0.4, 0.1, 0.02], tip: [0.6, -0.78, 0], pron: 150 },
  flickWind: { hand: [0.38, 0.06, 0.04], tip: [0.35, 0.92, 0.05], pron: 150 },
  feintHigh: { hand: [0.44, -0.12, 0.02], tip: [1, 0.05, -0.02], pron: 90 },
  feintLow: { hand: [0.42, -0.18, 0.02], tip: [1, -0.25, 0], pron: 60 },
  lift: { hand: [0.34, -0.06, 0.02], tip: [0.5, 0.86, -0.02], pron: 90 },
};

/** Solve the authored 1.78 m pose against the same hip offsets and leg IK as the rig.
 * Rear ankle stays planted; a nearly straight rear chain fixes pelvis height. Find the
 * forward pelvis position that puts the front knee vertically above its ankle. */
function lungePelvis(): Pick<LowerPose, 'pelvisX' | 'pelvisDrop' | 'sideShift'> {
  const r = makeRig();
  const hipOffset = r.hipHalf / Math.SQRT2;
  // Stack the weapon-side hip over the front foot's lateral plane too, not just
  // its side-view projection. The bladed pelvis otherwise leaves a sideways shin tilt.
  const sideShift = 0.02 - hipOffset;
  const rearReach = r.thigh + r.shin - 1e-5;
  const heightAt = (x: number) => r.ankleHeight + Math.sqrt(rearReach ** 2 - (x - hipOffset + 0.22) ** 2 - (sideShift - hipOffset + 0.02) ** 2);
  let lo = 0.35;
  let hi = 0.55;
  for (let i = 0; i < 48; i++) {
    const x = (lo + hi) / 2;
    const front = twoBoneIk([x + hipOffset, heightAt(x), hipOffset + sideShift], [0.91, r.ankleHeight, 0.02], r.thigh, r.shin, [1, 0.1, 0]);
    if (front.mid[0] > front.end[0]) hi = x;
    else lo = x;
  }
  const pelvisX = (lo + hi) / 2;
  return { pelvisX, pelvisDrop: r.hipHeight - heightAt(pelvisX), sideShift };
}

export const LUNGE_LOWER: LowerPose = {
  ...lungePelvis(),
  lean: 12,
  frontX: 0.91,
  frontLift: 0,
  frontPitch: 0,
  rearX: -0.22,
  rearLift: 0,
  rearArm: -1,
};

export function mirrorZ(v: V3, handed: 1 | -1): V3 {
  return [v[0], v[1], v[2] * handed];
}
