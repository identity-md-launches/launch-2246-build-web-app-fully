import { FOOTWORK_CLIPS, makeBladeClip } from '../anim/clips';
import type { Category, CounterLink, LineName, Phase, Position, Reliability, SimSpec, Technique } from './types';

type C = [id: string, rel: 'r' | 's' | 'k', why: string];
interface Raw {
  id: string;
  name: string;
  french: string;
  aliases?: string[];
  lines: LineName[];
  sim: SimSpec;
  foot?: string;
  desc: string;
  when: string;
  steps: string[];
  errors: string[];
  tactical: string;
  row: string;
  by: C[];
  pre?: string[];
  partner?: string;
}

const ALL: LineName[] = ['high', 'low', 'inside', 'outside'];
const HI_OUT: LineName[] = ['high', 'outside'];
const HI_IN: LineName[] = ['high', 'inside'];
const LO_IN: LineName[] = ['low', 'inside'];
const LO_OUT: LineName[] = ['low', 'outside'];

const LATERAL_BY: C[] = [
  ['AT03', 'r', 'The disengage passes under the parry made toward the original line.'],
  ['AT10', 'r', 'The one-two draws the lateral parry with the feint and finishes in the line it opened.'],
  ['AT11', 's', 'Evades two lateral parries but needs time; a stop hit in tempo can beat it.'],
  ['AT15', 's', 'The pause makes the parry close on air before the real final arrives.'],
  ['CT06', 's', 'A second-intention attacker expects this parry and is ready to parry the riposte.'],
];
const CIRCULAR_BY: C[] = [
  ['AT05', 'r', 'The counter-disengage follows the circle round and finishes outside it.'],
  ['AT12', 'r', 'The doublé goes round with the circular parry and lands in the opened line.'],
  ['AT15', 's', 'Broken time lets the circle finish before the attack arrives.'],
  ['CT06', 's', 'A second-intention attacker has a parry waiting for the riposte that follows.'],
];

const RAW: Raw[] = [
  // ---------------- A. Footwork and movement ----------------
  {
    id: 'FW01', name: 'On guard', french: 'En garde', aliases: ['guard', 'stance'], lines: ALL, foot: 'guard',
    sim: { role: 'stance', tempos: 1 },
    desc: 'The base stance: heels in line 1.5–2 foot lengths apart, front foot at the opponent, rear foot at about 90°, knees over the toes, torso upright and bladed, weapon hand at chest height with the tip on the upper chest.',
    when: 'Before every action and as the neutral state you return to after each phrase.',
    steps: ['Place the heels on one line, front foot pointing at the opponent, rear foot turned out.', 'Sink with both knees tracking over the toes; keep the pelvis level.', 'Settle the weapon elbow a hand-width in front of the flank, hand at chest height in sixte.', 'Aim the point at the opponent\'s upper chest and relax the rear arm.'],
    errors: ['Knees collapse inward, so every step leaks power and balance.', 'Stance too narrow, so the lunge has no base and the head bobs.', 'Hand held high and wide, which opens the low line and slows parries.', 'Weight on the front foot, so the retreat starts late.'],
    tactical: 'A compact guard keeps every parry within 10–15 cm of hand travel and hides your intention.',
    row: 'Standing on guard carries no priority. Priority starts only with a threatening extension.',
    by: [], partner: 'FW01',
  },
  {
    id: 'FW02', name: 'Advance', french: 'Marche', aliases: ['step forward'], lines: ALL, foot: 'advance',
    sim: { role: 'footwork', tempos: 1, move: 0.4 },
    desc: 'The front foot moves first, toe lifting and heel landing, and the rear foot follows the same distance.',
    when: 'To close distance, set up an attack, or push the opponent toward the end line.',
    steps: ['Lift the front toe and reach forward from the knee, not the hip.', 'Land heel first, keeping the head level.', 'Bring the rear foot the same distance to restore the stance.'],
    errors: ['Rear foot moves first, telegraphing the step.', 'Feet drag together, shrinking the stance.', 'Bouncing step that lifts the head several centimetres.'],
    tactical: 'Vary the length and rhythm of your advances; regular steps invite an attack on preparation.',
    row: 'An advance without an extending arm is preparation: the opponent may attack into it.',
    by: [['CT04', 'r', 'An advance without extension is preparation and can be attacked.'], ['CT01', 's', 'A stop hit lands while the foot is in the air.']],
    pre: ['FW01'],
  },
  {
    id: 'FW03', name: 'Retreat', french: 'Retraite', aliases: ['step back'], lines: ALL, foot: 'retreat',
    sim: { role: 'footwork', tempos: 1, move: -0.4 },
    desc: 'The rear foot moves first and the front foot follows, keeping the stance width.',
    when: 'To keep the attacker out of distance, draw a short attack, or buy time to parry.',
    steps: ['Push from the front foot and reach back with the rear foot.', 'Land the rear foot and let the front foot follow the same distance.', 'Keep the blade still in guard while the feet move.'],
    errors: ['Front foot leaves first, so the weight tips backward.', 'Steps too long to repeat quickly.', 'Blade drops while retreating, opening the high line.'],
    tactical: 'A retreat that matches the attacker\'s rhythm makes the final fall short; break the rhythm to set a trap.',
    row: 'Making an attack fall short passes priority to you, provided you then act.',
    by: [['FW13', 'r', 'The advance-lunge covers the extra distance the retreat gains.'], ['FW15', 's', 'The flèche out-runs a single retreat.'], ['FW22', 's', 'Stealing distance removes the space the retreat relies on.']],
    pre: ['FW01'],
  },
  {
    id: 'FW04', name: 'Lunge', french: 'Fente', aliases: ['straight lunge'], lines: HI_OUT, foot: 'lunge',
    sim: { role: 'attack', tempos: 1.2, reach: 'lunge', finalLine: 'high-out' },
    desc: 'Arm-first lunge: the arm extends, the front foot kicks forward toe-up and lands heel first with the shin vertical, the rear leg drives straight and the rear foot stays flat.',
    when: 'The finishing footwork for most attacks from lunge distance.',
    steps: ['Start the arm extension so the point threatens first.', 'Kick the front foot forward toe-up, low over the floor.', 'Drive from the rear leg until it is straight, rear foot flat.', 'Land heel first with the shin vertical and the knee over the instep.', 'Drop the rear arm parallel to the rear leg; keep the torso lean under 15°.'],
    errors: ['The front foot leads the arm, so you lose priority.', 'Knee travels past the toes, overloading the joint and slowing the recovery.', 'Rear foot rolls onto its side, losing the drive.', 'Torso dives forward, so the riposte catches you off balance.'],
    tactical: 'The lunge is fast but commits you; keep the recovery ready and attack only at the right measure.',
    row: 'Priority starts with the arm extension and holds while the extension is progressive.',
    by: [['PA01', 'r', 'A lateral parry closing the line catches a straight lunge.'], ['PA02', 'r', 'A sixte parry closes the outside high line the lunge finishes in.'], ['CT11', 'r', 'Pulling distance makes the lunge fall short.'], ['CT01', 'k', 'Only works if the preparation is slow; otherwise the attack has priority.']],
    pre: ['FW01', 'AT01'],
  },
  {
    id: 'FW05', name: 'Recovery backward', french: 'Retour en garde en arrière', aliases: ['recover back'], lines: ALL, foot: 'recoverBack',
    sim: { role: 'footwork', tempos: 1, move: -0.1 },
    desc: 'From the lunge, the rear leg bends and pulls the body back while the front foot pushes off, returning to guard.',
    when: 'After a missed or parried lunge to re-establish distance and defence.',
    steps: ['Bend the rear knee to pull the hips back.', 'Push off the front heel and bring the front foot back.', 'Return the blade to a covering position as the guard re-forms.'],
    errors: ['Recovering with the arm still extended and the line open.', 'Standing up tall instead of staying low.', 'Slow push from the front heel, leaving you in range of the riposte.'],
    tactical: 'A fast recovery denies the delayed riposte and resets the measure.',
    row: 'Recovering gives no priority; the opponent who parried still owns the riposte.',
    by: [['RR05', 's', 'A delayed riposte waits for the recovery and hits as you return.'], ['RR10', 's', 'Redoublement pressure catches the recovering fencer.']],
    pre: ['FW04'],
  },
  {
    id: 'FW06', name: 'Recovery forward', french: 'Retour en garde en avant', aliases: ['recover forward'], lines: ALL, foot: 'recoverFwd',
    sim: { role: 'footwork', tempos: 1, move: 0.3 },
    desc: 'From the lunge, the rear foot comes up to guard so you keep the ground you gained.',
    when: 'When the opponent retreated and you want to keep pressure.',
    steps: ['Keep the front foot planted.', 'Bring the rear foot forward to restore stance width.', 'Rise to guard height with the blade covering.'],
    errors: ['Dragging the rear foot so the stance is too narrow.', 'Blade left extended, inviting a beat.', 'Rising too high, which slows the next action.'],
    tactical: 'Use it to chase a retreating opponent, but expect an attack while you close.',
    row: 'The forward recovery is preparation; the opponent may attack into it.',
    by: [['CT04', 'r', 'The forward recovery is preparation and can be attacked.']],
    pre: ['FW04'],
  },
  {
    id: 'FW07', name: 'Half-advance', french: 'Demi-marche', aliases: ['check step'], lines: ALL, foot: 'halfAdvance',
    sim: { role: 'footwork', tempos: 0.7, move: 0.15 },
    desc: 'A partial front-foot step that tests reactions or draws an action without committing distance.',
    when: 'To probe whether the opponent retreats, parries, or attacks into your footwork.',
    steps: ['Lift and place the front foot a short distance forward.', 'Keep the rear foot ready to follow or not.', 'Read the reaction before choosing the next action.'],
    errors: ['Committing weight forward, so you cannot react.', 'Repeating the same rhythm until it becomes a cue.', 'Moving the blade with the foot.'],
    tactical: 'Draws an attack you can parry or makes the opponent reveal their distance habits.',
    row: 'A check step without extension is preparation.',
    by: [['FW25', 's', 'Matching distance leaves the half-step with nothing to read.'], ['CT03', 'r', 'A point in line stops the probe from coming closer.']],
    pre: ['FW02'],
  },
  {
    id: 'FW08', name: 'Half-retreat', french: 'Demi-retraite', aliases: [], lines: ALL, foot: 'halfRetreat',
    sim: { role: 'footwork', tempos: 0.7, move: -0.15 },
    desc: 'A partial retreat used to draw the attack just short.',
    when: 'Against an attacker who commits early to a fixed distance.',
    steps: ['Move the rear foot back a short distance.', 'Leave the front foot in place or follow minimally.', 'Prepare the parry or counterattack as the attack falls short.'],
    errors: ['Too small to change the measure.', 'Leaning back instead of stepping.', 'Not ready to act once the attack falls short.'],
    tactical: 'Small distance changes are hard to see and ruin the attacker\'s timing.',
    row: 'If the attack falls short, priority passes to you.',
    by: [['FW22', 's', 'Stealing distance gives the attacker back the centimetres.'], ['AT15', 's', 'A broken-time attack waits through the half-retreat.']],
    pre: ['FW03'],
  },
  {
    id: 'FW09', name: 'Double advance', french: 'Double marche', aliases: [], lines: ALL, foot: 'doubleAdvance',
    sim: { role: 'footwork', tempos: 1.7, move: 0.76 },
    desc: 'Two advances with an accelerating rhythm.',
    when: 'To gain ground quickly and arrive at lunge distance with momentum.',
    steps: ['Take a measured first advance.', 'Accelerate into a shorter, faster second advance.', 'Arrive balanced and ready to lunge.'],
    errors: ['Equal rhythm, which is easy to time.', 'Overstriding the second step.', 'Arm drifting forward without a real threat.'],
    tactical: 'Accelerating feet compress the opponent\'s reaction time.',
    row: 'Footwork without extension remains preparation.',
    by: [['CT04', 'r', 'Two steps of preparation give two chances to attack into them.']],
    pre: ['FW02'],
  },
  {
    id: 'FW10', name: 'Jump advance', french: 'Saut en avant', aliases: ['hop'], lines: ALL, foot: 'jumpAdvance',
    sim: { role: 'footwork', tempos: 1, move: 0.45 },
    desc: 'Both feet leave the floor low and land together.',
    when: 'To change rhythm or set up a balestra.',
    steps: ['Push from both legs, keeping the jump low.', 'Travel forward with the stance unchanged.', 'Land both feet together, knees bent.'],
    errors: ['Jumping high, so the head rises far above guard height.', 'Landing on the heels and losing spring.', 'Arm moving with the jump.'],
    tactical: 'The airborne moment cannot be changed; use it only when the opponent is not ready.',
    row: 'Preparation; the opponent may attack while you are in the air.',
    by: [['CT04', 'r', 'You cannot react in the air; an attack on preparation lands.']],
    pre: ['FW02'],
  },
  {
    id: 'FW11', name: 'Jump retreat', french: 'Saut en arrière', aliases: [], lines: ALL, foot: 'jumpRetreat',
    sim: { role: 'footwork', tempos: 1, move: -0.45 },
    desc: 'A low jump backward that gains distance quickly.',
    when: 'Against a sudden attack when a normal retreat is too slow.',
    steps: ['Push from the front foot and rear leg together.', 'Travel back low with the guard intact.', 'Land ready to parry.'],
    errors: ['Jumping up rather than back.', 'Landing with the blade out of position.', 'Using it so often it becomes predictable.'],
    tactical: 'Gains more distance than a retreat but is easier to chase.',
    row: 'If the attack falls short, priority passes to you.',
    by: [['FW15', 's', 'A flèche out-runs the jump.'], ['FW13', 's', 'The advance-lunge covers the extra distance.']],
    pre: ['FW03'],
  },
  {
    id: 'FW12', name: 'Balestra', french: 'Balestra', aliases: ['jump lunge'], lines: HI_OUT, foot: 'balestra',
    sim: { role: 'attack', tempos: 2, reach: 'advLunge', finalLine: 'high-out' },
    desc: 'A jump advance straight into a lunge, landing with a stamp.',
    when: 'To surprise with a sudden change of rhythm from advance-lunge distance.',
    steps: ['Extend the arm as the jump starts.', 'Land both feet with a stamp.', 'Launch the lunge immediately from the landing.'],
    errors: ['Arm stays bent through the jump, so the attack has no priority.', 'Jump too high and slow.', 'Pause between landing and lunge.'],
    tactical: 'The stamp and rhythm change freeze the opponent for a moment.',
    row: 'With the arm extending from the jump, it is an attack with priority.',
    by: [['CT01', 's', 'A stop hit during the jump lands if the arm is bent.'], ['CT11', 'r', 'Pulling distance makes the lunge fall short.']],
    pre: ['FW10', 'FW04'],
  },
  {
    id: 'FW13', name: 'Advance-lunge', french: 'Marche-fente', aliases: [], lines: HI_OUT, foot: 'advanceLunge',
    sim: { role: 'attack', tempos: 2, reach: 'advLunge', finalLine: 'high-out' },
    desc: 'An advance chained into a lunge with no pause.',
    when: 'From advance-lunge distance against an opponent who holds ground.',
    steps: ['Start the advance with the arm beginning to extend.', 'Land the rear foot and launch the lunge in one rhythm.', 'Finish with the arm fully extended as the front foot lands.'],
    errors: ['Pause between the advance and the lunge.', 'Arm extended too early and held, inviting a beat.', 'Advance too long to chain.'],
    tactical: 'The standard long attack; vary the advance to disguise the moment of the lunge.',
    row: 'If the arm extends progressively through the advance, priority is held throughout.',
    by: [['CT04', 'r', 'The advance is preparation if the arm is not extending.'], ['PA01', 's', 'A parry in retreat catches the end of the long attack.']],
    pre: ['FW02', 'FW04'],
  },
  {
    id: 'FW14', name: 'Patinando', french: 'Patinando', aliases: [], lines: HI_OUT, foot: 'patinando',
    sim: { role: 'attack', tempos: 1.6, reach: 'advLunge', finalLine: 'high-out' },
    desc: 'A short, quick advance; the rear foot snaps up and the lunge launches as the rear foot lands.',
    when: 'To accelerate into an attack from slightly beyond lunge distance.',
    steps: ['Take a short, sharp front-foot step.', 'Snap the rear foot up.', 'Launch the lunge as the rear foot lands, arm leading.'],
    errors: ['Rear foot lands heavy, so the lunge starts late.', 'Step too long, losing the snap.', 'Arm lags behind the feet.'],
    tactical: 'The snap of the rear foot is the acceleration; keep the front step small.',
    row: 'An attack with priority once the arm extends with the forward movement.',
    by: [['CT03', 'r', 'A point in line established early beats an attack that does not remove it.'], ['CT11', 's', 'Distance pull leaves the patinando short.']],
    pre: ['FW02', 'FW04'],
  },
  {
    id: 'FW15', name: 'Flèche', french: 'Flèche', aliases: ['arrow'], lines: HI_OUT, foot: 'fleche',
    sim: { role: 'attack', tempos: 1.6, reach: 'fleche', finalLine: 'high-out' },
    desc: 'A running attack: arm extends, weight shifts over the front foot, the front leg drives, the rear leg passes, and the tip lands before the passing foot.',
    when: 'Against a static opponent from slightly beyond lunge distance, or to surprise.',
    steps: ['Extend the arm first.', 'Shift the weight over the front foot.', 'Drive from the front leg as the rear leg swings past.', 'Land the touch before the passing foot touches down.', 'Run past the opponent\'s side without contact.'],
    errors: ['Rear leg passes before the arm extends, so priority is lost.', 'Hit lands after the passing foot, making the attack slow.', 'Running into the opponent: corps-à-corps.'],
    tactical: 'Fully committing; there is no recovery, so use it when the distance and timing are certain.',
    row: 'An attack with priority; body contact halts the phrase with no touch.',
    by: [['PA01', 's', 'A retreat plus quarte parry catches the flèche.'], ['PA02', 's', 'A retreat plus sixte parry catches the flèche.'], ['CT02', 'r', 'A time hit with opposition closes the line the flèche comes in.']],
    pre: ['AT01'],
  },
  {
    id: 'FW16', name: 'Cross-over forward', french: 'Passe avant', aliases: [], lines: ALL, foot: 'crossFwd',
    sim: { role: 'footwork', tempos: 1, move: 0.45 },
    desc: 'The rear foot passes the front, then the front steps forward to restore guard.',
    when: 'To gain ground quickly in a long pursuit.',
    steps: ['Swing the rear foot past the front foot.', 'Step the front foot forward to restore the stance.', 'Keep the blade in guard throughout.'],
    errors: ['Squaring the hips so the target widens.', 'Crossing too early in the distance.', 'Losing balance and needing a reset step.'],
    tactical: 'Fast but vulnerable; use it outside attacking distance.',
    row: 'Preparation, open to attack into it.',
    by: [['CT04', 'r', 'The crossing moment is pure preparation.']],
    pre: ['FW02'],
  },
  {
    id: 'FW17', name: 'Cross-over backward', french: 'Passe arrière', aliases: [], lines: ALL, foot: 'crossBack',
    sim: { role: 'footwork', tempos: 1, move: -0.45 },
    desc: 'The front foot passes the rear, then the rear steps back.',
    when: 'To escape quickly from a long attack.',
    steps: ['Swing the front foot behind the rear.', 'Step the rear foot back to restore guard.', 'Keep the blade covering.'],
    errors: ['Squaring the body to the attacker.', 'Tripping on the passing foot.', 'Blade drops during the cross.'],
    tactical: 'Gains space quickly but you cannot parry well mid-cross.',
    row: 'If the attack falls short, priority passes to you.',
    by: [['FW15', 's', 'A flèche closes the distance while you cross.']],
    pre: ['FW03'],
  },
  {
    id: 'FW18', name: 'Appel', french: 'Appel', aliases: ['stamp'], lines: ALL, foot: 'appel',
    sim: { role: 'footwork', tempos: 0.8, move: 0 },
    desc: 'A front-foot stamp used as a feint or distraction.',
    when: 'To provoke a reaction or mask the start of an attack.',
    steps: ['Lift the front foot slightly.', 'Stamp sharply in place.', 'Watch the reaction and act on it.'],
    errors: ['Stamping so hard you lose balance.', 'Leaning forward with the stamp.', 'Using it without a plan for the reaction.'],
    tactical: 'Works on nervous opponents; experienced ones ignore it.',
    row: 'Preparation; it carries no priority.',
    by: [['CT01', 's', 'Ignore the stamp and stop-hit into it.']],
    pre: ['FW01'],
  },
  {
    id: 'FW19', name: 'Short lunge', french: 'Demi-fente', aliases: ['half lunge'], lines: HI_OUT, foot: 'shortLunge',
    sim: { role: 'attack', tempos: 0.9, reach: 'shortLunge', finalLine: 'high-out' },
    desc: 'A partial lunge used to probe or to finish at close distance.',
    when: 'At close distance or as a probe that can recover quickly.',
    steps: ['Extend the arm.', 'Lunge partially, keeping weight centred.', 'Hit or recover immediately.'],
    errors: ['Too short to reach the target.', 'Leaning to make up distance.', 'Rear foot lifting.'],
    tactical: 'Short commitment means a quick recovery; ideal for probing parries.',
    row: 'An attack with priority if the arm extends first.',
    by: [['RR01', 'r', 'A parry and immediate riposte catches the short lunge.']],
    pre: ['FW04'],
  },
  {
    id: 'FW20', name: 'Broken-time step', french: 'Marche en temps rompu', aliases: [], lines: ALL, foot: 'brokenStep',
    sim: { role: 'footwork', tempos: 1.8, move: 0.5, pause: 0.6 },
    desc: 'An advance with a deliberate mid-step pause.',
    when: 'To disrupt an opponent who times your steps.',
    steps: ['Start a normal advance.', 'Freeze for a fraction of a tempo mid-step.', 'Complete the step and continue.'],
    errors: ['Pause too long, gifting a tempo.', 'Rocking the head during the pause.', 'No follow-up action prepared.'],
    tactical: 'Changes the rhythm the opponent is reading.',
    row: 'Preparation; the pause invites an attack into it.',
    by: [['CT04', 'r', 'Attack into the pause.']],
    pre: ['FW02'],
  },
  {
    id: 'FW21', name: 'Rhythm change', french: 'Changement de rythme', aliases: ['acceleration'], lines: ALL, foot: 'rhythm',
    sim: { role: 'footwork', tempos: 2.9, move: 1.05 },
    desc: 'Slow-slow-fast footwork that breaks the opponent\'s timing.',
    when: 'To arrive at attacking distance faster than the opponent expects.',
    steps: ['Take two slow advances.', 'Accelerate the third step.', 'Launch the attack from the acceleration.'],
    errors: ['Accelerating the arm instead of the feet.', 'Slow steps too slow, inviting attack.', 'Acceleration too long to stay balanced.'],
    tactical: 'Tempo is a weapon: change it to create a gap.',
    row: 'Footwork without extension is preparation.',
    by: [['FW25', 's', 'Matching distance absorbs the acceleration.'], ['CT03', 'r', 'A point in line stops the acceleration.']],
    pre: ['FW02'],
  },
  {
    id: 'FW22', name: 'Stealing distance', french: 'Vol de distance', aliases: ['creep'], lines: ALL, foot: 'steal',
    sim: { role: 'footwork', tempos: 1.2, move: 0.12 },
    desc: 'A creeping foot gains measure without a visible step.',
    when: 'Before an attack, to move from out of distance to lunge distance unseen.',
    steps: ['Slide the rear foot forward a few centimetres.', 'Slide the front foot to restore stance.', 'Keep the upper body and blade perfectly still.'],
    errors: ['Upper body moves, revealing the gain.', 'Stance shrinks.', 'Gaining too much in one slide.'],
    tactical: 'Invisible distance is the best preparation for a simple attack.',
    row: 'Preparation, but hard to see and so hard to punish.',
    by: [['FW03', 'r', 'A retreat restores the measure.'], ['CT03', 's', 'A point in line makes creeping in dangerous.']],
    pre: ['FW02'],
  },
  {
    id: 'FW23', name: 'Advance-flèche', french: 'Marche-flèche', aliases: [], lines: HI_OUT, foot: 'advanceFleche',
    sim: { role: 'attack', tempos: 2.4, reach: 'fleche', move: 0.4, finalLine: 'high-out' },
    desc: 'An advance chained into a flèche.',
    when: 'From long distance against an opponent who stands.',
    steps: ['Advance with the arm beginning to extend.', 'Shift weight forward as the rear foot lands.', 'Flèche with the tip landing before the passing foot.'],
    errors: ['Pause after the advance.', 'Arm bent through the advance.', 'Running into the opponent.'],
    tactical: 'Covers great distance; requires certainty about the opponent\'s reaction.',
    row: 'An attack with priority if the arm extends progressively.',
    by: [['CT04', 'r', 'The advance is attackable preparation.'], ['PA02', 's', 'A retreat-parry catches the long attack.']],
    pre: ['FW02', 'FW15'],
  },
  {
    id: 'FW24', name: 'Retreat-lunge', french: 'Retraite-fente', aliases: [], lines: HI_OUT, foot: 'retreatLunge',
    sim: { role: 'attack', tempos: 2, reach: 'lunge', move: -0.35, finalLine: 'high-out' },
    desc: 'Pull distance, then lunge into the opponent\'s forward preparation.',
    when: 'Against an opponent who advances carelessly.',
    steps: ['Retreat to draw the opponent forward.', 'Extend as their front foot lifts.', 'Lunge into the advance.'],
    errors: ['Lunging too late, after their foot lands.', 'Retreat too long to reverse.', 'Arm late.'],
    tactical: 'Turns defence into attack on preparation.',
    row: 'An attack into preparation has priority.',
    by: [['CT06', 's', 'A second-intention advance expects the lunge and parries it.']],
    pre: ['FW03', 'FW04'],
  },
  {
    id: 'FW25', name: 'Matching distance', french: 'Garder la distance', aliases: ['shadowing'], lines: ALL, foot: 'match',
    sim: { role: 'footwork', tempos: 1.6, move: 0 },
    desc: 'Shadow the opponent\'s footwork to hold the measure.',
    when: 'Against an opponent probing for distance.',
    steps: ['Watch the opponent\'s front foot.', 'Mirror each step with an equal step.', 'Hold a constant measure.'],
    errors: ['Reacting to feints with large steps.', 'Drifting toward the end line.', 'Letting the measure shrink gradually.'],
    tactical: 'Denies the opponent a reference; they must change rhythm to gain.',
    row: 'No priority; neutral footwork.',
    by: [['FW21', 'r', 'A rhythm change breaks the mirror.'], ['FW07', 's', 'A half-advance draws a reaction that reveals your timing.']],
    pre: ['FW02', 'FW03'],
  },
  // ---------------- B. Parries ----------------
  ...parry('PA01', 'Quarte parry', 'Parade de quarte', ['4'], HI_IN, ['quarte'], 'lateral', 'Inside high lateral parry: the hand moves 10–15 cm inside, supinated, point high.', 'Against attacks to the inside high line.'),
  ...parry('PA02', 'Sixte parry', 'Parade de sixte', ['6'], HI_OUT, ['sixte'], 'lateral', 'Outside high lateral parry from the sixte guard, half-supinated, point high.', 'Against attacks to the outside high line, the most common foil finish.'),
  ...parry('PA03', 'Septime parry', 'Parade de septime', ['7'], LO_IN, ['septime'], 'lateral', 'Inside low parry: the hand stays near its height, supinated, the point drops by a semicircle.', 'Against attacks to the low inside line and the belly.'),
  ...parry('PA04', 'Octave parry', 'Parade d\'octave', ['8'], LO_OUT, ['octave'], 'lateral', 'Outside low parry, supinated, point low.', 'Against attacks to the low outside line and flank.'),
  ...parry('PA05', 'Prime parry', 'Parade de prime', ['1'], ['high', 'inside', 'low'], ['prime'], 'lateral', 'Hand high inside at shoulder level, fully pronated, elbow bent, point down.', 'Against flicks to the back and close-quarters inside attacks.'),
  ...parry('PA06', 'Seconde parry', 'Parade de seconde', ['2'], LO_OUT, ['seconde'], 'lateral', 'Outside low, pronated, below shoulder height.', 'Against low outside attacks and flicks to the flank.'),
  ...parry('PA07', 'Tierce parry', 'Parade de tierce', ['3'], HI_OUT, ['tierce'], 'lateral', 'Outside high, pronated.', 'Against outside high attacks when a pronated riposte or flick follows.'),
  ...parry('PA08', 'Quinte parry', 'Parade de quinte', ['5', 'high quinte'], ['high', 'inside'], ['quinte', 'quinteHigh'], 'lateral', 'Classical low-inside pronated quinte, and the high quinte with the blade near horizontal above the head against overhead flicks.', 'Against inside attacks and overhead flicks to the shoulder or back.'),
  ...parry('PA09', 'Counter-sixte', 'Contre de sixte', ['circular sixte'], HI_OUT, ['sixte'], 'circular', 'A circular parry that collects the blade from the inside and returns it to sixte.', 'Against disengages and one-twos from the sixte engagement.'),
  ...parry('PA10', 'Counter-quarte', 'Contre de quarte', ['circular quarte'], HI_IN, ['quarte'], 'circular', 'A circular parry that collects the blade from the outside and returns it to quarte.', 'Against disengages from quarte.'),
  ...parry('PA11', 'Counter-septime', 'Contre de septime', [], LO_IN, ['septime'], 'circular', 'A circular parry in the low inside line.', 'Against disengages in the low line.'),
  ...parry('PA12', 'Counter-octave', 'Contre d\'octave', [], LO_OUT, ['octave'], 'circular', 'A circular parry in the low outside line.', 'Against low-line disengages.'),
  ...parry('PA13', 'Semicircular sixte to octave', 'Demi-cercle sixte-octave', [], ['high', 'low', 'outside'], ['octave'], 'semicircular', 'From sixte the point drops in a half circle to octave.', 'Against high-low attacks on the outside.'),
  ...parry('PA14', 'Semicircular quarte to septime', 'Demi-cercle quarte-septime', [], ['high', 'low', 'inside'], ['septime'], 'semicircular', 'From quarte the point drops in a half circle to septime.', 'Against high-low attacks on the inside.'),
  ...parry('PA15', 'Diagonal parry', 'Parade diagonale', [], ALL, ['octave'], 'diagonal', 'A parry across the target, quarte to octave or sixte to septime.', 'Against attacks that change from high to low across the target.'),
  ...parry('PA16', 'Beat parry', 'Parade du tac', ['tac'], HI_OUT, ['sixte'], 'beat', 'A crisp parry with a beat that deflects and rebounds into the riposte (tac-au-tac).', 'Against direct attacks when a fast riposte is planned.'),
  ...parry('PA17', 'Ceding parry', 'Parade cédante', ['yielding parry'], ALL, ['quarte'], 'ceding', 'Answers a prise de fer by yielding into the line the opponent\'s action drives toward.', 'Against binds, croisés, coulés and envelopments.'),
  ...parry('PA18', 'Opposition parry', 'Parade d\'opposition', [], HI_OUT, ['sixte'], 'opposition', 'Holds the opponent\'s blade with continuous opposition rather than a beat.', 'Against angulated hits and glides.'),
  ...parry('PA19', 'Successive parries', 'Parades composées', ['compound parries'], ALL, ['quarte', 'sixte'], 'successive', 'Two or more parries in sequence, each checked against the attacker\'s next deception.', 'Against compound and broken-time attacks.'),
  ...parry('PA20', 'Covered recovery', 'Retour en garde couvert', [], HI_OUT, ['sixte'], 'covered', 'Recovering from the lunge with the blade closing a line.', 'After a missed attack, against a riposte or counter-attack in the recovery.'),
  // ---------------- C. Attacks ----------------
  {
    id: 'AT01', name: 'Extension', french: 'Allongement du bras', aliases: ['arm-first'], lines: HI_OUT,
    sim: { role: 'attack', tempos: 0.8, reach: 'extend', finalLine: 'high-out' },
    desc: 'The arm straightens smoothly with the point threatening valid target; the foundation of priority.',
    when: 'At the start of every attack, and alone at close distance.',
    steps: ['Push the hand forward from the shoulder, point leading.', 'Straighten the elbow without locking or lifting the shoulder.', 'Keep the point on target throughout.'],
    errors: ['Elbow lifts so the point rises off target.', 'Extension is jerky and stops, losing priority.', 'Shoulder hunches, telegraphing the action.'],
    tactical: 'A smooth, early extension is the clearest signal to the referee.',
    row: 'Priority begins when the extension begins and lasts while it continues progressively.',
    by: [['PA02', 'r', 'A lateral parry closes the line of the extension.'], ['BL04', 's', 'A beat on the extended blade takes the priority.']],
  },
  attack('AT02', 'Straight thrust', 'Coup droit', ['direct attack'], HI_OUT, { tempos: 1.2, finalLine: 'high-out' }, 'A direct attack in the line where the blades are: no change of line.', 'When the line is open or the opponent is slow to parry.', ['Extend the arm straight into the open line.', 'Lunge as the arm reaches extension.', 'Hit with the point leading, fingers controlling.'], ['Drawing the hand back before thrusting.', 'Feet start before the arm.', 'Point wanders off the line during the lunge.'], [['PA02', 'r', 'Any parry closing the final line catches it.'], ['CT11', 'r', 'Distance pull makes it fall short.'], ['PA16', 's', 'A beat parry deflects and ripostes at once.']], ['AT01']),
  attack('AT03', 'Disengage', 'Dégagé', ['dégagement'], HI_OUT, { tempos: 1.2, finalLine: 'high-out', changesLine: true }, 'A change of line passing under the opponent\'s blade into the opposite line.', 'Against a lateral parry or engagement toward the original line.', ['Drop the point with the fingers, under the opposing blade.', 'Extend into the new line as the point rises.', 'Lunge to finish.'], ['Wide arm movement instead of fingers.', 'Disengaging while the arm is bent, so priority is unclear.', 'Going around too far and missing the target.'], [['PA09', 'r', 'A counter-parry follows the disengage round.'], ['PA02', 's', 'A lateral parry of the new line catches it.']], ['AT02']),
  attack('AT04', 'Cut-over', 'Coupé', ['coupé'], HI_OUT, { tempos: 1.3, finalLine: 'high-out', changesLine: true, armLift: true }, 'A change of line over the opponent\'s point.', 'When the opponent\'s blade is low or engaged in opposition.', ['Lift the point over the opponent\'s tip with the fingers and wrist.', 'Drop into the new line while extending.', 'Lunge to finish.'], ['Lifting the whole arm, exposing the flank to a stop hit.', 'Cut-over too wide.', 'Lunge starts during the lift.'], [['CT01', 'r', 'The arm flexion during the lift invites a stop hit in tempo.'], ['PA02', 's', 'A lateral parry catches it in the new line.']], ['AT03']),
  attack('AT05', 'Counter-disengage', 'Contre-dégagé', [], HI_IN, { tempos: 1.3, finalLine: 'high-in', evadeCircular: 1 }, 'Evades a circular parry or change of engagement by following it round.', 'Against an opponent who uses counter-parries or changes engagement.', ['Wait for the circular movement to start.', 'Follow it around in the same direction.', 'Extend and lunge into the line it vacated.'], ['Moving before the circle starts.', 'Circling the wrong way.', 'Arm bending during the evasion.'], [['PA02', 'r', 'A lateral parry catches the counter-disengage.'], ['PA19', 'r', 'Successive parries catch it.']], ['AT03']),
  attack('AT06', 'Low-line attack', 'Attaque en ligne basse', ['flank attack', 'belly attack'], LO_OUT, { tempos: 1.2, finalLine: 'low-out' }, 'An attack to the flank or belly under the opponent\'s guard.', 'When the opponent holds a high guard.', ['Lower the hand and angle the point down.', 'Extend toward the flank.', 'Lunge with the point leading.'], ['Dropping the hand too far, opening the high line.', 'Point lands flat on the flank.', 'Slow change from high to low.'], [['PA03', 'r', 'Septime closes the low inside line.'], ['PA04', 'r', 'Octave closes the low outside line.'], ['PA06', 'r', 'Seconde catches the low outside attack.']], ['AT02']),
  attack('AT07', 'Flick', 'Coup lancé', ['whip'], ['high', 'outside'], { tempos: 1.3, finalLine: 'back', flick: true }, 'An overhead whip of the blade that lands the point on the back or shoulder.', 'Against covered fencers or at close distance when the front is closed.', ['Wind the blade up with a pronated hand.', 'Whip the forearm forward and stop the hand sharply.', 'Let the faible snap over and land point-first.'], ['Hitting flat with the blade, so the light does not register.', 'Too much arm, too little stop.', 'Flicking from out of distance.'], [['CT11', 'r', 'Distance makes the flick fall short.'], ['CT04', 's', 'Attack the wind-up.'], ['PA05', 's', 'Prime covers the shoulder.'], ['PA08', 'r', 'High quinte closes the overhead line.']], ['AT02']),
  attack('AT08', 'Angulated hit', 'Coup angulé', [], HI_OUT, { tempos: 1.2, finalLine: 'high-out', angulated: true }, 'The wrist angles the point around the opponent\'s guard.', 'Against a strong lateral parry or a covered opponent.', ['Extend with the hand to one side.', 'Angle the wrist to bring the point back to target.', 'Hit with the point arriving at an angle.'], ['Angle so steep the hit lands flat.', 'Bending the elbow to angle.', 'Telegraphing with the shoulder.'], [['PA18', 'r', 'An opposition parry holds the blade and neutralises the angle.'], ['FW03', 's', 'Retreating spoils the angle.']], ['AT02']),
  attack('AT09', 'Direct feint', 'Feinte directe', ['feint'], HI_OUT, { tempos: 1.6, finalLine: 'high-out', evadeLateral: 1 }, 'A feint of a direct thrust that draws a parry, then finishes in the opened line.', 'Against an opponent who parries promptly.', ['Extend convincingly toward the target.', 'Read the parry.', 'Deceive it and finish with a lunge.'], ['Feint not threatening enough to draw a parry.', 'Arm withdraws between feint and final.', 'Final starts before the parry commits.'], [['CT01', 'r', 'Not reacting and stopping in tempo beats the feint.']], ['AT02']),
  attack('AT10', 'One-two', 'Une-deux', [], HI_OUT, { tempos: 2, finalLine: 'high-out', evadeLateral: 1 }, 'Two disengages: the first draws a lateral parry, the second deceives it.', 'Against an opponent who answers a feint with a lateral parry.', ['Feint by disengage with the arm extending.', 'Deceive the lateral parry with a second disengage.', 'Lunge as the second disengage finishes.'], ['Feint too short to draw the parry.', 'Lunging on the feint.', 'Large circular movements.'], [['PA09', 'r', 'A circular parry catches the one-two.'], ['CT01', 's', 'A stop hit in tempo on the first feint.']], ['AT03']),
  attack('AT11', 'One-two-three', 'Une-deux-trois', [], HI_IN, { tempos: 3, finalLine: 'high-in', evadeLateral: 2 }, 'Three disengages deceiving two lateral parries.', 'Against fencers who make successive lateral parries.', ['Feint by disengage.', 'Deceive the first parry.', 'Deceive the second parry.', 'Lunge on the final disengage.'], ['Too slow, so the opponent stops in tempo.', 'Arm bends between disengages.', 'Lunging too early.'], [['CT01', 'r', 'A stop hit at least 1 T before the final beats it.'], ['PA09', 's', 'A circular parry catches it.']], ['AT10']),
  attack('AT12', 'Doublé', 'Doublé', [], HI_IN, { tempos: 2, finalLine: 'high-in', evadeCircular: 1 }, 'A feint disengage followed by a counter-disengage that deceives a circular parry.', 'Against an opponent who answers feints with counter-parries.', ['Feint by disengage.', 'Follow the circular parry round.', 'Finish in the line it opened with a lunge.'], ['Second movement in the wrong direction.', 'Circles too large.', 'Arm withdraws.'], [['PA02', 'r', 'A lateral parry catches the doublé.'], ['PA19', 'r', 'Successive parries catch it.']], ['AT05']),
  attack('AT13', 'Coupé-dégagé', 'Coupé-dégagé', [], HI_OUT, { tempos: 2, finalLine: 'high-out', evadeLateral: 1, armLift: true }, 'A cut-over feint followed by a disengage.', 'Against a lateral parry drawn by the cut-over.', ['Feint by cut-over.', 'Deceive the parry with a disengage.', 'Lunge to finish.'], ['Lift too large.', 'Arm bent during the lift.', 'Slow final.'], [['CT01', 'r', 'Stop hit on the cut-over lift.'], ['PA10', 's', 'A counter-parry collects the final.']], ['AT04']),
  attack('AT14', 'High-low feint attack', 'Feinte haute, coup bas', [], ['high', 'low'], { tempos: 1.8, finalLine: 'low-out', evadeLateral: 1 }, 'A feint high that draws a high parry, then a hit in the low line.', 'Against fencers who parry high on every feint.', ['Feint high with a convincing extension.', 'Drop the point under the parry.', 'Lunge to the flank.'], ['Dropping the hand rather than the point.', 'Feint without threat.', 'Final lands flat.'], [['PA13', 'r', 'A semicircular parry follows the drop.'], ['PA14', 'r', 'A semicircular parry follows the drop inside.'], ['PA15', 's', 'A diagonal parry covers the low line.']], ['AT06']),
  attack('AT15', 'Broken-time attack', 'Attaque en temps rompu', [], HI_OUT, { tempos: 2.2, finalLine: 'high-out', pause: 0.6 }, 'An attack with a deliberate pause so the parry closes on air before the final.', 'Against a fencer who parries on rhythm.', ['Start the attack.', 'Pause with the arm still in line.', 'Finish as the parry passes.'], ['Pause too long, gifting a stop hit.', 'Arm withdraws during the pause.', 'No change of speed after the pause.'], [['CT01', 'r', 'Stop hit into the pause.'], ['PA19', 's', 'Successive parries catch the final.']], ['AT02']),
  attack('AT16', 'Feint-flick', 'Feinte de coup lancé', [], ['high', 'outside'], { tempos: 1.8, finalLine: 'back', flick: true, evadeLateral: 1 }, 'A feint that draws the front parry, then a flick to the back or shoulder.', 'Against covered fencers who parry front attacks.', ['Feint to the front.', 'Wind up as the parry moves.', 'Flick over to the back.'], ['Wind-up too obvious.', 'Flat landing.', 'Out of distance.'], [['CT11', 'r', 'Distance spoils the flick.'], ['CT01', 's', 'Counterattack into the wind-up.']], ['AT07']),
  attack('AT17', 'False attack', 'Fausse attaque', [], HI_OUT, { tempos: 1, finalLine: 'high-out', reach: 'shortLunge' }, 'An attack not meant to land, used to read the opponent\'s parries and ripostes.', 'To probe reactions before the real attack.', ['Make a short, convincing attack.', 'Stop short and recover covered.', 'Note the reaction.'], ['Committing too far.', 'Recovery uncovered.', 'Same false attack every time.'], [['CT05', 's', 'Counter-time on the recovery.'], ['CT04', 'r', 'Attack on the recovering preparation.']], ['AT02']),
  attack('AT18', 'Progressive attack in march', 'Attaque progressive en marchant', [], HI_OUT, { tempos: 2, finalLine: 'high-out', reach: 'advLunge' }, 'The arm extends during the advance, then the lunge, keeping priority throughout.', 'From advance-lunge distance when you need clear priority.', ['Start extending with the front foot.', 'Continue extending through the advance.', 'Lunge as the arm reaches full extension.'], ['Arm stops during the step.', 'Arm fully extended too early.', 'Lunge late.'], [['PA02', 's', 'A parry in retreat catches the end.'], ['CT03', 'r', 'A point in line established early beats it.']], ['FW13']),
  // ---------------- D. Blade actions ----------------
  blade('BL01', 'Engagement', 'Engagement', [], HI_OUT, { role: 'bladePrep', tempos: 0.8, bladeOn: 'engage' }, 'Contact with the opponent\'s blade in sixte or quarte to control it.', 'To feel the opponent\'s intentions and prepare an attack.', ['Bring the blade into contact on the opponent\'s faible with your forte.', 'Hold light pressure.', 'Feel for the reaction.'], ['Pressing too hard, so the opponent can disengage cleanly.', 'Engaging with the faible.', 'Holding the engagement too long.'], [['BL02', 's', 'A change of engagement takes over the contact.'], ['AT05', 'r', 'A counter-disengage evades the engagement.']], ['FW01']),
  blade('BL02', 'Change of engagement', 'Changement d\'engagement', [], HI_IN, { role: 'bladePrep', tempos: 1, bladeOn: 'engage' }, 'Engaging in the opposite line by passing under the opponent\'s blade.', 'To take the opponent\'s blade into a line you prefer.', ['Drop the point under the opponent\'s blade.', 'Engage on the other side.', 'Hold with light pressure.'], ['Large movement, giving a tempo.', 'Losing contact.', 'Pressing.'], [['AT05', 'r', 'A counter-disengage evades the change.']], ['BL01']),
  blade('BL03', 'Absence of blade', 'Absence de fer', [], ALL, { role: 'bladePrep', tempos: 0.8 }, 'No contact between the blades: the modern foil default.', 'Most of the bout, to keep options and hide intention.', ['Keep the blade out of contact.', 'Hold a compact guard.', 'React to blade-seeking with distance.'], ['Blade waving that invites a beat.', 'Hand too far forward.', 'Point off target.'], [['CT04', 's', 'Attack the preparation around the absent blade.'], ['BL06', 'r', 'A beat attack finds the blade.']], ['FW01']),
  blade('BL04', 'Beat', 'Battement', [], HI_OUT, { role: 'bladeAttack', tempos: 0.6, bladeOn: 'beat' }, 'A sharp blow on the opponent\'s blade to deflect it or remove a line.', 'Against a point in line or to gain priority before an attack.', ['Relax the hand.', 'Strike with the middle or forte on the opponent\'s faible.', 'Stop the blade in line.'], ['Beating with the arm instead of the fingers.', 'Beat too wide.', 'Beating the forte and achieving nothing.'], [['BL14', 'r', 'A dérobement evades the beat and keeps the line.']], ['BL01']),
  blade('BL05', 'Change-beat', 'Changement-battement', [], HI_IN, { role: 'bladeAttack', tempos: 0.8, bladeOn: 'beat' }, 'Pass under the blade and beat in the opposite line.', 'When the opponent expects a beat on the near side.', ['Drop under the blade.', 'Beat on the other side.', 'Stop in line ready to attack.'], ['Too slow, so the opponent derobes.', 'Wide movement.', 'Weak beat.'], [['BL14', 'r', 'Dérobement avoids it.']], ['BL04']),
  blade('BL06', 'Beat-straight attack', 'Battement-coup droit', [], HI_IN, { role: 'bladeAttack', tempos: 1.4, bladeOn: 'beat', finalLine: 'high-in', reach: 'lunge' }, 'A beat followed by a straight thrust in the same line.', 'Against a point in line or a slow parry.', ['Beat sharply.', 'Extend immediately from the beat.', 'Lunge to finish.'], ['Pause between beat and thrust.', 'Beat without displacement.', 'Arm bent after the beat.'], [['BL14', 'r', 'Dérobement keeps the line.'], ['RR01', 's', 'Parry-riposte.']], ['BL04']),
  blade('BL07', 'Beat-disengage', 'Battement-dégagé', [], HI_OUT, { role: 'bladeAttack', tempos: 1.6, bladeOn: 'beat', finalLine: 'high-out', changesLine: true, reach: 'lunge' }, 'A beat to draw a return pressure, then a disengage.', 'Against opponents who answer the beat with pressure.', ['Beat.', 'Feel the return and disengage under it.', 'Lunge into the open line.'], ['Disengage before the return.', 'Wide movement.', 'Slow final.'], [['PA09', 'r', 'A counter-parry catches it.'], ['PA10', 'r', 'Counter-quarte catches it.']], ['BL04', 'AT03']),
  blade('BL08', 'Pressure', 'Pression', [], HI_OUT, { role: 'bladeAttack', tempos: 0.7, bladeOn: 'pressure' }, 'Pushing on the opponent\'s blade to deflect it or provoke a reaction.', 'To provoke a return pressure that opens a disengage.', ['Engage the blade.', 'Press smoothly with the fingers.', 'Read the response.'], ['Pressing with the arm.', 'Pressure too long.', 'Losing contact.'], [['BL14', 's', 'Dérobement evades the pressure.'], ['PA17', 's', 'A ceding parry yields into the pressure.']], ['BL01']),
  blade('BL09', 'Coulé', 'Coulé', ['glide'], HI_OUT, { role: 'bladeAttack', tempos: 1.3, bladeOn: 'prise', finalLine: 'high-out', reach: 'lunge' }, 'A glide along the opponent\'s blade into the target.', 'From engagement against a fencer who does not hold the line.', ['Engage.', 'Slide forte along faible as the arm extends.', 'Lunge with opposition.'], ['Losing contact.', 'Gliding with the faible.', 'Arm bent.'], [['PA17', 'r', 'A ceding parry answers the glide.'], ['PA18', 'r', 'An opposition parry holds it.']], ['BL01']),
  blade('BL10', 'Froissement', 'Froissement', [], HI_IN, { role: 'bladeAttack', tempos: 1.3, bladeOn: 'beat', finalLine: 'high-in', reach: 'lunge' }, 'A strong, grazing deflection along the opponent\'s blade from forte to faible.', 'Against a strong point in line.', ['Contact the faible with your forte.', 'Graze forcefully forward and down.', 'Thrust into the opened line.'], ['Contact too light.', 'Movement too wide.', 'Slow thrust after the graze.'], [['BL14', 'r', 'Dérobement evades the froissement.']], ['BL04']),
  blade('BL11', 'Bind', 'Liement', ['liement'], LO_OUT, { role: 'bladeAttack', tempos: 1.4, bladeOn: 'prise', finalLine: 'low-out', reach: 'lunge' }, 'Carries the blade diagonally from high line to low line (or vice versa).', 'Against a point in line or a stiff arm.', ['Take the blade with forte on faible.', 'Carry it diagonally to the opposite low line.', 'Lunge with control.'], ['Losing the blade during the bind.', 'Using the arm instead of the wrist.', 'Slow carry.'], [['PA17', 'r', 'A ceding parry yields into the bind.'], ['BL14', 's', 'Dérobement avoids the take.']], ['BL01']),
  blade('BL12', 'Croisé', 'Croisé', [], LO_OUT, { role: 'bladeAttack', tempos: 1.3, bladeOn: 'prise', finalLine: 'low-out', reach: 'lunge' }, 'Carries the blade from high to low on the same side.', 'Against a high point in line.', ['Take the blade in sixte.', 'Carry it to the same-side low line.', 'Lunge to the flank.'], ['Carry too wide.', 'Losing contact.', 'Point lands flat.'], [['PA17', 'r', 'A ceding parry (seconde) answers the croisé.']], ['BL11']),
  blade('BL13', 'Envelopment', 'Enveloppement', [], HI_OUT, { role: 'bladeAttack', tempos: 1.5, bladeOn: 'prise', finalLine: 'high-out', reach: 'lunge' }, 'Takes the blade in a full circle and returns to the same line.', 'Against a stiff point in line.', ['Take the blade.', 'Carry it round a full circle.', 'Lunge with opposition.'], ['Losing contact mid-circle.', 'Circle too large.', 'Arm stiff.'], [['BL14', 'r', 'Dérobement evades the envelopment.'], ['PA17', 's', 'Ceding parry answers it.']], ['BL11']),
  blade('BL14', 'Dérobement', 'Dérobement', ['derobement'], HI_OUT, { role: 'derobe', tempos: 0.8, reach: 'extend', finalLine: 'high-out' }, 'Evades an attack on the blade while keeping the point in line.', 'When holding a point in line against beats or binds.', ['Hold the point in line.', 'Drop under the attack on the blade with the fingers.', 'Keep the arm straight and the point on target.'], ['Bending the arm, which loses the line.', 'Evading too early.', 'Point leaving the target.'], [['CT06', 's', 'A second-intention attack on the blade expects the dérobement.'], ['CT05', 'r', 'Counter-time takes the hit that follows.']], ['CT03']),
  // ---------------- E. Ripostes and renewals ----------------
  riposte('RR01', 'Direct riposte', 'Riposte directe', [], HI_OUT, { tempos: 0.8, finalLine: 'high-out' }, 'An immediate straight riposte from the parry.', 'After every clean parry with the opponent close.', ['Parry with a crisp, small action.', 'Extend straight from the parry.', 'Hit before the attacker recovers.'], ['Pulling back before riposting.', 'Riposte after a pause, losing priority.', 'Arm bent.'], [['RR08', 'r', 'Counter-parry and counter-riposte.']], ['PA02']),
  riposte('RR02', 'Indirect riposte', 'Riposte par dégagé', ['disengage riposte'], HI_IN, { tempos: 1, finalLine: 'high-in', changesLine: true }, 'A riposte by disengage into the line the attacker opens while covering.', 'When the attacker closes the line of the direct riposte.', ['Parry.', 'Disengage under the attacker\'s blade.', 'Extend into the open line.'], ['Disengage too wide.', 'Delay between parry and disengage.', 'Arm bent.'], [['PA09', 'r', 'A circular parry collects the indirect riposte.']], ['RR01', 'AT03']),
  riposte('RR03', 'Riposte by cut-over', 'Riposte par coupé', [], HI_OUT, { tempos: 1.1, finalLine: 'high-out', changesLine: true, armLift: true }, 'A riposte passing over the attacker\'s point.', 'When the attacker\'s blade is low or close.', ['Parry.', 'Lift over the point with the fingers.', 'Drop onto target.'], ['Lift too large.', 'Arm flexes.', 'Slow drop.'], [['PA02', 'r', 'A lateral parry catches it.']], ['RR01', 'AT04']),
  riposte('RR04', 'Compound riposte', 'Riposte composée', [], HI_OUT, { tempos: 1.8, finalLine: 'high-out', evadeLateral: 1 }, 'A riposte with one or more feints.', 'Against attackers who cover in recovery.', ['Parry.', 'Feint to draw the cover.', 'Deceive it and hit.'], ['Too slow, letting the remise land.', 'Feints without threat.', 'Arm withdraws.'], [['RR09', 's', 'A remise lands first if the riposte is slow.']], ['RR02']),
  riposte('RR05', 'Delayed riposte', 'Riposte à temps perdu', [], HI_OUT, { tempos: 0.8, finalLine: 'high-out', delay: 1.3 }, 'A riposte deliberately delayed to beat a covered recovery.', 'Against attackers who recover covering the direct riposte.', ['Parry and hold.', 'Wait for the recovery to commit.', 'Riposte into the opened line.'], ['Waiting while the attacker remises.', 'Losing contact.', 'Telegraphing the delay.'], [['RR09', 'r', 'A remise scores against a delayed riposte.'], ['RR10', 's', 'A redoublement scores into the delay.']], ['RR01']),
  riposte('RR06', 'Riposte by glide', 'Riposte par coulé', ['coulé riposte'], HI_OUT, { tempos: 1.1, finalLine: 'high-out', bladeOn: 'prise' }, 'A riposte gliding along the attacker\'s blade.', 'When the parry keeps contact.', ['Parry and keep contact.', 'Glide along the blade.', 'Hit with opposition.'], ['Losing contact.', 'Pressing too hard.', 'Arm bent.'], [['PA17', 'r', 'A ceding parry answers the glide.']], ['RR01', 'BL09']),
  riposte('RR07', 'Flick riposte', 'Riposte en coup lancé', [], ['high', 'outside'], { tempos: 1.1, finalLine: 'back', flick: true }, 'A riposte by flick, often after prime or seconde.', 'At close distance when the attacker is still on the lunge.', ['Parry prime or seconde.', 'Whip the blade over.', 'Land point-first on the back.'], ['Flat landing.', 'Too much arm.', 'Lost distance.'], [['CT11', 's', 'Distance spoils the flick.'], ['PA08', 'r', 'High quinte closes the overhead line.']], ['AT07', 'PA05']),
  riposte('RR08', 'Counter-riposte', 'Contre-riposte', [], HI_OUT, { tempos: 0.8, finalLine: 'high-out' }, 'The riposte that follows a parry of the opponent\'s riposte.', 'After parrying a riposte.', ['Parry the riposte.', 'Riposte immediately.', 'Recover covered.'], ['Late riposte.', 'Parry too wide.', 'Forgetting to cover.'], [['RR08', 's', 'The chain continues with another counter-riposte.']], ['RR01']),
  renewal('RR09', 'Remise', 'Remise', [], HI_OUT, { tempos: 0.6, finalLine: 'high-out' }, 'Replacing the point on target in the same line without withdrawing the arm after a parried or missed attack.', 'Against a delayed or compound riposte.', ['Stay on the lunge.', 'Replace the point in the same line.', 'Hit before the riposte.'], ['Remise into an immediate riposte (priority is lost).', 'Withdrawing the arm first.', 'Remise in a closed line.'], [['RR01', 'r', 'An immediate direct riposte has priority over the remise.']], ['FW04']),
  renewal('RR10', 'Redoublement', 'Redoublement', [], HI_IN, { tempos: 1.2, finalLine: 'high-in', changesLine: true }, 'A new action from the lunge, by change of line, after a missed or parried attack.', 'When the opponent parries and does not riposte.', ['Stay on the lunge.', 'Bend and re-extend in a new line.', 'Hit.'], ['Recovering first.', 'Slow re-extension.', 'Same line.'], [['RR01', 'r', 'A parry-riposte deals with it.']], ['RR09']),
  renewal('RR11', 'Reprise d\'attaque', 'Reprise d\'attaque', [], HI_OUT, { tempos: 1.6, finalLine: 'high-out', reach: 'lunge' }, 'Returning to guard and attacking again.', 'When the opponent retreats without riposting.', ['Recover forward.', 'Re-extend.', 'Lunge again.'], ['Recovering backward.', 'Pause before the second attack.', 'Arm late.'], [['CT04', 'r', 'Attack on the recovering preparation.']], ['FW06']),
  // ---------------- F. Counter-offensive and tactics ----------------
  tactic('CT01', 'Stop hit', 'Coup d\'arrêt', ['arrêt'], HI_OUT, { role: 'counter', tempos: 1, reach: 'extend', finalLine: 'high-out' }, 'A counterattack into the opponent\'s attack.', 'Against slow, compound or broken-time attacks.', ['Read the preparation or pause.', 'Extend straight into it.', 'Retreat after hitting.'], ['Stop-hitting a simple fast attack.', 'Bent arm.', 'Not retreating after.'], [['CT05', 'r', 'Counter-time parries the stop hit and ripostes.'], ['AT02', 's', 'A simple fast attack keeps priority over it.']], ['AT01']),
  tactic('CT02', 'Time hit with opposition', 'Coup de temps', [], HI_OUT, { role: 'counter', tempos: 1, reach: 'extend', finalLine: 'high-out', opposition: true }, 'A counterattack that closes the line so the attack cannot land.', 'Against an attack whose final line you can predict.', ['Anticipate the final line.', 'Extend with opposition, forte closing that line.', 'Hit as the attack is deflected.'], ['Wrong line predicted.', 'No opposition.', 'Too late.'], [['AT03', 'r', 'A disengage in time avoids the opposition.']], ['CT01', 'PA18']),
  tactic('CT03', 'Point in line', 'Ligne', ['line'], HI_OUT, { role: 'line', tempos: 0.8, reach: 'extend', finalLine: 'high-out' }, 'An arm straight with the point threatening valid target, established before the opponent\'s attack.', 'Against attackers who come forward without taking the blade.', ['Extend fully.', 'Point at the target.', 'Hold it steady.'], ['Bent arm.', 'Point off target.', 'Established too late.'], [['BL04', 'r', 'A beat removes the line.'], ['BL10', 'r', 'Froissement removes the line.'], ['BL11', 's', 'Bind removes the line.']], ['AT01']),
  tactic('CT04', 'Attack on preparation', 'Attaque sur la préparation', [], HI_OUT, { role: 'attack', tempos: 1.1, reach: 'lunge', finalLine: 'high-out' }, 'An attack launched into the opponent\'s footwork or blade preparation.', 'When the opponent advances without extending.', ['Watch the front foot.', 'Launch as it lifts.', 'Finish before it lands.'], ['Late launch.', 'Reacting to a false preparation.', 'Arm late.'], [['CT06', 'r', 'Second intention parries the attack on preparation.'], ['CT07', 's', 'An invitation draws it.']], ['FW04']),
  tactic('CT05', 'Counter-time', 'Contretemps', [], HI_OUT, { role: 'parry', tempos: 1, parry: { type: 'lateral', positions: ['sixte'] } }, 'Draw a stop hit, parry it, and riposte.', 'Against habitual counterattackers.', ['Invite the stop hit with a false attack.', 'Parry the counterattack.', 'Riposte.'], ['Invitation too real.', 'Parry too slow.', 'Riposte late.'], [['CT01', 'k', 'A feint of counterattack (an advanced bluff).'], ['CT03', 's', 'A point in line.']], ['CT01', 'PA02']),
  tactic('CT06', 'Second-intention attack', 'Attaque en seconde intention', [], HI_OUT, { role: 'parry', tempos: 1.2, parry: { type: 'successive', positions: ['quarte', 'sixte'] } }, 'An attack meant to be parried, so the riposte can be parried and countered.', 'Against strong parry-riposte fencers.', ['Make a real-looking attack.', 'Anticipate the riposte.', 'Parry it and counter-riposte.'], ['Attack too committed.', 'Late parry.', 'Wrong line expected.'], [['RR05', 'r', 'A delayed riposte beats it.'], ['RR04', 's', 'A compound riposte beats it.']], ['RR08']),
  tactic('CT07', 'Invitation', 'Invitation', ['draw'], ALL, { role: 'tactic', tempos: 1 }, 'Opening a line deliberately to draw the attack.', 'To make the opponent attack where you are ready.', ['Open a line.', 'Hold position.', 'Parry the expected attack.'], ['Invitation too obvious.', 'Not ready to parry.', 'Open too long.'], [['AT17', 'r', 'A false attack reads the invitation.']], ['PA02']),
  tactic('CT08', 'Inquartata', 'Inquartata', [], HI_IN, { role: 'counter', tempos: 1, reach: 'extend', finalLine: 'high-in', evasion: 'inquartata' }, 'A counterattack with a sidestep out of the line.', 'Against inside attacks.', ['Read the inside attack.', 'Step the rear foot sideways.', 'Counter-hit as the attack misses.'], ['Late sidestep.', 'Arm bent.', 'Off-balance.'], [['RR09', 's', 'A low-line remise finds the body.'], ['AT08', 'r', 'Angulation follows the body.']], ['CT01']),
  tactic('CT09', 'Passata sotto', 'Passata sotto', [], LO_IN, { role: 'counter', tempos: 1.1, reach: 'extend', finalLine: 'low-in', evasion: 'passata' }, 'Dropping under the attack with a counter-hit.', 'Against high attacks.', ['Read the high attack.', 'Drop with the rear leg extended.', 'Counter-hit upward.'], ['Too early.', 'Losing the target.', 'Unable to recover.'], [['RR09', 's', 'Low-line remise.'], ['AT08', 'r', 'Angulated hit.']], ['CT01']),
  tactic('CT10', 'Duck', 'Esquive basse', ['low counterattack'], LO_OUT, { role: 'counter', tempos: 1, reach: 'extend', finalLine: 'low-out', evasion: 'duck' }, 'A low counterattack ducking under the attack.', 'Against high-line attacks.', ['Drop the body.', 'Counter-hit.', 'Recover.'], ['Too slow.', 'Hit lands flat.', 'Lowering the guard.'], [['AT08', 'r', 'Angulated remise.'], ['RR09', 's', 'Low remise.']], ['CT01']),
  tactic('CT11', 'Distance pull', 'Rompre la mesure', ['retreat out of distance'], ALL, { role: 'footwork', tempos: 1, move: -0.5 }, 'Retreating just enough to make the attack fall short.', 'Against attacks launched at the edge of distance.', ['Read the launch.', 'Retreat with the rear foot.', 'Riposte or counter when it falls short.'], ['Retreat too late.', 'Retreat too long to counter.', 'Not acting after.'], [['RR10', 'r', 'Redoublement covers the remaining distance.'], ['RR11', 'r', 'Reprise chases the retreat.']], ['FW03']),
  tactic('CT12', 'Infighting', 'Combat rapproché', ['close quarters'], ALL, { role: 'counter', tempos: 0.8, reach: 'extend', finalLine: 'high-out', angulated: true }, 'Hitting at close quarters with the arm bent and the hand angled.', 'In close quarters after an attack fails to hit.', ['Keep the hand high.', 'Angle the point back.', 'Hit without body contact.'], ['Body contact.', 'Flat hits.', 'Arm too long.'], [['AT08', 's', 'Angulation.'], ['FW03', 'r', 'Retreat.']], ['AT08']),
];

function parry(id: string, name: string, french: string, aliases: string[], lines: LineName[], positions: Position[], type: NonNullable<SimSpec['parry']>['type'], desc: string, when: string): Raw[] {
  const circular = type === 'circular';
  const by = type === 'ceding' ? [['AT15', 's', 'Broken time defeats the yielding timing.'] as C, ['CT06', 's', 'A second-intention attacker expects the riposte.'] as C] : type === 'successive' ? [['AT11', 's', 'Two deceptions pass two parries when the timing is right.'] as C, ['AT15', 's', 'Broken time spoils the rhythm of the parries.'] as C, ['CT06', 's', 'A second-intention attacker waits for the riposte.'] as C] : circular ? CIRCULAR_BY : LATERAL_BY;
  return [
    {
      id, name, french, aliases, lines, desc, when,
      sim: { role: 'parry', tempos: type === 'successive' ? 1.4 : circular ? 1 : 0.7, parry: { type, positions } },
      steps: circular
        ? ['Start from guard with the hand fixed.', 'Circle the point with the fingers under the attacking blade.', 'Collect the blade and finish in the original line with the forte.', 'Riposte from the parry.']
        : type === 'successive'
          ? ['Make the first parry with a small hand movement.', 'If the attack deceives it, follow with the second parry immediately.', 'Find the blade with the forte and riposte.']
          : ['Move the hand 10–15 cm toward the line; the point moves more than the hand.', 'Meet the attacking faible with your forte.', 'Stop the parry crisply in position.', 'Riposte from where the parry ends.'],
      errors: ['Wide parry that waves the arm instead of moving the hand.', 'Parry with the faible, so the attack forces through.', 'Parrying too early, so the attacker deceives it.', 'No riposte, so the attacker can renew.'],
      tactical: `${name} is ${circular ? 'strongest against disengages and one-twos' : type === 'ceding' ? 'the answer to blade-taking attacks' : 'fast and economical'}; vary it with other parries so the attacker cannot plan a deception.`,
      row: 'A successful parry takes priority. The riposte keeps it if it starts within 1 T of the parry contact.',
      by, pre: ['FW01'], partner: 'AT02',
    },
  ];
}

function attack(id: string, name: string, french: string, aliases: string[], lines: LineName[], sim: Partial<SimSpec>, desc: string, when: string, steps: string[], errors: string[], by: C[], pre: string[]): Raw {
  return {
    id, name, french, aliases, lines, desc, when, steps, errors, by, pre, foot: 'lunge',
    sim: { role: 'attack', reach: 'lunge', tempos: 1.2, ...sim },
    tactical: `${name}: choose it from the opponent's reactions, not from habit. ${sim.evadeLateral || sim.evadeCircular ? 'Each feint must threaten enough to draw a real parry.' : 'Keep the action small and the timing sharp.'}`,
    row: sim.pause ? 'The pause breaks the attack: a stop hit landing 1 T before the final has priority.' : (sim.evadeLateral ?? 0) > 0 ? 'A compound attack keeps priority while the arm keeps extending, but a stop hit in tempo before the final beats it.' : 'Priority comes from the progressive extension with forward movement.',
  };
}
function blade(id: string, name: string, french: string, aliases: string[], lines: LineName[], sim: SimSpec, desc: string, when: string, steps: string[], errors: string[], by: C[], pre: string[]): Raw {
  return {
    id, name, french, aliases, lines, desc, when, steps, errors, by, pre,
    foot: sim.finalLine ? 'lunge' : undefined,
    sim,
    tactical: `${name} ${sim.role === 'bladePrep' ? 'prepares an action without committing; keep it short so it is not attacked.' : 'controls the opponent\'s blade before the hit; do it with the forte on the faible.'}`,
    row: sim.role === 'bladeAttack' ? 'A successful attack on the blade gives priority and removes a point in line.' : sim.role === 'derobe' ? 'A dérobement keeps the point in line and its priority.' : 'Blade preparation carries no priority.',
    partner: sim.role === 'derobe' ? 'BL04' : sim.role === 'bladeAttack' ? 'CT03' : 'FW01',
  };
}
function riposte(id: string, name: string, french: string, aliases: string[], lines: LineName[], sim: Partial<SimSpec>, desc: string, when: string, steps: string[], errors: string[], by: C[], pre: string[]): Raw {
  return {
    id, name, french, aliases, lines, desc, when, steps, errors, by, pre,
    sim: { role: 'riposte', tempos: 0.8, reach: 'extend', ...sim },
    tactical: `${name} follows a parry; ${sim.delay ? 'the delay beats a covered recovery but surrenders priority to a remise.' : 'speed from the parry keeps the priority.'}`,
    row: sim.delay ? 'Starting more than 1 T after the parry lets the attacker\'s remise score if it lands first.' : 'An immediate riposte (within 1 T of the parry) has priority over a remise.',
    partner: 'AT02',
  };
}
function renewal(id: string, name: string, french: string, aliases: string[], lines: LineName[], sim: Partial<SimSpec>, desc: string, when: string, steps: string[], errors: string[], by: C[], pre: string[]): Raw {
  return {
    id, name, french, aliases, lines, desc, when, steps, errors, by, pre,
    sim: { role: 'renewal', tempos: 0.8, reach: 'extend', ...sim },
    tactical: `${name} punishes a slow or absent riposte; against an immediate riposte it loses.`,
    row: 'A renewal scores only if the opponent\'s riposte is delayed, compound or absent.',
    partner: 'PA02',
  };
}
function tactic(id: string, name: string, french: string, aliases: string[], lines: LineName[], sim: SimSpec, desc: string, when: string, steps: string[], errors: string[], by: C[], pre: string[]): Raw {
  return {
    id, name, french, aliases, lines, desc, when, steps, errors, by, pre,
    foot: sim.evasion === 'duck' ? 'duck' : sim.evasion === 'inquartata' ? 'inquartata' : sim.evasion === 'passata' ? 'passata' : id === 'CT11' ? 'retreat' : id === 'CT04' ? 'lunge' : undefined,
    sim,
    tactical: `${name} depends on reading the opponent; use it when their habits are known.`,
    row: sim.role === 'counter' ? 'A counterattack scores only alone, at least 1 T before the final of the attack, or with opposition that stops the attack.' : sim.role === 'line' ? 'A point in line established first has priority unless removed by a successful attack on the blade.' : sim.role === 'attack' ? 'An attack launched into preparation has priority.' : 'No priority on its own; it shapes the opponent\'s action.',
    partner: sim.role === 'counter' || sim.role === 'line' || sim.role === 'parry' ? 'AT02' : id === 'CT04' ? 'FW02' : 'FW01',
  };
}

const ADVANCED = new Set(['AT07', 'AT16', 'RR07', 'AT11', 'AT13', 'AT15', 'CT02', 'CT05', 'CT06', 'CT08', 'CT09', 'CT10', 'CT12', 'BL10', 'BL11', 'BL12', 'BL13', 'RR04', 'RR06', 'PA19']);
const CATEGORY: Record<string, Category> = { FW: 'footwork', PA: 'parry', AT: 'attack', BL: 'blade', RR: 'riposte', CT: 'tactic' };
const REL: Record<C[1], Reliability> = { r: 'reliable', s: 'situational', k: 'risky' };

function phasesFor(sim: SimSpec): Phase[] {
  const T = sim.tempos;
  const prep = Math.min(0.3, T * 0.2);
  return [
    { name: 'preparation', start: 0, end: prep },
    { name: 'execution', start: prep, end: T * 0.85 },
    { name: 'finish', start: T * 0.85, end: T },
    { name: 'recovery', start: T, end: T + 1 },
  ];
}

function build(): Technique[] {
  const list: Technique[] = RAW.map((r) => {
    const bladeClip = `blade:${r.id}`;
    const foot = r.foot ?? (r.sim.role === 'footwork' ? 'advance' : undefined);
    const fclip = foot ? FOOTWORK_CLIPS[foot] : undefined;
    const bclip = makeBladeClip(bladeClip, r.sim);
    const syncMarkers: Record<string, number> = { ...bclip.markers };
    if (fclip) Object.assign(syncMarkers, fclip.markers);
    return {
      id: r.id,
      name: r.name,
      french: r.french,
      aliases: r.aliases ?? [],
      category: CATEGORY[r.id.slice(0, 2)],
      level: ADVANCED.has(r.id) ? 'advanced' : 'intermediate',
      lines: r.lines,
      description: r.desc,
      whenToUse: r.when,
      steps: r.steps,
      commonErrors: r.errors,
      tacticalNotes: r.tactical,
      rowNotes: r.row,
      phases: phasesFor(r.sim),
      footworkClip: foot,
      bladeClip,
      syncMarkers,
      counteredBy: r.by.map(([id, rel, why]) => ({ id, reliability: REL[rel], why })),
      counters: [],
      prerequisites: r.pre ?? [],
      demoScenario: {
        partner: r.partner ?? 'FW01',
        partnerRole: r.partner && r.partner !== 'FW01' ? 'reacting' : 'passive',
        note: r.partner && r.partner !== 'FW01' ? `The partner performs ${r.partner} so the purpose of the action is visible.` : 'The partner stands on guard at the right measure.',
      },
      sim: r.sim,
    };
  });
  // Reciprocal links: if B is in A.counteredBy, then A is in B.counters with the same reliability.
  const byId = new Map(list.map((t) => [t.id, t]));
  for (const t of list) {
    for (const c of t.counteredBy) {
      const other = byId.get(c.id);
      if (other && !other.counters.some((x) => x.id === t.id)) other.counters.push({ id: t.id, reliability: c.reliability, why: c.why } as CounterLink);
    }
  }
  return list;
}

export const TECHNIQUES: Technique[] = build();
export const TECHNIQUE_BY_ID: Record<string, Technique> = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t]));
export function getTechnique(id: string): Technique {
  const t = TECHNIQUE_BY_ID[id];
  if (!t) throw new Error(`Unknown technique ${id}`);
  return t;
}
export const CATEGORY_LABEL: Record<Category, string> = {
  footwork: 'Footwork',
  parry: 'Parries',
  attack: 'Attacks',
  blade: 'Blade actions',
  riposte: 'Ripostes',
  tactic: 'Tactics',
};
