import { useEffect, useMemo, useState } from 'react';
import { go } from '../app/router';
import { GLOSSARY } from '../data/glossary';
import { CATEGORY_LABEL, TECHNIQUES, TECHNIQUE_BY_ID } from '../data/techniques';
import type { Category, LineName, Technique } from '../data/types';
import { makeRig, bandFor } from '../rig/dimensions';
import { buildSkeleton } from '../rig/skeleton';
import { measureBetween } from '../sim/geometry';
import { useProgress } from '../store/progress';
import { formatLength, useSettings } from '../store/settings';
import { CameraBar, Captions, Lamps, OverlayToggles, Segmented, TechniqueCard, Transport } from '../ui/components';
import { Player, usePlayerTick } from '../ui/player';
import { DEFAULT_OVERLAYS, Stage, type CameraPreset, type GhostMode, type OverlayFlags } from '../ui/Stage';
import s from '../ui/ui.module.css';
import { baseConfig, demoFor } from './demo';

/** Subsequence fuzzy match; lower score is better, -1 means no match. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx >= 0) return idx;
  let ti = 0;
  let gaps = 0;
  for (const ch of q) {
    const f = t.indexOf(ch, ti);
    if (f < 0) return -1;
    gaps += f - ti;
    ti = f + 1;
  }
  return 100 + gaps;
}

export function searchTechniques(query: string, list: Technique[] = TECHNIQUES): Technique[] {
  if (!query.trim()) return list;
  return list
    .map((t) => {
      const scores = [t.name, t.french, t.id, ...t.aliases].map((x) => fuzzyScore(query, x)).filter((x) => x >= 0);
      return { t, score: scores.length ? Math.min(...scores) : -1 };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.t);
}

function Library() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [level, setLevel] = useState<'all' | 'intermediate' | 'advanced'>('all');
  const [line, setLine] = useState<LineName | 'all'>('all');
  const studied = useProgress((p) => p.studied);
  const learned = useProgress((p) => p.learned);
  const list = useMemo(
    () => searchTechniques(q).filter((t) => (cat === 'all' || t.category === cat) && (level === 'all' || t.level === level) && (line === 'all' || t.lines.includes(line))),
    [q, cat, level, line],
  );
  return (
    <div className={s.page}>
      <div>
        <h1 className={s.pageTitle}>Technique library</h1>
        <p className={s.lead}>Pick a technique to watch it in 3D with slow motion, overlays and coaching notes.</p>
      </div>
      <div className={s.panel}>
        <label className={s.field}>
          Search names, French names and aliases
          <input className={s.input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. contre de sixte" autoComplete="off" />
        </label>
        <Segmented label="Category" value={cat} options={[{ value: 'all', label: 'All' }, ...(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))]} onChange={setCat} />
        <div className={s.row}>
          <Segmented label="Level" value={level} options={[{ value: 'all', label: 'All levels' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} onChange={setLevel} />
          <Segmented label="Line" value={line} options={[{ value: 'all', label: 'All lines' }, { value: 'high', label: 'High' }, { value: 'low', label: 'Low' }, { value: 'inside', label: 'Inside' }, { value: 'outside', label: 'Outside' }]} onChange={setLine} />
        </div>
      </div>
      <p className={s.muted} aria-live="polite">
        {list.length} of {TECHNIQUES.length} techniques
      </p>
      {list.length ? (
        <ul className={`${s.list} ${s.grid}`}>
          {list.map((t) => (
            <li key={t.id}>
              <TechniqueCard t={t} onClick={() => go(`learn/${t.id}`)} meta={`${t.french} · ${t.level}${learned[t.id] ? ` · learned ${learned[t.id]}/5` : studied[t.id] ? ' · studied' : ''}`} />
            </li>
          ))}
        </ul>
      ) : (
        <div className={s.panel}>
          <p>No technique matches those filters.</p>
          <button type="button" className={s.btn} onClick={() => (setQ(''), setCat('all'), setLevel('all'), setLine('all'))}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

const GHOST_FOR = (err: string): GhostMode | null => {
  const e = err.toLowerCase();
  if (e.includes('knee')) return 'kneeOver';
  if (e.includes('bent') || e.includes('elbow') || e.includes('withdraw')) return 'bentArm';
  if (e.includes('high') || e.includes('wide')) return 'highHand';
  if (e.includes('lean') || e.includes('dive') || e.includes('torso')) return 'lean';
  return null;
};

function TechniqueView({ t }: { t: Technique }) {
  const settings = useSettings();
  const progress = useProgress();
  const player = useMemo(() => new Player(), []);
  const [camera, setCamera] = useState<CameraPreset>('referee');
  const [overlays, setOverlays] = useState<OverlayFlags>(DEFAULT_OVERLAYS);
  const [ghost, setGhost] = useState<GhostMode>('ideal');
  const [debug, setDebug] = useState(false);
  const cfgKey = JSON.stringify(baseConfig(settings));
  const result = useMemo(() => demoFor(t.id, JSON.parse(cfgKey)), [t.id, cfgKey]);
  useEffect(() => {
    player.setResult(result);
    player.playing = true;
    player.speed = settings.reducedMotion ? 0.25 : 0.5;
    progress.study(t.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  const tick = usePlayerTick(player);
  const T = result.tempoTicks;
  const first = result.slices[0];
  const span = Math.max(1, (first?.end ?? result.endTick) - (first?.start ?? 0));
  const activeStep = Math.min(t.steps.length - 1, Math.floor((tick / span) * t.steps.length));
  const phases = t.phases.map((p) => ({ name: p.name, start: p.start * T, end: p.end * T }));
  const markers = Object.entries(t.syncMarkers).map(([k, v]) => ({ t: v * T, label: k }));
  const rigL = makeRig(settings.heightLeft);
  const frame = result.frames[Math.min(result.frames.length - 1, Math.round(tick))];
  const skL = buildSkeleton(frame.left, rigL);
  const skR = buildSkeleton(frame.right, makeRig(settings.heightRight));
  const measure = measureBetween(skL, skR, 1);
  const terms = Object.keys(GLOSSARY).filter((k) => `${t.name} ${t.french} ${t.description} ${t.rowNotes}`.toLowerCase().includes(k)).slice(0, 8);
  const rating = progress.learned[t.id];

  return (
    <div className={s.page}>
      <div className={s.row} style={{ justifyContent: 'space-between' }}>
        <div>
          <h1 className={s.pageTitle}>
            {t.name} <span className={s.muted} lang="fr">({t.french})</span>
          </h1>
          <p className={s.muted}>
            {t.id} · {CATEGORY_LABEL[t.category]} · {t.level} · lines: {t.lines.join(', ')}
          </p>
        </div>
        <a className={s.btn} href="#/learn">
          Back to library
        </a>
      </div>
      <div className={s.split}>
        <div className={s.panel}>
          <div style={{ position: 'relative' }}>
            <Stage player={player} camera={camera} overlays={overlays} ghostMode={ghost} label={`3D demonstration of ${t.name}: ${t.demoScenario.note}`} className={s.stage} />
            {(overlays.ruler || debug) && (
              <div className={s.overlayTag}>
                {overlays.ruler && (
                  <span>
                    Measure {formatLength(measure, settings.units)} · {bandFor(measure, rigL)}
                  </span>
                )}
                {debug && (
                  <span>
                    {overlays.ruler ? ' · ' : ''}elbow {skL.elbowFlex.toFixed(0)}° · front knee {skL.frontKneeFlex.toFixed(0)}° · rear knee {skL.rearKneeFlex.toFixed(0)}° · lean {skL.lean.toFixed(0)}°
                  </span>
                )}
              </div>
            )}
          </div>
          <Captions result={result} player={player} />
          <Transport player={player} phases={phases} markers={markers} />
          <CameraBar value={camera} onChange={setCamera} />
          <OverlayToggles
            value={overlays}
            onChange={(o) => {
              setOverlays(o);
              if (!o.ghost) setGhost('ideal');
            }}
            extra={
              <button type="button" className={s.chip} aria-pressed={debug} onClick={() => setDebug(!debug)}>
                Joint angles
              </button>
            }
          />
          <Lamps result={result} tick={tick} />
          <p className={s.muted}>
            Demo: {t.demoScenario.note} Referee: {result.verdict.callFr} ({result.verdict.callEn}).
          </p>
        </div>
        <div className={s.panel}>
          <h2 className={s.sectionTitle}>What it is</h2>
          <p>{t.description}</p>
          <h3>When to use it</h3>
          <p>{t.whenToUse}</p>
          <h3>Execution</h3>
          <ol className={s.steps}>
            {t.steps.map((st, i) => (
              <li key={i} className={i === activeStep ? s.activeStep : undefined} aria-current={i === activeStep ? 'step' : undefined}>
                {st}
              </li>
            ))}
          </ol>
          <h3>Common errors</h3>
          <ul className={s.list}>
            {t.commonErrors.map((e, i) => {
              const g = GHOST_FOR(e);
              const on = overlays.ghost && g === ghost;
              return (
                <li key={i} className={s.row} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <span>{e}</span>
                  {g && (
                    <button
                      type="button"
                      className={`${s.chip}`}
                      aria-pressed={on}
                      onClick={() => {
                        if (on) {
                          setOverlays({ ...overlays, ghost: false });
                          setGhost('ideal');
                        } else {
                          setGhost(g);
                          setOverlays({ ...overlays, ghost: true });
                        }
                      }}
                    >
                      Show error
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <h3>Tactical notes</h3>
          <p>{t.tacticalNotes}</p>
          <h3>Right of way</h3>
          <p>{t.rowNotes}</p>
          {t.prerequisites.length > 0 && (
            <>
              <h3>Prerequisites</h3>
              <div className={s.row}>
                {t.prerequisites.map((id) => (
                  <a key={id} className={s.chip} href={`#/learn/${id}`}>
                    {TECHNIQUE_BY_ID[id]?.name ?? id}
                  </a>
                ))}
              </div>
            </>
          )}
          <h3>Countered by</h3>
          {t.counteredBy.length ? (
            <ul className={s.list}>
              {t.counteredBy.map((c) => (
                <li key={c.id}>
                  <a href={`#/counters/${t.id}/${c.id}`}>{TECHNIQUE_BY_ID[c.id]?.name}</a> <span className={s[c.reliability]}>{c.reliability}</span>
                  <br />
                  <span className={s.muted}>{c.why}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.muted}>Nothing: this is the foundation every action starts from.</p>
          )}
          <h3>Counters</h3>
          {t.counters.length ? (
            <div className={s.row}>
              {t.counters.map((c) => (
                <a key={c.id} className={s.chip} href={`#/counters/${c.id}/${t.id}`}>
                  {TECHNIQUE_BY_ID[c.id]?.name}
                </a>
              ))}
            </div>
          ) : (
            <p className={s.muted}>It is not listed as the answer to another technique.</p>
          )}
          {terms.length > 0 && (
            <>
              <h3>Glossary</h3>
              <dl style={{ margin: 0, display: 'grid', gap: 4 }}>
                {terms.map((k) => (
                  <div key={k}>
                    <dt style={{ display: 'inline', fontWeight: 650 }} lang="fr">
                      {k}
                    </dt>
                    : <dd style={{ display: 'inline', margin: 0 }}>{GLOSSARY[k]}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          <h3>Your progress</h3>
          <div className={s.row}>
            <button type="button" className={`${s.btn} ${rating ? '' : s.primary}`} onClick={() => (rating ? progress.unlearn(t.id) : progress.rate(t.id, 3))} aria-pressed={!!rating}>
              {rating ? 'Learned' : 'Mark as learned'}
            </button>
            <Segmented label="Self-rating" value={rating ?? 0} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}` }))} onChange={(n) => progress.rate(t.id, n)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Learn({ id }: { id?: string }) {
  const t = id ? TECHNIQUE_BY_ID[id.toUpperCase()] : undefined;
  if (id && !t)
    return (
      <div className={s.page}>
        <h1 className={s.pageTitle}>Technique not found</h1>
        <p>
          There is no technique with the id {id}. <a href="#/learn">Open the library</a> to pick one.
        </p>
      </div>
    );
  return t ? <TechniqueView key={t.id} t={t} /> : <Library />;
}
