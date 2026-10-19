import { add, cross, dist, dot, norm, scale, sub, type V3 } from './vec';

export interface IkResult {
  mid: V3;
  end: V3;
  reached: boolean;
  /** Bend at the middle joint in degrees (0 = straight). */
  bendDeg: number;
}

/**
 * Analytic two-bone IK (law of cosines). `pole` is the direction the middle joint should bend toward.
 * When the target is out of reach the chain straightens toward it and `reached` is false.
 */
export function twoBoneIk(root: V3, target: V3, l1: number, l2: number, pole: V3): IkResult {
  const toT = sub(target, root);
  const d = Math.max(1e-6, dist(root, target));
  const maxR = l1 + l2 - 1e-5;
  const minR = Math.abs(l1 - l2) + 1e-5;
  const reached = d <= maxR + 1e-4;
  const dc = Math.min(maxR, Math.max(minR, d));
  const dir = norm(toT);
  const end = add(root, scale(dir, dc));
  const a = (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc);
  const along = l1 * a;
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  let p = sub(pole, scale(dir, dot(pole, dir)));
  if (Math.hypot(p[0], p[1], p[2]) < 1e-6) p = norm(cross(dir, [0, 1, 0.001]));
  p = norm(p);
  const mid = add(add(root, scale(dir, along)), scale(p, h));
  const cosMid = (l1 * l1 + l2 * l2 - dc * dc) / (2 * l1 * l2);
  const bendDeg = 180 - (Math.acos(Math.max(-1, Math.min(1, cosMid))) * 180) / Math.PI;
  return { mid, end, reached, bendDeg };
}
