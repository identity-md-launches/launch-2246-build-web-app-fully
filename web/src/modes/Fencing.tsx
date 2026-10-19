import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { npcChoose, OpponentModel, situationKey, type NpcLevel } from '../ai/npc';
import { bladeContact, buzzer, whistle } from '../audio/synth';
import { CATEGORY_LABEL, TECHNIQUE_BY_ID } from '../data/techniques';
import { bandFor } from '../rig/dimensions';
import { DEFAULT_CONFIG, PhraseSim, runPhrase, type PhraseConfig } from '../sim/phrase';
import { mulberry32, type Rng } from '../sim/prng';
import { replayTempo, TempoSession } from '../sim/tempo';
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

function TempoPad({ side, session, onAction }: { side: Side; session: TempoSession; onAction: (side: Side, choice: Choice) => void }) {
  const settings = useSettings();
  const legal = session.sim.legal(side);
  const [foot, setFoot] = useState('');
  const [blade, setBlade] = useState('');
  const valid = (c: Choice) => (!c.foot || legal.foot.includes(c.foot)) && (!c.blade || legal.blade.includes(c.blade));
  return (
    <section className={s.panel} aria-label={`${side} fencer Tempo pad`}>
      <h2 className={s.sectionTitle}>{side === 'left' ? 'Left fencer · red' : 'Right fencer · green'}</h2>
      <p className={s.muted}>Tap or press an action while moving. Footwork and blade actions can overlap.</p>
      <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
        {TEMPO_PAD.map((p) => (
          <button key={p.label} type="button" className={s.btn} disabled={!valid(p.choice)} onClick={() => onAction(side, p.choice)}>
            {p.label} <span className={s.muted}>{p.key}</span>
          </button>
        ))}
        {settings.quickSlots.map((id, i) => (
          <button key={`${id}-${i}`} type="button" className={s.btn} disabled={!legal.blade.includes(id)} onClick={() => onAction(side, { blade: id })}>
            {TECHNIQUE_BY_ID[id]?.name ?? id} <span className={s.muted}>{i + 1}</span>
          </button>
        ))}
      </div>
      <details style={{ marginBlockStart: 12 }}>
        <summary>All legal actions</summary>
        <div className={s.field}>
          <label htmlFor={`tempo-foot-${side}`}>Footwork</label>
          <select id={`tempo-foot-${side}`} className={s.input} style={{ minWidth: 0 }} value={legal.foot.includes(foot) ? foot : ''} onChange={(e) => setFoot(e.target.value)}>
            <option value="">Keep current footwork</option>
            {legal.foot.map((id) => <option key={id} value={id}>{TECHNIQUE_BY_ID[id].name}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <label htmlFor={`tempo-blade-${side}`}>Blade action</label>
          <select id={`tempo-blade-${side}`} className={s.input} style={{ minWidth: 0 }} value={legal.blade.includes(blade) ? blade : ''} onChange={(e) => setBlade(e.target.value)}>
            <option value="">Keep current blade action</option>
            {legal.blade.map((id) => <option key={id} value={id}>{TECHNIQUE_BY_ID[id].name}</option>)}
          </select>
        </div>
        <button type="button" className={s.btn} disabled={!(legal.foot.includes(foot) || legal.blade.includes(blade))} onClick={() => onAction(side, { foot: legal.foot.includes(foot) ? foot : undefined, blade: legal.blade.includes(blade) ? blade : undefined })}>Start selected actions</button>
      </details>
    </section>
  );
}

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
  const tempoRef = useRef<TempoSession | null>(null);
  const tempoStartedAt = useRef(0);
  const tempoFinished = useRef(false);
  const [keyboardSide, setKeyboardSide] = useState<Side>('left');
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
    tempoRef.current = setup.mode === 'tempo' ? new TempoSession(cfg, setup.opponent, model.current) : null;
    tempoStartedAt.current = performance.now();
    tempoFinished.current = false;
    player.onEnd = undefined;
    slices.current = [];
    const r = tempoRef.current ? tempoRef.current.sim.result() : runPhrase(cfg, []);
    setResult(r);
    player.setResult(r);
    player.playing = false;
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

  const publishTempo = useCallback((session: TempoSession) => {
    const r = session.sim.result();
    player.result = r;
    player.tick = session.sim.tick;
    player.playing = false; // The live 120 Hz clock drives Tempo; replay uses Player's clock.
    player.limit = Infinity;
    setResult(r);
    simRef.current = session.sim.context();
    player.emit();
    if (session.sim.ended && !tempoFinished.current) {
      tempoFinished.current = true;
      finishPhrase(r);
    }
  }, [finishPhrase, player]);

  useEffect(() => {
    if (setup.mode !== 'tempo' || stage !== 'pick' || !tempoRef.current) return;
    const session = tempoRef.current;
    let raf = 0;
    let lastPublish = 0;
    const advance = (now: number) => {
      session.advanceTo(Math.floor((now - tempoStartedAt.current) * 120 / 1000));
      if (session.sim.tick / 120 >= clock) session.sim.halt('Period time: halte!');
      // Stage reads the live result directly each render frame; HTML refreshes at 15 Hz.
      player.result = session.sim.result();
      player.tick = session.sim.tick;
      if (now - lastPublish >= 66 || session.sim.ended) {
        lastPublish = now;
        publishTempo(session);
      }
      if (!session.sim.ended) raf = requestAnimationFrame(advance);
    };
    raf = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(raf);
  }, [setup.mode, stage, clock, player, publishTempo]);

  const tempoInput = useCallback((side: Side, choice: Choice) => {
    const session = tempoRef.current;
    if (setup.mode !== 'tempo' || stage !== 'pick' || !session || session.sim.ended) return;
    const at = Math.floor((performance.now() - tempoStartedAt.current) * 120 / 1000);
    if (session.input(side, choice, at)) publishTempo(session);
  }, [setup.mode, stage, publishTempo]);

  // Tempo Mode: keys trigger actions immediately; the NPC reacts with its reaction time.
  const held = useRef(new Set<string>());
  useEffect(() => {
    if (setup.mode !== 'tempo' || stage !== 'pick') return;
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (e.repeat) return;
      held.current.add(k);
      let choice: Choice | null = null;
      if (k === settings.keys.lunge) choice = e.shiftKey ? { foot: 'FW15', blade: 'AT02' } : { foot: 'FW04', blade: 'AT02' };
      else if (k === settings.keys.retreat) choice = { foot: 'FW03' };
      else if (k === settings.keys.advance) choice = { foot: 'FW02' };
      else {
        const map: Record<string, string> = { [settings.keys.quarte]: 'PA01', [settings.keys.sixte]: 'PA02', [settings.keys.septime]: 'PA03', [settings.keys.octave]: 'PA04' };
        if (map[k]) choice = { blade: held.current.has(settings.keys.counter) ? COUNTER_OF[map[k]] : map[k] };
        const n = Number(k);
        if (n >= 1 && n <= 9) choice = { blade: settings.quickSlots[n - 1] };
      }
      if (!choice) return;
      e.preventDefault();
      tempoInput(setup.opponent === 'human' ? keyboardSide : 'left', choice);
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setup, stage, settings, tempoInput, keyboardSide]);

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
    const tempo = setup.mode === 'tempo' ? tempoRef.current : null;
    const p: SavedPhrase = { id: `${Date.now()}`, name: `${result.verdict.callFr} (${new Date().toLocaleString()})`, cfg: cfgRef.current, slices: slices.current.slice(), call: result.verdict.callEn, ...(tempo ? { tempoActions: tempo.sim.actions.slice(), endTick: tempo.sim.tick } : {}) };
    progress.savePhrase(p);
    setSaved(true);
  };
  const replaySaved = (p: SavedPhrase) => {
    const r = p.tempoActions ? replayTempo(p.cfg, p.tempoActions, p.endTick ?? p.tempoActions.at(-1)?.tick ?? 0) : runPhrase(p.cfg, p.slices);
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
          <p className={s.lead}>Two fencers on a regulation piste. Choose blind in Phrase Mode, or start actions as you press in real-time Tempo Mode.</p>
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
              Tempo keys: A/D retreat and advance, Space lunge, Shift+Space flèche, Q/E/Z/C quarte, sixte, septime, octave; hold R for the counter-parry; 1 to 9 for your quick slots. Touch screens use the pad. Human Tempo uses two live pads; choose which fencer the keyboard controls.
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
          Period {period}/{BOUT[setup.length].periods} · {mmss(Math.max(0, clock - (setup.mode === 'tempo' && stage === 'pick' ? tick / 120 : 0)))} · {setup.mode === 'tempo' ? 'Tempo Mode' : 'Phrase Mode'} · vs {setup.opponent}
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
          <Lamps result={setup.mode === 'tempo' || stage === 'end' || stage === 'boutEnd' ? result : null} tick={tick} />
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
          {stage === 'pick' && setup.mode === 'tempo' && tempoRef.current && (
            <>
              <div className={s.panel}>
                <h2 className={s.sectionTitle}>Tempo pad</h2>
                <p className={s.muted}>Live · {(tick / 120).toFixed(2)} s. Actions start at their press time. {setup.opponent === 'human' ? 'Both fencers are human-controlled.' : `The ${setup.opponent} NPC reacts after its own delay.`}</p>
                {setup.opponent === 'human' && <Segmented label="Keyboard fencer" value={keyboardSide} options={[{ value: 'left', label: 'Left · red' }, { value: 'right', label: 'Right · green' }]} onChange={setKeyboardSide} />}
                <button type="button" className={s.btn} onClick={() => { tempoRef.current!.sim.halt(); publishTempo(tempoRef.current!); }}>Halt phrase</button>
              </div>
              <TempoPad side="left" session={tempoRef.current} onAction={tempoInput} />
              {setup.opponent === 'human' && <TempoPad side="right" session={tempoRef.current} onAction={tempoInput} />}
            </>
          )}
          {stage === 'play' && (
            <div className={s.panel}>
              <p aria-live="polite">Playing the chosen phrase slice…</p>
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
                <button type="button" className={s.btn} onClick={save} disabled={saved || (!slices.current.length && !tempoRef.current?.sim.actions.length)}>
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
