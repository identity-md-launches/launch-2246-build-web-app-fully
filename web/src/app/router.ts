import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  parts: string[];
}
function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
  return { path: parts[0] ?? '', parts };
}

/** Hash router: static hosts have no rewrites, so every route lives after #. */
export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
export function go(path: string) {
  window.location.hash = `#/${path}`;
}
