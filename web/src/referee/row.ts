import { LOCKOUT_TICKS, other, type RowEvent, type Side, type Verdict } from '../sim/types';
import { explain, type Outcome } from './explain';

type PriorityKind = 'none' | 'line' | 'attack' | 'parry' | 'defender' | 'riposte' | 'delayedRiposte' | 'counterRiposte';

export interface PriorityState {
  holder: Side | null;
  kind: PriorityKind;
  lineSide: Side | null;
  attackStart: Partial<Record<Side, number>>;
  finalStart: Partial<Record<Side, number>>;
  compound: Partial<Record<Side, boolean>>;
  counter: Partial<Record<Side, { t: number; opposition: boolean }>>;
  prepBy: Partial<Record<Side, number>>;
  parryTick: number | null;
  parries: number;
  simultaneous: boolean;
  renewal: Partial<Record<Side, number>>;
  timeline: { t: number; side: Side | null }[];
}

/**
 * Right-of-way state machine (FIE foil conventions, rules numbered as in the spec 5.6).
 * Walks the event timeline and tracks who holds priority at every moment.
 */
export function walkPriority(events: RowEvent[], tempo: number, until = Infinity): PriorityState {
  const s: PriorityState = {
    holder: null,
    kind: 'none',
    lineSide: null,
    attackStart: {},
    finalStart: {},
    compound: {},
    counter: {},
    prepBy: {},
    parryTick: null,
    parries: 0,
    simultaneous: false,
    renewal: {},
    timeline: [{ t: 0, side: null }],
  };
  const set = (t: number, side: Side | null, kind: PriorityKind) => {
    s.holder = side;
    s.kind = kind;
    s.timeline.push({ t, side });
  };
  const sorted = [...events].sort((a, b) => a.t - b.t);
  for (const e of sorted) {
    if (e.t > until) break;
    switch (e.kind) {
      case 'prep':
        s.prepBy[e.side] ??= e.t;
        break;
      case 'line': {
        // Rule 3: the line must be established before the opponent's final movement starts.
        const opp = other(e.side);
        const oppFinal = s.finalStart[opp];
        if (oppFinal === undefined || e.t < oppFinal) {
          s.lineSide = e.side;
          if (s.holder !== opp || s.kind !== 'attack' || (s.attackStart[opp] ?? Infinity) > e.t) set(e.t, e.side, 'line');
        }
        break;
      }
      case 'attackStart': {
        s.attackStart[e.side] = e.t;
        s.finalStart[e.side] = e.finalStart;
        s.compound[e.side] = e.compound;
        const opp = other(e.side);
        if (s.lineSide === opp) break; // Rule 3: attacking into an established line gives no priority.
        const oppStart = s.attackStart[opp];
        if (s.holder === opp && s.kind === 'attack' && oppStart !== undefined) {
          // Rule 4: both attacks started within 1/4 T.
          if (Math.abs(e.t - oppStart) <= tempo / 4) s.simultaneous = true;
          break;
        }
        if (s.holder === null || s.kind === 'line' || s.kind === 'none') set(e.t, e.side, 'attack');
        break;
      }
      case 'bladeAttack':
        // Rule 8: a successful attack on the blade takes priority and removes a point in line.
        if (e.success) {
          if (s.lineSide === other(e.side)) s.lineSide = null;
          set(e.t, e.side, 'attack');
        }
        break;
      case 'derobe':
        // Rule 3: a dérobement keeps the line.
        s.lineSide = e.side;
        set(e.t, e.side, 'line');
        break;
      case 'parry':
        if (e.success) {
          s.parries += 1;
          s.parryTick = e.t;
          s.simultaneous = false;
          if (s.lineSide === other(e.side)) s.lineSide = null;
          // Rule 5 / 9: priority passes to the parrier; the chain alternates.
          set(e.t, e.side, 'parry');
        }
        break;
      case 'short':
        // Rule 5: a short or missed attack passes priority to the defender.
        if (s.holder === e.side || s.holder === null) set(e.t, other(e.side), 'defender');
        s.parryTick = e.t;
        break;
      case 'riposteStart':
        if (s.holder === e.side && (s.kind === 'parry' || s.kind === 'defender')) {
          const immediate = s.parryTick !== null && e.t - s.parryTick <= tempo;
          set(e.t, e.side, immediate ? (s.parries > 1 ? 'counterRiposte' : 'riposte') : 'delayedRiposte');
        }
        break;
      case 'renewalStart':
        s.renewal[e.side] = e.t;
        break;
      case 'counterStart':
        s.counter[e.side] = { t: e.t, opposition: e.opposition };
        break;
      default:
        break;
    }
  }
  return s;
}

/** Decide the phrase from its event timeline. */
export function decide(events: RowEvent[], tempo: number): Verdict & { outcome: Outcome } {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const v = (o: Outcome, side: Side | null) => ({ ...explain(o, side), outcome: o });

  const endLine = sorted.find((e) => e.kind === 'endLine') as Extract<RowEvent, { kind: 'endLine' }> | undefined;
  const hits = sorted.filter((e): e is Extract<RowEvent, { kind: 'hit' }> => e.kind === 'hit');
  const corps = sorted.find((e) => e.kind === 'corps');
  if (corps && (!hits.length || corps.t < hits[0].t)) return v('corps', null);
  if (endLine && (!hits.length || endLine.t < hits[0].t)) return { ...v('endLine', other(endLine.side)), penalty: true };

  // Scoring box: first light opens a 300 ms window, then the box locks out.
  const lit: Partial<Record<Side, Extract<RowEvent, { kind: 'hit' }>>> = {};
  if (hits.length) {
    const lock = hits[0].t + LOCKOUT_TICKS;
    for (const h of hits) if (h.t <= lock && !lit[h.side]) lit[h.side] = h;
  }
  const L = lit.left;
  const R = lit.right;
  if (!L && !R) {
    if (sorted.some((e) => e.kind === 'flat')) return v('flat', null);
    const parry = [...sorted].reverse().find((e) => e.kind === 'parry' && e.success) as Extract<RowEvent, { kind: 'parry' }> | undefined;
    if (parry) return v('parriedNoHit', parry.side);
    if (sorted.some((e) => e.kind === 'short')) return v('shortNoHit', null);
    return v('noHit', null);
  }

  const firstHit = Math.min(L?.t ?? Infinity, R?.t ?? Infinity);
  const st = walkPriority(sorted, tempo, firstHit);
  const labelFor = (side: Side): Outcome | 'counterattack' => {
    const opp = other(side);
    if (st.holder === side) {
      if (st.kind === 'line') return 'line';
      if (st.kind === 'riposte' || st.kind === 'parry' || st.kind === 'defender') return 'parryRiposte';
      if (st.kind === 'counterRiposte') return 'counterRiposte';
      if (st.kind === 'delayedRiposte') return 'parryRiposte';
      if (st.prepBy[opp] !== undefined && (st.attackStart[opp] === undefined || (st.attackStart[side] ?? 0) < (st.attackStart[opp] ?? 0)) && (st.prepBy[opp] ?? 0) <= (st.attackStart[side] ?? 0)) return 'attackOnPrep';
      return 'attack';
    }
    if (st.renewal[side] !== undefined) return 'remise';
    if (st.counter[side]) return 'counterattack';
    return 'attack';
  };

  // Only one light.
  if (!L || !R) {
    const h = (L ?? R)!;
    if (!h.valid) return v('offTarget', h.side);
    // Rule 10: a single valid light scores whatever the priority.
    const lab = labelFor(h.side);
    if (lab === 'counterattack') return v(st.counter[h.side]?.opposition ? 'timeHit' : 'counterattackAlone', h.side);
    return v(lab, h.side);
  }

  // Both lights on.
  if (st.simultaneous && st.kind === 'attack') return v('simultaneous', null);
  if (st.holder === null) return v('simultaneous', null);
  const P = st.holder;
  const O = other(P);
  const pHit = lit[P]!;
  const oHit = lit[O]!;

  // Rule 6: a delayed riposte lets the attacker's remise score if it lands first.
  if (st.kind === 'delayedRiposte' && st.renewal[O] !== undefined && oHit.t < pHit.t) {
    return oHit.valid ? v('remise', O) : v('offTarget', O);
  }
  // Rule 7b: a counterattack landing at least 1 T before the final movement of the attack.
  const counter = st.counter[O];
  const pFinal = st.finalStart[P];
  if (counter && pFinal !== undefined && st.kind === 'attack' && oHit.t <= pFinal - tempo) {
    return oHit.valid ? v('stopInTempo', O) : v('offTarget', O);
  }
  // 5.5: an off-target hit by the fencer with priority stops the phrase.
  if (!pHit.valid) return v('offTargetPriority', P);
  const lab = labelFor(P);
  return v(lab === 'counterattack' ? 'counterattackAlone' : lab, P);
}
