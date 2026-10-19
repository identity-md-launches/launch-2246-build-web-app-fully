import type { LowerPose, UpperPose } from '../anim/poses';
import { BLADE_LENGTH, type RigDims } from './dimensions';
import { twoBoneIk } from './ik';
import { add, angleDeg, lerp3, norm, scale, sub, type V3 } from './vec';

export const BLADE_SEGMENTS = 14;
const BLADING = (45 * Math.PI) / 180;
const DEG = Math.PI / 180;

export interface FencerFrame {
  rootX: number;
  /** +1 faces +x (left fencer), -1 faces -x (right fencer). */
  facing: 1 | -1;
  handed: 1 | -1;
  lower: LowerPose;
  upper: UpperPose;
  /** Arm IK override: world-space tip point and blade direction at a contact frame. */
  ik?: { point: V3; dir: V3 };
  /** Normalised tip load 0..1 driving blade bend, and bend direction in world space. */
  bend: number;
  bendDir: V3;
  /** Faible lag for flick whip, -1..1. */
  whip: number;
}

export interface Capsule {
  a: V3;
  b: V3;
  r: number;
  valid: boolean;
  part: string;
}

export interface Skeleton {
  joints: Record<string, V3>;
  blade: V3[];
  tip: V3;
  tipDir: V3;
  guard: V3;
  armReached: boolean;
  elbowFlex: number;
  frontKneeFlex: number;
  rearKneeFlex: number;
  lean: number;
  targets: Capsule[];
}

/** Map a local (authored, weapon side = +z) point to world space. */
function toWorld(f: FencerFrame, p: V3, s: number): V3 {
  return [f.rootX + f.facing * p[0] * s, p[1] * s, f.facing * f.handed * p[2] * s];
}
function dirToWorld(f: FencerFrame, d: V3): V3 {
  return norm([f.facing * d[0], d[1], f.facing * f.handed * d[2]]);
}

export function buildSkeleton(f: FencerFrame, rig: RigDims): Skeleton {
  const s = rig.scale;
  const lo = f.lower;
  const pelvisLocal: V3 = [lo.pelvisX, (rig.hipHeight - lo.pelvisDrop * s) / s, lo.sideShift];
  const pelvis = toWorld(f, pelvisLocal, s);
  const lat: V3 = [Math.sin(BLADING), 0, Math.cos(BLADING)];
  const spine = rig.shoulderHeight - rig.hipHeight;
  const leanR = lo.lean * DEG;
  const chestL: V3 = add(pelvisLocal, [(Math.sin(leanR) * spine) / s, (Math.cos(leanR) * spine) / s - 0.04, 0]);
  const lumbarL: V3 = lerp3(pelvisLocal, chestL, 0.45);
  const shoulderW = add(chestL, scale(lat, rig.shoulderHalf / s));
  const shoulderR = add(chestL, scale(lat, -rig.shoulderHalf / s));
  const neckL: V3 = add(chestL, [0.02, 0.06, 0]);
  const headL: V3 = add(neckL, [0.03, (rig.neck + rig.headRadius) / s, 0]);
  const hipW = add(pelvisLocal, scale(lat, rig.hipHalf / s));
  const hipR = add(pelvisLocal, scale(lat, -rig.hipHalf / s));
  const ankleH = rig.ankleHeight / s;
  const frontAnkleL: V3 = [lo.frontX, ankleH + lo.frontLift, 0.02];
  const rearAnkleL: V3 = [lo.rearX, ankleH + lo.rearLift, -0.02];

  const W = (p: V3) => toWorld(f, p, s);
  const joints: Record<string, V3> = {
    pelvis,
    lumbar: W(lumbarL),
    chest: W(chestL),
    neck: W(neckL),
    head: W(headL),
    shoulderW: W(shoulderW),
    shoulderR: W(shoulderR),
    clavicleW: W(lerp3(chestL, shoulderW, 0.4)),
    clavicleR: W(lerp3(chestL, shoulderR, 0.4)),
    hipW: W(hipW),
    hipR: W(hipR),
  };

  // Legs: two-bone IK, front knee tracks over the toes, rear knee over the turned-out rear foot.
  const fl = twoBoneIk(joints.hipW, W(frontAnkleL), rig.thigh, rig.shin, dirToWorld(f, [1, 0.1, 0]));
  const rl = twoBoneIk(joints.hipR, W(rearAnkleL), rig.thigh, rig.shin, dirToWorld(f, [0.35, 0.05, -1]));
  joints.kneeW = fl.mid;
  joints.ankleW = fl.end;
  joints.kneeR = rl.mid;
  joints.ankleR = rl.end;
  const fp = lo.frontPitch * DEG;
  const footL = rig.footLength;
  joints.heelW = add(fl.end, [0, -rig.ankleHeight * 0.9, 0]);
  joints.toeW = add(joints.heelW, scale(dirToWorld(f, [Math.cos(fp), Math.sin(fp), 0]), footL));
  joints.heelR = add(rl.end, [0, -rig.ankleHeight * 0.9, 0]);
  joints.toeR = add(joints.heelR, scale(dirToWorld(f, [0.05, 0, -1]), footL * 0.95));

  // Weapon arm.
  const sh = joints.shoulderW;
  let bladeDir: V3;
  let wristTarget: V3;
  const gripLen = rig.handToGrip + 0.02;
  if (f.ik) {
    bladeDir = norm(f.ik.dir);
    const tipCentre = f.ik.point;
    wristTarget = sub(tipCentre, scale(bladeDir, BLADE_LENGTH + gripLen));
  } else {
    bladeDir = dirToWorld(f, f.upper.tip);
    wristTarget = W(add(shoulderW, f.upper.hand));
  }
  const arm = twoBoneIk(sh, wristTarget, rig.upperArm, rig.forearm, dirToWorld(f, [0, -1, 0.35]));
  joints.elbowW = arm.mid;
  joints.wristW = arm.end;
  const grip = add(arm.end, scale(bladeDir, rig.handToGrip));
  joints.handW = grip;
  const guard = add(grip, scale(bladeDir, 0.02));

  // Rear arm: dropped (-1), relaxed (0), raised (1).
  const ra = lo.rearArm;
  const relaxed: V3 = [0.12, -0.42, -0.08];
  const raised: V3 = [-0.14, 0.22, -0.12];
  const dropped: V3 = [-0.5, -0.32, -0.05];
  const rh = ra >= 0 ? lerp3(relaxed, raised, ra) : lerp3(relaxed, dropped, -ra);
  const rarm = twoBoneIk(joints.shoulderR, W(add(shoulderR, rh)), rig.upperArm, rig.forearm, dirToWorld(f, [-0.4, -0.2, -1]));
  joints.elbowR = rarm.mid;
  joints.wristR = rarm.end;

  // Blade: segmented cantilever. Deflection y(x) = d · x²(3L − x) / (2L³), plus a whip term on the faible.
  const blade: V3[] = [];
  const bendAmp = f.bend * 0.16;
  const bd = norm(f.bendDir);
  for (let i = 0; i <= BLADE_SEGMENTS; i++) {
    const u = i / BLADE_SEGMENTS;
    const x = u * BLADE_LENGTH;
    const L = BLADE_LENGTH;
    const defl = (bendAmp * x * x * (3 * L - x)) / (2 * L * L * L);
    const whip = f.whip * 0.12 * Math.max(0, u - 0.6) * Math.max(0, u - 0.6) * 6;
    const p = add(add(guard, scale(bladeDir, x * (1 - 0.5 * f.bend * f.bend * u * 0.12))), scale(bd, defl));
    blade.push(add(p, scale(dirToWorld(f, [0, 1, 0]), -whip)));
  }
  let tip = blade[BLADE_SEGMENTS];
  if (f.ik) {
    // At a contact frame the tip is pinned on the target; the bend absorbs the remaining travel.
    const shift = sub(f.ik.point, tip);
    for (let i = 1; i <= BLADE_SEGMENTS; i++) blade[i] = add(blade[i], scale(shift, i / BLADE_SEGMENTS));
    tip = f.ik.point;
  }
  const tipDir = norm(sub(blade[BLADE_SEGMENTS], blade[BLADE_SEGMENTS - 1]));

  const torsoR = (rig.chestWidthHalf + rig.chestDepthHalf) / 2;
  const groin = add(pelvis, [0, 0.02, 0]);
  const collar = add(joints.chest, [0, 0.02, 0]);
  const targets: Capsule[] = [
    { a: groin, b: collar, r: torsoR, valid: true, part: 'trunk' },
    { a: add(joints.neck, [0, 0.0, 0]), b: add(joints.neck, [0, 0.03, 0]), r: 0.06 * s, valid: true, part: 'bib' },
    { a: add(joints.head, [0, -0.02, 0]), b: add(joints.head, [0, 0.04, 0]), r: rig.headRadius * 1.15, valid: false, part: 'mask' },
    { a: joints.shoulderW, b: joints.elbowW, r: 0.05 * s, valid: false, part: 'upper arm' },
    { a: joints.elbowW, b: joints.wristW, r: 0.04 * s, valid: false, part: 'forearm' },
    { a: joints.hipW, b: joints.kneeW, r: 0.07 * s, valid: false, part: 'thigh' },
    { a: joints.hipR, b: joints.kneeR, r: 0.07 * s, valid: false, part: 'thigh' },
    { a: joints.kneeW, b: joints.ankleW, r: 0.05 * s, valid: false, part: 'shin' },
    { a: joints.kneeR, b: joints.ankleR, r: 0.05 * s, valid: false, part: 'shin' },
  ];

  return {
    joints,
    blade,
    tip,
    tipDir,
    guard,
    armReached: arm.reached,
    elbowFlex: arm.bendDeg,
    frontKneeFlex: fl.bendDeg,
    rearKneeFlex: rl.bendDeg,
    lean: lo.lean,
    targets,
  };
}

/** Angle between two world vectors, re-exported for detectors and tests. */
export { angleDeg };
