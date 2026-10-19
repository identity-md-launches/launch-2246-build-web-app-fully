import { OpponentModel, npcChoose, reactionTiming, situationKey, type NpcLevel } from '../ai/npc';
import { FOOTWORK_CLIPS, makeBladeClip, mixLayers, offsetLower, sampleLower, sampleUpper, type Clip } from '../anim/clips';
import { EN_GARDE_LOWER, SIXTE_GUARD, type LowerPose, type UpperPose } from '../anim/poses';
import { makeRig, type RigDims } from '../rig/dimensions';
import { buildSkeleton, type FencerFrame } from '../rig/skeleton';
import { add, norm, scale, sub } from '../rig/vec';
import { decide, walkPriority } from '../referee/row';
import { arrivalDir, bothFeetBeyondEnd, canReach, contactFrames, targetPointFor, tipContact } from './geometry';
import { combine, parryOutcome, PhraseSim, type Action, type PhraseConfig } from './phrase';
import { fnv1a, mulberry32, type Rng } from './prng';
import { LOCKOUT_TICKS, MIN_CONTACT_TICKS, MIN_TIP_LOAD_N, TICK_HZ, other, type Choice, type PhraseResult, type RowEvent, type Side } from './types';

/** Inputs, rather than completed turns, are the replay source for a real-time phrase. */
export interface TempoAction {
  tick: number;
  side: Side;
  choice: Choice;
}
type Layer<P> = { start: number; clip: Clip<P> };
type Active = { action: Action; start: number; arrival: number; end: number; resolved: boolean; bladeContactDone?: boolean };
type ContactHold = { action: Action; until: number; run: number; first: number };
const SIDES: Side[] = ['left', 'right'];
const OFFENSIVE = new Set(['attack', 'bladeAttack', 'riposte', 'renewal', 'counter']);

/**
 * Incremental 120 Hz simulation. Each channel starts at the input tick: starting a blade action
 * leaves the feet moving, while a new foot action interrupts only the lower-body channel.
 * No future turn is resolved at input time, so a later parry can still catch an incoming attack.
 */
export class TempoSim {
  tick = 0;
  ended = false;
  readonly actions: TempoAction[] = [];
  readonly frames: PhraseResult['frames'] = [];
  readonly events: RowEvent[] = [];
  readonly registered: PhraseResult['registered'] = [];
  readonly claimed: PhraseResult['claimed'] = [];
  readonly tracks: PhraseResult['tracks'] = [];
  readonly captions: PhraseResult['captions'] = [{ t: 0, text: 'En garde! Prêts? Allez!' }];
  readonly T: number;
  readonly rigs: Record<Side, RigDims>;
  private lower: Record<Side, Layer<LowerPose>[]> = { left: [], right: [] };
  private upper: Record<Side, Layer<UpperPose>[]> = { left: [], right: [] };
  private active: Partial<Record<Side, Active>> = {};
  private contacts: Partial<Record<Side, ContactHold>> = {};
  private lastParry: { side: Side; tick: number } | null = null;
  private lastAttacker: Side | null = null;
  private failed = new Set<Side>();
  lockoutStart: number | null = null;

  constructor(readonly cfg: PhraseConfig) {
    this.T = Math.round(cfg.tempoSec * TICK_HZ);
    this.rigs = { left: makeRig(cfg.left.height), right: makeRig(cfg.right.height) };
    this.frames.push(this.baseFrames());
  }

  private lowerAt(side: Side): LowerPose {
    const seg = this.lower[side].at(-1);
    return seg ? sampleLower(seg.clip, Math.min(seg.clip.duration, (this.tick - seg.start) / this.T)) : EN_GARDE_LOWER;
  }
  private upperAt(side: Side): UpperPose {
    const seg = this.upper[side].at(-1);
    return seg ? sampleUpper(seg.clip, Math.min(seg.clip.duration, (this.tick - seg.start) / this.T)) : SIXTE_GUARD;
  }
  private baseFrames(): PhraseResult['frames'][number] {
    const frame = (side: Side): FencerFrame => ({
      rootX: side === 'left' ? this.cfg.leftX ?? -2.25 : this.cfg.rightX ?? 2.25,
      facing: side === 'left' ? 1 : -1,
      handed: this.cfg[side].handed,
      ...mixLayers(this.lowerAt(side), this.upperAt(side)),
      bend: 0,
      bendDir: [0, 1, 0],
      whip: 0,
    });
    return { left: frame('left'), right: frame('right') };
  }

  /** Existing legality/AI uses a snapshot of the positions and state at the current tick. */
  context(): PhraseSim {
    const f = this.baseFrames();
    const sim = new PhraseSim({
      ...this.cfg,
      leftX: f.left.rootX + f.left.lower.pelvisX * this.rigs.left.scale,
      rightX: f.right.rootX - f.right.lower.pelvisX * this.rigs.right.scale,
    });
    sim.lastParry = this.lastParry;
    sim.lastAttacker = this.lastAttacker;
    sim.state = this.ended ? 'HALT' : this.lastParry ? 'PARRY_CONTACT' : this.failed.size ? 'PARRY_CONTACT' : SIDES.some((s) => this.active[s] && OFFENSIVE.has(this.active[s]!.action.role) && !this.active[s]!.resolved) ? 'ATTACK' : 'PREPARATION';
    sim.tick = this.tick;
    for (const side of SIDES) {
      const lower = this.lowerAt(side);
      sim.tracks[side].lunged = lower.frontX - lower.rearX > 0.72;
    }
    return sim;
  }
  legal(side: Side) {
    return this.context().legal(side);
  }

  /** Accept at the current clock tick, never at the end of an animation. */
  input(side: Side, choice: Choice): boolean {
    if (this.ended) return false;
    const legal = this.legal(side);
    const accepted: Choice = { ...choice, timing: 'early' };
    if (accepted.foot && !legal.foot.includes(accepted.foot)) delete accepted.foot;
    if (accepted.blade && !legal.blade.includes(accepted.blade)) delete accepted.blade;
    if (!accepted.foot && !accepted.blade) return false;
    const a = combine(side, accepted)!;
    this.actions.push({ tick: this.tick, side, choice: { ...accepted } });
    const hasBlade = !!accepted.blade || OFFENSIVE.has(a.role) || a.role === 'line' || a.role === 'derobe';
    const previous = this.active[side];
    if (hasBlade && previous && OFFENSIVE.has(previous.action.role) && !previous.resolved) {
      this.events.push({ t: this.tick, kind: 'short', side });
      this.failed.add(side);
    }
    if (a.footClip && (accepted.foot || !this.lower[side].length || this.tick >= this.lower[side].at(-1)!.start + this.lower[side].at(-1)!.clip.duration * this.T)) {
      const original = FOOTWORK_CLIPS[a.footClip];
      const from = this.lowerAt(side);
      const duration = OFFENSIVE.has(a.role) ? a.spec.tempos : original.duration;
      const ratio = duration / original.duration;
      const clip: Clip<LowerPose> = {
        ...original,
        duration,
        keys: original.keys.map((k, i) => ({ ...k, t: k.t * ratio, pose: i === 0 ? from : offsetLower(k.pose, from.pelvisX) })),
      };
      this.lower[side].push({ start: this.tick, clip });
      this.tracks.push({ side, kind: 'foot', label: a.foot?.name ?? original.id, start: this.tick, end: this.tick + Math.round(duration * this.T) });
    }
    if (hasBlade) {
      const original = makeBladeClip(a.blade?.id ?? a.foot!.id, a.spec);
      const from = this.upperAt(side);
      const clip = { ...original, keys: original.keys.map((k, i) => i === 0 ? { ...k, pose: from } : k) };
      this.upper[side].push({ start: this.tick, clip });
      this.tracks.push({ side, kind: 'blade', label: a.blade?.name ?? a.label, start: this.tick, end: this.tick + Math.round(clip.duration * this.T) });
      this.active[side] = { action: a, start: this.tick, arrival: this.tick + Math.round(a.spec.tempos * this.T), end: this.tick + Math.round(clip.duration * this.T), resolved: false };
      delete this.contacts[side];
      if (OFFENSIVE.has(a.role) && a.spec.finalLine) {
        const compound = (a.spec.evadeLateral ?? 0) + (a.spec.evadeCircular ?? 0) > 0 || !!a.spec.pause;
        if (a.role === 'counter') this.events.push({ t: this.tick, kind: 'counterStart', side, opposition: !!a.spec.opposition });
        else if (a.role === 'riposte') this.events.push({ t: this.tick, kind: 'riposteStart', side });
        else if (a.role === 'renewal') this.events.push({ t: this.tick, kind: 'renewalStart', side });
        else this.events.push({ t: this.tick, kind: 'attackStart', side, finalStart: compound ? this.tick + Math.round((a.spec.tempos - 1) * this.T) : this.tick, compound, label: a.label });
        this.lastAttacker = side;
        this.lastParry = null;
      } else if (a.role === 'line' || a.role === 'derobe') this.events.push({ t: this.tick + (a.role === 'line' ? Math.round(this.T * 0.5) : 0), kind: 'line', side });
      else if (a.role !== 'parry') this.events.push({ t: this.tick, kind: 'prep', side });
    } else if (a.move >= 0) this.events.push({ t: this.tick, kind: 'prep', side });
    const current = this.frames[this.tick];
    const updated = this.baseFrames();
    // An input on the very contact tick must retain the already verified contact frame.
    for (const s of SIDES) if (current[s].ik) updated[s] = current[s];
    this.frames[this.tick] = updated;
    return true;
  }

  private arrive(side: Side, frames: PhraseResult['frames'][number]) {
    const pending = this.active[side];
    if (!pending || pending.resolved || !OFFENSIVE.has(pending.action.role) || this.tick < pending.arrival) return;
    pending.resolved = true;
    const a = pending.action;
    const o = other(side);
    const defender = this.active[o];
    if (defender?.action.spec.evasion && defender.start <= this.tick && this.tick <= defender.end + this.T && a.role !== 'counter') {
      const high = a.spec.finalLine?.startsWith('high');
      const evades = !a.spec.angulated && high && (defender.action.spec.evasion !== 'inquartata' || a.spec.finalLine === 'high-in');
      if (evades) {
        this.events.push({ t: this.tick, kind: 'short', side });
        this.failed.add(side);
        this.captions.push({ t: this.tick, text: 'The body evasion took the target out of the attacking line.' });
        return;
      }
    }
    if (defender?.action.role === 'parry' && defender.action.spec.parry) {
      const ready = defender.start + Math.round(defender.action.spec.tempos * this.T * 0.8);
      const inTime = ready <= this.tick && this.tick <= defender.end + this.T;
      const catches = parryOutcome(a.spec, defender.action.spec.parry, a.role === 'counter') === 'parried';
      const contact = inTime && catches ? contactFrames(frames[side], frames[o], this.rigs[side], this.rigs[o]) : null;
      this.events.push({ t: this.tick, kind: 'parry', side: o, success: !!contact, ...(contact ? { point: contact.point } : {}) });
      if (contact) {
        frames[side] = contact.attacker;
        frames[o] = contact.defender;
        this.lastParry = { side: o, tick: this.tick };
        this.failed.add(side);
        this.captions.push({ t: this.tick, text: `${defender.action.blade?.name ?? 'Parry'} catches the attack. Riposte now.` });
        return;
      }
    }
    if (!a.spec.finalLine) return;
    if (!this.aim(side, a, frames)) {
      this.events.push({ t: this.tick, kind: 'short', side });
      this.failed.add(side);
      this.captions.push({ t: this.tick, text: `${side === 'left' ? 'Left' : 'Right'} fell short. The phrase continues.` });
      return;
    }
    this.contacts[side] = { action: a, until: this.tick + 5, run: 0, first: this.tick };
  }

  private aim(side: Side, action: Action, frames: PhraseResult['frames'][number]) {
    const o = other(side);
    const att = buildSkeleton(frames[side], this.rigs[side]);
    const def = buildSkeleton(frames[o], this.rigs[o]);
    const target = targetPointFor(def, frames[o], action.spec.flick ? 'back' : action.spec.finalLine!);
    const approach = norm(sub(target.point, att.joints.shoulderW));
    let dir = arrivalDir(target.normal, approach, action.impactAngle ?? (action.spec.flick ? 35 : action.spec.angulated ? 40 : 18));
    if (!action.spec.flick && action.impactAngle === undefined) dir = norm(add(scale(dir, 0.5), scale(approach, 0.5)));
    if (!canReach(att, this.rigs[side], target.point, dir)) {
      if (action.spec.flick || !canReach(att, this.rigs[side], target.point, approach)) return null;
      dir = approach;
    }
    return { target, dir, def };
  }

  private step() {
    this.tick += 1;
    const frames = this.baseFrames();
    // A line remains threatening while the opponent moves into its reach. Taking the blade
    // removes it; a derobement evades that contact and preserves the established line.
    for (const side of SIDES) {
      const active = this.active[side];
      if (!active) continue;
      const o = other(side);
      const defender = this.active[o];
      if (active.action.role === 'bladeAttack' && !active.bladeContactDone && this.tick >= active.start + Math.round(0.3 * this.T)) {
        const contact = contactFrames(frames[side], frames[o], this.rigs[side], this.rigs[o]);
        if (contact) {
          active.bladeContactDone = true;
          const derobed = defender?.action.role === 'derobe';
          this.events.push({ t: this.tick, kind: 'bladeAttack', side, success: !derobed });
          if (derobed) this.events.push({ t: this.tick, kind: 'derobe', side: o });
          else {
            frames[side] = contact.attacker;
            frames[o] = contact.defender;
            if (defender?.action.role === 'line') {
              defender.resolved = true;
              delete this.contacts[o];
            }
          }
        }
      }
      if ((active.action.role === 'line' || active.action.role === 'derobe') && !active.resolved) {
        const established = active.start + (active.action.role === 'line' ? Math.round(0.5 * this.T) : 0);
        const foot = this.lower[o].at(-1);
        const advancing = foot && this.tick < foot.start + foot.clip.duration * this.T && foot.clip.keys.at(-1)!.pose.pelvisX > foot.clip.keys[0].pose.pelvisX;
        const attacking = defender && OFFENSIVE.has(defender.action.role) && !defender.resolved && this.tick >= defender.arrival - 2;
        if (this.tick >= established && (advancing || attacking) && active.action.spec.finalLine && this.aim(side, active.action, frames)) {
          this.contacts[side] = { action: active.action, until: this.tick + 5, run: 0, first: this.tick };
          active.resolved = true;
        }
      }
    }
    for (const side of SIDES) this.arrive(side, frames);
    for (const side of SIDES) {
      const hold = this.contacts[side];
      if (!hold || this.tick > hold.until) continue;
      const aimed = this.aim(side, hold.action, frames);
      if (!aimed) continue;
      const { target, dir, def } = aimed;
      const bend = Math.min(1, 0.35 + (this.tick - (hold.until - 5)) * 0.15);
      frames[side] = { ...frames[side], ik: { point: target.point, dir }, bend };
      const rigged = buildSkeleton(frames[side], this.rigs[side]);
      const contact = tipContact(rigged.tip, rigged.tipDir, def);
      if (contact && contact.angle <= 60 && bend * 12 > MIN_TIP_LOAD_N) {
        if (!hold.run) hold.first = this.tick;
        hold.run += 1;
        if (hold.run >= MIN_CONTACT_TICKS && !this.registered.some((h) => h.side === side) && (this.lockoutStart === null || hold.first <= this.lockoutStart + LOCKOUT_TICKS)) {
          const hit = { side, tick: hold.first, valid: contact.capsule.valid, part: contact.capsule.part };
          this.registered.push(hit);
          this.claimed.push({ ...hit, point: target.point, dir, angle: contact.angle });
          this.events.push({ t: hit.tick, kind: 'hit', side, valid: hit.valid });
          this.lockoutStart ??= hit.tick;
        }
      } else hold.run = 0;
    }
    this.frames.push(frames);
    const hit = this.lockoutStart !== null;
    if (!hit) {
      for (const side of SIDES) {
        const sk = buildSkeleton(frames[side], this.rigs[side]);
        if (bothFeetBeyondEnd(sk)) {
          this.events.push({ t: this.tick, kind: 'endLine', side });
          this.halt('Both feet over the end line: penalty touch (rule 11).');
          break;
        }
      }
      const gap = Math.abs(buildSkeleton(frames.left, this.rigs.left).joints.pelvis[0] - buildSkeleton(frames.right, this.rigs.right).joints.pelvis[0]);
      if (gap < 0.45 && !SIDES.some((s) => this.active[s]?.action.footClip?.toLowerCase().includes('fleche'))) {
        this.events.push({ t: this.tick, kind: 'corps' });
        this.halt('Corps-à-corps: halt, no touch (rule 11).');
      }
    }
    if (this.lockoutStart !== null && this.tick >= this.lockoutStart + LOCKOUT_TICKS) this.halt();
  }

  advanceTo(tick: number) {
    const target = Math.max(this.tick, Math.floor(tick));
    while (!this.ended && this.tick < target) this.step();
  }
  halt(caption = 'Halte!') {
    if (this.ended) return;
    this.ended = true;
    this.captions.push({ t: this.tick, text: caption });
  }
  result(): PhraseResult {
    const events = this.events.filter((e) => e.t <= this.tick).sort((a, b) => a.t - b.t);
    const verdict = decide(events, this.T);
    const lit = this.registered;
    return {
      seed: this.cfg.seed, tempoTicks: this.T, frames: this.frames, events,
      claimed: this.claimed, registered: lit, lockoutStart: this.lockoutStart,
      lights: { red: lit.some((h) => h.side === 'left' && h.valid), green: lit.some((h) => h.side === 'right' && h.valid), whiteLeft: lit.some((h) => h.side === 'left' && !h.valid), whiteRight: lit.some((h) => h.side === 'right' && !h.valid) },
      verdict, tracks: this.tracks, priority: walkPriority(events, this.T).timeline,
      slices: [{ start: 0, end: this.tick, state: this.ended ? 'HALT' : this.context().state, note: 'Real-time actions start at their recorded input ticks.' }],
      captions: this.ended ? [...this.captions, { t: this.tick, text: `${verdict.callFr} (${verdict.callEn})` }] : this.captions,
      hash: fnv1a(JSON.stringify({ cfg: this.cfg, actions: this.actions, events })), endTick: this.tick,
    };
  }
}

/** The NPC observes an input now and starts its response only after its sampled reaction delay. */
export class TempoSession {
  readonly sim: TempoSim;
  private readonly rng: Rng;
  private readonly model: OpponentModel;
  private reactionAt: number | null = null;
  private active = false;
  constructor(cfg: PhraseConfig, readonly opponent: 'human' | NpcLevel, model = new OpponentModel()) {
    this.sim = new TempoSim(cfg);
    this.rng = mulberry32(cfg.seed);
    this.model = model;
  }
  get nextReactionTick() { return this.reactionAt; }
  private scheduleReaction() {
    if (this.opponent === 'human' || this.reactionAt !== null || this.sim.ended) return;
    const { reaction } = reactionTiming(this.opponent, this.rng, this.sim.cfg.tempoSec);
    this.reactionAt = this.sim.tick + Math.ceil(reaction * TICK_HZ);
  }
  input(side: Side, choice: Choice, tick = this.sim.tick) {
    this.advanceTo(tick);
    if (side === 'right' && this.opponent !== 'human') return false;
    const context = this.sim.context();
    if (!this.sim.input(side, choice)) return false;
    if (side === 'left') this.model.record(situationKey(context, side), choice);
    this.active = true;
    this.scheduleReaction();
    return true;
  }
  advanceTo(tick: number) {
    const target = Math.max(this.sim.tick, Math.floor(tick));
    while (!this.sim.ended && this.sim.tick < target) {
      this.sim.advanceTo(this.sim.tick + 1);
      if (!this.sim.ended && this.opponent !== 'human' && this.reactionAt !== null && this.sim.tick >= this.reactionAt) {
        this.reactionAt = null;
        const choice = npcChoose(this.sim.context(), 'right', this.opponent, this.rng, this.model, this.sim.cfg.tempoSec);
        this.sim.input('right', { ...choice, timing: 'early' });
        // Subsequent decisions keep real reaction time; do not restart an unfinished NPC action.
        if (this.active) {
          this.scheduleReaction();
          const actionEnd = Math.max(this.sim.tick, ...this.sim.tracks.filter((t) => t.side === 'right').map((t) => t.end));
          if (this.reactionAt !== null) this.reactionAt = Math.max(this.reactionAt, actionEnd);
        }
      }
    }
  }
}

/** Saved Tempo phrases replay from the same timestamped inputs, independent of rendering speed. */
export function replayTempo(cfg: PhraseConfig, actions: TempoAction[], endTick: number): PhraseResult {
  const sim = new TempoSim(cfg);
  for (const action of actions) {
    sim.advanceTo(action.tick);
    sim.input(action.side, action.choice);
  }
  sim.advanceTo(endTick);
  sim.halt();
  return sim.result();
}
