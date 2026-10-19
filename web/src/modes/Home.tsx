import { useEffect, useMemo } from 'react';
import { TECHNIQUES } from '../data/techniques';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { ProgressRing } from '../ui/components';
import { Player } from '../ui/player';
import { Stage } from '../ui/Stage';
import s from '../ui/ui.module.css';
import h from './Home.module.css';
import { baseConfig, demoFor } from './demo';

const CARDS = [
  { href: '#/learn', title: 'Learn', text: 'Browse all 100 techniques in 3D with slow motion and coaching notes.' },
  { href: '#/counters', title: 'Counter Explorer', text: 'See what beats each action, three levels deep.' },
  { href: '#/fence', title: 'Fencing Mode', text: 'Fence an NPC or a friend; the referee calls every phrase.' },
  { href: '#/drills', title: 'Drills', text: 'Identify, counter, call and build actions against the clock.' },
  { href: '#/settings', title: 'Settings', text: 'Handedness, heights, tempo, audio and key bindings.' },
];

export function Home() {
  const settings = useSettings();
  const studied = useProgress((p) => Object.keys(p.studied).length);
  const drills = useProgress((p) => p.drillsPassed);
  const bouts = useProgress((p) => p.bouts);
  const player = useMemo(() => new Player(), []);
  const cfg = baseConfig(settings, 3);
  const key = JSON.stringify(cfg);
  useEffect(() => {
    player.setResult(demoFor('FW13', JSON.parse(key)));
    player.speed = settings.reducedMotion ? 0.25 : 0.5;
  }, [player, key, settings.reducedMotion]);

  const rings = [
    { label: 'Techniques studied', value: studied, max: TECHNIQUES.length },
    { label: 'Drills passed', value: drills, max: 20 },
    { label: 'Bouts won', value: bouts.won, max: Math.max(1, bouts.won + bouts.lost) },
  ];
  return (
    <div className={s.page}>
      <section className={h.hero} aria-labelledby="hero-title">
        <div className={h.copy}>
          <h1 id="hero-title" className={h.title}>
            Train foil fencing in 3D
          </h1>
          <p className={h.sub}>100 foil techniques, their counters and a referee that calls right of way.</p>
          <div className={s.row}>
            <a className={`${s.btn} ${s.primary}`} href="#/learn">
              Start learning
            </a>
            <a className={s.btn} href="#/fence">
              Fence a bout
            </a>
          </div>
        </div>
        <a href="#/learn/FW13" className={h.stageLink} aria-label="Open the advance-lunge demo in Learn Mode">
          <Stage player={player} label="Animated demo: the red fencer makes an advance-lunge and hits the green fencer's chest" className={h.stage} />
        </a>
      </section>

      <section aria-labelledby="modes-title" className={s.panel}>
        <h2 id="modes-title" className={s.sectionTitle}>
          Training modes
        </h2>
        <ul className={h.cards}>
          {CARDS.map((c) => (
            <li key={c.href}>
              <a className={h.mode} href={c.href}>
                <span className={s.cardTitle}>{c.title}</span>
                <span className={s.muted}>{c.text}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className={h.rings}>
          {rings.map((r) => (
            <div key={r.label} className={h.ringItem}>
              <ProgressRing value={r.value} max={r.max} label={r.label} />
              <span>
                <strong>
                  {r.value}/{r.max}
                </strong>
                <br />
                <span className={s.muted}>{r.label}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
