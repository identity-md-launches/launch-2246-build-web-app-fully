import { useState } from 'react';
import { TECHNIQUE_BY_ID } from '../data/techniques';
import { useProgress } from '../store/progress';
import { DEFAULT_KEYS, formatLength, useSettings } from '../store/settings';
import { Segmented } from '../ui/components';
import s from '../ui/ui.module.css';

const KEY_LABELS: Record<string, string> = {
  retreat: 'Retreat',
  advance: 'Advance',
  quarte: 'Quarte parry',
  sixte: 'Sixte parry',
  septime: 'Septime parry',
  octave: 'Octave parry',
  counter: 'Counter-parry modifier (hold)',
};

export default function Settings() {
  const st = useSettings();
  const resetProgress = useProgress((p) => p.resetAll);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className={s.page}>
      <div>
        <h1 className={s.pageTitle}>Settings</h1>
        <p className={s.lead}>Changes save on this device automatically.</p>
      </div>
      <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        <section className={s.panel} aria-labelledby="fencers">
          <h2 id="fencers" className={s.sectionTitle}>
            Fencers
          </h2>
          {(['Left', 'Right'] as const).map((side) => {
            const hk = side === 'Left' ? 'handedLeft' : 'handedRight';
            const hgt = side === 'Left' ? 'heightLeft' : 'heightRight';
            return (
              <div key={side} className={s.field}>
                {side} fencer
                <Segmented label={`${side} fencer handedness`} value={st[hk]} options={[{ value: 1, label: 'Right-handed' }, { value: -1, label: 'Left-handed' }]} onChange={(v) => st.set({ [hk]: v as 1 | -1 })} />
                <label className={s.field}>
                  Height: {formatLength(st[hgt], st.units)}
                  <input type="range" min={1.55} max={2} step={0.01} value={st[hgt]} onChange={(e) => st.set({ [hgt]: Number(e.target.value) })} />
                </label>
              </div>
            );
          })}
          <label className={s.row}>
            <input type="checkbox" checked={st.raisedRearArm} onChange={(e) => st.set({ raisedRearArm: e.target.checked })} /> Show the classical raised rear arm
          </label>
        </section>
        <section className={s.panel} aria-labelledby="sim">
          <h2 id="sim" className={s.sectionTitle}>
            Simulation and display
          </h2>
          <div className={s.field}>
            Units
            <Segmented label="Units" value={st.units} options={[{ value: 'm', label: 'Metres' }, { value: 'ft', label: 'Feet' }]} onChange={(v) => st.set({ units: v })} />
          </div>
          <label className={s.field}>
            Tempo: {Math.round(st.tempoSec * 1000)} ms per fencing time
            <input type="range" min={0.2} max={0.45} step={0.01} value={st.tempoSec} onChange={(e) => st.set({ tempoSec: Number(e.target.value) })} />
          </label>
          <label className={s.row}>
            <input type="checkbox" checked={st.reducedMotion} onChange={(e) => st.set({ reducedMotion: e.target.checked })} /> Reduce motion (no camera easing or automatic camera cuts)
          </label>
          <label className={s.row}>
            <input type="checkbox" checked={st.colorblind} onChange={(e) => st.set({ colorblind: e.target.checked })} /> Add shapes to scoring lamps
          </label>
          <label className={s.field}>
            Audio volume: {Math.round(st.volume * 100)}%
            <input type="range" min={0} max={1} step={0.05} value={st.volume} onChange={(e) => st.set({ volume: Number(e.target.value) })} />
          </label>
        </section>
        <section className={s.panel} aria-labelledby="keys">
          <h2 id="keys" className={s.sectionTitle}>
            Tempo Mode keys
          </h2>
          {Object.keys(KEY_LABELS).map((k) => (
            <label key={k} className={s.field}>
              {KEY_LABELS[k]}
              <input className={s.input} value={st.keys[k] ?? ''} maxLength={1} onChange={(e) => e.target.value && st.set({ keys: { ...st.keys, [k]: e.target.value.toLowerCase() } })} />
            </label>
          ))}
          <p className={s.muted}>Space lunges and Shift+Space makes a flèche.</p>
          <button type="button" className={s.btn} onClick={() => st.set({ keys: DEFAULT_KEYS })}>
            Restore default keys
          </button>
          <h3>Quick slots 1 to 9</h3>
          {st.quickSlots.map((id, i) => (
            <label key={i} className={s.field}>
              Slot {i + 1}
              <select className={s.input} value={id} onChange={(e) => st.set({ quickSlots: st.quickSlots.map((x, j) => (j === i ? e.target.value : x)) })}>
                {Object.values(TECHNIQUE_BY_ID)
                  .filter((t) => t.category !== 'footwork')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} {t.name}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </section>
        <section className={s.panel} aria-labelledby="reset">
          <h2 id="reset" className={s.sectionTitle}>
            Progress
          </h2>
          <p className={s.muted}>Resetting clears studied techniques, ratings, drill scores, bout record and saved phrases.</p>
          {confirm ? (
            <div className={s.row}>
              <button
                type="button"
                className={`${s.btn} ${s.primary}`}
                onClick={() => {
                  resetProgress();
                  setConfirm(false);
                  setDone(true);
                }}
              >
                Yes, reset progress
              </button>
              <button type="button" className={s.btn} onClick={() => setConfirm(false)}>
                Keep progress
              </button>
            </div>
          ) : (
            <button type="button" className={s.btn} onClick={() => (setConfirm(true), setDone(false))}>
              Reset progress
            </button>
          )}
          <p aria-live="polite" className={s.muted}>
            {done ? 'Progress reset.' : ''}
          </p>
          <button type="button" className={s.btn} onClick={() => st.reset()}>
            Restore default settings
          </button>
          <p className={s.muted}>
            Developer pages: <a href="#/lab">animation lab</a> and <a href="#/bench">render benchmark</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
