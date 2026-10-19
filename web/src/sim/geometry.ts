import { buildSkeleton, type Capsule, type FencerFrame, type Skeleton } from '../rig/skeleton';
import type { RigDims } from '../rig/dimensions';
import { BLADE_LENGTH, TIP_RADIUS } from '../rig/dimensions';
import { add, angleDeg, closestOnSegment, cross, dist, dot, lerp3, norm, scale, sub, type V3 } from '../rig/vec';
import type { TargetLine } from '../data/types';

/** Gap along the piste between the attacker's front shoulder and the defender's nearest valid surface. */
export function measureBetween(att: Skeleton, def: Skeleton, facing: 1 | -1): number {
  const trunk = def.targets[0];
  const surfaceX = Math.min(trunk.a[0] * facing, trunk.b[0] * facing) - trunk.r;
  return surfaceX - att.joints.shoulderW[0] * facing;
}

export interface TargetPoint {
  point: V3;
  normal: V3;
  capsule: Capsule;
}

/**
 * Choose the point on the defender's body a final line aims at. Lines are defender-relative:
 * "in" is the defender's inside (toward their non-weapon side), "out" their weapon-side outside.
 */
export function targetPointFor(def: Skeleton, defFrame: FencerFrame, line: TargetLine, offTarget = false): TargetPoint {
  const trunk = def.targets[0];
  const capsule = offTarget ? def.targets[5] : trunk;
  const axis = norm(sub(trunk.b, trunk.a));
  const toward: V3 = [defFrame.facing, 0, 0];
  const outside: V3 = [0, 0, defFrame.facing * defFrame.handed];
  if (line === 'back') {
    // Over the shoulder onto the upper back: normal points up and away from the attacker.
    const base = add(trunk.b, scale(axis, -0.06));
    const normal = norm(add(scale(toward, -0.35), add([0, 0.85, 0], scale(outside, 0.25))));
    return { point: add(base, scale(normal, trunk.r + TIP_RADIUS)), normal, capsule: trunk };
  }
  const high = line.startsWith('high');
  const side = line.endsWith('out') ? 1 : -1;
  const u = offTarget ? 0.45 : high ? 0.78 : 0.25;
  const base = add(capsule.a, scale(sub(capsule.b, capsule.a), u));
  let normal = norm(add(toward, scale(outside, side * 0.45)));
  normal = norm(sub(normal, scale(axis, dot(normal, axis))));
  return { point: add(base, scale(normal, capsule.r + TIP_RADIUS)), normal, capsule };
}

/** Blade direction arriving at `angle` degrees from the inward surface normal, tilted toward the attacker's line of approach. */
export function arrivalDir(normal: V3, approach: V3, angle: number): V3 {
  const inward = scale(normal, -1);
  let perp = sub(approach, scale(inward, dot(approach, inward)));
  if (Math.hypot(...perp) < 1e-6) perp = cross(inward, [0, 1, 0]);
  perp = norm(perp);
  const a = (angle * Math.PI) / 180;
  return norm(add(scale(inward, Math.cos(a)), scale(perp, Math.sin(a))));
}

/** Can the attacker's arm place the tip at `point` with blade direction `dir`? */
export function canReach(att: Skeleton, rig: RigDims, point: V3, dir: V3): boolean {
  const wrist = sub(point, scale(dir, BLADE_LENGTH + rig.handToGrip + 0.02));
  return dist(att.joints.shoulderW, wrist) <= rig.upperArm + rig.forearm + 1e-3;
}

export interface Contact {
  capsule: Capsule;
  normal: V3;
  angle: number;
  depth: number;
}

/** Geometric tip-vs-body test on the actual skeleton. */
export function tipContact(tip: V3, tipDir: V3, def: Skeleton): Contact | null {
  let best: Contact | null = null;
  for (const c of def.targets) {
    const q = closestOnSegment(tip, c.a, c.b);
    const d = dist(tip, q);
    const depth = c.r + TIP_RADIUS - d;
    if (depth >= -0.004) {
      const normal = norm(sub(tip, q));
      const angle = angleDeg(tipDir, scale(normal, -1));
      if (!best || (c.valid && !best.capsule.valid) || depth > best.depth) best = { capsule: c, normal, angle, depth };
    }
  }
  return best;
}

/** Distance from a world-space contact point to the rendered, segmented blade. */
export function pointToBlade(point: V3, blade: V3[]): number {
  let distance = Infinity;
  for (let i = 1; i < blade.length; i++) distance = Math.min(distance, dist(point, closestOnSegment(point, blade[i - 1], blade[i])));
  return distance;
}

/**
 * Put the defender's forte against the incoming faible using both rigs' existing arm IK.
 * A tactical parry is successful only when a shared point is reachable by both arms and
 * really lies on both rendered blades; an out-of-distance parry cannot manufacture contact.
 */
export function contactFrames(attFrame: FencerFrame, defFrame: FencerFrame, attRig: RigDims, defRig: RigDims): { attacker: FencerFrame; defender: FencerFrame; point: V3 } | null {
  const att = buildSkeleton(attFrame, attRig);
  const def = buildSkeleton(defFrame, defRig);
  const fraction = { attacker: 0.8, defender: 0.25 };
  const contactReach = (rig: RigDims, u: number) => rig.upperArm + rig.forearm + rig.handToGrip + 0.02 + u * BLADE_LENGTH - 0.004;
  const ar = contactReach(attRig, fraction.attacker);
  const dr = contactReach(defRig, fraction.defender);
  const aShoulder = att.joints.shoulderW;
  const dShoulder = def.joints.shoulderW;
  if (dist(aShoulder, dShoulder) > ar + dr) return null;

  const bladePoint = (sk: Skeleton, u: number) => lerp3(sk.guard, sk.tip, u);
  let point = lerp3(bladePoint(att, fraction.attacker), bladePoint(def, fraction.defender), 0.5);
  // Project the preferred contact into the intersection of the two reachable volumes.
  for (let i = 0; i < 16; i++) {
    for (const [shoulder, radius] of [[aShoulder, ar], [dShoulder, dr]] as [V3, number][]) {
      if (dist(point, shoulder) > radius) point = add(shoulder, scale(norm(sub(point, shoulder)), radius));
    }
  }

  const steer = (frame: FencerFrame, sk: Skeleton, rig: RigDims, u: number): FencerFrame | null => {
    const toward = sub(point, sk.joints.shoulderW);
    const q = Math.hypot(...toward);
    const along = u * BLADE_LENGTH + rig.handToGrip + 0.02;
    const armReach = rig.upperArm + rig.forearm - 0.002;
    if (q < 1e-6 || Math.abs(q - along) > armReach) return null;
    const axis = norm(toward);
    const preferred = norm(sub(sk.tip, sk.guard));
    const minCos = Math.max(-1, Math.min(1, (q * q + along * along - armReach * armReach) / (2 * q * along)));
    const minArm = Math.abs(rig.upperArm - rig.forearm) + 0.002;
    const maxCos = Math.max(-1, Math.min(1, (q * q + along * along - minArm * minArm) / (2 * q * along)));
    if (minCos > maxCos) return null;
    let dir = preferred;
    const cos = Math.max(minCos, Math.min(maxCos, dot(preferred, axis)));
    if (Math.abs(dot(dir, axis) - cos) > 1e-8) {
      let tangent = sub(preferred, scale(axis, dot(preferred, axis)));
      if (Math.hypot(...tangent) < 1e-6) tangent = cross(axis, [0, 1, 0.001]);
      dir = norm(add(scale(axis, cos), scale(norm(tangent), Math.sqrt(1 - cos * cos))));
    }
    const wrist = sub(point, scale(dir, along));
    if (dist(wrist, sk.joints.shoulderW) < Math.abs(rig.upperArm - rig.forearm) + 0.001) return null;
    return { ...frame, ik: { point: add(point, scale(dir, (1 - u) * BLADE_LENGTH)), dir }, bend: 0, whip: 0 };
  };
  const attacker = steer(attFrame, att, attRig, fraction.attacker);
  const defender = steer(defFrame, def, defRig, fraction.defender);
  if (!attacker || !defender) return null;
  const ak = buildSkeleton(attacker, attRig);
  const dk = buildSkeleton(defender, defRig);
  if (!ak.armReached || !dk.armReached || pointToBlade(point, ak.blade) > 0.001 || pointToBlade(point, dk.blade) > 0.001) return null;
  return { attacker, defender, point };
}

/** Both complete feet, including their shoe thickness, must clear the same end line. */
export function bothFeetBeyondEnd(sk: Skeleton, end = 7): boolean {
  const extents = ['heelW', 'toeW', 'heelR', 'toeR'].map((key) => sk.joints[key][0]);
  const shoeRadius = 0.04;
  return extents.every((x) => x + shoeRadius < -end) || extents.every((x) => x - shoeRadius > end);
}

export { buildSkeleton };
