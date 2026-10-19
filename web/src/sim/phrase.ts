import { FOOTWORK_CLIPS, makeBladeClip, mixLayers, offsetLower, sampleLower, sampleUpper, type Clip } from '../anim/clips';
import { EN_GARDE_LOWER, LUNGE_LOWER, SIXTE_GUARD, type LowerPose, type UpperPose } from '../anim/poses';
import { getTechnique } from '../data/techniques';
import type { ParryType, Position, SimSpec, TargetLine, Technique } from '../data/types';
import { makeRig, type RigDims } from '../rig/dimensions';
import { buildSkeleton, type FencerFrame } from '../rig/skeleton';
import { add, norm, scale, sub, type V3 } from '../rig/vec';
import { decide, walkPriority } from '../referee/row';
import { arrivalDir, canReach, measureBetween, targetPointFor, tipContact } from './geometry';
import { fnv1a } from './prng';
import {
  LOCKOUT_TICKS,
  MIN_CONTACT_TICKS,
  MIN_TIP_LOAD_N,
  TICK_HZ,
  other,
  type Choice,
  type ClaimedHit,
  type PhraseResult,
  type PhraseStateName,
  type Registered,
  type RowEvent,
  type Side,
  type Timing,
  type TrackSegment,
} from './types';

export interface FencerSetup {
  height: number;
  handed: 1 | -1;
}
export interface PhraseConfig {
  seed: number;
  tempoSec: number;
  left: FencerSetup;
  right: FencerSetup;
  /** Starting pelvis positions on the piste (metres from centre). */
  leftX?: number;
  rightX?: number;
}

interface LowerSeg {
  start: number;
  clip: Clip<LowerPose>;
  disp: number;
  speed: number;
}
interface UpperSeg {
  start: number;
  clip: Clip<UpperPose>;
  speed: number;
  label: string;
}

class Track {
  lower: LowerSeg[] = [];
  upper: UpperSeg[] = [];
  ik = new Map<number, { point: V3; dir: V3; bend: number; whip: number }>();
  disp = 0;
  lunged = false;
  constructor(
    public side: Side,
    public origin: number,
    public facing: 1 | -1,
    public handed: 1 | -1,
    public rig: RigDims,
  ) {}
  lowerAt(tick: number, T: number): LowerPose {
    let seg: LowerSeg | undefined;
    for (const s of this.lower) if (s.start <= tick) seg = s;
    if (!seg) return EN_GARDE_LOWER;
    const t = ((tick - seg.start) / T) * seg.speed;
    return offsetLower(sampleLower(seg.clip, Math.min(t, seg.clip.duration)), seg.disp);
  }
  upperAt(tick: number, T: number): UpperPose {
    let seg: UpperSeg | undefined;
    for (const s of this.upper) if (s.start <= tick) seg = s;
    if (!seg) return SIXTE_GUARD;
    const t = ((tick - seg.start) / T) * seg.speed;
    return sampleUpper(seg.clip, Math.min(t, seg.clip.duration));
  }
  labelAt(tick: number): string {
    let seg: UpperSeg | undefined;
    for (const s of this.upper) if (s.start <= tick) seg = s;
    return seg?.label ?? 'guard';
  }
  frame(tick: number, T: number, withIk = true): FencerFrame {
    const mixed = mixLayers(this.lowerAt(tick, T), this.upperAt(tick, T));
    const ik = withIk ? this.ik.get(tick) : undefined;
    return {
      rootX: this.origin,
      facing: this.facing,
      handed: this.handed,
      lower: mixed.lower,
      upper: mixed.upper,
      ik: ik ? { point: ik.point, dir: ik.dir } : undefined,
      bend: ik?.bend ?? 0,
      bendDir: [0, 1, 0],
      whip: ik?.whip ?? 0,
    };
  }
  addLower(start: number, clip: Clip<LowerPose>, speed = 1) {
    this.lower.push({ start, clip, disp: this.disp, speed });
  }
  addUpper(start: number, clip: Clip<UpperPose>, label: string, speed = 1) {
    this.upper.push({ start, clip, speed, label });
  }
}

/** A clip that blends from one pose to another. */
function transitionLower(id: string, from: LowerPose, to: LowerPose, dur: number): Clip<LowerPose> {
  return { id, duration: dur, keys: [{ t: 0, pose: from }, { t: dur, pose: to, ease: 'inOut' }], markers: {} };
}
function transitionUpper(id: string, from: UpperPose, to: UpperPose, dur: number): Clip<UpperPose> {
  return { id, duration: dur, keys: [{ t: 0, pose: from }, { t: dur, pose: to, ease: 'out' }], markers: {} };
}

const POSITION_CLOSES: Record<Position, TargetLine[]> = {
  quarte: ['high-in'],
  sixte: ['high-out'],
  septime: ['low-in'],
  octave: ['low-out'],
  prime: ['high-in', 'low-in', 'back'],
  seconde: ['low-out', 'back'],
  tierce: ['high-out'],
  quinte: ['high-in'],
  quinteHigh: ['back', 'high-in', 'high-out'],
};

export type ParryOutcome = 'parried' | 'evaded' | 'wrongLine';

/** Deception table (spec 5.4): does this parry catch this attack? */
export function parryOutcome(att: SimSpec, par: { type: ParryType; positions: Position[] }, attackIsCounter = false): ParryOutcome {
  const closes = new Set(par.positions.flatMap((p) => POSITION_CLOSES[p]));
  const fin = att.finalLine ?? 'high-out';
  if (attackIsCounter) return 'parried';
  if (att.flick) return par.positions.some((p) => p === 'prime' || p === 'quinteHigh' || p === 'seconde') ? 'parried' : 'evaded';
  if (par.type === 'ceding') return att.bladeOn === 'prise' ? 'parried' : 'wrongLine';
  if (att.bladeOn === 'prise') return par.type === 'opposition' ? 'parried' : 'evaded';
  if (att.pause && par.type !== 'successive') return 'evaded';
  if (att.angulated && par.type !== 'opposition') return 'evaded';
  const lat = att.evadeLateral ?? 0;
  const circ = att.evadeCircular ?? 0;
  if (par.type === 'circular') return circ >= 1 ? 'evaded' : 'parried';
  if (par.type === 'semicircular' || par.type === 'diagonal') {
    if (fin.startsWith('low')) return 'parried';
    return lat === 0 && closes.has(fin) ? 'parried' : 'evaded';
  }
  // Lateral family (lateral, beat, opposition, successive, covered).
  const n = par.type === 'successive' ? par.positions.length : 1;
  if (circ >= 1) return 'parried';
  if (att.changesLine) return closes.has(fin) ? 'parried' : 'evaded';
  if (lat >= n) return 'evaded';
  if (lat > 0) return 'parried';
  return closes.has(fin) ? 'parried' : 'wrongLine';
}

export interface Action {
  side: Side;
  spec: SimSpec;
  role: SimSpec['role'];
  foot?: Technique;
  blade?: Technique;
  timing: Timing;
  footClip?: string;
  move: number;
  label: string;
  impactAngle?: number;
}

const OFFENSIVE = new Set(['attack', 'bladeAttack', 'riposte', 'renewal']);

export function combine(side: Side, c: Choice): Action | null {
  const foot = c.foot ? getTechnique(c.foot) : undefined;
  const blade = c.blade ? getTechnique(c.blade) : undefined;
  if (!foot && !blade) return null;
  const main = blade ?? foot!;
  const spec: SimSpec = { ...main.sim };
  let footClip = foot?.footworkClip;
  let move = 0;
  if (foot && foot.sim.role === 'footwork') move = foot.sim.move ?? 0;
  if (blade && OFFENSIVE.has(blade.sim.role) && spec.finalLine) {
    if (foot?.sim.role === 'attack') {
      spec.reach = foot.sim.reach;
      spec.tempos = Math.max(spec.tempos, foot.sim.tempos);
    } else if (foot && move > 0) {
      spec.reach = 'extend';
    }
    if (!foot) {
      const r = spec.reach ?? 'extend';
      footClip = r === 'lunge' ? 'lunge' : r === 'advLunge' ? 'advanceLunge' : r === 'fleche' ? 'fleche' : r === 'shortLunge' ? 'shortLunge' : blade.footworkClip ?? undefined;
      if (spec.role === 'riposte' || spec.role === 'renewal') footClip = undefined;
    }
  }
  if (!footClip && blade?.footworkClip && !OFFENSIVE.has(blade.sim.role)) footClip = blade.footworkClip;
  if (!blade && foot?.sim.role === 'attack') spec.finalLine = foot.sim.finalLine;
  if (c.finalLine && spec.finalLine && !spec.flick) spec.finalLine = c.finalLine;
  if (blade && foot && foot.sim.role === 'footwork') spec.tempos = Math.max(spec.tempos, OFFENSIVE.has(spec.role) ? spec.tempos : foot.sim.tempos);
  const label = [foot?.name, blade?.name].filter(Boolean).join(' + ');
  return { side, spec, role: spec.role, foot, blade, timing: c.timing ?? 'onTime', footClip, move, label, impactAngle: c.impactAngle };
}

export interface SliceOutcome {
  state: PhraseStateName;
  holder: Side | null;
  ended: boolean;
  note: string;
  end: number;
}

/** Full phrase simulator: tracks, slices, geometry, scoring box and referee. */
export class PhraseSim {
  T: number;
  tracks: Record<Side, Track>;
  events: RowEvent[] = [];
  claimed: ClaimedHit[] = [];
  tracksUi: TrackSegment[] = [];
  slices: PhraseResult['slices'] = [];
  captions: PhraseResult['captions'] = [];
  tick = 0;
  state: PhraseStateName = 'NEUTRAL';
  holder: Side | null = null;
  lastParry: { side: Side; tick: number } | null = null;
  lastAttacker: Side | null = null;
  ended = false;
  sliceCount = 0;

  constructor(public cfg: PhraseConfig) {
    this.T = Math.round(cfg.tempoSec * TICK_HZ);
    const lr = makeRig(cfg.left.height);
    const rr = makeRig(cfg.right.height);
    this.tracks = {
      left: new Track('left', cfg.leftX ?? -2.25, 1, cfg.left.handed, lr),
      right: new Track('right', cfg.rightX ?? 2.25, -1, cfg.right.handed, rr),
    };
    for (const s of ['left', 'right'] as Side[]) {
      this.tracks[s].addLower(0, FOOTWORK_CLIPS.guard);
      this.tracks[s].addUpper(0, transitionUpper('guard', SIXTE_GUARD, SIXTE_GUARD, 1), 'sixte');
    }
    this.captions.push({ t: 0, text: 'En garde! Prêts? Allez!' });
  }

  skeleton(side: Side, tick: number, withIk = false) {
    const tr = this.tracks[side];
    return buildSkeleton(tr.frame(tick, this.T, withIk), tr.rig);
  }

  /** Current measure from each side's front shoulder to the other's valid target. */
  measure(side: Side, tick = this.tick): number {
    const a = this.skeleton(side, tick);
    const d = this.skeleton(other(side), tick);
    return measureBetween(a, d, this.tracks[side].facing);
  }

  private offset(t: Timing, kind: 'init' | 'react'): number {
    const T = this.T;
    if (kind === 'init') return t === 'early' ? 0 : t === 'onTime' ? Math.round(0.15 * T) : Math.round(0.5 * T);
    return t === 'early' ? 0 : t === 'onTime' ? Math.round(0.25 * T) : Math.round(0.65 * T);
  }

  private recoverIfLunged(side: Side, at: number) {
    const tr = this.tracks[side];
    if (!tr.lunged) return at;
    const from = tr.lowerAt(at, this.T);
    tr.addLower(at, transitionLower('recover', { ...from, pelvisX: from.pelvisX - tr.disp, frontX: from.frontX - tr.disp, rearX: from.rearX - tr.disp }, EN_GARDE_LOWER, 0.8));
    tr.lunged = false;
    return at + Math.round(0.8 * this.T);
  }

  /** Legal action ids for a side in the current phrase state (spec 4.4 context filtering). */
  legal(side: Side): { foot: string[]; blade: string[] } {
    const foot: string[] = [];
    const blade: string[] = [];
    const close = this.measure(side) <= this.tracks[side].rig.reachExtend;
    const parried = this.lastParry?.side === side && (this.state === 'PARRY_CONTACT' || this.state === 'COUNTER_RIPOSTE');
    const ownFailed = this.lastAttacker === side && (this.state === 'PARRY_CONTACT' || this.state === 'COUNTER_RIPOSTE' || this.state === 'ATTACK');
    const stable = !this.tracks[side].lunged && this.state !== 'PARRY_CONTACT';
    const ids = ['FW02', 'FW03', 'FW04', 'FW07', 'FW08', 'FW09', 'FW10', 'FW11', 'FW12', 'FW13', 'FW14', 'FW15', 'FW16', 'FW17', 'FW18', 'FW19', 'FW20', 'FW21', 'FW22', 'FW23', 'FW24', 'FW25'];
    for (const id of ids) {
      if ((id === 'FW15' || id === 'FW23') && close) continue;
      foot.push(id);
    }
    for (const t of ['PA', 'AT', 'BL', 'RR', 'CT']) {
      for (let i = 1; i <= 25; i++) {
        const id = `${t}${String(i).padStart(2, '0')}`;
        let tech: Technique;
        try {
          tech = getTechnique(id);
        } catch {
          continue;
        }
        const r = tech.sim.role;
        if (r === 'riposte') {
          if (!parried) continue;
          if (id === 'RR08' && this.state !== 'COUNTER_RIPOSTE') continue;
        }
        if (r === 'renewal' && !ownFailed) continue;
        if (r === 'line' && !stable) continue;
        if (id === 'CT11') continue;
        if (parried && (r === 'attack' || r === 'bladeAttack')) continue;
        blade.push(id);
      }
    }
    return { foot, blade };
  }

  /** Resolve one tempo slice: both fencers' choices are revealed together. */
  slice(left: Choice, right: Choice): SliceOutcome {
    if (this.ended) return { state: this.state, holder: this.holder, ended: true, note: 'Phrase already ended', end: this.tick };
    this.sliceCount += 1;
    const T = this.T;
    const S = this.tick;
    const acts: Record<Side, Action | null> = { left: combine('left', left), right: combine('right', right) };
    const isOff = (a: Action | null) => !!a && OFFENSIVE.has(a.role) && !!a.spec.finalLine;
    const isAttackOnBlade = (a: Action | null) => !!a && a.role === 'bladeAttack';
    // Who initiates: offensive actions (attacks, ripostes, renewals); else nobody.
    const start: Record<Side, number> = { left: S, right: S };
    const notes: string[] = [];
    const sideEvents: RowEvent[] = [];
    const lunging: Record<Side, boolean> = { left: false, right: false };

    const offSides = (['left', 'right'] as Side[]).filter((s) => isOff(acts[s]) || isAttackOnBlade(acts[s]));
    // Initiator start times.
    for (const s of ['left', 'right'] as Side[]) {
      const a = acts[s];
      if (!a) continue;
      const renewing = a.role === 'renewal';
      if (!renewing) start[s] = this.recoverIfLunged(s, S);
      if (a.role === 'riposte') start[s] = start[s] + Math.round((a.spec.delay ?? 0) * T) + (a.timing === 'late' ? Math.round(0.6 * T) : a.timing === 'early' ? 0 : Math.round(0.1 * T));
      else if (renewing) start[s] = S + Math.round(0.1 * T) + (a.timing === 'late' ? Math.round(0.5 * T) : 0);
      else if (offSides.includes(s) || a.role === 'line' || a.role === 'footwork' || a.role === 'bladePrep' || a.role === 'tactic' || a.role === 'feint' || a.role === 'stance') start[s] += this.offset(a.timing, 'init');
    }
    // Arrival ticks for offensive actions.
    const tempos: Record<Side, number> = { left: 0, right: 0 };
    const arrival: Record<Side, number> = { left: Infinity, right: Infinity };
    const finalStart: Record<Side, number> = { left: Infinity, right: Infinity };
    const defenderOf = (s: Side) => acts[other(s)];
    for (const s of offSides) {
      const a = acts[s]!;
      if (!a.spec.finalLine) continue;
      let tp = a.spec.tempos;
      const d = defenderOf(s);
      const compound = (a.spec.evadeLateral ?? 0) + (a.spec.evadeCircular ?? 0) > 0;
      // Feints the defender ignores: finish on the feint line, faster.
      if (compound && (!d || d.role !== 'parry')) {
        tp = Math.max(1.2, tp - 0.8 * ((a.spec.evadeLateral ?? 0) + (a.spec.evadeCircular ?? 0)));
        notes.push(`${s === 'left' ? 'Left' : 'Right'} finished on the feint line (no parry was drawn).`);
      }
      tempos[s] = tp;
      arrival[s] = start[s] + Math.round(tp * T);
      finalStart[s] = compound || a.spec.pause ? start[s] + Math.round((tp - 1) * T) : start[s];
    }
    // Counterattacks and parries are reactions to the attack.
    for (const s of ['left', 'right'] as Side[]) {
      const a = acts[s];
      if (!a) continue;
      const o = other(s);
      if (a.role === 'counter') {
        start[s] = (Number.isFinite(arrival[o]) ? start[o] : S) + this.offset(a.timing, 'react');
        tempos[s] = a.spec.tempos;
        arrival[s] = start[s] + Math.round(a.spec.tempos * T);
        finalStart[s] = start[s];
      }
      if (a.role === 'parry' || a.role === 'derobe') {
        const target = Number.isFinite(arrival[o]) ? arrival[o] : S + T;
        const dur = Math.round(a.spec.tempos * T * 0.8);
        const doneAt = a.timing === 'early' ? target - Math.round(0.6 * T) : a.timing === 'onTime' ? target - Math.round(0.1 * T) : target + Math.round(0.15 * T);
        start[s] = Math.max(S, doneAt - dur);
      }
    }

    // Animation segments.
    for (const s of ['left', 'right'] as Side[]) {
      const a = acts[s];
      const tr = this.tracks[s];
      if (!a) continue;
      const st = start[s];
      const speedFor = (clip: Clip<unknown>, tp: number) => (tp > 0 ? clip.duration / tp : 1);
      if (a.footClip && a.role !== 'renewal') {
        const clip = FOOTWORK_CLIPS[a.footClip];
        const tp = tempos[s] || clip.duration;
        tr.addLower(st, clip, OFFENSIVE.has(a.role) ? speedFor(clip, tp) : 1);
        this.tracksUi.push({ side: s, label: a.foot?.name ?? clip.id, start: st, end: st + Math.round((clip.duration / (OFFENSIVE.has(a.role) ? speedFor(clip, tp) : 1)) * T), kind: 'foot' });
        const lungeLike = ['lunge', 'shortLunge', 'advanceLunge', 'balestra', 'patinando', 'retreatLunge'].includes(a.footClip);
        if (lungeLike) {
          lunging[s] = true;
          tr.lunged = true;
          const pre = clip.keys[0].pose.pelvisX;
          const dispGain = a.footClip === 'advanceLunge' || a.footClip === 'patinando' || a.footClip === 'balestra' ? clip.keys[clip.keys.length - 1].pose.pelvisX - LUNGE_LOWER.pelvisX - pre : a.footClip === 'retreatLunge' ? -0.35 : 0;
          tr.disp += dispGain;
        } else if (a.footClip === 'fleche' || a.footClip === 'advanceFleche') {
          tr.disp += a.footClip === 'advanceFleche' ? 0.4 : 0;
        } else {
          const last = clip.keys[clip.keys.length - 1].pose.pelvisX;
          tr.disp += last;
        }
      }
      if (a.blade || OFFENSIVE.has(a.role)) {
        const clip = makeBladeClip(a.blade?.id ?? a.foot!.id, a.spec);
        const tp = tempos[s] || a.spec.tempos;
        tr.addUpper(st, clip, a.blade?.name ?? a.label, clip.duration / tp);
        this.tracksUi.push({ side: s, label: a.blade?.name ?? a.label, start: st, end: st + Math.round(tp * T), kind: 'blade' });
      }
    }

    // Right-of-way events for the start of each action.
    for (const s of ['left', 'right'] as Side[]) {
      const a = acts[s];
      if (!a) continue;
      if (a.role === 'footwork' || a.role === 'bladePrep' || a.role === 'tactic' || a.role === 'feint') {
        if ((a.move ?? 0) >= 0 || a.role !== 'footwork') sideEvents.push({ t: start[s], kind: 'prep', side: s });
      }
      // A line chosen early is already established as the slice opens; otherwise the arm needs half a tempo.
      if (a.role === 'line') sideEvents.push({ t: a.timing === 'early' ? S : start[s] + Math.round(0.5 * T), kind: 'line', side: s });
      if (a.role === 'derobe') sideEvents.push({ t: start[s], kind: 'line', side: s });
      if (a.role === 'counter') sideEvents.push({ t: start[s], kind: 'counterStart', side: s, opposition: !!a.spec.opposition });
      if (a.role === 'riposte') sideEvents.push({ t: start[s], kind: 'riposteStart', side: s });
      if (a.role === 'renewal') sideEvents.push({ t: start[s], kind: 'renewalStart', side: s });
      if ((a.role === 'attack' || a.role === 'bladeAttack') && Number.isFinite(arrival[s])) {
        const compound = (a.spec.evadeLateral ?? 0) + (a.spec.evadeCircular ?? 0) > 0 || !!a.spec.pause;
        sideEvents.push({ t: start[s], kind: 'attackStart', side: s, finalStart: finalStart[s], compound, label: a.label });
      }
      if (a.role === 'bladeAttack') {
        const d = defenderOf(s);
        const derobed = d?.role === 'derobe';
        sideEvents.push({ t: start[s] + Math.round(0.3 * T), kind: 'bladeAttack', side: s, success: !derobed });
        if (derobed) {
          sideEvents.push({ t: start[s] + Math.round(0.3 * T) + 1, kind: 'derobe', side: other(s) });
          notes.push(`${s === 'left' ? 'Right' : 'Left'} derobed the attack on the blade and kept the line.`);
        } else if (d?.role === 'line') notes.push('The attack on the blade removed the point in line.');
      }
    }

    // Outcome of each offensive action: parried, evaded, blocked, short, or lands.
    const lands: Record<Side, boolean> = { left: false, right: false };
    let parryBy: Side | null = null;
    let parryTick = 0;
    for (const s of ['left', 'right'] as Side[]) {
      const a = acts[s];
      if (!a || !Number.isFinite(arrival[s]) || !a.spec.finalLine) continue;
      if (a.role === 'bladeAttack' && !a.spec.finalLine) continue;
      const d = defenderOf(s);
      const o = other(s);
      let ok = true;
      if (d?.role === 'parry' && d.spec.parry) {
        const late = d.timing === 'late';
        const res = parryOutcome(a.spec, d.spec.parry, a.role === 'counter');
        if (res === 'parried' && !late) {
          ok = false;
          parryBy = o;
          parryTick = arrival[s] - 3;
          sideEvents.push({ t: parryTick, kind: 'parry', side: o, success: true });
          notes.push(`${d.blade?.name ?? 'The parry'} caught ${a.blade?.name ?? a.label}.`);
          // Deflect the attacker's blade at the contact.
          const tr = this.tracks[s];
          const from = tr.upperAt(parryTick, T);
          tr.addUpper(parryTick, transitionUpper('deflected', from, { hand: from.hand, tip: [1, 0.25, from.tip[2] < 0 ? -0.6 : 0.6], pron: from.pron }, 0.3), 'deflected');
        } else {
          sideEvents.push({ t: arrival[s] - 2, kind: 'parry', side: o, success: false });
          notes.push(res === 'evaded' ? `${a.blade?.name ?? a.label} deceived ${d.blade?.name ?? 'the parry'}.` : late ? 'The parry was late.' : `${d.blade?.name ?? 'The parry'} closed the wrong line.`);
        }
      }
      if (ok && d?.role === 'counter' && d.spec.opposition && a.role !== 'counter') {
        const evades = a.spec.changesLine || (a.spec.evadeLateral ?? 0) > 0 || a.spec.flick;
        if (!evades && arrival[o] <= arrival[s]) {
          ok = false;
          notes.push('The time hit with opposition closed the line; the attack could not land.');
        }
      }
      if (ok && d?.spec.evasion && a.role !== 'counter') {
        const high = (a.spec.finalLine ?? '').startsWith('high');
        const beaten = a.spec.angulated || !high || (d.spec.evasion === 'inquartata' && a.spec.finalLine !== 'high-in');
        if (!beaten) {
          ok = false;
          notes.push(`The ${d.blade?.name ?? 'evasion'} took the body out of the line; the attack missed.`);
        }
      }
      if (ok && d?.role === 'derobe' && a.role === 'bladeAttack') {
        // The dérobement keeps the line; the attacker still finishes, both may land.
      }
      if (a.role === 'counter' && acts[o] && ['attack', 'bladeAttack', 'riposte', 'renewal'].includes(acts[o]!.role)) {
        // A stop hit can be parried by counter-time (CT05) handled above.
      }
      lands[s] = ok;
    }
    // A defender in line (point in line or dérobement) hits an attacker who runs onto it.
    for (const s of ['left', 'right'] as Side[]) {
      const a = acts[s];
      if (!a || (a.role !== 'line' && a.role !== 'derobe')) continue;
      const o = other(s);
      const oa = acts[o];
      const removed = oa?.role === 'bladeAttack' && a.role !== 'derobe';
      if (oa && (OFFENSIVE.has(oa.role) || oa.role === 'footwork') && !removed && (oa.move > 0 || OFFENSIVE.has(oa.role))) {
        arrival[s] = Number.isFinite(arrival[o]) ? arrival[o] - 2 : start[s] + Math.round(1.2 * T);
        lands[s] = true;
      } else if (removed) notes.push('The point in line was taken and lost its priority.');
    }

    // Geometry: place tips on target with arm IK, or record a short attack.
    const sliceEndBase = Math.max(S + T, ...(['left', 'right'] as Side[]).map((s) => (Number.isFinite(arrival[s]) ? arrival[s] : start[s] + Math.round((acts[s]?.spec.tempos ?? 1) * T))));
    for (const s of ['left', 'right'] as Side[]) {
      if (!lands[s]) {
        if (Number.isFinite(arrival[s]) && acts[s]?.spec.finalLine && acts[s]!.role !== 'counter' && !sideEvents.some((e) => e.kind === 'parry' && e.side === other(s) && e.success)) {
          // An attack that did not land and was not parried: evaded or blocked, no light.
        }
        continue;
      }
      const a = acts[s]!;
      const o = other(s);
      const t = arrival[s];
      const att = this.skeleton(s, t);
      const def = this.skeleton(o, t);
      const defFrame = this.tracks[o].frame(t, T, false);
      const fin = (a.spec.flick ? 'back' : a.spec.finalLine) as TargetLine;
      const oppAdvancing = (acts[o]?.move ?? 0) > 0 || acts[o]?.footClip === 'advance';
      const offTarget = fin.startsWith('low') && oppAdvancing;
      const tp = targetPointFor(def, defFrame, fin, offTarget);
      const approach = norm(sub(tp.point, att.joints.shoulderW));
      const angle = a.impactAngle ?? (a.spec.flick ? 35 : a.spec.angulated ? 40 : 18);
      let dir = arrivalDir(tp.normal, approach, angle);
      if (!a.spec.flick && a.impactAngle === undefined) dir = norm(add(scale(dir, 0.5), scale(approach, 0.5)));
      if (!canReach(att, this.tracks[s].rig, tp.point, dir)) {
        // Try the most direct line before declaring it short.
        if (a.spec.flick || !canReach(att, this.tracks[s].rig, tp.point, approach)) {
          sideEvents.push({ t, kind: 'short', side: s });
          notes.push(`${s === 'left' ? 'Left' : 'Right'} fell short: the measure was longer than the reach at arrival.`);
          lands[s] = false;
          continue;
        }
        dir = approach;
      }
      const realAngle = Math.acos(Math.max(-1, Math.min(1, -(dir[0] * tp.normal[0] + dir[1] * tp.normal[1] + dir[2] * tp.normal[2])))) * (180 / Math.PI);
      const hold = 5;
      for (let k = 0; k <= hold; k++) {
        const load = realAngle <= 60 ? Math.min(1, 0.35 + k * 0.15) : 0.1;
        this.tracks[s].ik.set(t + k, { point: tp.point, dir, bend: load, whip: a.spec.flick ? Math.max(0, 1 - k * 0.3) : 0 });
      }
      if (realAngle > 60) {
        sideEvents.push({ t, kind: 'flat', side: s });
        notes.push(`${s === 'left' ? 'Left' : 'Right'} landed flat (${realAngle.toFixed(0)}°): no light.`);
        lands[s] = false;
        continue;
      }
      this.claimed.push({ side: s, tick: t, point: tp.point, dir, valid: tp.capsule.valid, part: tp.capsule.part, angle: realAngle });
      sideEvents.push({ t, kind: 'hit', side: s, valid: tp.capsule.valid });
    }

    // Flèche runs past; corps-à-corps when bodies close with no passing action.
    for (const s of ['left', 'right'] as Side[]) {
      const a = acts[s];
      if (a?.footClip === 'fleche' || a?.footClip === 'advanceFleche') {
        const tr = this.tracks[s];
        const t0 = start[s] + Math.round(FOOTWORK_CLIPS[a.footClip].duration * T);
        const from = tr.lowerAt(t0, T);
        const rel = { ...from, pelvisX: from.pelvisX - tr.disp, frontX: from.frontX - tr.disp, rearX: from.rearX - tr.disp };
        tr.addLower(t0, transitionLower('runPast', rel, { ...EN_GARDE_LOWER, pelvisX: rel.pelvisX + 2.6, frontX: rel.frontX + 2.6, rearX: rel.rearX + 2.4, sideShift: -0.75, lean: 6 }, 1.4));
        this.ended = true;
      }
    }
    const endTick = sliceEndBase + Math.round(0.3 * T);
    const gap = Math.abs(this.skeleton('right', endTick).joints.pelvis[0] - this.skeleton('left', endTick).joints.pelvis[0]);
    const passing = (['left', 'right'] as Side[]).some((s) => acts[s]?.footClip === 'fleche' || acts[s]?.footClip === 'advanceFleche');
    const anyHit = sideEvents.some((e) => e.kind === 'hit');
    if (gap < 0.45 && !passing && !anyHit) {
      sideEvents.push({ t: endTick, kind: 'corps' });
      this.captions.push({ t: endTick, text: 'Corps-à-corps: halt, no touch (rule 11).' });
      this.ended = true;
    }
    for (const s of ['left', 'right'] as Side[]) {
      const rear = this.skeleton(s, endTick).joints.heelR[0];
      if (Math.abs(rear) > 7 && !anyHit) {
        sideEvents.push({ t: endTick, kind: 'endLine', side: s });
        this.captions.push({ t: endTick, text: 'Both feet over the end line: penalty touch (rule 11).' });
        this.ended = true;
      }
    }

    this.events.push(...sideEvents);
    this.tick = endTick;
    // Next phrase state.
    const off = offSides.filter((s) => acts[s]!.spec.finalLine);
    if (off.length) this.lastAttacker = off[0];
    let next: PhraseStateName = 'PREPARATION';
    if (anyHit) {
      next = 'TOUCH';
      this.ended = true;
    } else if (parryBy) {
      next = this.state === 'PARRY_CONTACT' || this.state === 'RIPOSTE' || this.state === 'COUNTER_RIPOSTE' ? 'COUNTER_RIPOSTE' : 'PARRY_CONTACT';
      this.lastParry = { side: parryBy, tick: parryTick };
      this.tick = parryTick + 2;
    } else if (sideEvents.some((e) => e.kind === 'short')) {
      next = 'PARRY_CONTACT';
      const shortSide = (sideEvents.find((e) => e.kind === 'short') as { side: Side }).side;
      this.lastParry = { side: other(shortSide), tick: this.tick };
    } else if (off.length) next = 'ATTACK';
    else if (acts.left?.role === 'line' || acts.right?.role === 'line') next = 'POINT_IN_LINE';
    else if (acts.left?.role === 'counter' || acts.right?.role === 'counter') next = 'COUNTERATTACK';
    if (this.ended && next !== 'TOUCH') next = 'HALT';
    if (this.sliceCount >= 6 && !this.ended) {
      this.ended = true;
      next = 'HALT';
      this.captions.push({ t: this.tick, text: 'Halte: six tempo slices without a touch.' });
    }
    // Reset lunged state for footwork-only slices.
    for (const s of ['left', 'right'] as Side[]) if (!lunging[s] && acts[s]?.role === 'footwork') this.tracks[s].lunged = false;
    this.state = next;
    const pr = walkPriority(this.events, T);
    this.holder = pr.holder;
    const note = notes.join(' ') || (off.length ? 'The action did not land.' : 'Footwork and preparation; the phrase continues.');
    this.slices.push({ start: S, end: this.tick, state: next, note });
    return { state: next, holder: this.holder, ended: this.ended, note, end: this.tick };
  }

  /** Finish: generate frames, run hit detection on the geometry, light the box, and call the phrase. */
  finish(): PhraseResult {
    const T = this.T;
    const lastEvent = Math.max(this.tick, ...this.events.map((e) => e.t));
    const endTick = lastEvent + Math.round(1.6 * T);
    // Recovery at the end so the replay settles.
    for (const s of ['left', 'right'] as Side[]) {
      const tr = this.tracks[s];
      const at = lastEvent + Math.round(0.4 * T);
      const from = tr.upperAt(at, T);
      tr.addUpper(at, transitionUpper('recover', from, SIXTE_GUARD, 0.8), 'sixte');
      if (tr.lunged) this.recoverIfLunged(s, at + 4);
    }
    const frames: PhraseResult['frames'] = [];
    for (let t = 0; t <= endTick; t++) frames.push({ left: this.tracks.left.frame(t, T), right: this.tracks.right.frame(t, T) });

    // Hit detection on the animated geometry (spec 5.5).
    const registered: Registered[] = [];
    for (const s of ['left', 'right'] as Side[]) {
      const o = other(s);
      let run = 0;
      let first = -1;
      let done = false;
      for (let t = 0; t <= endTick && !done; t++) {
        const f = frames[t][s];
        const sk = buildSkeleton(f, this.tracks[s].rig);
        const dk = buildSkeleton(frames[t][o], this.tracks[o].rig);
        const c = f.ik ? tipContact(sk.tip, sk.tipDir, dk) : null;
        const loadN = f.bend * 12;
        if (c && c.angle <= 60 && loadN > MIN_TIP_LOAD_N) {
          if (run === 0) first = t;
          run += 1;
          if (run >= MIN_CONTACT_TICKS) {
            registered.push({ side: s, tick: first, valid: c.capsule.valid, part: c.capsule.part });
            done = true;
          }
        } else run = 0;
      }
    }
    registered.sort((a, b) => a.tick - b.tick);
    let lockoutStart: number | null = null;
    const lit: Registered[] = [];
    if (registered.length) {
      lockoutStart = registered[0].tick;
      for (const r of registered) if (r.tick <= lockoutStart + LOCKOUT_TICKS) lit.push(r);
    }
    const lights = {
      red: lit.some((r) => r.side === 'left' && r.valid),
      green: lit.some((r) => r.side === 'right' && r.valid),
      whiteLeft: lit.some((r) => r.side === 'left' && !r.valid),
      whiteRight: lit.some((r) => r.side === 'right' && !r.valid),
    };
    const verdict = decide(this.events, T);
    const pr = walkPriority(this.events, T);
    if (verdict.scorer || lit.length) this.captions.push({ t: (lockoutStart ?? lastEvent) + LOCKOUT_TICKS, text: `${verdict.callFr} (${verdict.callEn})` });
    else this.captions.push({ t: lastEvent + 6, text: `${verdict.callFr} (${verdict.callEn})` });
    const r6 = (n: number) => Math.round(n * 1e4) / 1e4;
    const digest = JSON.stringify({
      e: this.events,
      reg: registered,
      v: verdict.callFr,
      f: frames.filter((_, i) => i % 6 === 0).map((f) => [f.left.lower.pelvisX, f.left.upper.hand, f.right.lower.pelvisX, f.right.upper.hand].flat().map((x) => r6(x as number))),
    });
    return {
      seed: this.cfg.seed,
      tempoTicks: T,
      frames,
      events: [...this.events].sort((a, b) => a.t - b.t),
      claimed: this.claimed,
      registered,
      lights,
      lockoutStart,
      verdict,
      tracks: this.tracksUi,
      priority: pr.timeline,
      slices: this.slices,
      captions: this.captions,
      hash: fnv1a(digest),
      endTick,
    };
  }
}

/** Convenience: run a scripted phrase of slices. */
export function runPhrase(cfg: PhraseConfig, slices: [Choice, Choice][]): PhraseResult {
  const sim = new PhraseSim(cfg);
  for (const [l, r] of slices) {
    if (sim.ended) break;
    sim.slice(l, r);
  }
  return sim.finish();
}

export const DEFAULT_CONFIG: PhraseConfig = { seed: 1, tempoSec: 0.3, left: { height: 1.78, handed: 1 }, right: { height: 1.78, handed: 1 } };

/** Place both fencers so the left fencer's measure equals `measure` metres. */
export function configAtMeasure(base: PhraseConfig, measure: number): PhraseConfig {
  const probe = new PhraseSim({ ...base, leftX: -1, rightX: 1 });
  const m0 = probe.measure('left', 0);
  const d = 2 + (measure - m0);
  return { ...base, leftX: -d / 2, rightX: d / 2 };
}

