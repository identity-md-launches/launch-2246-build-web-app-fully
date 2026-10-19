import { lazy, Suspense, useEffect, useRef } from 'react';
import { useRoute } from './router';
import css from './App.module.css';
import { Home } from '../modes/Home';

const Learn = lazy(() => import('../modes/Learn'));
const CounterExplorer = lazy(() => import('../modes/CounterExplorer'));
const Fencing = lazy(() => import('../modes/Fencing'));
const Drills = lazy(() => import('../modes/Drills'));
const SettingsPage = lazy(() => import('../modes/Settings'));
const Lab = lazy(() => import('../modes/Lab'));
const Bench = lazy(() => import('../modes/Bench'));

const NAV: [string, string][] = [
  ['', 'Home'],
  ['learn', 'Learn'],
  ['counters', 'Counters'],
  ['fence', 'Fence'],
  ['drills', 'Drills'],
  ['settings', 'Settings'],
];

const TITLES: Record<string, string> = {
  '': 'Piste: 3D foil fencing trainer',
  learn: 'Learn · Piste',
  counters: 'Counter Explorer · Piste',
  fence: 'Fencing Mode · Piste',
  drills: 'Drills · Piste',
  settings: 'Settings · Piste',
  lab: 'Animation lab · Piste',
  bench: 'Benchmark · Piste',
};

export function App() {
  const route = useRoute();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    document.title = TITLES[route.path] ?? TITLES[''];
    // Move focus to the new view on route changes (not on first load).
    if (first.current) first.current = false;
    else main.current?.focus();
  }, [route.path]);

  let view;
  switch (route.path) {
    case 'learn':
      view = <Learn id={route.parts[1]} />;
      break;
    case 'counters':
      view = <CounterExplorer id={route.parts[1]} counter={route.parts[2]} />;
      break;
    case 'fence':
      view = <Fencing />;
      break;
    case 'drills':
      view = <Drills />;
      break;
    case 'settings':
      view = <SettingsPage />;
      break;
    case 'lab':
      view = <Lab />;
      break;
    case 'bench':
      view = <Bench />;
      break;
    default:
      view = <Home />;
  }
  return (
    <div className={css.shell}>
      <a className={css.skip} href="#main" onClick={(e) => (e.preventDefault(), main.current?.focus())}>
        Skip to content
      </a>
      <header className={css.header}>
        <a className={css.brand} href="#/">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#1d2027" />
            <path d="M6 24L24 8" stroke="#eef0f3" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="8" cy="22" r="3.2" fill="#e5484d" />
            <circle cx="25" cy="7" r="2.4" fill="#30a46c" />
          </svg>
          Piste
        </a>
        <nav className={css.nav} aria-label="Main">
          {NAV.map(([p, label]) => (
            <a key={p} href={`#/${p}`} aria-current={route.path === p ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main id="main" ref={main} tabIndex={-1} style={{ outline: 'none' }}>
        <Suspense fallback={<p style={{ padding: 16 }}>Loading the training room…</p>}>{view}</Suspense>
      </main>
      <footer className={css.footer}>
        Piste is a training visualization, not a replacement for a coach. Rules follow FIE foil conventions in simplified form.
      </footer>
    </div>
  );
}
