import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { npcChoose, OpponentModel, situationKey, type NpcLevel } from '../ai/npc';
import { bladeContact, buzzer, whistle } from '../audio/synth';
import { CATEGORY_LABEL, TECHNIQUE_BY_ID } from '../data/techniques';
import { bandFor } from '../rig/dimensions';
import { DEFAULT_CONFIG, PhraseSim, runPhrase, type PhraseConfig } from '../sim/phrase';
import { mulberry32, type Rng } from '../sim/prng';
import type { Choice, PhraseResult, Side, Timing } from '../sim/types';
import { useProgress, type SavedPhrase } from '../store/progress';
import { formatLength, useSettings } from '../store/settings';
import { CameraBar, Captions, CategoryIcon, Lamps, PhraseTimeline, RefereeCall, Segmented, Transport } from '../ui/components';
import { Player, usePlayerTick } from '../ui/player';
import { Stage, type CameraPreset } from '../ui/Stage';
import s from '../ui/ui.module.css';

type Opponent = 'human' | NpcLevel;
type BoutLength = 'single' | 'five' | 'fifteen';
type InputMode = 'phrase' | 'tempo';
const BOUT: Record<BoutLength, { touches: number; periods: number; label: string }> = {
  single: { touches: 1, periods: 1, label: 'Single phrase' },
  five: { touches: 5, periods: 1, label: '5 touches · 3 min' },
  fifteen: { touches: 15, periods: 3, label: '15 touches · 3 × 3 min' },
};
const PERIOD_SEC = 180;

interface Setup {
  opponent: Opponent;
  length: BoutLength;
  mode: InputMode;
  handedLeft: 1 | -1;
  handedRight: 1 | -1;
}

function Picker({ side, sim, onLock, human }: { side: Side; sim: PhraseSim; onLock: (c: Choice) => void; human: string }) {
  const legal = sim.legal(side);
  const [foot, setFoot] = useState<string | undefined>();
  const [blade, setBlade] = useState<string | undefined>();
  const [timing, setTiming] = useState<Timing>('onTime');
  const [tab, setTab] = useState<'blade' | 'foot'>(sim.state === 'PARRY_CONTACT' || sim.state === 'COUNTER_RIPOSTE' ? 'blade' : 'foot');
  const groups = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const id of legal.blade) {
      const c = CATEGORY_LABEL[TECHNIQUE_BY_ID[id].category];
      g.set(c, [...(g.get(c) ?? []), id]);
    }
    return [...g.entries()];
  }, [legal.blade]);
  const units = useSettings((st) => st.units);
  const m = sim.measure(side);
  const band = bandFor(m, sim.tracks[side].rig);
  const card = (id: string, selected: boolean, onClick: () => void) => {
    const t = TECHNIQUE_BY_ID[id];
    return (
      <li key={id}>
        <button type="button" className={s.card} aria-pressed={selected} onClick={onClick} style={{ width: '100%' }}>
          <span className={s.icon}>
            <CategoryIcon c={t.category} />
          </span>
          <span className={s.cardTitle}>{t.name}</span>
          <span className={s.cardMeta}>{t.id}</span>
        </button>
      </li>
    );
  };
  return (
    <div className={s.panel} aria-label={`${human} chooses an action`}>
      <h2 className={s.sectionTitle} style={{ color: side === 'left' ? 'var(--color-left-text)' : 'var(--color-right-text)' }}>
        {human}: choose your action
      </h2>
      <p className={s.muted}>
        Measure {formatLength(m, units)} ({band}). Phrase state: {sim.state.replace('_', ' ').toLowerCase()}. Pick footwork, a blade action, or both.
      </p>
      <Segmented
        label="Card type"
        value={tab}
        options={[
          { value: 'foot', label: `Footwork${foot ? ' ✓' : ''}` },
          { value: 'blade', label: `Blade${blade ? ' ✓' : ''}` },
        ]}
        onChange={setTab}
      />
      <div style={{ maxHeight: 360, overflow: 'auto', paddingInlineEnd: 4 }}>
        {tab === 'foot' ? (
          <ul className={`${s.list} ${s.grid}`}>{legal.foot.map((id) => card(id, foot === id, () => setFoot(foot === id ? undefined : id)))}</ul>
        ) : (
          groups.map(([g, ids]) => (
            <div key={g} style={{ marginBlockEnd: 12 }}>
              <h3 style={{ fontSize: 'var(--fs-sm)', marginBlockEnd: 6 }}>{g}</h3>
              <ul className={`${s.list} ${s.grid}`}>{ids.map((id) => card(id, blade === id, () => setBlade(blade === id ? undefined : id)))}</ul>
            </div>
          ))
        )}
      </div>
      <div className={s.row}>
        <span className={s.muted}>Reaction timing</span>
        <Segmented
          label="Reaction timing"
          value={timing}
          options={[
            { value: 'early', label: 'Early' },
            { value: 'onTime', label: 'On time' },
            { value: 'late', label: 'Late' },
          ]}
          onChange={setTiming}
        />
      </div>
      <div className={s.row}>
        <button type="button" className={`${s.btn} ${s.primary}`} disabled={!foot && !blade} onClick={() => onLock({ foot, blade, timing })}>
          Lock in {[foot && TECHNIQUE_BY_ID[foot].name, blade && TECHNIQUE_BY_ID[blade].name].filter(Boolean).join(' + ') || 'an action'}
        </button>
        <button type="button" className={s.btn} onClick={() => onLock({ foot: 'FW25', timing })}>
          Hold distance
        </button>
      </div>
    </div>
  );
}

const TEMPO_PAD: { label: string; key: string; choice: Choice }[] = [
  { label: 'Retreat', key: 'A', choice: { foot: 'FW03' } },
  { label: 'Advance', key: 'D', choice: { foot: 'FW02' } },
  { label: 'Lunge', key: 'Space', choice: { foot: 'FW04', blade: 'AT02' } },
  { label: 'Flèche', key: 'Shift+Space', choice: { foot: 'FW15', blade: 'AT02' } },
  { label: 'Quarte', key: 'Q', choice: { blade: 'PA01' } },
  { label: 'Sixte', key: 'E', choice: { blade: 'PA02' } },
  { label: 'Septime', key: 'Z', choice: { blade: 'PA03' } },
  { label: 'Octave', key: 'C', choice: { blade: 'PA04' } },
];
const COUNTER_OF: Record<string, string> = { PA01: 'PA10', PA02: 'PA09', PA03: 'PA11', PA04: 'PA12' };

export default function Fencing() {
  const settings = useSettings();
  const progress = useProgress();
  const [setup, setSetup] = useState<Setup>({ opponent: 'club', length: 'five', mode: 'phrase', handedLeft: settings.handedLeft, handedRight: settings.handedRight });
  const [stage, setStage] = useState<'setup' | 'pick' | 'pass' | 'play' | 'end' | 'boutEnd'>('setup');
  const [picker, setPicker] = useState<Side>('left');
  const [pending, setPending] = useState<Choice | null>(null);
  const [score, setScore] = useState({ left: 0, right: 0 });
  const [period, setPeriod] = useState(1);
  const [clock, setClock] = useState(PERIOD_SEC);
  const [result, setResult] = useState<PhraseResult | null>(null);
  const [camera, setCamera] = useState<CameraPreset>('referee');
  const [saved, setSaved] = useState(false);
  const player = useMemo(() => new Player(), []);
  const slices = useRef<[Choice, Choice][]>([]);
  const simRef = useRef<PhraseSim | null>(null);
  const cfgRef = useRef<PhraseConfig>(DEFAULT_CONFIG);
  const rngRef = useRef<Rng>(mulberry32(1));
  const model = useRef(new OpponentModel());
  const seed = useRef(Date.now() % 100000);
  const positions = useRef<{ leftX: number; rightX: number }>({ leftX: -2.25, rightX: 2.25 });
  const tick = usePlayerTick(player);

  const newSim = useCallback(() => {
    seed.current += 1;
    rngRef.current = mulberry32(seed.current);
    const cfg: PhraseConfig = {
      seed: seed.current,
      tempoSec: settings.tempoSec,
      left: { height: settings.heightLeft, handed: setup.handedLeft },
      right: { height: settings.heightRight, handed: setup.handedRight },
      ...positions.current,
    };
    cfgRef.current = cfg;
    simRef.current = new PhraseSim(cfg);
    slices.current = [];
    const r = runPhrase(cfg, []);
    setResult(r);
    player.setResult(r);
    player.limit = 1;
    player.loop = false;
    whistle();
  }, [settings, setup, player]);

  const startBout = () => {
    setScore({ left: 0, right: 0 });
    setPeriod(1);
    setClock(PERIOD_SEC);
    positions.current = { leftX: -2.25, rightX: 2.25 };
    newSim();
    setPicker('left');
    setStage('pick');
  };

  const finishPhrase = useCallback(
    (r: PhraseResult) => {
      setResult(r);
      if (r.registered.length) buzzer();
      if (r.events.some((e) => e.kind === 'parry' && e.success)) bladeContact();
      // Slow-motion auto replay from the best camera (no auto cut under reduced motion).
      player.setResult(r, 0);
      player.speed = 0.25;
      player.loop = false;
      player.playing = true;
      if (!settings.reducedMotion) setCamera(r.registered.length ? 'referee' : 'top');
      const sc = { ...score };
      if (r.verdict.scorer) sc[r.verdict.scorer] += 1;
      setScore(sc);
      setClock((c) => Math.max(0, c - r.endTick / 120));
      const fin = r.frames[r.frames.length - 1];
      // After a touch fencers return to the on-guard lines; otherwise they resume where they stopped.
      positions.current = r.verdict.scorer
        ? { leftX: -2.25, rightX: 2.25 }
        : { leftX: Math.max(-6.3, fin.left.rootX + fin.left.lower.pelvisX * (settings.heightLeft / 1.78)), rightX: Math.min(6.3, fin.right.rootX - fin.right.lower.pelvisX * (settings.heightRight / 1.78)) };
      if (positions.current.rightX - positions.current.leftX < 3) positions.current = { leftX: -2.25, rightX: 2.25 };
      const target = BOUT[setup.length].touches;
      const done = sc.left >= target || sc.right >= target || setup.length === 'single';
      setSaved(false);
      setStage(done ? 'boutEnd' : 'end');
      if (done && setup.opponent !== 'human') progress.recordBout(sc.left > sc.right);
    },
    [player, score, settings, setup, progress],
  );

  const resolve = useCallback(
    (left: Choice, right: Choice) => {
      const sim = simRef.current!;
      const sitL = situationKey(sim, 'left');
      model.current.record(sitL, left);
      const out = sim.slice(left, right);
      slices.current.push([left, right]);
      const r = runPhrase(cfgRef.current, slices.current);
      const prevEnd = sim.slices.length > 1 ? sim.slices[sim.slices.length - 2].end : 0;
      if (out.ended) {
        finishPhrase(r);
        return;
      }
      setResult(r);
      player.setResult(r, prevEnd);
      player.limit = out.end;
      player.speed = 1;
      player.loop = false;
      player.playing = true;
      if (r.events.some((e) => e.kind === 'parry' && e.success && e.t > prevEnd)) bladeContact();
      setStage('play');
      player.onEnd = () => {
        player.onEnd = undefined;
        setPicker('left');
        setStage('pick');
      };
    },
    [player, finishPhrase],
  );

  const lockIn = (c: Choice) => {
    if (picker === 'left') {
      if (setup.opponent === 'human') {
        setPending(c);
        setStage('pass');
        return;
      }
      const npc = npcChoose(simRef.current!, 'right', setup.opponent, rngRef.current, model.current, settings.tempoSec);
      resolve(c, npc);
    } else {
      resolve(pending!, c);
      setPending(null);
    }
  };

  // Tempo Mode: keys trigger actions immediately; the NPC reacts with its reaction time.
  const held = useRef(new Set<string>());
  useEffect(() => {
    if (setup.mode !== 'tempo' || (stage !== 'pick' && stage !== 'play')) return;
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      held.current.add(k);
      let choice: Choice | null = null;
      if (k === ' ') choice = e.shiftKey ? { foot: 'FW15', blade: 'AT02' } : { foot: 'FW04', blade: 'AT02' };
      else if (k === settings.keys.retreat) choice = { foot: 'FW03' };
      else if (k === settings.keys.advance) choice = { foot: 'FW02' };
      else {
        const map: Record<string, string> = { [settings.keys.quarte]: 'PA01', [settings.keys.sixte]: 'PA02', [settings.keys.septime]: 'PA03', [settings.keys.octave]: 'PA04' };
        if (map[k]) choice = { blade: held.current.has(settings.keys.counter) ? COUNTER_OF[map[k]] : map[k] };
        const n = Number(k);
        if (n >= 1 && n <= 9) choice = { blade: settings.quickSlots[n - 1] };
      }
      if (!choice || stage !== 'pick') return;
      e.preventDefault();
      const sim = simRef.current!;
      const legal = sim.legal('left');
      if (choice.blade && !legal.blade.includes(choice.blade)) choice = { ...choice, blade: undefined };
      if (choice.foot && !legal.foot.includes(choice.foot)) choice = { ...choice, foot: undefined };
      if (!choice.foot && !choice.blade) return;
      const npc = npcChoose(sim, 'right', setup.opponent === 'human' ? 'club' : setup.opponent, rngRef.current, model.current, settings.tempoSec);
      resolve({ ...choice, timing: 'early' }, npc);
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setup, stage, settings, resolve]);

  const nextPhrase = () => {
    if (clock <= 0) {
      if (period < BOUT[setup.length].periods) {
        setPeriod(period + 1);
        setClock(PERIOD_SEC);
      } else {
        setStage('boutEnd');
        return;
      }
    }
    newSim();
    setPicker('left');
    setStage('pick');
  };

  const save = () => {
    if (!result) return;
    const p: SavedPhrase = { id: `${Date.now()}`, name: `${result.verdict.callFr} (${new Date().toLocaleString()})`, cfg: cfgRef.current, slices: slices.current.slice(), call: result.verdict.callEn };
    progress.savePhrase(p);
    setSaved(true);
  };
  const replaySaved = (p: SavedPhrase) => {
    const r = runPhrase(p.cfg, p.slices);
    setResult(r);
    player.setResult(r, 0);
    player.speed = 0.5;
    player.loop = false;
    player.playing = true;
    setStage('end');
  };

  const human = (side: Side) => (side === 'left' ? 'Left fencer (red)' : setup.opponent === 'human' ? 'Right fencer (green)' : 'NPC');
  const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

  if (stage === 'setup') {
    return (
      <div className={s.page}>
        <div>
          <h1 className={s.pageTitle}>Fencing Mode</h1>
          <p className={s.lead}>Two fencers on a regulation piste. Each tempo slice, both sides choose blind; the simulation resolves it and the referee calls the phrase.</p>
        </div>
        <div className={s.panel}>
          <div className={s.field}>
            Opponent
            <Segmented
              label="Opponent"
              value={setup.opponent}
              options={[
                { value: 'human', label: 'Human (hot-seat)' },
                { value: 'novice', label: 'NPC Novice' },
                { value: 'club', label: 'NPC Club' },
                { value: 'expert', label: 'NPC Expert' },
                { value: 'adaptive', label: 'NPC Adaptive' },
              ]}
              onChange={(v) => setSetup({ ...setup, opponent: v })}
            />
          </div>
          <div className={s.field}>
            Bout length
            <Segmented label="Bout length" value={setup.length} options={(Object.keys(BOUT) as BoutLength[]).map((k) => ({ value: k, label: BOUT[k].label }))} onChange={(v) => setSetup({ ...setup, length: v })} />
          </div>
          <div className={s.field}>
            Input mode
            <Segmented
              label="Input mode"
              value={setup.mode}
              options={[
                { value: 'phrase', label: 'Phrase Mode' },
                { value: 'tempo', label: 'Tempo Mode' },
              ]}
              onChange={(v) => setSetup({ ...setup, mode: v })}
            />
          </div>
          <div className={s.row}>
            <div className={s.field}>
              Left fencer
              <Segmented label="Left fencer handedness" value={setup.handedLeft} options={[{ value: 1, label: 'Right-handed' }, { value: -1, label: 'Left-handed' }]} onChange={(v) => setSetup({ ...setup, handedLeft: v as 1 | -1 })} />
            </div>
            <div className={s.field}>
              Right fencer
              <Segmented label="Right fencer handedness" value={setup.handedRight} options={[{ value: 1, label: 'Right-handed' }, { value: -1, label: 'Left-handed' }]} onChange={(v) => setSetup({ ...setup, handedRight: v as 1 | -1 })} />
            </div>
          </div>
          {setup.mode === 'tempo' && (
            <p className={s.muted}>
              Tempo keys: A/D retreat and advance, Space lunge, Shift+Space flèche, Q/E/Z/C quarte, sixte, septime, octave; hold R for the counter-parry; 1 to 9 for your quick slots. Touch screens use the pad.
            </p>
          )}
          <button type="button" className={`${s.btn} ${s.primary}`} onClick={startBout}>
            En garde
          </button>
        </div>
        <PhraseLibrary onReplay={replaySaved} />
      </div>
    );
  }

  const sim = simRef.current;
  return (
    <div className={s.page}>
      <div className={s.row} style={{ justifyContent: 'space-between' }}>
        <h1 className={s.pageTitle}>
          <span style={{ color: 'var(--color-left-text)' }}>{score.left}</span> : <span style={{ color: 'var(--color-right-text)' }}>{score.right}</span>
        </h1>
        <span className={s.muted}>
          Period {period}/{BOUT[setup.length].periods} · {mmss(clock)} · {setup.mode === 'tempo' ? 'Tempo Mode' : 'Phrase Mode'} · vs {setup.opponent}
        </span>
        <button type="button" className={s.btn} onClick={() => setStage('setup')}>
          End bout
        </button>
      </div>
      {stage === 'pass' && (
        <div className={s.dialogBackdrop} role="dialog" aria-modal="true" aria-labelledby="pass-title">
          <div className={s.panel} style={{ maxWidth: 420, textAlign: 'center' }}>
            <h2 id="pass-title" className={s.sectionTitle}>
              Pass the device to the right fencer
            </h2>
            <p className={s.muted}>The left fencer's choice is hidden.</p>
            <button type="button" className={`${s.btn} ${s.primary}`} autoFocus onClick={() => (setPicker('right'), setStage('pick'))}>
              I am the right fencer
            </button>
          </div>
        </div>
      )}
      <div className={s.split}>
        <div className={s.panel}>
          <Stage player={player} camera={camera} label="Fencing piste: red fencer on the left, green on the right" className={s.stage} />
          <Captions result={result} player={player} />
          <Lamps result={stage === 'end' || stage === 'boutEnd' ? result : null} tick={tick} />
          <CameraBar value={camera} onChange={setCamera} />
          {(stage === 'end' || stage === 'boutEnd') && result && (
            <>
              <Transport player={player} />
              <RefereeCall result={result} />
              <PhraseTimeline result={result} player={player} />
            </>
          )}
        </div>
        <div>
          {stage === 'pick' && sim && setup.mode === 'phrase' && <Picker key={`${picker}-${sim.sliceCount}`} side={picker} sim={sim} onLock={lockIn} human={human(picker)} />}
          {stage === 'pick' && sim && setup.mode === 'tempo' && (
            <div className={s.panel}>
              <h2 className={s.sectionTitle}>Tempo pad</h2>
              <p className={s.muted}>Press a key or tap an action: it starts at once and the NPC reacts at its own speed.</p>
              <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {TEMPO_PAD.map((p) => (
                  <button key={p.label} type="button" className={s.btn} onClick={() => resolve({ ...p.choice, timing: 'early' }, npcChoose(sim, 'right', setup.opponent === 'human' ? 'club' : setup.opponent, rngRef.current, model.current, settings.tempoSec))}>
                    {p.label} <span className={s.muted}>{p.key}</span>
                  </button>
                ))}
                {sim.legal('left').blade.filter((id) => id.startsWith('RR')).slice(0, 3).map((id) => (
                  <button key={id} type="button" className={s.btn} onClick={() => resolve({ blade: id, timing: 'early' }, npcChoose(sim, 'right', setup.opponent === 'human' ? 'club' : setup.opponent, rngRef.current, model.current, settings.tempoSec))}>
                    {TECHNIQUE_BY_ID[id].name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {stage === 'play' && (
            <div className={s.panel}>
              <p aria-live="polite">Resolving the tempo slice…</p>
              <button type="button" className={s.btn} onClick={() => (player.seek(player.end), player.onEnd?.())}>
                Skip animation
              </button>
            </div>
          )}
          {(stage === 'end' || stage === 'boutEnd') && (
            <div className={s.panel}>
              <h2 className={s.sectionTitle}>{stage === 'boutEnd' ? (score.left === score.right ? 'Bout drawn' : `${score.left > score.right ? 'Left (red)' : 'Right (green)'} wins the bout`) : 'Phrase over'}</h2>
              <p className={s.muted}>The replay runs at 0.25× speed. Scrub the timeline to check the lockout window and priority.</p>
              <div className={s.row}>
                {stage === 'end' ? (
                  <button type="button" className={`${s.btn} ${s.primary}`} onClick={nextPhrase}>
                    Next phrase
                  </button>
                ) : (
                  <button type="button" className={`${s.btn} ${s.primary}`} onClick={startBout}>
                    New bout
                  </button>
                )}
                <button type="button" className={s.btn} onClick={save} disabled={saved || !slices.current.length}>
                  {saved ? 'Saved' : 'Save phrase'}
                </button>
              </div>
            </div>
          )}
          <PhraseLibrary onReplay={replaySaved} />
        </div>
      </div>
    </div>
  );
}

function PhraseLibrary({ onReplay }: { onReplay: (p: SavedPhrase) => void }) {
  const phrases = useProgress((p) => p.phrases);
  const del = useProgress((p) => p.deletePhrase);
  return (
    <section className={s.panel} aria-labelledby="library-title" style={{ marginBlockStart: 16 }}>
      <h2 id="library-title" className={s.sectionTitle}>
        Phrase Library
      </h2>
      {phrases.length ? (
        <ul className={s.list}>
          {phrases.map((p) => (
            <li key={p.id} className={s.row} style={{ justifyContent: 'space-between' }}>
              <span>
                {p.name}
                <br />
                <span className={s.muted}>{p.call}</span>
              </span>
              <span className={s.row}>
                <button type="button" className={`${s.btn} ${s.small}`} onClick={() => onReplay(p)}>
                  Replay
                </button>
                <button type="button" className={`${s.btn} ${s.small}`} onClick={() => del(p.id)} aria-label={`Delete ${p.name}`}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>Saved phrases appear here. Finish a phrase and choose Save phrase to keep it.</p>
      )}
    </section>
  );
}
