import type { Side, Verdict } from '../sim/types';

export type Outcome =
  | 'attack'
  | 'attackOnPrep'
  | 'parryRiposte'
  | 'counterRiposte'
  | 'remise'
  | 'line'
  | 'counterattackAlone'
  | 'timeHit'
  | 'stopInTempo'
  | 'simultaneous'
  | 'offTarget'
  | 'offTargetPriority'
  | 'flat'
  | 'parriedNoHit'
  | 'shortNoHit'
  | 'noHit'
  | 'corps'
  | 'endLine';

const de = (s: Side | null) => (s === 'left' ? 'de gauche' : s === 'right' ? 'de droite' : '');
const en = (s: Side | null) => (s === 'left' ? 'the left' : s === 'right' ? 'the right' : '');

/** Map every outcome to its rule number (spec 5.6) and a plain-English sentence. */
export function explain(o: Outcome, side: Side | null): Verdict {
  const scorer = (x: Side | null) => x;
  switch (o) {
    case 'attack':
      return { scorer: scorer(side), callFr: `Attaque ${de(side)}… touché`, callEn: `Attack from ${en(side)}, touch`, rule: 1, why: 'The attack started first with a progressive extension and forward movement, so it held priority when both lights came on.' };
    case 'attackOnPrep':
      return { scorer: scorer(side), callFr: `Attaque sur la préparation ${de(side)}`, callEn: `Attack on preparation from ${en(side)}`, rule: 2, why: 'The opponent moved without a threatening extension (preparation), so the attack launched into it had priority.' };
    case 'parryRiposte':
      return { scorer: scorer(side), callFr: `Parade-riposte ${de(side)}`, callEn: `Parry-riposte from ${en(side)}`, rule: 5, why: 'The attack was parried, missed or fell short, so priority passed to the defender, whose riposte scores. An immediate riposte (within 1 T) beats a remise (rule 6).' };
    case 'counterRiposte':
      return { scorer: scorer(side), callFr: `Contre-riposte ${de(side)}`, callEn: `Counter-riposte from ${en(side)}`, rule: 9, why: 'Priority alternates along the parry–riposte chain; the last fencer to parry and riposte immediately holds it.' };
    case 'remise':
      return { scorer: scorer(side), callFr: `Remise ${de(side)}`, callEn: `Remise from ${en(side)}`, rule: 6, why: 'The riposte was delayed by more than 1 T after the parry, so the attacker\'s renewal that landed first scores.' };
    case 'line':
      return { scorer: scorer(side), callFr: `Point en ligne ${de(side)}`, callEn: `Point in line from ${en(side)}`, rule: 3, why: 'The point in line was established before the final movement of the attack and was not removed by a successful attack on the blade.' };
    case 'counterattackAlone':
      return { scorer: scorer(side), callFr: `Contre-attaque ${de(side)}`, callEn: `Counterattack from ${en(side)}`, rule: 10, why: 'Only one valid light came on, so that fencer scores whatever the priority (rule 7a).' };
    case 'timeHit':
      return { scorer: scorer(side), callFr: `Coup de temps ${de(side)}`, callEn: `Time hit with opposition from ${en(side)}`, rule: '7c', why: 'The counterattack closed the line with opposition so the attack could not land.' };
    case 'stopInTempo':
      return { scorer: scorer(side), callFr: `Contre-attaque ${de(side)}, en temps`, callEn: `Counterattack in tempo from ${en(side)}`, rule: '7b', why: 'The stop hit landed at least 1 T before the final movement of the compound or broken attack began.' };
    case 'simultaneous':
      return { scorer: null, callFr: 'Simultané, pas de touche', callEn: 'Simultaneous, no touch', rule: 4, why: 'Both attacks started within 1/4 T of each other and both hit, so neither had priority.' };
    case 'offTarget':
      return { scorer: null, callFr: 'Attaque non valable', callEn: `Off-target hit from ${en(side)}, no touch`, rule: '5.5', why: 'The only light was white: the point landed outside valid target.' };
    case 'offTargetPriority':
      return { scorer: null, callFr: `Non valable ${de(side)}, pas de touche`, callEn: `Off-target from ${en(side)}, phrase stopped, no touch`, rule: '5.5', why: 'The fencer with priority hit off-target first; that stops the phrase, so the opponent\'s later hit does not count.' };
    case 'flat':
      return { scorer: null, callFr: 'Pas de touche', callEn: 'No touch: flat hit', rule: '5.5', why: 'The point arrived more than 60° from the surface normal (flat or slapping), so the tip did not register.' };
    case 'parriedNoHit':
      return { scorer: null, callFr: `Parade ${de(side)}`, callEn: `Parry by ${en(side)}`, rule: 5, why: 'The attack was parried; priority passes to the defender.' };
    case 'shortNoHit':
      return { scorer: null, callFr: 'Attaque courte', callEn: 'Attack fell short', rule: 5, why: 'The reach was shorter than the measure at arrival time; priority passes to the defender.' };
    case 'noHit':
      return { scorer: null, callFr: 'Pas de touche', callEn: 'No touch', rule: '—', why: 'No light came on.' };
    case 'corps':
      return { scorer: null, callFr: 'Corps-à-corps, halte', callEn: 'Body contact: halt, no touch', rule: 11, why: 'Body contact stops the phrase; no touch is awarded.' };
    case 'endLine':
      return { scorer: scorer(side), callFr: `Sortie en arrière, touche ${de(side)}`, callEn: `Off the end line: penalty touch to ${en(side)}`, rule: 11, why: 'Crossing the end line with both feet gives the opponent a penalty touch.' };
  }
}
