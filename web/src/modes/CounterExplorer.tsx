import { useEffect, useMemo, useState } from 'react';
import { go } from '../app/router';
import { counterChain, type ChainNode } from '../data/graph';
import { TECHNIQUES, TECHNIQUE_BY_ID } from '../data/techniques';
import { useSettings } from '../store/settings';
import { CameraBar, Captions, Lamps, PhraseTimeline, RefereeCall, Segmented, Transport } from '../ui/components';
import { Player, usePlayerTick } from '../ui/player';
import { Stage, type CameraPreset } from '../ui/Stage';
import s from '../ui/ui.module.css';
import { baseConfig, versusFor } from './demo';
import { searchTechniques } from './Learn';

function Chain({ nodes, onPick, depth = 0 }: { nodes: ChainNode[]; onPick: (id: string) => void; depth?: number }) {
  if (!nodes.length) return null;
  return (
    <ul className={s.tree} aria-label={depth === 0 ? 'Counter chain' : undefined}>
      {nodes.map((n, i) => (
        <li key={n.id + i}>
          <button type="button" className={s.linkBtn} onClick={() => onPick(n.id)}>
            {TECHNIQUE_BY_ID[n.id]?.name} ({n.id})
          </button>{' '}
          {n.reliability && <span className={s[n.reliability]}>{n.reliability}</span>}
          <Chain nodes={n.children} onPick={onPick} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

export default function CounterExplorer({ id, counter }: { id?: string; counter?: string }) {
  const settings = useSettings();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'counters' | 'chain'>('counters');
  const [camera, setCamera] = useState<CameraPreset>('referee');
  const t = TECHNIQUE_BY_ID[(id ?? 'AT03').toUpperCase()] ?? TECHNIQUE_BY_ID.AT03;
  const c = counter ? TECHNIQUE_BY_ID[counter.toUpperCase()] : t.counteredBy[0] ? TECHNIQUE_BY_ID[t.counteredBy[0].id] : undefined;
  const player = useMemo(() => new Player(), []);
  const cfgKey = JSON.stringify(baseConfig(settings, 11));
  const result = useMemo(() => (c ? versusFor(t.id, c.id, JSON.parse(cfgKey)) : null), [t.id, c, cfgKey]);
  useEffect(() => {
    player.setResult(result);
    player.speed = 0.5;
    player.playing = true;
  }, [player, result]);
  const tick = usePlayerTick(player);
  const matches = searchTechniques(q).slice(0, 8);
  const chain = useMemo(() => counterChain(view === 'chain' && c ? c.id : t.id, 3), [t.id, c, view]);

  return (
    <div className={s.page}>
      <div>
        <h1 className={s.pageTitle}>Counter Explorer</h1>
        <p className={s.lead}>Choose a technique, then play it against each counter. The resolver simulates the exchange and the referee calls it.</p>
      </div>
      <div className={s.split}>
        <div className={s.panel}>
          <h2 className={s.sectionTitle}>
            {t.name} versus {c ? c.name : 'nothing'}
          </h2>
          {result && c ? (
            <>
              <Stage player={player} camera={camera} label={`3D demo: ${t.name} (red) against ${c.name} (green)`} className={s.stage} />
              <Captions result={result} player={player} />
              <Transport player={player} />
              <CameraBar value={camera} onChange={setCamera} />
              <Lamps result={result} tick={tick} />
              <RefereeCall result={result} />
              <PhraseTimeline result={result} player={player} />
            </>
          ) : (
            <p>{t.name} has no listed counters: it is the foundation. Pick another technique.</p>
          )}
        </div>
        <div className={s.panel}>
          <label className={s.field}>
            Find a technique
            <input className={s.input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. flèche" autoComplete="off" />
          </label>
          {q && (
            <ul className={s.list}>
              {matches.map((m) => (
                <li key={m.id}>
                  <button type="button" className={s.linkBtn} onClick={() => (setQ(''), go(`counters/${m.id}`))}>
                    {m.name} ({m.id})
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Segmented
            label="View"
            value={view}
            options={[
              { value: 'counters', label: `What beats ${t.name}` },
              { value: 'chain', label: c ? `What beats ${c.name}` : 'Reverse chain' },
            ]}
            onChange={setView}
          />
          {view === 'counters' ? (
            <ul className={s.list}>
              {t.counteredBy.map((x) => (
                <li key={x.id}>
                  <button type="button" className={s.card} aria-current={c?.id === x.id ? 'true' : undefined} onClick={() => go(`counters/${t.id}/${x.id}`)} style={{ width: '100%' }}>
                    <span className={s.cardTitle} style={{ gridColumn: '1 / -1' }}>
                      {TECHNIQUE_BY_ID[x.id]?.name} <span className={s[x.reliability]}>{x.reliability}</span>
                    </span>
                    <span className={s.muted} style={{ gridColumn: '1 / -1' }}>
                      {x.why}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className={s.muted}>The counter-to-counter chain, three levels deep. Select any node to explore it.</p>
              <Chain nodes={chain} onPick={(nid) => go(`counters/${nid}`)} />
            </>
          )}
          <a className={s.btn} href={`#/learn/${t.id}`}>
            Open {t.name} in Learn
          </a>
          <p className={s.muted}>{TECHNIQUES.length} techniques in the graph.</p>
        </div>
      </div>
    </div>
  );
}
