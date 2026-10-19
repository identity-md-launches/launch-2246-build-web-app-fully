import type { SimSpec } from '../data/types';
import type { V3 } from '../rig/vec';
import { EN_GARDE_LOWER, EXTENSIONS, LUNGE_LOWER, POSITIONS, SIXTE_GUARD, type LowerPose, type UpperPose } from './poses';

export type Ease = 'linear' | 'in' | 'out' | 'inOut';
export interface Key<P> {
  t: number;
  pose: P;
  ease?: Ease;
}
export interface Clip<P> {
  id: string;
  /** Duration in tempo units. */
  duration: number;
  keys: Key<P>[];
  markers: Record<string, number>;
}

const G = EN_GARDE_LOWER;
const L = (p: Partial<LowerPose>): LowerPose => ({ ...G, ...p });

/** Shift a set of keys forward along the piste (used to chain footwork). */
function shift(keys: Key<LowerPose>[], dx: number, dt: number): Key<LowerPose>[] {
  return keys.map((k) => ({
    t: k.t + dt,
    ease: k.ease,
    pose: { ...k.pose, pelvisX: k.pose.pelvisX + dx, frontX: k.pose.frontX + dx, rearX: k.pose.rearX + dx },
  }));
}

/** Advance: the front foot leads (toe lifts, heel lands), the rear follows the same distance. */
function advanceKeys(step = 0.4, dur = 1): Key<LowerPose>[] {
  return [
    { t: 0, pose: L({}) },
    { t: 0.3 * dur, pose: L({ frontX: G.frontX + step * 0.5, frontLift: 0.05, frontPitch: 22, pelvisX: step * 0.25 }), ease: 'out' },
    { t: 0.5 * dur, pose: L({ frontX: G.frontX + step, pelvisX: step * 0.5 }), ease: 'in' },
    { t: 0.75 * dur, pose: L({ frontX: G.frontX + step, rearX: G.rearX + step * 0.5, rearLift: 0.03, pelvisX: step * 0.8 }) },
    { t: dur, pose: L({ frontX: G.frontX + step, rearX: G.rearX + step, pelvisX: step }), ease: 'in' },
  ];
}
/** Retreat: the rear foot leads, the front follows. */
function retreatKeys(step = 0.4, dur = 1): Key<LowerPose>[] {
  return [
    { t: 0, pose: L({}) },
    { t: 0.3 * dur, pose: L({ rearX: G.rearX - step * 0.5, rearLift: 0.04, pelvisX: -step * 0.25 }), ease: 'out' },
    { t: 0.5 * dur, pose: L({ rearX: G.rearX - step, pelvisX: -step * 0.5 }), ease: 'in' },
    { t: 0.75 * dur, pose: L({ rearX: G.rearX - step, frontX: G.frontX - step * 0.5, frontLift: 0.03, pelvisX: -step * 0.8 }) },
    { t: dur, pose: L({ rearX: G.rearX - step, frontX: G.frontX - step, pelvisX: -step }), ease: 'in' },
  ];
}
/** Lunge: the front foot kicks toe-up and lands heel first, the rear leg drives straight, rear foot flat. */
function lungeKeys(depth = 1, start = 0, dur = 1.2): Key<LowerPose>[] {
  const fx = G.frontX + (LUNGE_LOWER.frontX - G.frontX) * depth;
  return [
    { t: start, pose: L({}) },
    { t: start + 0.25 * dur, pose: L({ frontLift: 0.0, frontPitch: 8, lean: 4 }) },
    { t: start + 0.5 * dur, pose: L({ frontX: G.frontX + (fx - G.frontX) * 0.45, frontLift: 0.09, frontPitch: 28, pelvisX: LUNGE_LOWER.pelvisX * depth * 0.4, pelvisDrop: 0.18, sideShift: LUNGE_LOWER.sideShift * depth * 0.4, rearArm: -0.4, lean: 6 }), ease: 'out' },
    { t: start + 0.8 * dur, pose: L({ frontX: fx, frontPitch: 18, pelvisX: LUNGE_LOWER.pelvisX * depth, pelvisDrop: G.pelvisDrop + (LUNGE_LOWER.pelvisDrop - G.pelvisDrop) * depth, sideShift: LUNGE_LOWER.sideShift * depth, rearArm: -1 * depth, lean: 4 + 8 * depth }), ease: 'in' },
    { t: start + dur, pose: L({ frontX: fx, frontPitch: 0, pelvisX: LUNGE_LOWER.pelvisX * depth, pelvisDrop: G.pelvisDrop + (LUNGE_LOWER.pelvisDrop - G.pelvisDrop) * depth, sideShift: LUNGE_LOWER.sideShift * depth, rearArm: -1 * depth, lean: 4 + 8 * depth }), ease: 'out' },
  ];
}
function jumpKeys(dir: 1 | -1, dist = 0.45, dur = 1): Key<LowerPose>[] {
  return [
    { t: 0, pose: L({}) },
    { t: 0.25 * dur, pose: L({ frontLift: 0.06, rearLift: 0.06, pelvisDrop: G.pelvisDrop - 0.02, frontX: G.frontX + dir * dist * 0.4, rearX: G.rearX + dir * dist * 0.4, pelvisX: dir * dist * 0.4 }), ease: 'out' },
    { t: 0.6 * dur, pose: L({ frontX: G.frontX + dir * dist, rearX: G.rearX + dir * dist, pelvisX: dir * dist }), ease: 'in' },
    { t: dur, pose: L({ frontX: G.frontX + dir * dist, rearX: G.rearX + dir * dist, pelvisX: dir * dist }) },
  ];
}
/** Flèche: arm, weight over the front foot, front leg drives, rear leg passes; tip lands before that foot. */
function flecheKeys(start = 0): Key<LowerPose>[] {
  return [
    { t: start, pose: L({}) },
    { t: start + 0.35, pose: L({ lean: 14, pelvisX: 0.12, pelvisDrop: 0.15 }) },
    { t: start + 0.75, pose: L({ lean: 22, pelvisX: 0.42, pelvisDrop: 0.16, rearLift: 0.12, rearX: 0.2, rearArm: -0.6 }), ease: 'in' },
    { t: start + 1.2, pose: L({ lean: 24, pelvisX: 0.9, pelvisDrop: 0.12, rearLift: 0.14, rearX: 0.85, frontX: 0.6, rearArm: -1 }) },
    { t: start + 1.6, pose: L({ lean: 20, pelvisX: 1.25, pelvisDrop: 0.1, rearLift: 0, rearX: 1.25, frontX: 0.9, frontLift: 0.05, rearArm: -1 }) },
  ];
}
function hold(t: number, p: Partial<LowerPose> = {}): Key<LowerPose> {
  return { t, pose: L(p) };
}

const lungeEnd = lungeKeys()[4].pose;
const FOOT: Record<string, { keys: Key<LowerPose>[]; markers?: Record<string, number> }> = {
  guard: { keys: [hold(0), hold(1)] },
  advance: { keys: advanceKeys(), markers: { frontFootLift: 0.05 } },
  retreat: { keys: retreatKeys() },
  lunge: { keys: lungeKeys(), markers: { frontFootLift: 0.3 } },
  shortLunge: { keys: lungeKeys(0.5, 0, 0.9), markers: { frontFootLift: 0.22 } },
  recoverBack: { keys: [...lungeKeys(), { t: 1.6, pose: lungeEnd }, { t: 2.6, pose: L({}), ease: 'inOut' }], markers: { frontFootLift: 0.3 } },
  recoverFwd: {
    keys: [...lungeKeys(), { t: 1.6, pose: lungeEnd }, { t: 2.6, pose: L({ pelvisX: lungeEnd.frontX - G.frontX, frontX: lungeEnd.frontX, rearX: lungeEnd.frontX - (G.frontX - G.rearX) }), ease: 'inOut' }],
    markers: { frontFootLift: 0.3 },
  },
  halfAdvance: { keys: [hold(0), { t: 0.35, pose: L({ frontX: G.frontX + 0.1, frontLift: 0.04, frontPitch: 18, pelvisX: 0.05 }) }, hold(0.7, { frontX: G.frontX + 0.15, pelvisX: 0.07 })], markers: { frontFootLift: 0.05 } },
  halfRetreat: { keys: [hold(0), { t: 0.35, pose: L({ rearX: G.rearX - 0.15, rearLift: 0.03, pelvisX: -0.07 }) }, hold(0.7, { rearX: G.rearX - 0.15, pelvisX: -0.07 })] },
  doubleAdvance: { keys: [...advanceKeys(0.36, 1), ...shift(advanceKeys(0.4, 0.7).slice(1), 0.36, 1)], markers: { frontFootLift: 0.05 } },
  jumpAdvance: { keys: jumpKeys(1), markers: { frontFootLift: 0.1 } },
  jumpRetreat: { keys: jumpKeys(-1) },
  balestra: { keys: [...jumpKeys(1, 0.4, 0.8), ...shift(lungeKeys().slice(1), 0.4, 0.8)], markers: { frontFootLift: 0.1 } },
  advanceLunge: { keys: [...advanceKeys(0.4, 0.8), ...shift(lungeKeys().slice(1), 0.4, 0.8)], markers: { frontFootLift: 0.04 } },
  patinando: { keys: [...advanceKeys(0.25, 0.55), ...shift(lungeKeys().slice(1), 0.25, 0.55)], markers: { frontFootLift: 0.03 } },
  fleche: { keys: flecheKeys(), markers: { frontFootLift: 0.75, passingFootLand: 1.6 } },
  advanceFleche: { keys: [...advanceKeys(0.4, 0.8), ...shift(flecheKeys().slice(1), 0.4, 0.8)], markers: { frontFootLift: 0.04, passingFootLand: 2.4 } },
  crossFwd: { keys: [hold(0), { t: 0.5, pose: L({ rearX: G.frontX + 0.15, rearLift: 0.05, pelvisX: 0.2 }) }, hold(1, { frontX: G.frontX + 0.45, rearX: G.rearX + 0.45, pelvisX: 0.45 })], markers: { frontFootLift: 0.55 } },
  crossBack: { keys: [hold(0), { t: 0.5, pose: L({ frontX: G.rearX - 0.15, frontLift: 0.05, pelvisX: -0.2 }) }, hold(1, { frontX: G.frontX - 0.45, rearX: G.rearX - 0.45, pelvisX: -0.45 })] },
  appel: { keys: [hold(0), { t: 0.25, pose: L({ frontLift: 0.05, frontPitch: 15 }) }, hold(0.45), hold(0.8)], markers: { frontFootLift: 0.05 } },
  brokenStep: { keys: [...advanceKeys(0.2, 0.5), hold(1.2, { frontX: G.frontX + 0.2, rearX: G.rearX + 0.2, pelvisX: 0.2 }), ...shift(advanceKeys(0.3, 0.6).slice(1), 0.2, 1.2)], markers: { frontFootLift: 0.03 } },
  rhythm: { keys: [...advanceKeys(0.3, 1.2), ...shift(advanceKeys(0.3, 1.1).slice(1), 0.3, 1.2), ...shift(advanceKeys(0.45, 0.6).slice(1), 0.6, 2.3)], markers: { frontFootLift: 0.06 } },
  steal: { keys: [hold(0), { t: 0.6, pose: L({ rearX: G.rearX + 0.12, pelvisX: 0.06 }) }, hold(1.2, { rearX: G.rearX + 0.12, frontX: G.frontX + 0.12, pelvisX: 0.12 })] },
  retreatLunge: { keys: [...retreatKeys(0.35, 0.8), ...shift(lungeKeys().slice(1), -0.35, 0.8)], markers: { frontFootLift: 0.8 + 0.3 } },
  match: { keys: [...retreatKeys(0.3, 0.8), ...shift(advanceKeys(0.3, 0.8).slice(1), -0.3, 0.8)] },
  duck: { keys: [hold(0), hold(0.5, { pelvisDrop: 0.42, lean: 30, frontX: G.frontX + 0.15, pelvisX: 0.05 }), hold(1, { pelvisDrop: 0.45, lean: 32, frontX: G.frontX + 0.2, pelvisX: 0.08 })] },
  inquartata: { keys: [hold(0), hold(0.6, { rearX: G.rearX + 0.05, sideShift: 0.22, lean: 6 }), hold(1, { sideShift: 0.28, lean: 8, rearX: G.rearX + 0.05 })] },
  passata: { keys: [hold(0), hold(0.6, { pelvisDrop: 0.4, lean: 25, frontX: G.frontX - 0.1 }), hold(1, { pelvisDrop: 0.5, lean: 35, frontX: G.frontX - 0.1, rearX: G.rearX - 0.35, pelvisX: -0.05 })] },
  coveredRecovery: { keys: [...lungeKeys(), { t: 1.5, pose: lungeEnd }, { t: 2.4, pose: L({}), ease: 'inOut' }], markers: { frontFootLift: 0.3 } },
};

export const FOOTWORK_CLIPS: Record<string, Clip<LowerPose>> = Object.fromEntries(
  Object.entries(FOOT).map(([id, d]) => {
    const keys = [...d.keys].sort((a, b) => a.t - b.t);
    return [id, { id, duration: keys[keys.length - 1].t, keys, markers: d.markers ?? {} }];
  }),
);

/** Upper-body poses by name. */
export function upperPose(name: string): UpperPose {
  if (name === 'guard') return SIXTE_GUARD;
  if (name in POSITIONS) return POSITIONS[name as keyof typeof POSITIONS];
  if (name in EXTENSIONS) return EXTENSIONS[name];
  throw new Error(`Unknown upper pose ${name}`);
}

/** Build the blade-arm clip for a technique from its simulation spec. */
export function makeBladeClip(id: string, spec: SimSpec): Clip<UpperPose> {
  const k = (t: number, name: string, ease: Ease = 'inOut'): Key<UpperPose> => ({ t, pose: upperPose(name), ease });
  const T = Math.max(0.6, spec.tempos);
  const fin = spec.flick ? 'back' : spec.finalLine ?? 'high-out';
  const keys: Key<UpperPose>[] = [k(0, 'guard')];
  const markers: Record<string, number> = {};
  switch (spec.role) {
    case 'attack':
    case 'riposte':
    case 'renewal':
    case 'counter':
    case 'line':
    case 'bladeAttack': {
      let t = 0;
      if (spec.bladeOn) {
        keys.push(k(0.3, spec.bladeOn === 'beat' ? 'quarte' : 'sixte', 'out'));
        t = 0.4;
      }
      const feints = (spec.evadeLateral ?? 0) + (spec.evadeCircular ?? 0) + (spec.changesLine ? 1 : 0);
      const slots = Math.max(0, Math.min(3, feints));
      const per = slots ? (T - t - 0.4) / (slots + 1) : 0;
      for (let i = 0; i < slots; i++) {
        t += per;
        keys.push(k(t, i % 2 === 0 ? 'feintHigh' : 'feintLow'));
      }
      if (spec.armLift) keys.push(k(t + 0.25, 'lift', 'out'));
      if (spec.flick) keys.push(k(Math.max(t + 0.2, T * 0.45), 'flickWind', 'out'));
      markers.armExtendStart = 0;
      markers.finalStart = slots ? t : 0;
      keys.push(k(T, fin, 'out'));
      markers.tipArrival = T;
      break;
    }
    case 'parry': {
      const ps = spec.parry?.positions ?? ['sixte'];
      const per = (T * 0.8) / ps.length;
      ps.forEach((p, i) => {
        if (spec.parry?.type === 'circular') keys.push(k(per * i + per * 0.5, p === 'quarte' || p === 'septime' ? 'octave' : 'septime'));
        keys.push(k(per * (i + 1), p, 'out'));
      });
      markers.parryContact = per * ps.length;
      keys.push(k(T, ps[ps.length - 1]));
      break;
    }
    case 'bladePrep':
      keys.push(k(T * 0.5, spec.bladeOn === 'engage' ? 'sixte' : 'guard'), k(T, spec.bladeOn === 'engage' ? 'quarte' : 'guard'));
      break;
    case 'derobe':
      keys.push(k(T * 0.4, 'feintLow'), k(T, 'high-out', 'out'));
      markers.armExtendStart = 0;
      break;
    case 'feint':
      keys.push(k(T * 0.5, 'feintHigh', 'out'), k(T, 'guard'));
      markers.armExtendStart = 0;
      break;
    default:
      keys.push(k(T, 'guard'));
  }
  return { id, duration: T, keys: keys.sort((a, b) => a.t - b.t), markers };
}

function ease(e: Ease | undefined, u: number) {
  switch (e) {
    case 'in':
      return u * u;
    case 'out':
      return 1 - (1 - u) * (1 - u);
    case 'inOut':
      return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
    default:
      return u;
  }
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpV = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

export function sampleLower(clip: Clip<LowerPose>, t: number): LowerPose {
  const ks = clip.keys;
  if (t <= ks[0].t) return ks[0].pose;
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i].t) {
      const a = ks[i - 1];
      const b = ks[i];
      const u = ease(b.ease, (t - a.t) / Math.max(1e-6, b.t - a.t));
      const o = {} as LowerPose;
      (Object.keys(a.pose) as (keyof LowerPose)[]).forEach((key) => (o[key] = lerp(a.pose[key], b.pose[key], u)));
      return o;
    }
  }
  return ks[ks.length - 1].pose;
}

export function sampleUpper(clip: Clip<UpperPose>, t: number): UpperPose {
  const ks = clip.keys;
  if (t <= ks[0].t) return ks[0].pose;
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i].t) {
      const a = ks[i - 1];
      const b = ks[i];
      const u = ease(b.ease, (t - a.t) / Math.max(1e-6, b.t - a.t));
      return { hand: lerpV(a.pose.hand, b.pose.hand, u), tip: lerpV(a.pose.tip, b.pose.tip, u), pron: lerp(a.pose.pron, b.pose.pron, u) };
    }
  }
  return ks[ks.length - 1].pose;
}

/** Offset a lower pose by a root displacement already banked by earlier slices. */
export function offsetLower(p: LowerPose, dx: number): LowerPose {
  return { ...p, pelvisX: p.pelvisX + dx, frontX: p.frontX + dx, rearX: p.rearX + dx };
}

/** Layered mix: the lower layer owns legs and pelvis, the upper layer owns the weapon arm; the spine blends. */
export function mixLayers(lower: LowerPose, upper: UpperPose, spineBlend = 0.5): { lower: LowerPose; upper: UpperPose } {
  const leanComp = (lower.lean - G.lean) * 0.004 * spineBlend;
  return { lower, upper: { ...upper, hand: [upper.hand[0] - leanComp, upper.hand[1], upper.hand[2]] } };
}
