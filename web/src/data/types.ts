export type Category = 'footwork' | 'parry' | 'attack' | 'blade' | 'riposte' | 'tactic';
export type Level = 'intermediate' | 'advanced';
export type LineName = 'high' | 'low' | 'inside' | 'outside';
/** Quadrant the point finishes in, from the attacker's view of the defender. */
export type TargetLine = 'high-in' | 'high-out' | 'low-in' | 'low-out' | 'back';
export type Reliability = 'reliable' | 'situational' | 'risky';

/** How the resolver treats the action. */
export type Role =
  | 'stance'
  | 'footwork'
  | 'attack'
  | 'parry'
  | 'bladePrep'
  | 'bladeAttack'
  | 'derobe'
  | 'riposte'
  | 'renewal'
  | 'counter'
  | 'line'
  | 'feint'
  | 'tactic';

/** Distance the attacking footwork adds to the reach. */
export type Reach = 'extend' | 'shortLunge' | 'lunge' | 'advLunge' | 'fleche';

export type ParryType =
  | 'lateral'
  | 'circular'
  | 'semicircular'
  | 'diagonal'
  | 'beat'
  | 'ceding'
  | 'opposition'
  | 'successive'
  | 'covered';

export type Position = 'quarte' | 'sixte' | 'septime' | 'octave' | 'prime' | 'seconde' | 'tierce' | 'quinte' | 'quinteHigh';

export interface SimSpec {
  role: Role;
  /** Total duration in tempo units. */
  tempos: number;
  reach?: Reach;
  /** Footwork displacement in metres at 1.78 m (positive = forward). */
  move?: number;
  finalLine?: TargetLine;
  /** Lateral parries this attack deceives. */
  evadeLateral?: number;
  /** Circular parries this attack deceives. */
  evadeCircular?: number;
  /** Evades a lateral parry made toward the original line only (disengage family). */
  changesLine?: boolean;
  flick?: boolean;
  angulated?: boolean;
  /** Pause inside the action, in tempo units. */
  pause?: number;
  parry?: { type: ParryType; positions: Position[] };
  bladeOn?: 'beat' | 'pressure' | 'prise' | 'engage';
  opposition?: boolean;
  evasion?: 'duck' | 'inquartata' | 'passata';
  /** Riposte/renewal start delay in tempo units. */
  delay?: number;
  /** Arm lifts (cut-over), vulnerable to stop hit in tempo. */
  armLift?: boolean;
}

export interface CounterLink {
  id: string;
  reliability: Reliability;
  why: string;
}

export interface Phase {
  name: 'preparation' | 'execution' | 'finish' | 'recovery';
  start: number;
  end: number;
}

export interface Technique {
  id: string;
  name: string;
  french: string;
  aliases: string[];
  category: Category;
  level: Level;
  lines: LineName[];
  description: string;
  whenToUse: string;
  steps: string[];
  commonErrors: string[];
  tacticalNotes: string;
  rowNotes: string;
  phases: Phase[];
  footworkClip?: string;
  bladeClip?: string;
  syncMarkers: Record<string, number>;
  counteredBy: CounterLink[];
  counters: CounterLink[];
  prerequisites: string[];
  demoScenario: { partner: string; partnerRole: 'passive' | 'reacting'; note: string };
  sim: SimSpec;
}
