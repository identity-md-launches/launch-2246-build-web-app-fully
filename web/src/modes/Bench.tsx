import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../store/settings';
import { Player } from '../ui/player';
import { Stage } from '../ui/Stage';
import s from '../ui/ui.module.css';
import { baseConfig, demoFor } from './demo';

/** Scripted two-fencer scene; measures frame-to-frame time in the browser (target: under 12 ms render time). */
export default function Bench() {
  const settings = useSettings();
  const player = useMemo(() => new Player(), []);
  const [stats, setStats] = useState<{ frames: number; avg: number; p95: number } | null>(null);
  const [running, setRunning] = useState(false);
  const samples = useRef<number[]>([]);
  useEffect(() => {
    player.setResult(demoFor('FW15', baseConfig(settings)));
    player.loop = true;
    player.speed = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);
  const run = () => {
    samples.current = [];
    setRunning(true);
    setStats(null);
    let last = performance.now();
    const until = last + 5000;
    const loop = (now: number) => {
      samples.current.push(now - last);
      last = now;
      if (now < until) requestAnimationFrame(loop);
      else {
        const xs = samples.current.slice(5).sort((a, b) => a - b);
        const avg = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
        setStats({ frames: xs.length, avg, p95: xs[Math.floor(xs.length * 0.95)] ?? 0 });
        setRunning(false);
      }
    };
    requestAnimationFrame(loop);
  };
  return (
    <div className={s.page}>
      <div>
        <h1 className={s.pageTitle}>Render benchmark</h1>
        <p className={s.lead}>Runs a looping flèche between two fencers for five seconds and reports frame times. Frame time is capped by the display refresh rate.</p>
      </div>
      <div className={s.panel}>
        <Stage player={player} label="Benchmark scene: two fencers, flèche loop" className={s.stage} />
        <button type="button" className={`${s.btn} ${s.primary}`} onClick={run} disabled={running}>
          {running ? 'Measuring…' : 'Run 5-second benchmark'}
        </button>
        <p aria-live="polite">
          {stats ? `${stats.frames} frames · average ${stats.avg.toFixed(2)} ms (${(1000 / stats.avg).toFixed(0)} fps) · 95th percentile ${stats.p95.toFixed(2)} ms · ${stats.avg < 16.8 ? 'meets' : 'misses'} the 60 fps target` : 'No measurement yet.'}
        </p>
      </div>
    </div>
  );
}
