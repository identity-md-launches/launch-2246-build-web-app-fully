import { useEffect, useMemo, useRef, useState } from 'react';
import { TECHNIQUES, TECHNIQUE_BY_ID } from '../data/techniques';
import type { Technique } from '../data/types';
import { configAtMeasure, runPhrase } from '../sim/phrase';
import { mulberry32, type Rng } from '../sim/prng';
import type { Choice, PhraseResult } from '../sim/types';
import { leitnerWeight, useProgress, type DrillName } from '../store/progress';
import { useSettings } from '../store/settings';
import { Lamps, RefereeCall, Segmented, Transport } from '../ui/components';
import { Player, usePlayerTick } from '../ui/player';
import { Stage } from '../ui/Stage';
import s from '../ui/ui.module.css';
import { baseConfig, demoFor, measureValue } from './demo';
import { buildPreview, buildSituation, isBuildSequenceCorrect, playBuildSequence, type BuildSituation } from './buildSequence';

const ROUNDS = 10;
const DRILLS: { id: DrillName; name: string; text: string }[] = [
  { id: 'identify', name: 'Identify It', text: 'A technique plays without labels. Pick its name from four options.' },
  { id: 'counter', name: 'Counter It', text: 'An attack starts. Choose a reliable counter before the window closes.' },
  { id: 'call', name: 'Call It', text: 'Watch a phrase with both lamps on and make the right-of-way call.' },
  { id: 'build', name: 'Build It', text: 'Assemble the right two-action sequence for a tactical situation.' },
];

interface Round {
  prompt: string;
  options: { label: string; correct: boolean }[];
  result: PhraseResult;
  techId: string;
  explain: string;
  build?: BuildSituation;
}

function weightedTech(rng: Rng, boxes: Record<string, number>, pool: Technique[]): Technique {
  const total = pool.reduce((a, t) => a + leitnerWeight(boxes[t.id]), 0);
  let r = rng() * total;
  for (const t of pool) {
    r -= leitnerWeight(boxes[t.id]);
    if (r <= 0) return t;
  }
  return pool[pool.length - 1];
}
function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CALL_SCENARIOS: [Choice, Choice][][] = [
  [[{ blade: 'AT02' }, { blade: 'CT01' }]],
  [[{ blade: 'AT02', timing: 'early' }, { blade: 'AT02', timing: 'early' }]],
  [[{ blade: 'AT02' }, { blade: 'CT03', timing: 'early' }]],
  [[{ blade: 'BL06' }, { blade: 'CT03', timing: 'early' }]],
  [[{ blade: 'AT06' }, { foot: 'FW02', blade: 'CT01' }]],
  [[{ blade: 'CT03', timing: 'early' }, { blade: 'AT02' }]],
  [[{ blade: 'CT01' }, { blade: 'AT02' }]],
];

export function makeRound(drill: DrillName, rng: Rng, boxes: Record<string, number>, cfg: ReturnType<typeof baseConfig>): Round {
  if (drill === 'identify') {
    const t = weightedTech(rng, boxes, TECHNIQUES.filter((x) => x.sim.role !== 'stance'));
    const distract = shuffle(rng, TECHNIQUES.filter((x) => x.id !== t.id && x.category === t.category)).slice(0, 3);
    return { prompt: 'Which technique is the red fencer performing?', options: shuffle(rng, [t, ...distract]).map((x) => ({ label: x.name, correct: x.id === t.id })), result: demoFor(t.id, cfg), techId: t.id, explain: `${t.name} (${t.french}): ${t.description}` };
  }
  if (drill === 'counter') {
    const pool = TECHNIQUES.filter((x) => x.category === 'attack' && x.counteredBy.some((c) => c.reliability === 'reliable'));
    const t = weightedTech(rng, boxes, pool);
    const good = t.counteredBy.filter((c) => c.reliability === 'reliable');
    const right = good[Math.floor(rng() * good.length)];
    const bad = shuffle(rng, TECHNIQUES.filter((x) => (x.category === 'parry' || x.category === 'tactic') && !t.counteredBy.some((c) => c.id === x.id))).slice(0, 3);
    return {
      prompt: `${t.name} is coming. Choose the counter.`,
      options: shuffle(rng, [TECHNIQUE_BY_ID[right.id], ...bad]).map((x) => ({ label: x.name, correct: x.id === right.id })),
      result: demoFor(t.id, cfg),
      techId: t.id,
      explain: `${TECHNIQUE_BY_ID[right.id].name}: ${right.why}`,
    };
  }
  if (drill === 'call') {
    const sc = CALL_SCENARIOS[Math.floor(rng() * CALL_SCENARIOS.length)];
    const r = runPhrase(configAtMeasure(cfg, measureValue('lunge', cfg.left.height)), sc);
    const ans = r.verdict.scorer;
    return {
      prompt: 'Both fencers hit. Who scores?',
      options: [
        { label: 'Left (red)', correct: ans === 'left' },
        { label: 'Right (green)', correct: ans === 'right' },
        { label: 'No touch', correct: ans === null },
      ],
      result: r,
      techId: sc[0][0].blade ?? 'AT02',
      explain: `${r.verdict.callFr}: ${r.verdict.why}`,
    };
  }
  // Build It starts at the edge of measure. The visitor chooses and orders individual actions.
  const pool = ['PA01', 'PA02', 'PA03', 'PA04', 'PA09', 'PA10'].map((id) => TECHNIQUE_BY_ID[id]);
  const t = weightedTech(rng, boxes, pool);
  const finishers = t.counteredBy.filter((c) => c.reliability === 'reliable' && TECHNIQUE_BY_ID[c.id].category === 'attack');
  const good = finishers[Math.floor(rng() * finishers.length)];
  const build = buildSituation(t.id, good.id);
  build.cards = shuffle(rng, build.cards);
  return {
    prompt: `You are one advance beyond lunge distance. Your opponent waits, then commits to ${t.name}. Build a preparation and finish that beat it.`,
    options: [],
    result: buildPreview(cfg),
    techId: t.id,
    explain: `Advance first to enter lunge distance, then deceive ${t.name}. ${TECHNIQUE_BY_ID[good.id].name}: ${good.why}`,
    build,
  };
}

export default function Drills() {
  const settings = useSettings();
  const progress = useProgress();
  const [drill, setDrill] = useState<DrillName>('identify');
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [answerCorrect, setAnswerCorrect] = useState(false);
  const [sequence, setSequence] = useState<string[]>([]);
  const [current, setCurrent] = useState<Round | null>(null);
  const [left, setLeft] = useState(1);
  const rng = useRef<Rng>(mulberry32(42));
  const player = useMemo(() => new Player(), []);
  const tick = usePlayerTick(player);
  const cfg = baseConfig(settings, 21);
  const windowSec = Math.max(3, 8 - round * 0.5);

  const next = (r: number) => {
    const rd = makeRound(drill, rng.current, progress.boxes, cfg);
    setCurrent(rd);
    setAnswer(null);
    setAnswerCorrect(false);
    setSequence([]);
    setRound(r);
    setLeft(1);
    player.setResult(rd.result);
    player.speed = drill === 'call' ? 0.35 : 0.5;
    player.loop = drill !== 'call';
    player.playing = true;
  };
  const start = () => {
    rng.current = mulberry32(Date.now() % 1e6);
    setCorrect(0);
    setRunning(true);
    next(1);
  };
  const choose = (i: number) => {
    if (answer !== null || !current) return;
    setAnswer(i);
    const ok = i >= 0 && current.options[i].correct;
    setAnswerCorrect(ok);
    if (ok) setCorrect((c) => c + 1);
    progress.recordAnswer(current.techId, ok);
  };
  const moveCard = (index: number, direction: -1 | 1) => {
    setSequence((cards) => {
      const next = [...cards];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  };
  const submitSequence = () => {
    if (answer !== null || !current?.build || sequence.length !== 2) return;
    const ok = isBuildSequenceCorrect(current.build, sequence);
    const result = playBuildSequence(current.build, sequence, cfg);
    setCurrent({ ...current, result });
    player.setResult(result);
    player.speed = 0.5;
    player.loop = false;
    player.playing = true;
    setAnswer(0);
    setAnswerCorrect(ok);
    if (ok) setCorrect((n) => n + 1);
    progress.recordAnswer(current.techId, ok);
  };
  // Counter It: the answer window shrinks every round.
  useEffect(() => {
    if (!running || drill !== 'counter' || answer !== null) return;
    const started = performance.now();
    const id = window.setInterval(() => {
      const f = 1 - (performance.now() - started) / (windowSec * 1000);
      setLeft(Math.max(0, f));
      if (f <= 0) {
        window.clearInterval(id);
        choose(-1);
      }
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, drill, answer, round]);

  const finish = () => {
    const score = correct;
    progress.finishDrill(drill, score, score >= 7);
    setRunning(false);
    setCurrent(null);
  };

  return (
    <div className={s.page}>
      <div>
        <h1 className={s.pageTitle}>Drills</h1>
        <p className={s.lead}>Ten rounds each. Weak techniques come back more often (Leitner boxes); seven correct passes the drill.</p>
      </div>
      {!running ? (
        <div className={s.panel}>
          <Segmented label="Drill" value={drill} options={DRILLS.map((d) => ({ value: d.id, label: d.name }))} onChange={setDrill} />
          <p>{DRILLS.find((d) => d.id === drill)!.text}</p>
          <p className={s.muted}>Best score: {progress.drillBest[drill] ?? 0}/10 · drills passed: {progress.drillsPassed}</p>
          <button type="button" className={`${s.btn} ${s.primary}`} onClick={start}>
            Start {DRILLS.find((d) => d.id === drill)!.name}
          </button>
        </div>
      ) : (
        current && (
          <div className={s.split}>
            <div className={s.panel}>
              <Stage player={player} label={current.build ? answer === null ? 'Tactical setup: both fencers waiting outside lunge distance' : 'Your assembled action sequence against the described partner' : 'Drill demonstration without labels'} className={s.stage} />
              {(drill === 'call' || (drill === 'build' && answer !== null)) && <Lamps result={current.result} tick={tick} />}
              {drill === 'build' && answer !== null && <><Transport player={player} /><RefereeCall result={current.result} /></>}
            </div>
            <div className={s.panel}>
              <p className={s.muted}>
                Round {round}/{ROUNDS} · {correct} correct
              </p>
              <h2 className={s.sectionTitle}>{current.prompt}</h2>
              {drill === 'counter' && answer === null && (
                <div className={s.meter} role="progressbar" aria-label="Time left" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(left * 100)}>
                  <div className={s.meterFill} style={{ width: `${left * 100}%` }} />
                </div>
              )}
              {current.build ? (
                <>
                  <p className={s.muted}>Choose two action cards in order, then submit. You can reorder or remove cards before submitting.</p>
                  <h3 className={s.sectionTitle}>Your sequence ({sequence.length}/2)</h3>
                  {sequence.length === 0 ? <p className={s.muted}>No actions selected yet.</p> : (
                    <ol className={s.list} aria-label="Your action sequence">
                      {sequence.map((id, index) => (
                        <li key={id}>
                          <p>{index + 1}. {TECHNIQUE_BY_ID[id].name}</p>
                          <div className={s.row}>
                            <button type="button" className={s.btn} disabled={answer !== null || index === 0} aria-label={`Move ${TECHNIQUE_BY_ID[id].name} earlier`} onClick={() => moveCard(index, -1)}>Move earlier</button>
                            <button type="button" className={s.btn} disabled={answer !== null || index === sequence.length - 1} aria-label={`Move ${TECHNIQUE_BY_ID[id].name} later`} onClick={() => moveCard(index, 1)}>Move later</button>
                            <button type="button" className={s.btn} disabled={answer !== null} aria-label={`Remove ${TECHNIQUE_BY_ID[id].name}`} onClick={() => setSequence((cards) => cards.filter((_, i) => i !== index))}>Remove</button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  <h3 className={s.sectionTitle}>Available actions</h3>
                  <ul className={s.list} aria-label="Action cards">
                    {current.build.cards.map((id) => (
                      <li key={id}>
                        <button type="button" className={s.option} data-action-id={id} disabled={answer !== null || sequence.length === 2 || sequence.includes(id)} onClick={() => setSequence((cards) => [...cards, id])}>
                          {TECHNIQUE_BY_ID[id].name} <span className={s.muted}>· {TECHNIQUE_BY_ID[id].category === 'footwork' ? 'footwork' : 'blade action'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={`${s.btn} ${s.primary}`} disabled={answer !== null || sequence.length !== 2} onClick={submitSequence}>Submit sequence</button>
                </>
              ) : (
                <ul className={s.list}>
                  {current.options.map((o, i) => (
                    <li key={i}>
                      <button type="button" className={`${s.option} ${answer !== null && o.correct ? s.correct : ''} ${answer === i && !o.correct ? s.wrong : ''}`} onClick={() => choose(i)} disabled={answer !== null}>
                        {o.label}
                        {answer !== null && o.correct ? ' (correct)' : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {answer !== null && (
                <div aria-live="polite" className={s.call}>
                  <p>{answerCorrect ? 'Correct.' : answer < 0 ? 'Time is up.' : 'Not quite.'}</p>
                  <p className={s.muted}>{current.explain}</p>
                  {round < ROUNDS ? (
                    <button type="button" className={`${s.btn} ${s.primary}`} onClick={() => next(round + 1)} autoFocus>
                      Next round
                    </button>
                  ) : (
                    <button type="button" className={`${s.btn} ${s.primary}`} onClick={finish} autoFocus>
                      See result: {correct}/{ROUNDS}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
