import { buildSkeleton, type Capsule, type FencerFrame, type Skeleton } from '../rig/skeleton';
import type { RigDims } from '../rig/dimensions';
import { BLADE_LENGTH, TIP_RADIUS } from '../rig/dimensions';
import { add, angleDeg, closestOnSegment, cross, dist, dot, norm, scale, sub, type V3 } from '../rig/vec';
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

export { buildSkeleton };
