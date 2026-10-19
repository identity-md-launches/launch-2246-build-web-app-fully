import { describe, expect, it } from 'vitest';
import { decide } from '../src/referee/row';
import type { RowEvent, Side } from '../src/sim/types';

const attack = (side: Side, t = 0, finalStart = t, compound = false): RowEvent => ({ t, kind: 'attackStart', side, finalStart, compound });
const hit = (side: Side, t = 60, valid = true): RowEvent => ({ t, kind: 'hit', side, valid });
const parry = (side: Side, t = 30, success = true): RowEvent => ({ t, kind: 'parry', side, success });
const event = (kind: 'line' | 'prep' | 'counterStart' | 'riposteStart' | 'renewalStart' | 'short' | 'derobe', side: Side, t: number): RowEvent => kind === 'counterStart' ? { t, kind, side, opposition: false } : { t, kind, side };

interface Scenario { name: string; events: RowEvent[]; scorer: Side | null; outcome: string }
const scenarios: Scenario[] = [
  { name: 'straight lunge beats a stop hit without time advantage', events: [attack('left'), event('counterStart', 'right', 12), hit('right', 55), hit('left', 60)], scorer: 'left', outcome: 'attack' },
  { name: 'quarte and direct riposte take priority', events: [attack('left'), parry('right'), event('riposteStart', 'right', 32), hit('right')], scorer: 'right', outcome: 'parryRiposte' },
  { name: 'immediate riposte beats a remise with both lights', events: [attack('left'), parry('right'), event('riposteStart', 'right', 32), event('renewalStart', 'left', 35), hit('left', 55), hit('right', 60)], scorer: 'right', outcome: 'parryRiposte' },
  { name: 'remise beats a riposte delayed more than one tempo', events: [attack('left'), parry('right'), event('renewalStart', 'left', 35), event('riposteStart', 'right', 80), hit('left', 90), hit('right', 100)], scorer: 'left', outcome: 'remise' },
  { name: 'established point in line beats an attack into it', events: [event('line', 'right', 0), attack('left', 20), hit('left', 60), hit('right', 62)], scorer: 'right', outcome: 'line' },
  { name: 'successful beat removes established line', events: [event('line', 'right', 0), attack('left', 10), { t: 20, kind: 'bladeAttack', side: 'left', success: true }, hit('left', 60), hit('right', 62)], scorer: 'left', outcome: 'attack' },
  { name: 'attacks within a quarter tempo are simultaneous', events: [attack('left'), attack('right', 8), hit('left', 60), hit('right', 62)], scorer: null, outcome: 'simultaneous' },
  { name: 'off-target attack with priority stops a valid counterattack', events: [attack('left'), event('counterStart', 'right', 10), hit('left', 60, false), hit('right', 65)], scorer: null, outcome: 'offTargetPriority' },
  { name: 'attack on footwork preparation scores', events: [event('prep', 'left', 0), attack('right', 10), hit('right', 60), hit('left', 62)], scorer: 'right', outcome: 'attackOnPrep' },
  { name: 'stop hit one tempo before the final movement scores in tempo', events: [attack('left', 0, 120, true), event('counterStart', 'right', 20), hit('right', 84), hit('left', 120)], scorer: 'right', outcome: 'stopInTempo' },
  { name: 'distance pull passes priority to a riposte', events: [attack('left'), event('short', 'left', 30), event('riposteStart', 'right', 32), event('renewalStart', 'left', 35), hit('right', 60), hit('left', 65)], scorer: 'right', outcome: 'parryRiposte' },
  { name: 'counter-time catches a stop hit and ripostes', events: [event('prep', 'left', 0), event('counterStart', 'right', 10), parry('left', 30), event('riposteStart', 'left', 32), hit('left')], scorer: 'left', outcome: 'parryRiposte' },
  { name: 'derobement evades a beat and retains the line', events: [event('line', 'right', 0), attack('left', 10), { t: 20, kind: 'bladeAttack', side: 'left', success: false }, event('derobe', 'right', 21), hit('left', 60), hit('right', 62)], scorer: 'right', outcome: 'line' },
  { name: 'second hit after 310 milliseconds is locked out', events: [attack('left'), attack('right', 8), hit('left', 60), hit('right', 97)], scorer: 'left', outcome: 'attack' },
  { name: 'flat flick with no registered hit produces no touch', events: [attack('left'), { t: 60, kind: 'flat', side: 'left' }], scorer: null, outcome: 'flat' },
  { name: 'caught one-two transfers priority without awarding a hit', events: [attack('left', 0, 35, true), parry('right', 60)], scorer: null, outcome: 'parriedNoHit' },
  { name: 'double deceives the circular parry and lands', events: [attack('left', 0, 35, true), parry('right', 55, false), hit('left')], scorer: 'left', outcome: 'attack' },
  { name: 'time hit with opposition prevents the attack light', events: [attack('right'), { t: 8, kind: 'counterStart', side: 'left', opposition: true }, hit('left')], scorer: 'left', outcome: 'timeHit' },
  { name: 'counterattack with the sole valid light scores regardless of priority', events: [attack('left'), event('counterStart', 'right', 10), hit('right')], scorer: 'right', outcome: 'counterattackAlone' },
  { name: 'quarte priority follows the parrier in either handedness matchup', events: [attack('right'), parry('left'), event('riposteStart', 'left', 32), hit('left')], scorer: 'left', outcome: 'parryRiposte' },
  { name: 'counter-riposte returns priority after the second parry', events: [attack('left'), parry('right', 30), event('riposteStart', 'right', 32), parry('left', 55), event('riposteStart', 'left', 57), hit('left', 80), hit('right', 82)], scorer: 'left', outcome: 'counterRiposte' },
  { name: 'third parry alternates the counter-riposte back to the right', events: [attack('left'), parry('right', 30), event('riposteStart', 'right', 32), parry('left', 55), event('riposteStart', 'left', 57), parry('right', 80), event('riposteStart', 'right', 82), hit('left', 105), hit('right', 108)], scorer: 'right', outcome: 'counterRiposte' },
  { name: 'ceding parry takes priority after the prise de fer', events: [attack('left'), { t: 10, kind: 'bladeAttack', side: 'left', success: true }, parry('right', 30), event('riposteStart', 'right', 32), hit('right', 60), hit('left', 62)], scorer: 'right', outcome: 'parryRiposte' },
  { name: 'a compound riposte starting after one tempo loses to the earlier remise', events: [attack('right'), parry('left'), event('renewalStart', 'right', 35), event('riposteStart', 'left', 80), hit('right', 90), hit('left', 100)], scorer: 'right', outcome: 'remise' },
  { name: 'fleche attack keeps progressive attacking priority', events: [{ ...attack('left'), label: 'Flèche' } as RowEvent, event('counterStart', 'right', 10), hit('left', 60), hit('right', 62)], scorer: 'left', outcome: 'attack' },
  { name: 'corps-a-corps before any light halts without a touch', events: [attack('left'), { t: 30, kind: 'corps' }, hit('left', 60)], scorer: null, outcome: 'corps' },
  { name: 'both feet over the end line give the opponent a penalty touch', events: [{ t: 30, kind: 'endLine', side: 'right' }], scorer: 'left', outcome: 'endLine' },
  { name: 'unanswered successful parry does not itself score', events: [attack('left'), parry('right')], scorer: null, outcome: 'parriedNoHit' },
  { name: 'wrong-line parry cannot take priority from a valid attack', events: [attack('left'), parry('right', 55, false), hit('left')], scorer: 'left', outcome: 'attack' },
  { name: 'off-target counterattack cannot cancel the valid attack with priority', events: [attack('left'), event('counterStart', 'right', 10), hit('right', 58, false), hit('left', 60)], scorer: 'left', outcome: 'attack' },
  { name: 'a single white lamp awards no touch', events: [attack('left'), hit('left', 60, false)], scorer: null, outcome: 'offTarget' },
  { name: 'a point in line established after the final starts has no priority', events: [attack('left', 0, 20), event('line', 'right', 21), hit('left', 60), hit('right', 62)], scorer: 'left', outcome: 'attack' },
];

describe('foil right-of-way matrix at 120 Hz and T = 36 ticks', () => {
  it.each(scenarios)('$name', ({ events, scorer, outcome }) => {
    const result = decide(events, 36);
    expect(result.scorer).toBe(scorer);
    expect(result.outcome).toBe(outcome);
    expect(result.callFr.length).toBeGreaterThan(0);
    expect(result.callEn.length).toBeGreaterThan(0);
    expect(result.why.length).toBeGreaterThan(0);
  });
});
