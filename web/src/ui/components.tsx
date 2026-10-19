import { useState, type ReactNode } from 'react';
import { CATEGORY_LABEL } from '../data/techniques';
import type { Category, Technique } from '../data/types';
import type { PhraseResult } from '../sim/types';
import { useSettings } from '../store/settings';
import type { CameraPreset, OverlayFlags } from './Stage';
import { usePlayerTick, type Player } from './player';
import s from './ui.module.css';

const ICON_PATHS: Record<Category, string> = {
  footwork: 'M5 18h5l2-4 3 4h4M8 6a2 2 0 1 0 0 .1M9 9l-2 5',
  parry: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
  attack: 'M4 20L18 6m0 0h-5m5 0v5',
  blade: 'M3 21l3-3m0 0l12-12 3-3M6 18l-2-2m2 2l2 2',
  riposte: 'M4 12h12m0 0l-4-4m4 4l-4 4M20 5v14',
  tactic: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zm0 5v4l3 2',
};
export function CategoryIcon({ c }: { c: Category }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[c]} />
    </svg>
  );
}

export function TechniqueCard({ t, onClick, current, meta }: { t: Technique; onClick: () => void; current?: boolean; meta?: ReactNode }) {
  return (
    <button type="button" className={s.card} onClick={onClick} aria-current={current ? 'true' : undefined}>
      <span className={s.icon}>
        <CategoryIcon c={t.category} />
      </span>
      <span className={s.cardTitle}>
        {t.name} <span className={s.muted}>· {t.id}</span>
      </span>
      <span className={s.cardMeta}>{meta ?? `${t.french} · ${CATEGORY_LABEL[t.category]} · ${t.level}`}</span>
    </button>
  );
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className={s.seg} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PHASE_COLORS: Record<string, string> = { preparation: '#5b6b8c', execution: '#c28a12', finish: '#c2410c', recovery: '#3f6f55' };

/** Play/pause, frame step, speed, loop and a scrubber with phase and sync markers. */
export function Transport({ player, phases, markers }: { player: Player; phases?: { name: string; start: number; end: number }[]; markers?: { t: number; label: string }[] }) {
  const tick = usePlayerTick(player);
  const end = Math.max(1, player.end);
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / end) * 100))}%`;
  const [speed, setSpeed] = useState(player.speed);
  const [loop, setLoop] = useState(player.loop);
  return (
    <div className={s.transport}>
      <div className={s.row}>
        <button type="button" className={`${s.btn} ${s.iconBtn}`} onClick={() => player.toggle()} aria-label={player.playing ? 'Pause' : 'Play'}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
            {player.playing ? <path d="M4 2h3v12H4zM9 2h3v12H9z" /> : <path d="M4 2l10 6-10 6z" />}
          </svg>
        </button>
        <button type="button" className={`${s.btn} ${s.iconBtn}`} onClick={() => player.step(-1)} aria-label="Step back one frame">
          ‹
        </button>
        <button type="button" className={`${s.btn} ${s.iconBtn}`} onClick={() => player.step(1)} aria-label="Step forward one frame">
          ›
        </button>
        <Segmented
          label="Playback speed"
          value={speed}
          options={[0.1, 0.25, 0.5, 1].map((v) => ({ value: v, label: `${v}×` }))}
          onChange={(v) => {
            player.speed = v;
            setSpeed(v);
          }}
        />
        <button
          type="button"
          className={`${s.chip}`}
          aria-pressed={loop}
          onClick={() => {
            player.loop = !player.loop;
            setLoop(player.loop);
          }}
        >
          Loop
        </button>
        <span className={s.muted} aria-live="off">
          {(tick / 120).toFixed(2)} s
        </span>
      </div>
      <div className={s.scrub}>
        {markers?.map((m) => (
          <span key={m.label + m.t} className={s.marker} style={{ insetInlineStart: pct(m.t) }} title={m.label} />
        ))}
        <input type="range" min={0} max={end} step={1} value={Math.round(tick)} aria-label="Timeline scrubber" onChange={(e) => player.seek(Number(e.target.value))} onPointerDown={() => (player.playing = false)} />
        {phases?.map((p) => (
          <span key={p.name} className={s.phaseBar} style={{ insetInlineStart: pct(p.start), width: `calc(${pct(p.end - p.start)} - 2px)`, background: PHASE_COLORS[p.name] }} title={p.name} />
        ))}
      </div>
      {phases && (
        <div className={s.row}>
          {phases.map((p) => (
            <span key={p.name} className={s.muted} style={{ fontSize: 'var(--fs-xs)' }}>
              <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: PHASE_COLORS[p.name], marginInlineEnd: 4 }} />
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const CAMERA_LABELS: Record<CameraPreset, string> = {
  referee: 'Referee',
  top: 'Top-down',
  attacker: 'Behind attacker',
  defender: 'Behind defender',
  pov: 'Weapon POV',
  orbit: 'Free orbit',
};
export function CameraBar({ value, onChange }: { value: CameraPreset; onChange: (c: CameraPreset) => void }) {
  return <Segmented label="Camera" value={value} options={(Object.keys(CAMERA_LABELS) as CameraPreset[]).map((c) => ({ value: c, label: CAMERA_LABELS[c] }))} onChange={onChange} />;
}

const OVERLAY_LABELS: Record<keyof OverlayFlags, string> = {
  targets: 'Target zones',
  quadrants: 'Line quadrants',
  trail: 'Tip trail',
  zones: 'Forte · middle · faible',
  ruler: 'Distance ruler',
  ghost: 'Ideal-pose ghost',
};
export function OverlayToggles({ value, onChange, extra }: { value: OverlayFlags; onChange: (o: OverlayFlags) => void; extra?: ReactNode }) {
  return (
    <div className={s.row} role="group" aria-label="Overlays">
      {(Object.keys(OVERLAY_LABELS) as (keyof OverlayFlags)[]).map((k) => (
        <button key={k} type="button" className={s.chip} aria-pressed={value[k]} onClick={() => onChange({ ...value, [k]: !value[k] })}>
          {OVERLAY_LABELS[k]}
        </button>
      ))}
      {extra}
    </div>
  );
}

/** HTML scoring box lamps; colourblind mode adds shapes. */
export function Lamps({ result, tick }: { result: PhraseResult | null; tick: number }) {
  const cb = useSettings((st) => st.colorblind);
  const lit = (side: 'left' | 'right', valid: boolean) =>
    !!result && result.registered.some((r) => r.side === side && r.valid === valid && r.tick <= tick && (result.lockoutStart === null || r.tick <= result.lockoutStart + 36));
  const L = lit('left', true);
  const R = lit('right', true);
  const WL = lit('left', false);
  const WR = lit('right', false);
  return (
    <div className={s.lamps} role="status" aria-label={`Scoring box: ${[L && 'red on', WL && 'left white on', WR && 'right white on', R && 'green on'].filter(Boolean).join(', ') || 'no lights'}`}>
      <span className={L ? s.lampRed : s.lamp}>{cb ? (L ? '▲ Left' : 'Left') : 'Left'}</span>
      <span className={WL ? s.lampWhite : s.lamp}>{cb && WL ? '○ Off' : 'White'}</span>
      <span className={WR ? s.lampWhite : s.lamp}>{cb && WR ? '○ Off' : 'White'}</span>
      <span className={R ? s.lampGreen : s.lamp}>{cb ? (R ? '■ Right' : 'Right') : 'Right'}</span>
    </div>
  );
}

/** Both fencers' action tracks, blade contacts, tip arrivals, lockout window and priority bar. */
export function PhraseTimeline({ result, player }: { result: PhraseResult; player: Player }) {
  const tick = usePlayerTick(player);
  const end = Math.max(1, result.endTick);
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / end) * 100))}%`;
  const prio = result.priority;
  return (
    <div className={s.timeline} aria-label="Phrase timeline">
      {(['left', 'right'] as const).map((side) => (
        <div key={side}>
          <span className={s.muted}>{side === 'left' ? 'Left (red)' : 'Right (green)'}</span>
          <div className={s.track}>
            {result.tracks
              .filter((t) => t.side === side)
              .map((t, i) => (
                <span key={i} className={s.trackSeg} title={t.label} style={{ insetInlineStart: pct(t.start), width: pct(Math.max(6, t.end - t.start)), top: t.kind === 'foot' ? 13 : 3, height: 10, background: side === 'left' ? 'var(--color-left)' : 'var(--color-right)', opacity: t.kind === 'foot' ? 0.55 : 0.95 }} />
              ))}
            {result.events
              .filter((e) => 'side' in e && e.side === side && (e.kind === 'hit' || e.kind === 'parry' || e.kind === 'flat' || e.kind === 'short'))
              .map((e, i) => (
                <span key={i} className={s.evt} title={`${e.kind} at ${(e.t / 120).toFixed(2)} s`} style={{ insetInlineStart: pct(e.t), background: e.kind === 'hit' ? '#fff' : e.kind === 'parry' ? '#8fb0ff' : '#999' }} />
              ))}
            {result.lockoutStart !== null && <span className={s.lockout} style={{ insetInlineStart: pct(result.lockoutStart), width: pct(36) }} title="300 ms lockout window" />}
            <span className={s.playhead} style={{ insetInlineStart: pct(tick) }} />
          </div>
        </div>
      ))}
      <div>
        <span className={s.muted}>Priority</span>
        <div className={s.track}>
          {prio.map((p, i) => {
            const next = prio[i + 1]?.t ?? end;
            return <span key={i} className={s.trackSeg} style={{ insetInlineStart: pct(p.t), width: pct(next - p.t), background: p.side === 'left' ? 'var(--color-left)' : p.side === 'right' ? 'var(--color-right)' : 'transparent' }} />;
          })}
          <span className={s.playhead} style={{ insetInlineStart: pct(tick) }} />
        </div>
      </div>
      <span className={s.muted}>White ticks: tip arrivals · blue: blade contacts · shaded: 300 ms lockout window.</span>
    </div>
  );
}

export function RefereeCall({ result }: { result: PhraseResult }) {
  const v = result.verdict;
  return (
    <div className={s.call} role="status" aria-live="polite">
      <p className={s.callFr} lang="fr">
        {v.callFr}
      </p>
      <p>{v.callEn}</p>
      <details>
        <summary style={{ cursor: 'pointer', minHeight: 32 }}>Why?</summary>
        <p className={s.muted}>
          Rule {String(v.rule)}: {v.why}
        </p>
        <ul className={s.muted}>
          {result.slices.map((sl, i) => (
            <li key={i}>
              Slice {i + 1}: {sl.note}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function Captions({ result, player }: { result: PhraseResult | null; player: Player }) {
  const tick = usePlayerTick(player);
  const cap = result ? [...result.captions].reverse().find((c) => c.t <= tick) : undefined;
  return (
    <p className={s.caption} aria-live="polite">
      {cap?.text ?? ''}
    </p>
  );
}

export function ProgressRing({ value, max, label }: { value: number; max: number; label: string }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const f = max ? Math.min(1, value / max) : 0;
  return (
    <svg className={s.ring} width="44" height="44" viewBox="0 0 44 44" role="img" aria-label={`${label}: ${value} of ${max}`}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-surface-hover)" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="5" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 22 22)" strokeLinecap="round" />
    </svg>
  );
}
