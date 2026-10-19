import type { FencerFrame } from '../rig/skeleton';
import type { V3 } from '../rig/vec';

export const TICK_HZ = 120;
export const LOCKOUT_TICKS = Math.round(0.3 * TICK_HZ);
/** 14 ms of sustained load at 120 Hz rounds up to 2 consecutive ticks. */
export const MIN_CONTACT_TICKS = Math.ceil(0.014 * TICK_HZ);
export const MIN_TIP_LOAD_N = 4.9;

export type Side = 'left' | 'right';
export const other = (s: Side): Side => (s === 'left' ? 'right' : 'left');
export type Timing = 'early' | 'onTime' | 'late';

export interface Choice {
  foot?: string;
  blade?: string;
  timing?: Timing;
  /** Test hook: force the impact angle (degrees from the surface normal). */
  impactAngle?: number;
  /** Aim the final in a specific line (used by demos and drills). */
  finalLine?: import('../data/types').TargetLine;
}

export type PhraseStateName =
  | 'NEUTRAL'
  | 'PREPARATION'
  | 'ATTACK'
  | 'PARRY_CONTACT'
  | 'RIPOSTE'
  | 'COUNTER_RIPOSTE'
  | 'COUNTERATTACK'
  | 'POINT_IN_LINE'
  | 'HALT'
  | 'TOUCH';

export type RowEvent =
  | { t: number; kind: 'prep'; side: Side }
  | { t: number; kind: 'line'; side: Side }
  | { t: number; kind: 'attackStart'; side: Side; finalStart: number; compound: boolean; label?: string }
  | { t: number; kind: 'bladeAttack'; side: Side; success: boolean }
  | { t: number; kind: 'derobe'; side: Side }
  | { t: number; kind: 'parry'; side: Side; success: boolean; point?: V3 }
  | { t: number; kind: 'short'; side: Side }
  | { t: number; kind: 'riposteStart'; side: Side }
  | { t: number; kind: 'renewalStart'; side: Side }
  | { t: number; kind: 'counterStart'; side: Side; opposition: boolean }
  | { t: number; kind: 'hit'; side: Side; valid: boolean }
  | { t: number; kind: 'flat'; side: Side }
  | { t: number; kind: 'corps' }
  | { t: number; kind: 'endLine'; side: Side };

export interface ClaimedHit {
  side: Side;
  tick: number;
  point: V3;
  dir: V3;
  valid: boolean;
  part: string;
  angle: number;
}

export interface Lights {
  red: boolean;
  green: boolean;
  whiteLeft: boolean;
  whiteRight: boolean;
}

export interface Registered {
  side: Side;
  tick: number;
  valid: boolean;
  part: string;
}

export interface Verdict {
  scorer: Side | null;
  penalty?: boolean;
  callFr: string;
  callEn: string;
  rule: number | string;
  why: string;
}

export interface TrackSegment {
  side: Side;
  label: string;
  start: number;
  end: number;
  kind: 'foot' | 'blade';
}

export interface PhraseResult {
  seed: number;
  tempoTicks: number;
  frames: { left: FencerFrame; right: FencerFrame }[];
  events: RowEvent[];
  claimed: ClaimedHit[];
  registered: Registered[];
  lights: Lights;
  lockoutStart: number | null;
  verdict: Verdict;
  tracks: TrackSegment[];
  priority: { t: number; side: Side | null }[];
  slices: { start: number; end: number; state: PhraseStateName; note: string }[];
  captions: { t: number; text: string }[];
  hash: string;
  endTick: number;
}
